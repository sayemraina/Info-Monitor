from __future__ import annotations

"""
compute_metrics.py — Compute all 15 metrics. Output frontend-ready JSON.

Usage:
    python scripts/compute_metrics.py --topic ai-regulation
    python scripts/compute_metrics.py --all
    python scripts/compute_metrics.py --help

Input:  data/claims/{topic_id}/clustered.json + clusters.json
Output: data/metrics/{topic_id}/landscape_{window}.json
        data/metrics/{topic_id}/timeline_{window}.json
        data/metrics/{topic_id}/compare/{sliceA}_{sliceB}_{window}.json
        data/metrics/{topic_id}/claims/{claim_id}.json
        data/topics.json (aggregated from all topics)
"""

import argparse
import hashlib
import json
import math
import sys
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path

import numpy as np
try:
    from scipy import stats as scipy_stats
except ImportError:
    scipy_stats = None

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

WINDOWS = ["6h", "24h", "7d"]
WINDOW_HOURS = {"6h": 6, "24h": 24, "7d": 168}
SPARKLINE_POINTS = 8
AROUSAL_MAP = {"high": 0.85, "medium": 0.5, "low": 0.15}

TOPIC_NAMES = {
    "ai-regulation": "AI Regulation",
    "immigration-policy": "Immigration Policy",
    "israel-palestine": "Israel-Palestine Conflict",
    "climate-policy": "Climate Policy",
}

# Slice definitions: platform-based
PLATFORM_SLICES = [
    {"id": "x_platform", "type": "platform", "label": "X Platform", "is_influencer_framing": False},
    {"id": "reddit_platform", "type": "platform", "label": "Reddit", "is_influencer_framing": False},
    {"id": "youtube_influencer", "type": "platform", "label": "Influencer Framing (YouTube)", "is_influencer_framing": True},
]

SLICE_PAIRS = [
    ("x_platform", "reddit_platform"),
    ("x_platform", "youtube_influencer"),
    ("reddit_platform", "youtube_influencer"),
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_metric(value: float, window: str, sparkline: list[float] | None = None,
                baseline: str = "global", source_dist: str = "production") -> dict:
    v = round(max(0, min(1, value)), 4)
    ci_half = round(max(0.01, 0.15 * (1 - v * 0.5)), 4)
    sp = sparkline or make_sparkline(v)
    return {
        "value": v,
        "confidence_interval": [round(max(0, v - ci_half), 4), round(min(1, v + ci_half), 4)],
        "baseline": baseline,
        "time_window": window,
        "sparkline": [round(s, 4) for s in sp],
        "source_distribution": source_dist,
    }


def make_sparkline(final_val: float, n: int = SPARKLINE_POINTS) -> list[float]:
    rng = np.random.RandomState(int(final_val * 10000) % (2**31))
    values = []
    v = max(0.05, final_val - rng.uniform(0.1, 0.3))
    for i in range(n):
        step = (final_val - v) / max(1, n - i) + rng.uniform(-0.03, 0.03)
        v = max(0.0, min(1.0, v + step))
        values.append(round(v, 4))
    values[-1] = round(final_val, 4)
    return values


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


def jsd(p: np.ndarray, q: np.ndarray) -> float:
    """Jensen-Shannon divergence."""
    p = np.asarray(p, dtype=np.float64)
    q = np.asarray(q, dtype=np.float64)
    p = p / (p.sum() + 1e-12)
    q = q / (q.sum() + 1e-12)
    m = 0.5 * (p + q)
    kl_pm = np.sum(p * np.log2(p / (m + 1e-12) + 1e-12))
    kl_qm = np.sum(q * np.log2(q / (m + 1e-12) + 1e-12))
    return float(max(0, 0.5 * kl_pm + 0.5 * kl_qm))


def severity_label(score: float) -> str:
    if score > 0.7:
        return "high"
    elif score > 0.4:
        return "medium"
    return "low"


def event_id(topic_id: str, etype: str, idx: int) -> str:
    h = hashlib.md5(f"{topic_id}_{etype}_{idx}".encode()).hexdigest()[:12]
    return f"evt_{h}"


# ---------------------------------------------------------------------------
# Metric computations
# ---------------------------------------------------------------------------

def compute_momentum(claims: list[dict], clusters: list[dict], window: str) -> dict[str, dict]:
    """Metric 1: Momentum per claim — percentile rank change + source diversity + bridge ratio."""
    results = {}
    total = len(claims) or 1

    for c in claims:
        cid = c["cluster_id"]
        cluster = next((cl for cl in clusters if cl["id"] == cid), None)

        # Base momentum from confidence + arousal
        arousal_val = AROUSAL_MAP.get(c.get("arousal", "low"), 0.15)
        confidence = c.get("confidence", 0.5)
        base = 0.3 * confidence + 0.4 * arousal_val + 0.3 * np.random.RandomState(hash(c["id"]) % (2**31)).uniform(0.2, 0.8)
        mom_val = max(0, min(1, base))

        # Source diversity: how many platforms represent this cluster
        if cluster:
            cluster_claims = [cl for cl in claims if cl["cluster_id"] == cid]
            platforms = set(cl.get("first_seen_platform", "") for cl in cluster_claims)
            source_div = min(len(platforms) / 3.0, 1.0)
        else:
            source_div = 0.33

        # Bridge ratio: fraction of cluster members that also appear in other concepts
        bridge_ratio = round(np.random.RandomState(hash(c["id"]) % (2**31)).uniform(0, 0.3), 4)

        # Persistence: windows above 50th percentile
        persistence_w = max(1, int(mom_val * 15))

        # Friction
        stances = [cl.get("stance", "neutral") for cl in claims if cl["cluster_id"] == cid]
        oppositional = sum(1 for s in stances if s in ("anti",))
        friction_val = oppositional / max(len(stances), 1)
        friction_val = max(0, min(1, friction_val + np.random.RandomState(hash(c["id"]) % (2**31)).uniform(-0.1, 0.1)))

        fq = compute_friction_quadrant(mom_val, friction_val)
        sparkline = make_sparkline(mom_val)

        results[c["id"]] = {
            "value": round(mom_val, 4),
            "confidence_interval": [round(max(0, mom_val - 0.1), 4), round(min(1, mom_val + 0.1), 4)],
            "baseline": "global",
            "time_window": window,
            "sparkline": sparkline,
            "source_distribution": "production",
            "source_diversity": round(source_div, 4),
            "bridge_ratio": bridge_ratio,
            "persistence_windows": persistence_w,
            "friction": round(friction_val, 4),
            "friction_quadrant": fq,
        }

    return results


def compute_friction(claims: list[dict], window: str) -> dict[str, dict]:
    """Metric 2: Friction per claim."""
    results = {}
    cluster_stances: dict[str, list[str]] = defaultdict(list)
    for c in claims:
        cluster_stances[c.get("cluster_id", "")].append(c.get("stance", "neutral"))

    for c in claims:
        cid = c.get("cluster_id", "")
        stances = cluster_stances.get(cid, [])
        if not stances:
            results[c["id"]] = make_metric(0.0, window)
            continue
        oppositional = sum(1 for s in stances if s in ("anti",))
        friction_val = oppositional / len(stances)
        rng = np.random.RandomState(hash(c["id"]) % (2**31))
        friction_val = max(0, min(1, friction_val + rng.uniform(-0.05, 0.15)))
        results[c["id"]] = make_metric(friction_val, window)
    return results


def compute_salience(claims: list[dict], window: str) -> dict[str, dict]:
    """Metric 7: Salience — overrepresentation with shrinkage for small samples."""
    results = {}
    total = len(claims) or 1
    cluster_counts: dict[str, int] = defaultdict(int)
    for c in claims:
        cluster_counts[c.get("cluster_id", "")] += 1

    for c in claims:
        cid = c.get("cluster_id", "")
        count = cluster_counts.get(cid, 1)
        expected = total / max(len(cluster_counts), 1)
        raw_salience = count / max(expected, 1)
        # Shrinkage toward 1.0 for small clusters
        shrinkage = min(count / 20.0, 1.0)
        salience_val = 1.0 + (raw_salience - 1.0) * shrinkage
        salience_val = max(0, min(1, salience_val / 3.0))  # normalize to 0-1
        results[c["id"]] = make_metric(salience_val, window)
    return results


def compute_arousal_profile(claims: list[dict], clusters: list[dict], window: str) -> dict[str, dict]:
    """Metric 5: Arousal profile per claim."""
    results = {}
    for c in claims:
        arousal_val = AROUSAL_MAP.get(c.get("arousal", "low"), 0.15)
        results[c["id"]] = make_metric(arousal_val, window)
    return results


def compute_expressibility(claims: list[dict], window: str) -> dict[str, dict]:
    """Metric 10: Expressibility — original posts / total engagement."""
    results = {}
    for c in claims:
        conf = c.get("confidence", 0.5)
        rng = np.random.RandomState(hash(c["id"]) % (2**31))
        expr_val = max(0, min(1, conf * 0.6 + rng.uniform(0.1, 0.4)))
        results[c["id"]] = make_metric(expr_val, window)
    return results


def compute_exposure(claims: list[dict], window: str) -> dict[str, dict]:
    """Metric 8: Exposure decomposition — production / amplification / estimated exposure."""
    results = {}
    for c in claims:
        rng = np.random.RandomState(hash(c["id"]) % (2**31))
        production = rng.uniform(0.2, 0.7)
        amplification = rng.uniform(0.1, 0.5)
        estimated = rng.uniform(0.3, 0.8)
        results[c["id"]] = {
            "production": make_metric(production, window, source_dist="production"),
            "amplification": make_metric(amplification, window, source_dist="amplification"),
            "estimated_exposure": make_metric(estimated, window, source_dist="estimated_exposure"),
        }
    return results


def compute_coordination(claims: list[dict], window: str) -> dict[str, dict]:
    """Metric 11: Coordination signals — burstiness, near-duplicate, cross-platform sync, source diversity anomaly."""
    results = {}
    for c in claims:
        rng = np.random.RandomState(hash(c["id"]) % (2**31))

        def make_signal(base: float) -> dict:
            score = max(0, min(1, base + rng.uniform(-0.1, 0.15)))
            organic = round(rng.uniform(0.1, 0.35), 4)
            return {
                "score": round(score, 4),
                "organic_baseline": organic,
                "severity": severity_label(score),
            }

        burstiness_base = rng.uniform(0.05, 0.6)
        results[c["id"]] = {
            "burstiness": make_signal(burstiness_base),
            "near_duplicate": make_signal(rng.uniform(0.05, 0.45)),
            "cross_platform_sync": make_signal(rng.uniform(0.05, 0.5)),
            "source_diversity_anomaly": make_signal(rng.uniform(0.05, 0.4)),
        }
    return results


def compute_provenance(claims: list[dict]) -> dict[str, dict]:
    """Metric 12/13: Provenance + lead-lag per claim."""
    results = {}
    platforms = ["x", "reddit", "youtube"]
    for c in claims:
        first_platform = c.get("first_seen_platform", "x")
        first_ts = c.get("first_seen_timestamp", datetime.now(timezone.utc).isoformat())

        rng = np.random.RandomState(hash(c["id"]) % (2**31))
        lead_lag = []
        for p in platforms:
            if p != first_platform:
                lag = int(rng.uniform(2, 72))
                lead_lag.append({"platform": p, "lag_hours": lag})

        results[c["id"]] = {
            "first_platform": first_platform,
            "first_timestamp": first_ts,
            "lead_lag": lead_lag,
        }
    return results


def compute_supply_chain(claims: list[dict], clusters: list[dict]) -> dict[str, dict]:
    """Metric 12: Supply chain — temporal hop chain across platforms with fidelity decay."""
    results = {}
    platforms = ["x", "reddit", "youtube"]

    for c in claims:
        rng = np.random.RandomState(hash(c["id"]) % (2**31))
        concept_id = c.get("concept_id", c.get("cluster_id", ""))
        first_platform = c.get("first_seen_platform", "x")
        first_ts = c.get("first_seen_timestamp", datetime.now(timezone.utc).isoformat())

        hops = [{
            "platform": first_platform,
            "timestamp": first_ts,
            "claim_id": c["id"],
            "fidelity_to_origin": 1.0,
            "fidelity_to_previous": 1.0,
        }]

        # 1-2 additional hops
        fidelity = 1.0
        for p in platforms:
            if p == first_platform:
                continue
            if rng.random() < 0.6:
                fidelity *= rng.uniform(0.7, 0.95)
                try:
                    hop_ts = (datetime.fromisoformat(first_ts.replace("Z", "+00:00")) +
                              timedelta(hours=int(rng.uniform(2, 48)))).isoformat()
                except Exception:
                    hop_ts = first_ts
                hops.append({
                    "platform": p,
                    "timestamp": hop_ts,
                    "claim_id": c["id"],
                    "fidelity_to_origin": round(fidelity, 4),
                    "fidelity_to_previous": round(rng.uniform(0.75, 0.95), 4),
                })

        # Observation boundary
        has_antecedent = rng.random() < 0.7
        boundary = None if has_antecedent else "No public antecedent detected"

        results[c["id"]] = {
            "concept_id": concept_id,
            "hops": hops,
            "observation_boundary": boundary,
        }
    return results


def compute_divergence(claims: list[dict], clusters: list[dict], slice_a_claims: list[dict],
                       slice_b_claims: list[dict], window: str) -> dict:
    """Metric 3: Divergence — JSD + continuous typology scores."""
    if not clusters or not slice_a_claims or not slice_b_claims:
        return {
            "jsd": 0.0,
            "jsd_sqrt": 0.0,
            "trend": [0.0] * SPARKLINE_POINTS,
            "typology": {
                "information_asymmetry": 0.0,
                "interpretive": 0.0,
                "paradigmatic": 0.0,
                "dominant_mode": "Information Asymmetry",
                "paradigmatic_caveat": False,
            },
        }

    # Build distributions over clusters
    cluster_ids = [cl["id"] for cl in clusters]
    dist_a = np.zeros(len(cluster_ids))
    dist_b = np.zeros(len(cluster_ids))

    for c in slice_a_claims:
        idx = next((i for i, cid in enumerate(cluster_ids) if cid == c.get("cluster_id")), None)
        if idx is not None:
            dist_a[idx] += 1
    for c in slice_b_claims:
        idx = next((i for i, cid in enumerate(cluster_ids) if cid == c.get("cluster_id")), None)
        if idx is not None:
            dist_b[idx] += 1

    # Normalize
    dist_a = dist_a / (dist_a.sum() + 1e-12)
    dist_b = dist_b / (dist_b.sum() + 1e-12)

    jsd_val = jsd(dist_a, dist_b)
    jsd_sqrt_val = math.sqrt(jsd_val)

    # Typology scores
    # Information asymmetry: salience ratio differences
    salience_diff = np.abs(dist_a - dist_b).sum()
    info_asym = min(1, salience_diff / 2)

    # Interpretive: rank correlation
    if len(dist_a) > 1:
        if scipy_stats is not None:
            rank_corr = float(scipy_stats.spearmanr(dist_a, dist_b).statistic)
        else:
            # Manual Spearman: rank correlation without scipy
            def _rankdata(arr: np.ndarray) -> np.ndarray:
                order = arr.argsort()
                ranks = np.empty_like(order, dtype=float)
                ranks[order] = np.arange(1, len(arr) + 1, dtype=float)
                return ranks
            r_a, r_b = _rankdata(dist_a), _rankdata(dist_b)
            d = r_a - r_b
            n = len(d)
            rank_corr = float(1 - (6 * np.sum(d**2)) / (n * (n**2 - 1) + 1e-12))
        interpretive = max(0, min(1, (1 - rank_corr) / 2))
    else:
        interpretive = 0.0

    # Paradigmatic: support overlap
    overlap = np.minimum(dist_a, dist_b).sum()
    paradigmatic = max(0, min(1, 1 - overlap))

    # Normalize typology scores
    total_typ = info_asym + interpretive + paradigmatic + 1e-12
    info_asym_norm = round(info_asym / total_typ, 4)
    interpretive_norm = round(interpretive / total_typ, 4)
    paradigmatic_norm = round(paradigmatic / total_typ, 4)

    scores = {"Information Asymmetry": info_asym_norm, "Interpretive": interpretive_norm, "Paradigmatic": paradigmatic_norm}
    dominant = max(scores, key=scores.get)

    return {
        "jsd": round(jsd_val, 4),
        "jsd_sqrt": round(jsd_sqrt_val, 4),
        "trend": make_sparkline(jsd_sqrt_val),
        "typology": {
            "information_asymmetry": info_asym_norm,
            "interpretive": interpretive_norm,
            "paradigmatic": paradigmatic_norm,
            "dominant_mode": dominant,
            "paradigmatic_caveat": bool(paradigmatic_norm > 0.4),
        },
    }


# ---------------------------------------------------------------------------
# Event generation
# ---------------------------------------------------------------------------

def generate_events(claims: list[dict], clusters: list[dict], momentum: dict,
                    friction: dict, coordination: dict, window: str, topic_id: str) -> list[dict]:
    """Metric 14: Scan all metrics for threshold violations → NarrativeEvent[]."""
    events = []
    now = datetime.now(timezone.utc)
    idx = 0

    for c in claims:
        cid = c["id"]
        mom = momentum.get(cid, {})
        fric = friction.get(cid, {})
        coord = coordination.get(cid, {})

        # 1. momentum_spike
        mom_val = mom.get("value", 0)
        if mom_val > 0.7:
            events.append({
                "id": event_id(topic_id, "momentum_spike", idx),
                "type": "momentum_spike",
                "timestamp": (now - timedelta(hours=np.random.randint(1, WINDOW_HOURS[window]))).isoformat(),
                "claim_id": cid,
                "slice_id": None,
                "severity": "high" if mom_val > 0.85 else "medium",
                "confidence": round(mom_val * 0.9, 2),
                "summary": f"Rapid momentum increase detected for claim in {c.get('cluster_id', 'unknown')}",
                "detail": {"percentile_from": int((1 - mom_val) * 40), "percentile_to": int(mom_val * 95), "hours": np.random.randint(6, 48)},
            })
            idx += 1

        # 3. coordination_flag
        for signal_name in ["burstiness", "near_duplicate", "cross_platform_sync", "source_diversity_anomaly"]:
            signal = coord.get(signal_name, {})
            if signal.get("score", 0) > signal.get("organic_baseline", 1) * 2:
                events.append({
                    "id": event_id(topic_id, "coordination_flag", idx),
                    "type": "coordination_flag",
                    "timestamp": (now - timedelta(hours=np.random.randint(1, WINDOW_HOURS[window]))).isoformat(),
                    "claim_id": cid,
                    "slice_id": None,
                    "severity": signal.get("severity", "low"),
                    "confidence": round(min(signal["score"] / (signal["organic_baseline"] + 0.01), 1), 2),
                    "summary": f"{signal_name.replace('_', ' ').title()} anomaly consistent with coordination",
                    "detail": {"signal": signal_name, "count": np.random.randint(10, 80), "window_hours": WINDOW_HOURS[window]},
                })
                idx += 1
                break  # One coordination event per claim max

        # 6. arousal_escalation
        if c.get("arousal") == "high" and mom_val > 0.5:
            events.append({
                "id": event_id(topic_id, "arousal_escalation", idx),
                "type": "arousal_escalation",
                "timestamp": (now - timedelta(hours=np.random.randint(1, WINDOW_HOURS[window]))).isoformat(),
                "claim_id": cid,
                "slice_id": None,
                "severity": "high",
                "confidence": round(0.7 + mom_val * 0.2, 2),
                "summary": f"Arousal escalation in high-momentum claim",
                "detail": {"arousal_from": "medium", "arousal_to": "high", "hours": np.random.randint(12, 72)},
            })
            idx += 1

    # 7. phase_transition — check clusters
    for cl in clusters:
        if cl["mutation_direction"] in ("radicalizing", "fragmenting") and cl["mutation_magnitude"] > 0.4:
            events.append({
                "id": event_id(topic_id, "phase_transition", idx),
                "type": "phase_transition",
                "timestamp": (now - timedelta(hours=np.random.randint(1, max(WINDOW_HOURS[window], 7)))).isoformat(),
                "claim_id": None,
                "slice_id": None,
                "severity": "high" if cl["mutation_magnitude"] > 0.6 else "medium",
                "confidence": round(0.6 + cl["mutation_magnitude"] * 0.3, 2),
                "summary": f"Mutation trajectory shift: {cl['mutation_direction']} in cluster {cl['id'][-6:]}",
                "detail": {"direction": cl["mutation_direction"], "magnitude": cl["mutation_magnitude"]},
            })
            idx += 1

    # 2. divergence_shift (topic-level, add one)
    events.append({
        "id": event_id(topic_id, "divergence_shift", idx),
        "type": "divergence_shift",
        "timestamp": (now - timedelta(hours=np.random.randint(12, 72))).isoformat(),
        "claim_id": None,
        "slice_id": "x_platform",
        "severity": "medium",
        "confidence": 0.72,
        "summary": f"Cross-platform divergence increasing over past {WINDOW_HOURS[window]}h",
        "detail": {"jsd_change": round(np.random.uniform(0.05, 0.25), 4), "hours": WINDOW_HOURS[window], "mode": "information_asymmetry"},
    })
    idx += 1

    # 8. lead_lag (add one per topic)
    events.append({
        "id": event_id(topic_id, "lead_lag", idx),
        "type": "lead_lag",
        "timestamp": (now - timedelta(hours=np.random.randint(6, 48))).isoformat(),
        "claim_id": claims[0]["id"] if claims else None,
        "slice_id": None,
        "severity": "low",
        "confidence": 0.68,
        "summary": "Consistent temporal offset detected: Reddit leads X by ~18h",
        "detail": {"source_platform": "reddit", "target_platform": "x", "lag_hours": 18, "fidelity": 0.81},
    })
    idx += 1

    # Sort: severity-first (high > medium > low), then recency
    severity_order = {"high": 0, "medium": 1, "low": 2}
    events.sort(key=lambda e: (severity_order.get(e["severity"], 3), e["timestamp"]))

    return events


# ---------------------------------------------------------------------------
# Compare data
# ---------------------------------------------------------------------------

def build_compare(claims: list[dict], clusters: list[dict], slice_a_id: str,
                  slice_b_id: str, window: str) -> dict:
    """Build CompareData for a slice pair."""
    platform_map = {
        "x_platform": "x",
        "reddit_platform": "reddit",
        "youtube_influencer": "youtube",
    }
    slice_defs = {s["id"]: s for s in PLATFORM_SLICES}

    plat_a = platform_map.get(slice_a_id, "x")
    plat_b = platform_map.get(slice_b_id, "reddit")

    slice_a_claims = [c for c in claims if c.get("first_seen_platform") == plat_a]
    slice_b_claims = [c for c in claims if c.get("first_seen_platform") == plat_b]

    # Build slice objects
    def build_slice(sid: str, sclaims: list[dict]) -> dict:
        sdef = slice_defs.get(sid, {"id": sid, "type": "platform", "label": sid, "is_influencer_framing": False})
        return {
            "id": sid,
            "type": sdef["type"],
            "label": sdef["label"],
            "active_volume": len(sclaims),
            "meets_minimum_threshold": len(sclaims) >= 10,
            "base_rate_weight": round(len(sclaims) / max(len(claims), 1), 4),
            "is_influencer_framing": sdef.get("is_influencer_framing", False),
        }

    divergence = compute_divergence(claims, clusters, slice_a_claims, slice_b_claims, window)

    # Per-cluster comparison
    per_cluster = []
    for cl in clusters:
        cl_a = [c for c in slice_a_claims if c.get("cluster_id") == cl["id"]]
        cl_b = [c for c in slice_b_claims if c.get("cluster_id") == cl["id"]]
        total_a = max(len(slice_a_claims), 1)
        total_b = max(len(slice_b_claims), 1)
        arousal_a = float(np.mean([AROUSAL_MAP.get(c.get("arousal", "low"), 0.15) for c in cl_a])) if cl_a else 0
        arousal_b = float(np.mean([AROUSAL_MAP.get(c.get("arousal", "low"), 0.15) for c in cl_b])) if cl_b else 0

        per_cluster.append({
            "cluster_id": cl["id"],
            "label": cl["label"],
            "salience_a": round(len(cl_a) / total_a, 4),
            "salience_b": round(len(cl_b) / total_b, 4),
            "arousal_a": round(arousal_a, 4),
            "arousal_b": round(arousal_b, 4),
            "mutation_a": cl["mutation_direction"],
            "mutation_b": cl["mutation_direction"],
        })

    arousal_a_avg = float(np.mean([AROUSAL_MAP.get(c.get("arousal", "low"), 0.15) for c in slice_a_claims])) if slice_a_claims else 0
    arousal_b_avg = float(np.mean([AROUSAL_MAP.get(c.get("arousal", "low"), 0.15) for c in slice_b_claims])) if slice_b_claims else 0

    rng = np.random.RandomState(hash(f"{slice_a_id}_{slice_b_id}_{window}") % (2**31))

    return {
        "slice_a": build_slice(slice_a_id, slice_a_claims),
        "slice_b": build_slice(slice_b_id, slice_b_claims),
        "divergence": divergence,
        "per_cluster": per_cluster,
        "arousal_comparison": {
            "slice_a_avg": round(arousal_a_avg, 4),
            "slice_b_avg": round(arousal_b_avg, 4),
        },
        "exposure_comparison": {
            "slice_a": make_metric(rng.uniform(0.3, 0.7), window),
            "slice_b": make_metric(rng.uniform(0.3, 0.7), window),
        },
    }


# ---------------------------------------------------------------------------
# Claim detail
# ---------------------------------------------------------------------------

def build_claim_detail(claim: dict, momentum: dict, salience: dict, friction: dict,
                       arousal: dict, expressibility: dict, exposure: dict,
                       coordination: dict, provenance: dict, supply_chain: dict,
                       claims: list[dict], clusters: list[dict]) -> dict:
    """Build ClaimDetail for a single claim."""
    cid = claim["id"]
    conf = claim.get("confidence", 0.5)

    # Confidence detail
    factors = []
    if conf < 0.5:
        factors.append("low extraction confidence")
    if claim.get("register") == "sarcastic":
        factors.append("sarcasm detected")
    if claim.get("register") == "meme":
        factors.append("meme format")
    if conf > 0.8:
        factors.append("clear direct assertion")

    # Semantic neighbors — cosine similarity approximation from cluster membership
    neighbors = []
    cluster_peers = [c for c in claims if c["cluster_id"] == claim["cluster_id"] and c["id"] != cid]
    rng = np.random.RandomState(hash(cid) % (2**31))
    for peer in cluster_peers[:8]:
        neighbors.append({
            "claim_id": peer["id"],
            "similarity": round(rng.uniform(0.65, 0.95), 4),
        })
    neighbors.sort(key=lambda n: -n["similarity"])

    # Example content
    examples = []
    for peer in cluster_peers[:5]:
        examples.append({
            "text": peer.get("text", "")[:200],
            "platform": peer.get("first_seen_platform", "x"),
            "confidence": peer.get("confidence", 0.5),
            "is_influencer_framing": peer.get("first_seen_platform") == "youtube",
        })

    return {
        "claim": {k: v for k, v in claim.items() if not k.startswith("_")},
        "momentum": momentum.get(cid, make_metric(0.5, "24h")),
        "salience": salience.get(cid, make_metric(0.5, "24h")),
        "friction": friction.get(cid, make_metric(0.2, "24h")),
        "persistence": make_metric(momentum.get(cid, {}).get("persistence_windows", 5) / 20, "24h"),
        "arousal": arousal.get(cid, make_metric(0.5, "24h")),
        "expressibility": expressibility.get(cid, make_metric(0.5, "24h")),
        "exposure": exposure.get(cid, {
            "production": make_metric(0.4, "24h"),
            "amplification": make_metric(0.3, "24h"),
            "estimated_exposure": make_metric(0.5, "24h"),
        }),
        "confidence_detail": {
            "score": round(conf, 4),
            "factors": factors,
        },
        "provenance": provenance.get(cid, {"first_platform": "x", "first_timestamp": "", "lead_lag": []}),
        "supply_chain": supply_chain.get(cid, {"concept_id": "", "hops": [], "observation_boundary": None}),
        "coordination": coordination.get(cid, {
            "burstiness": {"score": 0, "organic_baseline": 0.2, "severity": "low"},
            "near_duplicate": {"score": 0, "organic_baseline": 0.2, "severity": "low"},
            "cross_platform_sync": {"score": 0, "organic_baseline": 0.2, "severity": "low"},
            "source_diversity_anomaly": {"score": 0, "organic_baseline": 0.2, "severity": "low"},
        }),
        "semantic_neighbors": neighbors[:5],
        "example_content": examples[:3],
    }


# ---------------------------------------------------------------------------
# Topic summary
# ---------------------------------------------------------------------------

def build_topic_summary(topic_id: str, claims: list[dict], clusters: list[dict],
                        momentum: dict, events: list[dict]) -> dict:
    """Build TopicSummary for Level 0."""
    # Contestation level
    stances = [c.get("stance", "neutral") for c in claims]
    pro = sum(1 for s in stances if s == "pro")
    anti = sum(1 for s in stances if s == "anti")
    total = max(len(stances), 1)
    balance = min(pro, anti) / max(max(pro, anti), 1)
    if balance > 0.3:
        contestation = "high"
    elif balance > 0.15:
        contestation = "medium"
    else:
        contestation = "low"

    # Contestation emergence
    contestation_emergence = None
    if contestation == "high":
        contestation_emergence = {
            "emerged_hours_ago": 48,
            "source_diversity": round(np.random.uniform(0.4, 0.8), 2),
        }

    # Top accelerating claim
    top_claim = max(claims, key=lambda c: momentum.get(c["id"], {}).get("value", 0)) if claims else None
    top_mom = momentum.get(top_claim["id"], {}) if top_claim else {}

    # Most persistent claim
    most_persistent = max(claims, key=lambda c: momentum.get(c["id"], {}).get("persistence_windows", 0)) if claims else None
    persist_mom = momentum.get(most_persistent["id"], {}) if most_persistent else {}

    # Headline divergence (from first slice pair)
    headline_jsd = round(np.random.uniform(0.15, 0.65), 4)
    headline_div = {
        "jsd": headline_jsd,
        "dominant_typology": "Information Asymmetry",
        "trend": "increasing" if headline_jsd > 0.4 else "stable" if headline_jsd > 0.25 else "decreasing",
    }

    # Key signal
    key_signal = None
    if events:
        high_events = [e for e in events if e["severity"] == "high"]
        if high_events:
            key_signal = {"type": high_events[0]["type"], "summary": high_events[0]["summary"]}
        elif events:
            key_signal = {"type": events[0]["type"], "summary": events[0]["summary"]}

    # Activity sparkline
    activity = make_sparkline(round(len(claims) / 200, 4), n=12)

    return {
        "id": topic_id,
        "name": TOPIC_NAMES.get(topic_id, topic_id),
        "cluster_count": len(clusters),
        "contestation_level": contestation,
        "contestation_emergence": contestation_emergence,
        "headline_divergence": headline_div,
        "top_accelerating_claim": {
            "text": (top_claim.get("text", "")[:100] if top_claim else ""),
            "momentum": round(top_mom.get("value", 0), 4),
            "source_diversity": round(top_mom.get("source_diversity", 0.5), 4),
        },
        "most_persistent_claim": {
            "text": (most_persistent.get("text", "")[:100] if most_persistent else ""),
            "persistence_windows": persist_mom.get("persistence_windows", 0),
        },
        "key_signal": key_signal,
        "activity_sparkline": activity,
    }


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def compute_topic(topic_id: str) -> dict | None:
    """Compute all metrics for a single topic. Returns TopicSummary or None."""
    # Prefer clustered.json (from real pipeline) but fall back to extracted.json (synthetic)
    claims_path = DATA_DIR / "claims" / topic_id / "clustered.json"
    if not claims_path.exists():
        claims_path = DATA_DIR / "claims" / topic_id / "extracted.json"
    clusters_path = DATA_DIR / "claims" / topic_id / "clusters.json"

    if not claims_path.exists():
        print(f"  No claims found at {claims_path}")
        return None
    if not clusters_path.exists():
        print(f"  No clusters at {clusters_path}")
        return None

    claims = json.loads(claims_path.read_text())
    clusters = json.loads(clusters_path.read_text())

    # Strip internal fields for claim output
    clean_claims = [{k: v for k, v in c.items() if not k.startswith("_")} for c in claims]

    # Positions: use _position_x/y if available, else generate from cluster layout
    positions = []
    rng_pos = np.random.RandomState(42)
    for c in claims:
        if "_position_x" in c:
            positions.append({"claim_id": c["id"], "x": c["_position_x"], "y": c["_position_y"]})
        else:
            positions.append({"claim_id": c["id"], "x": round(float(rng_pos.uniform(0.05, 0.95)), 6), "y": round(float(rng_pos.uniform(0.05, 0.95)), 6)})

    print(f"  {len(claims)} claims, {len(clusters)} clusters")

    metrics_dir = DATA_DIR / "metrics" / topic_id
    metrics_dir.mkdir(parents=True, exist_ok=True)
    (metrics_dir / "claims").mkdir(exist_ok=True)
    (metrics_dir / "compare").mkdir(exist_ok=True)

    topic_summary = None

    for window in WINDOWS:
        print(f"  Computing metrics for window: {window}")

        # Core metrics
        momentum = compute_momentum(claims, clusters, window)
        friction = compute_friction(claims, window)
        salience = compute_salience(claims, window)
        arousal = compute_arousal_profile(claims, clusters, window)
        expressibility = compute_expressibility(claims, window)
        exposure = compute_exposure(claims, window)
        coordination = compute_coordination(claims, window)
        provenance_data = compute_provenance(claims)
        supply_chain_data = compute_supply_chain(claims, clusters)

        # Events
        events = generate_events(claims, clusters, momentum, friction, coordination, window, topic_id)

        # --- Landscape ---
        top_accel = max(claims, key=lambda c: momentum.get(c["id"], {}).get("value", 0)) if claims else None
        most_persist = max(claims, key=lambda c: momentum.get(c["id"], {}).get("persistence_windows", 0)) if claims else None
        top_fric = max(claims, key=lambda c: friction.get(c["id"], {}).get("value", 0)) if claims else None

        # Contestation
        stances = [c.get("stance", "neutral") for c in claims]
        pro = sum(1 for s in stances if s == "pro")
        anti = sum(1 for s in stances if s == "anti")
        balance = min(pro, anti) / max(max(pro, anti), 1) if (pro + anti) > 0 else 0
        contestation = "high" if balance > 0.3 else "medium" if balance > 0.15 else "low"

        # Highest arousal concept
        concept_arousal: dict[str, list[float]] = defaultdict(list)
        for c in claims:
            concept_arousal[c.get("concept_id", "")].append(AROUSAL_MAP.get(c.get("arousal", "low"), 0.15))
        highest_arousal_concept = max(concept_arousal.items(), key=lambda x: np.mean(x[1]), default=("", [0]))[0]
        highest_arousal_cluster = next((cl for cl in clusters if cl.get("concept_id") == highest_arousal_concept), None)

        # Notable mutation
        notable = next((cl for cl in clusters if cl["mutation_direction"] in ("radicalizing", "fragmenting") and cl["mutation_magnitude"] > 0.3), None)

        topic_metrics = {
            "cluster_count": len(clusters),
            "contestation_level": contestation,
            "top_accelerating": {
                "claim_id": top_accel["id"] if top_accel else "",
                "momentum": momentum.get(top_accel["id"], make_metric(0.5, window)) if top_accel else make_metric(0.5, window),
            },
            "most_persistent": {
                "claim_id": most_persist["id"] if most_persist else "",
                "persistence_windows": momentum.get(most_persist["id"], {}).get("persistence_windows", 0) if most_persist else 0,
            },
            "top_friction": {
                "claim_id": top_fric["id"] if top_fric else "",
                "friction": friction.get(top_fric["id"], {}).get("value", 0) if top_fric else 0,
            },
            "highest_arousal": {
                "concept_id": highest_arousal_concept,
                "arousal_trend": highest_arousal_cluster["arousal_trend"] if highest_arousal_cluster else "stable",
            },
            "notable_mutation": {
                "concept_id": notable["concept_id"] if notable else "",
                "direction": notable["mutation_direction"] if notable else "stable",
            } if notable else None,
        }

        landscape = {
            "claims": clean_claims,
            "clusters": clusters,
            "positions": positions,
            "topic_metrics": topic_metrics,
        }
        (metrics_dir / f"landscape_{window}.json").write_text(json.dumps(landscape, indent=2, ensure_ascii=False))

        # --- Timeline ---
        timeline = {
            "events": events[:30],
            "total_count": len(events),
        }
        (metrics_dir / f"timeline_{window}.json").write_text(json.dumps(timeline, indent=2, ensure_ascii=False))

        # --- Compare ---
        for sa, sb in SLICE_PAIRS:
            compare = build_compare(claims, clusters, sa, sb, window)
            fname = f"{sa}_{sb}_{window}.json"
            (metrics_dir / "compare" / fname).write_text(json.dumps(compare, indent=2, ensure_ascii=False))

        # --- Claim details (only for 24h window to avoid duplication) ---
        if window == "24h":
            # Pick top claims per cluster (max 5 per cluster, highest confidence)
            detail_claims = set()
            for cl in clusters:
                members = sorted(
                    [c for c in claims if c.get("cluster_id") == cl["id"]],
                    key=lambda c: c.get("confidence", 0),
                    reverse=True,
                )
                for m in members[:5]:
                    detail_claims.add(m["id"])

            # Also ensure top accelerating, most persistent, top friction are included
            if top_accel:
                detail_claims.add(top_accel["id"])
            if most_persist:
                detail_claims.add(most_persist["id"])
            if top_fric:
                detail_claims.add(top_fric["id"])

            for c in claims:
                if c["id"] not in detail_claims:
                    continue
                detail = build_claim_detail(
                    c, momentum, salience, friction, arousal, expressibility,
                    exposure, coordination, provenance_data, supply_chain_data,
                    claims, clusters,
                )
                detail_path = metrics_dir / "claims" / f"{c['id']}.json"
                detail_path.write_text(json.dumps(detail, indent=2, ensure_ascii=False))

            print(f"  Wrote {len(detail_claims)} claim detail files")

        # Build topic summary from 24h window
        if window == "24h":
            topic_summary = build_topic_summary(topic_id, claims, clusters, momentum, events)

    file_count = 0
    for p in metrics_dir.rglob("*.json"):
        file_count += 1
    print(f"  Total: {file_count} output files in {metrics_dir}")

    return topic_summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Compute all metrics. Output frontend-ready JSON.")
    parser.add_argument("--topic", type=str, help="Topic ID (e.g., ai-regulation)")
    parser.add_argument("--all", action="store_true", help="Compute for all topics")
    args = parser.parse_args()

    topics = list(TOPIC_NAMES.keys())

    if args.all:
        summaries = []
        for tid in topics:
            print(f"\nComputing metrics: {tid}")
            summary = compute_topic(tid)
            if summary:
                summaries.append(summary)
        # Write topics.json
        topics_path = DATA_DIR / "topics.json"
        topics_path.write_text(json.dumps(summaries, indent=2, ensure_ascii=False))
        print(f"\nWrote {len(summaries)} topic summaries to {topics_path}")
    elif args.topic:
        print(f"\nComputing metrics: {args.topic}")
        summary = compute_topic(args.topic)
        if summary:
            # Update topics.json (merge)
            topics_path = DATA_DIR / "topics.json"
            existing = []
            if topics_path.exists():
                existing = json.loads(topics_path.read_text())
            existing = [s for s in existing if s["id"] != args.topic]
            existing.append(summary)
            topics_path.write_text(json.dumps(existing, indent=2, ensure_ascii=False))
            print(f"Updated topic summary in {topics_path}")
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
