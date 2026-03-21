#!/usr/bin/env python3
"""
YouTube Discovery Script for Narrative Monitoring System.

Uses a two-stage Narrative Framing Score (NFS) to surface the YouTube voices
most likely to shape public narrative on a given topic.

Stage 1 — Reach Gate:
    Videos with fewer than 100K views are eliminated. If fewer than 100K people
    saw it, it's not shaping public narrative.

Stage 2 — 6-Signal Weighted Score:
    Audience Impact (0.52):
        View Velocity (0.30) — log-scaled views/hour. How fast is this spreading?
        Reach (0.22)         — log-scaled total views. Raw audience size.
    Framing Quality (0.40):
        Framing Language (0.18) — title keyword patterns across 6 framing categories.
        Debate Provocation (0.12) — comment/view ratio vs batch average.
        Topic Authority (0.10) — channel's coverage of THIS topic (stub: name overlap).
    Recency (0.08):
        14-day half-life exponential decay. Recent videos get a slight edge.

Post-scoring:
    Channel dedup (max 1 video per channel).
    Tier diversification: 1 institutional, 2 commentator, 1 contrarian.

Requires YOUTUBE_API_KEY environment variable.
Without it, logs a warning and exits cleanly (existing static files remain).

Usage:
    python scripts/youtube_discover.py --topic ai-regulation
    python scripts/youtube_discover.py --topic ai-regulation --query "AI regulation policy" --count 5

Output:
    data/youtube/{topic_id}.json          — VideoMetadata[] for frontend
    data/youtube/{topic_id}_scored.json   — Extended data with NFS breakdown
"""

import argparse
import json
import logging
import math
import os
import re
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

# ---------------------------------------------------------------------------
# NFS Weights
# ---------------------------------------------------------------------------
W_VV = 0.30   # View Velocity (audience impact)
W_RE = 0.22   # Reach (audience impact)
W_FLS = 0.18  # Framing Language Score (framing quality)
W_DP = 0.12   # Debate Provocation (framing quality)
W_TA = 0.10   # Topic Authority (framing quality)
W_R = 0.08    # Recency (tiebreaker)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MIN_VIEWS_GATE = 100_000          # Stage 1 hard cutoff
RECENCY_HALF_LIFE = 14            # days
MAX_LOG_VIEWS = 7.3               # log10(20M) ≈ 7.3 → 1.0 reach score
MAX_LOG_VPH = 4.0                 # log10(10K views/hr) → 1.0 velocity score

# Tier thresholds (subscriber count)
TIER1_THRESHOLD = 1_000_000       # Institutional: >1M subs
TIER2_THRESHOLD = 100_000         # Commentator: 100K-1M subs
# Tier 3: <100K subs (contrarian / alternative)

# ---------------------------------------------------------------------------
# Topic → Search Query mapping (for --refresh-all batch mode)
# ---------------------------------------------------------------------------
TOPIC_QUERIES = {
    "ai-and-your-job": "AI replacing jobs automation workplace layoffs",
    "war-on-iran": "Iran war US military bombing strikes",
    "ozempic-glp1": "Ozempic weight loss GLP-1 drug revolution",
    "israel-palestine": "Israel Palestine Gaza war conflict",
    "housing-crisis": "housing crisis rent affordability homelessness",
    "crypto-digital-money": "Bitcoin cryptocurrency future digital money",
    "immigration": "immigration border policy deportation debate",
    "ai-bubble": "AI bubble stock market overhyped bust",
    "inflation-cost-of-living": "inflation cost of living grocery prices economy",
    "dei-rollbacks": "DEI rollback corporate government diversity cuts",
}

STALENESS_HOURS = 24  # Skip refresh if file is newer than this

# Framing language categories
FRAMING_CATEGORIES = {
    "judgment": [
        "truth", "lie", "wrong", "right", "must", "should", "need to",
        "dangerous", "threat", "risk", "crisis", "shocking", "outrageous",
        "unacceptable",
    ],
    "revelation": [
        "reveal", "expose", "hidden", "secret", "what they don't",
        "nobody talks", "real reason", "actually means", "wake up",
    ],
    "urgency": [
        "breaking", "urgent", "now", "just in", "happening",
        "emergency", "live", "alert",
    ],
    "conflict": [
        "vs", "versus", "fight", "war", "battle", "attack", "destroy",
        "clash", "slam", "blast", "wreck", "demolish", "obliterate",
    ],
    "consequence": [
        "end of", "death of", "collapse", "doom", "catastrophe",
        "never be the same", "change everything", "game over",
    ],
    "imperative": [
        "watch this", "you need to", "stop everything", "listen",
        "pay attention", "don't ignore",
    ],
}

NEUTRAL_MARKERS = [
    "explained", "overview", "introduction", "what is", "how does",
    "guide to", "101", "a]", "primer", "basics",
]


# ---------------------------------------------------------------------------
# YouTube API helpers (unchanged)
# ---------------------------------------------------------------------------

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


def search_videos(query: str, api_key: str, max_results: int = 50,
                   published_after_days: int = 180) -> List[Dict[str, Any]]:
    """Search YouTube for videos matching query. Wider net (180 days, 50 results)."""
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


# ---------------------------------------------------------------------------
# NFS Scoring Functions
# ---------------------------------------------------------------------------

def classify_tier(subscriber_count: int) -> int:
    """Classify channel into tier based on subscriber count."""
    if subscriber_count >= TIER1_THRESHOLD:
        return 1  # Institutional
    if subscriber_count >= TIER2_THRESHOLD:
        return 2  # Commentator
    return 3      # Contrarian


def score_view_velocity(view_count: int, published_at: str) -> float:
    """Log-scaled views per hour. 10K views/hr = 1.0."""
    try:
        pub_dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return 0.0
    age_hours = max((datetime.now(timezone.utc) - pub_dt).total_seconds() / 3600, 1)
    vph = view_count / age_hours
    if vph <= 0:
        return 0.0
    return min(math.log10(max(vph, 1)) / MAX_LOG_VPH, 1.0)


def score_reach(view_count: int) -> float:
    """Log-scaled total views. 20M views = 1.0."""
    if view_count <= 0:
        return 0.0
    return min(math.log10(max(view_count, 1)) / MAX_LOG_VIEWS, 1.0)


def score_framing_language(title: str) -> float:
    """Detect framing patterns in video title across 6 categories."""
    title_lower = title.lower()
    categories_matched = 0

    for _category, keywords in FRAMING_CATEGORIES.items():
        if any(kw in title_lower for kw in keywords):
            categories_matched += 1

    raw = categories_matched / len(FRAMING_CATEGORIES)

    # Neutral title penalty — explainer-style titles get 0.3x
    if any(marker in title_lower for marker in NEUTRAL_MARKERS):
        raw *= 0.3

    return min(raw, 1.0)


def score_debate_provocation(comment_count: int, view_count: int,
                              batch_avg_ratio: float) -> float:
    """Comment/view ratio relative to batch average. 3x average = 1.0."""
    if view_count <= 0 or batch_avg_ratio <= 0:
        return 0.0
    ratio = comment_count / view_count
    return min(ratio / (batch_avg_ratio * 3), 1.0)


def score_topic_authority(channel_name: str, query_terms: List[str]) -> float:
    """
    Stub: keyword overlap between topic query and channel name.
    In production, this would check the channel's recent upload history
    for topic-related videos.
    """
    if not query_terms:
        return 0.0
    name_lower = channel_name.lower()
    matches = sum(1 for term in query_terms if term.lower() in name_lower)
    return min(matches / max(len(query_terms), 1), 1.0)


def score_recency(published_at: str) -> float:
    """Exponential decay with 14-day half-life."""
    try:
        pub_dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return 0.0
    age_days = (datetime.now(timezone.utc) - pub_dt).total_seconds() / 86400
    if age_days < 0:
        return 1.0
    return math.exp(-math.log(2) * age_days / RECENCY_HALF_LIFE)


def compute_nfs(scores: Dict[str, float]) -> float:
    """Compute Narrative Framing Score from 6 signal scores."""
    return (
        W_VV * scores["view_velocity"]
        + W_RE * scores["reach"]
        + W_FLS * scores["framing_language"]
        + W_DP * scores["debate_provocation"]
        + W_TA * scores["topic_authority"]
        + W_R * scores["recency"]
    )


# ---------------------------------------------------------------------------
# Diversification
# ---------------------------------------------------------------------------

def diversify_selection(scored_videos: List[Dict[str, Any]], count: int) -> List[Dict[str, Any]]:
    """
    Select top videos ensuring:
    - Max 1 video per channel (channel dedup)
    - At least 1 institutional (tier 1) if available
    - At least 1 contrarian (tier 3) if available
    - Fill remaining slots by NFS score
    """
    # Channel dedup: keep highest NFS per channel
    best_per_channel: Dict[str, Dict[str, Any]] = {}
    for v in scored_videos:
        ch = v.get("channel_id", v["channel_name"])
        if ch not in best_per_channel or v["nfs"] > best_per_channel[ch]["nfs"]:
            best_per_channel[ch] = v
    deduped = sorted(best_per_channel.values(), key=lambda v: v["nfs"], reverse=True)

    # Group by tier
    by_tier: Dict[int, List[Dict[str, Any]]] = {1: [], 2: [], 3: []}
    for v in deduped:
        by_tier[v["tier"]].append(v)

    selected: List[Dict[str, Any]] = []
    seen_channels: set = set()

    def pick(video: Dict[str, Any]) -> bool:
        ch = video.get("channel_id", video["channel_name"])
        if ch in seen_channels:
            return False
        selected.append(video)
        seen_channels.add(ch)
        return True

    # Guarantee slots: 1 institutional, 1 contrarian (if available)
    if by_tier[1]:
        pick(by_tier[1][0])
    if by_tier[3] and len(selected) < count:
        pick(by_tier[3][0])

    # Fill remaining by NFS score
    for v in deduped:
        if len(selected) >= count:
            break
        ch = v.get("channel_id", v["channel_name"])
        if ch not in seen_channels:
            pick(v)

    # Sort final selection by NFS descending
    selected.sort(key=lambda v: v["nfs"], reverse=True)
    return selected


# ---------------------------------------------------------------------------
# Main Pipeline
# ---------------------------------------------------------------------------

def discover_videos(topic_id: str, query: Optional[str], count: int, api_key: str) -> List[Dict[str, Any]]:
    """
    NFS discovery pipeline:
    search → enrich → reach gate → batch stats → score → dedup → diversify → select
    """
    if query is None:
        query = topic_id.replace("-", " ")

    query_terms = query.lower().split()
    logger.info("Searching YouTube for: %s", query)

    # Step 1: Search (wider net — 50 results, 180 days)
    search_results = search_videos(query, api_key)
    if not search_results:
        logger.warning("No search results for: %s", query)
        return []

    video_ids = [item["id"]["videoId"] for item in search_results]
    logger.info("Found %d candidates", len(video_ids))

    # Step 2: Enrich with video stats
    video_stats = get_video_stats(video_ids, api_key)

    # Step 3: Reach gate — eliminate < 100K views
    gated: Dict[str, Dict[str, Any]] = {}
    for vid_id, vdata in video_stats.items():
        view_count = int(vdata.get("statistics", {}).get("viewCount", 0))
        if view_count >= MIN_VIEWS_GATE:
            gated[vid_id] = vdata

    logger.info("After reach gate (>=%dk views): %d / %d",
                MIN_VIEWS_GATE // 1000, len(gated), len(video_stats))

    if not gated:
        logger.warning("No videos passed the %dk reach gate for: %s",
                       MIN_VIEWS_GATE // 1000, query)
        return []

    # Step 4: Enrich with channel stats
    channel_ids = list({
        v["snippet"]["channelId"]
        for v in gated.values()
    })
    channel_stats = get_channel_stats(channel_ids, api_key)

    # Step 5: Compute batch average comment/view ratio for DP scoring
    total_ratio = 0.0
    ratio_count = 0
    for vdata in gated.values():
        stats = vdata.get("statistics", {})
        vc = int(stats.get("viewCount", 0))
        cc = int(stats.get("commentCount", 0))
        if vc > 0:
            total_ratio += cc / vc
            ratio_count += 1
    batch_avg_ratio = total_ratio / max(ratio_count, 1)

    # Step 6: Score each video with NFS
    scored: List[Dict[str, Any]] = []
    for vid_id, vdata in gated.items():
        snippet = vdata.get("snippet", {})
        stats = vdata.get("statistics", {})
        channel_id = snippet.get("channelId", "")
        ch_stats = channel_stats.get(channel_id, {}).get("statistics", {})

        view_count = int(stats.get("viewCount", 0))
        like_count = int(stats.get("likeCount", 0))
        comment_count = int(stats.get("commentCount", 0))
        subscriber_count = int(ch_stats.get("subscriberCount", 0))
        published_at = snippet.get("publishedAt", "")
        title = snippet.get("title", "")
        channel_name = snippet.get("channelTitle", "")

        scores = {
            "view_velocity": score_view_velocity(view_count, published_at),
            "reach": score_reach(view_count),
            "framing_language": score_framing_language(title),
            "debate_provocation": score_debate_provocation(
                comment_count, view_count, batch_avg_ratio
            ),
            "topic_authority": score_topic_authority(channel_name, query_terms),
            "recency": score_recency(published_at),
        }

        nfs = compute_nfs(scores)

        scored.append({
            "video_id": vid_id,
            "title": title,
            "channel_name": channel_name,
            "channel_id": channel_id,
            "view_count": view_count,
            "published_at": published_at,
            "channel_subscribers": subscriber_count,
            "like_count": like_count,
            "comment_count": comment_count,
            "tier": classify_tier(subscriber_count),
            "nfs": round(nfs, 4),
            "nfs_breakdown": {k: round(v, 4) for k, v in scores.items()},
        })

    logger.info("Scored %d videos (batch avg comment/view ratio: %.5f)",
                len(scored), batch_avg_ratio)

    # Step 7: Diversify and select
    selected = diversify_selection(scored, count)
    logger.info("Selected %d videos (tiers: %s)",
                len(selected), [v["tier"] for v in selected])
    return selected


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

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

    # Scored format: full data with NFS breakdown (for debugging/transparency)
    scored_path = YOUTUBE_DIR / f"{topic_id}_scored.json"
    scored_path.write_text(json.dumps(selected, indent=2))
    logger.info("Wrote %s", scored_path)


# ---------------------------------------------------------------------------
# Staleness Check
# ---------------------------------------------------------------------------

def is_stale(topic_id: str, max_age_hours: int = STALENESS_HOURS) -> bool:
    """Check if YouTube data for topic is older than max_age_hours (or missing)."""
    path = YOUTUBE_DIR / f"{topic_id}.json"
    if not path.exists():
        return True
    mtime = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
    age = datetime.now(timezone.utc) - mtime
    return age.total_seconds() > max_age_hours * 3600


# ---------------------------------------------------------------------------
# Batch Refresh
# ---------------------------------------------------------------------------

def refresh_all(count: int, api_key: str, force: bool = False) -> None:
    """
    Refresh YouTube data for all topics in TOPIC_QUERIES.

    - Checks staleness: skips topics with fresh data (< STALENESS_HOURS old)
    - Error resilience: logs and continues if one topic fails
    - Fallback: existing files remain untouched on failure
    """
    topics = list(TOPIC_QUERIES.keys())
    logger.info("Batch refresh: %d topics", len(topics))

    refreshed = 0
    skipped = 0
    failed = 0

    for topic_id in topics:
        if not force and not is_stale(topic_id):
            logger.info("SKIP %s — data is fresh (< %dh old)", topic_id, STALENESS_HOURS)
            skipped += 1
            continue

        query = TOPIC_QUERIES[topic_id]
        logger.info("REFRESH %s — query: %s", topic_id, query)

        try:
            selected = discover_videos(topic_id, query, count, api_key)
            if selected:
                write_outputs(topic_id, selected)
                refreshed += 1
            else:
                logger.warning("No videos found for %s — existing file unchanged", topic_id)
                failed += 1
        except Exception as e:
            logger.error("FAILED %s — %s: %s", topic_id, type(e).__name__, e)
            failed += 1

    logger.info(
        "Batch complete: %d refreshed, %d skipped (fresh), %d failed",
        refreshed, skipped, failed,
    )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Discover YouTube narrative shapers for a topic using NFS"
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--topic",
                       help="Single topic ID (e.g., ai-regulation)")
    group.add_argument("--refresh-all", action="store_true",
                       help="Refresh all topics in TOPIC_QUERIES (24h staleness check)")
    parser.add_argument("--query", default=None,
                        help="Custom search query (--topic mode only)")
    parser.add_argument("--count", type=int, default=5,
                        help="Number of videos to select per topic (default: 5)")
    parser.add_argument("--force", action="store_true",
                        help="Force refresh even if data is fresh (--refresh-all mode)")
    args = parser.parse_args()

    api_key = os.environ.get("YOUTUBE_API_KEY")
    if not api_key:
        logger.warning(
            "YOUTUBE_API_KEY not set. Skipping YouTube discovery. "
            "Existing static files remain untouched."
        )
        sys.exit(0)

    if args.refresh_all:
        refresh_all(args.count, api_key, force=args.force)
    else:
        selected = discover_videos(args.topic, args.query, args.count, api_key)
        if selected:
            write_outputs(args.topic, selected)
        else:
            logger.warning(
                "No videos discovered for topic '%s'. "
                "Existing file (if any) unchanged.",
                args.topic,
            )


if __name__ == "__main__":
    main()
