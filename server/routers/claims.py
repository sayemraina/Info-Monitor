import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

router = APIRouter()
DATA_DIR = Path(__file__).parent.parent.parent / "data"


@router.get("/topics/{topic_id}/claims/{claim_id}")
async def get_claim_detail(topic_id: str, claim_id: str) -> JSONResponse:
    path = DATA_DIR / "metrics" / topic_id / "claims" / f"{claim_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Claim detail not found: {claim_id}")
    return JSONResponse(content=json.loads(path.read_text()))
