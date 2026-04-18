"""
ACLED (Armed Conflict Location & Event Data) ingester.
Structured protest, riot, strike, and conflict data with geographic coordinates.
Free signup at acleddata.com/register (any email).
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional

import requests

from . import register
from .base import BaseIngester

SCRIPTS_DIR = Path(__file__).parent.parent
TOPIC_KEYWORDS = json.loads((SCRIPTS_DIR / "topic_keywords.json").read_text())

ACLED_AUTH = "https://api.acleddata.com/acled/read"

# Map ACLED event types to our signal types
EVENT_TYPE_MAP = {
    "Protests": "protest",
    "Riots": "riot",
    "Battles": "armed_clash",
    "Violence against civilians": "armed_clash",
    "Explosions/Remote violence": "armed_clash",
    "Strategic developments": "strategic_development",
}


@register
class ACLEDIngester(BaseIngester):
    source_name = "acled"
    source_type = "event_signal"
    is_signal = True

    def _get_token(self) -> Optional[str]:
        """Authenticate with ACLED API. Returns API key (used as token)."""
        email = os.environ.get("ACLED_EMAIL", "")
        key = os.environ.get("ACLED_PASSWORD", "")
        if not email or not key:
            print("    ACLED_EMAIL and ACLED_PASSWORD not set — register at acleddata.com/register")
            return None
        return key  # ACLED uses key+email as auth, not OAuth

    def ingest(self, topic_id: str, keywords: List[str], **kwargs) -> list:
        key = self._get_token()
        if not key:
            return []

        email = os.environ.get("ACLED_EMAIL", "")
        config = TOPIC_KEYWORDS.get(topic_id, {})
        countries = config.get("acled_countries", [])
        if not countries:
            return []

        signals = []
        date_start = (datetime.now(timezone.utc) - timedelta(days=90)).strftime("%Y-%m-%d")
        date_end = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        for country in countries:
            try:
                params = {
                    "key": key,
                    "email": email,
                    "country": country,
                    "event_date": f"{date_start}|{date_end}",
                    "event_date_where": "BETWEEN",
                    "limit": 50,
                }
                resp = requests.get(ACLED_AUTH, params=params, timeout=20)

                if resp.status_code != 200:
                    print(f"    ACLED returned {resp.status_code} for {country}")
                    continue

                data = resp.json()
                events = data.get("data", [])

                for event in events:
                    event_type = event.get("event_type", "")
                    sub_type = event.get("sub_event_type", "")
                    event_date = event.get("event_date", "")
                    location = event.get("location", "")
                    lat = event.get("latitude", "")
                    lng = event.get("longitude", "")
                    actor1 = event.get("actor1", "")
                    fatalities = int(event.get("fatalities", 0) or 0)
                    notes = event.get("notes", "")
                    event_id = event.get("event_id_cnty", "")

                    if not event_type or not event_date:
                        continue

                    signal_type = EVENT_TYPE_MAP.get(event_type, "strategic_development")

                    if fatalities > 0:
                        severity = "high"
                    elif event_type in ("Riots", "Battles", "Violence against civilians"):
                        severity = "medium"
                    else:
                        severity = "low"

                    loc_dict = None
                    if lat and lng:
                        try:
                            loc_dict = {"lat": float(lat), "lng": float(lng), "label": f"{location}, {country}"}
                        except (ValueError, TypeError):
                            pass

                    title = f"{event_type}: {sub_type}" if sub_type else event_type
                    if actor1:
                        title += f" — {actor1[:50]}"
                    if fatalities > 0:
                        title += f" ({fatalities} fatalities)"

                    sig = self.make_signal(
                        id=f"acled_{event_id}" if event_id else f"acled_{self.content_hash(f'{event_date}{location}{actor1}')[:12]}",
                        source="acled",
                        source_type="event_signal",
                        signal_type=signal_type,
                        title=title[:200],
                        summary=notes[:300] if notes else f"{event_type} in {location}, {country} on {event_date}",
                        timestamp=f"{event_date}T00:00:00Z",
                        severity=severity,
                        location=loc_dict,
                        value=fatalities if fatalities > 0 else None,
                        url=None,
                        topic_relevance=[topic_id],
                        metadata={
                            "country": country,
                            "event_type": event_type,
                            "sub_event_type": sub_type,
                            "actor1": actor1,
                            "fatalities": fatalities,
                        },
                    )
                    signals.append(sig)

                time.sleep(1)

            except Exception as e:
                print(f"    Warning: ACLED query for {country} failed: {e}")
                continue

        # Dedup
        seen = set()
        return [s for s in signals if s["id"] not in seen and not seen.add(s["id"])][:50]

    def health_check(self) -> dict:
        key = self._get_token()
        if not key:
            return {"ok": False, "message": "ACLED credentials not set"}
        email = os.environ.get("ACLED_EMAIL", "")
        try:
            resp = requests.get(ACLED_AUTH, params={
                "key": key, "email": email, "country": "United States", "limit": 1
            }, timeout=10)
            return {"ok": resp.status_code == 200, "message": "ACLED API reachable"}
        except Exception as e:
            return {"ok": False, "message": str(e)}
