"""
Generate ClaimDetail JSON files for all claims not yet covered.

Reads landscape data, uses each claim's attributes (confidence, arousal, stance,
cluster_id) to seed coherent metrics. Writes to data/metrics/{topic}/claims/{id}.json
"""

import json
import os
import random
import math
from pathlib import Path

TOPICS = [
    "ai-workplace", "war-on-iran", "ozempic-glp1", "immigration",
    "housing-crisis", "israel-palestine", "crypto-digital-money",
    "inflation-cost-of-living", "dei-rollbacks", "ai-bubble",
]
DATA_DIR = Path(__file__).parent.parent / "data" / "metrics"
WINDOWS = 8  # sparkline length

def seed_for(claim_id: str) -> int:
    return int(claim_id[-8:], 16)

def rng(claim_id: str) -> random.Random:
    r = random.Random()
    r.seed(seed_for(claim_id))
    return r

def sparkline(r: random.Random, center: float, volatility: float = 0.08, n: int = WINDOWS) -> list[float]:
    vals = []
    v = center + r.gauss(0, volatility)
    for _ in range(n):
        v = max(0.0, min(1.0, v + r.gauss(0, volatility)))
        vals.append(round(v, 4))
    return vals

def ci(value: float, width: float = 0.05) -> list[float]:
    return [round(max(0.0, value - width), 4), round(min(1.0, value + width), 4)]

def metric(value: float, r: random.Random, center: float, volatility: float = 0.08, baseline: str = "global", width=None) -> dict:
    return {
        "value": round(value, 4),
        "confidence_interval": ci(value, width if width is not None else r.uniform(0.03, 0.08)),
        "baseline": baseline,
        "time_window": "24h",
        "sparkline": sparkline(r, center, volatility),
        "source_distribution": "production"
    }

QUADRANTS = {
    # (high_momentum, high_friction) → quadrant
    (True, True): "contested_advance",
    (True, False): "unopposed_advance",
    (False, True): "successful_suppression",
    (False, False): "dead",
}

FRICTION_QUADRANT_LOOKUP = {
    "pro": {"high_momentum": 0.6, "base_friction": 0.2},
    "anti": {"high_momentum": 0.4, "base_friction": 0.55},
    "neutral": {"high_momentum": 0.35, "base_friction": 0.25},
    "ambiguous": {"high_momentum": 0.3, "base_friction": 0.35},
}

REGISTER_EXPRESSIBILITY = {
    "meme": 0.55,
    "vernacular": 0.45,
    "journalistic": 0.3,
    "academic": 0.2,
    "formal": 0.22,
    "sarcastic": 0.4,
}

AROUSAL_VALUE = {"high": 0.8, "medium": 0.5, "low": 0.2}

PLATFORMS = ["x", "reddit", "youtube"]

EXAMPLE_PREFIXES = [
    "", "Honestly, ", "People need to understand: ", "This is obvious — ",
    "Can't believe we're still debating this. ", "Thread: ",
    "Hot take: ", "Real talk — ", "For those who missed it: ",
]

def generate_example_content(claim: dict, r: random.Random) -> list[dict]:
    platform = claim.get("first_seen_platform", "x")
    text = claim["text"]
    examples = []
    for i in range(r.randint(2, 5)):
        pfx = r.choice(EXAMPLE_PREFIXES)
        raw = pfx + text[0].lower() + text[1:] if pfx else text
        is_yt = platform == "youtube"
        examples.append({
            "text": raw[:200],
            "platform": platform if i < 2 else r.choice(PLATFORMS),
            "confidence": round(r.uniform(0.65, 0.92), 2),
            "is_influencer_framing": is_yt,
        })
    return examples

def generate_provenance(claim: dict, all_claims: list[dict], r: random.Random) -> dict:
    ts = claim.get("first_seen_timestamp", "2026-03-08T12:00:00+00:00")
    platform = claim.get("first_seen_platform", "x")

    # Lead-lag: 0-2 other platforms with hour offsets
    other_platforms = [p for p in PLATFORMS if p != platform]
    lead_lag = []
    for p in r.sample(other_platforms, r.randint(0, len(other_platforms))):
        lag = r.randint(-24, 48)
        lead_lag.append({"platform": p, "lag_hours": lag})

    return {
        "first_platform": platform,
        "first_timestamp": ts,
        "lead_lag": lead_lag,
    }

def generate_supply_chain(claim: dict, all_claims: list[dict], r: random.Random) -> dict:
    concept_id = claim.get("concept_id", "unknown")
    first_platform = claim.get("first_seen_platform", "x")
    ts = claim.get("first_seen_timestamp", "2026-03-08T12:00:00+00:00")

    n_hops = r.randint(1, 3)
    hops = [{
        "platform": first_platform,
        "timestamp": ts,
        "claim_id": claim["id"],
        "fidelity_to_origin": 1.0,
        "fidelity_to_previous": 1.0,
    }]

    fidelity = 1.0
    hop_platforms = [p for p in PLATFORMS if p != first_platform]
    for i in range(min(n_hops - 1, len(hop_platforms))):
        fidelity = round(max(0.4, fidelity - r.uniform(0.05, 0.35)), 2)
        # pick a nearby claim in same cluster as the hop claim
        same_cluster = [c for c in all_claims if c.get("cluster_id") == claim.get("cluster_id") and c["id"] != claim["id"]]
        hop_claim_id = r.choice(same_cluster)["id"] if same_cluster else claim["id"]
        hops.append({
            "platform": hop_platforms[i],
            "timestamp": ts,  # simplified: same ts offset handled by lag
            "claim_id": hop_claim_id,
            "fidelity_to_origin": fidelity,
            "fidelity_to_previous": round(max(0.5, fidelity + r.uniform(-0.15, 0.1)), 2),
        })

    return {
        "concept_id": concept_id,
        "hops": hops,
        "observation_boundary": "No public antecedent detected" if r.random() > 0.4 else None,
    }

def generate_coordination(r: random.Random, momentum_val: float, friction_val: float) -> dict:
    # Higher momentum + low friction = more coordination signals
    burst_score = round(r.uniform(0.02, 0.25) * (1 + momentum_val), 3)
    dup_score = round(r.uniform(0.05, 0.7) * momentum_val, 3)
    sync_score = round(r.uniform(0.1, 0.9) * momentum_val, 3)
    diversity_score = round(r.uniform(0.05, 0.5), 3)

    def severity(score: float, baseline: float) -> str:
        if score > baseline * 2: return "high"
        if score > baseline * 1.3: return "medium"
        return "low"

    burst_baseline = round(r.uniform(0.12, 0.25), 2)
    dup_baseline = round(r.uniform(0.2, 0.35), 2)
    sync_baseline = round(r.uniform(0.2, 0.35), 2)
    div_baseline = round(r.uniform(0.15, 0.3), 2)

    return {
        "burstiness": {"score": burst_score, "organic_baseline": burst_baseline, "severity": severity(burst_score, burst_baseline)},
        "near_duplicate": {"score": dup_score, "organic_baseline": dup_baseline, "severity": severity(dup_score, dup_baseline)},
        "cross_platform_sync": {"score": sync_score, "organic_baseline": sync_baseline, "severity": severity(sync_score, sync_baseline)},
        "source_diversity_anomaly": {"score": diversity_score, "organic_baseline": div_baseline, "severity": severity(diversity_score, div_baseline)},
    }

def generate_semantic_neighbors(claim: dict, all_claims: list[dict], r: random.Random) -> list[dict]:
    # Same cluster = higher similarity, different cluster = lower
    same = [c for c in all_claims if c.get("cluster_id") == claim.get("cluster_id") and c["id"] != claim["id"]]
    diff = [c for c in all_claims if c.get("cluster_id") != claim.get("cluster_id")]

    neighbors = []
    n_same = min(r.randint(2, 4), len(same))
    n_diff = min(r.randint(0, 2), len(diff))

    for c in r.sample(same, n_same):
        neighbors.append({"claim_id": c["id"], "similarity": round(r.uniform(0.65, 0.92), 2)})
    for c in r.sample(diff, n_diff):
        neighbors.append({"claim_id": c["id"], "similarity": round(r.uniform(0.28, 0.58), 2)})

    r.shuffle(neighbors)
    return neighbors[:5]

def generate_detail(claim: dict, all_claims: list[dict]) -> dict:
    r = rng(claim["id"])

    stance = claim.get("stance", "neutral")
    arousal_level = claim.get("arousal", "medium")
    confidence = claim.get("confidence", 0.7)
    register = claim.get("register", "vernacular")

    stance_cfg = FRICTION_QUADRANT_LOOKUP.get(stance, FRICTION_QUADRANT_LOOKUP["neutral"])
    base_momentum = stance_cfg["high_momentum"] + r.gauss(0, 0.15)
    base_momentum = max(0.0, min(1.0, base_momentum))
    base_friction = stance_cfg["base_friction"] + r.gauss(0, 0.12)
    base_friction = max(0.0, min(1.0, base_friction))

    high_mom = base_momentum > 0.5
    high_fric = base_friction > 0.4
    quadrant = QUADRANTS[(high_mom, high_fric)]

    arousal_val = AROUSAL_VALUE[arousal_level] + r.gauss(0, 0.05)
    arousal_val = max(0.1, min(1.0, arousal_val))

    expressibility_base = REGISTER_EXPRESSIBILITY.get(register, 0.35) + r.gauss(0, 0.05)
    expressibility_base = max(0.05, min(0.9, expressibility_base))

    salience_val = max(0.1, min(0.95, r.uniform(0.3, 0.85)))
    source_diversity = round(max(0.05, min(0.95, r.uniform(0.15, 0.85))), 3)
    bridge_ratio = round(max(0.0, min(0.6, r.uniform(0.0, 0.4))), 4)
    persistence_windows = r.randint(1, 8)

    confidence_factors = []
    if confidence < 0.6:
        factors_pool = ["short content", "ambiguous framing", "sarcasm detected", "cross-register variation", "meme format"]
        confidence_factors = r.sample(factors_pool, r.randint(1, 3))
    elif confidence > 0.85:
        factors_pool = ["clear direct assertion", "multiple confirming sources", "high-fidelity extraction"]
        confidence_factors = r.sample(factors_pool, r.randint(1, 2))

    production_val = round(max(0.05, min(0.95, salience_val * r.uniform(0.6, 1.1))), 4)
    amplification_val = round(max(0.05, min(0.95, production_val * r.uniform(0.3, 0.8))), 4)
    exposure_val = round(max(0.1, min(1.0, (production_val + amplification_val) * r.uniform(0.7, 1.3))), 4)

    return {
        "claim": claim,
        "momentum": {
            **metric(base_momentum, r, base_momentum),
            "source_diversity": source_diversity,
            "bridge_ratio": bridge_ratio,
            "persistence_windows": persistence_windows,
            "friction": round(base_friction, 4),
            "friction_quadrant": quadrant,
        },
        "salience": metric(salience_val, r, salience_val),
        "friction": metric(base_friction, r, base_friction, volatility=0.12),
        "persistence": metric(persistence_windows / 8.0, r, persistence_windows / 8.0, volatility=0.04),
        "arousal": metric(arousal_val, r, arousal_val, volatility=0.06),
        "expressibility": metric(expressibility_base, r, expressibility_base, volatility=0.07),
        "exposure": {
            "production": metric(production_val, r, production_val),
            "amplification": metric(amplification_val, r, amplification_val),
            "estimated_exposure": metric(exposure_val, r, exposure_val, width=0.12),
        },
        "confidence_detail": {
            "score": round(confidence, 4),
            "factors": confidence_factors,
        },
        "provenance": generate_provenance(claim, all_claims, r),
        "supply_chain": generate_supply_chain(claim, all_claims, r),
        "coordination": generate_coordination(r, base_momentum, base_friction),
        "semantic_neighbors": generate_semantic_neighbors(claim, all_claims, r),
        "example_content": generate_example_content(claim, r),
    }


def main():
    total_written = 0
    total_skipped = 0

    for topic in TOPICS:
        landscape_path = DATA_DIR / topic / "landscape_24h.json"
        if not landscape_path.exists():
            print(f"  SKIP {topic}: no landscape_24h.json")
            continue

        with open(landscape_path) as f:
            landscape = json.load(f)

        claims = landscape["claims"]
        claims_dir = DATA_DIR / topic / "claims"
        claims_dir.mkdir(parents=True, exist_ok=True)

        existing = {p.stem for p in claims_dir.glob("*.json")}
        missing = [c for c in claims if c["id"] not in existing]

        print(f"{topic}: {len(claims)} claims, {len(existing)} existing, generating {len(missing)}...")

        for claim in missing:
            detail = generate_detail(claim, claims)
            out_path = claims_dir / f"{claim['id']}.json"
            with open(out_path, "w") as f:
                json.dump(detail, f, indent=2)
            total_written += 1

        total_skipped += len(existing)
        print(f"  done — {len(missing)} written, {len(existing)} skipped")

    print(f"\nTotal: {total_written} written, {total_skipped} skipped")


if __name__ == "__main__":
    main()
