from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .routers import topics, landscape, claims, compare, timeline, ingest

DATA_DIR = Path(__file__).parent.parent / "data"

app = FastAPI(title="Narrative Monitoring API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(topics.router, prefix="/api")
app.include_router(landscape.router, prefix="/api")
app.include_router(claims.router, prefix="/api")
app.include_router(compare.router, prefix="/api")
app.include_router(timeline.router, prefix="/api")
app.include_router(ingest.router, prefix="/api")

# Serve the data directory at /data so frontend URL paths are identical
# whether hitting Vite static files or this server.
app.mount("/data", StaticFiles(directory=str(DATA_DIR)), name="data")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
