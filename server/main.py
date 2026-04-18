import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .routers import topics, landscape, claims, compare, timeline, ingest, timings
from .pipeline import start_scheduler, stop_scheduler, get_schedule_status, update_schedule

DATA_DIR = Path(__file__).parent.parent / "data"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: start scheduler if ENABLE_SCHEDULER=true
    if os.getenv("ENABLE_SCHEDULER", "").lower() in ("true", "1", "yes"):
        interval = int(os.getenv("SCHEDULER_INTERVAL_HOURS", "6"))
        await start_scheduler(interval)
    yield
    # Shutdown: stop scheduler
    await stop_scheduler()


app = FastAPI(title="Narrative Monitoring API", version="1.0.0", lifespan=lifespan)

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
app.include_router(timings.router, prefix="/api")

# Serve the data directory at /data so frontend URL paths are identical
# whether hitting Vite static files or this server.
app.mount("/data", StaticFiles(directory=str(DATA_DIR)), name="data")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/api/schedule")
async def schedule_status() -> dict:
    return get_schedule_status()


@app.put("/api/schedule")
async def schedule_update(interval_hours: int | None = None, enabled: bool | None = None) -> dict:
    return update_schedule(interval_hours=interval_hours, enabled=enabled)
