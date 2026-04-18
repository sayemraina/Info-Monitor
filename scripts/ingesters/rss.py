"""
RSS/Atom feed ingester — generic poller for news outlets and think tanks.
Covers spec sources #9 (RSS Feeds), #12-18 (think tanks).
"""

from __future__ import annotations

import json
import time
from pathlib import Path

try:
    import feedparser
except ImportError:
    feedparser = None

from . import register
from .base import BaseIngester

SCRIPTS_DIR = Path(__file__).parent.parent
MAX_PER_FEED = 10


@register
class RSSIngester(BaseIngester):
    source_name = "rss"
    source_type = "elite_media"
    is_signal = False

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        feeds_path = SCRIPTS_DIR / "rss_feeds.json"
        self.feeds = json.loads(feeds_path.read_text()) if feeds_path.exists() else []

    def ingest(self, topic_id: str, keywords: list[str], **kwargs) -> list[dict]:
        if not feedparser:
            print("    feedparser not installed — pip install feedparser")
            return []

        if not self.feeds:
            print("    No feeds configured in rss_feeds.json")
            return []

        cache = self._load_cache(topic_id)
        documents = []
        kw_lower = [k.lower() for k in keywords]

        for feed_cfg in self.feeds:
            url = feed_cfg["url"]
            feed_name = feed_cfg["name"]
            feed_source_type = feed_cfg.get("source_type", "elite_media")
            institution = feed_cfg.get("institution")

            try:
                parsed = feedparser.parse(url)
                if parsed.bozo and not parsed.entries:
                    continue

                count = 0
                for entry in parsed.entries[:30]:  # scan up to 30, take up to MAX_PER_FEED matches
                    if count >= MAX_PER_FEED:
                        break

                    title = entry.get("title", "")
                    summary = entry.get("summary", entry.get("description", ""))
                    content_text = ""
                    if entry.get("content"):
                        content_text = entry["content"][0].get("value", "")

                    # Use best available content
                    body = content_text or summary or ""
                    # Strip HTML tags roughly
                    import re
                    body = re.sub(r"<[^>]+>", " ", body).strip()
                    body = re.sub(r"\s+", " ", body)

                    full_text = f"{title} {body}".lower()

                    # Keyword match
                    if not any(kw in full_text for kw in kw_lower):
                        continue

                    # Dedup
                    h = self.content_hash(f"{title}:{body[:200]}")
                    if h in cache:
                        continue
                    cache.add(h)

                    # Parse timestamp
                    ts = ""
                    if entry.get("published_parsed"):
                        try:
                            import calendar
                            ts_struct = entry["published_parsed"]
                            ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", ts_struct)
                        except Exception:
                            ts = entry.get("published", "")
                    elif entry.get("published"):
                        ts = entry["published"]

                    author = entry.get("author", feed_name)
                    link = entry.get("link", "")

                    platform = institution or feed_name.lower().replace(" ", "_")

                    doc = self.make_document(
                        id=h[:16],
                        source=f"rss_{platform}",
                        source_type=feed_source_type,
                        platform=platform,
                        content=body[:3000],  # cap content length
                        title=title,
                        author=author,
                        timestamp=ts,
                        url=link,
                        metadata={
                            "feed_name": feed_name,
                            "lean": feed_cfg.get("lean", ""),
                            "institution": institution,
                        },
                    )
                    documents.append(doc)
                    count += 1

            except Exception as e:
                print(f"    Warning: feed {feed_name} failed: {e}")
                continue

            # Polite crawling
            time.sleep(0.5)

        self._save_cache(topic_id, cache)
        return documents

    def health_check(self) -> dict:
        if not feedparser:
            return {"ok": False, "message": "feedparser not installed"}
        if not self.feeds:
            return {"ok": False, "message": "no feeds configured"}
        # Try first feed
        try:
            parsed = feedparser.parse(self.feeds[0]["url"])
            return {"ok": bool(parsed.entries), "message": f"{len(parsed.entries)} entries from {self.feeds[0]['name']}"}
        except Exception as e:
            return {"ok": False, "message": str(e)}
