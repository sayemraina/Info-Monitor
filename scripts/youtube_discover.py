#!/usr/bin/env python3
"""
YouTube Narrative Shapers Discovery — Automated Selection Pipeline.

3-stage pipeline:
  Stage 1 — Layered Search: 4 targeted searches per topic
    (event, analysis, counter, viral) using triggering events from archetypes.
  Stage 2 — Score & Classify: Updated NFS with engagement_ratio + claim_signal.
  Stage 3 — 6-Slot Selection: Role-based selection
    (frame setter, institutional, primary commentator, counter-voice, authentic witness, velocity outlier).

Requires YOUTUBE_API_KEY environment variable.
Without it, exits cleanly (existing static files remain).

Usage:
    python scripts/youtube_discover.py --topic ai-workplace
    python scripts/youtube_discover.py --refresh-all
    python scripts/youtube_discover.py --refresh-all --force

Output:
    data/youtube/{topic_id}.json          — VideoMetadata[] for frontend
    data/youtube/{topic_id}_scored.json   — Extended data with NFS breakdown + roles
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
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.request import urlopen, Request
from urllib.parse import urlencode, quote_plus
from urllib.error import HTTPError

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
YOUTUBE_DIR = DATA_DIR / "youtube"           # Static mock files — never written by this script
LIVE_DIR    = DATA_DIR / "youtube" / "live"  # Real-time pipeline output — always written here
SCRIPTS_DIR = Path(__file__).parent
ARCHETYPES_DIR = SCRIPTS_DIR / "archetypes"

API_BASE = "https://www.googleapis.com/youtube/v3"

# ---------------------------------------------------------------------------
# NFS Weights — 6 signals, each earns its place
# ---------------------------------------------------------------------------
W_VV = 0.35    # View Velocity — how fast is this spreading? (punching above weight)
W_RE = 0.20    # Reach — raw audience size (log-scaled)
W_FLS = 0.15   # Framing Language — is the title making a claim or just reporting?
W_DP = 0.10    # Debate Provocation — comment/view ratio vs batch average
W_R = 0.08     # Recency — 14-day half-life decay
W_ER = 0.12    # Engagement Ratio — comments/views, depth of reaction

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
RECENCY_HALF_LIFE = 14            # days
MAX_LOG_VIEWS = 7.3               # log10(20M) -> 1.0
MAX_LOG_VPH = 4.0                 # log10(10K views/hr) -> 1.0

# Tier thresholds (subscriber count)
TIER1_THRESHOLD = 500_000         # Institutional: >500K subs
TIER2_THRESHOLD = 50_000          # Commentator: 50K-500K subs
# Tier 3: <50K subs (independent / alternative)

# Per-slot view minimums
SLOT_VIEW_MINIMUMS = {
    "frame_setter": 10_000,
    "institutional": 50_000,
    "primary_commentator": 20_000,
    "counter_voice": 10_000,
    "authentic_witness": 1_000,
    "velocity_outlier": 10_000,
}

STALENESS_HOURS = 24

# Quality gate constants
# Titles containing these patterns are live-trading/stream noise — not analysis
LIVE_STREAM_TITLE_PATTERNS = [
    "live trading", "live ||", "|| live", " live |", "| live ",
    "live stream", "livestream", "live crypto trading",
    "live bitcoin trading", "trading live", "live scalping",
    "live forex", "live market", "live session",
]

# Absolute floor: channels with fewer subs than this are noise, not voices
MIN_SUBSCRIBER_FLOOR = 1_000
# Lower floor for witness-origin candidates (personal story channels are small by nature)
WITNESS_SUBSCRIBER_FLOOR = 500

# Hashtag spam: titles with ≥5 hashtags are viral bait, not analysis
HASHTAG_SPAM_THRESHOLD = 5

# This is a US-focused monitor. Titles explicitly about non-US markets/law
# should be excluded. These are whole-word patterns (re.search with \b).
# "India" catches "Delta Exchange India"; "pakistan" catches Pakistani law vids.
# Does NOT catch "Indiana", "Indian-American" (different whole words).
GEO_EXCLUSION_PATTERNS = [
    r"\bindia\b",
    r"\bindian rupee\b",
    r"\bpakistan\b",
    r"\bbangladesh\b",
]

# Channel name signals that indicate a news / editorial outlet.
# Used to prefer real media over entertainment channels in institutional slots.
EDITORIAL_CHANNEL_KEYWORDS = [
    "news", "television", "tv ", " tv", "nbc", "abc", "cbs", "cnn", "fox",
    "bbc", "bloomberg", "reuters", "ap ", "associated press",
    "times", "post", "journal", "media", "report", "press",
    "broadcast", "network", "radio", "magazine", "daily", "weekly",
    "official", "channel", "finance", "business", "economy",
    "politics", "policy", "analysis",
]

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
        "clash", "slam", "blast", "wreck", "demolish",
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
    "guide to", "101", "primer", "basics",
]



# ---------------------------------------------------------------------------
# Load topic config
# ---------------------------------------------------------------------------

def load_topic_keywords() -> Dict[str, Any]:
    path = SCRIPTS_DIR / "topic_keywords.json"
    if path.exists():
        return json.loads(path.read_text())
    return {}


def load_archetype_events(topic_id: str) -> List[Dict[str, str]]:
    """Extract triggering events from archetype file, sorted by date (newest first)."""
    path = ARCHETYPES_DIR / f"{topic_id}.json"
    if not path.exists():
        return []

    data = json.loads(path.read_text())
    events = {}
    for arc in data.get("archetypes", []):
        ta = arc.get("time_anchor", {})
        event = ta.get("event", "")
        date = ta.get("date", "")
        if event and event not in events:
            events[event] = date

    # Sort by date descending, return top 3
    sorted_events = sorted(events.items(), key=lambda x: x[1], reverse=True)
    return [{"event": e, "date": d} for e, d in sorted_events[:3]]


# ---------------------------------------------------------------------------
# YouTube API helpers
# ---------------------------------------------------------------------------

def youtube_api_get(endpoint: str, params: Dict[str, str], api_key: str) -> Dict[str, Any]:
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
                   published_after_days: int = 365,
                   order: str = "relevance") -> List[Dict[str, Any]]:
    """Search YouTube for videos matching query.

    regionCode=US biases results toward content popular in the US.
    relevanceLanguage=en further filters for English-language results.
    Together these prevent non-US/non-English content (e.g., Indian political
    channels, Pakistani law channels) from polluting the candidate pool.
    """
    after = (datetime.now(timezone.utc) - timedelta(days=published_after_days)).strftime("%Y-%m-%dT00:00:00Z")
    params = {
        "part": "snippet",
        "q": query,
        "type": "video",
        "order": order,
        "maxResults": str(max_results),
        "publishedAfter": after,
        "relevanceLanguage": "en",
        "regionCode": "US",
    }
    data = youtube_api_get("search", params, api_key)
    return data.get("items", [])


def get_video_stats(video_ids: List[str], api_key: str) -> Dict[str, Dict[str, Any]]:
    result = {}
    for i in range(0, len(video_ids), 50):
        batch = video_ids[i:i + 50]
        params = {"part": "snippet,statistics", "id": ",".join(batch)}
        data = youtube_api_get("videos", params, api_key)
        for item in data.get("items", []):
            result[item["id"]] = item
    return result


def get_channel_stats(channel_ids: List[str], api_key: str) -> Dict[str, Dict[str, Any]]:
    result = {}
    for i in range(0, len(channel_ids), 50):
        batch = channel_ids[i:i + 50]
        params = {"part": "statistics", "id": ",".join(batch)}
        data = youtube_api_get("channels", params, api_key)
        for item in data.get("items", []):
            result[item["id"]] = item
    return result


# ---------------------------------------------------------------------------
# Stage 1: Layered Search
# ---------------------------------------------------------------------------

def layered_search(topic_id: str, api_key: str) -> List[Dict[str, Any]]:
    """
    Run 4 targeted searches per topic. Returns deduplicated candidate pool
    with each result tagged by search_origin.
    """
    config = load_topic_keywords().get(topic_id, {})
    youtube_queries = config.get("youtube_queries", [topic_id.replace("-", " ")])
    counter_queries = config.get("counter_queries", [])
    events = load_archetype_events(topic_id)

    all_results: Dict[str, Dict[str, Any]] = {}  # video_id -> {item, search_origin}

    def collect(items: List[Dict[str, Any]], origin: str):
        for item in items:
            vid_id = item.get("id", {}).get("videoId", "")
            if vid_id and vid_id not in all_results:
                all_results[vid_id] = {"item": item, "search_origin": origin}

    # Search 1: Event-driven (triggering events from archetypes, sort by date)
    # The topic's primary youtube_query is prepended to anchor the search.
    # Archetype events describe what happened (e.g., "FDA approvals of AI diagnostic
    # tools in radiology") but that description alone returns off-topic YouTube results.
    # Prepending the topic anchor ("AI replacing jobs") pulls results toward the
    # topic-relevant angle of the event without removing the event context.
    if events:
        for ev in events[:2]:  # Top 2 most recent events
            event_query = f"{youtube_queries[0]} {ev['event'][:55]}"
            logger.info("  Event search: %s", event_query[:60])
            try:
                results = search_videos(event_query, api_key, max_results=30, order="date")
                collect(results, "event")
            except Exception as e:
                logger.warning("  Event search failed: %s", e)
    else:
        # Fallback: use first youtube_query sorted by date
        logger.info("  No archetype events found, using keyword date search")
        try:
            results = search_videos(youtube_queries[0], api_key, max_results=30, order="date")
            collect(results, "event")
        except Exception as e:
            logger.warning("  Event fallback search failed: %s", e)

    # Search 2: Analysis/commentary (topic + analysis keywords)
    analysis_query = f"{youtube_queries[0]} analysis OR explained OR opinion"
    logger.info("  Analysis search: %s", analysis_query[:60])
    try:
        results = search_videos(analysis_query, api_key, max_results=30, order="relevance")
        collect(results, "analysis")
    except Exception as e:
        logger.warning("  Analysis search failed: %s", e)

    # Search 3: Counter-narrative (use all queries, not just first 2)
    if counter_queries:
        counter_query = " OR ".join(f'"{q}"' for q in counter_queries)
        logger.info("  Counter search: %s", counter_query[:60])
        try:
            results = search_videos(counter_query, api_key, max_results=30, order="relevance")
            collect(results, "counter")
        except Exception as e:
            logger.warning("  Counter search failed: %s", e)

    # Search 4: Viral (sort by view count)
    viral_query = " ".join(youtube_queries[:2])
    logger.info("  Viral search: %s", viral_query[:60])
    try:
        results = search_videos(viral_query, api_key, max_results=30, order="viewCount")
        collect(results, "viral")
    except Exception as e:
        logger.warning("  Viral search failed: %s", e)

    # Search 5: Authentic witness (first-person accounts, personal stories)
    # These are people who lived the topic — not analysts. Lower subscriber floor applies.
    witness_queries = config.get("witness_queries", [])
    if witness_queries:
        witness_query = " OR ".join(f'"{q}"' for q in witness_queries[:2])
        logger.info("  Witness search: %s", witness_query[:60])
        try:
            results = search_videos(witness_query, api_key, max_results=20, order="relevance")
            collect(results, "witness")
        except Exception as e:
            logger.warning("  Witness search failed: %s", e)

    search_count = 5 if witness_queries else 4
    logger.info("  Layered search: %d unique candidates from %d searches", len(all_results), search_count)
    return list(all_results.values())


# ---------------------------------------------------------------------------
# NFS Scoring Functions
# ---------------------------------------------------------------------------

def classify_tier(subscriber_count: int) -> int:
    if subscriber_count >= TIER1_THRESHOLD:
        return 1  # Institutional
    if subscriber_count >= TIER2_THRESHOLD:
        return 2  # Commentator
    return 3      # Independent


def score_view_velocity(view_count: int, published_at: str) -> float:
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
    if view_count <= 0:
        return 0.0
    return min(math.log10(max(view_count, 1)) / MAX_LOG_VIEWS, 1.0)


def score_framing_language(title: str) -> float:
    title_lower = title.lower()
    categories_matched = 0
    for _cat, keywords in FRAMING_CATEGORIES.items():
        if any(kw in title_lower for kw in keywords):
            categories_matched += 1
    raw = categories_matched / len(FRAMING_CATEGORIES)
    if any(marker in title_lower for marker in NEUTRAL_MARKERS):
        raw *= 0.3
    return min(raw, 1.0)


def score_debate_provocation(comment_count: int, view_count: int,
                              batch_avg_ratio: float) -> float:
    if view_count <= 0 or batch_avg_ratio <= 0:
        return 0.0
    ratio = comment_count / view_count
    return min(ratio / (batch_avg_ratio * 3), 1.0)


def score_engagement_ratio(comment_count: int, view_count: int) -> float:
    """Comments-to-views ratio. High = provoked discussion.

    Distinct from debate_provocation: DP measures comments/views relative
    to the batch average (normalized). This measures the raw absolute ratio.
    A video where 1% of viewers commented is more engaging than one where 0.1% did,
    regardless of what the batch average is.

    YouTube reliably returns commentCount (0 when disabled).
    likeCount is excluded — YouTube hides it for many channels.
    """
    if view_count <= 0:
        return 0.0
    ratio = comment_count / view_count
    # Typical comment ratio is 0.1-0.5%. 1%+ is exceptional.
    return min(ratio / 0.01, 1.0)


def score_recency(published_at: str) -> float:
    try:
        pub_dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return 0.0
    age_days = (datetime.now(timezone.utc) - pub_dt).total_seconds() / 86400
    if age_days < 0:
        return 1.0
    return math.exp(-math.log(2) * age_days / RECENCY_HALF_LIFE)


def compute_nfs(scores: Dict[str, float]) -> float:
    return (
        W_VV * scores["view_velocity"]
        + W_RE * scores["reach"]
        + W_FLS * scores["framing_language"]
        + W_DP * scores["debate_provocation"]
        + W_R * scores["recency"]
        + W_ER * scores["engagement_ratio"]
    )


# ---------------------------------------------------------------------------
# Stage 2: Score & Classify
# ---------------------------------------------------------------------------

def score_candidates(candidates: List[Dict[str, Any]], api_key: str) -> List[Dict[str, Any]]:
    """Enrich candidates with stats and compute NFS scores."""
    video_ids = [c["item"]["id"]["videoId"] for c in candidates]

    # Fetch video stats
    video_stats = get_video_stats(video_ids, api_key)

    # Fetch channel stats
    channel_ids = list({
        v["snippet"]["channelId"]
        for v in video_stats.values()
    })
    channel_stats = get_channel_stats(channel_ids, api_key)

    # Batch average comment/view ratio for debate provocation
    total_ratio = 0.0
    ratio_count = 0
    for vdata in video_stats.values():
        stats = vdata.get("statistics", {})
        vc = int(stats.get("viewCount", 0))
        cc = int(stats.get("commentCount", 0))
        if vc > 0:
            total_ratio += cc / vc
            ratio_count += 1
    batch_avg_ratio = total_ratio / max(ratio_count, 1)

    # Score each video
    scored = []
    for candidate in candidates:
        vid_id = candidate["item"]["id"]["videoId"]
        search_origin = candidate["search_origin"]

        vdata = video_stats.get(vid_id)
        if not vdata:
            continue

        snippet = vdata.get("snippet", {})
        stats = vdata.get("statistics", {})
        channel_id = snippet.get("channelId", "")
        ch_stats = channel_stats.get(channel_id, {}).get("statistics", {})

        view_count = int(stats.get("viewCount", 0))
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
            "recency": score_recency(published_at),
            "engagement_ratio": score_engagement_ratio(comment_count, view_count),
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
            "comment_count": comment_count,
            "tier": classify_tier(subscriber_count),
            "nfs": round(nfs, 4),
            "nfs_breakdown": {k: round(v, 4) for k, v in scores.items()},
            "search_origin": search_origin,
        })

    logger.info("Scored %d videos (batch avg comment/view ratio: %.5f)",
                len(scored), batch_avg_ratio)
    return scored


# ---------------------------------------------------------------------------
# Quality Gate & Editorial Detection
# ---------------------------------------------------------------------------

def is_quality_video(v: Dict[str, Any]) -> bool:
    """
    Hard quality gate. Returns False for videos that should never be shown
    regardless of NFS score:
      1. Live trading streams — ephemeral, low-information content
      2. Hashtag-spam titles — viral bait, not analysis
      3. Micro-channels — fewer than 1,000 subscribers is noise, not a voice
      4. Geo-exclusion — titles explicitly about non-US markets for a US monitor
    """
    title = v.get("title", "")
    title_lower = title.lower()

    # 1. Live trading / live stream title patterns
    for pattern in LIVE_STREAM_TITLE_PATTERNS:
        if pattern in title_lower:
            return False

    # 2. Hashtag spam
    if title.count("#") >= HASHTAG_SPAM_THRESHOLD:
        return False

    # 3. Micro-channel floor (witness-origin candidates get a lower floor:
    # personal story channels are small by design)
    sub_floor = WITNESS_SUBSCRIBER_FLOOR if v.get("search_origin") == "witness" else MIN_SUBSCRIBER_FLOOR
    if v.get("channel_subscribers", 0) < sub_floor:
        return False

    # 4. Geo-exclusion: this is a US-focused monitor.
    # Titles explicitly referencing non-US markets/law should not appear.
    for pattern in GEO_EXCLUSION_PATTERNS:
        if re.search(pattern, title_lower):
            return False

    return True


def is_editorial_channel(channel_name: str) -> bool:
    """
    Returns True if the channel name contains signals of a news / editorial outlet.
    Used to prefer media organizations over entertainment channels in institutional slots.
    Examples: CNBC Television ✓, Bloomberg ✓, BotezLive ✗, EL Vato Fish'n Lures ✗
    """
    name_lower = channel_name.lower()
    return any(kw in name_lower for kw in EDITORIAL_CHANNEL_KEYWORDS)


# ---------------------------------------------------------------------------
# Stage 3: 6-Slot Selection
# ---------------------------------------------------------------------------

def select_six_slots(scored_videos: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Select 6 narrative shapers using 6 defensible roles:

      1. Frame setter      — earliest event-origin video. Who set the frame first?
      2. Institutional     — best Tier 1 editorial outlet. What does the establishment say?
      3. Primary commentator — best Tier 2 by NFS. The most engaging analyst voice.
      4. Counter-voice     — top result from counter-narrative search. Any tier.
      5. Authentic witness — first-person account from witness search. Real person, lived it.
      6. Velocity outlier  — highest view_velocity in last 14 days. What is exploding right now?

    Guarantees:
      - Max 1 video per channel (channel dedup)
      - Temporal anchor (frame setter)
      - Institutional representation
      - Counter-narrative representation
      - Ground-level personal voice (authentic witness)
      - Current momentum signal (velocity outlier)
      - Every slot has a clear, defensible reason for existing
    """
    # Channel dedup: keep highest NFS per channel
    best_per_channel: Dict[str, Dict[str, Any]] = {}
    for v in scored_videos:
        ch = v.get("channel_id", v["channel_name"])
        if ch not in best_per_channel or v["nfs"] > best_per_channel[ch]["nfs"]:
            best_per_channel[ch] = v
    pool = sorted(best_per_channel.values(), key=lambda v: v["nfs"], reverse=True)

    selected: List[Dict[str, Any]] = []
    seen_channels: Set[str] = set()

    def pick(video: Dict[str, Any], role: str) -> bool:
        ch = video.get("channel_id", video["channel_name"])
        if ch in seen_channels:
            return False
        video = dict(video)  # copy
        video["role"] = role
        selected.append(video)
        seen_channels.add(ch)
        return True

    def available(v: Dict[str, Any]) -> bool:
        return v.get("channel_id", v["channel_name"]) not in seen_channels

    def meets_view_min(video: Dict[str, Any], role: str) -> bool:
        return video["view_count"] >= SLOT_VIEW_MINIMUMS.get(role, 0)

    def parse_published_at(s: str) -> Optional[datetime]:
        try:
            return datetime.fromisoformat(s.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            return None

    # --- Slot 1: Frame setter ---
    # The earliest-published event-origin video that meets the view threshold.
    # Rationale: whoever published first after a triggering event shapes how
    # everyone else frames the story. "First" = temporal anchor, not loudest.
    # Within the event-origin pool, prefer editorial channels (news orgs) over
    # fringe channels that happened to publish early — an editorial outlet
    # publishing 3 hours after the event is a stronger frame setter than a
    # 900-subscriber clip channel publishing 20 minutes earlier.
    frame_pool = [v for v in pool if v.get("search_origin") == "event"
                  and available(v) and meets_view_min(v, "frame_setter")]
    if frame_pool:
        _sentinel = datetime.max.replace(tzinfo=timezone.utc)
        frame_editorial = sorted(
            [v for v in frame_pool if is_editorial_channel(v["channel_name"])],
            key=lambda v: parse_published_at(v.get("published_at", "")) or _sentinel,
        )
        frame_non_editorial = sorted(
            [v for v in frame_pool if not is_editorial_channel(v["channel_name"])],
            key=lambda v: parse_published_at(v.get("published_at", "")) or _sentinel,
        )
        frame_sorted = frame_editorial + frame_non_editorial
        pick(frame_sorted[0], "frame_setter")
    # Fallback: best Tier 1 editorial if no event-origin videos pass the threshold
    if not any(v.get("role") == "frame_setter" for v in selected):
        t1_fallback = [v for v in pool if v["tier"] == 1 and available(v)
                       and meets_view_min(v, "frame_setter")
                       and is_editorial_channel(v["channel_name"])]
        if t1_fallback:
            pick(t1_fallback[0], "frame_setter")

    # --- Slot 2: Institutional ---
    # Best Tier 1 editorial outlet by NFS.
    # Prefer genuine news orgs over entertainment channels with large subscriber counts.
    t1_pool = [v for v in pool if v["tier"] == 1 and available(v)
               and meets_view_min(v, "institutional")]
    t1_editorial = [v for v in t1_pool if is_editorial_channel(v["channel_name"])]
    if t1_editorial:
        pick(t1_editorial[0], "institutional")
    elif t1_pool:
        pick(t1_pool[0], "institutional")
    # Fallback: editorial Tier 2 if no Tier 1 available
    if not any(v["role"] == "institutional" for v in selected):
        t2_editorial_fallback = [v for v in pool if v["tier"] == 2 and available(v)
                                 and is_editorial_channel(v["channel_name"])
                                 and meets_view_min(v, "institutional")]
        if t2_editorial_fallback:
            pick(t2_editorial_fallback[0], "institutional")

    # --- Slot 3: Primary commentator ---
    # Best Tier 2 by NFS. The most engaging opinion/analysis voice in the mid tier.
    t2_pool = [v for v in pool if v["tier"] == 2 and available(v)
               and meets_view_min(v, "primary_commentator")]
    if t2_pool:
        pick(t2_pool[0], "primary_commentator")

    # --- Slot 4: Counter-voice ---
    # Best from counter search, any tier. Must have >10K views to represent a real voice.
    counter_pool = [v for v in pool if v["search_origin"] == "counter" and available(v)
                    and meets_view_min(v, "counter_voice")]
    counter_pool.sort(key=lambda v: v["nfs"], reverse=True)
    if counter_pool:
        pick(counter_pool[0], "counter_voice")

    # --- Slot 5: Authentic witness ---
    # Prefer witness-origin candidates (personal story searches) sorted by engagement_ratio.
    # Engagement ratio is the right signal here: a real person's story that provoked
    # discussion is more valuable than one that was merely viewed.
    # Fallback: Tier 3 by engagement_ratio (existing independent logic).
    witness_pool = [v for v in pool if v.get("search_origin") == "witness" and available(v)
                    and meets_view_min(v, "authentic_witness")]
    witness_pool.sort(key=lambda v: v["nfs_breakdown"].get("engagement_ratio", 0), reverse=True)
    if witness_pool:
        pick(witness_pool[0], "authentic_witness")
    else:
        # Fallback: Tier 3, prefer analysis/event origins over viral
        t3_pool = [v for v in pool if v["tier"] == 3 and available(v)
                   and meets_view_min(v, "authentic_witness")]
        t3_from_analysis = [v for v in t3_pool if v.get("search_origin") in ("analysis", "event")]
        t3_sorted = t3_from_analysis if t3_from_analysis else t3_pool
        t3_sorted.sort(key=lambda v: v["nfs_breakdown"].get("engagement_ratio", 0), reverse=True)
        if t3_sorted:
            pick(t3_sorted[0], "authentic_witness")

    # --- Slot 6: Velocity outlier ---
    # The video with the highest view_velocity published in the last 14 days.
    # This surfaces what is EXPLODING right now, not just what scored well overall.
    # Expand to 30 days if nothing recent. Fall back to highest NFS if still nothing.
    now = datetime.now(timezone.utc)
    cutoff_14d = now - timedelta(days=14)
    cutoff_30d = now - timedelta(days=30)

    def published_after(v: Dict[str, Any], cutoff: datetime) -> bool:
        dt = parse_published_at(v.get("published_at", ""))
        return dt is not None and dt >= cutoff

    velocity_14d = [v for v in pool if available(v)
                    and meets_view_min(v, "velocity_outlier")
                    and published_after(v, cutoff_14d)]
    velocity_30d = [v for v in pool if available(v)
                    and meets_view_min(v, "velocity_outlier")
                    and published_after(v, cutoff_30d)]
    velocity_any = [v for v in pool if available(v) and meets_view_min(v, "velocity_outlier")]

    velocity_pool = velocity_14d or velocity_30d or velocity_any
    velocity_pool.sort(key=lambda v: v["nfs_breakdown"].get("view_velocity", 0), reverse=True)
    for v in velocity_pool:
        if pick(v, "velocity_outlier"):
            break

    # Fill any remaining slots (defensive: if a slot couldn't be filled above)
    # Label as "supplementary" — honest about why this video is here, not
    # mislabeled as velocity_outlier when it's actually a gap-filler.
    for v in pool:
        if len(selected) >= 6:
            break
        if available(v):
            pick(v, "supplementary")

    logger.info("Selected %d videos: %s",
                len(selected),
                [(v.get("role", "?"), v["tier"], v["channel_name"][:25]) for v in selected])
    return selected


# ---------------------------------------------------------------------------
# Main Pipeline
# ---------------------------------------------------------------------------

def discover_videos(topic_id: str, count: int, api_key: str) -> List[Dict[str, Any]]:
    """
    Full NFS discovery pipeline:
    layered search → enrich → score → 6-slot select
    """
    logger.info("=== Discovering shapers for: %s ===", topic_id)

    # Stage 1: Layered search
    candidates = layered_search(topic_id, api_key)
    if not candidates:
        logger.warning("No candidates found for: %s", topic_id)
        return []

    # Stage 2: Score & classify
    scored = score_candidates(candidates, api_key)
    if not scored:
        logger.warning("No videos scored for: %s", topic_id)
        return []

    # Stage 2b: Topic-relevance gate
    # Prevents off-topic videos from winning slots on raw engagement alone.
    #
    # Uses word-level matching against youtube_queries + counter_queries — NOT
    # the shared `keywords` field. That field serves other ingesters (Reddit,
    # GDELT, X, etc.) and uses precise taxonomy phrases like "AI replacing jobs"
    # that rarely appear verbatim in YouTube titles. youtube_queries and
    # counter_queries are already YouTube-optimised vocabulary.
    #
    # Logic: extract individual significant words from those two fields, require
    # at least 2 to appear in the video title. This matches how humans actually
    # title YouTube videos ("Will AI Take Your Job?" → "AI" + "job" = 2 hits)
    # while still blocking genuinely off-topic content ("AI radiology accuracy"
    # → "AI" only = 1 hit → rejected). Threshold of 2 is the sweet spot:
    # low enough for varied real-world titles, high enough to block tangential
    # content that merely mentions one topic word in passing.
    #
    # Self-maintaining: any improvement to youtube_queries automatically
    # improves the gate with no further changes needed.
    _STOPWORDS = {
        'the', 'and', 'or', 'is', 'in', 'of', 'to', 'a', 'an', 'for', 'it',
        'its', 'on', 'at', 'by', 'as', 'up', 'be', 'do', 'go', 'not', 'all',
        'are', 'was', 'has', 'had', 'but', 'out', 'can', 'will', 'how', 'who',
        'get', 'more', 'one', 'have', 'been', 'were', 'them', 'they', 'with',
        'this', 'that', 'from', 'about', 'into', 'over', 'when', 'what', 'than',
        'vs', 'via', 'new', 'now', 'why', 'our', 'your', 'my', 'his', 'her',
        'we', 'he', 'she', 'you', 'me', 'us', 'im', 'so', 'if', 'no', 'oh',
        'just', 'also', 'very', 'too', 'got', 'did', 'does', 'their', 'which',
    }

    all_topic_config = load_topic_keywords()
    topic_config = all_topic_config.get(topic_id, {})
    # Draw vocabulary from all three fields — each covers different angles:
    # keywords = full topic taxonomy (includes proper nouns like "Israel", "Houthi")
    # youtube_queries = search-optimised phrases already tuned for YouTube
    # counter_queries = opposing vocabulary (adds words like "myth", "peace", "won't")
    _sig_phrases = (
        topic_config.get("keywords", []) +
        topic_config.get("youtube_queries", []) +
        topic_config.get("counter_queries", [])
    )
    _sig_words: Set[str] = set()
    for phrase in _sig_phrases:
        for word in re.sub(r"[^\w\s]", " ", phrase.lower()).split():
            if len(word) >= 2 and word not in _STOPWORDS:
                _sig_words.add(word)
                # Add singular form alongside plural — "jobs"→"job", "rates"→"rate"
                # so titles using singular forms ("your job", "mortgage rate") still match
                if word.endswith("s") and len(word) > 3:
                    _sig_words.add(word[:-1])

    # Gate applies only to event-origin videos. Analysis, counter, viral, and
    # witness searches are already targeted topic queries — trust YouTube's own
    # relevance for those. Event searches can still drift even with the topic
    # anchor prepended, so a gate is warranted there.
    #
    # For event-origin, hybrid two-pass check:
    #   Pass 1 — phrase: any keyword phrase as verbatim substring → immediate pass
    #   Pass 2 — word-level: ≥2 sig_word matches in title using:
    #     · words ≤4 chars: exact word match (stops "ai" matching "said"/"mail")
    #     · words ≥5 chars: substring match (catches replace/replaced/replacing)
    topic_kws = [kw.lower() for kw in topic_cfg.get("keywords", [])]
    if _sig_words or topic_kws:
        relevant = []
        dropped = 0
        for v in scored:
            if v.get("search_origin") != "event":
                relevant.append(v)  # Non-event origins: trust the search, no gate
                continue

            title = v.get("title", "")
            title_lower = title.lower()
            title_words = set(re.sub(r"[^\w\s]", " ", title_lower).split())

            # Pass 1: phrase check (fast path, handles most topics)
            if any(kw in title_lower for kw in topic_kws):
                relevant.append(v)
                continue

            # Pass 2: word-level fallback (handles varied real-world titles)
            word_hits = 0
            for sw in _sig_words:
                matched = (sw in title_words) if len(sw) <= 4 else (sw in title_lower)
                if matched:
                    word_hits += 1
                if word_hits >= 2:
                    break

            if word_hits >= 2:
                relevant.append(v)
            else:
                dropped += 1

        if dropped:
            logger.info("  Relevance gate: dropped %d off-topic event-origin videos, %d remain",
                        dropped, len(relevant))
        scored = relevant if relevant else scored  # Never empty the pool entirely

    # Stage 2c: Quality gate
    # Remove live trading streams, hashtag-spam titles, and micro-channels.
    # These pass the relevance gate (they mention topic keywords) but are
    # noise — not analysis. E.g., "GOLD AND CRYPTO LIVE TRADING || 7 APRIL"
    # or a 138-subscriber UFC channel tweeting about a crypto scam.
    quality_passed = [v for v in scored if is_quality_video(v)]
    if quality_passed:  # Never empty the pool entirely
        dropped_q = len(scored) - len(quality_passed)
        if dropped_q:
            logger.info("  Quality gate: removed %d low-quality videos, %d remain",
                        dropped_q, len(quality_passed))
        scored = quality_passed

    # Stage 3: 6-slot selection
    selected = select_six_slots(scored)
    return selected


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def write_outputs(topic_id: str, selected: List[Dict[str, Any]]) -> None:
    # Always write to LIVE_DIR — never touch the static mocks in YOUTUBE_DIR
    LIVE_DIR.mkdir(parents=True, exist_ok=True)

    # Frontend format: VideoMetadata[]
    frontend_data = [
        {
            "video_id": v["video_id"],
            "title": v["title"],
            "channel_name": v["channel_name"],
            "view_count": v["view_count"],
            "published_at": v["published_at"],
            "tier": v.get("tier"),
            "composite_score": v.get("nfs"),
            "channel_subscribers": v.get("channel_subscribers"),
            "role": v.get("role"),
        }
        for v in selected
    ]

    frontend_path = LIVE_DIR / f"{topic_id}.json"
    frontend_path.write_text(json.dumps(frontend_data, indent=2))
    logger.info("Wrote %s (%d videos)", frontend_path, len(frontend_data))

    # Scored format: full data with NFS breakdown
    scored_path = LIVE_DIR / f"{topic_id}_scored.json"
    scored_path.write_text(json.dumps(selected, indent=2))
    logger.info("Wrote %s", scored_path)


# ---------------------------------------------------------------------------
# Staleness Check
# ---------------------------------------------------------------------------

def is_stale(topic_id: str, max_age_hours: int = STALENESS_HOURS) -> bool:
    # Check freshness against LIVE_DIR only — static mocks are not a freshness reference
    path = LIVE_DIR / f"{topic_id}.json"
    if not path.exists():
        return True
    mtime = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
    age = datetime.now(timezone.utc) - mtime
    return age.total_seconds() > max_age_hours * 3600


# ---------------------------------------------------------------------------
# Batch Refresh
# ---------------------------------------------------------------------------

def refresh_all(count: int, api_key: str, force: bool = False) -> None:
    topics = load_topic_keywords()
    logger.info("Batch refresh: %d topics", len(topics))

    refreshed = 0
    skipped = 0
    failed = 0

    for topic_id in topics:
        if not force and not is_stale(topic_id):
            logger.info("SKIP %s — data is fresh (< %dh old)", topic_id, STALENESS_HOURS)
            skipped += 1
            continue

        logger.info("REFRESH %s", topic_id)
        try:
            selected = discover_videos(topic_id, count, api_key)
            if len(selected) >= 4:
                write_outputs(topic_id, selected)
                refreshed += 1
            elif selected:
                logger.warning(
                    "Only %d videos found for %s (need ≥4, likely strict relevance gate) "
                    "— existing file unchanged", len(selected), topic_id
                )
                failed += 1
            else:
                logger.warning("No videos found for %s — existing file unchanged", topic_id)
                failed += 1
        except Exception as e:
            logger.error("FAILED %s — %s: %s", topic_id, type(e).__name__, e)
            failed += 1

    logger.info("Batch complete: %d refreshed, %d skipped, %d failed",
                refreshed, skipped, failed)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Discover YouTube narrative shapers using layered NFS pipeline"
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--topic", help="Single topic ID (e.g., ai-workplace)")
    group.add_argument("--refresh-all", action="store_true", help="Refresh all topics")
    parser.add_argument("--count", type=int, default=6,
                        help="Number of videos to select (default: 6)")
    parser.add_argument("--force", action="store_true",
                        help="Force refresh even if data is fresh")
    args = parser.parse_args()

    # Load .env if key not already in environment
    if not os.environ.get("YOUTUBE_API_KEY"):
        env_file = Path(__file__).parent.parent / ".env"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if line.startswith("YOUTUBE_API_KEY=") and "=" in line:
                    val = line.split("=", 1)[1].strip()
                    if val:
                        os.environ["YOUTUBE_API_KEY"] = val
                        break

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
        selected = discover_videos(args.topic, args.count, api_key)
        if len(selected) >= 4:
            write_outputs(args.topic, selected)
        elif selected:
            logger.warning(
                "Only %d videos discovered for '%s' (need ≥4). "
                "Likely over-strict relevance gate. Existing file unchanged.",
                len(selected), args.topic
            )
        else:
            logger.warning("No videos discovered for '%s'. Existing file unchanged.", args.topic)


if __name__ == "__main__":
    main()
