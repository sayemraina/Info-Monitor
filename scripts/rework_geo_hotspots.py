#!/usr/bin/env python3
"""
Comprehensive rework of geo_hotspots across all 10 topics.

Problem: All topics have only 10-17 unique cities, causing some topics
(especially Israel-Palestine) to show far fewer dots on the map because
the frontend MIN_DISTANCE=1.0° filter blocks overlapping cities.

Fix: Use "core + periphery" pattern per archetype:
- 4-5 core cities per cluster (narratively essential)
- 4-5 periphery cities (geographic spread, rotated across archetypes)
- Target: 25-30 unique cities per topic
"""
import json
import os
from collections import defaultdict

ARCHETYPE_DIR = os.path.join(os.path.dirname(__file__), "archetypes")

# Cities ordered geographically for rotation (west→east, spread out)
# This ordering ensures consecutive picks from this list are geographically distant
GEO_ROTATION = [
    "seattle", "phoenix", "minneapolis", "miami",
    "portland", "dallas", "milwaukee", "tampa",
    "sacramento", "houston", "indianapolis", "richmond",
    "sf", "nashville", "columbus", "philly",
    "la", "atlanta", "pittsburgh", "boston",
    "san-diego", "charlotte", "cleveland", "nyc",
    "denver", "raleigh", "detroit", "dc",
    "salt-lake", "birmingham", "kansas-city", "new-orleans",
    "austin", "memphis", "omaha", "las-vegas",
    "el-paso", "st-louis", "cincinnati", "san-jose",
    "tucson", "oakland", "norfolk", "huntsville",
    "dearborn", "rochester",
]

# ============================================================
# CLUSTER CORE CITIES (4-5 per cluster, narratively essential)
# ============================================================

CLUSTER_CORES = {
    # === AI WORKPLACE ===
    "ai-workplace": {
        "job-displacement":    ["detroit", "pittsburgh", "cleveland", "chicago", "columbus"],
        "ai-augmentation":     ["sf", "seattle", "austin", "boston", "denver"],
        "creative-threat":     ["la", "nyc", "nashville", "portland", "austin"],
        "corporate-hypocrisy": ["sf", "nyc", "seattle", "chicago", "austin"],
        "productivity-gains":  ["sf", "chicago", "nyc", "boston", "dallas"],
        "historical-parallel": ["pittsburgh", "detroit", "chicago", "cleveland", "st-louis"],
        "retraining-policy":   ["dc", "chicago", "indianapolis", "raleigh", "columbus"],
    },

    # === WAR ON IRAN ===
    "war-on-iran": {
        "pro-strikes":       ["dc", "norfolk", "san-diego", "huntsville", "tampa"],
        "anti-war":          ["portland", "sf", "chicago", "minneapolis", "austin"],
        "proxy-network":     ["dc", "houston", "nyc", "la", "dearborn"],
        "diplomacy":         ["dc", "nyc", "boston", "chicago", "sf"],
        "economic-impact":   ["houston", "dallas", "la", "chicago", "nyc"],
        "escalation-fears":  ["dc", "norfolk", "san-diego", "omaha", "tampa"],
    },

    # === OZEMPIC / GLP-1 ===
    "ozempic-glp1": {
        "miracle-drug":          ["boston", "cleveland", "houston", "nyc", "nashville"],
        "pharma-profits":        ["dc", "nyc", "sf", "indianapolis", "boston"],
        "cost-access":           ["birmingham", "memphis", "new-orleans", "dallas", "houston"],
        "side-effects":          ["cleveland", "boston", "nyc", "chicago", "houston"],
        "medicalization":        ["la", "nyc", "portland", "austin", "sf"],
        "food-industry-impact":  ["omaha", "milwaukee", "kansas-city", "st-louis", "chicago"],
    },

    # === IMMIGRATION ===
    "immigration": {
        "border-security":   ["el-paso", "san-diego", "tucson", "phoenix", "houston"],
        "economic-impact":   ["nyc", "chicago", "la", "miami", "houston"],
        "cultural-identity": ["dearborn", "minneapolis", "charlotte", "nashville", "columbus"],
        "humanitarian":      ["dc", "nyc", "la", "boston", "portland"],
        "asylum-policy":     ["dc", "nyc", "miami", "el-paso", "san-diego"],
        "enforcement":       ["houston", "dallas", "phoenix", "san-diego", "atlanta"],
    },

    # === HOUSING CRISIS ===
    "housing-crisis": {
        "corporate-landlords": ["phoenix", "tampa", "atlanta", "charlotte", "las-vegas"],
        "affordability":       ["nyc", "miami", "sf", "la", "denver"],
        "nimby-yimby":         ["sf", "portland", "seattle", "minneapolis", "austin"],
        "fed-policy":          ["dc", "nyc", "sf", "chicago", "boston"],
        "homelessness":        ["la", "sf", "portland", "seattle", "las-vegas"],
        "supply-shortage":     ["austin", "denver", "raleigh", "nashville", "phoenix"],
    },

    # === ISRAEL-PALESTINE ===
    "israel-palestine": {
        "humanitarian-crisis":  ["nyc", "dc", "la", "dearborn", "sf"],
        "self-defense":         ["nyc", "la", "miami", "chicago", "philly"],
        "campus-protests":      ["nyc", "la", "boston", "sf", "chicago"],
        "accountability":       ["dc", "nyc", "la", "sf", "chicago"],
        "ceasefire-diplomacy":  ["dc", "nyc", "chicago", "philly", "dearborn"],
        "media-framing":        ["dc", "nyc", "la", "chicago", "houston"],
    },

    # === CRYPTO & DIGITAL MONEY ===
    "crypto-digital-money": {
        "btc-mainstream":      ["nyc", "chicago", "miami", "dc", "sf"],
        "defi-innovation":     ["sf", "nyc", "austin", "miami", "denver"],
        "regulation-risk":     ["dc", "nyc", "chicago", "sf", "charlotte"],
        "environmental-cost":  ["houston", "austin", "salt-lake", "denver", "portland"],
        "scam-accountability": ["sf", "nyc", "la", "miami", "las-vegas"],
        "cbdc-resistance":     ["dc", "sf", "austin", "nashville", "salt-lake"],
    },

    # === INFLATION / COST OF LIVING ===
    "inflation-cost-of-living": {
        "greedflation":          ["chicago", "nyc", "la", "houston", "atlanta"],
        "fed-policy":            ["dc", "nyc", "chicago", "sf", "boston"],
        "wage-gap":              ["birmingham", "memphis", "houston", "dallas", "phoenix"],
        "measurement-distrust":  ["nyc", "la", "chicago", "denver", "miami"],
        "political-blame":       ["dc", "phoenix", "atlanta", "dallas", "houston"],
        "consumer-squeeze":      ["la", "nyc", "miami", "chicago", "dallas"],
    },

    # === DEI ROLLBACKS ===
    "dei-rollbacks": {
        "anti-dei-merit":    ["dc", "austin", "houston", "nashville", "miami"],
        "pro-dei-equity":    ["atlanta", "dc", "nyc", "chicago", "detroit"],
        "corporate-retreat": ["sf", "seattle", "nyc", "austin", "la"],
        "campus-impact":     ["austin", "raleigh", "houston", "chicago", "minneapolis"],
        "legal-landscape":   ["dc", "nyc", "chicago", "atlanta", "richmond"],
        "rebranding":        ["nyc", "sf", "chicago", "la", "dc"],
    },

    # === AI BUBBLE ===
    "ai-bubble": {
        "bubble-warnings":        ["sf", "nyc", "boston", "chicago", "dc"],
        "real-revenue":           ["sf", "nyc", "seattle", "austin", "boston"],
        "infrastructure-spending": ["sf", "nyc", "dallas", "la", "phoenix"],
        "concentration-risk":     ["sf", "nyc", "chicago", "boston", "dc"],
        "adoption-reality":       ["chicago", "nyc", "houston", "dallas", "atlanta"],
        "deepseek-disruption":    ["sf", "nyc", "boston", "seattle", "austin"],
    },
}

# ============================================================
# PERIPHERY POOLS (15-25 cities per topic, for geographic spread)
# Ordered to maximize geographic distance between consecutive picks
# ============================================================

PERIPHERY = {
    "ai-workplace": [
        "atlanta", "phoenix", "miami", "portland", "houston",
        "minneapolis", "salt-lake", "tampa", "las-vegas", "sacramento",
        "richmond", "birmingham", "kansas-city", "milwaukee", "omaha",
        "charlotte", "san-diego", "new-orleans", "philly", "dearborn",
        "la", "denver", "raleigh", "memphis",
    ],
    "war-on-iran": [
        "seattle", "phoenix", "denver", "atlanta", "salt-lake",
        "nashville", "richmond", "dallas", "milwaukee", "raleigh",
        "sacramento", "columbus", "pittsburgh", "las-vegas", "miami",
        "cleveland", "philly", "kansas-city", "memphis", "new-orleans",
        "detroit", "minneapolis", "portland",
    ],
    "ozempic-glp1": [
        "atlanta", "miami", "tampa", "phoenix", "denver",
        "dallas", "charlotte", "las-vegas", "salt-lake", "raleigh",
        "minneapolis", "pittsburgh", "richmond", "san-diego", "columbus",
        "detroit", "seattle", "sacramento", "la", "dc",
    ],
    "immigration": [
        "austin", "denver", "tampa", "omaha", "kansas-city",
        "salt-lake", "raleigh", "las-vegas", "memphis", "milwaukee",
        "richmond", "sacramento", "seattle", "pittsburgh", "cleveland",
        "st-louis", "indianapolis", "birmingham", "sf", "new-orleans",
        "detroit",
    ],
    "housing-crisis": [
        "sacramento", "oakland", "san-jose", "tampa", "columbus",
        "pittsburgh", "cleveland", "milwaukee", "st-louis", "cincinnati",
        "dallas", "houston", "salt-lake", "richmond", "birmingham",
        "kansas-city", "omaha", "indianapolis", "charlotte", "san-diego",
        "detroit", "philly", "new-orleans", "memphis",
    ],
    "israel-palestine": [
        "atlanta", "miami", "houston", "minneapolis", "detroit",
        "cleveland", "pittsburgh", "portland", "seattle", "denver",
        "austin", "san-diego", "nashville", "columbus", "raleigh",
        "tampa", "richmond", "salt-lake", "sacramento", "new-orleans",
        "kansas-city", "milwaukee", "dallas", "phoenix", "boston",
        "omaha", "las-vegas",
    ],
    "crypto-digital-money": [
        "boston", "seattle", "la", "dallas", "tampa",
        "raleigh", "columbus", "phoenix", "atlanta", "detroit",
        "pittsburgh", "kansas-city", "omaha", "indianapolis", "sacramento",
        "richmond", "milwaukee", "minneapolis", "houston", "cleveland",
        "san-diego", "memphis", "new-orleans",
    ],
    "inflation-cost-of-living": [
        "indianapolis", "milwaukee", "kansas-city", "st-louis", "cincinnati",
        "cleveland", "tampa", "las-vegas", "austin", "nashville",
        "charlotte", "raleigh", "portland", "seattle", "omaha",
        "sacramento", "salt-lake", "richmond", "pittsburgh", "columbus",
        "detroit", "sf", "minneapolis", "san-diego",
    ],
    "dei-rollbacks": [
        "portland", "denver", "boston", "dallas", "charlotte",
        "pittsburgh", "columbus", "indianapolis", "st-louis", "birmingham",
        "milwaukee", "salt-lake", "tampa", "philly", "memphis",
        "kansas-city", "cleveland", "phoenix", "sacramento", "las-vegas",
        "omaha", "san-diego", "minneapolis", "la",
    ],
    "ai-bubble": [
        "denver", "portland", "raleigh", "pittsburgh", "detroit",
        "salt-lake", "las-vegas", "miami", "columbus", "indianapolis",
        "nashville", "la", "minneapolis", "cleveland", "tampa",
        "sacramento", "charlotte", "phoenix", "milwaukee", "kansas-city",
        "omaha", "richmond", "san-diego", "houston", "atlanta",
    ],
}


def rework_topic(topic_id):
    """Rework geo_hotspots for a single topic."""
    path = os.path.join(ARCHETYPE_DIR, f"{topic_id}.json")
    with open(path) as f:
        data = json.load(f)

    cores_map = CLUSTER_CORES[topic_id]
    periphery = PERIPHERY[topic_id]
    n_archetypes = len(data["archetypes"])

    # Track which periphery cities have been used recently
    periph_idx = 0
    all_cities = set()
    city_freq = defaultdict(int)

    for i, arch in enumerate(data["archetypes"]):
        cluster = arch["cluster"]
        cores = cores_map.get(cluster, [])[:5]

        # Fill remaining slots from periphery (rotating)
        needed = 9 - len(cores)
        selected_periphery = []
        tried = 0
        while len(selected_periphery) < needed and tried < len(periphery):
            candidate = periphery[periph_idx % len(periphery)]
            periph_idx += 1
            tried += 1
            # Don't duplicate a core city
            if candidate not in cores and candidate not in selected_periphery:
                selected_periphery.append(candidate)

        new_hotspots = cores + selected_periphery
        data["archetypes"][i]["geo_hotspots"] = new_hotspots

        for c in new_hotspots:
            all_cities.add(c)
            city_freq[c] += 1

    # Report
    max_freq = max(city_freq.values())
    max_pct = max_freq / n_archetypes * 100
    top5 = sorted(city_freq.items(), key=lambda x: -x[1])[:5]
    top5_str = ", ".join(f"{c}({n})" for c, n in top5)

    print(f"  {topic_id:30s} {len(all_cities):2d} unique cities | "
          f"max freq: {max_freq}/{n_archetypes} ({max_pct:.0f}%) | "
          f"top5: {top5_str}")

    # Write
    with open(path, "w") as f:
        json.dump(data, f, indent=2)

    return all_cities, city_freq, n_archetypes


def validate_cities():
    """Check all assigned cities exist in US_REGIONS."""
    # Read US_REGIONS from generate_level0_data.py
    gen_path = os.path.join(os.path.dirname(__file__), "generate_level0_data.py")
    with open(gen_path) as f:
        content = f.read()

    # Extract city keys (they use underscores in US_REGIONS)
    import re
    keys = re.findall(r'"(\w+)":\s*\{"lat"', content)
    us_regions = set(keys)

    # Check all cities used in our configs
    all_used = set()
    for topic_id in CLUSTER_CORES:
        for cluster, cities in CLUSTER_CORES[topic_id].items():
            for c in cities:
                all_used.add(c.replace("-", "_"))
        for c in PERIPHERY[topic_id]:
            all_used.add(c.replace("-", "_"))

    missing = all_used - us_regions
    if missing:
        print(f"\n  WARNING: Cities not in US_REGIONS: {missing}")
        return False
    print(f"\n  All {len(all_used)} city keys validated against US_REGIONS")
    return True


def main():
    print("=== Validating city keys ===")
    validate_cities()

    print("\n=== Reworking geo_hotspots ===")
    results = {}
    for topic_id in sorted(CLUSTER_CORES.keys()):
        cities, freq, n = rework_topic(topic_id)
        results[topic_id] = (len(cities), n)

    print("\n=== Summary ===")
    all_ok = True
    for topic_id, (n_cities, n_arch) in sorted(results.items()):
        status = "OK" if n_cities >= 25 else "WARN"
        if n_cities < 25:
            all_ok = False
        print(f"  {topic_id:30s} {n_cities:2d} unique cities  [{status}]")

    if all_ok:
        print("\n  All topics have ≥25 unique cities")
    else:
        print("\n  WARNING: Some topics below 25 unique cities!")

    print("\n  Now run: python3 scripts/generate_level0_data.py")


if __name__ == "__main__":
    main()
