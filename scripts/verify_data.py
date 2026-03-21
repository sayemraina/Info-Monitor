#!/usr/bin/env python3
"""
Verification script for Narrative Monitoring System data.

Runs pre-generation checks on archetype files and post-generation checks
on output data. Produces a PASS/WARN/FAIL report per topic.

Usage:
    python scripts/verify_data.py              # Run all checks
    python scripts/verify_data.py --pre        # Archetype checks only
    python scripts/verify_data.py --post       # Generated data checks only
    python scripts/verify_data.py --topic X    # Check single topic
"""

import json
import os
import sys
import argparse
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
ARCHETYPES_DIR = Path(__file__).parent / "archetypes"

TOPIC_ORDER = [
    "ai-workplace", "war-on-iran", "ozempic-glp1", "immigration",
    "housing-crisis", "israel-palestine", "crypto-digital-money",
    "inflation-cost-of-living", "dei-rollbacks", "ai-bubble",
]

VALID_STANCES = {"pro", "anti", "neutral", "ambiguous"}
VALID_AROUSAL = {"high", "medium", "low"}
VALID_MOMENTUM = {"spike", "rising", "stable", "declining", "goes_dark"}
VALID_PLATFORMS = {"x", "reddit", "youtube"}

# Training data cutoff — archetypes should reference events before this
MAX_EVENT_DATE = datetime(2025, 7, 1)


class Report:
    def __init__(self):
        self.results = []  # list of (level, topic, message)

    def passed(self, topic, msg):
        self.results.append(("PASS", topic, msg))

    def warn(self, topic, msg):
        self.results.append(("WARN", topic, msg))

    def fail(self, topic, msg):
        self.results.append(("FAIL", topic, msg))

    def print_report(self):
        print("\n" + "=" * 70)
        print("VERIFICATION REPORT")
        print("=" * 70)

        # Group by topic
        topics_seen = []
        by_topic = {}
        for level, topic, msg in self.results:
            if topic not in by_topic:
                by_topic[topic] = []
                topics_seen.append(topic)
            by_topic[topic].append((level, msg))

        for topic in topics_seen:
            entries = by_topic[topic]
            fails = [e for e in entries if e[0] == "FAIL"]
            warns = [e for e in entries if e[0] == "WARN"]
            passes = [e for e in entries if e[0] == "PASS"]

            if fails:
                status = "❌ FAIL"
            elif warns:
                status = "⚠️  WARN"
            else:
                status = "✅ PASS"

            print(f"\n{status}  {topic}")
            for level, msg in entries:
                icon = {"PASS": "  ✓", "WARN": "  ⚠", "FAIL": "  ✗"}[level]
                print(f"    {icon} {msg}")

        # Summary
        all_fails = [r for r in self.results if r[0] == "FAIL"]
        all_warns = [r for r in self.results if r[0] == "WARN"]
        all_pass = [r for r in self.results if r[0] == "PASS"]

        print(f"\n{'=' * 70}")
        print(f"SUMMARY: {len(all_pass)} passed, {len(all_warns)} warnings, {len(all_fails)} failures")
        if all_fails:
            print("STATUS: FAIL")
            return 1
        elif all_warns:
            print("STATUS: PASS WITH WARNINGS")
            return 0
        else:
            print("STATUS: ALL CLEAR")
            return 0


# ============================================================================
# PRE-GENERATION CHECKS — validate archetype files
# ============================================================================

def check_archetype_schema(report: Report, topic_id: str, data: dict):
    """Validate JSON schema of an archetype file."""
    label = f"[pre] {topic_id}"

    # Required top-level fields
    for field in ["id", "name", "adversarial_pairs", "archetypes"]:
        if field not in data:
            report.fail(label, f"Missing required field: {field}")
            return
    report.passed(label, "Top-level schema valid")

    if data["id"] != topic_id:
        report.fail(label, f"ID mismatch: file={topic_id}, id field={data['id']}")

    archetypes = data["archetypes"]
    if len(archetypes) < 10:
        report.warn(label, f"Only {len(archetypes)} archetypes (expected 12-16)")
    else:
        report.passed(label, f"{len(archetypes)} archetypes")

    # Check each archetype
    required_arch_fields = [
        "text", "subject", "assertion", "framing", "stance",
        "arousal", "cluster", "concept", "platforms", "momentum_pattern", "persistence",
    ]
    for i, arch in enumerate(archetypes):
        for field in required_arch_fields:
            if field not in arch:
                report.fail(label, f"Archetype {i} missing field: {field}")

        # Validate enums
        if arch.get("stance") not in VALID_STANCES:
            report.fail(label, f"Archetype {i} invalid stance: {arch.get('stance')}")
        if arch.get("arousal") not in VALID_AROUSAL:
            report.fail(label, f"Archetype {i} invalid arousal: {arch.get('arousal')}")
        if arch.get("momentum_pattern") not in VALID_MOMENTUM:
            report.fail(label, f"Archetype {i} invalid momentum_pattern: {arch.get('momentum_pattern')}")

        # Platform weights should sum to ~1.0
        platforms = arch.get("platforms", {})
        weight_sum = sum(platforms.values())
        if not (0.9 <= weight_sum <= 1.1):
            report.warn(label, f"Archetype {i} platform weights sum to {weight_sum:.2f} (expected ~1.0)")

        # Persistence should be reasonable
        persistence = arch.get("persistence", 0)
        if not (1 <= persistence <= 20):
            report.warn(label, f"Archetype {i} persistence={persistence} (expected 1-20)")


def check_time_anchors(report: Report, topic_id: str, data: dict):
    """Validate time_anchor dates are within training window."""
    label = f"[pre] {topic_id}"
    archetypes = data.get("archetypes", [])

    anchored = [a for a in archetypes if a.get("time_anchor", {}).get("date")]
    if not anchored:
        report.warn(label, "No time_anchor dates found")
        return

    report.passed(label, f"{len(anchored)}/{len(archetypes)} archetypes have time_anchor")

    for arch in anchored:
        try:
            d = datetime.strptime(arch["time_anchor"]["date"], "%Y-%m-%d")
            if d > MAX_EVENT_DATE:
                report.fail(label, f"time_anchor date {arch['time_anchor']['date']} exceeds training cutoff ({MAX_EVENT_DATE.strftime('%Y-%m-%d')})")
        except ValueError:
            report.fail(label, f"Invalid date format: {arch['time_anchor']['date']}")


def check_variations(report: Report, topic_id: str, data: dict):
    """Validate variations exist and have platform labels."""
    label = f"[pre] {topic_id}"
    archetypes = data.get("archetypes", [])

    with_variations = [a for a in archetypes if a.get("variations")]
    if not with_variations:
        report.warn(label, "No archetypes have variations")
        return

    report.passed(label, f"{len(with_variations)}/{len(archetypes)} archetypes have variations")

    for arch in with_variations:
        variations = arch["variations"]
        if len(variations) < 4:
            report.warn(label, f"Archetype '{arch['concept']}' has only {len(variations)} variations (expected 7-8)")

        platforms_covered = set(v.get("platform") for v in variations)
        missing = VALID_PLATFORMS - platforms_covered
        if missing:
            report.warn(label, f"Archetype '{arch['concept']}' missing platform variations: {missing}")


def check_pattern_coverage(report: Report, topic_id: str, data: dict):
    """Ensure each topic has a mix of momentum patterns, stances, and arousal."""
    label = f"[pre] {topic_id}"
    archetypes = data.get("archetypes", [])

    patterns = set(a.get("momentum_pattern") for a in archetypes)
    if "spike" not in patterns:
        report.warn(label, "No 'spike' momentum pattern")
    if "stable" not in patterns:
        report.warn(label, "No 'stable' momentum pattern")
    if "declining" not in patterns:
        report.warn(label, "No 'declining' momentum pattern")
    if len(patterns) >= 3:
        report.passed(label, f"Momentum patterns: {sorted(patterns)}")

    stances = set(a.get("stance") for a in archetypes)
    if "pro" not in stances or "anti" not in stances:
        report.warn(label, f"Missing pro/anti stance coverage: {stances}")
    else:
        report.passed(label, f"Stance coverage: {sorted(stances)}")

    arousal_levels = set(a.get("arousal") for a in archetypes)
    if "high" not in arousal_levels:
        report.warn(label, "No 'high' arousal archetype")
    else:
        report.passed(label, f"Arousal coverage: {sorted(arousal_levels)}")


def check_no_duplicate_texts(report: Report, topic_id: str, data: dict):
    """Check for duplicate archetype texts within a topic."""
    label = f"[pre] {topic_id}"
    archetypes = data.get("archetypes", [])
    texts = [a["text"] for a in archetypes]
    seen = set()
    dupes = []
    for t in texts:
        if t in seen:
            dupes.append(t[:60])
        seen.add(t)
    if dupes:
        report.fail(label, f"{len(dupes)} duplicate archetype texts: {dupes[0]}...")
    else:
        report.passed(label, "No duplicate archetype texts")


def check_clusters(report: Report, topic_id: str, data: dict):
    """Check cluster distribution."""
    label = f"[pre] {topic_id}"
    archetypes = data.get("archetypes", [])
    from collections import Counter
    clusters = Counter(a["cluster"] for a in archetypes)
    n_clusters = len(clusters)

    if n_clusters < 4:
        report.warn(label, f"Only {n_clusters} clusters (expected 5-7)")
    elif n_clusters > 8:
        report.warn(label, f"{n_clusters} clusters (expected 5-7, may be fine)")
    else:
        report.passed(label, f"{n_clusters} clusters: {dict(clusters)}")

    # Check adversarial pairs reference existing clusters
    adv_pairs = data.get("adversarial_pairs", [])
    cluster_names = set(clusters.keys())
    for pair in adv_pairs:
        for name in pair:
            if name not in cluster_names:
                report.fail(label, f"Adversarial pair references non-existent cluster: {name}")


def run_pre_checks(report: Report, topic_ids: list):
    """Run all pre-generation checks."""
    # Check infrastructure files
    edge_cases_path = ARCHETYPES_DIR / "_edge_cases.json"
    gaps_path = ARCHETYPES_DIR / "_gaps.json"

    if edge_cases_path.exists():
        try:
            with open(edge_cases_path) as f:
                ec_data = json.load(f)
            report.passed("[pre] _edge_cases", f"Valid JSON, {len(ec_data.get('edge_cases', []))} edge cases")
        except json.JSONDecodeError as e:
            report.fail("[pre] _edge_cases", f"Invalid JSON: {e}")
    else:
        report.warn("[pre] _edge_cases", "File not found")

    if gaps_path.exists():
        try:
            with open(gaps_path) as f:
                json.load(f)
            report.passed("[pre] _gaps", "Valid JSON")
        except json.JSONDecodeError as e:
            report.fail("[pre] _gaps", f"Invalid JSON: {e}")
    else:
        report.warn("[pre] _gaps", "File not found")

    # Check each topic archetype file
    for topic_id in topic_ids:
        path = ARCHETYPES_DIR / f"{topic_id}.json"
        if not path.exists():
            report.fail(f"[pre] {topic_id}", "Archetype file not found")
            continue

        try:
            with open(path) as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            report.fail(f"[pre] {topic_id}", f"Invalid JSON: {e}")
            continue

        check_archetype_schema(report, topic_id, data)
        check_time_anchors(report, topic_id, data)
        check_variations(report, topic_id, data)
        check_pattern_coverage(report, topic_id, data)
        check_no_duplicate_texts(report, topic_id, data)
        check_clusters(report, topic_id, data)


# ============================================================================
# POST-GENERATION CHECKS — validate generated output
# ============================================================================

def check_topics_json(report: Report):
    """Validate data/topics.json."""
    label = "[post] topics.json"
    path = DATA_DIR / "topics.json"

    if not path.exists():
        report.fail(label, "File not found")
        return

    with open(path) as f:
        topics = json.load(f)

    if len(topics) != 10:
        report.warn(label, f"{len(topics)} topics (expected 10)")
    else:
        report.passed(label, "10 topics present")

    # Check required fields
    required = ["id", "name", "cluster_count", "contestation_level",
                 "headline_divergence", "top_accelerating_claim", "key_signal",
                 "activity_sparkline", "system_confidence"]
    for t in topics:
        for field in required:
            if field not in t:
                report.fail(label, f"Topic '{t.get('id', '?')}' missing field: {field}")

        # System confidence should be reasonable
        conf = t.get("system_confidence", 0)
        if not (0.2 <= conf <= 1.0):
            report.warn(label, f"Topic '{t['id']}' system_confidence={conf} (unusual)")

        # Activity sparkline should have 12 points
        sparkline = t.get("activity_sparkline", [])
        if len(sparkline) != 12:
            report.warn(label, f"Topic '{t['id']}' sparkline has {len(sparkline)} points (expected 12)")

    # Check topic order stability
    topic_ids = [t["id"] for t in topics]
    if topic_ids == TOPIC_ORDER:
        report.passed(label, "Topic order matches locked order")
    else:
        report.warn(label, f"Topic order differs from locked order")


def check_landscape_data(report: Report, topic_id: str):
    """Validate landscape JSON files for a topic."""
    label = f"[post] {topic_id}"

    for window in ["6h", "24h", "7d"]:
        path = DATA_DIR / "metrics" / topic_id / f"landscape_{window}.json"
        if not path.exists():
            report.fail(label, f"landscape_{window}.json not found")
            continue

        with open(path) as f:
            data = json.load(f)

        # Check required top-level keys
        for key in ["claims", "clusters", "positions", "topic_metrics"]:
            if key not in data:
                report.fail(label, f"landscape_{window}.json missing key: {key}")

        claims = data.get("claims", [])
        clusters = data.get("clusters", [])
        positions = data.get("positions", [])

        if len(claims) < 50:
            report.warn(label, f"landscape_{window}: only {len(claims)} claims (expected 200+)")

        if len(clusters) < 3:
            report.warn(label, f"landscape_{window}: only {len(clusters)} clusters")

        if len(positions) != len(claims):
            report.warn(label, f"landscape_{window}: {len(positions)} positions vs {len(claims)} claims")

        # Check claim IDs are unique
        claim_ids = [c["id"] for c in claims]
        if len(claim_ids) != len(set(claim_ids)):
            dupes = len(claim_ids) - len(set(claim_ids))
            report.fail(label, f"landscape_{window}: {dupes} duplicate claim IDs")

        # Check cluster IDs referenced by claims exist
        cluster_ids = set(c["id"] for c in clusters)
        for claim in claims:
            if claim.get("cluster_id") not in cluster_ids:
                report.fail(label, f"landscape_{window}: claim references non-existent cluster: {claim.get('cluster_id')}")
                break

        # Check no NaN/Infinity in positions
        for pos in positions:
            for field in ["x", "y", "momentum", "salience"]:
                val = pos.get(field)
                if val is not None and (val != val or val == float('inf') or val == float('-inf')):
                    report.fail(label, f"landscape_{window}: NaN/Infinity in position.{field}")
                    break

        # Check topic_metrics
        tm = data.get("topic_metrics", {})
        if "ifi" not in tm:
            report.warn(label, f"landscape_{window}: missing IFI metric")
        if "situations" not in tm:
            report.warn(label, f"landscape_{window}: missing situations")

    report.passed(label, "Landscape files valid for all 3 windows")


def check_compare_data(report: Report, topic_id: str):
    """Validate compare data files, respecting strategic gaps."""
    label = f"[post] {topic_id}"

    # Load gaps
    gaps_path = ARCHETYPES_DIR / "_gaps.json"
    gaps = {}
    if gaps_path.exists():
        with open(gaps_path) as f:
            all_gaps = json.load(f)
        gaps = all_gaps.get(topic_id, {})

    compare_dir = DATA_DIR / "metrics" / topic_id / "compare"
    if not compare_dir.exists():
        report.fail(label, "compare/ directory not found")
        return

    files = os.listdir(compare_dir)

    # Check expected pairs exist (respecting gaps)
    expected_pairs = [
        ("x_platform", "reddit_platform"),
        ("x_platform", "youtube_influencer"),
        ("coastal_metros", "heartland_metros"),
    ]

    for sa, sb in expected_pairs:
        is_geo = "coastal" in sa or "heartland" in sa
        is_youtube = "youtube" in sa or "youtube" in sb
        is_reddit = "reddit" in sa or "reddit" in sb

        should_skip = (
            (is_geo and gaps.get("missing_geo_comparison")) or
            (is_youtube and gaps.get("missing_youtube_compare")) or
            (is_reddit and gaps.get("missing_reddit_depth"))
        )

        for window in ["6h", "24h", "7d"]:
            filename = f"{sa}_{sb}_{window}.json"
            exists = filename in files

            if should_skip and exists:
                report.fail(label, f"Gap violation: {filename} should NOT exist (gap configured)")
            elif should_skip and not exists:
                report.passed(label, f"Gap correctly applied: {filename} absent")
            elif not should_skip and not exists:
                report.fail(label, f"Missing compare file: {filename}")

    # Validate content of existing compare files
    for f in files:
        filepath = compare_dir / f
        with open(filepath) as fh:
            data = json.load(fh)
        for key in ["slice_a", "slice_b", "divergence", "per_cluster"]:
            if key not in data:
                report.fail(label, f"compare/{f} missing key: {key}")


def check_claim_details(report: Report, topic_id: str):
    """Spot-check claim detail files."""
    label = f"[post] {topic_id}"
    claims_dir = DATA_DIR / "metrics" / topic_id / "claims"

    if not claims_dir.exists():
        report.fail(label, "claims/ detail directory not found")
        return

    detail_files = list(claims_dir.glob("*.json"))
    if len(detail_files) < 10:
        report.warn(label, f"Only {len(detail_files)} claim detail files (expected 30+)")
    else:
        report.passed(label, f"{len(detail_files)} claim detail files")

    # Spot-check first 3
    required_detail_keys = [
        "claim", "momentum", "salience", "friction", "persistence",
        "arousal", "expressibility", "exposure", "provenance",
        "supply_chain", "coordination",
    ]
    for df in detail_files[:3]:
        with open(df) as f:
            detail = json.load(f)
        for key in required_detail_keys:
            if key not in detail:
                report.fail(label, f"Claim detail {df.name} missing key: {key}")


def check_timeline_data(report: Report, topic_id: str):
    """Validate timeline files."""
    label = f"[post] {topic_id}"

    for window in ["6h", "24h", "7d"]:
        path = DATA_DIR / "metrics" / topic_id / f"timeline_{window}.json"
        if not path.exists():
            report.fail(label, f"timeline_{window}.json not found")
            continue

        with open(path) as f:
            data = json.load(f)

        events = data.get("events", [])
        if len(events) < 3:
            report.warn(label, f"timeline_{window}: only {len(events)} events")

        # Check event types are valid
        valid_types = {
            "momentum_spike", "divergence_shift", "coordination_flag",
            "contestation_emergence", "claim_dark", "arousal_escalation",
            "phase_transition", "lead_lag", "vocabulary_rotation",
        }
        for evt in events:
            if evt.get("type") not in valid_types:
                report.warn(label, f"timeline_{window}: unknown event type: {evt.get('type')}")

    report.passed(label, "Timeline files valid")


def check_geo_data(report: Report, topic_id: str):
    """Validate geo data files."""
    label = f"[post] {topic_id}"
    path = DATA_DIR / "geo" / f"{topic_id}.json"

    if not path.exists():
        report.warn(label, "geo/ data not found")
        return

    with open(path) as f:
        data = json.load(f)

    clusters = data.get("geo_clusters", [])
    if len(clusters) < 2:
        report.warn(label, f"Only {len(clusters)} geo clusters")
    else:
        total_regions = sum(len(c.get("regions", [])) for c in clusters)
        report.passed(label, f"Geo: {len(clusters)} clusters, {total_regions} total regions")


def check_discourse_data(report: Report, topic_id: str):
    """Validate discourse feed data."""
    label = f"[post] {topic_id}"
    path = DATA_DIR / "discourse" / f"{topic_id}.json"

    if not path.exists():
        report.warn(label, "discourse/ data not found")
        return

    with open(path) as f:
        posts = json.load(f)

    if len(posts) < 20:
        report.warn(label, f"Only {len(posts)} discourse posts (expected 30+)")
    else:
        report.passed(label, f"Discourse: {len(posts)} posts")

    # Check posts have required fields
    for post in posts[:5]:
        for field in ["platform", "username", "text", "cluster_id"]:
            if field not in post:
                report.fail(label, f"Discourse post missing field: {field}")
                break


def check_sparkline_lengths(report: Report, topic_id: str):
    """Check sparkline arrays have correct lengths."""
    label = f"[post] {topic_id}"

    # Check landscape metrics sparklines (should be 8)
    path = DATA_DIR / "metrics" / topic_id / "landscape_24h.json"
    if not path.exists():
        return

    with open(path) as f:
        data = json.load(f)

    # Check IFI sparkline (should be 12)
    ifi = data.get("topic_metrics", {}).get("ifi", {})
    sparkline = ifi.get("sparkline", [])
    if len(sparkline) != 12:
        report.warn(label, f"IFI sparkline has {len(sparkline)} points (expected 12)")

    # Check activity sparkline in topics.json (should be 12)
    topics_path = DATA_DIR / "topics.json"
    if topics_path.exists():
        with open(topics_path) as f:
            topics = json.load(f)
        topic = next((t for t in topics if t["id"] == topic_id), None)
        if topic:
            act_sparkline = topic.get("activity_sparkline", [])
            if len(act_sparkline) != 12:
                report.warn(label, f"Activity sparkline has {len(act_sparkline)} points (expected 12)")


def run_post_checks(report: Report, topic_ids: list):
    """Run all post-generation checks."""
    check_topics_json(report)

    for topic_id in topic_ids:
        check_landscape_data(report, topic_id)
        check_compare_data(report, topic_id)
        check_claim_details(report, topic_id)
        check_timeline_data(report, topic_id)
        check_geo_data(report, topic_id)
        check_discourse_data(report, topic_id)
        check_sparkline_lengths(report, topic_id)


# ============================================================================
# MAIN
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description="Verify narrative monitoring data")
    parser.add_argument("--pre", action="store_true", help="Run pre-generation checks only")
    parser.add_argument("--post", action="store_true", help="Run post-generation checks only")
    parser.add_argument("--topic", type=str, help="Check single topic")
    args = parser.parse_args()

    # Default: run both
    run_pre = not args.post or args.pre
    run_post = not args.pre or args.post
    if not args.pre and not args.post:
        run_pre = True
        run_post = True

    topic_ids = [args.topic] if args.topic else TOPIC_ORDER

    report = Report()

    if run_pre:
        print("Running pre-generation checks...")
        run_pre_checks(report, topic_ids)

    if run_post:
        print("Running post-generation checks...")
        run_post_checks(report, topic_ids)

    exit_code = report.print_report()
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
