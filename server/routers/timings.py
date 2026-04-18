"""
Read-only endpoints for pipeline timing data.

Backed by the JSONL log at data/.timings/runs.jsonl (written by server/timing.py).
"""

from __future__ import annotations

import json
from pathlib import Path
from statistics import mean, median
from typing import List

from fastapi import APIRouter

router = APIRouter()

RUNS_LOG = Path(__file__).parent.parent.parent / "data" / ".timings" / "runs.jsonl"


def _load_rows() -> List[dict]:
    if not RUNS_LOG.exists():
        return []
    rows: List[dict] = []
    for line in RUNS_LOG.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows


@router.get("/timings/recent")
async def recent(limit: int = 200) -> dict:
    """Return the most recent N timing rows (default 200, newest last)."""
    rows = _load_rows()
    return {"runs": rows[-limit:]}


@router.get("/timings/summary")
async def summary() -> dict:
    """Return p50/p95/mean/max per pipeline step across all logged runs."""
    rows = _load_rows()

    by_step: dict = {}
    for row in rows:
        if row.get("event") != "pipeline_step":
            continue
        step = row.get("step", "unknown")
        by_step.setdefault(step, []).append(row.get("duration_s", 0.0))

    out: dict = {}
    for step, durations in by_step.items():
        sd = sorted(durations)
        n = len(sd)
        out[step] = {
            "n": n,
            "mean": round(mean(sd), 2),
            "p50": round(median(sd), 2),
            "p95": round(sd[min(int(n * 0.95), n - 1)], 2),
            "max": round(max(sd), 2),
        }

    # Also surface end-to-end runs
    runs = [r for r in rows if r.get("event") == "pipeline_run"]
    run_stats: dict = {}
    if runs:
        durations = [r.get("duration_s", 0.0) for r in runs]
        sd = sorted(durations)
        n = len(sd)
        run_stats = {
            "n": n,
            "mean": round(mean(sd), 2),
            "p50": round(median(sd), 2),
            "p95": round(sd[min(int(n * 0.95), n - 1)], 2),
            "max": round(max(sd), 2),
        }

    return {"steps": out, "pipeline_run": run_stats}
