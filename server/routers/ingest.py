import json
import re
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, field_validator

from ..pipeline import create_job, get_job, run_pipeline

router = APIRouter()
DATA_DIR = Path(__file__).parent.parent.parent / "data"

SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$")


class IngestRequest(BaseModel):
    topic_id: str
    name: str
    query: str
    use_synthetic: bool = False

    @field_validator("topic_id")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        v = v.strip().lower()
        if not SLUG_RE.match(v):
            raise ValueError("topic_id must be a lowercase slug (letters, digits, hyphens), 3–50 chars")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) > 80:
            raise ValueError("name must be 1–80 characters")
        return v

    @field_validator("query")
    @classmethod
    def validate_query(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) > 200:
            raise ValueError("query must be 1–200 characters")
        return v


def _topic_exists(topic_id: str) -> bool:
    """Check if topic_id already appears in topics.json."""
    path = DATA_DIR / "topics.json"
    if not path.exists():
        return False
    try:
        topics = json.loads(path.read_text())
        return any(t.get("id") == topic_id for t in topics)
    except Exception:
        return False


@router.post("/ingest")
async def start_ingest(body: IngestRequest, background_tasks: BackgroundTasks) -> dict:
    if _topic_exists(body.topic_id):
        raise HTTPException(
            status_code=409,
            detail=f"Topic '{body.topic_id}' already exists. Choose a different topic_id.",
        )

    job_id = create_job(body.topic_id)
    # FastAPI BackgroundTasks natively supports async callables
    background_tasks.add_task(run_pipeline, job_id, body.topic_id, body.use_synthetic)
    return {"job_id": job_id, "topic_id": body.topic_id}


@router.get("/ingest/{job_id}")
async def get_ingest_status(job_id: str) -> dict:
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")
    return job
