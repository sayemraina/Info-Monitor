"""
Base ingester protocol — all ingesters must implement this interface.

Two types:
  - DiscourseIngester: outputs normalized documents for claim extraction (RSS, Bluesky, etc.)
  - SignalIngester: outputs structured event signals (GDELT, FRED, prices, etc.)
"""

from __future__ import annotations

import hashlib
import json
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Set


SourceType = Literal[
    "population", "elite_media", "think_tank",
    "government", "prediction_market", "event_signal"
]


class BaseIngester(ABC):
    """Base class for all ingesters."""

    source_name: str = ""           # e.g., "rss", "gdelt", "fred"
    source_type: SourceType = "event_signal"
    is_signal: bool = False         # True = bypass extraction, store as signal

    def __init__(self, data_dir: Path | None = None):
        self.data_dir = data_dir or Path(__file__).parent.parent.parent / "data"

    @abstractmethod
    def ingest(self, topic_id: str, keywords: list[str], **kwargs) -> list[dict]:
        """
        Fetch data for a topic. Returns list of normalized documents or signals.

        For discourse ingesters, each doc has:
            id, source, source_type, platform, content, title, author,
            timestamp, url, engagement, metadata

        For signal ingesters, each signal has:
            id, source, source_type, type, title, summary, timestamp,
            location, severity, value, change, url, topic_relevance, metadata
        """
        ...

    def health_check(self) -> dict[str, Any]:
        """Check if this source is reachable. Returns {ok: bool, message: str}."""
        return {"ok": True, "message": "not implemented"}

    @staticmethod
    def content_hash(text: str) -> str:
        """SHA256 hash for deduplication."""
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    @staticmethod
    def now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    def _load_cache(self, topic_id: str) -> set[str]:
        cache_path = self.data_dir / "raw" / topic_id / f".cache_{self.source_name}.json"
        if cache_path.exists():
            return set(json.loads(cache_path.read_text()))
        return set()

    def _save_cache(self, topic_id: str, hashes: set[str]) -> None:
        cache_path = self.data_dir / "raw" / topic_id / f".cache_{self.source_name}.json"
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(json.dumps(sorted(hashes)))

    def _write_output(self, topic_id: str, docs: list[dict]) -> Path:
        """Write normalized docs to data/raw/{topic_id}/normalized/{source}.json"""
        if self.is_signal:
            out_dir = self.data_dir / "signals"
            out_dir.mkdir(parents=True, exist_ok=True)
            out_path = out_dir / f"{topic_id}.json"
            # Merge with existing signals
            existing = []
            if out_path.exists():
                existing = json.loads(out_path.read_text())
            seen_ids = {s["id"] for s in existing}
            for doc in docs:
                if doc["id"] not in seen_ids:
                    existing.append(doc)
                    seen_ids.add(doc["id"])
            existing.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
            existing = existing[:200]  # cap at 200 per topic
            out_path.write_text(json.dumps(existing, indent=2))
            return out_path
        else:
            out_dir = self.data_dir / "raw" / topic_id / "normalized"
            out_dir.mkdir(parents=True, exist_ok=True)
            out_path = out_dir / f"{self.source_name}.json"
            out_path.write_text(json.dumps(docs, indent=2))
            return out_path

    @staticmethod
    def make_document(
        id: str,
        source: str,
        source_type: SourceType,
        platform: str,
        content: str,
        title: str | None = None,
        author: str = "unknown",
        timestamp: str = "",
        url: str | None = None,
        likes: int = 0,
        replies: int = 0,
        shares: int = 0,
        views: int = 0,
        metadata: dict | None = None,
    ) -> dict:
        """Create a normalized document for the extraction pipeline."""
        return {
            "id": id,
            "source": source,
            "source_type": source_type,
            "platform": platform,
            "content": content,
            "title": title,
            "author": author,
            "timestamp": timestamp or datetime.now(timezone.utc).isoformat(),
            "url": url,
            "engagement": {
                "likes": likes,
                "replies": replies,
                "shares": shares,
                "views": views,
            },
            "metadata": metadata or {},
        }

    @staticmethod
    def make_signal(
        id: str,
        source: str,
        source_type: SourceType,
        signal_type: str,
        title: str,
        summary: str,
        timestamp: str = "",
        location: dict | None = None,
        severity: str | None = None,
        value: float | None = None,
        change: float | None = None,
        url: str | None = None,
        topic_relevance: list[str] | None = None,
        metadata: dict | None = None,
    ) -> dict:
        """Create a structured event signal."""
        sig: dict[str, Any] = {
            "id": id,
            "source": source,
            "source_type": source_type,
            "type": signal_type,
            "title": title,
            "summary": summary,
            "timestamp": timestamp or datetime.now(timezone.utc).isoformat(),
            "topic_relevance": topic_relevance or [],
            "metadata": metadata or {},
        }
        if location:
            sig["location"] = location
        if severity:
            sig["severity"] = severity
        if value is not None:
            sig["value"] = value
        if change is not None:
            sig["change"] = change
        if url:
            sig["url"] = url
        return sig
