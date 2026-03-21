#!/usr/bin/env python3
"""
Fix geo_hotspots in archetype files based on narrative analysis.

Targeted corrections for cities that don't make narrative sense for their topic/archetype.
"""
import json
import os

ARCHETYPE_DIR = os.path.join(os.path.dirname(__file__), "archetypes")


def fix_file(filename, fixes):
    """Apply fixes to a specific archetype file.

    fixes: list of (archetype_index, new_geo_hotspots) tuples
    """
    path = os.path.join(ARCHETYPE_DIR, filename)
    with open(path) as f:
        data = json.load(f)

    for idx, new_hotspots in fixes:
        old = data["archetypes"][idx]["geo_hotspots"]
        concept = data["archetypes"][idx].get("concept", "?")
        print(f"  [{idx}] {concept}: {old} -> {new_hotspots}")
        data["archetypes"][idx]["geo_hotspots"] = new_hotspots

    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"  Written: {path}")


def main():
    # ===== CRYPTO =====
    print("\n=== crypto-digital-money.json ===")
    fix_file("crypto-digital-money.json", [
        # [0] ETF legitimacy (spike) — This is about SEC/BlackRock/Fidelity financial products
        # detroit, cleveland, birmingham, cincinnati are industrial cities with no crypto ETF connection
        # Replace with finance/crypto hubs
        (0, ["nyc", "chicago", "sf", "miami", "boston", "salt-lake", "denver", "austin", "dc"]),

        # [1] Price validation (rising) — BTC hitting $100K celebration
        # memphis, richmond are random; columbus is weak
        # Replace with crypto-enthusiast cities
        (1, ["nyc", "sf", "miami", "las-vegas", "austin", "la", "salt-lake", "denver", "nashville"]),

        # [7] Mining energy (stable) — Bitcoin mining uses renewable energy
        # columbus is odd for mining discourse; raleigh is weak
        # Mining happens in TX (cheap power), Mountain West, Pacific NW (hydro)
        (7, ["houston", "salt-lake", "austin", "denver", "portland", "sf", "phoenix", "omaha", "kansas-city"]),
    ])

    # ===== ISRAEL-PALESTINE =====
    print("\n=== israel-palestine.json ===")
    fix_file("israel-palestine.json", [
        # [0] Gaza civilian casualties (rising) — humanitarian crisis discourse
        # dallas, denver, las-vegas, nashville have no strong connection
        # Should be: media centers, diaspora communities, progressive activist cities
        (0, ["nyc", "dc", "la", "dearborn", "chicago", "minneapolis", "boston", "sf", "philly"]),

        # [1] UNRWA funding (stable) — international aid/policy discourse
        # austin, charlotte, tampa are random; missing DC and NYC (UN HQ!)
        (1, ["dc", "nyc", "chicago", "boston", "minneapolis", "dearborn", "sf", "philly", "la"]),

        # [2] Oct 7 self-defense (spike) — Jewish community response
        # memphis, birmingham have no connection; missing NYC (largest Jewish population!)
        (2, ["nyc", "la", "miami", "boston", "philly", "chicago", "dc", "atlanta", "cleveland"]),

        # [4] Columbia protests (spike) — campus encampments
        # Missing NYC (where Columbia IS!); richmond, columbus are weak
        (4, ["nyc", "la", "chicago", "boston", "sf", "philly", "minneapolis", "dc", "pittsburgh"]),

        # [5] Antisemitism on campus (stable)
        # cleveland, richmond are weak for this discourse
        (5, ["nyc", "dc", "la", "boston", "chicago", "philly", "miami", "atlanta", "sf"]),

        # [7] SA genocide case (rising)
        # rochester is odd
        (7, ["nyc", "dc", "chicago", "la", "philly", "dearborn", "houston", "atlanta", "sf"]),

        # [8] Hostage deal (declining)
        # kansas-city, indianapolis are weak
        (8, ["nyc", "dc", "la", "miami", "chicago", "philly", "boston", "atlanta", "sf"]),

        # [9] US vetoes (stable) — US foreign policy discourse
        # kansas-city, indianapolis are weak
        (9, ["dc", "nyc", "chicago", "sf", "la", "dearborn", "minneapolis", "detroit", "boston"]),

        # [10] Amnesty genocide report (rising)
        # richmond is odd
        (10, ["dc", "nyc", "chicago", "sf", "la", "miami", "dearborn", "boston", "atlanta"]),

        # [11] Media bias (stable)
        # kansas-city is odd
        (11, ["dc", "nyc", "la", "chicago", "philly", "dearborn", "houston", "atlanta", "sf"]),

        # [12] Journalist deaths (declining)
        # cleveland, rochester, indianapolis are odd for press freedom discourse
        (12, ["dc", "nyc", "la", "sf", "chicago", "minneapolis", "dearborn", "boston", "philly"]),

        # [13] UN statehood vote (stable)
        # kansas-city, richmond, indianapolis are odd
        (13, ["dc", "nyc", "chicago", "sf", "la", "minneapolis", "philly", "dearborn", "boston"]),
    ])

    # ===== OZEMPIC =====
    print("\n=== ozempic-glp1.json ===")
    fix_file("ozempic-glp1.json", [
        # [7] Celebrity access divide (spike) — Oprah/celebrity use
        # memphis, birmingham are odd for celebrity discourse
        # Should focus on entertainment/media/wealthy metros
        (7, ["la", "nyc", "miami", "sf", "atlanta", "nashville", "dc", "boston", "new-orleans"]),

        # [10] Zepbound/Lilly competition (rising)
        # memphis is odd; Eli Lilly is headquartered in Indianapolis
        (10, ["boston", "sf", "nyc", "houston", "chicago", "nashville", "indianapolis", "austin", "dc"]),
    ])

    # ===== DEI ROLLBACKS =====
    print("\n=== dei-rollbacks.json ===")
    fix_file("dei-rollbacks.json", [
        # [3] Big Tech DEI cuts (rising) — Google/Meta layoffs
        # indianapolis is odd for tech DEI; columbus is weak
        # Should be tech HQ cities
        (3, ["sf", "seattle", "austin", "la", "nyc", "pittsburgh", "raleigh", "portland", "denver"]),

        # [12] Performative cycle (rising) — corporate rebranding
        # Could use more geographic spread into Pacific NW
        # Actually fine as-is, skip
    ])

    print("\nDone! Now regenerate geo data with: python scripts/generate_level0_data.py")


if __name__ == "__main__":
    main()
