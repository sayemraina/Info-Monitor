from __future__ import annotations

"""
embed.py — Generate 1536-dim embedding vectors for extracted claims.

Usage:
    python scripts/embed.py --topic ai-regulation
    python scripts/embed.py --all
    python scripts/embed.py --help

Requires OPENAI_API_KEY in .env.
Input:  data/claims/{topic_id}/extracted.json
Output: data/claims/{topic_id}/embedded.json
"""

import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

# Timing instrumentation — best-effort import; falls back to a no-op.
sys.path.insert(0, str(BASE_DIR))
try:
    from server.timing import track  # type: ignore
except Exception:
    from contextlib import contextmanager
    @contextmanager
    def track(event: str, **fields):  # type: ignore
        yield {}

MODEL = "text-embedding-3-small"
BATCH_SIZE = 100


def embed_topic(topic_id: str) -> None:
    import openai

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENAI_API_KEY not set in .env")
        sys.exit(1)

    client = openai.OpenAI(api_key=api_key)

    # Load claims
    input_path = DATA_DIR / "claims" / topic_id / "extracted.json"
    if not input_path.exists():
        print(f"  No extracted claims found at {input_path}")
        return

    claims = json.loads(input_path.read_text())
    print(f"  Loaded {len(claims)} claims")

    # Check which claims already have embeddings
    output_path = DATA_DIR / "claims" / topic_id / "embedded.json"
    existing: dict[str, list[float]] = {}
    if output_path.exists():
        for c in json.loads(output_path.read_text()):
            if c.get("embedding"):
                existing[c["id"]] = c["embedding"]

    to_embed = [c for c in claims if c["id"] not in existing]
    print(f"  {len(to_embed)} claims need embedding ({len(existing)} already cached)")

    if not to_embed:
        print(f"  All claims already embedded")
        return

    # Prepare texts: "{subject}: {assertion}" for richer semantic context
    texts = []
    for c in to_embed:
        subject = c.get("subject", "")
        assertion = c.get("assertion", "")
        if subject and assertion:
            texts.append(f"{subject}: {assertion}")
        else:
            texts.append(c.get("text", ""))

    # Batch embed
    all_embeddings: list[list[float]] = []
    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i:i + BATCH_SIZE]
        with track("embed_batch", topic_id=topic_id, model=MODEL, batch_size=len(batch)) as rec:
            try:
                response = client.embeddings.create(model=MODEL, input=batch)
                batch_embs = [item.embedding for item in response.data]
                all_embeddings.extend(batch_embs)
                usage = getattr(response, "usage", None)
                if usage:
                    rec["tokens_total"] = getattr(usage, "total_tokens", None)
                print(f"    Embedded batch {i // BATCH_SIZE + 1}/{(len(texts) - 1) // BATCH_SIZE + 1}")
            except Exception as e:
                rec["error"] = str(e)[:120]
                print(f"    Error embedding batch starting at {i}: {e}")
                # Fill with zeros as fallback
                all_embeddings.extend([[0.0] * 1536] * len(batch))

    # L2-normalize
    for emb in all_embeddings:
        arr = np.array(emb, dtype=np.float64)
        norm = np.linalg.norm(arr)
        if norm > 0:
            arr = arr / norm
        emb[:] = arr.tolist()

    # Merge embeddings back into claims
    emb_map: dict[str, list[float]] = {}
    for c, emb in zip(to_embed, all_embeddings):
        emb_map[c["id"]] = emb

    # Merge existing + new
    for c in claims:
        if c["id"] in emb_map:
            c["embedding"] = emb_map[c["id"]]
        elif c["id"] in existing:
            c["embedding"] = existing[c["id"]]
        else:
            c["embedding"] = None

    # Write output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(claims, indent=2, ensure_ascii=False))
    print(f"  Wrote {len(claims)} claims with embeddings to {output_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate embeddings for extracted claims.")
    parser.add_argument("--topic", type=str, help="Topic ID (e.g., ai-regulation)")
    parser.add_argument("--all", action="store_true", help="Embed all topics")
    args = parser.parse_args()

    _tk_path = Path(__file__).parent / "topic_keywords.json"
    topics = list(json.loads(_tk_path.read_text()).keys()) if _tk_path.exists() else []

    if args.all:
        for tid in topics:
            print(f"\nEmbedding: {tid}")
            embed_topic(tid)
    elif args.topic:
        print(f"\nEmbedding: {args.topic}")
        embed_topic(args.topic)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
