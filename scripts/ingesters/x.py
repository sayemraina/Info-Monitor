"""
X (Twitter) discourse ingester.
Pulls recent tweets on topic keywords for claim extraction.
Uses /2/tweets/search/recent endpoint — pay-per-use.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List
from urllib.request import urlopen, Request
from urllib.parse import urlencode
from urllib.error import HTTPError

from . import register
from .base import BaseIngester

SCRIPTS_DIR = Path(__file__).parent.parent
TOPIC_KEYWORDS = json.loads((SCRIPTS_DIR / "topic_keywords.json").read_text())

API_BASE = "https://api.twitter.com/2"
MAX_RESULTS_PER_REQUEST = 100
TARGET_PER_TOPIC = 500


def _x_get(endpoint: str, params: Dict[str, str], bearer_token: str) -> Dict[str, Any]:
    url = f"{API_BASE}/{endpoint}?{urlencode(params)}"
    req = Request(url, headers={
        "Authorization": f"Bearer {bearer_token}",
        "Accept": "application/json",
    })
    try:
        with urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except HTTPError as e:
        body = e.read().decode() if e.fp else ""
        raise RuntimeError(f"X API {e.code}: {body[:300]}") from e


@register
class XIngester(BaseIngester):
    source_name = "x"
    source_type = "population"
    is_signal = False

    def ingest(self, topic_id: str, keywords: List[str], **kwargs) -> list:
        token = os.environ.get("X_BEARER_TOKEN", "")
        if not token:
            print("    X_BEARER_TOKEN not set — skipping X ingestion")
            return []

        config = TOPIC_KEYWORDS.get(topic_id, {})
        queries = config.get("keywords", keywords)[:1]  # 1 keyword for cost optimization (~$83/month for all 10 topics every 3 days)

        seen_hashes = self._load_cache(topic_id)
        new_hashes: set = set()
        documents = []
        seen_tweet_ids: set = set()

        for query in queries:
            if len(documents) >= TARGET_PER_TOPIC:
                break

            # Build search query: exclude retweets and replies for cleaner signal
            search_query = f"{query} -is:retweet -is:reply lang:en"

            params = {
                "query": search_query,
                "max_results": str(MAX_RESULTS_PER_REQUEST),
                "tweet.fields": "created_at,author_id,public_metrics,lang",
                "expansions": "author_id",
                "user.fields": "username,public_metrics",
            }

            try:
                data = _x_get("tweets/search/recent", params, token)
            except RuntimeError as e:
                print(f"    X search failed for '{query}': {e}")
                continue

            tweets = data.get("data", [])
            users = {u["id"]: u for u in data.get("includes", {}).get("users", [])}

            for tweet in tweets:
                tweet_id = tweet.get("id", "")
                if tweet_id in seen_tweet_ids:
                    continue
                seen_tweet_ids.add(tweet_id)

                text = tweet.get("text", "").strip()
                if len(text) < 20:
                    continue

                h = self.content_hash(text)
                if h in seen_hashes:
                    continue

                metrics = tweet.get("public_metrics", {})
                author_id = tweet.get("author_id", "")
                user = users.get(author_id, {})
                username = user.get("username", "unknown")
                followers = user.get("public_metrics", {}).get("followers_count", 0)

                doc = self.make_document(
                    id=f"x_{tweet_id}",
                    content=text,
                    url=f"https://x.com/i/web/status/{tweet_id}",
                    source=self.source_name,
                    source_type=self.source_type,
                    platform="x",
                    author=f"@{username}",
                    timestamp=tweet.get("created_at", ""),
                    likes=metrics.get("like_count", 0),
                    replies=metrics.get("reply_count", 0),
                    shares=metrics.get("retweet_count", 0),
                    views=metrics.get("impression_count", 0),
                    metadata={
                        "tweet_id": tweet_id,
                        "followers": followers,
                        "search_query": query,
                    },
                )
                new_hashes.add(h)
                documents.append(doc)

            print(f"    X: '{query}' → {len(tweets)} tweets")

        self._save_cache(topic_id, seen_hashes | new_hashes)
        print(f"    X total: {len(documents)} new tweets for {topic_id}")
        return documents

    def health_check(self) -> dict:
        token = os.environ.get("X_BEARER_TOKEN", "")
        if not token:
            return {"ok": False, "message": "X_BEARER_TOKEN not set"}
        try:
            data = _x_get("tweets/search/recent", {
                "query": "test lang:en",
                "max_results": "10",
            }, token)
            ok = "data" in data or "meta" in data
            return {"ok": ok, "message": "X API reachable"}
        except Exception as e:
            return {"ok": False, "message": str(e)}
