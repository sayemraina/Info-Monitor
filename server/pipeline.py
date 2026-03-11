"""
Background pipeline runner for live topic ingestion.
Runs the 5-step Python pipeline as sequential asyncio subprocesses.
Falls back to generate_synthetic.py if API keys are not detected.
"""

from __future__ import annotations

import asyncio
import json
import os
import uuid
from pathlib import Path
from typing import Dict, List, Literal, Optional, Tuple

DATA_DIR = Path(__file__).parent.parent / "data"
SCRIPTS_DIR = Path(__file__).parent.parent / "scripts"

# In-memory job store — fine for single-user demo
_jobs: Dict[str, dict] = {}

PipelineStatus = Literal["pending", "running", "complete", "failed"]
PipelineStep = Literal["ingest", "extract", "embed", "cluster", "metrics", "done"]

REAL_STEPS: List[Tuple[str, int, List[str]]] = [
    ("ingest",  18, ["python3", str(SCRIPTS_DIR / "ingest.py"),          "--topic", "{topic_id}"]),
    ("extract", 38, ["python3", str(SCRIPTS_DIR / "extract.py"),         "--topic", "{topic_id}"]),
    ("embed",   58, ["python3", str(SCRIPTS_DIR / "embed.py"),           "--topic", "{topic_id}"]),
    ("cluster", 78, ["python3", str(SCRIPTS_DIR / "cluster.py"),         "--topic", "{topic_id}"]),
    ("metrics", 95, ["python3", str(SCRIPTS_DIR / "compute_metrics.py"), "--topic", "{topic_id}"]),
]

SYNTHETIC_STEPS: List[Tuple[str, int, List[str]]] = [
    ("ingest",  18, ["python3", str(SCRIPTS_DIR / "generate_synthetic.py"), "--topic", "{topic_id}"]),
    ("extract", 38, []),   # synthetic does all in one step — skipped
    ("embed",   58, []),
    ("cluster", 78, []),
    ("metrics", 95, []),
]


def _has_api_keys() -> bool:
    """Check if required API keys are present in the environment."""
    env_file = DATA_DIR.parent / ".env"
    if env_file.exists():
        content = env_file.read_text()
        has_anthropic = "ANTHROPIC_API_KEY=" in content and "ANTHROPIC_API_KEY=\n" not in content
        has_openai = "OPENAI_API_KEY=" in content and "OPENAI_API_KEY=\n" not in content
        if has_anthropic and has_openai:
            return True
    return bool(os.getenv("ANTHROPIC_API_KEY") and os.getenv("OPENAI_API_KEY"))


def create_job(topic_id: str) -> str:
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "job_id": job_id,
        "topic_id": topic_id,
        "status": "pending",
        "step": "ingest",
        "progress_pct": 0,
        "error": None,
    }
    return job_id


def get_job(job_id: str) -> Optional[dict]:
    return _jobs.get(job_id)


def _update_job(job_id: str, **kwargs: object) -> None:
    if job_id in _jobs:
        _jobs[job_id].update(kwargs)


async def run_pipeline(job_id: str, topic_id: str, use_synthetic: bool = False) -> None:
    """Run the full pipeline for a topic in the background."""
    _update_job(job_id, status="running", progress_pct=2)

    # Decide real vs synthetic path
    if use_synthetic or not _has_api_keys():
        await _run_synthetic(job_id, topic_id)
    else:
        await _run_real_pipeline(job_id, topic_id)


async def _run_real_pipeline(job_id: str, topic_id: str) -> None:
    for step_name, progress_after, cmd_template in REAL_STEPS:
        _update_job(job_id, step=step_name)
        cmd = [c.replace("{topic_id}", topic_id) for c in cmd_template]
        success = await _exec(job_id, cmd, topic_id)
        if not success:
            return
        _update_job(job_id, progress_pct=progress_after)

    await _finalize(job_id, topic_id)


async def _run_synthetic(job_id: str, topic_id: str) -> None:
    """Run generate_synthetic.py with a single-topic override."""
    _update_job(job_id, step="ingest")

    # Check if generate_synthetic.py supports --topic flag
    gen_script = SCRIPTS_DIR / "generate_synthetic.py"
    cmd = ["python3", str(gen_script), "--topic", topic_id]
    success = await _exec(job_id, cmd, topic_id)
    if not success:
        return

    # Simulate step progression for UX
    for step_name, pct in [("extract", 38), ("embed", 58), ("cluster", 78), ("metrics", 95)]:
        _update_job(job_id, step=step_name, progress_pct=pct)
        await asyncio.sleep(0.3)  # brief pause so UI can show step transitions

    await _finalize(job_id, topic_id)


async def _exec(job_id: str, cmd: List[str], topic_id: str) -> bool:
    """Execute a subprocess command. Returns True on success, False on failure."""
    if not cmd:
        return True

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(DATA_DIR.parent),
        )
        _stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            error_msg = stderr.decode("utf-8", errors="replace")[-1000:]  # last 1000 chars
            _update_job(job_id, status="failed", error=error_msg or f"Step failed with exit code {proc.returncode}")
            return False
        return True
    except Exception as exc:
        _update_job(job_id, status="failed", error=str(exc))
        return False


async def _finalize(job_id: str, topic_id: str) -> None:
    """After all steps complete: update topics.json with the new topic summary."""
    _update_job(job_id, step="done", progress_pct=100)

    # Read the freshly generated landscape to build a TopicSummary
    landscape_path = DATA_DIR / "metrics" / topic_id / "landscape_24h.json"
    topics_path = DATA_DIR / "topics.json"

    if not landscape_path.exists():
        _update_job(job_id, status="failed", error="Pipeline completed but landscape_24h.json not found")
        return

    try:
        landscape = json.loads(landscape_path.read_text())
        topics: list = json.loads(topics_path.read_text()) if topics_path.exists() else []

        # Remove any existing entry for this topic (idempotent re-run)
        topics = [t for t in topics if t.get("id") != topic_id]

        # Build a minimal TopicSummary from landscape data
        topic_metrics = landscape.get("topic_metrics", {})
        top_claim = topic_metrics.get("top_accelerating", {})
        claim_text = ""
        claim_momentum = 0.0
        if top_claim and top_claim.get("claim_id"):
            matching = next(
                (c for c in landscape.get("claims", []) if c["id"] == top_claim["claim_id"]),
                None,
            )
            if matching:
                claim_text = matching.get("text", "")
            m = top_claim.get("momentum", {})
            claim_momentum = m.get("value", 0.0) if isinstance(m, dict) else 0.0

        persistent = topic_metrics.get("most_persistent", {})
        persistent_text = ""
        if persistent and persistent.get("claim_id"):
            matching = next(
                (c for c in landscape.get("claims", []) if c["id"] == persistent["claim_id"]),
                None,
            )
            if matching:
                persistent_text = matching.get("text", "")

        summary = {
            "id": topic_id,
            "name": topic_id.replace("-", " ").title(),
            "cluster_count": topic_metrics.get("cluster_count", len(landscape.get("clusters", []))),
            "contestation_level": topic_metrics.get("contestation_level", "low"),
            "contestation_emergence": None,
            "headline_divergence": {
                "jsd": 0.3,
                "dominant_typology": "Interpretive",
                "trend": "stable",
            },
            "top_accelerating_claim": {
                "text": claim_text,
                "momentum": claim_momentum,
                "source_diversity": 0.5,
            },
            "most_persistent_claim": {
                "text": persistent_text,
                "persistence_windows": persistent.get("persistence_windows", 0),
            },
            "key_signal": None,
            "activity_sparkline": [0.3, 0.4, 0.45, 0.5, 0.52, 0.55, 0.58, 0.6, 0.62, 0.65, 0.67, 0.7],
        }

        topics.append(summary)
        topics_path.write_text(json.dumps(topics, indent=2))
        _update_job(job_id, status="complete")

    except Exception as exc:
        _update_job(job_id, status="failed", error=f"Failed to update topics.json: {exc}")
