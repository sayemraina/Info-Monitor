import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

router = APIRouter()
DATA_DIR = Path(__file__).parent.parent.parent / "data"

VALID_WINDOWS = {"6h", "24h", "7d"}


@router.get("/topics/{topic_id}/timeline/{window}")
async def get_timeline(topic_id: str, window: str) -> JSONResponse:
    if window not in VALID_WINDOWS:
        raise HTTPException(status_code=400, detail=f"Invalid window. Must be one of: {VALID_WINDOWS}")
    path = DATA_DIR / "metrics" / topic_id / f"timeline_{window}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Timeline not found for topic={topic_id} window={window}")
    return JSONResponse(content=json.loads(path.read_text()))
