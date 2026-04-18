"""
Bluesky AT Protocol ingester.
First real population discourse source. Free. Requires app password for search.
Create at: https://bsky.app/settings/app-passwords
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

BSKY_PDS = "https://bsky.social/xrpc"


@register
class BlueskyIngester(BaseIngester):
    source_name = "bluesky"
    source_type = "population"
    is_signal = False

    def _create_session(self) -> Optional[str]:
        """Authenticate and return access token."""
        handle = os.environ.get("BLUESKY_HANDLE", "")
        app_password = os.environ.get("BLUESKY_APP_PASSWORD", "")
        if not handle or not app_password:
            print("    BLUESKY_HANDLE and BLUESKY_APP_PASSWORD not set")
            print("    Create app password at: https://bsky.app/settings/app-passwords")
            return None
        try:
            resp = requests.post(f"{BSKY_PDS}/com.atproto.server.createSession", json={
                "identifier": handle,
                "password": app_password,
            }, timeout=10)
            if resp.status_code != 200:
                print(f"    Bluesky auth failed: {resp.status_code}")
                return None
            return resp.json().get("accessJwt")
        except Exception as e:
            print(f"    Bluesky auth error: {e}")
            return None

    def ingest(self, topic_id: str, keywords: List[str], **kwargs) -> list:
        token = self._create_session()
        if not token:
            return []

        cache = self._load_cache(topic_id)
        documents = []

        # Search with top 3 keywords
        for kw in keywords[:3]:
            try:
                params = {
                    "q": kw,
                    "limit": 50,
                    "lang": "en",
                    "sort": "latest",
                }
                headers = {
                    "Accept": "application/json",
                    "Authorization": f"Bearer {token}",
                }
                resp = requests.get(f"{BSKY_PDS}/app.bsky.feed.searchPosts",
                                    params=params, headers=headers, timeout=15)

                if resp.status_code == 429:
                    print(f"    Rate limited on Bluesky, backing off...")
                    time.sleep(30)
                    continue

                if resp.status_code != 200:
                    print(f"    Bluesky returned {resp.status_code} for '{kw}'")
                    continue

                data = resp.json()
                posts = data.get("posts", [])

                for post in posts:
                    record = post.get("record", {})
                    text = record.get("text", "")
                    if not text or len(text) < 20:
                        continue

                    author = post.get("author", {})
                    handle = author.get("handle", "unknown")
                    display_name = author.get("displayName", handle)
                    uri = post.get("uri", "")
                    created_at = record.get("createdAt", "")

                    # Dedup
                    h = self.content_hash(text[:200])
                    if h in cache:
                        continue
                    cache.add(h)

                    like_count = post.get("likeCount", 0)
                    repost_count = post.get("repostCount", 0)
                    reply_count = post.get("replyCount", 0)

                    doc = self.make_document(
                        id=h[:16],
                        source="bluesky",
                        source_type="population",
                        platform="bluesky",
                        content=text,
                        title=None,
                        author=f"@{handle}" if not handle.startswith("@") else handle,
                        timestamp=created_at,
                        url=f"https://bsky.app/profile/{handle}/post/{uri.split('/')[-1]}" if uri else None,
                        likes=like_count,
                        replies=reply_count,
                        shares=repost_count,
                        metadata={
                            "display_name": display_name,
                            "did": author.get("did", ""),
                        },
                    )
                    documents.append(doc)

                time.sleep(2)  # Conservative rate limiting

            except Exception as e:
                print(f"    Warning: Bluesky search '{kw}' failed: {e}")
                continue

        self._save_cache(topic_id, cache)
        return documents

    def health_check(self) -> dict:
        token = self._create_session()
        if not token:
            return {"ok": False, "message": "Auth failed — set BLUESKY_HANDLE + BLUESKY_APP_PASSWORD"}
        try:
            resp = requests.get(f"{BSKY_PDS}/app.bsky.feed.searchPosts",
                                params={"q": "test", "limit": 1},
                                headers={"Authorization": f"Bearer {token}"},
                                timeout=10)
            return {"ok": resp.status_code == 200, "message": "Bluesky search API reachable"}
        except Exception as e:
            return {"ok": False, "message": str(e)}
