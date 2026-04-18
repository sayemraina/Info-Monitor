"""
GDELT Events + Doc API ingester.
Real-time global news events. Free, no auth, updates every 15 min.
"""

from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import List

import requests

from . import register
from .base import BaseIngester

SCRIPTS_DIR = Path(__file__).parent.parent
TOPIC_KEYWORDS = json.loads((SCRIPTS_DIR / "topic_keywords.json").read_text())

GDELT_DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc"


@register
class GDELTIngester(BaseIngester):
    source_name = "gdelt"
    source_type = "event_signal"
    is_signal = True

    def ingest(self, topic_id: str, keywords: List[str], **kwargs) -> list:
        signals = []

        for kw in keywords[:3]:
            try:
                params = {
                    "query": kw,
                    "mode": "artlist",
                    "maxrecords": "20",
                    "format": "json",
                    "sort": "datedesc",
                }
                resp = requests.get(GDELT_DOC_API, params=params, timeout=15)
                if resp.status_code != 200:
                    continue

                data = resp.json()
                articles = data.get("articles", [])

                for art in articles:
                    url = art.get("url", "")
                    title = art.get("title", "")
                    if not title or not url:
                        continue

                    url_hash = self.content_hash(url)[:12]

                    tone = art.get("tone", 0)
                    if isinstance(tone, str):
                        try:
                            tone = float(tone.split(",")[0])
                        except (ValueError, IndexError):
                            tone = 0.0

                    severity = "high" if abs(tone) > 5 else "medium" if abs(tone) > 2 else "low"

                    seendate = art.get("seendate", "")
                    ts = ""
                    if seendate and len(seendate) >= 14:
                        try:
                            ts = f"{seendate[:4]}-{seendate[4:6]}-{seendate[6:8]}T{seendate[8:10]}:{seendate[10:12]}:{seendate[12:14]}Z"
                        except Exception:
                            ts = self.now_iso()

                    domain = art.get("domain", "")

                    sig = self.make_signal(
                        id=f"gdelt_{url_hash}",
                        source="gdelt",
                        source_type="event_signal",
                        signal_type="news_event",
                        title=title[:200],
                        summary=f"Reported by {domain}. Tone: {tone:+.1f}.",
                        timestamp=ts or self.now_iso(),
                        severity=severity,
                        value=round(tone, 2),
                        url=url,
                        topic_relevance=[topic_id],
                        metadata={"domain": domain, "tone": round(tone, 2), "keyword": kw},
                    )
                    signals.append(sig)

                time.sleep(1)
            except Exception as e:
                print(f"    Warning: GDELT query '{kw}' failed: {e}")

        seen = set()
        return [s for s in signals if s["id"] not in seen and not seen.add(s["id"])][:50]

    def health_check(self) -> dict:
        try:
            resp = requests.get(GDELT_DOC_API, params={
                "query": "test", "mode": "artlist", "maxrecords": "1", "format": "json"
            }, timeout=10)
            return {"ok": resp.status_code == 200, "message": "GDELT API reachable"}
        except Exception as e:
            return {"ok": False, "message": str(e)}
