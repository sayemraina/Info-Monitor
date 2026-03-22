#!/usr/bin/env python3
"""
Data Validation Script for Narrative Monitoring System.

Loads all generated JSON files and runs automated sanity checks.
Prints PASS/FAIL for each check with a summary at the end.

Usage:
    python3 scripts/validate_data.py
"""

import json
import math
import os
from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"

passed = 0
failed = 0
warnings = 0


def check(name: str, condition: bool, detail: str = ""):
    global passed, failed
    if condition:
        print(f"  ✓ PASS  {name}")
        passed += 1
    else:
        print(f"  ✗ FAIL  {name}" + (f" — {detail}" if detail else ""))
        failed += 1


def warn(name: str, detail: str = ""):
    global warnings
    print(f"  ⚠ WARN  {name}" + (f" — {detail}" if detail else ""))
    warnings += 1


def is_valid_number(v: Any) -> bool:
    """Check that a value is a finite number (not NaN, not None)."""
    if v is None:
        return False
    if isinstance(v, (int, float)):
        return not math.isnan(v) and not math.isinf(v)
    return False


def validate_topic(topic_id: str):
    print(f"\n{'='*60}")
    print(f"TOPIC: {topic_id}")
    print(f"{'='*60}")

    claims_path = DATA_DIR / "claims" / topic_id / "extracted.json"
    clusters_path = DATA_DIR / "claims" / topic_id / "clusters.json"

    if not claims_path.exists():
        warn(f"Missing extracted.json for {topic_id}")
        return
    if not clusters_path.exists():
        warn(f"Missing clusters.json for {topic_id}")
        return

    with open(claims_path) as f:
        claims = json.load(f)
    with open(clusters_path) as f:
        clusters = json.load(f)

    claim_ids = {c["id"] for c in claims}
    cluster_ids = {c["id"] for c in clusters}

    # --- Check 1: No duplicate claim texts ---
    texts = [c["text"].strip().lower() for c in claims]
    unique_texts = set(texts)
    check("No duplicate claim texts",
          len(texts) == len(unique_texts),
          f"{len(texts) - len(unique_texts)} duplicates found")

    # --- Check 2: Valid arousal values ---
    valid_arousal = {"high", "medium", "low"}
    bad_arousal = [c["id"] for c in claims if c.get("arousal") not in valid_arousal]
    check("All arousal values valid (high/medium/low)",
          len(bad_arousal) == 0,
          f"{len(bad_arousal)} claims with invalid arousal")

    # --- Check 3: Confidence in [0, 1] ---
    bad_conf = [c["id"] for c in claims
                if not is_valid_number(c.get("confidence"))
                or c["confidence"] < 0 or c["confidence"] > 1]
    check("All confidence values in [0, 1]",
          len(bad_conf) == 0,
          f"{len(bad_conf)} claims with out-of-range confidence")

    # --- Check 4: All cluster_ids in claims exist in clusters.json ---
    claim_cluster_ids = {c["cluster_id"] for c in claims}
    missing_clusters = claim_cluster_ids - cluster_ids
    check("All claim cluster_ids exist in clusters.json",
          len(missing_clusters) == 0,
          f"Missing: {missing_clusters}")

    # --- Check 5: Adversarial pairs are bidirectional ---
    adv_errors = []
    for c in clusters:
        for partner_id in c.get("adversarial_pairs", []):
            partner = next((x for x in clusters if x["id"] == partner_id), None)
            if partner and c["id"] not in partner.get("adversarial_pairs", []):
                adv_errors.append(f"{c['id']} → {partner_id} (not reciprocated)")
    check("Adversarial pairs are bidirectional",
          len(adv_errors) == 0,
          f"{len(adv_errors)} one-way pairs")

    # --- Check 6: No NaN in numeric cluster fields ---
    nan_clusters = []
    for c in clusters:
        for field in ["member_count", "mutation_magnitude", "arousal_value"]:
            if not is_valid_number(c.get(field)):
                nan_clusters.append(f"{c['id']}.{field}")
    check("No NaN/null in cluster numeric fields",
          len(nan_clusters) == 0,
          f"Bad fields: {nan_clusters[:5]}")

    # --- Validate landscape files ---
    for window in ["6h", "24h", "7d"]:
        landscape_path = DATA_DIR / "metrics" / topic_id / f"landscape_{window}.json"
        if not landscape_path.exists():
            warn(f"Missing landscape_{window}.json")
            continue

        with open(landscape_path) as f:
            landscape = json.load(f)

        positions = landscape.get("positions", [])
        topic_metrics = landscape.get("topic_metrics", {})

        # --- Check 7: IFI value in [0, 100] ---
        ifi = topic_metrics.get("ifi", {})
        ifi_val = ifi.get("value", 0)
        check(f"[{window}] IFI value in [0, 100]",
              is_valid_number(ifi_val) and 0 <= ifi_val <= 100,
              f"IFI = {ifi_val}")

        # --- Check 8: IFI CI in [0, 100] ---
        ifi_ci = ifi.get("confidence_interval", [0, 100])
        ci_valid = (len(ifi_ci) == 2
                    and is_valid_number(ifi_ci[0])
                    and is_valid_number(ifi_ci[1])
                    and 0 <= ifi_ci[0] <= 100
                    and 0 <= ifi_ci[1] <= 100)
        check(f"[{window}] IFI CI in [0, 100]",
              ci_valid,
              f"CI = {ifi_ci}")

        # --- Check 9: IFI sparkline length ---
        ifi_spark = ifi.get("sparkline", [])
        check(f"[{window}] IFI sparkline has 12 points",
              len(ifi_spark) == 12,
              f"Got {len(ifi_spark)}")

        # --- Check 10: Position claim_ids exist ---
        pos_ids = {p["claim_id"] for p in positions}
        missing_pos = pos_ids - claim_ids
        check(f"[{window}] All position claim_ids exist",
              len(missing_pos) == 0,
              f"{len(missing_pos)} missing")

    # --- Validate compare files ---
    compare_dir = DATA_DIR / "metrics" / topic_id / "compare"
    if compare_dir.exists():
        for cfile in sorted(compare_dir.glob("*.json")):
            with open(cfile) as f:
                compare = json.load(f)

            div = compare.get("divergence", {})
            jsd = div.get("jsd", 0)
            jsd_sqrt = div.get("jsd_sqrt", 0)

            # --- Check 11: JSD in [0, 1] ---
            check(f"[compare/{cfile.name}] JSD in [0, 1]",
                  is_valid_number(jsd) and 0 <= jsd <= 1,
                  f"JSD = {jsd}")

            # --- Check 12: JSD-sqrt in [0, 1] ---
            check(f"[compare/{cfile.name}] JSD-sqrt in [0, 1]",
                  is_valid_number(jsd_sqrt) and 0 <= jsd_sqrt <= 1,
                  f"JSD-sqrt = {jsd_sqrt}")

            # --- Check 13: Typology scores sum to ~1.0 ---
            typo = div.get("typology", {})
            score_sum = (typo.get("information_asymmetry", 0)
                         + typo.get("interpretive", 0)
                         + typo.get("paradigmatic", 0))
            check(f"[compare/{cfile.name}] Typology scores sum ≈ 1.0",
                  abs(score_sum - 1.0) < 0.05,
                  f"Sum = {score_sum:.3f}")

    # --- Validate claim detail files ---
    detail_dir = DATA_DIR / "metrics" / topic_id / "claims"
    if detail_dir.exists():
        detail_files = sorted(detail_dir.glob("*.json"))
        for dfile in detail_files[:10]:  # Check first 10 to keep output manageable
            with open(dfile) as f:
                detail = json.load(f)

            claim_id = dfile.stem

            # --- Check 14: Detail claim_id exists in extracted ---
            check(f"[detail/{claim_id}] Claim exists in extracted.json",
                  claim_id in claim_ids)

            # --- Check 15: Metric CIs in [0, 1] ---
            for metric_name in ["momentum", "salience", "friction", "persistence", "arousal"]:
                metric = detail.get(metric_name, {})
                ci = metric.get("confidence_interval", [0, 1])
                if len(ci) == 2:
                    ci_ok = (is_valid_number(ci[0]) and is_valid_number(ci[1])
                             and 0 <= ci[0] <= 1 and 0 <= ci[1] <= 1)
                    if not ci_ok:
                        warn(f"[detail/{claim_id}] {metric_name} CI out of bounds: {ci}")

            # --- Check 16: Sparkline lengths = 8 ---
            for metric_name in ["momentum", "salience", "friction"]:
                metric = detail.get(metric_name, {})
                spark = metric.get("sparkline", [])
                if len(spark) != 8:
                    warn(f"[detail/{claim_id}] {metric_name} sparkline has {len(spark)} points (expected 8)")

            # --- Check 17: Supply chain fidelity transitivity ---
            sc = detail.get("supply_chain", {})
            hops = sc.get("hops", [])
            if len(hops) > 1:
                for i in range(1, len(hops)):
                    fo = hops[i].get("fidelity_to_origin", 1.0)
                    fp = hops[i].get("fidelity_to_previous", 1.0)
                    if fo > fp + 0.01:  # small tolerance
                        warn(f"[detail/{claim_id}] Supply chain hop {i}: "
                             f"fidelity_to_origin ({fo}) > fidelity_to_previous ({fp})")

            # --- Check 18: Friction quadrant consistency ---
            mom = detail.get("momentum", {})
            mom_val = mom.get("value", 0)
            fric_val = mom.get("friction", 0)
            quadrant = mom.get("friction_quadrant", "")
            if is_valid_number(mom_val) and is_valid_number(fric_val) and quadrant:
                high_mom = mom_val > 0.5
                high_fric = fric_val > 0.35
                expected = {
                    (True, False): "unopposed_advance",
                    (True, True): "contested_advance",
                    (False, True): "successful_suppression",
                    (False, False): "dead",
                }
                expected_q = expected.get((high_mom, high_fric), "unknown")
                if quadrant != expected_q:
                    warn(f"[detail/{claim_id}] Friction quadrant mismatch: "
                         f"momentum={mom_val:.3f} friction={fric_val:.3f} "
                         f"→ expected '{expected_q}' got '{quadrant}'")

    # --- Validate timeline files ---
    for window in ["6h", "24h", "7d"]:
        timeline_path = DATA_DIR / "metrics" / topic_id / f"timeline_{window}.json"
        if not timeline_path.exists():
            continue

        with open(timeline_path) as f:
            timeline = json.load(f)

        events = timeline.get("events", [])
        for evt in events:
            # --- Check 19: Event claim_ids exist (when not null) ---
            evt_claim = evt.get("claim_id")
            if evt_claim and evt_claim not in claim_ids:
                warn(f"[timeline/{window}] Event {evt['id']} references "
                     f"nonexistent claim {evt_claim}")


def validate_topics_json():
    print(f"\n{'='*60}")
    print("TOPICS.JSON VALIDATION")
    print(f"{'='*60}")

    topics_path = DATA_DIR / "topics.json"
    if not topics_path.exists():
        warn("topics.json does not exist")
        return

    with open(topics_path) as f:
        topics = json.load(f)

    # Check all metric directories have a topic entry
    metric_dirs = {d.name for d in (DATA_DIR / "metrics").iterdir() if d.is_dir()}
    topic_ids = {t["id"] for t in topics}

    missing_topics = metric_dirs - topic_ids
    check("All metric directories have topics.json entries",
          len(missing_topics) == 0,
          f"Missing: {missing_topics}")

    # Check each topic summary
    for t in topics:
        # System confidence in [0, 1]
        sc = t.get("system_confidence", 0)
        check(f"[{t['id']}] system_confidence in [0, 1]",
              is_valid_number(sc) and 0 <= sc <= 1,
              f"Got {sc}")

        # Activity sparkline length
        spark = t.get("activity_sparkline", [])
        check(f"[{t['id']}] activity_sparkline has 12 points",
              len(spark) == 12,
              f"Got {len(spark)}")


def main():
    global passed, failed, warnings

    print("=" * 60)
    print("NARRATIVE MONITORING SYSTEM — DATA VALIDATION")
    print("=" * 60)

    # Validate topics.json first
    validate_topics_json()

    # Find all topic directories
    metrics_dir = DATA_DIR / "metrics"
    if not metrics_dir.exists():
        print("ERROR: data/metrics/ directory not found")
        return

    topic_dirs = sorted([d.name for d in metrics_dir.iterdir() if d.is_dir()])

    for topic_id in topic_dirs:
        validate_topic(topic_id)

    # Summary
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    print(f"  ✓ {passed} checks passed")
    print(f"  ✗ {failed} checks failed")
    print(f"  ⚠ {warnings} warnings")
    total = passed + failed
    if total > 0:
        print(f"  Pass rate: {passed/total*100:.1f}%")
    if failed == 0 and warnings == 0:
        print("\n  🎉 ALL CHECKS PASSED — data is internally consistent")
    elif failed == 0:
        print(f"\n  ✓ All checks passed ({warnings} non-critical warnings)")
    else:
        print(f"\n  ✗ {failed} check(s) need attention")


if __name__ == "__main__":
    main()
