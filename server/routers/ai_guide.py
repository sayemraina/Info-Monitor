"""AI Guide API router.

Endpoints for conversational AI guidance and audit trail.
"""

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pathlib import Path
import json
import uuid
from typing import Optional

from server.ai_guide.context import build_context
from server.ai_guide.llm import chat_claude, chat_gemini
from server.ai_guide.audit import log_interaction
from server.timing import track


def detect_intent(user_message: str) -> str:
    """
    Detect whether question is descriptive or analytical.

    Descriptive (Gemini): what/how/explain/describe/show/tell me
    Analytical (Claude): why/pattern/trend/signal/divergence/coordination

    Returns: 'descriptive' or 'analytical'
    """
    message_lower = user_message.lower()

    # Analytical keywords (Claude's strength)
    analytical_keywords = [
        'why', 'pattern', 'trend', 'signal', 'divergence', 'coordination',
        'implication', 'meaning', 'suggest', 'indicate', 'correlation',
        'anomaly', 'unusual', 'significant', 'interpret',
    ]

    # Descriptive keywords (Gemini is fine)
    descriptive_keywords = [
        'what is', 'what are', 'how many', 'how does', 'explain',
        'describe', 'show me', 'tell me', 'define', 'who', 'when', 'where',
    ]

    # Check for analytical intent first (higher priority)
    for keyword in analytical_keywords:
        if keyword in message_lower:
            return 'analytical'

    # Check for descriptive intent
    for keyword in descriptive_keywords:
        if keyword in message_lower:
            return 'descriptive'

    # Default to analytical (Claude) for ambiguous cases
    return 'analytical'


router = APIRouter()

# Load system prompt
SYSTEM_PROMPT_PATH = Path("server/ai_guide/prompts/system_analytical.md")
SYSTEM_ANALYTICAL = SYSTEM_PROMPT_PATH.read_text()


class ChatRequest(BaseModel):
    """Chat request payload."""
    session_id: str
    view_state: dict
    messages: list[dict]
    is_tour_followup: bool = False  # When True, always use Claude — tour follow-ups require system prompt fidelity


@router.post("/ai-guide/chat")
async def chat(request: ChatRequest):
    """
    Stream Claude response for AI Guide conversation.

    Request body:
    {
      "session_id": "uuid",
      "view_state": {
        "topic_id": "ai-workplace",
        "level": 1,
        "timeWindow": "24h",
        ...
      },
      "messages": [
        {"role": "user", "content": "What is this cluster?"}
      ]
    }

    Response: Server-Sent Events stream with JSON chunks:
    data: {"text": "This is the"}
    data: {"text": " largest cluster..."}
    data: {"actions": [...]}  (optional, in Phase 4)
    """

    # Build context
    topic_id = request.view_state.get("topic_id", "ai-workplace")

    try:
        stable, volatile = await build_context(topic_id, request.view_state)
    except Exception as e:
        # If context building fails, return error
        async def error_stream():
            yield f'data: {json.dumps({"error": str(e)})}\n\n'

        return StreamingResponse(error_stream(), media_type="text/event-stream")

    # Detect intent and route to appropriate model.
    # Tour follow-ups always use Claude — the user is asking about something the guide just said,
    # which requires system prompt fidelity. Gemini doesn't follow the persona reliably.
    user_message = request.messages[-1]["content"] if request.messages else ""
    if request.is_tour_followup:
        provider = "claude"
        intent = "analytical"  # for audit log consistency
    else:
        intent = detect_intent(user_message)
        provider = "gemini" if intent == "descriptive" else "claude"

    interaction_id = str(uuid.uuid4())
    full_response = []
    cache_hit = False

    async def generate():
        nonlocal cache_hit

        with track("ai_guide_call", interaction_id=interaction_id, provider=provider, intent=intent) as rec:
            try:
                # Route to appropriate model
                if provider == "gemini":
                    response = await chat_gemini(
                        system_prompt=SYSTEM_ANALYTICAL,
                        stable_ctx=stable.serialize(),
                        volatile_ctx=volatile.serialize(),
                        messages=request.messages,
                        stream=True,
                    )
                else:
                    response = await chat_claude(
                        system_prompt=SYSTEM_ANALYTICAL,
                        stable_ctx=stable.serialize(),
                        volatile_ctx=volatile.serialize(),
                        messages=request.messages,
                        stream=True,
                    )

                # Stream response (OpenAI-compatible format)
                async for chunk in response:
                    if chunk.choices and len(chunk.choices) > 0:
                        delta = chunk.choices[0].delta
                        if delta.content:
                            text = delta.content
                            full_response.append(text)
                            yield f'data: {json.dumps({"text": text})}\n\n'

                    # Check for usage info (cache hits tracked by OpenRouter)
                    if hasattr(chunk, 'usage') and chunk.usage:
                        # OpenRouter doesn't expose cache hits in the same way
                        # but we can log the usage
                        cache_hit = False  # TODO: OpenRouter cache detection

            except Exception as e:
                yield f'data: {json.dumps({"error": str(e)})}\n\n'
                rec["error"] = str(e)

            # Log interaction after streaming completes
            model_name = "gemini-2.0-pro" if provider == "gemini" else "claude-sonnet-4"
            log_interaction({
                "interaction_id": interaction_id,
                "session_id": request.session_id,
                "user_question": user_message,
                "view_state": request.view_state,
                "context_bytes": len(stable.serialize()) + len(volatile.serialize()),
                "provider": provider,
                "model": model_name,
                "intent": intent,
                "response_text": "".join(full_response),
                "timing_ms": rec.get("duration_s", 0) * 1000,
                "cache_hit": cache_hit,
            })

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/ai-guide/audit/recent")
async def get_recent_interactions(limit: int = 50):
    """Get recent interactions from audit log."""
    from server.ai_guide.audit import AUDIT_LOG

    if not AUDIT_LOG.exists():
        return []

    interactions = []
    with AUDIT_LOG.open("r") as f:
        lines = f.readlines()
        for line in lines[-limit:]:
            try:
                interactions.append(json.loads(line))
            except:
                pass

    return list(reversed(interactions))


@router.get("/ai-guide/audit/{interaction_id}")
async def get_interaction_detail(interaction_id: str):
    """Get full detail for one interaction."""
    from server.ai_guide.audit import AUDIT_LOG

    if not AUDIT_LOG.exists():
        return {"error": "Audit log not found"}

    with AUDIT_LOG.open("r") as f:
        for line in f:
            try:
                record = json.loads(line)
                if record.get("interaction_id") == interaction_id:
                    return record
            except:
                pass

    return {"error": "Interaction not found"}


@router.get("/ai-guide/audit/summary")
async def get_audit_summary():
    """Get aggregate stats from audit log."""
    from server.ai_guide.audit import AUDIT_LOG

    if not AUDIT_LOG.exists():
        return {
            "total": 0,
            "provider_split": {},
            "cache_hit_rate": 0,
        }

    interactions = []
    with AUDIT_LOG.open("r") as f:
        for line in f:
            try:
                interactions.append(json.loads(line))
            except:
                pass

    total = len(interactions)
    if total == 0:
        return {
            "total": 0,
            "provider_split": {},
            "cache_hit_rate": 0,
        }

    claude_count = sum(1 for i in interactions if i.get("provider") == "claude")
    gemini_count = sum(1 for i in interactions if i.get("provider") == "gemini")
    cache_hits = sum(1 for i in interactions if i.get("cache_hit"))

    return {
        "total": total,
        "provider_split": {
            "claude": claude_count / total,
            "gemini": gemini_count / total,
        },
        "cache_hit_rate": cache_hits / total,
    }
