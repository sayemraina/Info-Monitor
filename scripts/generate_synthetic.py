#!/usr/bin/env python3
"""
Synthetic Data Generator for Narrative Monitoring System.

Generates modeled demo data for 10 topics across 3 platforms (X, Reddit, YouTube).
Loads event-anchored archetype definitions from scripts/archetypes/*.json.
Produces all JSON files the frontend needs, matching TypeScript type contracts exactly.

No API keys required. Uses numpy for synthetic embeddings.
Archetype files contain real-event-anchored claims with platform-specific variations.

Usage:
    python scripts/generate_synthetic.py

Output:
    data/topics.json                           — TopicSummary[] for Level 0
    data/claims/{topic_id}/extracted.json      — Claim[] with embeddings
    data/claims/{topic_id}/clusters.json       — Cluster[]
    data/metrics/{topic_id}/landscape_{window}.json  — LandscapeData per window
    data/metrics/{topic_id}/claims/{claim_id}.json   — ClaimDetail per claim
    data/metrics/{topic_id}/compare/{slice_pair}_{window}.json — CompareData
    data/metrics/{topic_id}/timeline_{window}.json   — TimelineData
"""

import json
import os
import random
import hashlib
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np

# Seed for reproducibility
random.seed(42)
np.random.seed(42)

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"

# Maps momentum_pattern archetype labels to numeric momentum values (-1 to +1)
MOMENTUM_PATTERN_VALUES = {
    "spike":     0.80,
    "rising":    0.50,
    "stable":    0.00,
    "declining": -0.45,
    "goes_dark": -0.65,
}

# ============================================================================
# Archetype Loading — reads topic definitions from scripts/archetypes/*.json
# ============================================================================

ARCHETYPES_DIR = Path(__file__).parent / "archetypes"

# Locked topic order — must not change between visits
TOPIC_ORDER = [
    "ai-workplace", "war-on-iran", "ozempic-glp1", "immigration",
    "housing-crisis", "israel-palestine", "crypto-digital-money",
    "inflation-cost-of-living", "dei-rollbacks", "ai-bubble",
]


def load_archetype_file(topic_id: str) -> dict:
    """Load a single topic archetype definition from JSON."""
    path = ARCHETYPES_DIR / f"{topic_id}.json"
    with open(path) as f:
        return json.load(f)


def load_edge_cases() -> list:
    """Load edge case fixtures from _edge_cases.json."""
    path = ARCHETYPES_DIR / "_edge_cases.json"
    if not path.exists():
        return []
    with open(path) as f:
        data = json.load(f)
    return data.get("edge_cases", [])


def load_gaps() -> dict:
    """Load strategic data gap configuration from _gaps.json."""
    path = ARCHETYPES_DIR / "_gaps.json"
    if not path.exists():
        return {}
    with open(path) as f:
        data = json.load(f)
    return {k: v for k, v in data.items() if not k.startswith("_")}


def load_all_topics() -> list:
    """Load all topic archetype files in locked order, injecting edge cases."""
    edge_cases = load_edge_cases()
    topics = []
    for topic_id in TOPIC_ORDER:
        data = load_archetype_file(topic_id)
        # Inject edge cases targeted at this topic
        for ec in edge_cases:
            if ec.get("target_topic") == topic_id:
                ec_copy = {k: v for k, v in ec.items()
                           if k not in ("target_topic",) and not k.startswith("_")}
                data["archetypes"].append(ec_copy)
        # Build adversarial pair defs from the archetype file
        topics.append({
            "id": data["id"],
            "name": data["name"],
            "archetypes": data["archetypes"],
            "adversarial_pairs": data.get("adversarial_pairs", []),
        })
    return topics


# Load topics from archetype files
TOPICS = load_all_topics()
GAPS = load_gaps()

# Build ADVERSARIAL_PAIR_DEFS from loaded archetype files
ADVERSARIAL_PAIR_DEFS: dict[str, list[tuple[str, str]]] = {}
for _t in TOPICS:
    pairs = _t.get("adversarial_pairs", [])
    if pairs:
        ADVERSARIAL_PAIR_DEFS[_t["id"]] = [tuple(p) for p in pairs]


# Time configuration
NOW = datetime(2026, 3, 16, 12, 0, 0, tzinfo=timezone.utc)
WINDOWS = {
    "6h": timedelta(hours=6),
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
}
NUM_6H_WINDOWS = 28  # 7 days of 6h windows


def gen_id(prefix: str, *parts: str) -> str:
    """Generate deterministic ID from parts."""
    h = hashlib.sha256("|".join(parts).encode()).hexdigest()[:12]
    return f"{prefix}_{h}"


# Proper noun overrides for .title() casing
_CASE_OVERRIDES = {
    "ai": "AI", "dei": "DEI", "glp": "GLP", "btc": "BTC",
    "cbdc": "CBDC", "defi": "DeFi", "deepseek": "DeepSeek",
    "nimby": "NIMBY", "yimby": "YIMBY", "nyc": "NYC",
    "usa": "USA", "fda": "FDA", "sec": "SEC", "fed": "Fed",
    "icj": "ICJ", "unrwa": "UNRWA", "sbf": "SBF",
    "cpi": "CPI", "ifi": "IFI",
}

def smart_title(slug: str) -> str:
    """Convert a hyphenated slug to title case with proper noun awareness."""
    words = slug.replace("-", " ").split()
    return " ".join(_CASE_OVERRIDES.get(w.lower(), w.title()) for w in words)


def compute_time_mapping(archetypes: list) -> dict:
    """Map real event dates from time_anchor into the 7-day demo window.

    Returns a dict of concept -> mapped datetime within the demo window.
    Preserves relative ordering of events. Adds per-concept jitter.
    """
    anchored = [a for a in archetypes if a.get("time_anchor", {}).get("date")]
    if not anchored:
        return {}

    dates = {}
    for a in anchored:
        d = datetime.strptime(a["time_anchor"]["date"], "%Y-%m-%d")
        dates[a["concept"]] = d

    earliest = min(dates.values())
    latest = max(dates.values())
    real_span = (latest - earliest).total_seconds() or 1.0

    # Map into window: earliest event → NOW-7d, latest → NOW-6h
    window_start = NOW - timedelta(days=7)
    window_end = NOW - timedelta(hours=6)
    window_span = (window_end - window_start).total_seconds()

    mapping = {}
    for concept, d in dates.items():
        offset_ratio = (d - earliest).total_seconds() / real_span
        mapped = window_start + timedelta(seconds=offset_ratio * window_span)
        # Add ±6h gaussian jitter
        jitter = timedelta(hours=random.gauss(0, 3))
        mapped = max(window_start, min(window_end, mapped + jitter))
        mapping[concept] = mapped

    return mapping


def vary_text(base_text: str, platform: str, j: int,
              variations: list = None) -> str:
    """Generate a varied version of a claim text.

    If the archetype carries pre-written platform-specific variations,
    select from those. Otherwise return the base text for j==0,
    or a platform-prefixed version for j>0.
    """
    if j == 0:
        return base_text

    # Use pre-written variations if available
    if variations:
        platform_matches = [v for v in variations if v.get("platform") == platform]
        pool = platform_matches if platform_matches else variations
        return pool[j % len(pool)]["text"]

    # Fallback: simple platform-appropriate prefix (for generic/live topics)
    x_prefixes = [
        "This →", "Louder for the people in the back:", "Let me be clear:",
        "Hot take:", "Thread:", "The data is clear:", "Breaking it down:",
        "Not enough people are talking about this:", "I keep saying this:",
    ]
    reddit_prefixes = [
        "Genuinely asking —", "I've been following this closely and",
        "As someone who works in this field,", "Can we talk about how",
        "The data actually shows that", "Hot take but",
        "Hear me out:", "PSA:", "Serious question —",
    ]
    youtube_prefixes = [
        "What nobody tells you is that", "I've been researching this for months and",
        "Here's what's actually happening:", "Let me break this down:",
        "After looking at the data,", "Quick explainer:",
    ]

    if platform == "x":
        prefix = x_prefixes[j % len(x_prefixes)]
    elif platform == "reddit":
        prefix = reddit_prefixes[j % len(reddit_prefixes)]
    else:
        prefix = youtube_prefixes[j % len(youtube_prefixes)]

    first_char = base_text[0].lower() if base_text[:2] not in (
        'US', 'AI', 'DE', 'IP', 'CO', 'IF', 'BT', 'GL', 'RF', 'Oz', 'Bi', 'Pr'
    ) else base_text[0]
    return f"{prefix} {first_char}{base_text[1:]}"



def gen_embedding(base_vector: np.ndarray, noise_scale: float = 0.1) -> list[float]:
    """Generate a noisy version of a base embedding vector."""
    noisy = base_vector + np.random.normal(0, noise_scale, size=base_vector.shape)
    noisy = noisy / np.linalg.norm(noisy)  # L2 normalize
    return noisy.tolist()


def generate_momentum_series(pattern: str, n_windows: int = NUM_6H_WINDOWS) -> list[float]:
    """Generate a momentum time series matching the pattern."""
    if pattern == "stable":
        base = 0.5 + np.random.uniform(-0.05, 0.05)
        return [max(0, min(1, base + np.random.normal(0, 0.03))) for _ in range(n_windows)]
    elif pattern == "rising":
        return [max(0, min(1, 0.2 + (0.6 * i / n_windows) + np.random.normal(0, 0.04)))
                for i in range(n_windows)]
    elif pattern == "declining":
        return [max(0, min(1, 0.8 - (0.6 * i / n_windows) + np.random.normal(0, 0.04)))
                for i in range(n_windows)]
    elif pattern == "spike":
        series = [max(0, min(1, 0.2 + np.random.normal(0, 0.03))) for _ in range(n_windows)]
        spike_start = n_windows - 6  # spike in last 36h
        for i in range(spike_start, min(spike_start + 4, n_windows)):
            series[i] = max(0, min(1, 0.7 + np.random.normal(0, 0.05)))
        # slight decay after spike
        for i in range(spike_start + 4, n_windows):
            series[i] = max(0, min(1, 0.55 + np.random.normal(0, 0.04)))
        return series
    elif pattern == "goes_dark":
        series = [max(0, min(1, 0.5 + np.random.normal(0, 0.04))) for _ in range(n_windows)]
        # Active then drops to near-zero in last 3 windows
        for i in range(n_windows - 3, n_windows):
            series[i] = max(0, 0.02 + np.random.normal(0, 0.01))
        return series
    else:
        return [random.uniform(0.1, 0.9) for _ in range(n_windows)]


def arousal_to_float(arousal: str) -> float:
    return {"high": 0.85, "medium": 0.5, "low": 0.15}[arousal]


def compute_friction_quadrant(momentum: float, friction: float) -> str:
    high_mom = momentum > 0.5
    high_fric = friction > 0.35
    if high_mom and not high_fric:
        return "unopposed_advance"
    elif high_mom and high_fric:
        return "contested_advance"
    elif not high_mom and high_fric:
        return "successful_suppression"
    else:
        return "dead"


def make_metric(value: float, window: str, sparkline: list[float],
                ci_width: float = 0.1, baseline: str = "global") -> dict[str, Any]:
    """Create a Metric object."""
    half = ci_width / 2
    return {
        "value": round(value, 4),
        "confidence_interval": [round(max(0, value - half), 4), round(min(1, value + half), 4)],
        "baseline": baseline,
        "time_window": window,
        "sparkline": [round(v, 4) for v in sparkline[-8:]],  # last 8 points
        "source_distribution": "production",
    }


def make_momentum_extended(value: float, window: str, sparkline: list[float],
                           archetype: dict,
                           adversarial_momentum: Optional[float] = None) -> dict[str, Any]:
    """Create a MomentumExtended object.

    friction is computed from adversarial pair activity when available:
    - If this claim's cluster has an adversarial pair, friction reflects
      the opposing cluster's momentum (high opposition = high friction).
    - Otherwise, friction correlates with momentum pattern:
      spike/rising get moderate friction, stable/declining get low.
    """
    # Friction grounded in opposition signals
    if adversarial_momentum is not None:
        # Adversarial cluster momentum drives friction (0.3-0.85 range)
        friction = round(max(0.1, min(0.85, adversarial_momentum * 0.9 + random.gauss(0, 0.05))), 4)
    else:
        # No adversarial pair — friction from pattern heuristic
        pattern = archetype["momentum_pattern"]
        if pattern in ("spike", "rising"):
            friction = round(random.uniform(0.25, 0.55), 4)  # moderate — contested but not suppressed
        elif pattern == "stable":
            friction = round(random.uniform(0.10, 0.35), 4)  # low — settled
        else:  # declining, goes_dark
            friction = round(random.uniform(0.15, 0.45), 4)  # variable

    source_div = round(random.uniform(0.3, 0.95), 4)
    bridge = round(random.uniform(0.02, 0.25), 4)
    # Spikes have lower source diversity (concentrated)
    if archetype["momentum_pattern"] == "spike":
        source_div = round(random.uniform(0.15, 0.40), 4)
    m = make_metric(value, window, sparkline)
    m.update({
        "source_diversity": source_div,
        "bridge_ratio": bridge,
        "persistence_windows": archetype["persistence"],
        "friction": friction,
        "friction_quadrant": compute_friction_quadrant(value, friction),
    })
    return m


def generate_cluster_base_vectors(n_clusters: int, dim: int = 128) -> dict[str, np.ndarray]:
    """Generate well-separated base vectors for clusters."""
    vectors = {}
    for i in range(n_clusters):
        v = np.random.randn(dim)
        v = v / np.linalg.norm(v)
        vectors[f"cluster_{i}"] = v
    return vectors


def generate_2d_positions(
    clusters: list[dict],
    claims: list[dict],
    momentum_map: Optional[Dict[str, float]] = None,
) -> list[dict]:
    """Generate 2D positions for force layout. Cluster members near each other."""
    cluster_centers: dict[str, tuple[float, float]] = {}
    n_clusters = len(clusters)
    for i, c in enumerate(clusters):
        angle = 2 * np.pi * i / n_clusters
        radius = 200 + random.uniform(-30, 30)
        cluster_centers[c["id"]] = (
            300 + radius * np.cos(angle),
            250 + radius * np.sin(angle),
        )

    total_claims = len(claims)
    cluster_counts = {}
    for c in claims:
        cluster_counts[c["cluster_id"]] = cluster_counts.get(c["cluster_id"], 0) + 1

    positions = []
    for claim in claims:
        cx, cy = cluster_centers.get(claim["cluster_id"], (300, 250))
        base_momentum = momentum_map.get(claim["id"], 0.0) if momentum_map else 0.0
        noisy_momentum = round(max(-1.0, min(1.0, base_momentum + random.gauss(0, 0.08))), 3)
        
        expected_share = cluster_counts.get(claim["cluster_id"], 1) / max(1, total_claims)
        production_share = random.uniform(expected_share * 0.5, expected_share * 2.5)
        salience = round(production_share / expected_share, 3)
        
        positions.append({
            "claim_id": claim["id"],
            "x": round(cx + random.gauss(0, 35), 2),
            "y": round(cy + random.gauss(0, 35), 2),
            "momentum": noisy_momentum,
            "salience": salience,
        })
    return positions


def generate_adversarial_pairs(
    topic_id: str,
    cluster_objects: list[dict],
    archetypes: list[dict],
) -> list[dict]:
    """Generate adversarial pair data for a topic.

    Uses ADVERSARIAL_PAIR_DEFS to identify natural cluster oppositions,
    then generates momentum correlation, response lag, and mutation evidence.
    """
    pair_defs = ADVERSARIAL_PAIR_DEFS.get(topic_id, [])
    if not pair_defs:
        return []

    # Build lookup: cluster_name -> cluster object
    name_to_cluster: dict[str, dict] = {}
    for arch in archetypes:
        cid = gen_id("clu", topic_id, arch["cluster"])
        for co in cluster_objects:
            if co["id"] == cid:
                name_to_cluster[arch["cluster"]] = co
                break

    pairs = []
    for name_a, name_b in pair_defs:
        ca = name_to_cluster.get(name_a)
        cb = name_to_cluster.get(name_b)
        if not ca or not cb:
            continue

        # Momentum correlation: negative = inverse = adversarial
        correlation = round(random.uniform(-0.85, -0.35), 3)

        # Response lag — shorter for spike-pattern archetypes
        arch_a = next((a for a in archetypes if a["cluster"] == name_a), None)
        arch_b = next((a for a in archetypes if a["cluster"] == name_b), None)
        has_spike = (
            (arch_a and arch_a["momentum_pattern"] == "spike")
            or (arch_b and arch_b["momentum_pattern"] == "spike")
        )
        median_hours = random.randint(2, 12) if has_spike else random.randint(8, 48)

        if median_hours < 8:
            consistency = "high"
            interpretation = (
                "Consistent short response lag — suggests organized rapid response capability."
            )
        elif median_hours < 24:
            consistency = "medium"
            interpretation = (
                "Moderate response lag — pattern is ambiguous between organic and organized dynamics."
            )
        else:
            consistency = "low"
            interpretation = (
                "Variable long response lag — consistent with organic counter-mobilization."
            )

        # Mutation evidence — 40% chance of detection
        mutation_detected = random.random() < 0.4
        if mutation_detected:
            mutation_desc = random.choice([
                f"Cluster '{ca['label']}' adopted terminology from the counter-narrative after it gained momentum.",
                f"Framing shifted in '{ca['label']}' following emergence of counter-cluster response.",
                f"Centroid movement detected in '{cb['label']}' post-counter-emergence — possible strategic reframing.",
            ])
            mutation_conf = round(random.uniform(0.45, 0.80), 2)
        else:
            mutation_desc = "No framing shift detected in response to counter-narrative."
            mutation_conf = 0.0

        confidence = round(min(0.90, 0.55 + abs(correlation) * 0.4), 2)

        pairs.append({
            "cluster_id_a": ca["id"],
            "cluster_id_b": cb["id"],
            "label_a": ca["label"][:80],
            "label_b": cb["label"][:80],
            "momentum_correlation": correlation,
            "response_lag": {
                "median_hours": median_hours,
                "consistency": consistency,
                "interpretation": interpretation,
            },
            "mutation_evidence": {
                "detected": mutation_detected,
                "description": mutation_desc,
                "confidence": mutation_conf,
            },
            "confidence": confidence,
        })

    return pairs


def generate_events(topic_id: str, claims: list[dict], archetypes: list[dict]) -> list[dict]:
    """Generate timeline events from claim patterns."""
    events = []
    event_counter = 0

    for arch in archetypes:
        matching_claims = [c for c in claims if c["concept_id"] == arch["concept"]]
        if not matching_claims:
            continue
        representative = matching_claims[0]

        if arch["momentum_pattern"] == "spike":
            event_counter += 1
            events.append({
                "id": gen_id("evt", topic_id, str(event_counter)),
                "type": "momentum_spike",
                "timestamp": (NOW - timedelta(hours=random.randint(6, 36))).isoformat(),
                "claim_id": representative["id"],
                "slice_id": None,
                "severity": "high",
                "confidence": round(random.uniform(0.75, 0.95), 2),
                "summary": f"'{arch['text']}' accelerated from 20th to 72nd percentile in 12h. Source diversity: {'low' if arch.get('momentum_pattern') == 'spike' else 'moderate'}.",
                "detail": {"percentile_from": 20, "percentile_to": 72, "hours": 12},
            })

        if arch["momentum_pattern"] == "goes_dark":
            event_counter += 1
            events.append({
                "id": gen_id("evt", topic_id, str(event_counter)),
                "type": "claim_dark",
                "timestamp": (NOW - timedelta(hours=random.randint(2, 12))).isoformat(),
                "claim_id": representative["id"],
                "slice_id": None,
                "severity": "medium",
                "confidence": round(random.uniform(0.65, 0.85), 2),
                "summary": f"'{arch['text']}' went dark — active in last 3 windows, now zero production.",
                "detail": {"last_active_window": 3, "topic_volume_change": 0.05},
            })

        if arch["arousal"] == "high" and arch["momentum_pattern"] in ("spike", "rising"):
            event_counter += 1
            events.append({
                "id": gen_id("evt", topic_id, str(event_counter)),
                "type": "arousal_escalation",
                "timestamp": (NOW - timedelta(hours=random.randint(12, 72))).isoformat(),
                "claim_id": representative["id"],
                "slice_id": None,
                "severity": "medium",
                "confidence": round(random.uniform(0.70, 0.90), 2),
                "summary": f"'{arch['subject']}' arousal shifted low to high over 48h, semantic content stable.",
                "detail": {"arousal_from": "low", "arousal_to": "high", "hours": 48},
            })

    # Add vocabulary_rotation
    mutating_archs = [a for a in archetypes if a.get("mutation_direction", "stable") != "stable"]
    m_arch = mutating_archs[0] if mutating_archs else archetypes[0]
    matching_c = [c for c in claims if c["concept_id"] == m_arch["concept"]]
    if matching_c:
        event_counter += 1
        events.append({
            "id": gen_id("evt", topic_id, str(event_counter)),
            "type": "vocabulary_rotation",
            "timestamp": (NOW - timedelta(hours=random.randint(12, 60))).isoformat(),
            "claim_id": matching_c[0]["id"],
            "slice_id": None,
            "severity": "medium",
            "confidence": round(random.uniform(0.65, 0.85), 2),
            "summary": f"Vocabulary rotation detected in '{m_arch['subject']}': emerging terminology overlaps with adjacent narratives.",
            "detail": {"rotation_shift": 0.42, "hours": 24},
        })

    # Add a divergence shift event
    event_counter += 1
    events.append({
        "id": gen_id("evt", topic_id, str(event_counter)),
        "type": "divergence_shift",
        "timestamp": (NOW - timedelta(hours=random.randint(24, 96))).isoformat(),
        "claim_id": None,
        "slice_id": "x_platform",
        "severity": "medium",
        "confidence": round(random.uniform(0.70, 0.85), 2),
        "summary": f"X vs Reddit divergence increased 23% over 48h. Mode: information asymmetry.",
        "detail": {"jsd_change": 0.23, "hours": 48, "mode": "information_asymmetry"},
    })

    # Add a coordination flag for topics with spikes
    spike_archs = [a for a in archetypes if a["momentum_pattern"] == "spike"]
    if spike_archs:
        arch = spike_archs[0]
        matching = [c for c in claims if c["concept_id"] == arch["concept"]]
        if matching:
            event_counter += 1
            events.append({
                "id": gen_id("evt", topic_id, str(event_counter)),
                "type": "coordination_flag",
                "timestamp": (NOW - timedelta(hours=random.randint(6, 48))).isoformat(),
                "claim_id": matching[0]["id"],
                "slice_id": None,
                "severity": "high" if arch["arousal"] == "high" else "medium",
                "confidence": round(random.uniform(0.60, 0.80), 2),
                "summary": f"Near-duplicate content: {random.randint(23, 89)} similar posts from non-overlapping accounts within {random.choice([2, 3, 4, 6])}h.",
                "detail": {"signal": "near_duplicate", "count": random.randint(23, 89), "window_hours": random.choice([2, 3, 4, 6])},
            })

    # Add a lead-lag event
    event_counter += 1
    events.append({
        "id": gen_id("evt", topic_id, str(event_counter)),
        "type": "lead_lag",
        "timestamp": (NOW - timedelta(hours=random.randint(48, 120))).isoformat(),
        "claim_id": claims[0]["id"] if claims else None,
        "slice_id": None,
        "severity": "low",
        "confidence": round(random.uniform(0.55, 0.75), 2),
        "summary": f"'{claims[0]['text'][:80]}...' first detected on {random.choice(['Reddit', 'X'])}, appeared on {random.choice(['X', 'Reddit'])} {random.randint(8, 36)}h later. Fidelity: {random.randint(68, 92)}%.",
        "detail": {"source_platform": random.choice(["reddit", "x"]), "target_platform": random.choice(["x", "reddit"]), "lag_hours": random.randint(8, 36), "fidelity": round(random.uniform(0.65, 0.92), 2)},
    })

    # Add adversarial response lag events (uses existing coordination_flag type)
    adv_defs = ADVERSARIAL_PAIR_DEFS.get(topic_id, [])
    for name_a, name_b in adv_defs[:1]:  # 1 adversarial event per topic
        arch_a = next((a for a in archetypes if a["cluster"] == name_a), None)
        arch_b = next((a for a in archetypes if a["cluster"] == name_b), None)
        if arch_a and arch_b:
            lag_h = random.randint(3, 18)
            event_counter += 1
            events.append({
                "id": gen_id("evt", topic_id, str(event_counter)),
                "type": "coordination_flag",
                "timestamp": (NOW - timedelta(hours=random.randint(12, 60))).isoformat(),
                "claim_id": None,
                "slice_id": None,
                "severity": "medium" if lag_h < 8 else "low",
                "confidence": round(random.uniform(0.55, 0.80), 2),
                "summary": (
                    f"Counter-narrative response lag of {lag_h}h between "
                    f"'{arch_a['subject']}' and '{arch_b['subject']}' clusters"
                    f" — {'consistent with organized rapid response' if lag_h < 8 else 'consistent with organic counter-mobilization'}."
                ),
                "detail": {
                    "signal": "adversarial_response_lag",
                    "cluster_a": name_a,
                    "cluster_b": name_b,
                    "lag_hours": lag_h,
                },
            })

    # Sort by severity (high first) then timestamp (recent first)
    severity_order = {"high": 0, "medium": 1, "low": 2}
    events.sort(key=lambda e: (severity_order[e["severity"]], e["timestamp"]))
    events.reverse()
    events.sort(key=lambda e: severity_order[e["severity"]])

    return events


def generate_supply_chain(claim: dict, topic_id: str) -> dict:
    """Generate a supply chain for a claim."""
    platforms = ["reddit", "x", "youtube"]
    first_platform = claim.get("first_seen_platform", random.choice(platforms))
    other_platforms = [p for p in platforms if p != first_platform]

    hops = [{
        "platform": first_platform,
        "timestamp": claim["first_seen_timestamp"],
        "claim_id": claim["id"],
        "fidelity_to_origin": 1.0,
        "fidelity_to_previous": 1.0,
    }]

    if random.random() > 0.3:  # 70% chance of cross-platform hop
        second = random.choice(other_platforms)
        lag_hours = random.randint(8, 48)
        first_ts = datetime.fromisoformat(claim["first_seen_timestamp"])
        # Fidelity constraint: origin ≤ previous (each hop degrades signal)
        fidelity_prev = round(random.uniform(0.65, 0.95), 2)
        fidelity_origin = round(random.uniform(0.55, min(fidelity_prev, 0.90)), 2)
        hops.append({
            "platform": second,
            "timestamp": (first_ts + timedelta(hours=lag_hours)).isoformat(),
            "claim_id": gen_id("clm", topic_id, second, claim["text"][:20]),
            "fidelity_to_origin": fidelity_origin,
            "fidelity_to_previous": fidelity_prev,
        })

    # Varied observation boundaries — empirical honesty about what we can/can't see
    boundaries = [
        "No public antecedent detected",
        "No public antecedent detected",
        "Earliest observed instance; private channels not monitored",
        "Observation limited to public posts — DM/group chat propagation not visible",
        "Cross-platform tracking limited by API rate constraints; gaps possible",
        "First public mention; may have circulated in closed communities prior",
    ]
    boundary = boundaries[hash(claim["id"]) % len(boundaries)]

    return {
        "concept_id": claim.get("concept_id", "unknown"),
        "hops": hops,
        "observation_boundary": boundary,
    }


def generate_coordination_check() -> dict:
    """Generate coordination signal scores."""
    def signal(elevated: bool = False) -> dict:
        if elevated:
            score = round(random.uniform(0.5, 0.9), 2)
            baseline = round(random.uniform(0.1, 0.3), 2)
            return {"score": score, "organic_baseline": baseline, "severity": "high" if score > 0.7 else "medium"}
        else:
            score = round(random.uniform(0.05, 0.3), 2)
            baseline = round(random.uniform(0.1, 0.4), 2)
            return {"score": score, "organic_baseline": baseline, "severity": "low"}

    elevated = random.random() > 0.6
    # ~20% of claims show clearly no coordination (all below baseline) — honest negative result
    if random.random() < 0.2:
        return {
            "burstiness": signal(False),
            "near_duplicate": signal(False),
            "cross_platform_sync": signal(False),
            "source_diversity_anomaly": signal(False),
        }
    return {
        "burstiness": signal(elevated and random.random() > 0.5),
        "near_duplicate": signal(elevated),
        "cross_platform_sync": signal(random.random() > 0.7),
        "source_diversity_anomaly": signal(elevated and random.random() > 0.5),
    }


def generate_example_content(archetype: dict, platform: str) -> list[dict]:
    """Generate 3-5 example posts for a claim.
    Uses pre-written variations from archetype if available."""
    examples = []
    arch_variations = archetype.get("variations", [])
    if arch_variations:
        # Use pre-written variations, preferring platform matches
        platform_matches = [v for v in arch_variations if v.get("platform") == platform]
        pool = platform_matches if platform_matches else arch_variations
        for i in range(min(random.randint(3, 5), max(3, len(pool)))):
            examples.append({
                "text": pool[i % len(pool)]["text"],
                "platform": pool[i % len(pool)].get("platform", platform),
                "confidence": round(random.uniform(0.7, 0.98), 2),
                "is_influencer_framing": pool[i % len(pool)].get("platform", platform) == "youtube",
            })
    else:
        # Fallback for generic/live topics
        fallback_variations = [
            archetype["text"],
            f"Honestly, {archetype['text'].lower()}",
            f"People need to understand: {archetype['text'].lower()}",
            f"This is obvious — {archetype['assertion']}",
            f"Can't believe we're still debating this. {archetype['text']}",
        ]
        for i in range(random.randint(3, 5)):
            examples.append({
                "text": fallback_variations[i % len(fallback_variations)],
                "platform": platform,
                "confidence": round(random.uniform(0.7, 0.98), 2),
                "is_influencer_framing": platform == "youtube",
            })
    return examples


def generate_compare_data(topic_id: str, clusters: list[dict],
                          slice_a_id: str, slice_b_id: str,
                          window: str) -> dict:
    """Generate comparison data between two slices."""
    # Simulate different distributions per slice
    per_cluster = []
    for c in clusters:
        sal_a = round(random.uniform(0.05, 0.95), 4)
        sal_b = round(random.uniform(0.05, 0.95), 4)
        per_cluster.append({
            "cluster_id": c["id"],
            "label": c["label"],
            "salience_a": sal_a,
            "salience_b": sal_b,
            "arousal_a": round(random.uniform(0.1, 0.9), 2),
            "arousal_b": round(random.uniform(0.1, 0.9), 2),
            "mutation_a": random.choice(["mainstreaming", "radicalizing", "stable"]),
            "mutation_b": random.choice(["mainstreaming", "radicalizing", "stable"]),
        })

    # Compute JSD from salience distributions
    eps = 1e-10
    p = np.array([pc["salience_a"] for pc in per_cluster]) + eps
    q = np.array([pc["salience_b"] for pc in per_cluster]) + eps
    p = p / p.sum()
    q = q / q.sum()
    m = 0.5 * (p + q)
    jsd = float(0.5 * np.sum(p * np.log(p / m)) + 0.5 * np.sum(q * np.log(q / m)))
    jsd_sqrt = float(np.sqrt(max(0, jsd)))

    # Typology scores — Dirichlet distribution for independent, properly normalized scores.
    # Alpha parameters: info_asym tends highest (most common divergence mode),
    # interpretive moderate, paradigmatic rarest.
    alphas = np.array([3.0, 2.0, 1.0])  # info_asym, interpretive, paradigmatic
    raw = np.random.dirichlet(alphas)
    info_asym = round(float(raw[0]), 2)
    interpretive = round(float(raw[1]), 2)
    paradigmatic = round(float(raw[2]), 2)
    scores = {"information_asymmetry": info_asym, "interpretive": interpretive, "paradigmatic": paradigmatic}
    dominant = max(scores, key=scores.get)  # type: ignore[arg-type]

    trend = [round(jsd_sqrt + random.gauss(0, 0.03), 4) for _ in range(8)]

    # Determine slice type and labels
    GEO_LABELS = {
        "coastal_metros": "Coastal Metros",
        "heartland_metros": "Heartland",
        "urban_centers": "Urban Centers",
        "rural_adjacent": "Rural Adjacent",
    }
    is_geo = slice_a_id in GEO_LABELS or slice_b_id in GEO_LABELS
    slice_type = "geography" if is_geo else "platform"

    def _slice_label(sid: str) -> str:
        if sid in GEO_LABELS:
            return GEO_LABELS[sid]
        if "youtube" in sid:
            return "Influencer Framing (YouTube)"
        return sid.replace("_", " ").title()

    return {
        "slice_a": {
            "id": slice_a_id, "type": slice_type,
            "label": _slice_label(slice_a_id),
            "active_volume": random.randint(500, 5000),
            "meets_minimum_threshold": True,
            "base_rate_weight": round(random.uniform(0.3, 0.7), 2),
            "is_influencer_framing": "youtube" in slice_a_id,
        },
        "slice_b": {
            "id": slice_b_id, "type": slice_type,
            "label": _slice_label(slice_b_id),
            "active_volume": random.randint(500, 5000),
            "meets_minimum_threshold": True,
            "base_rate_weight": round(random.uniform(0.3, 0.7), 2),
            "is_influencer_framing": "youtube" in slice_b_id,
        },
        "divergence": {
            "jsd": round(jsd, 4),
            "jsd_sqrt": round(jsd_sqrt, 4),
            "trend": trend,
            "typology": {
                "information_asymmetry": info_asym,
                "interpretive": interpretive,
                "paradigmatic": paradigmatic,
                "dominant_mode": dominant.replace("_", " ").title(),
                "paradigmatic_caveat": paradigmatic > 0.3,
            },
        },
        "per_cluster": per_cluster,
        "arousal_comparison": {
            "slice_a_avg": round(random.uniform(0.3, 0.7), 2),
            "slice_b_avg": round(random.uniform(0.3, 0.7), 2),
        },
        "exposure_comparison": {
            "slice_a": make_metric(random.uniform(0.3, 0.8), window, trend),
            "slice_b": make_metric(random.uniform(0.3, 0.8), window, trend),
        },
    }




def _platform_presence(claim_id: str, first_seen_platform: str) -> dict:
    """Generate platform presence distribution for a claim.
    Distributional share: what fraction of this claim's volume comes from each platform."""
    PLATFORM_SLUG = {"x": "x_platform", "reddit": "reddit_platform", "youtube": "youtube_influencer"}
    rng = random.Random(hash(claim_id + "platform_presence"))
    slug = PLATFORM_SLUG.get(first_seen_platform, first_seen_platform)
    out_platforms = ["x_platform", "reddit_platform", "youtube_influencer"]
    weights = {}
    for p in out_platforms:
        weights[p] = rng.uniform(0.4, 0.85) if p == slug else rng.uniform(0.02, 0.4)
    total = sum(weights.values())
    return {k: round(v / total, 2) for k, v in weights.items()}


# ---------------------------------------------------------------------------
# IFI helper functions — temporal √JSD + Entropic Flux Direction
# ---------------------------------------------------------------------------

def _ifi_normalize(v: list) -> list:
    total = sum(v) + 1e-12
    return [x / total for x in v]

def _ifi_entropy_bits(p: list) -> float:
    """Shannon entropy in bits: H(p) = −Σ pᵢ log₂(pᵢ)"""
    import math
    p = _ifi_normalize(p)
    return -sum(x * math.log2(x + 1e-12) for x in p if x > 0)

def _ifi_jsd_sqrt(p: list, q: list) -> float:
    """√JSD between two distributions. Bounded [0,1], true metric."""
    import math
    p, q = _ifi_normalize(p), _ifi_normalize(q)
    m = [(pi + qi) / 2 for pi, qi in zip(p, q)]
    def kl(a: list, b: list) -> float:
        return sum(ai * math.log2(ai / (bi + 1e-12) + 1e-12) for ai, bi in zip(a, b) if ai > 0)
    jsd = max(0.0, 0.5 * kl(p, m) + 0.5 * kl(q, m))
    return math.sqrt(jsd)

def _ifi_flux_character(delta_h: float, threshold: float = 0.05) -> str:
    if delta_h > threshold:
        return "diversifying"
    elif delta_h < -threshold:
        return "consolidating"
    return "reshuffling"

def _ifi_window_salience(clusters: list, window: str) -> list:
    """
    Build a cluster salience vector for the given time window.
    Applies deterministic per-window perturbation that reflects realistic dynamics:
      6h  — amplifies volatile clusters (radicalizing / fragmenting)
      24h — baseline proportional to member_count (no perturbation)
      7d  — amplifies stable clusters; shrinks fragmenting
    Uses a seeded RNG so results are reproducible across calls.
    """
    base = [float(c.get("member_count", 1)) for c in clusters]
    # Seed from window name + cluster IDs so results are deterministic but topic-specific
    rng = random.Random(hash(window + "".join(c["id"] for c in clusters)))
    # Topic-specific dynamics: some topics consolidate (dominant cluster grows),
    # some diversify (volatile clusters amplified), some reshuffle (random perturbation)
    topic_seed = hash("".join(c["id"] for c in clusters)) % 3  # 0=diversify, 1=consolidate, 2=reshuffle
    if window == "6h":
        if topic_seed == 0:
            # Diversifying: amplify volatile, suppress stable
            for i, c in enumerate(clusters):
                if c.get("mutation_direction") in ("radicalizing", "fragmenting"):
                    base[i] *= rng.uniform(1.3, 1.9)
                elif c.get("mutation_direction") == "stable":
                    base[i] *= rng.uniform(0.4, 0.7)
        elif topic_seed == 1:
            # Consolidating: amplify the largest cluster, suppress others
            max_idx = max(range(len(base)), key=lambda i: base[i])
            for i in range(len(base)):
                if i == max_idx:
                    base[i] *= rng.uniform(1.8, 2.5)
                else:
                    base[i] *= rng.uniform(0.3, 0.6)
        else:
            # Reshuffling: random perturbation (some up, some down)
            for i in range(len(base)):
                base[i] *= rng.uniform(0.5, 1.5)
    elif window == "7d":
        for i, c in enumerate(clusters):
            if c.get("mutation_direction") == "stable":
                base[i] *= rng.uniform(1.4, 1.8)
            elif c.get("mutation_direction") == "fragmenting":
                base[i] *= rng.uniform(0.2, 0.5)
    # 24h — no perturbation, pure member_count baseline
    return _ifi_normalize(base)


def generate_ifi(clusters: list, window: str, coord_count: int = 0, arousal_escalating: bool = False) -> dict:
    """
    Compute IFI using temporal √JSD + ΔEntropy (Entropic Flux Direction).

    Value (0–100): √JSD(p_current, p_previous) × 100
      — magnitude of structural change in cluster-salience distribution
    flux_character: consolidating | diversifying | reshuffling
      — derived from ΔEntropy = H(p_current) − H(p_previous), zero free parameters
    flags: qualitative annotations, NOT weighted into the numeric value
    """
    window_order = ["6h", "24h", "7d"]
    idx = window_order.index(window)
    prev_window = window_order[max(0, idx - 1)]

    p = _ifi_window_salience(clusters, window)
    # For 6h (first window), compare against 7d as the "long-run baseline"
    q = _ifi_window_salience(clusters, prev_window if window != prev_window else "7d")

    jsd_sqrt_val = _ifi_jsd_sqrt(p, q)
    delta_h = _ifi_entropy_bits(p) - _ifi_entropy_bits(q)
    character = _ifi_flux_character(delta_h)

    value_100 = round(jsd_sqrt_val * 100, 1)

    # Flux character is driven purely by entropy delta — no overrides.
    # The _ifi_window_salience() perturbations already create topic-specific
    # dynamics (diversifying/consolidating/reshuffling) via the topic_seed there.

    # Trend: based on flux character + magnitude of change
    if character == "diversifying" and jsd_sqrt_val > 0.12:
        trend = "increasing"
    elif character == "consolidating" and jsd_sqrt_val > 0.12:
        trend = "decreasing"
    else:
        trend = "stable"

    # Sparkline: 12 historical readings seeded around current value
    rng = random.Random(hash(window + str(value_100) + "sparkline"))
    sparkline = [round(max(0.0, min(100.0, value_100 + rng.uniform(-12, 12))), 1) for _ in range(12)]

    # Confidence interval: bootstrap-style estimation.
    # Generate 50 perturbations of the salience distribution, compute √JSD for each,
    # then use 10th/90th percentile as CI bounds.
    n = sum(c.get("member_count", 1) for c in clusters)
    bootstrap_vals = []
    for _ in range(50):
        p_pert = [max(0.01, v + np.random.normal(0, 0.05)) for v in p]
        q_pert = [max(0.01, v + np.random.normal(0, 0.05)) for v in q]
        bootstrap_vals.append(_ifi_jsd_sqrt(p_pert, q_pert) * 100)
    bootstrap_vals.sort()
    ci_lo = max(0.0, round(bootstrap_vals[4], 1))   # 10th percentile
    ci_hi = min(100.0, round(bootstrap_vals[44], 1)) # 90th percentile

    return {
        "value": value_100,
        "trend": trend,
        "sparkline": sparkline,
        "entropy_delta": round(delta_h, 4),
        "flux_character": character,
        "flags": {
            "coordination_detected": coord_count >= 3,
            "arousal_escalating": arousal_escalating,
        },
        "temporal_window_pair": [prev_window if window != prev_window else "7d", window],
        "confidence_interval": [ci_lo, ci_hi],
    }

def generate_situations(clusters: list[dict], archetypes: list[dict], events: list[dict]) -> list[dict]:
    import random
    situations = []
    concept_to_arch = {a["concept"]: a for a in archetypes}
    for c in clusters:
        arch = concept_to_arch.get(c["concept_id"])
        if not arch: continue
        momentum = random.uniform(0.1, 0.9)
        friction = round(random.uniform(0.1, 0.9), 2)
        source_div = round(random.uniform(0.1, 0.9), 2)
        if momentum > 0.5 and c["arousal_trend"] == "warming" and friction > 0.6:
            situations.append({
                "id": gen_id("sit", c["id"], "esc"),
                "severity": "high",
                "summary": f"'{c['label']}' escalating — gaining speed, emotionally charged, actively fought over",
                "cluster_id": c["id"],
                "metric_basis": "momentum > 0.5 AND arousal = warming AND friction > 0.6"
            })
        elif c["mutation_direction"] == "mainstreaming" and arch["persistence"] > 10:
            situations.append({
                "id": gen_id("sit", c["id"], "main"),
                "severity": "medium",
                "summary": f"'{c['label']}' mainstreaming — deeply embedded",
                "cluster_id": c["id"],
                "metric_basis": "mutation = mainstreaming AND persistence > 10"
            })
        elif friction > 0.8:
            situations.append({
                "id": gen_id("sit", c["id"], "pol"),
                "severity": "high",
                "summary": f"'{c['label']}' polarizing — high friction ({friction})",
                "cluster_id": c["id"],
                "metric_basis": "friction > 0.8"
            })
        elif momentum > 0.5 and source_div < 0.3:
            situations.append({
                "id": gen_id("sit", c["id"], "acc"),
                "severity": "medium",
                "summary": f"'{c['label']}' accelerating with low source diversity",
                "cluster_id": c["id"],
                "metric_basis": "momentum > 0.5 AND source_diversity < 0.3"
            })
        elif c["mutation_direction"] == "radicalizing":
            situations.append({
                "id": gen_id("sit", c["id"], "rad"),
                "severity": "high",
                "summary": f"'{c['label']}' radicalizing — moving toward extreme framing",
                "cluster_id": c["id"],
                "metric_basis": "mutation = radicalizing"
            })
        elif momentum > 0.35:
            situations.append({
                "id": gen_id("sit", c["id"], "mon"),
                "severity": "low",
                "summary": f"'{c['label']}' under active monitoring — rising signals detected",
                "cluster_id": c["id"],
                "metric_basis": "momentum > 0.35"
            })
    severity_order = {"high": 0, "medium": 1, "low": 2}
    situations.sort(key=lambda x: severity_order[x["severity"]])
    for e in events:
        if e["type"] == "claim_dark":
            situations.append({
                "id": gen_id("sit", "dark"),
                "severity": "medium",
                "summary": f"A claim went dark — previously active, now zero production",
                "cluster_id": clusters[0]["id"] if clusters else "",
                "metric_basis": "claim_dark event detected"
            })
    situations.sort(key=lambda x: severity_order[x["severity"]])
    return situations[:5]

def generate_topic(topic_def: dict) -> None:
    """Generate all data files for a single topic."""
    topic_id = topic_def["id"]
    archetypes = topic_def["archetypes"]

    # Compute time-anchor mapping for this topic
    time_map = compute_time_mapping(archetypes)

    # Load strategic gaps for this topic
    topic_gaps = GAPS.get(topic_id, {})

    print(f"  Generating topic: {topic_def['name']} ({topic_id})")

    # Create directories
    claims_dir = DATA_DIR / "claims" / topic_id
    metrics_dir = DATA_DIR / "metrics" / topic_id
    claims_detail_dir = metrics_dir / "claims"
    compare_dir = metrics_dir / "compare"
    for d in [claims_dir, metrics_dir, claims_detail_dir, compare_dir]:
        d.mkdir(parents=True, exist_ok=True)

    # Generate base vectors per cluster
    cluster_names = list(set(a["cluster"] for a in archetypes))
    n_clusters = len(cluster_names)
    base_vectors = generate_cluster_base_vectors(n_clusters, dim=128)
    cluster_vector_map = {name: base_vectors[f"cluster_{i}"] for i, name in enumerate(cluster_names)}

    # Generate claims from archetypes — deduplicate by text
    claims = []
    _seen_texts: set[str] = set()
    for arch_idx, arch in enumerate(archetypes):
        n_instances = random.randint(12, 15)
        base_vec = cluster_vector_map[arch["cluster"]]

        for j in range(n_instances):
            platform = random.choices(
                ["x", "reddit", "youtube"],
                weights=[arch["platforms"]["x"], arch["platforms"]["reddit"], arch["platforms"]["youtube"]],
                k=1,
            )[0]

            # Use time-anchor mapping if available, else random
            if arch.get("concept") in time_map:
                base_time = time_map[arch["concept"]]
                jitter = timedelta(hours=random.gauss(0, 6))
                ts = max(NOW - timedelta(days=7), min(NOW, base_time + jitter))
                timestamp = ts.isoformat()
            else:
                days_ago = random.uniform(0, 7)
                timestamp = (NOW - timedelta(days=days_ago)).isoformat()

            claim_id = gen_id("clm", topic_id, arch["cluster"], arch["concept"], str(arch_idx), str(j))
            varied_text = vary_text(arch["text"], platform, j, arch.get("variations"))
            # Skip exact duplicate texts — same text should not produce multiple claim IDs
            text_key = varied_text.strip().lower()
            if text_key in _seen_texts:
                continue
            _seen_texts.add(text_key)
            claims.append({
                "id": claim_id,
                "text": varied_text,
                "subject": arch["subject"],
                "assertion": arch["assertion"],
                "framing": arch["framing"],
                "stance": arch["stance"],
                # Confidence is deterministic per text: same claim text = same confidence.
                # ~12% of claims get low confidence (<0.5) — triggers dimmed metrics in UI.
                # Edge cases with _force_low_confidence always get low confidence.
                "confidence": (
                    round(random.Random(hashlib.sha256(varied_text.encode()).hexdigest()).uniform(0.25, 0.42), 2)
                    if arch.get("_force_low_confidence") else (
                        round(random.Random(hashlib.sha256(varied_text.encode()).hexdigest()).uniform(0.28, 0.48), 2)
                        if (j % 8 == 7) else
                        round(random.Random(hashlib.sha256(varied_text.encode()).hexdigest()).uniform(0.6, 0.98), 2)
                    )
                ),
                "arousal": arch["arousal"],
                "register": random.choice(["vernacular", "journalistic", "academic", "meme", "formal"]),
                "cluster_id": gen_id("clu", topic_id, arch["cluster"]),
                "concept_id": arch["concept"],
                "first_seen_platform": platform,
                "first_seen_timestamp": timestamp,
                "platform_presence": _platform_presence(claim_id, platform),
                "embedding": gen_embedding(base_vec, noise_scale=0.12),
                # Extra fields for metrics computation
                "_archetype_cluster": arch["cluster"],
                "_momentum_pattern": arch["momentum_pattern"],
                "_persistence": arch["persistence"],
                "_platform": platform,
            })

    # Build cluster objects
    cluster_objects = []
    for cluster_name in cluster_names:
        cluster_claims = [c for c in claims if c["_archetype_cluster"] == cluster_name]
        arch = next(a for a in archetypes if a["cluster"] == cluster_name)
        cluster_id = gen_id("clu", topic_id, cluster_name)

        arousal_val = np.mean([arousal_to_float(c["arousal"]) for c in cluster_claims])
        mutation_dir = random.choice(["mainstreaming", "radicalizing", "fragmenting", "stable"])

        # Influencer seeding — ~40% of clusters are influencer-seeded
        is_seeded = random.random() < 0.4
        influencer_seeding = {
            "influencer_seeded": is_seeded,
            "influencer_origin_count": random.randint(2, max(2, len(cluster_claims) // 2)) if is_seeded else 0,
            "influencer_salience_contribution": round(random.uniform(0.2, 0.6), 2) if is_seeded else 0.0,
            "avg_propagation_hours": {
                "x": round(random.uniform(1.5, 8.0), 1),
                "reddit": round(random.uniform(4.0, 16.0), 1),
            } if is_seeded else {"x": 0, "reddit": 0},
        }

        cluster_objects.append({
            "id": cluster_id,
            "concept_id": arch["concept"],
            "label": smart_title(arch["cluster"]),
            "member_count": len(cluster_claims),
            "mutation_direction": mutation_dir,
            "mutation_magnitude": round(random.uniform(0.1, 0.7), 2),
            # Arousal trend correlates with momentum pattern:
            # spike/rising → 70% warming, declining → 70% cooling, stable → uniform
            "arousal_trend": (
                random.choices(["warming", "cooling", "stable"], weights=[0.70, 0.10, 0.20], k=1)[0]
                if arch["momentum_pattern"] in ("spike", "rising") else
                random.choices(["warming", "cooling", "stable"], weights=[0.10, 0.70, 0.20], k=1)[0]
                if arch["momentum_pattern"] == "declining" else
                random.choice(["warming", "cooling", "stable"])
            ),
            "arousal_value": round(float(arousal_val), 2),
            "adversarial_pairs": [],
            "influencer_seeding": influencer_seeding,
        })

    # Generate adversarial pairs and populate cluster fields
    adv_pairs = generate_adversarial_pairs(topic_id, cluster_objects, archetypes)
    for pair in adv_pairs:
        for co in cluster_objects:
            if co["id"] == pair["cluster_id_a"] and pair["cluster_id_b"] not in co["adversarial_pairs"]:
                co["adversarial_pairs"].append(pair["cluster_id_b"])
            if co["id"] == pair["cluster_id_b"] and pair["cluster_id_a"] not in co["adversarial_pairs"]:
                co["adversarial_pairs"].append(pair["cluster_id_a"])

    def _compute_influencer_impact(clusters):
        """Compute topic-level influencer impact rollup from per-cluster seeding data."""
        seeded = [c for c in clusters if c.get("influencer_seeding", {}).get("influencer_seeded")]
        total = len(clusters)
        if not seeded:
            return {
                "seeded_cluster_count": 0,
                "total_clusters": total,
                "influencer_salience_share": 0.0,
                "direction": "bottom_up",
                "avg_propagation_x": 0,
                "avg_propagation_reddit": 0,
            }
        avg_salience = sum(c["influencer_seeding"]["influencer_salience_contribution"] for c in seeded) / total
        avg_x = sum(c["influencer_seeding"]["avg_propagation_hours"]["x"] for c in seeded) / len(seeded)
        avg_r = sum(c["influencer_seeding"]["avg_propagation_hours"]["reddit"] for c in seeded) / len(seeded)
        direction = "top_down" if len(seeded) > total / 2 else "mixed" if len(seeded) > 1 else "bottom_up"
        return {
            "seeded_cluster_count": len(seeded),
            "total_clusters": total,
            "influencer_salience_share": round(avg_salience, 2),
            "direction": direction,
            "avg_propagation_x": round(avg_x, 1),
            "avg_propagation_reddit": round(avg_r, 1),
        }

    # Save extracted claims (without embedding for frontend, with for pipeline)
    frontend_claims = [{k: v for k, v in c.items()
                        if not k.startswith("_") and k != "embedding"}
                       for c in claims]
    with open(claims_dir / "extracted.json", "w") as f:
        json.dump(frontend_claims, f, indent=2)

    with open(claims_dir / "clusters.json", "w") as f:
        json.dump(cluster_objects, f, indent=2)

    # Build momentum lookup from actual momentum series (not pattern labels).
    # Each archetype gets ONE series; all claims in that archetype share the
    # same current-window value. This ensures landscape position, claim detail,
    # and topic summary all report the same momentum for a given claim.
    _archetype_momentum_series: dict[str, list[float]] = {}
    for arch in archetypes:
        _archetype_momentum_series[arch["concept"]] = generate_momentum_series(arch["momentum_pattern"])

    _momentum_map = {
        c["id"]: _archetype_momentum_series.get(c.get("concept_id", ""), [0.5])[-1]
        for c in claims
    }

    # Generate landscape data per time window
    events = generate_events(topic_id, frontend_claims, archetypes)
    for window in ["6h", "24h", "7d"]:
        positions = generate_2d_positions(cluster_objects, frontend_claims, momentum_map=_momentum_map)

        # Find top metrics from archetypes
        spike_archs = [a for a in archetypes if a["momentum_pattern"] == "spike"]
        persistent_archs = sorted(archetypes, key=lambda a: a["persistence"], reverse=True)
        high_friction_claims = [c for c in claims if random.random() > 0.5]

        top_acc_arch = spike_archs[0] if spike_archs else archetypes[0]
        top_acc_claim = next((c for c in claims if c["concept_id"] == top_acc_arch["concept"]), claims[0])
        top_acc_momentum = _archetype_momentum_series[top_acc_arch["concept"]]

        top_pers_arch = persistent_archs[0]
        top_pers_claim = next((c for c in claims if c["concept_id"] == top_pers_arch["concept"]), claims[0])

        top_fric_claim = high_friction_claims[0] if high_friction_claims else claims[0]

        high_arousal_concepts = [a for a in archetypes if a["arousal"] == "high"]
        top_arousal = high_arousal_concepts[0] if high_arousal_concepts else archetypes[0]

        mutation_archs = [a for a in archetypes if a["momentum_pattern"] in ("rising", "spike")]
        notable_mut = mutation_archs[0] if mutation_archs else None

        landscape = {
            "claims": frontend_claims,
            "clusters": cluster_objects,
            "positions": positions,
            "adversarial_pairs": adv_pairs,
            "topic_metrics": {
                "cluster_count": n_clusters,
                "contestation_level": "high" if n_clusters >= 6 else "medium" if n_clusters >= 4 else "low",
                "top_accelerating": {
                    "claim_id": top_acc_claim["id"],
                    "momentum": make_momentum_extended(
                        top_acc_momentum[-1], window, top_acc_momentum, top_acc_arch,
                    ),
                },
                "most_persistent": {
                    "claim_id": top_pers_claim["id"],
                    "persistence_windows": top_pers_arch["persistence"],
                },
                "top_friction": {
                    "claim_id": top_fric_claim["id"],
                    "friction": round(random.uniform(0.55, 0.85), 4),
                },
                "highest_arousal": {
                    "concept_id": top_arousal["concept"],
                    "arousal_trend": "warming" if top_arousal["momentum_pattern"] in ("spike", "rising") else "stable",
                },
                "notable_mutation": {
                    "concept_id": notable_mut["concept"],
                    "direction": "mainstreaming",
                } if notable_mut else None,
                "ifi": generate_ifi(
                    clusters=cluster_objects,
                    window=window,
                    coord_count=random.randint(2, 10),
                    arousal_escalating=(top_arousal["momentum_pattern"] in ("spike", "rising")),
                ),
                "situations": generate_situations(cluster_objects, archetypes, events),
                "influencer_impact": _compute_influencer_impact(cluster_objects),
            },
        }

        with open(metrics_dir / f"landscape_{window}.json", "w") as f:
            json.dump(landscape, f, indent=2)

    # Generate claim detail files for top claims (one per archetype)
    for arch in archetypes:
        matching = [c for c in claims if c["concept_id"] == arch["concept"]]
        if not matching:
            continue
        for claim in matching[:4]:
            # Use the pre-computed series for this archetype (same as landscape positions)
            momentum_series = _archetype_momentum_series[arch["concept"]]
            current_momentum = momentum_series[-1]

            detail = {
                "claim": {k: v for k, v in claim.items() if not k.startswith("_") and k != "embedding"},
                "momentum": make_momentum_extended(current_momentum, "24h", momentum_series, arch),
                "salience": make_metric(round(random.uniform(0.3, 0.9), 4), "24h", momentum_series, ci_width=0.15),
                "friction": make_metric(round(random.uniform(0.1, 0.8), 4), "24h",
                                        [round(random.uniform(0.1, 0.8), 2) for _ in range(8)]),
                "persistence": make_metric(arch["persistence"] / NUM_6H_WINDOWS, "24h",
                                           [round(i / NUM_6H_WINDOWS, 2) for i in range(8)],
                                           ci_width=0.35 if topic_gaps.get("low_persistence_data") else 0.1),
                "arousal": make_metric(arousal_to_float(arch["arousal"]), "24h",
                                       [round(arousal_to_float(arch["arousal"]) + random.gauss(0, 0.05), 2) for _ in range(8)]),
                "expressibility": make_metric(round(random.uniform(0.15, 0.65), 4), "24h",
                                              [round(random.uniform(0.15, 0.65), 2) for _ in range(8)]),
                "exposure": {
                    "production": make_metric(round(random.uniform(0.2, 0.6), 4), "24h", momentum_series),
                    "amplification": make_metric(round(random.uniform(0.3, 0.8), 4), "24h", momentum_series),
                    "estimated_exposure": make_metric(round(random.uniform(0.4, 0.95), 4), "24h", momentum_series,
                                                       ci_width=0.25),
                },
                "confidence_detail": {
                    "score": claim["confidence"],
                    "factors": random.sample(
                        # Low-confidence claims get extraction-difficulty factors
                        ["sarcasm detected", "quote-tweet ambiguity", "short content",
                         "cross-register variation", "meme reference", "implicit framing",
                         "multi-claim post — extraction uncertain"]
                        if claim["confidence"] < 0.5 else
                        ["sarcasm detected", "quote-tweet ambiguity", "short content",
                         "cross-register variation", "meme reference", "clear direct assertion"],
                        k=random.randint(2, 3) if claim["confidence"] < 0.5 else random.randint(1, 3),
                    ),
                },
                "provenance": {
                    "first_platform": claim["first_seen_platform"],
                    "first_timestamp": claim["first_seen_timestamp"],
                    "lead_lag": [
                        {"platform": p, "lag_hours": random.randint(4, 48)}
                        for p in ["x", "reddit", "youtube"]
                        if p != claim["first_seen_platform"] and random.random() > 0.4
                    ],
                },
                "supply_chain": generate_supply_chain(claim, topic_id),
                "coordination": generate_coordination_check(),
                "semantic_neighbors": [
                    {"claim_id": c["id"], "similarity": round(random.uniform(0.50, 0.82), 2)}
                    for c in random.sample(
                        [c for c in frontend_claims if c["concept_id"] != arch["concept"]],
                        min(3, len([c for c in frontend_claims if c["concept_id"] != arch["concept"]])),
                    )
                ],
                "adversarial_pairs": [
                    p for p in adv_pairs
                    if claim["cluster_id"] in (p["cluster_id_a"], p["cluster_id_b"])
                ],
                "example_content": generate_example_content(arch, claim["first_seen_platform"]),
            }
    
            with open(claims_detail_dir / f"{claim['id']}.json", "w") as f:
                json.dump(detail, f, indent=2)

    # Generate comparison data for slice pairs
    slice_pairs = [
        ("x_platform", "reddit_platform"),
        ("x_platform", "youtube_influencer"),
        ("coastal_metros", "heartland_metros"),
    ]
    # Apply strategic data gaps — skip certain compare pairs per topic
    for window in ["6h", "24h", "7d"]:
        for sa, sb in slice_pairs:
            # Skip geo comparison if topic has missing_geo_comparison gap
            if topic_gaps.get("missing_geo_comparison") and (
                sa in ("coastal_metros", "heartland_metros") or
                sb in ("coastal_metros", "heartland_metros")
            ):
                continue
            # Skip YouTube comparison if topic has missing_youtube_compare gap
            if topic_gaps.get("missing_youtube_compare") and (
                "youtube" in sa or "youtube" in sb
            ):
                continue
            # Skip Reddit comparison if topic has missing_reddit_depth gap
            if topic_gaps.get("missing_reddit_depth") and (
                "reddit" in sa or "reddit" in sb
            ):
                continue
            compare = generate_compare_data(topic_id, cluster_objects, sa, sb, window)
            filename = f"{sa}_{sb}_{window}.json"
            with open(compare_dir / filename, "w") as f:
                json.dump(compare, f, indent=2)


    # Filter events by time window — each window shows only events within its timespan
    window_deltas = {"6h": timedelta(hours=6), "24h": timedelta(hours=24), "7d": timedelta(days=7)}
    for window in ["6h", "24h", "7d"]:
        cutoff = NOW - window_deltas[window]
        window_events = [
            e for e in events
            if datetime.fromisoformat(e["timestamp"].replace("Z", "+00:00")) >= cutoff
        ]
        # Always include at least 2 events per window for UI to have content
        if len(window_events) < 2:
            window_events = sorted(events, key=lambda e: e["timestamp"], reverse=True)[:2]
        timeline = {
            "events": window_events,
            "total_count": len(window_events),
        }
        with open(metrics_dir / f"timeline_{window}.json", "w") as f:
            json.dump(timeline, f, indent=2)

    return {
        "n_claims": len(claims),
        "n_clusters": n_clusters,
        "n_events": len(events),
        "cluster_objects": cluster_objects,
        "claims": frontend_claims,
        "archetypes": archetypes,
        "events": events,
    }


def generate_topics_json(topic_results: dict) -> None:
    """Generate the Level 0 topics.json file."""
    summaries = []

    for topic_def in TOPICS:
        tid = topic_def["id"]
        result = topic_results[tid]
        archetypes = result["archetypes"]
        events = result["events"]

        spike_archs = [a for a in archetypes if a["momentum_pattern"] == "spike"]
        persistent_archs = sorted(archetypes, key=lambda a: a["persistence"], reverse=True)

        top_acc = spike_archs[0] if spike_archs else archetypes[0]
        top_pers = persistent_archs[0]

        # Key signal: highest severity event
        key_signal = None
        if events:
            top_event = events[0]
            key_signal = {
                "type": top_event["type"],
                "summary": top_event["summary"],
            }

        # Headline divergence
        jsd_val = round(random.uniform(0.3, 0.8), 2)

        summary = {
            "id": tid,
            "name": topic_def["name"],
            "cluster_count": result["n_clusters"],
            "contestation_level": "high" if result["n_clusters"] >= 6 else "medium",
            "contestation_emergence": {
                "emerged_hours_ago": random.randint(12, 72),
                "source_diversity": round(random.uniform(0.3, 0.8), 2),
            } if random.random() > 0.5 else None,
            "headline_divergence": {
                "jsd": jsd_val,
                "dominant_typology": random.choice(["Information Asymmetry", "Interpretive", "Paradigmatic"]),
                "trend": random.choice(["increasing", "stable", "decreasing"]),
            },
            "top_accelerating_claim": {
                "text": top_acc["text"],
                "momentum": round(random.uniform(0.5, 0.9), 2),
                "source_diversity": round(random.uniform(0.2, 0.8), 2),
            },
            "most_persistent_claim": {
                "text": top_pers["text"],
                "persistence_windows": top_pers["persistence"],
            },
            "key_signal": key_signal,
            "activity_sparkline": [round(random.uniform(0.2, 0.9), 2) for _ in range(12)],
        }
        
        landscape_24h_path = DATA_DIR / "metrics" / tid / "landscape_24h.json"
        ifi_val = None
        top_sit = None
        if landscape_24h_path.exists():
            with open(landscape_24h_path) as f:
                l24 = json.load(f)
                ifi = l24.get("topic_metrics", {}).get("ifi")
                if ifi:
                    ifi_val = {"value": ifi["value"], "trend": ifi["trend"]}
                sits = l24.get("topic_metrics", {}).get("situations", [])
                if sits:
                    top_sit = {"summary": sits[0]["summary"], "severity": sits[0]["severity"]}
        summary["ifi"] = ifi_val
        summary["top_situation"] = top_sit

        # Pull influencer_impact from landscape data
        influencer_impact = None
        if landscape_24h_path.exists():
            with open(landscape_24h_path) as f2:
                l24_2 = json.load(f2)
                influencer_impact = l24_2.get("topic_metrics", {}).get("influencer_impact")
        summary["influencer_impact"] = influencer_impact
        # Strategic confidence variation — reflects real data coverage limitations
        # High confidence: topics with high volume + clear language + multi-platform coverage
        # Medium: topics with coded language, sarcasm, or uneven platform coverage
        # Lower: niche/emerging topics with limited data volume
        TOPIC_CONFIDENCE = {
            "immigration":           (0.82, 0.91),  # high volume, multi-platform, clear stances
            "israel-palestine":      (0.74, 0.83),  # high volume but coded language, sarcasm, context-dependent
            "war-on-iran":           (0.71, 0.80),  # fast-moving, lots of unverified claims
            "inflation-cost-of-living": (0.80, 0.89),  # clear economic language, good coverage
            "housing-crisis":        (0.77, 0.86),  # good data but regional variation hard to capture
            "ai-workplace":          (0.75, 0.84),  # mixed technical/political discourse
            "crypto-digital-money":  (0.68, 0.77),  # heavy jargon, bot activity, extraction harder
            "ai-bubble":             (0.70, 0.79),  # financial + tech crossover, nuanced framing
            "ozempic-glp1":          (0.58, 0.67),  # health misinformation hard to classify, limited political discourse
            "dei-rollbacks":         (0.55, 0.65),  # corporate + political, lots of coded language, sparse data
        }
        # Override with strategic gap data if present (e.g., crypto has known bot activity)
        topic_gaps = GAPS.get(tid, {})
        if "low_system_confidence" in topic_gaps:
            lo, hi = topic_gaps["low_system_confidence"]
        else:
            lo, hi = TOPIC_CONFIDENCE.get(tid, (0.72, 0.85))
        summary["system_confidence"] = round(random.uniform(lo, hi), 2)

        summaries.append(summary)

    with open(DATA_DIR / "topics.json", "w") as f:
        json.dump(summaries, f, indent=2)
    print(f"  Generated topics.json with {len(summaries)} topics")


def _make_generic_topic(topic_id: str, name: str, query: str) -> dict:
    """Create a generic 4-cluster topic definition for arbitrary new topics.
    Used in synthetic fallback mode for the Live Topic Input demo flow."""
    subject = query or name
    return {
        "id": topic_id,
        "name": name,
        "archetypes": [
            {
                "text": f"{subject} requires urgent collective action to address its root causes",
                "subject": subject, "assertion": "requires urgent collective action",
                "framing": "urgency", "stance": "pro", "arousal": "high",
                "cluster": f"{topic_id}-action", "concept": f"{topic_id}-action",
                "platforms": {"x": 0.50, "reddit": 0.30, "youtube": 0.20},
                "momentum_pattern": "rising", "persistence": 8,
            },
            {
                "text": f"Proposed interventions on {subject} will create worse problems than they solve",
                "subject": subject, "assertion": "interventions cause more harm",
                "framing": "unintended consequences", "stance": "anti", "arousal": "medium",
                "cluster": f"{topic_id}-skeptic", "concept": f"{topic_id}-skeptic",
                "platforms": {"x": 0.55, "reddit": 0.20, "youtube": 0.25},
                "momentum_pattern": "stable", "persistence": 10,
            },
            {
                "text": f"The mainstream narrative around {subject} ignores crucial evidence and perspectives",
                "subject": subject, "assertion": "mainstream framing is misleading",
                "framing": "counter-narrative", "stance": "anti", "arousal": "high",
                "cluster": f"{topic_id}-counter", "concept": f"{topic_id}-counter",
                "platforms": {"x": 0.60, "reddit": 0.15, "youtube": 0.25},
                "momentum_pattern": "spike", "persistence": 4,
            },
            {
                "text": f"Evidence-based reform on {subject} should prioritize measurable outcomes over ideology",
                "subject": subject, "assertion": "evidence-based approach is optimal",
                "framing": "pragmatism", "stance": "neutral", "arousal": "low",
                "cluster": f"{topic_id}-pragmatic", "concept": f"{topic_id}-pragmatic",
                "platforms": {"x": 0.20, "reddit": 0.60, "youtube": 0.20},
                "momentum_pattern": "stable", "persistence": 12,
            },
        ],
    }


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Generate synthetic narrative monitoring data")
    parser.add_argument(
        "--topic", type=str, default=None,
        help="Generate only this topic by ID. If ID not in predefined list, a generic template is used.",
    )
    parser.add_argument(
        "--name", type=str, default=None,
        help="Display name for the topic (used with --topic for new topics)",
    )
    parser.add_argument(
        "--query", type=str, default=None,
        help="Search query / subject description (used with --topic for new topics)",
    )
    args = parser.parse_args()

    print("Generating synthetic data for Narrative Monitoring System...")
    print(f"  Output directory: {DATA_DIR}")
    print()

    # Ensure data directories exist
    for d in [DATA_DIR / "raw", DATA_DIR / "claims", DATA_DIR / "metrics"]:
        d.mkdir(parents=True, exist_ok=True)

    # Determine which topics to generate
    if args.topic:
        predefined = [t for t in TOPICS if t["id"] == args.topic]
        if predefined:
            topics_to_generate = predefined
            print(f"  Mode: single topic (predefined) — {args.topic}")
        else:
            name = args.name or args.topic.replace("-", " ").title()
            topics_to_generate = [_make_generic_topic(args.topic, name, args.query or name)]
            print(f"  Mode: single topic (generic template) — {args.topic} / {name}")
    else:
        topics_to_generate = TOPICS
        print(f"  Mode: all {len(TOPICS)} topics")

    print()

    topic_results = {}
    for topic_def in topics_to_generate:
        print(f"  Generating: {topic_def['id']} — {topic_def['name']}")
        result = generate_topic(topic_def)
        topic_results[topic_def["id"]] = result
        print(f"    -> {result['n_claims']} claims, {result['n_clusters']} clusters, {result['n_events']} events")
        print()

    # If generating a single topic, build its TopicSummary directly and merge into existing topics.json
    if args.topic:
        topic_def = topics_to_generate[0]
        result = topic_results[args.topic]
        archetypes = result["archetypes"]
        events = result["events"]
        spike_archs = [a for a in archetypes if a["momentum_pattern"] == "spike"]
        persistent_archs = sorted(archetypes, key=lambda a: a["persistence"], reverse=True)
        top_acc = spike_archs[0] if spike_archs else archetypes[0]
        top_pers = persistent_archs[0]
        key_signal = None
        if events:
            top_event = events[0]
            key_signal = {"type": top_event["type"], "summary": top_event["summary"]}
        new_summary = {
            "id": args.topic,
            "name": topic_def["name"],
            "cluster_count": result["n_clusters"],
            "contestation_level": "high" if result["n_clusters"] >= 6 else "medium",
            "contestation_emergence": {
                "emerged_hours_ago": random.randint(12, 72),
                "source_diversity": round(random.uniform(0.3, 0.8), 2),
            } if random.random() > 0.5 else None,
            "headline_divergence": {
                "jsd": round(random.uniform(0.3, 0.8), 2),
                "dominant_typology": random.choice(["Information Asymmetry", "Interpretive", "Paradigmatic"]),
                "trend": random.choice(["increasing", "stable", "decreasing"]),
            },
            "top_accelerating_claim": {
                "text": top_acc["text"],
                "momentum": round(random.uniform(0.5, 0.9), 2),
                "source_diversity": round(random.uniform(0.2, 0.8), 2),
            },
            "most_persistent_claim": {
                "text": top_pers["text"],
                "persistence_windows": top_pers["persistence"],
            },
            "key_signal": key_signal,
            "activity_sparkline": [round(random.uniform(0.2, 0.9), 2) for _ in range(12)],
        }
        
        landscape_24h_path = DATA_DIR / "metrics" / args.topic / "landscape_24h.json"
        ifi_val = None
        top_sit = None
        if landscape_24h_path.exists():
            with open(landscape_24h_path) as f:
                l24 = json.load(f)
                ifi = l24.get("topic_metrics", {}).get("ifi")
                if ifi:
                    ifi_val = {"value": ifi["value"], "trend": ifi["trend"]}
                sits = l24.get("topic_metrics", {}).get("situations", [])
                if sits:
                    top_sit = {"summary": sits[0]["summary"], "severity": sits[0]["severity"]}
        new_summary["ifi"] = ifi_val
        new_summary["top_situation"] = top_sit

        # Pull influencer_impact from landscape data
        influencer_impact = None
        if landscape_24h_path.exists():
            with open(landscape_24h_path) as f3:
                l24_3 = json.load(f3)
                influencer_impact = l24_3.get("topic_metrics", {}).get("influencer_impact")
        new_summary["influencer_impact"] = influencer_impact

        # System confidence — same logic as generate_topics_json
        TOPIC_CONFIDENCE_SINGLE = {
            "immigration":           (0.82, 0.91),
            "israel-palestine":      (0.74, 0.83),
            "war-on-iran":           (0.71, 0.80),
            "inflation-cost-of-living": (0.80, 0.89),
            "housing-crisis":        (0.77, 0.86),
            "ai-workplace":          (0.75, 0.84),
            "crypto-digital-money":  (0.68, 0.77),
            "ai-bubble":             (0.70, 0.79),
            "ozempic-glp1":          (0.58, 0.67),
            "dei-rollbacks":         (0.55, 0.65),
        }
        topic_gaps = GAPS.get(args.topic, {})
        if "low_system_confidence" in topic_gaps:
            lo, hi = topic_gaps["low_system_confidence"]
        else:
            lo, hi = TOPIC_CONFIDENCE_SINGLE.get(args.topic, (0.72, 0.85))
        new_summary["system_confidence"] = round(random.uniform(lo, hi), 2)

        # Merge into existing topics.json
        topics_path = DATA_DIR / "topics.json"
        existing: list = []
        if topics_path.exists():
            with open(topics_path) as f:
                existing = json.load(f)
        existing = [t for t in existing if t["id"] != args.topic]
        existing.append(new_summary)
        with open(topics_path, "w") as f:
            json.dump(existing, f, indent=2)
        print(f"  Merged into topics.json ({len(existing)} total topics)")
    else:
        generate_topics_json(topic_results)

    print()
    print("Done!")
    if args.topic:
        print(f"  Generated: data/metrics/{args.topic}/landscape_24h.json")
    else:
        print("  Verify: ls data/topics.json data/metrics/*/landscape_24h.json")


if __name__ == "__main__":
    main()
