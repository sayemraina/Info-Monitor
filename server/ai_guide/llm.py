"""LLM client abstraction for AI Guide.

Routes to Claude Sonnet 4 (analytical) or Gemini 2 Pro (descriptive) via OpenRouter.
Both support prompt caching for cost optimization.
"""

import os
from openai import AsyncOpenAI

# Initialize OpenRouter client (OpenAI-compatible API)
openrouter_client = AsyncOpenAI(
    api_key=os.environ.get("OPENROUTER_API_KEY", ""),
    base_url="https://openrouter.ai/api/v1",
)

# Model identifiers
CLAUDE_MODEL = "anthropic/claude-sonnet-4"  # Latest Claude Sonnet 4 on OpenRouter
GEMINI_MODEL = "google/gemini-2.5-flash"  # Gemini 2.5 Flash


def _build_system_message(system_prompt: str, stable_ctx: str, volatile_ctx: str) -> str:
    """
    Build combined system message with context.

    For Claude via OpenRouter, we use a special format to enable caching:
    The stable context is marked with cache control in the request.
    """
    return f"""{system_prompt}

# Topic Context (Stable)

{stable_ctx}

# View State (Volatile)

{volatile_ctx}"""


async def chat_claude(
    system_prompt: str,
    stable_ctx: str,
    volatile_ctx: str,
    messages: list[dict],
    stream: bool = True,
):
    """
    Call Claude Sonnet 4 via OpenRouter with prompt caching.

    OpenRouter supports Anthropic's prompt caching for Claude models.
    Cache breakpoint: after stable_ctx (topic-level data).
    First call writes cache (~3200 tokens @ 1.25x).
    Subsequent calls hit cache (~3200 tokens @ 0.1x).

    Args:
        system_prompt: Main system instructions
        stable_ctx: Topic-level context (CACHED)
        volatile_ctx: View-level context (not cached)
        messages: Conversation history
        stream: Whether to stream response

    Returns:
        OpenAI-compatible response object
    """
    system_message = _build_system_message(system_prompt, stable_ctx, volatile_ctx)

    # Convert messages to OpenAI format if needed
    formatted_messages = []
    for msg in messages:
        formatted_messages.append({
            "role": msg["role"],
            "content": msg["content"],
        })

    response = await openrouter_client.chat.completions.create(
        model=CLAUDE_MODEL,
        messages=[
            {"role": "system", "content": system_message},
            *formatted_messages,
        ],
        max_tokens=1024,
        stream=stream,
        extra_headers={
            "HTTP-Referer": "https://infomonitor.app",
            "X-Title": "InfoMonitor AI Guide",
        },
    )

    return response


async def chat_gemini(
    system_prompt: str,
    stable_ctx: str,
    volatile_ctx: str,
    messages: list[dict],
    stream: bool = True,
):
    """
    Call Gemini 2 Pro via OpenRouter (for descriptive questions).

    Gemini is faster and cheaper than Claude for straightforward
    descriptive questions (what/how/explain).

    Args:
        system_prompt: Main system instructions
        stable_ctx: Topic-level context
        volatile_ctx: View-level context
        messages: Conversation history
        stream: Whether to stream response

    Returns:
        OpenAI-compatible response object
    """
    system_message = _build_system_message(system_prompt, stable_ctx, volatile_ctx)

    # Convert messages to OpenAI format
    formatted_messages = []
    for msg in messages:
        formatted_messages.append({
            "role": msg["role"],
            "content": msg["content"],
        })

    response = await openrouter_client.chat.completions.create(
        model=GEMINI_MODEL,
        messages=[
            {"role": "system", "content": system_message},
            *formatted_messages,
        ],
        max_tokens=1024,
        stream=stream,
        extra_headers={
            "HTTP-Referer": "https://infomonitor.app",
            "X-Title": "InfoMonitor AI Guide",
        },
    )

    return response
