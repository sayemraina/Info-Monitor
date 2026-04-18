"""
Cloudflare Radar internet outage ingester.
Detects country-level internet outages — censorship/crisis signal.
CC BY-NC 4.0 license. Free API with Cloudflare account.
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List

import requests

from . import register
from .base import BaseIngester

SCRIPTS_DIR = Path(__file__).parent.parent
TOPIC_KEYWORDS = json.loads((SCRIPTS_DIR / "topic_keywords.json").read_text())

RADAR_API = "https://api.cloudflare.com/client/v4/radar/annotations/outages"

# Country code to name
COUNTRY_NAMES = {
    "US": "United States", "IR": "Iran", "IL": "Israel", "PS": "Palestine",
    "IQ": "Iraq", "SY": "Syria", "YE": "Yemen", "LB": "Lebanon",
    "RU": "Russia", "UA": "Ukraine", "MX": "Mexico", "CN": "China",
    "MM": "Myanmar", "ET": "Ethiopia", "SD": "Sudan",
}


@register
class CloudflareRadarIngester(BaseIngester):
    source_name = "cloudflare_radar"
    source_type = "event_signal"
    is_signal = True

    def ingest(self, topic_id: str, keywords: List[str], **kwargs) -> list:
        token = os.environ.get("CLOUDFLARE_RADAR_TOKEN", "")
        if not token:
            print("    CLOUDFLARE_RADAR_TOKEN not set — create at dash.cloudflare.com → API Tokens")
            return []

        config = TOPIC_KEYWORDS.get(topic_id, {})
        country_codes = config.get("radar_countries", [])
        if not country_codes:
            return []

        signals = []
        now = datetime.now(timezone.utc)
        date_start = (now - timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")
        date_end = now.strftime("%Y-%m-%dT%H:%M:%SZ")

        try:
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }
            params = {
                "dateStart": date_start,
                "dateEnd": date_end,
                "format": "json",
            }
            resp = requests.get(RADAR_API, params=params, headers=headers, timeout=15)

            if resp.status_code == 403:
                print("    Cloudflare Radar: token lacks Radar permission")
                return []
            if resp.status_code != 200:
                print(f"    Cloudflare Radar returned {resp.status_code}")
                return []

            data = resp.json()
            annotations = data.get("result", {}).get("annotations", [])

            for ann in annotations:
                locations = ann.get("locations", "").split(",") if isinstance(ann.get("locations"), str) else []
                if not locations:
                    loc_details = ann.get("locationsDetails", [])
                    locations = [ld.get("code", "") for ld in loc_details]

                # Filter to relevant countries for this topic
                matching = [loc.strip() for loc in locations if loc.strip() in country_codes]
                if not matching:
                    continue

                outage = ann.get("outage", {})
                start_date = ann.get("startDate", "")
                end_date = ann.get("endDate", "")
                description = ann.get("description", "")

                # Compute duration
                duration_hours = None
                if start_date and end_date:
                    try:
                        start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                        end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                        duration_hours = round((end_dt - start_dt).total_seconds() / 3600, 1)
                    except (ValueError, TypeError):
                        pass

                country_names = [COUNTRY_NAMES.get(c, c) for c in matching]
                location_label = ", ".join(country_names)

                sig = self.make_signal(
                    id=f"radar_{ann.get('id', self.content_hash(f'{start_date}{location_label}')[:12])}",
                    source="cloudflare_radar",
                    source_type="event_signal",
                    signal_type="internet_outage",
                    title=f"Internet outage: {location_label}" + (f" ({duration_hours}h)" if duration_hours else ""),
                    summary=description[:300] if description else f"Internet outage detected in {location_label}. Cause: {outage.get('outageCause', 'unknown')}. Type: {outage.get('outageType', 'unknown')}.",
                    timestamp=start_date or self.now_iso(),
                    severity="high",
                    value=duration_hours,
                    location={"label": location_label},
                    topic_relevance=[topic_id],
                    metadata={
                        "countries": matching,
                        "outage_cause": outage.get("outageCause", ""),
                        "outage_type": outage.get("outageType", ""),
                        "duration_hours": duration_hours,
                    },
                )
                signals.append(sig)

        except Exception as e:
            print(f"    Warning: Cloudflare Radar failed: {e}")

        return signals

    def health_check(self) -> dict:
        token = os.environ.get("CLOUDFLARE_RADAR_TOKEN", "")
        if not token:
            return {"ok": False, "message": "CLOUDFLARE_RADAR_TOKEN not set"}
        try:
            from datetime import datetime, timezone, timedelta
            now = datetime.now(timezone.utc)
            params = {
                "dateStart": (now - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "dateEnd": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "limit": 1, "format": "json",
            }
            resp = requests.get(RADAR_API, params=params,
                                headers={"Authorization": f"Bearer {token}"}, timeout=10)
            return {"ok": resp.status_code == 200, "message": "Cloudflare Radar reachable"}
        except Exception as e:
            return {"ok": False, "message": str(e)}
