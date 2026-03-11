from __future__ import annotations

"""
extract.py — Extract claims from raw posts using Claude Sonnet.

Usage:
    python scripts/extract.py --topic ai-regulation
    python scripts/extract.py --all
    python scripts/extract.py --help

Requires ANTHROPIC_API_KEY in .env.
Input:  data/raw/{topic_id}/{platform}.json
Output: data/claims/{topic_id}/extracted.json
"""

import argparse
import asyncio
import hashlib
import json
import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"

MODEL = "claude-sonnet-4-20250514"
MAX_CONCURRENT = 50
MAX_TOKENS = 1024

VALID_STANCES = {"pro", "anti", "neutral", "ambiguous"}
VALID_AROUSAL = {"high", "medium", "low"}
VALID_REGISTER = {"academic", "journalistic", "vernacular", "meme", "sarcastic", "formal"}


def content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def load_extraction_prompt() -> tuple[str, str]:
    """Load system and user prompt templates from extraction_prompt.md."""
    prompt_path = PROMPTS_DIR / "extraction_prompt.md"
    if not prompt_path.exists():
        print(f"Error: extraction prompt not found at {prompt_path}")
        sys.exit(1)

    text = prompt_path.read_text()

    # Extract system prompt (between first ``` pair after "## System Prompt")
    system_start = text.find("## System Prompt")
    system_block_start = text.find("```", system_start) + 3
    system_block_end = text.find("```", system_block_start)
    system_prompt = text[system_block_start:system_block_end].strip()

    # Extract user prompt template (between ``` pair after "## User Prompt Template")
    user_start = text.find("## User Prompt Template")
    user_block_start = text.find("```", user_start) + 3
    user_block_end = text.find("```", user_block_start)
    user_template = text[user_block_start:user_block_end].strip()

    return system_prompt, user_template


def load_cache(topic_id: str) -> dict[str, list]:
    cache_path = DATA_DIR / "claims" / topic_id / ".extract_cache.json"
    if cache_path.exists():
        return json.loads(cache_path.read_text())
    return {}


def save_cache(topic_id: str, cache: dict[str, list]) -> None:
    cache_path = DATA_DIR / "claims" / topic_id / ".extract_cache.json"
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(cache))


def validate_claim(claim: dict) -> bool:
    """Check that a claim has all required fields with valid values."""
    if not isinstance(claim, dict):
        return False
    if not claim.get("text") or not isinstance(claim["text"], str):
        return False
    if claim.get("stance") not in VALID_STANCES:
        return False
    if claim.get("arousal") not in VALID_AROUSAL:
        return False
    if claim.get("register") not in VALID_REGISTER:
        return False
    conf = claim.get("confidence", -1)
    if not isinstance(conf, (int, float)) or conf < 0 or conf > 1:
        return False
    return True


def build_documents(topic_id: str) -> list[dict]:
    """Load raw documents for a topic from all platforms."""
    raw_dir = DATA_DIR / "raw" / topic_id
    if not raw_dir.exists():
        print(f"  No raw data found at {raw_dir}")
        return []

    documents = []

    # X
    x_path = raw_dir / "x.json"
    if x_path.exists():
        for post in json.loads(x_path.read_text()):
            documents.append({
                "platform": "x",
                "id": post["id"],
                "content": post["text"],
                "author_handle": post.get("author_handle", "@unknown"),
                "follower_count": post.get("followers_count", 0),
                "likes": post.get("public_metrics", {}).get("like_count", 0),
                "replies": post.get("public_metrics", {}).get("reply_count", 0),
                "shares": post.get("public_metrics", {}).get("retweet_count", 0),
                "timestamp": post.get("created_at", ""),
            })

    # Reddit
    reddit_path = raw_dir / "reddit.json"
    if reddit_path.exists():
        for post in json.loads(reddit_path.read_text()):
            documents.append({
                "platform": "reddit",
                "id": post["id"],
                "content": post.get("body", post.get("title", "")),
                "author_handle": f"u/{post.get('author', 'unknown')}",
                "follower_count": 0,
                "likes": post.get("score", 0),
                "replies": post.get("num_comments", 0),
                "shares": 0,
                "timestamp": post.get("created_at", ""),
            })

    # YouTube
    yt_path = raw_dir / "youtube.json"
    if yt_path.exists():
        for video in json.loads(yt_path.read_text()):
            # Video itself
            combined = f"Title: {video.get('title', '')}\nDescription: {video.get('description', '')}"
            documents.append({
                "platform": "youtube",
                "id": video["video_id"],
                "content": combined,
                "author_handle": video.get("channel_title", "Unknown Channel"),
                "follower_count": 0,
                "likes": video.get("like_count", 0),
                "replies": video.get("comment_count", 0),
                "shares": 0,
                "timestamp": video.get("published_at", ""),
            })
            # Comments
            for comment in video.get("comments", []):
                documents.append({
                    "platform": "youtube",
                    "id": f"{video['video_id']}_comment_{content_hash(comment['text'])[:8]}",
                    "content": comment["text"],
                    "author_handle": comment.get("author", ""),
                    "follower_count": 0,
                    "likes": comment.get("likes", 0),
                    "replies": 0,
                    "shares": 0,
                    "timestamp": comment.get("timestamp", ""),
                })

    return documents


async def extract_claims_from_doc(
    client,
    semaphore: asyncio.Semaphore,
    system_prompt: str,
    user_template: str,
    doc: dict,
    topic_name: str,
) -> list[dict]:
    """Call Claude to extract claims from a single document."""
    user_msg = user_template.format(
        platform=doc["platform"],
        topic=topic_name,
        content=doc["content"],
        author_handle=doc["author_handle"],
        follower_count=doc["follower_count"],
        likes=doc["likes"],
        replies=doc["replies"],
        shares=doc["shares"],
        timestamp=doc["timestamp"],
        account_age="unknown",
    )

    async with semaphore:
        try:
            response = await asyncio.to_thread(
                client.messages.create,
                model=MODEL,
                max_tokens=MAX_TOKENS,
                temperature=0,
                system=system_prompt,
                messages=[{"role": "user", "content": user_msg}],
            )
            text = response.content[0].text.strip()

            # Parse JSON response
            claims = json.loads(text)
            if not isinstance(claims, list):
                return []

            valid = [c for c in claims if validate_claim(c)]
            return valid

        except json.JSONDecodeError:
            return []
        except Exception as e:
            print(f"    Error extracting from {doc['id']}: {e}")
            return []


async def extract_topic(topic_id: str, topic_name: str) -> None:
    import anthropic

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("Error: ANTHROPIC_API_KEY not set in .env")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)
    system_prompt, user_template = load_extraction_prompt()
    cache = load_cache(topic_id)

    documents = build_documents(topic_id)
    if not documents:
        print(f"  No documents to extract from for {topic_id}")
        return

    # Filter already-cached documents
    uncached = []
    for doc in documents:
        h = content_hash(doc["content"])
        if h not in cache:
            uncached.append((doc, h))

    print(f"  {len(documents)} documents, {len(uncached)} uncached")
    if not uncached:
        print(f"  All documents already cached")
        # Still write output from cache
        all_claims = [c for claims in cache.values() for c in claims]
        _write_output(topic_id, all_claims)
        return

    semaphore = asyncio.Semaphore(MAX_CONCURRENT)
    tasks = []
    for doc, h in uncached:
        tasks.append((h, doc, extract_claims_from_doc(
            client, semaphore, system_prompt, user_template, doc, topic_name
        )))

    # Process with progress
    extracted_count = 0
    for i, (h, doc, coro) in enumerate(tasks):
        claims = await coro
        # Assign IDs and source metadata
        for idx, claim in enumerate(claims):
            claim["id"] = f"{topic_id}_{doc['platform']}_{h[:8]}_{idx}"
            claim["cluster_id"] = ""  # Assigned by cluster.py
            claim["concept_id"] = ""  # Assigned by cluster.py
            claim["first_seen_platform"] = doc["platform"]
            claim["first_seen_timestamp"] = doc["timestamp"]
            claim["source_document_id"] = doc["id"]
            claim["source_platform"] = doc["platform"]
            claim["source_timestamp"] = doc["timestamp"]
            claim["source_engagement"] = {
                "likes": doc["likes"],
                "replies": doc["replies"],
                "shares": doc["shares"],
            }

        cache[h] = claims
        extracted_count += len(claims)

        if (i + 1) % 50 == 0:
            print(f"    Processed {i + 1}/{len(tasks)} documents ({extracted_count} claims)")

    save_cache(topic_id, cache)

    # Flatten all claims from cache
    all_claims = [c for claims in cache.values() for c in claims]
    _write_output(topic_id, all_claims)

    print(f"  Extracted {len(all_claims)} total claims for {topic_id}")


def _write_output(topic_id: str, claims: list[dict]) -> None:
    out_dir = DATA_DIR / "claims" / topic_id
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "extracted.json"
    out_path.write_text(json.dumps(claims, indent=2, ensure_ascii=False))


# Topic names for the prompt
TOPIC_NAMES = {
    "ai-regulation": "AI regulation",
    "immigration-policy": "immigration policy",
    "israel-palestine": "Israel-Palestine conflict",
    "climate-policy": "climate policy",
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract claims from raw posts using Claude Sonnet.")
    parser.add_argument("--topic", type=str, help="Topic ID (e.g., ai-regulation)")
    parser.add_argument("--all", action="store_true", help="Extract for all topics")
    args = parser.parse_args()

    if args.all:
        for tid, name in TOPIC_NAMES.items():
            print(f"\nExtracting: {name} ({tid})")
            asyncio.run(extract_topic(tid, name))
    elif args.topic:
        name = TOPIC_NAMES.get(args.topic, args.topic)
        print(f"\nExtracting: {name} ({args.topic})")
        asyncio.run(extract_topic(args.topic, name))
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
