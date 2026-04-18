#!/usr/bin/env python3
"""
Master ingestion orchestrator — runs all discourse ingesters for specified topics.

Usage:
    python scripts/ingest_all.py --topic immigration --topic ai-workplace
    python scripts/ingest_all.py --all
    python scripts/ingest_all.py --list   # list available ingesters
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

SCRIPTS_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPTS_DIR))

from ingesters import REGISTRY, list_ingesters

# Load topic keywords
TOPIC_KEYWORDS = json.loads((SCRIPTS_DIR / "topic_keywords.json").read_text())


def ingest_topic(topic_id: str, source_filter: list[str] | None = None, exclude_filter: list[str] | None = None) -> dict:
    """Run all discourse ingesters for a single topic. Returns stats."""
    if topic_id not in TOPIC_KEYWORDS:
        print(f"  Unknown topic: {topic_id}")
        return {"topic": topic_id, "error": "unknown topic"}

    config = TOPIC_KEYWORDS[topic_id]
    keywords = config["keywords"]
    stats = {"topic": topic_id, "sources": {}}

    for name, ingester_cls in sorted(REGISTRY.items()):
        # Skip signal ingesters (handled by ingest_signals.py)
        if ingester_cls.is_signal:
            continue

        # Apply source filter if specified
        if source_filter and name not in source_filter:
            continue

        # Apply exclusion filter if specified
        if exclude_filter and name in exclude_filter:
            continue

        print(f"  [{name}] Ingesting for {topic_id}...")
        t0 = time.time()

        try:
            ingester = ingester_cls()
            docs = ingester.ingest(topic_id, keywords)
            if docs:
                out_path = ingester._write_output(topic_id, docs)
                elapsed = round(time.time() - t0, 1)
                print(f"    → {len(docs)} documents in {elapsed}s → {out_path}")
                stats["sources"][name] = {"count": len(docs), "time": elapsed}
            else:
                print(f"    → 0 documents (no matches or source unavailable)")
                stats["sources"][name] = {"count": 0}
        except Exception as e:
            print(f"    → Error: {e}")
            stats["sources"][name] = {"error": str(e)}

    return stats


def main():
    parser = argparse.ArgumentParser(description="Run discourse ingesters")
    parser.add_argument("--topic", action="append", help="Topic ID(s) to ingest")
    parser.add_argument("--all", action="store_true", help="Ingest all topics")
    parser.add_argument("--source", action="append", help="Only run specific ingester(s)")
    parser.add_argument("--exclude", action="append", help="Skip specific ingester(s)")
    parser.add_argument("--list", action="store_true", help="List available ingesters")
    args = parser.parse_args()

    if args.list:
        print("Available ingesters:")
        for name in list_ingesters():
            cls = REGISTRY[name]
            label = "signal" if cls.is_signal else "discourse"
            print(f"  {name:20s} [{label}]  source_type={cls.source_type}")
        return

    topics = list(TOPIC_KEYWORDS.keys()) if args.all else (args.topic or [])
    if not topics:
        parser.print_help()
        return

    print(f"Ingesting {len(topics)} topic(s) with discourse sources...")
    all_stats = []

    for topic_id in topics:
        print(f"\n{'='*60}")
        print(f"Topic: {topic_id}")
        print(f"{'='*60}")
        stats = ingest_topic(topic_id, source_filter=args.source, exclude_filter=args.exclude)
        all_stats.append(stats)

    # Summary
    print(f"\n{'='*60}")
    print("Summary:")
    for s in all_stats:
        total = sum(v.get("count", 0) for v in s.get("sources", {}).values())
        errors = sum(1 for v in s.get("sources", {}).values() if "error" in v)
        print(f"  {s['topic']}: {total} documents, {errors} errors")


if __name__ == "__main__":
    main()
