"""
NewsAPI.ai (Event Registry) ingester.
30K+ publishers, enriched metadata. Free tier: 2K tokens/month.
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

NEWSAPI_BASE = "https://newsapi.ai/api/v1/article/getArticles"


@register
class NewsAPIIngester(BaseIngester):
    source_name = "newsapi"
    source_type = "elite_media"
    is_signal = False

    def ingest(self, topic_id: str, keywords: List[str], **kwargs) -> list:
        api_key = os.environ.get("NEWSAPI_AI_KEY", "")
        if not api_key:
            print("    NEWSAPI_AI_KEY not set — get free key at newsapi.ai")
            return []

        cache = self._load_cache(topic_id)
        documents = []

        # Use top 2 keywords to conserve tokens
        for kw in keywords[:2]:
            try:
                payload = {
                    "action": "getArticles",
                    "keyword": kw,
                    "articlesPage": 1,
                    "articlesCount": 20,
                    "articlesSortBy": "date",
                    "articlesSortByAsc": False,
                    "lang": "eng",
                    "resultType": "articles",
                    "apiKey": api_key,
                }
                resp = requests.post(NEWSAPI_BASE, json=payload, timeout=20)
                if resp.status_code != 200:
                    print(f"    NewsAPI returned {resp.status_code} for '{kw}'")
                    continue

                data = resp.json()
                articles = data.get("articles", {}).get("results", [])

                for art in articles:
                    title = art.get("title", "")
                    body = art.get("body", "")
                    if not title:
                        continue

                    source_info = art.get("source", {})
                    source_name = source_info.get("title", "Unknown")
                    url = art.get("url", "")
                    pub_date = art.get("dateTimePub", art.get("dateTime", ""))

                    # Dedup
                    h = self.content_hash(f"{title}:{body[:200]}")
                    if h in cache:
                        continue
                    cache.add(h)

                    # Use body if available, otherwise title only
                    content = body[:3000] if body else title

                    doc = self.make_document(
                        id=h[:16],
                        source=f"newsapi_{source_name.lower().replace(' ', '_')[:20]}",
                        source_type="elite_media",
                        platform=source_name.lower().replace(" ", "_")[:30],
                        content=content,
                        title=title,
                        author=source_name,
                        timestamp=pub_date,
                        url=url,
                        metadata={
                            "source_name": source_name,
                            "sentiment": art.get("sentiment", None),
                            "categories": [c.get("label", "") for c in art.get("categories", [])],
                        },
                    )
                    documents.append(doc)

                time.sleep(1)

            except Exception as e:
                print(f"    Warning: NewsAPI search '{kw}' failed: {e}")
                continue

        self._save_cache(topic_id, cache)
        return documents

    def health_check(self) -> dict:
        api_key = os.environ.get("NEWSAPI_AI_KEY", "")
        if not api_key:
            return {"ok": False, "message": "NEWSAPI_AI_KEY not set"}
        try:
            payload = {"action": "getArticles", "keyword": "test", "articlesCount": 1, "lang": "eng", "resultType": "articles", "apiKey": api_key}
            resp = requests.post(NEWSAPI_BASE, json=payload, timeout=10)
            return {"ok": resp.status_code == 200, "message": "NewsAPI.ai reachable"}
        except Exception as e:
            return {"ok": False, "message": str(e)}
