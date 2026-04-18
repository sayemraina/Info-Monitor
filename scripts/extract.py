from __future__ import annotations

"""
extract.py — Two-stage claim extraction via OpenRouter.

Stage 1: Gemini Flash (fast, cheap) — extracts claims from all documents.
Stage 2: Claude Sonnet (precise, expensive) — re-extracts only low-confidence
         claims (confidence < REFINEMENT_THRESHOLD) for higher quality.

Falls back to Anthropic SDK directly if OPENROUTER_API_KEY is not set
but ANTHROPIC_API_KEY is (backward compat).

Usage:
    python scripts/extract.py --topic ai-regulation
    python scripts/extract.py --all
    python scripts/extract.py --help

Input:  data/raw/{topic_id}/{platform}.json + data/raw/{topic_id}/normalized/*.json
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

# Timing instrumentation — best-effort import from server/timing.py.
# If it fails (e.g. running the script in isolation), fall back to a no-op.
sys.path.insert(0, str(BASE_DIR))
try:
    from server.timing import track  # type: ignore
except Exception:
    from contextlib import contextmanager
    @contextmanager
    def track(event: str, **fields):  # type: ignore
        yield {}

# Two-stage extraction models (via OpenRouter)
FLASH_MODEL = "google/gemini-2.0-flash-001"
SONNET_MODEL = "anthropic/claude-sonnet-4-20250514"
REFINEMENT_THRESHOLD = 0.6  # Re-extract docs where Gemini confidence < this

# Fallback: direct Anthropic SDK model
ANTHROPIC_MODEL = "claude-sonnet-4-20250514"

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
    """Load raw documents for a topic from all platforms.

    Reads from two sources:
    1. Legacy platform-specific files: data/raw/{topic_id}/x.json, reddit.json, youtube.json
    2. Normalized ingester output: data/raw/{topic_id}/normalized/*.json
    """
    raw_dir = DATA_DIR / "raw" / topic_id
    if not raw_dir.exists():
        print(f"  No raw data found at {raw_dir}")
        return []

    documents = []

    # --- Normalized ingester output (new path) ---
    norm_dir = raw_dir / "normalized"
    if norm_dir.exists():
        for norm_file in sorted(norm_dir.glob("*.json")):
            try:
                norm_docs = json.loads(norm_file.read_text())
                if not isinstance(norm_docs, list):
                    continue
                for doc in norm_docs:
                    # Normalized docs already have the right shape — just
                    # map to the field names extract_claims_from_doc expects
                    eng = doc.get("engagement", {})
                    content = doc.get("content", "")
                    title = doc.get("title")
                    if title and content and not content.startswith("Title:"):
                        content = f"Title: {title}\n\n{content}"
                    elif title and not content:
                        content = title
                    documents.append({
                        "platform": doc.get("platform", doc.get("source", "unknown")),
                        "id": doc.get("id", content_hash(content)[:16]),
                        "content": content,
                        "author_handle": doc.get("author", "unknown"),
                        "follower_count": 0,
                        "likes": eng.get("likes", 0),
                        "replies": eng.get("replies", 0),
                        "shares": eng.get("shares", 0),
                        "timestamp": doc.get("timestamp", ""),
                        # Propagate source_type for claim tagging
                        "source_type": doc.get("source_type", ""),
                        "url": doc.get("url", ""),
                    })
                print(f"  Loaded {len(norm_docs)} docs from {norm_file.name}")
            except (json.JSONDecodeError, KeyError) as e:
                print(f"  Warning: could not parse {norm_file}: {e}")

    # --- Legacy platform-specific files (backward compat) ---

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
                "source_type": "population",
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
                "source_type": "population",
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
                "source_type": "population",
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
                    "source_type": "population",
                })

    return documents


def _build_user_msg(user_template: str, doc: dict, topic_name: str) -> str:
    """Format user prompt from template + document."""
    return user_template.format(
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


def _create_openrouter_client():
    """Create OpenAI-compatible client pointing to OpenRouter."""
    try:
        from openai import OpenAI
    except ImportError:
        print("Error: openai package required for OpenRouter — pip install openai")
        sys.exit(1)

    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        return None
    return OpenAI(
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
    )


def _create_anthropic_client():
    """Fallback: direct Anthropic SDK client."""
    try:
        import anthropic
    except ImportError:
        return None
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    return anthropic.Anthropic(api_key=api_key)


async def _call_openrouter(client, model: str, system_prompt: str, user_msg: str,
                            semaphore: asyncio.Semaphore) -> list[dict]:
    """Extract claims via OpenRouter (OpenAI-compatible API)."""
    async with semaphore:
        with track("extract_llm_call", provider="openrouter", model=model, msg_chars=len(user_msg)) as rec:
            try:
                response = await asyncio.to_thread(
                    client.chat.completions.create,
                    model=model,
                    max_tokens=MAX_TOKENS,
                    temperature=0,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_msg},
                    ],
                )
                # Record usage when OpenRouter exposes it
                usage = getattr(response, "usage", None)
                if usage:
                    rec["tokens_in"] = getattr(usage, "prompt_tokens", None)
                    rec["tokens_out"] = getattr(usage, "completion_tokens", None)
                text = response.choices[0].message.content.strip()
                # Handle markdown-wrapped JSON
                if text.startswith("```"):
                    text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                    if text.endswith("```"):
                        text = text[:-3]
                    text = text.strip()
                claims = json.loads(text)
                if not isinstance(claims, list):
                    rec["claims_extracted"] = 0
                    return []
                valid = [c for c in claims if validate_claim(c)]
                rec["claims_extracted"] = len(valid)
                return valid
            except json.JSONDecodeError:
                rec["error"] = "json_decode"
                return []
            except Exception as e:
                rec["error"] = str(e)[:120]
                return []


async def _call_anthropic(client, system_prompt: str, user_msg: str,
                           semaphore: asyncio.Semaphore) -> list[dict]:
    """Fallback: extract claims via direct Anthropic SDK."""
    async with semaphore:
        try:
            response = await asyncio.to_thread(
                client.messages.create,
                model=ANTHROPIC_MODEL,
                max_tokens=MAX_TOKENS,
                temperature=0,
                system=system_prompt,
                messages=[{"role": "user", "content": user_msg}],
            )
            text = response.content[0].text.strip()
            claims = json.loads(text)
            if not isinstance(claims, list):
                return []
            return [c for c in claims if validate_claim(c)]
        except json.JSONDecodeError:
            return []
        except Exception as e:
            return []


def _assign_metadata(claims: list[dict], doc: dict, topic_id: str, doc_hash: str) -> None:
    """Assign IDs, source metadata, and source_type to extracted claims."""
    for idx, claim in enumerate(claims):
        claim["id"] = f"{topic_id}_{doc['platform']}_{doc_hash[:8]}_{idx}"
        claim["cluster_id"] = ""
        claim["concept_id"] = ""
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
        if doc.get("source_type"):
            claim["source_type"] = doc["source_type"]


async def extract_topic(topic_id: str, topic_name: str) -> None:
    """Two-stage extraction: Gemini Flash first, Sonnet refinement for low-confidence."""
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
        all_claims = [c for claims_list in cache.values() for c in claims_list]
        _write_output(topic_id, all_claims)
        return

    # Determine extraction mode
    or_client = _create_openrouter_client()
    anth_client = _create_anthropic_client() if not or_client else None

    if or_client:
        print(f"  Using two-stage extraction: Gemini Flash → Sonnet refinement (threshold={REFINEMENT_THRESHOLD})")
    elif anth_client:
        print(f"  Fallback: single-stage Anthropic Sonnet (no OPENROUTER_API_KEY)")
    else:
        print("Error: Neither OPENROUTER_API_KEY nor ANTHROPIC_API_KEY set in .env")
        sys.exit(1)

    semaphore = asyncio.Semaphore(MAX_CONCURRENT)
    extracted_count = 0
    refined_count = 0

    async def _process_one(doc, h):
        nonlocal extracted_count, refined_count
        user_msg = _build_user_msg(user_template, doc, topic_name)

        if or_client:
            claims = await _call_openrouter(or_client, FLASH_MODEL, system_prompt, user_msg, semaphore)
            if claims:
                avg_conf = sum(c.get("confidence", 0) for c in claims) / len(claims)
                if avg_conf < REFINEMENT_THRESHOLD:
                    refined = await _call_openrouter(or_client, SONNET_MODEL, system_prompt, user_msg, semaphore)
                    if refined:
                        claims = refined
                        refined_count += 1
        else:
            claims = await _call_anthropic(anth_client, system_prompt, user_msg, semaphore)

        _assign_metadata(claims, doc, topic_id, h)
        cache[h] = claims
        extracted_count += len(claims)
        return claims

    # Process in parallel batches
    BATCH_SIZE = MAX_CONCURRENT
    for batch_start in range(0, len(uncached), BATCH_SIZE):
        batch = uncached[batch_start:batch_start + BATCH_SIZE]
        await asyncio.gather(*[_process_one(doc, h) for doc, h in batch])
        done = min(batch_start + len(batch), len(uncached))
        print(f"    Processed {done}/{len(uncached)} documents ({extracted_count} claims, {refined_count} refined)")
        sys.stdout.flush()

    save_cache(topic_id, cache)

    all_claims = [c for claims_list in cache.values() for c in claims_list]
    _write_output(topic_id, all_claims)

    print(f"  Extracted {len(all_claims)} total claims for {topic_id}")
    if refined_count:
        print(f"  ({refined_count} documents re-extracted by Sonnet for higher quality)")


def _write_output(topic_id: str, claims: list[dict]) -> None:
    out_dir = DATA_DIR / "claims" / topic_id
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "extracted.json"
    out_path.write_text(json.dumps(claims, indent=2, ensure_ascii=False))


# Topic names — load from topic_keywords.json if available, else fallback
def _load_topic_names() -> dict:
    kw_path = Path(__file__).resolve().parent / "topic_keywords.json"
    if kw_path.exists():
        data = json.loads(kw_path.read_text())
        return {tid: cfg.get("name", tid) for tid, cfg in data.items()}
    return {
        "ai-regulation": "AI regulation",
        "immigration-policy": "immigration policy",
        "israel-palestine": "Israel-Palestine conflict",
        "climate-policy": "climate policy",
    }


TOPIC_NAMES = _load_topic_names()


def main() -> None:
    parser = argparse.ArgumentParser(description="Two-stage claim extraction (Gemini Flash + Sonnet).")
    parser.add_argument("--topic", type=str, help="Topic ID (e.g., ai-workplace)")
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
