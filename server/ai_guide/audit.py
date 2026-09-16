"""Audit logging for AI Guide interactions.

Append-only JSONL log for observability and debugging.
"""

from pathlib import Path
from datetime import datetime, timezone
import json

AUDIT_LOG = Path("data/.ai_guide/interactions.jsonl")


def log_interaction(record: dict) -> None:
    """
    Append interaction to JSONL audit log.

    Args:
        record: Dictionary with interaction details:
            - interaction_id: Unique ID
            - session_id: User session ID
            - user_question: User's message
            - view_state: Current app state
            - context_bytes: Size of context sent
            - provider: 'claude' or 'gemini'
            - model: Model name
            - response_text: AI's response
            - timing_ms: Response latency
            - cache_hit: Whether cache was used
    """

    # Ensure directory exists
    AUDIT_LOG.parent.mkdir(parents=True, exist_ok=True)

    # Add timestamp
    record["timestamp"] = datetime.now(timezone.utc).isoformat()

    # Append to log (crash-safe)
    try:
        with AUDIT_LOG.open("a") as f:
            f.write(json.dumps(record, default=str) + "\n")
    except Exception as e:
        # Log errors don't block user experience
        print(f"Audit log write failed: {e}")
