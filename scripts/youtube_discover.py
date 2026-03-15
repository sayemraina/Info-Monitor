#!/usr/bin/env python3
"""
YouTube Discovery Script for Narrative Monitoring System.

Discovers relevant YouTube videos for a topic using YouTube Data API v3.
Applies a 3-tier scoring system (institutional, commentator, contrarian)
to surface the voices most likely to shape narrative.

Requires YOUTUBE_API_KEY environment variable.
Without it, logs a warning and exits cleanly (existing static files remain).

Usage:
    python scripts/youtube_discover.py --topic ai-regulation
    python scripts/youtube_discover.py --topic ai-regulation --query "AI regulation policy" --count 5

Output:
    data/youtube/{topic_id}.json          — VideoMetadata[] for frontend
    data/youtube/{topic_id}_scored.json   — Extended data with scoring breakdown
"""

import argparse
import json
import logging
import math
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.request import urlopen, Request
from urllib.parse import urlencode
from urllib.error import HTTPError

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
YOUTUBE_DIR = DATA_DIR / "youtube"

API_BASE = "https://www.googleapis.com/youtube/v3"

# Scoring weights
W_AUTHORITY = 0.30
W_RECENCY = 0.25
W_VELOCITY = 0.25
W_ENGAGEMENT = 0.10
W_RELEVANCE = 0.10

# Recency half-life in days
RECENCY_HALF_LIFE = 30

# Tier thresholds (subscriber count)
TIER1_THRESHOLD = 1_000_000  # Institutional: >1M subs
TIER2_THRESHOLD = 100_000    # Commentator: 100K-1M subs
# Tier 3: <100K subs (contrarian / alternative)

# Authority normalization ceiling (log scale)
MAX_LOG_SUBS = math.log10(50_000_000)  # ~50M subs = 1.0 authority score


def youtube_api_get(endpoint: str, params: Dict[str, str], api_key: str) -> Dict[str, Any]:
    """Make a GET request to YouTube Data API v3."""
    params["key"] = api_key
    url = f"{API_BASE}/{endpoint}?{urlencode(params)}"
    req = Request(url, headers={"Accept": "application/json"})
    try:
        with urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except HTTPError as e:
        body = e.read().decode() if e.fp else ""
        logger.error("YouTube API error %d: %s", e.code, body[:300])
        raise


def search_videos(query: str, api_key: str, max_results: int = 25,
                   published_after_days: int = 90) -> List[Dict[str, Any]]:
    """Search YouTube for videos matching query."""
    after = (datetime.now(timezone.utc) - timedelta(days=published_after_days)).strftime("%Y-%m-%dT00:00:00Z")
    params = {
        "part": "snippet",
        "q": query,
        "type": "video",
        "order": "relevance",
        "maxResults": str(max_results),
        "publishedAfter": after,
        "relevanceLanguage": "en",
    }
    data = youtube_api_get("search", params, api_key)
    return data.get("items", [])


def get_video_stats(video_ids: List[str], api_key: str) -> Dict[str, Dict[str, Any]]:
    """Fetch statistics + snippet for a batch of video IDs."""
    result = {}
    # API allows up to 50 IDs per call
    for i in range(0, len(video_ids), 50):
        batch = video_ids[i:i + 50]
        params = {
            "part": "snippet,statistics",
            "id": ",".join(batch),
        }
        data = youtube_api_get("videos", params, api_key)
        for item in data.get("items", []):
            result[item["id"]] = item
    return result


def get_channel_stats(channel_ids: List[str], api_key: str) -> Dict[str, Dict[str, Any]]:
    """Fetch statistics for a batch of channel IDs."""
    result = {}
    for i in range(0, len(channel_ids), 50):
        batch = channel_ids[i:i + 50]
        params = {
            "part": "statistics",
            "id": ",".join(batch),
        }
        data = youtube_api_get("channels", params, api_key)
        for item in data.get("items", []):
            result[item["id"]] = item
    return result


def classify_tier(subscriber_count: int) -> int:
    """Classify channel into tier based on subscriber count."""
    if subscriber_count >= TIER1_THRESHOLD:
        return 1
    if subscriber_count >= TIER2_THRESHOLD:
        return 2
    return 3


def score_authority(subscriber_count: int) -> float:
    """Log-scaled subscriber count, normalized 0-1."""
    if subscriber_count <= 0:
        return 0.0
    return min(math.log10(max(subscriber_count, 1)) / MAX_LOG_SUBS, 1.0)


def score_recency(published_at: str) -> float:
    """Exponential decay with configurable half-life."""
    try:
        pub_dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return 0.0
    age_days = (datetime.now(timezone.utc) - pub_dt).total_seconds() / 86400
    if age_days < 0:
        return 1.0
    return math.exp(-math.log(2) * age_days / RECENCY_HALF_LIFE)


def score_velocity(view_count: int, published_at: str) -> float:
    """Views per hour, log-scaled and normalized."""
    try:
        pub_dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return 0.0
    age_hours = max((datetime.now(timezone.utc) - pub_dt).total_seconds() / 3600, 1)
    vph = view_count / age_hours
    # Log-scale: 1 view/hr = 0, 10K views/hr ≈ 1.0
    if vph <= 0:
        return 0.0
    return min(math.log10(max(vph, 1)) / 4.0, 1.0)


def score_engagement(like_count: int, comment_count: int, view_count: int) -> float:
    """Engagement ratio: (likes + comments) / views."""
    if view_count <= 0:
        return 0.0
    ratio = (like_count + comment_count) / view_count
    # Typical good engagement is 3-5%, cap at 10%
    return min(ratio / 0.10, 1.0)


def score_relevance(query_terms: List[str], title: str, description: str) -> float:
    """Keyword overlap between topic query and video title+description."""
    text = (title + " " + description).lower()
    if not query_terms:
        return 0.5
    matches = sum(1 for term in query_terms if term.lower() in text)
    return min(matches / len(query_terms), 1.0)


def compute_composite_score(scores: Dict[str, float]) -> float:
    """Weighted composite score."""
    return (
        W_AUTHORITY * scores["authority"]
        + W_RECENCY * scores["recency"]
        + W_VELOCITY * scores["velocity"]
        + W_ENGAGEMENT * scores["engagement"]
        + W_RELEVANCE * scores["relevance"]
    )


def diversify_selection(scored_videos: List[Dict[str, Any]], count: int) -> List[Dict[str, Any]]:
    """Select top videos ensuring tier diversity."""
    sorted_vids = sorted(scored_videos, key=lambda v: v["composite_score"], reverse=True)

    # Group by tier
    by_tier: Dict[int, List[Dict[str, Any]]] = {1: [], 2: [], 3: []}
    for v in sorted_vids:
        by_tier[v["tier"]].append(v)

    selected: List[Dict[str, Any]] = []
    seen_ids = set()

    # First pass: pick top-1 from each available tier
    for tier in [1, 2, 3]:
        if by_tier[tier] and len(selected) < count:
            pick = by_tier[tier][0]
            selected.append(pick)
            seen_ids.add(pick["video_id"])

    # Second pass: fill remaining slots by composite score
    for v in sorted_vids:
        if len(selected) >= count:
            break
        if v["video_id"] not in seen_ids:
            selected.append(v)
            seen_ids.add(v["video_id"])

    # Sort final selection by composite score descending
    selected.sort(key=lambda v: v["composite_score"], reverse=True)
    return selected


def discover_videos(topic_id: str, query: Optional[str], count: int, api_key: str) -> List[Dict[str, Any]]:
    """Main discovery pipeline: search → enrich → score → diversify → select."""
    if query is None:
        query = topic_id.replace("-", " ")

    query_terms = query.lower().split()
    logger.info("Searching YouTube for: %s", query)

    # Step 1: Search
    search_results = search_videos(query, api_key)
    if not search_results:
        logger.warning("No search results for: %s", query)
        return []

    video_ids = [item["id"]["videoId"] for item in search_results]
    logger.info("Found %d candidates", len(video_ids))

    # Step 2: Enrich with video stats
    video_stats = get_video_stats(video_ids, api_key)

    # Step 3: Enrich with channel stats
    channel_ids = list({
        v["snippet"]["channelId"]
        for v in video_stats.values()
    })
    channel_stats = get_channel_stats(channel_ids, api_key)

    # Step 4: Score each video
    scored: List[Dict[str, Any]] = []
    for vid_id, vdata in video_stats.items():
        snippet = vdata.get("snippet", {})
        stats = vdata.get("statistics", {})
        channel_id = snippet.get("channelId", "")
        ch_stats = channel_stats.get(channel_id, {}).get("statistics", {})

        view_count = int(stats.get("viewCount", 0))
        like_count = int(stats.get("likeCount", 0))
        comment_count = int(stats.get("commentCount", 0))
        subscriber_count = int(ch_stats.get("subscriberCount", 0))
        published_at = snippet.get("publishedAt", "")

        scores = {
            "authority": score_authority(subscriber_count),
            "recency": score_recency(published_at),
            "velocity": score_velocity(view_count, published_at),
            "engagement": score_engagement(like_count, comment_count, view_count),
            "relevance": score_relevance(query_terms, snippet.get("title", ""), snippet.get("description", "")),
        }

        scored.append({
            "video_id": vid_id,
            "title": snippet.get("title", ""),
            "channel_name": snippet.get("channelTitle", ""),
            "view_count": view_count,
            "published_at": published_at,
            "channel_subscribers": subscriber_count,
            "like_count": like_count,
            "comment_count": comment_count,
            "tier": classify_tier(subscriber_count),
            "composite_score": compute_composite_score(scores),
            "score_breakdown": scores,
        })

    logger.info("Scored %d videos", len(scored))

    # Step 5: Diversify and select
    selected = diversify_selection(scored, count)
    logger.info("Selected %d videos (tiers: %s)", len(selected),
                [v["tier"] for v in selected])
    return selected


def write_outputs(topic_id: str, selected: List[Dict[str, Any]]) -> None:
    """Write frontend-compatible and scored JSON files."""
    YOUTUBE_DIR.mkdir(parents=True, exist_ok=True)

    # Frontend format: VideoMetadata[] (no scoring data)
    frontend_data = [
        {
            "video_id": v["video_id"],
            "title": v["title"],
            "channel_name": v["channel_name"],
            "view_count": v["view_count"],
            "published_at": v["published_at"],
        }
        for v in selected
    ]

    frontend_path = YOUTUBE_DIR / f"{topic_id}.json"
    frontend_path.write_text(json.dumps(frontend_data, indent=2))
    logger.info("Wrote %s (%d videos)", frontend_path, len(frontend_data))

    # Scored format: full data with scoring breakdown (for debugging/transparency)
    scored_path = YOUTUBE_DIR / f"{topic_id}_scored.json"
    scored_path.write_text(json.dumps(selected, indent=2))
    logger.info("Wrote %s", scored_path)


def main():
    parser = argparse.ArgumentParser(description="Discover YouTube videos for a topic")
    parser.add_argument("--topic", required=True, help="Topic ID (e.g., ai-regulation)")
    parser.add_argument("--query", default=None, help="Custom search query (default: derived from topic ID)")
    parser.add_argument("--count", type=int, default=5, help="Number of videos to select (default: 5)")
    args = parser.parse_args()

    api_key = os.environ.get("YOUTUBE_API_KEY")
    if not api_key:
        logger.warning("YOUTUBE_API_KEY not set. Skipping YouTube discovery. Existing static files remain.")
        sys.exit(0)

    selected = discover_videos(args.topic, args.query, args.count, api_key)
    if selected:
        write_outputs(args.topic, selected)
    else:
        logger.warning("No videos discovered for topic '%s'. Existing file (if any) unchanged.", args.topic)


if __name__ == "__main__":
    main()
