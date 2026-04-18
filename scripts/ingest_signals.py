#!/usr/bin/env python3
"""
Event signal ingestion orchestrator — runs all signal ingesters.

Signal ingesters bypass the claim extraction pipeline.
Output goes directly to data/signals/{topic_id}.json.

Usage:
    python scripts/ingest_signals.py --topic immigration
    python scripts/ingest_signals.py --all
    python scripts/ingest_signals.py --source gdelt --source fred
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

TOPIC_KEYWORDS = json.loads((SCRIPTS_DIR / "topic_keywords.json").read_text())


def ingest_signals_for_topic(topic_id: str, source_filter: list[str] | None = None) -> dict:
    """Run all signal ingesters for a single topic."""
    if topic_id not in TOPIC_KEYWORDS:
        print(f"  Unknown topic: {topic_id}")
        return {"topic": topic_id, "error": "unknown topic"}

    config = TOPIC_KEYWORDS[topic_id]
    keywords = config["keywords"]
    stats = {"topic": topic_id, "sources": {}}

    for name, ingester_cls in sorted(REGISTRY.items()):
        # Only run signal ingesters
        if not ingester_cls.is_signal:
            continue

        if source_filter and name not in source_filter:
            continue

        print(f"  [{name}] Fetching signals for {topic_id}...")
        t0 = time.time()

        try:
            ingester = ingester_cls()
            signals = ingester.ingest(topic_id, keywords)
            if signals:
                out_path = ingester._write_output(topic_id, signals)
                elapsed = round(time.time() - t0, 1)
                print(f"    → {len(signals)} signals in {elapsed}s → {out_path}")
                stats["sources"][name] = {"count": len(signals), "time": elapsed}
            else:
                print(f"    → 0 signals")
                stats["sources"][name] = {"count": 0}
        except Exception as e:
            print(f"    → Error: {e}")
            stats["sources"][name] = {"error": str(e)}

    return stats


def main():
    parser = argparse.ArgumentParser(description="Run event signal ingesters")
    parser.add_argument("--topic", action="append", help="Topic ID(s)")
    parser.add_argument("--all", action="store_true", help="All topics")
    parser.add_argument("--source", action="append", help="Only run specific signal source(s)")
    args = parser.parse_args()

    topics = list(TOPIC_KEYWORDS.keys()) if args.all else (args.topic or [])
    if not topics:
        parser.print_help()
        return

    print(f"Fetching signals for {len(topics)} topic(s)...")

    for topic_id in topics:
        print(f"\n--- {topic_id} ---")
        ingest_signals_for_topic(topic_id, source_filter=args.source)

    print("\nDone.")


if __name__ == "__main__":
    main()
