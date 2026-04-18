"""
YouTube discourse ingester.
Pulls video titles + descriptions as documents for claim extraction.
Uses the 4-layer search from youtube_discover methodology (event/analysis/counter/viral).
Distinct from youtube_discover.py (Narrative Shapers) — this feeds the claim pipeline.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List
from urllib.request import urlopen, Request
from urllib.parse import urlencode
from urllib.error import HTTPError

from . import register
from .base import BaseIngester

SCRIPTS_DIR = Path(__file__).parent.parent
TOPIC_KEYWORDS = json.loads((SCRIPTS_DIR / "topic_keywords.json").read_text())

API_BASE = "https://www.googleapis.com/youtube/v3"


def _yt_get(endpoint: str, params: Dict[str, str], api_key: str) -> Dict[str, Any]:
    params["key"] = api_key
    url = f"{API_BASE}/{endpoint}?{urlencode(params)}"
    req = Request(url, headers={"Accept": "application/json"})
    try:
        with urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except HTTPError as e:
        body = e.read().decode() if e.fp else ""
        raise RuntimeError(f"YouTube API {e.code}: {body[:200]}") from e


def _search(query: str, api_key: str, max_results: int = 25,
             days: int = 90, order: str = "relevance") -> List[Dict[str, Any]]:
    after = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT00:00:00Z")
    data = _yt_get("search", {
        "part": "snippet",
        "q": query,
        "type": "video",
        "order": order,
        "maxResults": str(max_results),
        "publishedAfter": after,
        "relevanceLanguage": "en",
    }, api_key)
    return data.get("items", [])


def _get_video_details(video_ids: List[str], api_key: str) -> Dict[str, Dict[str, Any]]:
    result = {}
    for i in range(0, len(video_ids), 50):
        batch = video_ids[i:i + 50]
        data = _yt_get("videos", {
            "part": "snippet,statistics",
            "id": ",".join(batch),
        }, api_key)
        for item in data.get("items", []):
            result[item["id"]] = item
    return result


@register
class YouTubeIngester(BaseIngester):
    source_name = "youtube"
    source_type = "elite_media"
    is_signal = False

    def ingest(self, topic_id: str, keywords: List[str], **kwargs) -> list:
        api_key = os.environ.get("YOUTUBE_API_KEY", "")
        if not api_key:
            print("    YOUTUBE_API_KEY not set — skipping YouTube ingestion")
            return []

        config = TOPIC_KEYWORDS.get(topic_id, {})
        youtube_queries = config.get("youtube_queries", [keywords[0]] if keywords else [topic_id])
        counter_queries = config.get("counter_queries", [])

        # 4-layer search: event(date), analysis(relevance), counter, viral(viewCount)
        seen_ids: set = set()
        all_items: List[Dict[str, Any]] = []

        def collect(items, origin):
            for item in items:
                vid_id = item.get("id", {}).get("videoId", "")
                if vid_id and vid_id not in seen_ids:
                    seen_ids.add(vid_id)
                    all_items.append({"item": item, "search_origin": origin})

        try:
            # Search 1: event-driven (newest)
            collect(_search(youtube_queries[0], api_key, max_results=20, days=30, order="date"), "event")
        except Exception as e:
            print(f"    YouTube event search failed: {e}")

        try:
            # Search 2: analysis/commentary
            analysis_q = f"{youtube_queries[0]} analysis OR explained OR opinion"
            collect(_search(analysis_q, api_key, max_results=20, days=90), "analysis")
        except Exception as e:
            print(f"    YouTube analysis search failed: {e}")

        try:
            # Search 3: counter-narrative
            if counter_queries:
                counter_q = " OR ".join(f'"{q}"' for q in counter_queries[:2])
                collect(_search(counter_q, api_key, max_results=20, days=90), "counter")
        except Exception as e:
            print(f"    YouTube counter search failed: {e}")

        try:
            # Search 4: viral (by view count)
            viral_q = " ".join(youtube_queries[:2])
            collect(_search(viral_q, api_key, max_results=20, days=365, order="viewCount"), "viral")
        except Exception as e:
            print(f"    YouTube viral search failed: {e}")

        if not all_items:
            return []

        # Enrich with full video details
        video_ids = [c["item"]["id"]["videoId"] for c in all_items]
        try:
            details = _get_video_details(video_ids, api_key)
        except Exception as e:
            print(f"    YouTube video details fetch failed: {e}")
            details = {}

        seen_hashes = self._load_cache(topic_id)
        new_hashes: set = set()
        documents = []
        for candidate in all_items:
            vid_id = candidate["item"]["id"]["videoId"]
            vdata = details.get(vid_id)
            if not vdata:
                continue

            snippet = vdata.get("snippet", {})
            stats = vdata.get("statistics", {})
            title = snippet.get("title", "")
            description = (snippet.get("description", "") or "")[:1000]
            channel_name = snippet.get("channelTitle", "")
            published_at = snippet.get("publishedAt", "")
            view_count = int(stats.get("viewCount", 0))
            comment_count = int(stats.get("commentCount", 0))

            # Skip very low engagement — noise
            if view_count < 1000:
                continue

            # Combine title + description as the claim-extractable text
            text = f"{title}\n\n{description}".strip()
            if len(text) < 20:
                continue

            h = self.content_hash(text)
            if h in seen_hashes:
                continue

            url = f"https://www.youtube.com/watch?v={vid_id}"
            doc = self.make_document(
                id=f"yt_{vid_id}",
                content=text,
                title=title,
                url=url,
                source=self.source_name,
                source_type=self.source_type,
                platform="youtube",
                author=channel_name,
                timestamp=published_at,
                views=view_count,
                replies=comment_count,
                metadata={
                    "video_id": vid_id,
                    "search_origin": candidate["search_origin"],
                    "platform_label": "YouTube (influencer framing)",
                },
            )
            new_hashes.add(h)
            documents.append(doc)

        self._save_cache(topic_id, seen_hashes | new_hashes)
        print(f"    YouTube: {len(documents)} new videos ({len(all_items)} candidates fetched)")
        return documents

    def health_check(self) -> dict:
        api_key = os.environ.get("YOUTUBE_API_KEY", "")
        if not api_key:
            return {"ok": False, "message": "YOUTUBE_API_KEY not set"}
        try:
            data = _yt_get("search", {
                "part": "snippet", "q": "test", "type": "video",
                "maxResults": "1",
            }, api_key)
            ok = "items" in data
            return {"ok": ok, "message": "YouTube API reachable" if ok else "Unexpected response"}
        except Exception as e:
            return {"ok": False, "message": str(e)}
