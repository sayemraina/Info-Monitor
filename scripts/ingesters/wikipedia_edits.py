"""
Wikipedia Recent Changes ingester.
Detects edit velocity and edit wars on topic-relevant articles.
"""

from __future__ import annotations

import json
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List

import requests

from . import register
from .base import BaseIngester

SCRIPTS_DIR = Path(__file__).parent.parent
TOPIC_KEYWORDS = json.loads((SCRIPTS_DIR / "topic_keywords.json").read_text())

MW_API = "https://en.wikipedia.org/w/api.php"


@register
class WikipediaEditsIngester(BaseIngester):
    source_name = "wikipedia"
    source_type = "event_signal"
    is_signal = True

    def ingest(self, topic_id: str, keywords: List[str], **kwargs) -> list:
        config = TOPIC_KEYWORDS.get(topic_id, {})
        articles = config.get("wiki_articles", [])
        if not articles:
            return []

        signals = []
        now = datetime.now(timezone.utc)
        since = (now - timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M:%SZ")

        for article_title in articles:
            try:
                params = {
                    "action": "query",
                    "list": "recentchanges",
                    "rctitle": article_title.replace("_", " "),
                    "rclimit": 50,
                    "rcprop": "user|timestamp|comment|sizes",
                    "rcend": since,
                    "format": "json",
                }
                headers = {"User-Agent": "InfoMonitor/1.0 (research@infomonitor.app)"}
                resp = requests.get(MW_API, params=params, headers=headers, timeout=10)
                resp.raise_for_status()
                data = resp.json()

                changes = data.get("query", {}).get("recentchanges", [])
                if not changes:
                    continue

                edit_count = len(changes)
                revert_count = sum(
                    1 for c in changes
                    if any(w in (c.get("comment", "").lower()) for w in ["revert", "undo", "rv ", "undid"])
                )

                # Only emit if notable activity
                if edit_count < 3:
                    continue

                display_title = article_title.replace("_", " ")

                if revert_count >= 3:
                    signal_type = "edit_war"
                    severity = "high"
                    title = f"Edit war on '{display_title}' — {revert_count} reverts in 24h"
                    summary = f"{edit_count} edits with {revert_count} reverts on Wikipedia article '{display_title}' in the last 24 hours. High revert rate indicates active narrative contestation."
                elif edit_count >= 10:
                    signal_type = "edit_velocity"
                    severity = "medium"
                    title = f"High edit activity on '{display_title}' — {edit_count} edits in 24h"
                    summary = f"{edit_count} edits on Wikipedia article '{display_title}' in the last 24 hours, indicating elevated interest and potential narrative formation."
                else:
                    signal_type = "edit_velocity"
                    severity = "low"
                    title = f"Active editing on '{display_title}' — {edit_count} edits in 24h"
                    summary = f"{edit_count} edits on Wikipedia article '{display_title}' in the last 24 hours."

                sig = self.make_signal(
                    id=f"wiki_{article_title}_{now.strftime('%Y%m%d')}",
                    source="wikipedia",
                    source_type="event_signal",
                    signal_type=signal_type,
                    title=title,
                    summary=summary,
                    timestamp=now.isoformat(),
                    severity=severity,
                    value=edit_count,
                    change=revert_count,
                    url=f"https://en.wikipedia.org/wiki/{article_title}",
                    topic_relevance=[topic_id],
                    metadata={
                        "article": article_title,
                        "edit_count_24h": edit_count,
                        "revert_count_24h": revert_count,
                        "unique_editors": len(set(c.get("user", "") for c in changes)),
                    },
                )
                signals.append(sig)

                time.sleep(0.5)  # polite

            except Exception as e:
                print(f"    Warning: Wikipedia {article_title} failed: {e}")
                continue

        return signals

    def health_check(self) -> dict:
        try:
            resp = requests.get(MW_API, params={
                "action": "query", "meta": "siteinfo", "format": "json"
            }, headers={"User-Agent": "InfoMonitor/1.0 (research@infomonitor.app)"}, timeout=5)
            return {"ok": resp.status_code == 200, "message": "MediaWiki API reachable"}
        except Exception as e:
            return {"ok": False, "message": str(e)}
