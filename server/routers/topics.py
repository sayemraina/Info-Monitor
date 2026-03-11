import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter()
DATA_DIR = Path(__file__).parent.parent.parent / "data"


@router.get("/topics")
async def get_topics() -> list:
    path = DATA_DIR / "topics.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="topics.json not found")
    return json.loads(path.read_text())
