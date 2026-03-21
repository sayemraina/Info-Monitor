#!/usr/bin/env python3
"""Generate all Level 0 redesign data: expanded topics, geo, youtube, discourse.

Derives all data from archetype files in scripts/archetypes/*.json.
No hardcoded topic definitions — everything comes from the same source
that generate_synthetic.py uses.
"""

import json
import random
import hashlib
import os
from pathlib import Path

random.seed(42)

DATA_DIR = Path(__file__).parent.parent / "data"
ARCHETYPES_DIR = Path(__file__).parent / "archetypes"

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


def gen_id(prefix: str, *parts: str) -> str:
    """Generate deterministic ID from parts — must match generate_synthetic.py."""
    h = hashlib.sha256("|".join(parts).encode()).hexdigest()[:12]
    return f"{prefix}_{h}"

# Locked topic order — must match generate_synthetic.py
TOPIC_ORDER = [
    "ai-workplace", "war-on-iran", "ozempic-glp1", "immigration",
    "housing-crisis", "israel-palestine", "crypto-digital-money",
    "inflation-cost-of-living", "dei-rollbacks", "ai-bubble",
]

# Maps momentum_pattern to numeric value (same as generate_synthetic.py)
MOMENTUM_PATTERN_VALUES = {
    "spike":     0.80,
    "rising":    0.50,
    "stable":    0.00,
    "declining": -0.45,
    "goes_dark": -0.65,
}


def load_archetype_file(topic_id: str) -> dict:
    """Load a single topic archetype definition from JSON."""
    path = ARCHETYPES_DIR / f"{topic_id}.json"
    with open(path) as f:
        return json.load(f)


def load_edge_cases() -> list:
    """Load edge case fixtures."""
    path = ARCHETYPES_DIR / "_edge_cases.json"
    if not path.exists():
        return []
    with open(path) as f:
        data = json.load(f)
    return data.get("edge_cases", [])


def build_topics_from_archetypes() -> list:
    """Build TOPICS list from archetype files with cluster info for geo/discourse."""
    edge_cases = load_edge_cases()
    topics = []

    for topic_id in TOPIC_ORDER:
        data = load_archetype_file(topic_id)
        archetypes = data["archetypes"]

        # Inject edge cases
        for ec in edge_cases:
            if ec.get("target_topic") == topic_id:
                ec_copy = {k: v for k, v in ec.items()
                           if k not in ("target_topic",) and not k.startswith("_")}
                archetypes.append(ec_copy)

        # Build cluster info from archetypes
        cluster_map = {}
        for arch in archetypes:
            cname = arch["cluster"]
            if cname not in cluster_map:
                cluster_map[cname] = {
                    "id": gen_id("clu", topic_id, cname),
                    "label": smart_title(cname),
                    "momentum": MOMENTUM_PATTERN_VALUES.get(arch["momentum_pattern"], 0.0),
                    "geo_hotspots": arch.get("geo_hotspots", []),
                    "archetypes": [],
                }
            cluster_map[cname]["archetypes"].append(arch)
            # Merge geo_hotspots from all archetypes in the cluster
            for spot in arch.get("geo_hotspots", []):
                if spot not in cluster_map[cname]["geo_hotspots"]:
                    cluster_map[cname]["geo_hotspots"].append(spot)

        # Compute weighted average momentum per cluster (not max)
        # This ensures clusters with mixed momentum patterns get intermediate colors
        for cname, cdata in cluster_map.items():
            momentum_vals = [MOMENTUM_PATTERN_VALUES.get(a["momentum_pattern"], 0.0)
                             for a in cdata["archetypes"]]
            cdata["momentum"] = sum(momentum_vals) / len(momentum_vals) if momentum_vals else 0.0

        topics.append({
            "id": data["id"],
            "name": data["name"],
            "clusters": list(cluster_map.values()),
            "archetypes": archetypes,
        })

    return topics


# Build topics from archetype files
TOPICS = build_topics_from_archetypes()


# ============================================================================
# GEOGRAPHIC DATA — US metro area mapping derived from archetype geo_hotspots
# ============================================================================

US_REGIONS = {
    "dc": {"lat": 38.9, "lng": -77.0, "name": "Washington DC"},
    "nyc": {"lat": 40.7, "lng": -74.0, "name": "New York"},
    "la": {"lat": 34.0, "lng": -118.2, "name": "Los Angeles"},
    "sf": {"lat": 37.8, "lng": -122.4, "name": "San Francisco"},
    "chicago": {"lat": 41.9, "lng": -87.6, "name": "Chicago"},
    "houston": {"lat": 29.8, "lng": -95.4, "name": "Houston"},
    "miami": {"lat": 25.8, "lng": -80.2, "name": "Miami"},
    "seattle": {"lat": 47.6, "lng": -122.3, "name": "Seattle"},
    "boston": {"lat": 42.4, "lng": -71.1, "name": "Boston"},
    "austin": {"lat": 30.3, "lng": -97.7, "name": "Austin"},
    "denver": {"lat": 39.7, "lng": -105.0, "name": "Denver"},
    "atlanta": {"lat": 33.7, "lng": -84.4, "name": "Atlanta"},
    "phoenix": {"lat": 33.4, "lng": -112.1, "name": "Phoenix"},
    "dallas": {"lat": 32.8, "lng": -96.8, "name": "Dallas"},
    "detroit": {"lat": 42.3, "lng": -83.0, "name": "Detroit"},
    "philly": {"lat": 39.9, "lng": -75.2, "name": "Philadelphia"},
    "san_diego": {"lat": 32.7, "lng": -117.2, "name": "San Diego"},
    "el_paso": {"lat": 31.8, "lng": -106.4, "name": "El Paso"},
    "tucson": {"lat": 32.2, "lng": -110.9, "name": "Tucson"},
    "portland": {"lat": 45.5, "lng": -122.7, "name": "Portland"},
    "minneapolis": {"lat": 44.98, "lng": -93.27, "name": "Minneapolis"},
    "nashville": {"lat": 36.16, "lng": -86.78, "name": "Nashville"},
    "salt_lake": {"lat": 40.76, "lng": -111.89, "name": "Salt Lake City"},
    "raleigh": {"lat": 35.78, "lng": -78.64, "name": "Raleigh"},
    "charlotte": {"lat": 35.23, "lng": -80.84, "name": "Charlotte"},
    "cleveland": {"lat": 41.50, "lng": -81.69, "name": "Cleveland"},
    "columbus": {"lat": 39.96, "lng": -82.99, "name": "Columbus"},
    "tampa": {"lat": 27.95, "lng": -82.46, "name": "Tampa"},
    "san_jose": {"lat": 37.34, "lng": -121.89, "name": "San Jose"},
    "oakland": {"lat": 37.80, "lng": -122.27, "name": "Oakland"},
    "sacramento": {"lat": 38.58, "lng": -121.49, "name": "Sacramento"},
    "norfolk": {"lat": 36.85, "lng": -76.29, "name": "Norfolk"},
    "huntsville": {"lat": 34.73, "lng": -86.59, "name": "Huntsville"},
    "rochester": {"lat": 43.16, "lng": -77.61, "name": "Rochester"},
    "pittsburgh": {"lat": 40.44, "lng": -79.99, "name": "Pittsburgh"},
    "kansas_city": {"lat": 39.10, "lng": -94.58, "name": "Kansas City"},
    "st_louis": {"lat": 38.63, "lng": -90.20, "name": "St. Louis"},
    "indianapolis": {"lat": 39.77, "lng": -86.16, "name": "Indianapolis"},
    "milwaukee": {"lat": 43.04, "lng": -87.91, "name": "Milwaukee"},
    "cincinnati": {"lat": 39.10, "lng": -84.51, "name": "Cincinnati"},
    "las_vegas": {"lat": 36.17, "lng": -115.14, "name": "Las Vegas"},
    "new_orleans": {"lat": 29.95, "lng": -90.07, "name": "New Orleans"},
    "memphis": {"lat": 35.15, "lng": -90.05, "name": "Memphis"},
    "omaha": {"lat": 41.26, "lng": -95.94, "name": "Omaha"},
    "richmond": {"lat": 37.54, "lng": -77.44, "name": "Richmond"},
    "birmingham": {"lat": 33.52, "lng": -86.80, "name": "Birmingham"},
    "dearborn": {"lat": 42.32, "lng": -83.18, "name": "Dearborn"},
}


def build_geo_mapping(topics: list) -> dict:
    """Build GEO_MAPPING from archetype geo_hotspots."""
    geo_mapping = {}

    for topic in topics:
        tid = topic["id"]
        entries = []
        for cluster in topic["clusters"]:
            # Collect all geo_hotspots from archetypes in this cluster
            all_hotspots = set()
            for arch in cluster.get("archetypes", []):
                for spot in arch.get("geo_hotspots", []):
                    # Normalize hotspot keys (handle variations like "el-paso" → "el_paso")
                    normalized = spot.replace("-", "_")
                    if normalized in US_REGIONS:
                        all_hotspots.add(normalized)

            if all_hotspots:
                # Base salience from cluster momentum
                base_salience = max(0.3, min(0.90, 0.5 + cluster["momentum"] * 0.4))
                entries.append((
                    cluster["id"],
                    list(all_hotspots),
                    round(base_salience, 2),
                ))

        geo_mapping[tid] = entries

    return geo_mapping


GEO_MAPPING = build_geo_mapping(TOPICS)


def generate_geo_data():
    """Generate data/geo/{topic_id}.json for each topic."""
    geo_dir = DATA_DIR / "geo"
    geo_dir.mkdir(parents=True, exist_ok=True)

    for topic in TOPICS:
        tid = topic["id"]
        mapping = GEO_MAPPING.get(tid, [])
        geo_clusters = []
        for cluster_id, regions, base_salience in mapping:
            # Find cluster label
            cluster_label = cluster_id
            for c in topic.get("clusters", []):
                if c["id"] == cluster_id:
                    cluster_label = c["label"]
                    break

            geo_regions = []
            for region_key in regions:
                r = US_REGIONS.get(region_key)
                if not r:
                    continue
                salience = base_salience * random.uniform(0.7, 1.0)
                # Find momentum from cluster data
                momentum = 0.5
                for c in topic.get("clusters", []):
                    if c["id"] == cluster_id:
                        momentum = c["momentum"]
                        break
                geo_regions.append({
                    "lat": r["lat"] + random.uniform(-0.3, 0.3),
                    "lng": r["lng"] + random.uniform(-0.3, 0.3),
                    "radius_km": random.randint(80, 250),
                    "salience": round(salience, 2),
                    "momentum": round(momentum, 2),
                })

            if geo_regions:
                geo_clusters.append({
                    "cluster_id": cluster_id,
                    "cluster_label": cluster_label,
                    "regions": geo_regions,
                })

        out = {"topic_id": tid, "geo_clusters": geo_clusters}
        path = DATA_DIR / "geo" / f"{tid}.json"
        path.write_text(json.dumps(out, indent=2))
        print(f"  wrote {path}")


# ============================================================================
# DISCOURSE FEED — derived from archetype texts and variations
# ============================================================================

USERNAMES_X = [
    "policy_watch_dc", "freedomfirst_99", "datadriven_takes", "citizen_analyst",
    "realpolitik_now", "truth_seeker_42", "indie_journo", "concerned_parent_3",
    "market_watcher", "civic_mind_101", "neutral_observer", "daily_digest_feed",
    "grassroots_voice", "the_contrarian", "signal_boost_dc", "factcheck_this",
    "mainst_media_watcher", "deep_state_skeptic", "policy_nerd_23", "open_source_intel",
]

USERNAMES_REDDIT = [
    "u/PolicyAnalyst2026", "u/SkepticalCitizen", "u/DataDrivenDebater", "u/GrassrootsVoice",
    "u/DeepDiveResearch", "u/ModerateCenter", "u/ConcernedVoter", "u/EconomistView",
    "u/TechPolicyWonk", "u/IndependentMind_42", "u/CriticalThinker99", "u/PublicInterestLaw",
    "u/MediaLiteracy101", "u/NuancedTakes", "u/EvidenceBased", "u/LocalPerspective",
]

USERNAMES_YOUTUBE = [
    "PolicyBreakdown", "RealTalkAnalysis", "DataDrivenChannel", "IndependentView",
    "DeepDiveMedia", "CriticalContext", "FactFirstTV", "NuancedPerspective",
]


def build_discourse_templates(topics: list) -> dict:
    """Build DISCOURSE_TEMPLATES from archetype texts and variations."""
    templates = {}

    for topic in topics:
        tid = topic["id"]
        topic_templates = []

        for cluster in topic["clusters"]:
            for arch in cluster.get("archetypes", []):
                # Build tags from archetype metadata
                tags = [f"→ {cluster['label']} cluster"]
                if arch.get("arousal") == "high":
                    tags.append("🔥 arousal: high")
                elif arch.get("arousal") == "medium":
                    tags.append("🔥 arousal: medium")
                if arch.get("momentum_pattern") == "spike":
                    tags.append("📈 momentum spike")
                if arch.get("momentum_pattern") == "goes_dark":
                    tags.append("⚠ went dark")

                # Add the base archetype text
                topic_templates.append({
                    "text": arch["text"],
                    "cluster_id": cluster["id"],
                    "tags": tags,
                    "platform": "x",  # default platform for base text
                })

                # Add platform-specific variations
                for var in arch.get("variations", []):
                    var_tags = list(tags)  # copy tags
                    topic_templates.append({
                        "text": var["text"],
                        "cluster_id": cluster["id"],
                        "tags": var_tags,
                        "platform": var.get("platform", "x"),
                    })

        templates[tid] = topic_templates

    return templates


DISCOURSE_TEMPLATES = build_discourse_templates(TOPICS)


def generate_discourse_data():
    """Generate data/discourse/{topic_id}.json for each topic."""
    discourse_dir = DATA_DIR / "discourse"
    discourse_dir.mkdir(parents=True, exist_ok=True)

    for topic in TOPICS:
        tid = topic["id"]
        all_templates = DISCOURSE_TEMPLATES.get(tid, [])
        if not all_templates:
            continue

        posts = []

        # Sample 35-50 posts from the templates (we have many more now)
        target_count = random.randint(35, 50)
        selected = random.sample(all_templates, min(target_count, len(all_templates)))

        for tmpl in selected:
            platform = tmpl.get("platform", "x")
            if platform == "youtube":
                # YouTube variations become Reddit posts in the discourse feed
                # (YouTube is influencer framing, not user discourse)
                platform = random.choice(["x", "reddit"])

            if platform == "x":
                username = random.choice(USERNAMES_X)
            elif platform == "reddit":
                username = random.choice(USERNAMES_REDDIT)
            else:
                username = random.choice(USERNAMES_X)

            posts.append({
                "platform": platform,
                "username": username,
                "text": tmpl["text"],
                "cluster_id": tmpl["cluster_id"],
                "system_tags": tmpl["tags"],
                "extracted_at": f"2026-03-{random.randint(12,16)}T{random.randint(6,23):02d}:{random.randint(0,59):02d}:00Z",
            })

        # Shuffle for natural feel
        random.shuffle(posts)

        path = DATA_DIR / "discourse" / f"{tid}.json"
        path.write_text(json.dumps(posts, indent=2))
        print(f"  wrote {path} ({len(posts)} posts)")


def generate_placeholder_youtube():
    """Generate placeholder YouTube data. Will be replaced with real video IDs later."""
    youtube_dir = DATA_DIR / "youtube"
    youtube_dir.mkdir(parents=True, exist_ok=True)

    for topic in TOPICS:
        tid = topic["id"]
        videos = []
        for i in range(5):
            videos.append({
                "video_id": f"placeholder_{tid}_{i}",
                "title": f"[Placeholder] {topic['name']} Discussion #{i+1}",
                "channel_name": random.choice([
                    "CNN", "Fox News", "MSNBC", "BBC News", "PBS NewsHour",
                    "The Hill", "CNBC", "Bloomberg", "Reuters", "Vice News",
                ]),
                "view_count": random.randint(50000, 2000000),
                "published_at": f"2026-03-{random.randint(1,15):02d}T{random.randint(8,20):02d}:00:00Z",
            })

        path = DATA_DIR / "youtube" / f"{tid}.json"
        path.write_text(json.dumps(videos, indent=2))
        print(f"  wrote {path} (placeholder — needs real video IDs)")


if __name__ == "__main__":
    print("Generating Level 0 data from archetype files...")

    print("\n1. Geographic data:")
    generate_geo_data()

    print("\n2. Discourse feed data:")
    generate_discourse_data()

    print("\n3. YouTube placeholder data:")
    generate_placeholder_youtube()

    print("\nDone! (topics.json managed by generate_synthetic.py)")
