"""
generate_real_feeds.py — Build discourse feed + geo data from real ingested data.

Replaces synthetic discourse/geo with real data:
1. Discourse feed: real posts from normalized/ mapped to nearest cluster
2. Geo data: cluster-based geo distribution using US metro locations

Usage:
    python scripts/generate_real_feeds.py --topic immigration
    python scripts/generate_real_feeds.py --all
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import sys
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

# US metro areas with MSA population weights (2024 estimates, millions)
US_METROS = {
    "new-york":       {"coords": (40.7128, -74.0060),  "pop": 19.6},
    "los-angeles":    {"coords": (34.0522, -118.2437),  "pop": 12.9},
    "chicago":        {"coords": (41.8781, -87.6298),   "pop": 9.4},
    "dallas":         {"coords": (32.7767, -96.7970),   "pop": 8.1},
    "houston":        {"coords": (29.7604, -95.3698),   "pop": 7.3},
    "washington-dc":  {"coords": (38.9072, -77.0369),   "pop": 6.4},
    "atlanta":        {"coords": (33.7490, -84.3880),   "pop": 6.3},
    "miami":          {"coords": (25.7617, -80.1918),   "pop": 6.2},
    "phoenix":        {"coords": (33.4484, -112.0740),  "pop": 5.1},
    "boston":          {"coords": (42.3601, -71.0589),   "pop": 4.9},
    "san-francisco":  {"coords": (37.7749, -122.4194),  "pop": 4.6},
    "detroit":        {"coords": (42.3314, -83.0458),   "pop": 4.3},
    "seattle":        {"coords": (47.6062, -122.3321),  "pop": 4.0},
    "minneapolis":    {"coords": (44.9778, -93.2650),   "pop": 3.7},
    "san-diego":      {"coords": (32.7157, -117.1611),  "pop": 3.3},
    "tampa":          {"coords": (27.9506, -82.4572),   "pop": 3.3},
    "denver":         {"coords": (39.7392, -104.9903),  "pop": 2.9},
    "charlotte":      {"coords": (35.2271, -80.8431),   "pop": 2.7},
    "san-antonio":    {"coords": (29.4241, -98.4936),   "pop": 2.6},
    "portland":       {"coords": (45.5152, -122.6784),  "pop": 2.5},
    "austin":         {"coords": (30.2672, -97.7431),   "pop": 2.4},
    "pittsburgh":     {"coords": (40.4406, -79.9959),   "pop": 2.4},
    "columbus":       {"coords": (39.9612, -82.9988),   "pop": 2.2},
    "kansas-city":    {"coords": (39.0997, -94.5786),   "pop": 2.2},
    "nashville":      {"coords": (36.1627, -86.7816),   "pop": 2.0},
    "raleigh":        {"coords": (35.7796, -78.6382),   "pop": 1.5},
    "memphis":        {"coords": (35.1495, -90.0490),   "pop": 1.3},
    "salt-lake-city": {"coords": (40.7608, -111.8910),  "pop": 1.3},
    "tucson":         {"coords": (32.2226, -110.9747),   "pop": 1.05},
    "el-paso":        {"coords": (31.7619, -106.4850),   "pop": 0.87},
}

# Topic-specific metro affinity multipliers (on top of population weight)
TOPIC_GEO_AFFINITY: dict[str, dict[str, float]] = {
    "immigration": {
        "el-paso": 3.0, "san-antonio": 2.5, "houston": 2.0, "tucson": 2.5,
        "phoenix": 2.0, "san-diego": 2.0, "miami": 2.5, "los-angeles": 1.5,
    },
    "housing-crisis": {
        "san-francisco": 3.0, "los-angeles": 2.5, "new-york": 2.0, "seattle": 2.0,
        "boston": 2.0, "denver": 2.0, "austin": 2.5, "miami": 1.8,
    },
    "ai-workplace": {
        "san-francisco": 3.0, "seattle": 2.5, "new-york": 2.0, "austin": 2.0,
        "boston": 1.8, "washington-dc": 1.5,
    },
    "ai-bubble": {
        "san-francisco": 3.0, "seattle": 2.5, "new-york": 2.0, "austin": 2.0,
        "boston": 1.8,
    },
    "dei-rollbacks": {
        "atlanta": 2.0, "washington-dc": 2.0, "new-york": 1.5, "chicago": 1.5,
        "houston": 1.5, "dallas": 1.3,
    },
    "israel-palestine": {
        "new-york": 2.5, "washington-dc": 2.0, "chicago": 1.5, "los-angeles": 1.5,
        "miami": 1.5, "detroit": 1.5,
    },
}


def generate_discourse(topic_id: str) -> None:
    """Build discourse feed from real ingested posts mapped to clusters."""
    norm_dir = DATA_DIR / "raw" / topic_id / "normalized"
    clusters_path = DATA_DIR / "claims" / topic_id / "clusters.json"
    extracted_path = DATA_DIR / "claims" / topic_id / "extracted.json"

    if not norm_dir.exists():
        print(f"  No normalized data for {topic_id}")
        return
    if not clusters_path.exists():
        print(f"  No clusters for {topic_id}")
        return

    clusters = json.loads(clusters_path.read_text())
    cluster_map = {c["id"]: c for c in clusters}

    # Load clustered claims to map content_hash -> cluster_id
    # source_document_id is a content hash (sha256[:16]), not the raw doc ID
    clustered_path = DATA_DIR / "claims" / topic_id / "clustered.json"
    doc_to_cluster = {}
    if clustered_path.exists():
        claims = json.loads(clustered_path.read_text())
        for claim in claims:
            doc_id = claim.get("source_document_id", "")
            cid = claim.get("cluster_id", "")
            if doc_id and cid:
                doc_to_cluster[doc_id] = cid

    # Build discourse posts from raw data
    posts = []
    platform_map = {"x": "x", "bluesky": "bluesky", "reddit": "reddit", "youtube": "youtube"}

    for norm_file in sorted(norm_dir.glob("*.json")):
        try:
            docs = json.loads(norm_file.read_text())
        except (json.JSONDecodeError, IOError):
            continue

        for doc in docs:
            platform_raw = doc.get("platform", doc.get("source", "unknown"))
            platform = platform_map.get(platform_raw, platform_raw)
            if platform not in ("x", "reddit", "bluesky", "youtube"):
                # Skip RSS/NewsAPI for discourse feed — those are elite media
                continue

            doc_id = doc.get("id", "")
            content = doc.get("content", "")
            if not content or len(content) < 20:
                continue

            # Map to cluster via raw doc ID
            cluster_id = doc_to_cluster.get(doc_id, "")

            # Build system tags
            tags = []
            if cluster_id and cluster_id in cluster_map:
                cl = cluster_map[cluster_id]
                tags.append(f"\u2192 {cl['label'][:40]} cluster")
                if cl.get("arousal_trend") == "warming":
                    tags.append("\ud83d\udd25 arousal: high")
                elif cl.get("arousal_value", 0) > 0.6:
                    tags.append("\ud83d\udd25 arousal: high")
                elif cl.get("arousal_value", 0) > 0.3:
                    tags.append("arousal: medium")
                if cl.get("mutation_direction") == "radicalizing":
                    tags.append("\ud83d\udcc8 momentum spike")

            author = doc.get("author", "unknown")
            if platform == "x" and not author.startswith("@"):
                author = f"@{author}"
            elif platform == "reddit" and not author.startswith("u/"):
                author = f"u/{author}"

            # Truncate long posts, clean surrogates
            text = content[:280] if platform == "x" else content[:500]
            text = text.encode("utf-8", errors="replace").decode("utf-8")

            posts.append({
                "platform": platform,
                "username": author,
                "text": text,
                "cluster_id": cluster_id,
                "system_tags": tags,
                "extracted_at": doc.get("timestamp", datetime.utcnow().isoformat() + "Z"),
            })

    # Sort by timestamp descending, take top 50
    posts.sort(key=lambda p: p["extracted_at"], reverse=True)
    posts = posts[:50]

    out_path = DATA_DIR / "discourse" / f"{topic_id}.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # Use ensure_ascii=True to avoid surrogate encoding issues from tweet text
    out_path.write_text(json.dumps(posts, indent=2, ensure_ascii=True))
    print(f"  Wrote {len(posts)} discourse posts to {out_path}")


def generate_geo(topic_id: str) -> None:
    """Build geo data from real clusters + population-weighted US metro distribution."""
    clusters_path = DATA_DIR / "claims" / topic_id / "clusters.json"
    if not clusters_path.exists():
        print(f"  No clusters for {topic_id}")
        return

    clusters = json.loads(clusters_path.read_text())
    random.seed(42 + hash(topic_id) % 1000)  # topic-specific deterministic seed

    # Build weighted metro list for this topic
    affinity = TOPIC_GEO_AFFINITY.get(topic_id, {})
    metro_names = list(US_METROS.keys())
    weights = [
        US_METROS[name]["pop"] * affinity.get(name, 1.0)
        for name in metro_names
    ]

    geo_clusters = []

    clusters_by_size = sorted(clusters, key=lambda c: c.get("member_count", 0), reverse=True)
    top_clusters = clusters_by_size[:8]
    for rank_idx, cluster in enumerate(top_clusters):  # Top 8 clusters by member count for geo
        n_regions = random.randint(3, min(8, len(metro_names)))

        # Population-weighted selection (deduplicated)
        selected_names: set = set()
        attempts = 0
        while len(selected_names) < n_regions and attempts < n_regions * 3:
            pick = random.choices(metro_names, weights=weights, k=1)[0]
            selected_names.add(pick)
            attempts += 1

        # Signed momentum from mutation direction (maps to 5-color scale)
        direction = cluster.get("mutation_direction", "stable")
        magnitude = cluster.get("mutation_magnitude", 0.5)
        if direction == "radicalizing":
            base_momentum = 0.3 + magnitude * 0.6       # +0.3 to +0.9 → amber/red
        elif direction == "mainstreaming":
            base_momentum = -(0.3 + magnitude * 0.6)    # -0.9 to -0.3 → teal/blue
        elif direction == "fragmenting":
            base_momentum = 0.1 + magnitude * 0.4       # +0.1 to +0.5 → silver/amber
        else:  # "stable"
            base_momentum = (magnitude - 0.5) * 0.6     # -0.3 to +0.3 → teal/silver/amber

        # Salience proportional to cluster rank (rank 0 = largest = most salient)
        # This ensures top 3 labels shown on the map = 3 largest/most significant clusters
        rank_salience = 0.92 - (rank_idx / max(len(top_clusters), 1)) * 0.55

        regions = []
        for name in selected_names:
            info = US_METROS[name]
            lat, lng = info["coords"]
            regions.append({
                "lat": lat + random.uniform(-0.3, 0.3),
                "lng": lng + random.uniform(-0.3, 0.3),
                "radius_km": random.randint(80, 250),
                "salience": round(max(0.3, min(0.95, rank_salience + random.uniform(-0.04, 0.04))), 2),
                "momentum": round(max(-1.0, min(1.0, base_momentum + random.uniform(-0.15, 0.15))), 2),
            })

        geo_clusters.append({
            "cluster_id": cluster["id"],
            "cluster_label": cluster["label"][:50],
            "regions": regions,
        })

    geo_data = {
        "topic_id": topic_id,
        "geo_clusters": geo_clusters,
    }

    out_path = DATA_DIR / "geo" / f"{topic_id}.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(geo_data, indent=2, ensure_ascii=False))
    print(f"  Wrote {len(geo_clusters)} geo clusters to {out_path}")


def main():
    parser = argparse.ArgumentParser(description="Generate discourse feed + geo data from real data")
    parser.add_argument("--topic", type=str, help="Topic ID")
    parser.add_argument("--all", action="store_true", help="All topics")
    args = parser.parse_args()

    kw_path = Path(__file__).parent / "topic_keywords.json"
    topics = list(json.loads(kw_path.read_text()).keys()) if kw_path.exists() else []

    target_topics = topics if args.all else ([args.topic] if args.topic else [])
    if not target_topics:
        parser.print_help()
        return

    for tid in target_topics:
        print(f"\nGenerating feeds: {tid}")
        generate_discourse(tid)
        generate_geo(tid)


if __name__ == "__main__":
    main()
