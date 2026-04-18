"""
Pipeline timing instrumentation.

Append-only JSONL log at data/.timings/runs.jsonl.
One row per measured event. Crash-safe, schema-less, easy to slurp with `pandas`
or `jq`.

Usage:
    from server.timing import track
    with track("pipeline_step", job_id="...", topic_id="...", step="ingest") as rec:
        do_work()
        rec["items_processed"] = 42  # attach extra fields inside the block

Rows always include: event, started_at (ISO UTC), duration_s, plus whatever
fields you pass as kwargs or attach inside the `with` block.
"""

from __future__ import annotations

import json
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

TIMINGS_DIR = Path(__file__).parent.parent / "data" / ".timings"
TIMINGS_DIR.mkdir(parents=True, exist_ok=True)
RUNS_LOG = TIMINGS_DIR / "runs.jsonl"


@contextmanager
def track(event: str, **fields: object) -> Iterator[dict]:
    """Context manager — records wall-clock duration and appends a JSONL row.

    The yielded dict is mutable; mutations are persisted on exit.
    Exceptions propagate normally; duration is still recorded.
    """
    t0 = time.perf_counter()
    record: dict = {
        "event": event,
        "started_at": datetime.now(timezone.utc).isoformat(),
        **fields,
    }
    try:
        yield record
    finally:
        record["duration_s"] = round(time.perf_counter() - t0, 3)
        try:
            with RUNS_LOG.open("a") as f:
                f.write(json.dumps(record, default=str) + "\n")
        except Exception:
            # Instrumentation must never break the pipeline.
            pass
