import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

router = APIRouter()
DATA_DIR = Path(__file__).parent.parent.parent / "data"

VALID_WINDOWS = {"6h", "24h", "7d"}


@router.get("/topics/{topic_id}/compare/{slice_a}/{slice_b}/{window}")
async def get_compare(topic_id: str, slice_a: str, slice_b: str, window: str) -> JSONResponse:
    if window not in VALID_WINDOWS:
        raise HTTPException(status_code=400, detail=f"Invalid window. Must be one of: {VALID_WINDOWS}")
    filename = f"{slice_a}_{slice_b}_{window}.json"
    path = DATA_DIR / "metrics" / topic_id / "compare" / filename
    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Compare data not found: topic={topic_id} slices={slice_a}/{slice_b} window={window}",
        )
    return JSONResponse(content=json.loads(path.read_text()))
