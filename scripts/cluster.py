from __future__ import annotations

"""
cluster.py — HDBSCAN clustering + concept layer + 2D UMAP positions.

Usage:
    python scripts/cluster.py --topic ai-regulation
    python scripts/cluster.py --all
    python scripts/cluster.py --help

Requires embedded claims in data/claims/{topic_id}/embedded.json.
Output: data/claims/{topic_id}/clustered.json, clusters.json
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

AROUSAL_MAP = {"high": 0.85, "medium": 0.5, "low": 0.15}


def cluster_topic(topic_id: str) -> None:
    import hdbscan
    import umap

    input_path = DATA_DIR / "claims" / topic_id / "embedded.json"
    if not input_path.exists():
        print(f"  No embedded claims found at {input_path}")
        return

    claims = json.loads(input_path.read_text())
    print(f"  Loaded {len(claims)} claims")

    # Filter claims that have valid embeddings
    valid_claims = [c for c in claims if c.get("embedding") and any(v != 0.0 for v in c["embedding"])]
    if len(valid_claims) < 5:
        print(f"  Too few valid embeddings ({len(valid_claims)}). Need at least 5.")
        return

    print(f"  {len(valid_claims)} claims with valid embeddings")

    embeddings = np.array([c["embedding"] for c in valid_claims], dtype=np.float64)

    # -----------------------------------------------------------------
    # Step 1: UMAP 1536 → 50 dims for HDBSCAN (high-dim unreliable)
    # -----------------------------------------------------------------
    print("  UMAP reduction: 1536 → 50 dims...")
    reducer_50 = umap.UMAP(
        n_components=50,
        n_neighbors=15,
        min_dist=0.0,
        metric="cosine",
        random_state=42,
    )
    embeddings_50 = reducer_50.fit_transform(embeddings)

    # -----------------------------------------------------------------
    # Step 2: HDBSCAN clustering
    # -----------------------------------------------------------------
    print("  Running HDBSCAN...")
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=5,
        min_samples=3,
        metric="euclidean",
        cluster_selection_method="eom",
    )
    labels = clusterer.fit_predict(embeddings_50)

    n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
    n_noise = (labels == -1).sum()
    print(f"  Found {n_clusters} clusters, {n_noise} noise points ({n_noise / len(labels) * 100:.1f}%)")

    # Assign cluster IDs to claims
    cluster_id_map = {}  # label_int -> cluster_id string
    for i, label in enumerate(labels):
        if label == -1:
            valid_claims[i]["cluster_id"] = ""
            valid_claims[i]["concept_id"] = ""
            continue
        if label not in cluster_id_map:
            cluster_id_map[label] = f"clu_{topic_id}_{label:03d}"
        valid_claims[i]["cluster_id"] = cluster_id_map[label]
        valid_claims[i]["concept_id"] = cluster_id_map[label]  # Updated after concept merge

    # -----------------------------------------------------------------
    # Step 3: Concept layer — merge clusters with centroid cosine < 0.15
    # -----------------------------------------------------------------
    print("  Computing concept layer...")
    centroids = {}
    for label_int, cid in cluster_id_map.items():
        mask = labels == label_int
        centroids[cid] = embeddings[mask].mean(axis=0)

    # Normalize centroids for cosine distance
    for cid in centroids:
        norm = np.linalg.norm(centroids[cid])
        if norm > 0:
            centroids[cid] = centroids[cid] / norm

    # Merge clusters with cosine distance < 0.15
    concept_map = {}  # cluster_id -> concept_id
    concept_counter = 0
    assigned = set()

    cids = sorted(centroids.keys())
    for i, cid_a in enumerate(cids):
        if cid_a in assigned:
            continue
        concept_id = f"concept_{topic_id}_{concept_counter:03d}"
        concept_map[cid_a] = concept_id
        assigned.add(cid_a)

        for cid_b in cids[i + 1:]:
            if cid_b in assigned:
                continue
            cos_dist = 1.0 - float(np.dot(centroids[cid_a], centroids[cid_b]))
            if cos_dist < 0.15:
                concept_map[cid_b] = concept_id
                assigned.add(cid_b)

        concept_counter += 1

    # Update concept_ids on claims
    for c in valid_claims:
        if c["cluster_id"] and c["cluster_id"] in concept_map:
            c["concept_id"] = concept_map[c["cluster_id"]]

    print(f"  {len(set(concept_map.values()))} concepts after merging")

    # -----------------------------------------------------------------
    # Step 4: 2D UMAP on full embeddings for visualization positions
    # -----------------------------------------------------------------
    print("  UMAP reduction: 1536 → 2 dims for visualization...")
    reducer_2 = umap.UMAP(
        n_components=2,
        n_neighbors=15,
        min_dist=0.1,
        metric="cosine",
        random_state=42,
    )
    positions_2d = reducer_2.fit_transform(embeddings)

    # Normalize to [0, 1] range
    pos_min = positions_2d.min(axis=0)
    pos_max = positions_2d.max(axis=0)
    pos_range = pos_max - pos_min
    pos_range[pos_range == 0] = 1  # avoid division by zero
    positions_norm = (positions_2d - pos_min) / pos_range

    # -----------------------------------------------------------------
    # Step 5: Build Cluster metadata
    # -----------------------------------------------------------------
    cluster_members: dict[str, list[dict]] = {}
    for c in valid_claims:
        if c["cluster_id"]:
            cluster_members.setdefault(c["cluster_id"], []).append(c)

    clusters = []
    for cid, members in sorted(cluster_members.items()):
        # Label: highest confidence claim text
        best = max(members, key=lambda m: m.get("confidence", 0))
        label_text = best.get("text", "")[:80]

        # Arousal value: mean of members
        arousal_values = [AROUSAL_MAP.get(m.get("arousal", "low"), 0.15) for m in members]
        mean_arousal = float(np.mean(arousal_values))

        # Arousal trend: simple heuristic based on distribution
        high_count = sum(1 for m in members if m.get("arousal") == "high")
        high_ratio = high_count / len(members) if members else 0
        if high_ratio > 0.4:
            arousal_trend = "warming"
        elif high_ratio < 0.15:
            arousal_trend = "cooling"
        else:
            arousal_trend = "stable"

        # Mutation direction: based on centroid position relative to center
        centroid = centroids.get(cid)
        if centroid is not None:
            dist_from_center = float(np.linalg.norm(centroid - np.mean(list(centroids.values()), axis=0)))
            if dist_from_center < 0.3:
                mutation_direction = "mainstreaming"
            elif dist_from_center > 0.7:
                mutation_direction = "radicalizing"
            elif len(members) < 8:
                mutation_direction = "fragmenting"
            else:
                mutation_direction = "stable"
            mutation_magnitude = min(dist_from_center, 1.0)
        else:
            mutation_direction = "stable"
            mutation_magnitude = 0.0

        clusters.append({
            "id": cid,
            "concept_id": concept_map.get(cid, cid),
            "label": label_text,
            "member_count": len(members),
            "mutation_direction": mutation_direction,
            "mutation_magnitude": round(mutation_magnitude, 4),
            "arousal_trend": arousal_trend,
            "arousal_value": round(mean_arousal, 4),
            "adversarial_pairs": [],
        })

    # -----------------------------------------------------------------
    # Step 6: Write outputs
    # -----------------------------------------------------------------
    # Clustered claims (with positions)
    clustered_output = []
    for i, c in enumerate(valid_claims):
        claim_out = {k: v for k, v in c.items() if k != "embedding"}
        claim_out["_position_x"] = round(float(positions_norm[i][0]), 6)
        claim_out["_position_y"] = round(float(positions_norm[i][1]), 6)
        clustered_output.append(claim_out)

    # Add noise claims (those without valid embeddings) back with no cluster
    for c in claims:
        if c not in valid_claims:
            claim_out = {k: v for k, v in c.items() if k != "embedding"}
            claim_out["cluster_id"] = ""
            claim_out["concept_id"] = ""
            claim_out["_position_x"] = round(float(np.random.uniform(0.1, 0.9)), 6)
            claim_out["_position_y"] = round(float(np.random.uniform(0.1, 0.9)), 6)
            clustered_output.append(claim_out)

    out_dir = DATA_DIR / "claims" / topic_id
    out_dir.mkdir(parents=True, exist_ok=True)

    clustered_path = out_dir / "clustered.json"
    clustered_path.write_text(json.dumps(clustered_output, indent=2, ensure_ascii=False))
    print(f"  Wrote {len(clustered_output)} clustered claims to {clustered_path}")

    clusters_path = out_dir / "clusters.json"
    clusters_path.write_text(json.dumps(clusters, indent=2, ensure_ascii=False))
    print(f"  Wrote {len(clusters)} clusters to {clusters_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="HDBSCAN clustering + concept layer + 2D UMAP positions.")
    parser.add_argument("--topic", type=str, help="Topic ID (e.g., ai-regulation)")
    parser.add_argument("--all", action="store_true", help="Cluster all topics")
    args = parser.parse_args()

    topics = ["ai-regulation", "immigration-policy", "israel-palestine", "climate-policy"]

    if args.all:
        for tid in topics:
            print(f"\nClustering: {tid}")
            cluster_topic(tid)
    elif args.topic:
        print(f"\nClustering: {args.topic}")
        cluster_topic(args.topic)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
