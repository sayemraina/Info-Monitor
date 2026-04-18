"""
Congress.gov API ingester.
Bills, votes, hearings — policy actions narratives form around.
Free API key from api.congress.gov/sign-up/
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import List

import requests

from . import register
from .base import BaseIngester

SCRIPTS_DIR = Path(__file__).parent.parent
TOPIC_KEYWORDS = json.loads((SCRIPTS_DIR / "topic_keywords.json").read_text())

CONGRESS_API = "https://api.congress.gov/v3"


@register
class CongressIngester(BaseIngester):
    source_name = "congress"
    source_type = "government"
    is_signal = True

    def ingest(self, topic_id: str, keywords: List[str], **kwargs) -> list:
        api_key = os.environ.get("CONGRESS_API_KEY", "")
        if not api_key:
            print("    CONGRESS_API_KEY not set — get free key at api.congress.gov/sign-up/")
            return []

        signals = []

        for kw in keywords[:2]:
            try:
                params = {"query": kw, "limit": 10, "sort": "updateDate+desc", "api_key": api_key}
                resp = requests.get(f"{CONGRESS_API}/bill", params=params,
                                    headers={"Accept": "application/json"}, timeout=15)
                if resp.status_code != 200:
                    continue

                bills = resp.json().get("bills", [])

                for bill in bills:
                    title = bill.get("title", "")
                    if not title:
                        continue

                    bill_type = bill.get("type", "")
                    bill_num = bill.get("number", "")
                    congress = bill.get("congress", "")
                    bill_id = f"{bill_type}{bill_num}-{congress}"

                    latest_action = bill.get("latestAction", {})
                    action_text = latest_action.get("text", "")
                    action_date = latest_action.get("actionDate", "")

                    action_lower = action_text.lower()
                    if "passed" in action_lower or "agreed" in action_lower:
                        signal_type, severity = "bill_passed", "high"
                    elif "vote" in action_lower or "yea" in action_lower:
                        signal_type, severity = "bill_vote", "medium"
                    else:
                        signal_type, severity = "bill_action", "low"

                    sig = self.make_signal(
                        id=f"congress_{bill_id}_{action_date or 'unknown'}",
                        source="congress",
                        source_type="government",
                        signal_type=signal_type,
                        title=f"{bill_id}: {title[:150]}",
                        summary=f"Latest action ({action_date}): {action_text}" if action_text else f"Bill updated",
                        timestamp=f"{action_date}T00:00:00Z" if action_date else self.now_iso(),
                        severity=severity,
                        url=f"https://www.congress.gov/bill/{congress}th-congress/{bill_type.lower()}-bill/{bill_num}",
                        topic_relevance=[topic_id],
                        metadata={"bill_id": bill_id, "keyword": kw},
                    )
                    signals.append(sig)

                time.sleep(0.5)
            except Exception as e:
                print(f"    Warning: Congress search '{kw}' failed: {e}")

        seen = set()
        return [s for s in signals if s["id"] not in seen and not seen.add(s["id"])]

    def health_check(self) -> dict:
        api_key = os.environ.get("CONGRESS_API_KEY", "")
        if not api_key:
            return {"ok": False, "message": "CONGRESS_API_KEY not set"}
        try:
            resp = requests.get(f"{CONGRESS_API}/bill", params={"limit": 1, "api_key": api_key},
                                headers={"Accept": "application/json"}, timeout=10)
            return {"ok": resp.status_code == 200, "message": "Congress.gov API reachable"}
        except Exception as e:
            return {"ok": False, "message": str(e)}
