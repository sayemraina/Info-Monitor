#!/usr/bin/env python3
"""
rebuild_pipeline.py — Run the full post-clustering data pipeline in order.

Use after cluster.py to ensure all downstream data stays in sync:
  cluster.py → compute_metrics.py → generate_real_feeds.py → generate_claim_details.py

Usage:
  python3 scripts/rebuild_pipeline.py --all
  python3 scripts/rebuild_pipeline.py --topic immigration
  python3 scripts/rebuild_pipeline.py --topic immigration --skip-claim-details
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent


def run(step_name: str, cmd: list[str]) -> bool:
    """Run a command, stream output, return True on success."""
    print(f"\n{'=' * 60}")
    print(f"  STEP: {step_name}")
    print(f"  CMD:  {' '.join(cmd)}")
    print(f"{'=' * 60}")
    t0 = time.time()
    result = subprocess.run(cmd, cwd=SCRIPTS_DIR.parent)
    elapsed = time.time() - t0
    if result.returncode != 0:
        print(f"\n  ❌ FAILED ({elapsed:.1f}s) — stopping pipeline")
        return False
    print(f"\n  ✅ done ({elapsed:.1f}s)")
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Full post-clustering pipeline rebuild")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--all", action="store_true", help="Rebuild all topics")
    group.add_argument("--topic", type=str, help="Rebuild a single topic (e.g. immigration)")
    parser.add_argument(
        "--skip-claim-details",
        action="store_true",
        help="Skip generate_claim_details.py (slow, only needed when claim set changes)",
    )
    parser.add_argument(
        "--start-from",
        choices=["cluster", "metrics", "feeds", "claims"],
        default="cluster",
        help="Start from a specific step (skip earlier ones)",
    )
    args = parser.parse_args()

    scope = ["--all"] if args.all else ["--topic", args.topic]
    python = sys.executable

    steps = [
        ("cluster",  "Clustering (HDBSCAN + concept labels + UMAP)",  [python, str(SCRIPTS_DIR / "cluster.py")] + scope),
        ("metrics",  "Metrics (compute_metrics.py)",                   [python, str(SCRIPTS_DIR / "compute_metrics.py")] + scope),
        ("feeds",    "Geo + discourse feeds (generate_real_feeds.py)", [python, str(SCRIPTS_DIR / "generate_real_feeds.py")] + scope),
        ("claims",   "Claim details (generate_claim_details.py)",      [python, str(SCRIPTS_DIR / "generate_claim_details.py")]),
    ]

    # Filter steps based on --start-from
    start_keys = [s[0] for s in steps]
    start_idx = start_keys.index(args.start_from)
    steps = steps[start_idx:]

    # Optionally skip claim details
    if args.skip_claim_details:
        steps = [s for s in steps if s[0] != "claims"]

    print(f"\n🔄  Pipeline: {' → '.join(s[0] for s in steps)}")
    print(f"    Scope: {'all topics' if args.all else args.topic}")

    t_start = time.time()
    for key, label, cmd in steps:
        if not run(label, cmd):
            sys.exit(1)

    total = time.time() - t_start
    print(f"\n{'=' * 60}")
    print(f"  ✅ Pipeline complete in {total:.1f}s")
    print(f"{'=' * 60}\n")


if __name__ == "__main__":
    main()
