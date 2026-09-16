"""Context builder for AI Guide.

Assembles stable (cached) and volatile (not cached) context from current view state.
"""

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional
import json


@dataclass(frozen=True)
class StableContext:
    """Cached per topic (doesn't change much during exploration)."""

    topic_id: str
    topic_name: str
    contestation_level: str        # 'high' | 'low' | 'unknown'
    cluster_taxonomy: list[dict]   # Top 10 clusters: full fields + representative claims
    recent_signals: list[dict]     # Top 8 events from timeline, sorted by severity

    def serialize(self) -> str:
        """Deterministic JSON for caching."""
        return json.dumps(asdict(self), sort_keys=True, separators=(',', ':'))


@dataclass
class VolatileContext:
    """Changes per view (not cached)."""

    time_window: str              # '6h' | '24h' | '7d'
    selected_claim_id: Optional[str]
    selected_cluster_id: Optional[str]
    level: int                    # 0 | 1 | 2
    compare_mode: bool
    active_slices: list[str]

    def serialize(self) -> str:
        return json.dumps(asdict(self), sort_keys=True)


def _pick_representative_claims(
    claims: list[dict],
    cluster_id: str,
    n: int = 3
) -> list[str]:
    """
    Pick up to n representative claim texts for a cluster.

    Selects by highest confidence first, then by highest arousal
    (high-arousal claims are more analytically interesting).
    Deduplicates by text.
    """
    cluster_claims = [c for c in claims if c.get("cluster_id") == cluster_id]

    if not cluster_claims:
        return []

    # Score: confidence (primary) + arousal bonus
    arousal_score = {"high": 0.3, "medium": 0.15, "low": 0.0}

    def claim_score(c: dict) -> float:
        confidence = c.get("confidence", 0.0)
        arousal = arousal_score.get(c.get("arousal", "low"), 0.0)
        return confidence + arousal

    sorted_claims = sorted(cluster_claims, key=claim_score, reverse=True)

    # Deduplicate by text (truncated to first 80 chars for fuzzy match)
    seen = set()
    result = []
    for c in sorted_claims:
        text = c.get("text", "").strip()
        key = text[:80].lower()
        if key not in seen and text:
            seen.add(key)
            result.append(text)
        if len(result) >= n:
            break

    return result


def _normalize_time_window(raw: str) -> str:
    """Normalize time window string to match file naming convention."""
    mapping = {
        "6h": "6h",
        "24h": "24h",
        "7d": "7d",
        # Handle variants
        "6H": "6h",
        "24H": "24h",
        "7D": "7d",
    }
    return mapping.get(raw, "24h")  # Default to 24h


async def build_context(
    topic_id: str,
    view_state: dict
) -> tuple[StableContext, VolatileContext]:
    """
    Build context from current view state.

    Reads from:
    - data/topics.json (topic summary)
    - data/metrics/{topic}/landscape_{window}.json (clusters + claims)
    - data/metrics/{topic}/timeline_{window}.json (recent events)

    Returns:
        (stable_context, volatile_context)
    """

    time_window_raw = view_state.get("timeWindow", "24h")
    time_window = _normalize_time_window(time_window_raw)

    # Load topic summary
    topics_path = Path("data/topics.json")
    topics = json.loads(topics_path.read_text())
    topic = next((t for t in topics if t["id"] == topic_id), None)

    if not topic:
        raise ValueError(f"Topic {topic_id} not found in topics.json")

    # Load landscape for clusters + claims
    landscape_path = Path(f"data/metrics/{topic_id}/landscape_{time_window}.json")
    if not landscape_path.exists():
        # Fallback to 24h if selected window doesn't exist
        landscape_path = Path(f"data/metrics/{topic_id}/landscape_24h.json")

    if landscape_path.exists():
        landscape = json.loads(landscape_path.read_text())
        clusters = landscape.get("clusters", [])
        claims = landscape.get("claims", [])
    else:
        clusters = []
        claims = []

    # Build cluster taxonomy: top 10 by member_count, with full fields + rep claims
    sorted_clusters = sorted(
        clusters,
        key=lambda c: c.get("member_count", 0),
        reverse=True
    )[:10]

    cluster_taxonomy = []
    for c in sorted_clusters:
        cluster_id = c.get("id", "")
        rep_claims = _pick_representative_claims(claims, cluster_id, n=3)

        cluster_taxonomy.append({
            "id": cluster_id,
            # Use full label (e.g. "AI Adoption in the Workplace"), not concept_label ("Automation")
            "label": c.get("label", c.get("concept_label", "Unnamed")),
            "concept": c.get("concept_label", ""),
            "member_count": c.get("member_count", 0),
            "mutation_direction": c.get("mutation_direction", "stable"),
            "mutation_magnitude": round(c.get("mutation_magnitude", 0.0), 3),
            "arousal_trend": c.get("arousal_trend", "stable"),
            "arousal_value": round(c.get("arousal_value", 0.0), 3),
            "influencer_seeded": c.get("influencer_seeding", {}).get("influencer_seeded", False),
            # Representative claim texts — what people in this cluster are actually saying
            "representative_claims": rep_claims,
        })

    # Load recent signals from timeline (correct path)
    timeline_path = Path(f"data/metrics/{topic_id}/timeline_{time_window}.json")
    if not timeline_path.exists():
        timeline_path = Path(f"data/metrics/{topic_id}/timeline_24h.json")

    # Canonical platforms that make sense to surface in divergence events.
    # RSS news sources (dnyuz, sportskeeda, news_directory_3, etc.) are ingested
    # as individual sources but are NOT meaningful "platforms" for cross-platform
    # divergence comparisons — showing them confuses users.
    CANONICAL_PLATFORMS = {"bluesky", "reddit", "youtube", "x"}

    if timeline_path.exists():
        timeline_data = json.loads(timeline_path.read_text())
        all_events = timeline_data.get("events", [])

        # Filter divergence_shift events: only keep those comparing canonical platforms.
        # All other event types pass through unfiltered.
        def keep_event(e: dict) -> bool:
            if e.get("type") != "divergence_shift":
                return True
            platforms = set(e.get("detail", {}).get("platforms", []))
            # Keep only if both platforms are canonical
            return platforms.issubset(CANONICAL_PLATFORMS) and len(platforms) >= 2

        filtered_events = [e for e in all_events if keep_event(e)]

        # Sort: high severity first, then most recent first (ISO timestamps sort lexicographically)
        severity_order = {"high": 0, "medium": 1, "low": 2}
        sorted_events = sorted(
            filtered_events,
            key=lambda e: (
                severity_order.get(e.get("severity", "low"), 2),
                e.get("timestamp", ""),  # earlier timestamps sort first within severity
            ),
            reverse=False,
        )

        # Take top 8 events with full detail
        recent_signals = []
        for e in sorted_events[:8]:
            recent_signals.append({
                "id": e.get("id", ""),
                "type": e.get("type", ""),
                "severity": e.get("severity", "low"),
                "confidence": e.get("confidence", 0.0),
                "summary": e.get("summary", ""),
                "detail": e.get("detail", {}),
                "timestamp": e.get("timestamp", ""),
            })
    else:
        recent_signals = []

    # Build stable context
    stable = StableContext(
        topic_id=topic_id,
        topic_name=topic.get("name", topic_id),
        contestation_level=topic.get("contestation_level", "unknown"),
        cluster_taxonomy=cluster_taxonomy,
        recent_signals=recent_signals,
    )

    # Build volatile context
    volatile = VolatileContext(
        time_window=time_window,
        selected_claim_id=view_state.get("selectedClaimId"),
        selected_cluster_id=view_state.get("selectedClusterId"),
        level=view_state.get("level", 1),
        compare_mode=view_state.get("compareMode", False),
        active_slices=view_state.get("activeSlices", []),
    )

    return stable, volatile
