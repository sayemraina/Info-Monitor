from __future__ import annotations

"""
ingest.py — Pull raw posts from X, Reddit, and YouTube APIs.

Usage:
    python scripts/ingest.py --topic ai-regulation
    python scripts/ingest.py --all
    python scripts/ingest.py --help

Requires API credentials in .env (see .env.example).
Output: data/raw/{topic_id}/{platform}.json
"""

import argparse
import hashlib
import json
import os
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# ---------------------------------------------------------------------------
# Topic Definitions — keywords, subreddits, and YouTube channels per topic
# ---------------------------------------------------------------------------

TOPICS = {
    "ai-regulation": {
        "name": "AI Regulation",
        "keywords": ["AI regulation", "AI safety", "AI governance", "EU AI Act", "AI policy"],
        "subreddits": ["artificial", "MachineLearning", "technology", "Futurology", "ArtificialIntelligence"],
        "youtube_queries": ["AI regulation", "AI safety policy", "EU AI Act"],
    },
    "immigration-policy": {
        "name": "Immigration Policy",
        "keywords": ["immigration policy", "border security", "immigration reform", "undocumented immigrants"],
        "subreddits": ["immigration", "politics", "Conservative", "progressive", "news"],
        "youtube_queries": ["immigration policy", "border security", "immigration reform"],
    },
    "israel-palestine": {
        "name": "Israel-Palestine Conflict",
        "keywords": ["Israel Palestine", "Gaza", "West Bank", "ceasefire", "occupation"],
        "subreddits": ["worldnews", "IsraelPalestine", "Palestine", "Israel", "geopolitics"],
        "youtube_queries": ["Israel Palestine conflict", "Gaza", "Middle East peace"],
    },
    "climate-policy": {
        "name": "Climate Policy",
        "keywords": ["climate change policy", "carbon tax", "green energy", "climate action", "fossil fuel"],
        "subreddits": ["climate", "environment", "energy", "collapse", "ClimateActionPlan"],
        "youtube_queries": ["climate change policy", "green energy transition", "carbon capture"],
    },
}

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"


def content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def load_cache(topic_id: str) -> set[str]:
    cache_path = DATA_DIR / "raw" / topic_id / ".ingest_cache.json"
    if cache_path.exists():
        return set(json.loads(cache_path.read_text()))
    return set()


def save_cache(topic_id: str, hashes: set[str]) -> None:
    cache_path = DATA_DIR / "raw" / topic_id / ".ingest_cache.json"
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(sorted(hashes)))


# ---------------------------------------------------------------------------
# X (Twitter) API v2
# ---------------------------------------------------------------------------

def ingest_x(topic_id: str, topic: dict, seen: set[str]) -> list[dict]:
    import requests

    bearer = os.getenv("X_BEARER_TOKEN")
    if not bearer:
        print(f"  [X] Skipping — X_BEARER_TOKEN not set")
        return []

    url = "https://api.x.com/2/tweets/search/recent"
    headers = {"Authorization": f"Bearer {bearer}"}
    all_posts: list[dict] = []

    for query in topic["keywords"][:3]:  # Limit to 3 queries per topic
        params = {
            "query": f"{query} lang:en -is:retweet",
            "max_results": 100,
            "tweet.fields": "created_at,public_metrics,author_id",
            "user.fields": "username,public_metrics",
            "expansions": "author_id",
        }

        next_token = None
        fetched = 0
        while fetched < 200:  # ~200 per keyword, ~600 total per topic
            if next_token:
                params["next_token"] = next_token

            try:
                resp = requests.get(url, headers=headers, params=params, timeout=30)
                if resp.status_code == 429:
                    reset = int(resp.headers.get("x-rate-limit-reset", time.time() + 60))
                    wait = max(reset - int(time.time()), 1)
                    print(f"  [X] Rate limited, waiting {wait}s...")
                    time.sleep(wait)
                    continue
                resp.raise_for_status()
            except Exception as e:
                print(f"  [X] Error fetching '{query}': {e}")
                break

            data = resp.json()
            tweets = data.get("data", [])
            users = {u["id"]: u for u in data.get("includes", {}).get("users", [])}

            for t in tweets:
                h = content_hash(t["text"])
                if h in seen:
                    continue
                seen.add(h)

                author = users.get(t.get("author_id"), {})
                metrics = t.get("public_metrics", {})
                all_posts.append({
                    "id": t["id"],
                    "text": t["text"],
                    "author_id": t.get("author_id", ""),
                    "author_handle": f"@{author.get('username', 'unknown')}",
                    "followers_count": author.get("public_metrics", {}).get("followers_count", 0),
                    "created_at": t.get("created_at", ""),
                    "public_metrics": {
                        "like_count": metrics.get("like_count", 0),
                        "reply_count": metrics.get("reply_count", 0),
                        "retweet_count": metrics.get("retweet_count", 0),
                        "quote_count": metrics.get("quote_count", 0),
                    },
                })

            fetched += len(tweets)
            next_token = data.get("meta", {}).get("next_token")
            if not next_token:
                break
            time.sleep(1)  # Be polite

    print(f"  [X] Fetched {len(all_posts)} tweets")
    return all_posts


# ---------------------------------------------------------------------------
# Reddit via PRAW
# ---------------------------------------------------------------------------

def ingest_reddit(topic_id: str, topic: dict, seen: set[str]) -> list[dict]:
    import praw

    client_id = os.getenv("REDDIT_CLIENT_ID")
    client_secret = os.getenv("REDDIT_CLIENT_SECRET")
    user_agent = os.getenv("REDDIT_USER_AGENT", "narrative_monitor/1.0")

    if not client_id or not client_secret:
        print(f"  [Reddit] Skipping — REDDIT_CLIENT_ID/SECRET not set")
        return []

    reddit = praw.Reddit(
        client_id=client_id,
        client_secret=client_secret,
        user_agent=user_agent,
    )

    all_posts: list[dict] = []
    subreddit_str = "+".join(topic["subreddits"])

    for query in topic["keywords"][:2]:
        try:
            results = reddit.subreddit(subreddit_str).search(
                query, time_filter="week", limit=250
            )
            for submission in results:
                body = submission.selftext or submission.title
                h = content_hash(body)
                if h in seen:
                    continue
                seen.add(h)

                ts = datetime.fromtimestamp(submission.created_utc, tz=timezone.utc).isoformat()
                all_posts.append({
                    "id": submission.id,
                    "body": body,
                    "title": submission.title,
                    "author": str(submission.author) if submission.author else "[deleted]",
                    "subreddit": str(submission.subreddit),
                    "created_utc": submission.created_utc,
                    "created_at": ts,
                    "score": submission.score,
                    "num_comments": submission.num_comments,
                    "is_comment": False,
                    "parent_id": None,
                })

                # Fetch top comments
                submission.comment_sort = "top"
                submission.comments.replace_more(limit=0)
                for comment in submission.comments[:20]:
                    ch = content_hash(comment.body)
                    if ch in seen or comment.body in ("[deleted]", "[removed]"):
                        continue
                    seen.add(ch)

                    cts = datetime.fromtimestamp(comment.created_utc, tz=timezone.utc).isoformat()
                    all_posts.append({
                        "id": comment.id,
                        "body": comment.body,
                        "title": "",
                        "author": str(comment.author) if comment.author else "[deleted]",
                        "subreddit": str(submission.subreddit),
                        "created_utc": comment.created_utc,
                        "created_at": cts,
                        "score": comment.score,
                        "num_comments": 0,
                        "is_comment": True,
                        "parent_id": submission.id,
                    })
        except Exception as e:
            print(f"  [Reddit] Error searching '{query}': {e}")

    print(f"  [Reddit] Fetched {len(all_posts)} posts/comments")
    return all_posts


# ---------------------------------------------------------------------------
# YouTube Data API v3
# ---------------------------------------------------------------------------

def ingest_youtube(topic_id: str, topic: dict, seen: set[str]) -> list[dict]:
    from googleapiclient.discovery import build

    api_key = os.getenv("YOUTUBE_API_KEY")
    if not api_key:
        print(f"  [YouTube] Skipping — YOUTUBE_API_KEY not set")
        return []

    youtube = build("youtube", "v3", developerKey=api_key)
    all_posts: list[dict] = []
    one_week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    for query in topic.get("youtube_queries", topic["keywords"][:2]):
        try:
            search_resp = youtube.search().list(
                q=query,
                type="video",
                maxResults=20,
                order="relevance",
                publishedAfter=one_week_ago,
                part="id,snippet",
            ).execute()

            for item in search_resp.get("items", []):
                video_id = item["id"]["videoId"]
                snippet = item["snippet"]
                title = snippet.get("title", "")
                desc = snippet.get("description", "")
                combined = f"Title: {title}\nDescription: {desc}"
                h = content_hash(combined)
                if h in seen:
                    continue
                seen.add(h)

                # Get video stats
                stats = {}
                try:
                    vid_resp = youtube.videos().list(
                        id=video_id, part="statistics,snippet"
                    ).execute()
                    if vid_resp["items"]:
                        stats = vid_resp["items"][0].get("statistics", {})
                except Exception:
                    pass

                video_entry = {
                    "video_id": video_id,
                    "title": title,
                    "description": desc,
                    "channel_title": snippet.get("channelTitle", ""),
                    "channel_id": snippet.get("channelId", ""),
                    "published_at": snippet.get("publishedAt", ""),
                    "view_count": int(stats.get("viewCount", 0)),
                    "like_count": int(stats.get("likeCount", 0)),
                    "comment_count": int(stats.get("commentCount", 0)),
                    "comments": [],
                }

                # Fetch top comments
                try:
                    comments_resp = youtube.commentThreads().list(
                        videoId=video_id,
                        part="snippet",
                        maxResults=30,
                        order="relevance",
                    ).execute()

                    for ct in comments_resp.get("items", []):
                        cs = ct["snippet"]["topLevelComment"]["snippet"]
                        comment_text = cs.get("textDisplay", "")
                        ch = content_hash(comment_text)
                        if ch in seen:
                            continue
                        seen.add(ch)

                        video_entry["comments"].append({
                            "text": comment_text,
                            "author": cs.get("authorDisplayName", ""),
                            "likes": cs.get("likeCount", 0),
                            "timestamp": cs.get("publishedAt", ""),
                        })
                except Exception:
                    pass  # Comments may be disabled

                all_posts.append(video_entry)

        except Exception as e:
            print(f"  [YouTube] Error searching '{query}': {e}")

    print(f"  [YouTube] Fetched {len(all_posts)} videos with comments")
    return all_posts


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def ingest_topic(topic_id: str) -> None:
    if topic_id not in TOPICS:
        print(f"Unknown topic: {topic_id}. Available: {', '.join(TOPICS.keys())}")
        sys.exit(1)

    topic = TOPICS[topic_id]
    print(f"\nIngesting: {topic['name']} ({topic_id})")

    out_dir = DATA_DIR / "raw" / topic_id
    out_dir.mkdir(parents=True, exist_ok=True)
    seen = load_cache(topic_id)

    # X
    x_posts = ingest_x(topic_id, topic, seen)
    if x_posts:
        (out_dir / "x.json").write_text(json.dumps(x_posts, indent=2, ensure_ascii=False))

    # Reddit
    reddit_posts = ingest_reddit(topic_id, topic, seen)
    if reddit_posts:
        (out_dir / "reddit.json").write_text(json.dumps(reddit_posts, indent=2, ensure_ascii=False))

    # YouTube
    yt_posts = ingest_youtube(topic_id, topic, seen)
    if yt_posts:
        (out_dir / "youtube.json").write_text(json.dumps(yt_posts, indent=2, ensure_ascii=False))

    save_cache(topic_id, seen)
    total = len(x_posts) + len(reddit_posts) + len(yt_posts)
    print(f"  Total: {total} documents for {topic_id}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest raw social media data for narrative monitoring.")
    parser.add_argument("--topic", type=str, help="Topic ID to ingest (e.g., ai-regulation)")
    parser.add_argument("--all", action="store_true", help="Ingest all topics")
    parser.add_argument("--list", action="store_true", help="List available topics")
    args = parser.parse_args()

    if args.list:
        for tid, t in TOPICS.items():
            print(f"  {tid}: {t['name']}")
        return

    if args.all:
        for tid in TOPICS:
            ingest_topic(tid)
    elif args.topic:
        ingest_topic(args.topic)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
