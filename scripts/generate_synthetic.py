#!/usr/bin/env python3
"""
Synthetic Data Generator for Narrative Monitoring System.

Generates realistic demo data for 4 topics across 3 platforms (X, Reddit, YouTube).
Produces all JSON files the frontend needs, matching TypeScript type contracts exactly.

No API keys required. Uses numpy for synthetic embeddings.

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
# Topic Definitions — each chosen to exercise specific metrics
# ============================================================================

TOPICS = [
    {
        "id": "ai-regulation",
        "name": "AI Regulation",
        "archetypes": [
            # Pro-regulation cluster
            {"text": "AI systems require government regulation to prevent harm to society",
             "subject": "AI regulation", "assertion": "government regulation is necessary",
             "framing": "public safety", "stance": "pro", "arousal": "medium",
             "cluster": "pro-regulation", "concept": "regulation-needed",
             "platforms": {"x": 0.35, "reddit": 0.40, "youtube": 0.25},
             "momentum_pattern": "stable", "persistence": 12},
            {"text": "Unregulated AI development poses existential risks that demand immediate policy action",
             "subject": "AI existential risk", "assertion": "AI poses existential risks requiring urgent regulation",
             "framing": "existential threat", "stance": "pro", "arousal": "high",
             "cluster": "pro-regulation", "concept": "regulation-needed",
             "platforms": {"x": 0.50, "reddit": 0.20, "youtube": 0.30},
             "momentum_pattern": "spike", "persistence": 4},
            {"text": "AI companies cannot be trusted to self-regulate given profit incentives",
             "subject": "AI self-regulation", "assertion": "self-regulation fails due to profit motive",
             "framing": "corporate distrust", "stance": "pro", "arousal": "medium",
             "cluster": "pro-regulation", "concept": "regulation-needed",
             "platforms": {"x": 0.45, "reddit": 0.45, "youtube": 0.10},
             "momentum_pattern": "rising", "persistence": 8},

            # Anti-regulation cluster
            {"text": "AI regulation will stifle innovation and put domestic companies at a competitive disadvantage",
             "subject": "AI regulation", "assertion": "regulation harms innovation and competitiveness",
             "framing": "innovation vs safety", "stance": "anti", "arousal": "medium",
             "cluster": "anti-regulation", "concept": "regulation-harmful",
             "platforms": {"x": 0.50, "reddit": 0.25, "youtube": 0.25},
             "momentum_pattern": "stable", "persistence": 14},
            {"text": "Current AI regulatory frameworks are outdated and designed for narrow AI, not general-purpose systems",
             "subject": "AI regulatory frameworks", "assertion": "existing frameworks are obsolete",
             "framing": "regulatory lag", "stance": "anti", "arousal": "low",
             "cluster": "anti-regulation", "concept": "regulation-harmful",
             "platforms": {"x": 0.20, "reddit": 0.30, "youtube": 0.50},
             "momentum_pattern": "stable", "persistence": 10},

            # Open source cluster
            {"text": "Open source AI development is essential to prevent concentration of AI power in large corporations",
             "subject": "open source AI", "assertion": "open source prevents power concentration",
             "framing": "power distribution", "stance": "pro", "arousal": "medium",
             "cluster": "open-source", "concept": "open-source-ai",
             "platforms": {"x": 0.30, "reddit": 0.60, "youtube": 0.10},
             "momentum_pattern": "rising", "persistence": 6},
            {"text": "Open source AI models enable dangerous capabilities to be freely distributed without safeguards",
             "subject": "open source AI safety", "assertion": "open source AI enables dangerous access",
             "framing": "security risk", "stance": "anti", "arousal": "high",
             "cluster": "anti-open-source", "concept": "open-source-danger",
             "platforms": {"x": 0.55, "reddit": 0.25, "youtube": 0.20},
             "momentum_pattern": "spike", "persistence": 3},

            # Targeted regulation cluster
            {"text": "AI regulation should target specific harms rather than impose blanket restrictions",
             "subject": "AI regulation approach", "assertion": "targeted regulation is better than blanket bans",
             "framing": "precision regulation", "stance": "neutral", "arousal": "low",
             "cluster": "targeted-regulation", "concept": "targeted-approach",
             "platforms": {"x": 0.15, "reddit": 0.65, "youtube": 0.20},
             "momentum_pattern": "rising", "persistence": 9},

            # AI jobs cluster
            {"text": "AI will eliminate millions of jobs and governments must prepare workforce transition programs",
             "subject": "AI and employment", "assertion": "AI will cause mass job displacement",
             "framing": "economic disruption", "stance": "pro", "arousal": "high",
             "cluster": "ai-jobs", "concept": "job-displacement",
             "platforms": {"x": 0.60, "reddit": 0.20, "youtube": 0.20},
             "momentum_pattern": "spike", "persistence": 5},

            # Silence target — this claim goes dark
            {"text": "AI regulation should be modeled after pharmaceutical oversight with staged approval processes",
             "subject": "AI regulatory model", "assertion": "pharmaceutical model should apply to AI",
             "framing": "established precedent", "stance": "pro", "arousal": "low",
             "cluster": "pharma-model", "concept": "pharma-regulation",
             "platforms": {"x": 0.30, "reddit": 0.60, "youtube": 0.10},
             "momentum_pattern": "goes_dark", "persistence": 6},
        ],
    },
    {
        "id": "immigration-policy",
        "name": "Immigration Policy",
        "archetypes": [
            {"text": "Immigration strengthens the economy through labor force growth and entrepreneurship",
             "subject": "immigration economics", "assertion": "immigration is economically beneficial",
             "framing": "economic growth", "stance": "pro", "arousal": "low",
             "cluster": "pro-immigration-economic", "concept": "immigration-benefits",
             "platforms": {"x": 0.25, "reddit": 0.55, "youtube": 0.20},
             "momentum_pattern": "stable", "persistence": 14},
            {"text": "Unchecked immigration undermines wages for native workers and strains public services",
             "subject": "immigration impact", "assertion": "immigration harms native workers and services",
             "framing": "economic burden", "stance": "anti", "arousal": "high",
             "cluster": "anti-immigration-economic", "concept": "immigration-harms",
             "platforms": {"x": 0.60, "reddit": 0.15, "youtube": 0.25},
             "momentum_pattern": "rising", "persistence": 12},
            {"text": "Border security is a fundamental sovereign right and must be enforced strictly",
             "subject": "border security", "assertion": "strict border enforcement is essential",
             "framing": "national sovereignty", "stance": "anti", "arousal": "high",
             "cluster": "border-security", "concept": "strict-enforcement",
             "platforms": {"x": 0.55, "reddit": 0.20, "youtube": 0.25},
             "momentum_pattern": "spike", "persistence": 8},
            {"text": "Immigration policy should prioritize humanitarian obligations and asylum rights",
             "subject": "asylum policy", "assertion": "humanitarian obligations must come first",
             "framing": "human rights", "stance": "pro", "arousal": "medium",
             "cluster": "humanitarian", "concept": "humanitarian-priority",
             "platforms": {"x": 0.30, "reddit": 0.50, "youtube": 0.20},
             "momentum_pattern": "stable", "persistence": 10},
            {"text": "A path to citizenship for undocumented immigrants is both morally right and economically sound",
             "subject": "citizenship pathway", "assertion": "citizenship path is moral and practical",
             "framing": "integration", "stance": "pro", "arousal": "medium",
             "cluster": "pathway-citizenship", "concept": "citizenship-path",
             "platforms": {"x": 0.35, "reddit": 0.45, "youtube": 0.20},
             "momentum_pattern": "declining", "persistence": 7},
            {"text": "Current immigration levels are part of a deliberate agenda to change national demographics",
             "subject": "immigration conspiracy", "assertion": "immigration is a demographic replacement scheme",
             "framing": "conspiracy", "stance": "anti", "arousal": "high",
             "cluster": "replacement-theory", "concept": "demographic-replacement",
             "platforms": {"x": 0.70, "reddit": 0.10, "youtube": 0.20},
             "momentum_pattern": "spike", "persistence": 3},
            {"text": "Immigration reform should focus on skills-based selection to match labor market needs",
             "subject": "immigration reform", "assertion": "skills-based selection optimizes outcomes",
             "framing": "pragmatic reform", "stance": "neutral", "arousal": "low",
             "cluster": "skills-based", "concept": "merit-immigration",
             "platforms": {"x": 0.20, "reddit": 0.50, "youtube": 0.30},
             "momentum_pattern": "rising", "persistence": 9},
            {"text": "Immigrants commit crimes at lower rates than native-born citizens according to research",
             "subject": "immigration and crime", "assertion": "immigrants have lower crime rates",
             "framing": "evidence-based", "stance": "pro", "arousal": "low",
             "cluster": "crime-stats", "concept": "immigration-safety",
             "platforms": {"x": 0.30, "reddit": 0.60, "youtube": 0.10},
             "momentum_pattern": "goes_dark", "persistence": 5},
        ],
    },
    {
        "id": "israel-palestine",
        "name": "Israel-Palestine Conflict",
        "archetypes": [
            {"text": "Israel has the right to defend itself against terrorist attacks on its civilians",
             "subject": "Israel self-defense", "assertion": "military response to terrorism is justified",
             "framing": "self-defense", "stance": "pro", "arousal": "high",
             "cluster": "israel-defense", "concept": "right-to-defend",
             "platforms": {"x": 0.50, "reddit": 0.20, "youtube": 0.30},
             "momentum_pattern": "stable", "persistence": 14},
            {"text": "The humanitarian crisis in Gaza constitutes a violation of international law",
             "subject": "Gaza humanitarian crisis", "assertion": "military actions violate international law",
             "framing": "international law", "stance": "anti", "arousal": "high",
             "cluster": "humanitarian-crisis", "concept": "gaza-crisis",
             "platforms": {"x": 0.40, "reddit": 0.40, "youtube": 0.20},
             "momentum_pattern": "rising", "persistence": 12},
            {"text": "Media coverage of the conflict is systematically biased against Israel",
             "subject": "media bias", "assertion": "media is anti-Israel biased",
             "framing": "media critique", "stance": "pro", "arousal": "high",
             "cluster": "media-bias-pro", "concept": "media-bias",
             "platforms": {"x": 0.60, "reddit": 0.15, "youtube": 0.25},
             "momentum_pattern": "spike", "persistence": 6},
            {"text": "A two-state solution remains the only viable path to lasting peace",
             "subject": "peace process", "assertion": "two-state solution is necessary",
             "framing": "diplomatic resolution", "stance": "neutral", "arousal": "low",
             "cluster": "two-state", "concept": "two-state-solution",
             "platforms": {"x": 0.20, "reddit": 0.50, "youtube": 0.30},
             "momentum_pattern": "declining", "persistence": 10},
            {"text": "Western governments are complicit in the crisis through continued arms sales and diplomatic support",
             "subject": "Western complicity", "assertion": "arms sales make Western nations complicit",
             "framing": "accountability", "stance": "anti", "arousal": "high",
             "cluster": "western-complicity", "concept": "complicity",
             "platforms": {"x": 0.45, "reddit": 0.35, "youtube": 0.20},
             "momentum_pattern": "spike", "persistence": 5},
            {"text": "Both sides have committed atrocities and moral absolutism prevents productive dialogue",
             "subject": "conflict analysis", "assertion": "moral absolutism is counterproductive",
             "framing": "nuanced analysis", "stance": "neutral", "arousal": "low",
             "cluster": "both-sides", "concept": "nuanced-view",
             "platforms": {"x": 0.15, "reddit": 0.65, "youtube": 0.20},
             "momentum_pattern": "rising", "persistence": 8},
        ],
    },
    {
        "id": "climate-policy",
        "name": "Climate Policy",
        "archetypes": [
            {"text": "Rapid transition to renewable energy is essential to avoid catastrophic climate outcomes",
             "subject": "energy transition", "assertion": "rapid renewable transition is essential",
             "framing": "climate urgency", "stance": "pro", "arousal": "medium",
             "cluster": "rapid-transition", "concept": "energy-transition",
             "platforms": {"x": 0.35, "reddit": 0.40, "youtube": 0.25},
             "momentum_pattern": "stable", "persistence": 14},
            {"text": "Climate alarmism exaggerates risks and the proposed policies would devastate the economy",
             "subject": "climate policy economics", "assertion": "climate policies are economically destructive",
             "framing": "economic realism", "stance": "anti", "arousal": "medium",
             "cluster": "climate-skeptic", "concept": "policy-harm",
             "platforms": {"x": 0.55, "reddit": 0.15, "youtube": 0.30},
             "momentum_pattern": "stable", "persistence": 12},
            {"text": "Nuclear energy should be central to climate policy as the only scalable clean baseload power",
             "subject": "nuclear energy", "assertion": "nuclear is essential for climate goals",
             "framing": "pragmatic environmentalism", "stance": "pro", "arousal": "low",
             "cluster": "nuclear-advocacy", "concept": "nuclear-power",
             "platforms": {"x": 0.25, "reddit": 0.55, "youtube": 0.20},
             "momentum_pattern": "rising", "persistence": 10},
            {"text": "Carbon capture technology is a fossil fuel industry distraction from real emissions reduction",
             "subject": "carbon capture", "assertion": "carbon capture delays real climate action",
             "framing": "greenwashing", "stance": "anti", "arousal": "medium",
             "cluster": "anti-ccs", "concept": "ccs-critique",
             "platforms": {"x": 0.40, "reddit": 0.45, "youtube": 0.15},
             "momentum_pattern": "spike", "persistence": 4},
            {"text": "Individual carbon footprint reduction is meaningless compared to corporate and industrial emissions",
             "subject": "emissions responsibility", "assertion": "corporate emissions dwarf individual impact",
             "framing": "systemic critique", "stance": "pro", "arousal": "medium",
             "cluster": "corporate-responsibility", "concept": "corporate-emissions",
             "platforms": {"x": 0.50, "reddit": 0.35, "youtube": 0.15},
             "momentum_pattern": "rising", "persistence": 8},
            {"text": "Climate change is a natural cyclical phenomenon and human contribution is overstated",
             "subject": "climate science", "assertion": "human-caused climate change is exaggerated",
             "framing": "scientific skepticism", "stance": "anti", "arousal": "low",
             "cluster": "denialism", "concept": "natural-cycles",
             "platforms": {"x": 0.45, "reddit": 0.10, "youtube": 0.45},
             "momentum_pattern": "declining", "persistence": 6},
            {"text": "Climate justice requires wealthy nations to fund adaptation in developing countries",
             "subject": "climate justice", "assertion": "wealthy nations owe climate debt to developing world",
             "framing": "global equity", "stance": "pro", "arousal": "medium",
             "cluster": "climate-justice", "concept": "climate-equity",
             "platforms": {"x": 0.30, "reddit": 0.40, "youtube": 0.30},
             "momentum_pattern": "goes_dark", "persistence": 7},
        ],
    },
]

# Adversarial pair definitions — hand-picked per topic for realistic demo data
ADVERSARIAL_PAIR_DEFS: dict[str, list[tuple[str, str]]] = {
    "ai-regulation": [
        ("pro-regulation", "anti-regulation"),
        ("open-source", "anti-open-source"),
    ],
    "immigration-policy": [
        ("pro-immigration-economic", "anti-immigration-economic"),
        ("humanitarian", "border-security"),
    ],
    "israel-palestine": [
        ("israel-defense", "humanitarian-crisis"),
        ("media-bias-pro", "western-complicity"),
    ],
    "climate-policy": [
        ("rapid-transition", "climate-skeptic"),
    ],
}

# Time configuration
NOW = datetime(2026, 3, 10, 12, 0, 0, tzinfo=timezone.utc)
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
                           archetype: dict) -> dict[str, Any]:
    """Create a MomentumExtended object."""
    friction = round(random.uniform(0.1, 0.8), 4)
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

    positions = []
    for claim in claims:
        cx, cy = cluster_centers.get(claim["cluster_id"], (300, 250))
        base_momentum = momentum_map.get(claim["id"], 0.0) if momentum_map else 0.0
        # Add small per-claim noise so same-archetype claims aren't identical
        noisy_momentum = round(max(-1.0, min(1.0, base_momentum + random.gauss(0, 0.08))), 3)
        positions.append({
            "claim_id": claim["id"],
            "x": round(cx + random.gauss(0, 35), 2),
            "y": round(cy + random.gauss(0, 35), 2),
            "momentum": noisy_momentum,
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
                f"Cluster '{ca['label'][:40]}' adopted terminology from the counter-narrative after it gained momentum.",
                f"Framing shifted in '{ca['label'][:40]}' following emergence of counter-cluster response.",
                f"Centroid movement detected in '{cb['label'][:40]}' post-counter-emergence — possible strategic reframing.",
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
                "summary": f"'{arch['text'][:60]}...' accelerated from 20th to 72nd percentile in 12h. Source diversity: {'low' if arch.get('momentum_pattern') == 'spike' else 'moderate'}.",
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
                "summary": f"'{arch['text'][:50]}...' went dark — active in last 3 windows, now zero production.",
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
                "summary": f"Near-duplicate content: 47 similar posts from non-overlapping accounts within 3h.",
                "detail": {"signal": "near_duplicate", "count": 47, "window_hours": 3},
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
        "summary": f"'{claims[0]['text'][:40]}...' first detected on Reddit, appeared on X 22h later. Fidelity: 81%.",
        "detail": {"source_platform": "reddit", "target_platform": "x", "lag_hours": 22, "fidelity": 0.81},
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
                    f"'{arch_a['subject'][:30]}' and '{arch_b['subject'][:30]}' clusters"
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
        hops.append({
            "platform": second,
            "timestamp": (first_ts + timedelta(hours=lag_hours)).isoformat(),
            "claim_id": gen_id("clm", topic_id, second, claim["text"][:20]),
            "fidelity_to_origin": round(random.uniform(0.60, 0.92), 2),
            "fidelity_to_previous": round(random.uniform(0.65, 0.95), 2),
        })

    return {
        "concept_id": claim.get("concept_id", "unknown"),
        "hops": hops,
        "observation_boundary": "No public antecedent detected",
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
    return {
        "burstiness": signal(elevated and random.random() > 0.5),
        "near_duplicate": signal(elevated),
        "cross_platform_sync": signal(random.random() > 0.7),
        "source_diversity_anomaly": signal(elevated and random.random() > 0.5),
    }


def generate_example_content(archetype: dict, platform: str) -> list[dict]:
    """Generate 3-5 example posts for a claim."""
    examples = []
    variations = [
        archetype["text"],
        f"Honestly, {archetype['text'].lower()}",
        f"People need to understand: {archetype['text'].lower()}",
        f"This is obvious — {archetype['assertion']}",
        f"Can't believe we're still debating this. {archetype['text']}",
    ]
    for i in range(random.randint(3, 5)):
        examples.append({
            "text": variations[i % len(variations)],
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

    # Typology scores
    info_asym = round(random.uniform(0.3, 0.8), 2)
    interpretive = round(random.uniform(0.1, 0.5), 2)
    paradigmatic = round(max(0, 1.0 - info_asym - interpretive), 2)
    scores = {"information_asymmetry": info_asym, "interpretive": interpretive, "paradigmatic": paradigmatic}
    dominant = max(scores, key=scores.get)  # type: ignore[arg-type]

    trend = [round(jsd_sqrt + random.gauss(0, 0.03), 4) for _ in range(8)]

    return {
        "slice_a": {
            "id": slice_a_id, "type": "platform",
            "label": slice_a_id.replace("_", " ").title(),
            "active_volume": random.randint(500, 5000),
            "meets_minimum_threshold": True,
            "base_rate_weight": round(random.uniform(0.3, 0.7), 2),
            "is_influencer_framing": "youtube" in slice_a_id,
        },
        "slice_b": {
            "id": slice_b_id, "type": "platform",
            "label": "Influencer Framing (YouTube)" if "youtube" in slice_b_id
                     else slice_b_id.replace("_", " ").title(),
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


def generate_topic(topic_def: dict) -> None:
    """Generate all data files for a single topic."""
    topic_id = topic_def["id"]
    archetypes = topic_def["archetypes"]

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

    # Generate claims from archetypes
    claims = []
    for arch in archetypes:
        n_instances = random.randint(15, 45)
        base_vec = cluster_vector_map[arch["cluster"]]

        for j in range(n_instances):
            platform = random.choices(
                ["x", "reddit", "youtube"],
                weights=[arch["platforms"]["x"], arch["platforms"]["reddit"], arch["platforms"]["youtube"]],
                k=1,
            )[0]

            days_ago = random.uniform(0, 7)
            timestamp = (NOW - timedelta(days=days_ago)).isoformat()

            claim_id = gen_id("clm", topic_id, arch["cluster"], str(j))
            claims.append({
                "id": claim_id,
                "text": arch["text"],
                "subject": arch["subject"],
                "assertion": arch["assertion"],
                "framing": arch["framing"],
                "stance": arch["stance"],
                "confidence": round(random.uniform(0.6, 0.98), 2),
                "arousal": arch["arousal"],
                "register": random.choice(["vernacular", "journalistic", "academic", "meme", "formal"]),
                "cluster_id": gen_id("clu", topic_id, arch["cluster"]),
                "concept_id": arch["concept"],
                "first_seen_platform": platform,
                "first_seen_timestamp": timestamp,
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

        cluster_objects.append({
            "id": cluster_id,
            "concept_id": arch["concept"],
            "label": arch["text"][:80],
            "member_count": len(cluster_claims),
            "mutation_direction": mutation_dir,
            "mutation_magnitude": round(random.uniform(0.1, 0.7), 2),
            "arousal_trend": random.choice(["warming", "cooling", "stable"]),
            "arousal_value": round(float(arousal_val), 2),
            "adversarial_pairs": [],
        })

    # Generate adversarial pairs and populate cluster fields
    adv_pairs = generate_adversarial_pairs(topic_id, cluster_objects, archetypes)
    for pair in adv_pairs:
        for co in cluster_objects:
            if co["id"] == pair["cluster_id_a"] and pair["cluster_id_b"] not in co["adversarial_pairs"]:
                co["adversarial_pairs"].append(pair["cluster_id_b"])
            if co["id"] == pair["cluster_id_b"] and pair["cluster_id_a"] not in co["adversarial_pairs"]:
                co["adversarial_pairs"].append(pair["cluster_id_a"])

    # Save extracted claims (without embedding for frontend, with for pipeline)
    frontend_claims = [{k: v for k, v in c.items()
                        if not k.startswith("_") and k != "embedding"}
                       for c in claims]
    with open(claims_dir / "extracted.json", "w") as f:
        json.dump(frontend_claims, f, indent=2)

    with open(claims_dir / "clusters.json", "w") as f:
        json.dump(cluster_objects, f, indent=2)

    # Build momentum lookup from full claims (before _-field stripping)
    _momentum_map = {
        c["id"]: MOMENTUM_PATTERN_VALUES.get(c.get("_momentum_pattern", "stable"), 0.0)
        for c in claims
    }

    # Generate landscape data per time window
    for window in ["6h", "24h", "7d"]:
        positions = generate_2d_positions(cluster_objects, frontend_claims, momentum_map=_momentum_map)

        # Find top metrics from archetypes
        spike_archs = [a for a in archetypes if a["momentum_pattern"] == "spike"]
        persistent_archs = sorted(archetypes, key=lambda a: a["persistence"], reverse=True)
        high_friction_claims = [c for c in claims if random.random() > 0.5]

        top_acc_arch = spike_archs[0] if spike_archs else archetypes[0]
        top_acc_claim = next((c for c in claims if c["concept_id"] == top_acc_arch["concept"]), claims[0])
        top_acc_momentum = generate_momentum_series(top_acc_arch["momentum_pattern"])

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
            },
        }

        with open(metrics_dir / f"landscape_{window}.json", "w") as f:
            json.dump(landscape, f, indent=2)

    # Generate claim detail files for top claims (one per archetype)
    for arch in archetypes:
        matching = [c for c in claims if c["concept_id"] == arch["concept"]]
        if not matching:
            continue
        claim = matching[0]
        momentum_series = generate_momentum_series(arch["momentum_pattern"])
        current_momentum = momentum_series[-1]

        detail = {
            "claim": {k: v for k, v in claim.items() if not k.startswith("_") and k != "embedding"},
            "momentum": make_momentum_extended(current_momentum, "24h", momentum_series, arch),
            "salience": make_metric(round(random.uniform(0.3, 0.9), 4), "24h", momentum_series, ci_width=0.15),
            "friction": make_metric(round(random.uniform(0.1, 0.8), 4), "24h",
                                    [round(random.uniform(0.1, 0.8), 2) for _ in range(8)]),
            "persistence": make_metric(arch["persistence"] / NUM_6H_WINDOWS, "24h",
                                       [round(i / NUM_6H_WINDOWS, 2) for i in range(8)]),
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
                "factors": random.sample([
                    "sarcasm detected", "quote-tweet ambiguity", "short content",
                    "cross-register variation", "meme reference", "clear direct assertion",
                ], k=random.randint(1, 3)),
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
    slice_pairs = [("x_platform", "reddit_platform"), ("x_platform", "youtube_influencer")]
    for window in ["6h", "24h", "7d"]:
        for sa, sb in slice_pairs:
            compare = generate_compare_data(topic_id, cluster_objects, sa, sb, window)
            filename = f"{sa}_{sb}_{window}.json"
            with open(compare_dir / filename, "w") as f:
                json.dump(compare, f, indent=2)

    # Generate timeline data per window
    events = generate_events(topic_id, frontend_claims, archetypes)
    for window in ["6h", "24h", "7d"]:
        timeline = {
            "events": events,
            "total_count": len(events),
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
                "summary": top_event["summary"][:100],
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
            key_signal = {"type": top_event["type"], "summary": top_event["summary"][:100]}
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
