"""
WorldPop / Population Density reference data loader.
Reads existing data/geo/us-states.json density field.
Produces data/reference/population_density.json for salience weighting.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import List

from . import register
from .base import BaseIngester


@register
class WorldPopIngester(BaseIngester):
    source_name = "worldpop"
    source_type = "event_signal"  # categorization doesn't matter — this is reference data
    is_signal = True  # use signal path so _write_output works, but output goes to reference/

    def ingest(self, topic_id: str, keywords: List[str], **kwargs) -> list:
        """Load US state population density from existing geo data.
        Writes to data/reference/population_density.json (one-time).
        Returns empty list (no signals to emit — this is reference data)."""

        geo_path = self.data_dir / "geo" / "us-states.json"
        if not geo_path.exists():
            print("    data/geo/us-states.json not found")
            return []

        ref_dir = self.data_dir / "reference"
        ref_dir.mkdir(parents=True, exist_ok=True)
        out_path = ref_dir / "population_density.json"

        # Only regenerate if missing
        if out_path.exists():
            return []

        geo_data = json.loads(geo_path.read_text())
        density_map = {}

        # us-states.json is a GeoJSON FeatureCollection
        features = geo_data.get("features", [])
        for feature in features:
            props = feature.get("properties", {})
            name = props.get("name", "")
            density = props.get("density", 0)
            if name:
                key = name.lower().replace(" ", "_")
                density_map[key] = {
                    "name": name,
                    "density": density,
                }

        if density_map:
            out_path.write_text(json.dumps(density_map, indent=2))
            print(f"    Wrote {out_path} ({len(density_map)} states)")

        return []  # No signals — this is reference data

    def health_check(self) -> dict:
        geo_path = self.data_dir / "geo" / "us-states.json"
        return {
            "ok": geo_path.exists(),
            "message": f"us-states.json {'found' if geo_path.exists() else 'missing'}",
        }
