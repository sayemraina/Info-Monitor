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

# Timing instrumentation — best-effort import; falls back to a no-op.
sys.path.insert(0, str(BASE_DIR))
try:
    from server.timing import track  # type: ignore
except Exception:
    from contextlib import contextmanager
    @contextmanager
    def track(event: str, **fields):  # type: ignore
        yield {}

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
    with track("cluster_umap_50", topic_id=topic_id, n_points=len(valid_claims)):
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
    with track("cluster_hdbscan", topic_id=topic_id, n_points=len(embeddings_50)) as rec:
        clusterer = hdbscan.HDBSCAN(
            min_cluster_size=10,
            min_samples=3,
            metric="euclidean",
            cluster_selection_method="eom",
        )
        labels = clusterer.fit_predict(embeddings_50)
        rec["n_clusters"] = len(set(labels)) - (1 if -1 in labels else 0)
        rec["n_noise"] = int((labels == -1).sum())

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
    # Step 3: Concept layer — agglomerative merge to target ~8 concepts
    # -----------------------------------------------------------------
    TARGET_CONCEPTS = 8
    MAX_MERGE_DISTANCE = 0.55  # never merge genuinely unrelated clusters

    print("  Computing concept layer (agglomerative merge)...")
    centroids = {}
    cluster_member_counts = {}
    for label_int, cid in cluster_id_map.items():
        mask = labels == label_int
        centroids[cid] = embeddings[mask].mean(axis=0)
        cluster_member_counts[cid] = int(mask.sum())

    # Normalize centroids for cosine distance
    for cid in centroids:
        norm = np.linalg.norm(centroids[cid])
        if norm > 0:
            centroids[cid] = centroids[cid] / norm

    # Agglomerative merge: start with each cluster as its own concept,
    # iteratively merge the two most similar until we reach TARGET_CONCEPTS.
    # Size-constrained: no concept may exceed MAX_CONCEPT_SHARE of total claims.
    cids = sorted(centroids.keys())
    concept_groups: dict[str, set[str]] = {cid: {cid} for cid in cids}
    total_clustered = sum(cluster_member_counts.values())
    MAX_CONCEPT_SHARE = 0.35  # no concept > 35% of all clustered claims

    def _concept_size(group: set[str]) -> int:
        return sum(cluster_member_counts[c] for c in group)

    def _concept_centroid(group: set[str]) -> np.ndarray:
        """Weighted centroid of a concept group (weighted by cluster member count)."""
        vecs = []
        weights = []
        for cid in group:
            vecs.append(centroids[cid])
            weights.append(cluster_member_counts[cid])
        arr = np.array(vecs)
        w = np.array(weights, dtype=np.float64)
        weighted = (arr * w[:, None]).sum(axis=0) / w.sum()
        norm = np.linalg.norm(weighted)
        return weighted / norm if norm > 0 else weighted

    # Cache concept centroids
    concept_centroids = {cid: centroids[cid].copy() for cid in cids}

    while len(concept_groups) > TARGET_CONCEPTS:
        # Find the two most similar concepts (that won't exceed size cap)
        best_dist = float("inf")
        best_a, best_b = None, None
        keys = sorted(concept_groups.keys())
        for i, ka in enumerate(keys):
            for kb in keys[i + 1:]:
                # Size constraint: merged concept must not exceed MAX_CONCEPT_SHARE
                merged_size = _concept_size(concept_groups[ka]) + _concept_size(concept_groups[kb])
                if merged_size > total_clustered * MAX_CONCEPT_SHARE:
                    continue
                dist = 1.0 - float(np.dot(concept_centroids[ka], concept_centroids[kb]))
                if dist < best_dist:
                    best_dist, best_a, best_b = dist, ka, kb

        if best_dist > MAX_MERGE_DISTANCE or best_a is None:
            break  # remaining concepts are genuinely different or all merges violate size cap

        # Merge best_b into best_a
        concept_groups[best_a] |= concept_groups[best_b]
        del concept_groups[best_b]
        # Recompute centroid for merged concept
        concept_centroids[best_a] = _concept_centroid(concept_groups[best_a])
        if best_b in concept_centroids:
            del concept_centroids[best_b]

    # Assign concept IDs
    concept_map: dict[str, str] = {}  # cluster_id -> concept_id
    for idx, (concept_key, group) in enumerate(sorted(concept_groups.items())):
        concept_id = f"concept_{topic_id}_{idx:03d}"
        for cid in group:
            concept_map[cid] = concept_id

    # Update concept_ids on claims
    for c in valid_claims:
        if c["cluster_id"] and c["cluster_id"] in concept_map:
            c["concept_id"] = concept_map[c["cluster_id"]]

    n_concepts = len(set(concept_map.values()))
    print(f"  {n_concepts} concepts after agglomerative merge (target={TARGET_CONCEPTS}, max_dist={MAX_MERGE_DISTANCE})")

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

    def _smart_title(text: str) -> str:
        """Title case that preserves acronyms and lowercases minor words."""
        import re
        minor = {"a", "an", "the", "and", "or", "but", "in", "on", "of",
                 "for", "to", "with", "by", "at", "from", "into", "as"}
        acronyms = {"ai", "us", "uk", "eu", "dei", "glp", "sec", "rss",
                    "nft", "btc", "eth", "h-1b", "glp-1", "ipo"}

        words = text.split()
        result = []
        for i, w in enumerate(words):
            low = w.lower().rstrip("'s").rstrip("'s")
            if low in acronyms or w.isupper():
                result.append(w.upper())
            elif i > 0 and w.lower() in minor:
                result.append(w.lower())
            else:
                # Title-case but preserve apostrophes: "Iran's" not "Iran'S"
                result.append(re.sub(r"(\w)([\w']*)", lambda m: m.group(1).upper() + m.group(2).lower(), w))
        return " ".join(result)

    # Trailing words that produce dangling labels when truncation cuts mid-phrase
    _trailing_stops = {
        # Prepositions/conjunctions/articles
        "and", "or", "of", "on", "in", "for", "to", "with", "the", "a", "an",
        "by", "at", "from", "&", "towards", "about", "over", "into", "vs",
        "against", "between", "through", "during", "under", "after", "before",
        # Dangling verbs/participles that need objects
        "caused", "causing", "increasing", "raises", "raised", "forcing",
        "prioritizes", "integrated", "eliminate", "eliminates", "passed",
        "creates", "requires", "involves", "affects", "reduces", "leads",
        "threatens", "enables", "promotes", "supports", "prevents", "allows",
        "suggests", "indicates", "reveals", "demonstrates", "represents",
        "engaging", "targeting", "impacting", "addressing", "seeking",
        "facing", "undermining", "transforming", "reshaping", "replacing",
        "committing", "committed", "becoming", "offer", "offers",
        "lead", "leads", "political", "prioritize", "prioritizes",
        "is", "are", "was", "were", "has", "have", "had", "being",
    }
    # Labels that are meta-words (stance/framing values, not content)
    _meta_cluster_labels = {"neutral", "pro", "anti", "ambiguous", "positive", "negative",
                            "mixed", "various", "general", "other", "unknown", "none",
                            "multiple", "several", "many", "some", "all", "controversial",
                            "critical", "supportive", "opposed", "balanced"}

    def _strip_trailing_stops(text: str) -> str:
        """Remove trailing stop words/prepositions: 'Housing Crisis in' → 'Housing Crisis'."""
        parts = text.split()
        while parts and parts[-1].lower().rstrip(".,;:") in _trailing_stops:
            parts.pop()
        return " ".join(parts) if parts else text

    def generate_short_label(members: list[dict], used_labels: set, max_len: int = 30) -> str:
        """Generate a concise conceptual theme label from cluster members.

        Strategy chain:
        1. Most common NON-TAUTOLOGICAL subject (skip topic-level terms)
        2. Most common subject (even if tautological), qualified by assertion
        3. Highest-confidence claim's subject
        4. Suffix numbering (last resort)

        Target: 2-4 word noun phrases like 'Border Security', 'AI Customer Service'.
        """
        import re
        from collections import Counter

        def _prep(raw: str) -> str:
            """Clean, title-case, truncate, strip trailing stops."""
            raw = re.sub(r'^(the |a |an )', '', raw, flags=re.IGNORECASE).strip()
            test = _smart_title(raw)
            if len(test) > max_len:
                truncated = test[:max_len]
                sp = truncated.rfind(" ")
                test = truncated[:sp] if sp > max_len * 0.4 else truncated.rstrip()
            return _strip_trailing_stops(test)

        # Count subject frequencies
        subjects: Counter[str] = Counter()
        originals: dict[str, str] = {}
        # Also count (subject, assertion) pairs for strategy 2
        pairs: Counter[tuple[str, str]] = Counter()
        for m in members:
            subj = m.get("subject", "").strip()
            assertion = m.get("assertion", "").strip()
            if subj and len(subj) > 2:
                low = subj.lower()
                subjects[low] += 1
                if low not in originals:
                    originals[low] = subj
                if assertion:
                    pairs[(low, assertion.lower())] += 1

        def _is_valid_label(test: str) -> bool:
            """Check if a label is valid: not empty, not a meta-label, not a semantic dupe."""
            return bool(test) and test.lower() not in _meta_cluster_labels and not _is_semantically_duplicate(test, used_labels)

        # --- Strategy 1: Non-tautological subjects ---
        candidate = ""
        for subj_lower, _count in subjects.most_common(15):
            if _is_tautological_subject(subj_lower):
                continue
            test = _prep(originals.get(subj_lower, subj_lower))
            if _is_valid_label(test):
                candidate = test
                break

        # --- Strategy 2: Tautological subject + assertion qualifier ---
        # When all subjects are tautological (e.g., "AI" on AI topic),
        # use assertion to differentiate: "AI Investment", "AI Regulation"
        if not candidate:
            for (subj_l, assert_l), _ in pairs.most_common(20):
                raw_subj = originals.get(subj_l, subj_l)
                # Extract first meaningful noun/adj from assertion
                assert_words = [w.strip(".,;:!?()") for w in assert_l.split()
                               if len(w.strip(".,;:!?()")) > 3
                               and w.strip(".,;:!?()").lower() not in {
                                   "is", "are", "was", "were", "has", "have", "had",
                                   "the", "being", "been", "will", "would", "should",
                                   "could", "that", "this", "not", "can", "may",
                                   "does", "more", "also", "just", "very",
                               }]
                if assert_words:
                    combo = _prep(f"{raw_subj} {assert_words[0]}")
                else:
                    combo = _prep(raw_subj)
                if _is_valid_label(combo):
                    candidate = combo
                    break

        # --- Strategy 3: Use framing field (narrative angle) ---
        if not candidate:
            from collections import Counter as _C3
            framings: _C3[str] = _C3()
            for m in members:
                fr = m.get("framing", "").strip()
                if fr and len(fr) > 3:
                    framings[fr.lower()] += 1
            for fr_low, _ in framings.most_common(5):
                test = _prep(fr_low)
                if _is_valid_label(test):
                    candidate = test
                    break

        # --- Strategy 4: Highest-confidence claim subject ---
        if not candidate:
            best = max(members, key=lambda m: m.get("confidence", 0))
            raw = best.get("subject", best.get("text", "Unknown")[:max_len])
            test = _prep(raw)
            if _is_valid_label(test):
                candidate = test

        # --- Strategy 5: Assertion text snippet as differentiator ---
        if not candidate or not _is_valid_label(candidate):
            from collections import Counter as _C5
            assertions: _C5[str] = _C5()
            for m in members:
                a = m.get("assertion", "").strip()
                if a and len(a) > 5:
                    assertions[a.lower()] += 1
            for a_text, _ in assertions.most_common(10):
                test = _prep(a_text)
                if _is_valid_label(test):
                    candidate = test
                    break

        # --- Final guard: reject meta-labels that snuck through ---
        if candidate and candidate.lower() in _meta_cluster_labels:
            candidate = ""

        # --- Final deduplicate: suffix numbering (exact match only) ---
        if not candidate or candidate in used_labels:
            base = candidate if (candidate and candidate.lower() not in _meta_cluster_labels) else "Misc"
            for suffix_idx in range(2, 20):
                alt = f"{base} ({suffix_idx})"
                if alt not in used_labels:
                    candidate = alt
                    break

        used_labels.add(candidate)
        return candidate

    def _clean_words(text: str) -> set:
        """Extract content words from a label, stripping punctuation and stop words."""
        import re
        words = re.findall(r'[a-zA-Z]+', text.lower())
        stops = {"a", "an", "the", "and", "or", "of", "on", "in", "for", "to", "with", "towards"}
        return {w for w in words if w not in stops and len(w) > 1}

    def _is_semantically_duplicate(candidate: str, used_labels: set) -> bool:
        """Check if candidate is too similar to an existing label.

        Catches: 'Iran War' vs 'War on Iran' vs 'Iran',
                 'Landlords (Harder)' vs 'Landlords (Shielding)'.
        """
        c_low = candidate.lower()
        c_words = _clean_words(candidate)
        if not c_words:
            return candidate in used_labels
        for existing in used_labels:
            e_low = existing.lower()
            e_words = _clean_words(existing)
            if not e_words:
                continue
            # Substring containment (strip parens for comparison)
            c_base = c_low.split("(")[0].strip()
            e_base = e_low.split("(")[0].strip()
            if c_base and e_base and (c_base in e_base or e_base in c_base):
                return True
            # High word overlap (ignoring qualifier in parens)
            overlap = c_words & e_words
            smaller = min(len(c_words), len(e_words))
            if smaller > 0 and len(overlap) / smaller >= 0.6:
                return True
        return False

    def generate_concept_label(
        members: list[dict],
        used_labels: set,
        topic_subjects: set,
        max_len: int = 30,
    ) -> str:
        """Generate a belief-oriented label from concept members.

        topic_subjects: subjects that appear in >25% of ALL claims in the topic.
        These are tautological ('AI' on an AI topic, 'Iran' on an Iran topic) —
        skip them and use the assertion/framing to differentiate.
        """
        import re
        from collections import Counter

        def _clean_subject(subj: str) -> str:
            """Strip parenthetical annotations from subjects if they contain gibberish.
            'Orforglipron (Foundayo)' → 'Orforglipron', but 'US Foreign Policy' untouched.
            """
            if '(' in subj and ')' in subj:
                paren_match = re.search(r'\(([^)]+)\)', subj)
                if paren_match:
                    paren_content = paren_match.group(1).strip()
                    paren_words = paren_content.split()
                    if len(paren_words) == 1:
                        w = paren_words[0].lower()
                        # Inline gibberish check (can't call _looks_like_real_word — not defined yet)
                        _bad_parens = {"foundayo", "cirbtc", "cbdc", "nfts"}
                        has_vowels = any(c in w for c in "aeiouy")
                        vowel_ratio = sum(1 for c in w if c in "aeiouy") / max(len(w), 1)
                        if not has_vowels or len(w) < 4 or vowel_ratio < 0.2 or w in _bad_parens:
                            return re.sub(r'\s*\([^)]+\)', '', subj).strip()
            return subj

        # Minimum frequency: subjects with < 5% of concept members are too niche for labels
        _min_count = max(2, len(members) * 0.05)

        # Count subjects — skip topic-level tautological subjects
        subjects: Counter[str] = Counter()
        originals: dict[str, str] = {}
        for m in members:
            subj = _clean_subject(m.get("subject", "").strip())
            if subj and len(subj) > 2:
                low = subj.lower()
                # Skip if this subject is a topic-level term (tautological)
                if _is_tautological_subject(low):
                    continue
                subjects[low] += 1
                if low not in originals:
                    originals[low] = subj

        # Count (subject, assertion) pairs — include ALL subjects for pair-based labels
        # (even topic-level ones, since the assertion differentiates)
        all_subjects: Counter[str] = Counter()
        all_originals: dict[str, str] = {}
        pairs: Counter[tuple[str, str]] = Counter()
        for m in members:
            subj = _clean_subject(m.get("subject", "").strip())
            assertion = m.get("assertion", "").strip().lower()
            if subj and len(subj) > 2:
                low = subj.lower()
                all_subjects[low] += 1
                if low not in all_originals:
                    all_originals[low] = subj
                if assertion:
                    pairs[(low, assertion)] += 1

        # Labels that are just meta-words or stance values — reject as standalone labels
        _meta_labels = {"neutral", "pro", "anti", "ambiguous", "positive", "negative",
                        "mixed", "various", "general", "other", "unknown", "none",
                        "multiple", "several", "many", "some", "all", "controversial"}

        def _truncate(text: str) -> str:
            if len(text) <= max_len:
                return _strip_trailing_stops(text)
            truncated = text[:max_len]
            sp = truncated.rfind(" ")
            result = truncated[:sp] if sp > max_len * 0.4 else truncated.rstrip()
            return _strip_trailing_stops(result)

        # --- Qualifier extraction: distill assertion into 1-2 readable words ---
        stop = {"is", "are", "was", "were", "has", "have", "had", "the", "a", "an",
                "being", "been", "will", "would", "should", "could", "that", "this",
                "its", "it", "to", "not", "be", "by", "for", "of", "in", "on",
                "can", "may", "might", "do", "does", "did", "very", "more", "also",
                "just", "even", "still", "much", "most", "some", "many", "all",
                "than", "too", "so", "if", "or", "and", "but", "at", "with", "from"}

        # Bare verbs/adverbs that are meaningless as standalone qualifiers
        # ("Create" what? "Used" how? "Committing" what? "Excessively" what?)
        # Adjectives/states stand alone: "Overvalued", "Free", "Increasing"
        _bad_qualifiers = {
            # Bare verbs needing objects
            "create", "creates", "created", "make", "makes", "made", "making",
            "use", "uses", "used", "using", "become", "becomes", "becoming",
            "lead", "leads", "cause", "causes", "occur", "occurs",
            "take", "takes", "taking", "give", "gives", "find", "found",
            "want", "wants", "need", "needs", "seem", "seems", "show",
            "shows", "keep", "keeps", "hold", "holds", "face", "faces",
            "cannot", "gone", "come", "goes", "going", "getting",
            "touch", "put", "gets", "attract", "attracts",
            "exist", "exists", "existed", "lack", "lacks", "lacked",
            "shot", "engaged", "involve", "involved", "happen", "happens",
            "appear", "appears", "remain", "remains", "continued", "continues",
            # Dangling participles/verbs (need objects)
            "committing", "planning", "improving", "improve", "eliminate",
            "generating", "generate", "attracting", "deflect", "sold",
            "shielding", "investing", "under", "private", "human",
            "occurring", "causing", "leading", "experiencing", "raises",
            "given", "related", "develop", "focused", "charged",
            "surprise", "people", "suppressing",
            # Adverbs (meaningless alone)
            "excessively", "negatively", "effectively", "rapidly",
            "increasingly", "primarily", "significantly", "potentially",
            "confusingly", "essentially", "particularly", "certainly",
            "apparently", "obviously", "clearly", "simply",
            # Nouns too vague as standalone qualifiers
            "area", "areas", "sector", "sectors", "part", "parts",
            "aspect", "aspects", "type", "types", "form", "forms",
            "level", "levels", "role", "roles", "factor", "factors",
            "poster", "point", "points", "aims", "ways", "means",
            "amount", "amounts", "manner", "style", "kind", "sorts",
            # Stance/meta words meaningless as qualifiers
            "neutral", "positive", "negative", "mixed", "controversial",
            "ambiguous", "critical", "supportive", "general", "various",
            "balanced", "opposed", "unknown",
        }

        def _looks_like_real_word(w: str) -> bool:
            """Reject gibberish: must have vowels, reasonable length, no unusual patterns."""
            w_low = w.lower()
            # Must contain at least one vowel
            if not any(c in w_low for c in "aeiouy"):
                return False
            # Reject very short or very long
            if len(w_low) < 4 or len(w_low) > 18:
                return False
            # Reject if majority consonant clusters (likely OCR/hallucination)
            vowel_count = sum(1 for c in w_low if c in "aeiouy")
            if vowel_count / len(w_low) < 0.2:
                return False
            # Reject words with unusual letter patterns (3+ consecutive consonants
            # at start or end, mixed case inside, digits)
            import re
            if re.search(r'\d', w_low):
                return False
            # Reject known gibberish that slipped through extraction
            _known_bad = {"foundayo", "cirbtc", "cbdc", "nfts"}
            if w_low in _known_bad:
                return False
            return True

        # Words that are inflammatory, defamatory, or too loaded for labels
        _inflammatory = {
            "pedophile", "pedophilia", "rapist", "rape", "terrorist", "terrorism",
            "nazi", "fascist", "fascism", "racist", "racism", "sexist", "sexism",
            "criminal", "murderer", "murder", "genocide", "genocidal",
            "evil", "satan", "satanic", "devil", "demon", "demonic",
            "stupid", "idiot", "moron", "retard", "insane", "crazy",
            "liar", "fraud", "scam", "corrupt", "corruption", "traitor",
            "treason", "treasonous", "dictator", "tyranny", "tyrant",
            "whore", "slut", "bitch", "bastard",
            "overweight", "obese", "fat", "ugly",
            "communist", "marxist", "socialist",  # too politically charged for labels
            "puppet", "shill", "grifter", "hack",
        }

        # Whitelist of safe, neutral qualifier words.
        # If an assertion word isn't here, no qualifier is used.
        # This prevents ANY loaded/opinionated language from leaking into labels.
        _safe_qualifiers = {
            # Economic/market state
            "overvalued", "undervalued", "costly", "affordable", "expensive",
            "profitable", "unprofitable", "speculative", "unsustainable",
            # Trend/direction
            "increasing", "decreasing", "rising", "declining", "growing",
            "shrinking", "expanding", "contracting", "accelerating", "slowing",
            "warming", "cooling", "escalating",
            # Scale/degree
            "high", "low", "moderate", "significant", "insufficient",
            "excessive", "inadequate", "unprecedented", "minimal",
            # Approval/status
            "approved", "rejected", "proposed", "pending", "delayed",
            "expedited", "restricted", "expanded", "reformed", "modernized",
            "available", "unavailable", "accessible", "inaccessible",
            "legal", "abolished", "established", "closed", "open",
            # Evaluation (factual, not opinion)
            "structural", "financial", "economic", "military", "cosmetic",
            "domestic", "foreign", "global", "local", "systemic",
            "voluntary", "mandatory", "automated", "displaced",
            "concentrated", "diversified", "fragmented", "consolidated",
            "mainstream", "fringe", "contested", "uncontested",
            # Descriptive states
            "failed", "successful", "stalled", "collapsed", "doubled",
            "halved", "frozen", "unfunded", "underfunded", "overfunded",
            "innovating", "disrupting", "trusted", "untested",
            "misrepresenting", "contributing", "infrastructure",
            "losses", "widespread", "appetite", "displaced",
        }

        def _distill_assertion(assertion_text: str) -> str:
            """Extract ONE safe qualifier word from an assertion.

            Uses a whitelist of neutral, descriptive terms only.
            Any word not in the whitelist is rejected — this prevents
            opinionated/inflammatory language from ever appearing in labels.
            """
            for w in assertion_text.split():
                w_clean = w.strip(".,;:!?()")
                w_low = w_clean.lower()
                if w_low in _safe_qualifiers:
                    return w_clean
            return ""

        # --- Primary strategy: subject + assertion qualifier ---
        # When subject is tautological ("AI" on an AI topic), strip the topic keyword
        # and use the remainder: "AI and Employment" → "Employment",
        # "AI Customer Service" → "Customer Service".
        # Then optionally qualify with assertion.
        candidate = ""
        for (subj_l, assert_l), pair_count in pairs.most_common(30):
            # Skip subjects that are too niche (< 5% of concept members)
            if all_subjects.get(subj_l, 0) < _min_count:
                continue
            raw_subj = all_originals.get(subj_l, subj_l)
            raw_subj = re.sub(r'^(the |a |an )', '', raw_subj, flags=re.IGNORECASE).strip()

            # If subject is tautological, strip topic keywords from front and back
            if _is_tautological_subject(subj_l):
                # Build set of words to strip (use frequency-confirmed topic words only,
                # NOT all _topic_id_words — those are only for detection, not stripping)
                _strip_words = _topic_first_words | {"and", "in", "for", "of", "the", "on", "&", "towards", "about", "over"}
                for phrase, key in _synonym_phrases.items():
                    if key in _topic_id_words:
                        _strip_words |= set(phrase.lower().split())
                # Strip from the FRONT (leading topic words + connectors + possessives)
                parts = raw_subj.split()
                while parts:
                    w_low = parts[0].lower()
                    w_base = w_low.rstrip("'s") if w_low.endswith("'s") else w_low
                    if w_low in _strip_words or w_base in _strip_words:
                        parts.pop(0)
                    else:
                        break
                # Strip from the BACK (trailing topic words + connectors)
                while parts:
                    w_low = parts[-1].lower()
                    w_base = w_low.rstrip("'s") if w_low.endswith("'s") else w_low
                    if w_low in _strip_words or w_base in _strip_words:
                        parts.pop()
                    else:
                        break
                # Words too generic to stand alone as labels after topic-word stripping
                _too_generic = {
                    "bubble", "sector", "industry", "companies", "company", "market",
                    "policy", "policies", "crisis", "system", "reform", "conflict",
                    "program", "issue", "issues", "problem", "problems", "area",
                    "region", "field", "space", "world", "group", "groups",
                    "movement", "trend", "action", "actions", "plan", "plans",
                    "situation", "conditions", "impact", "effects", "measures",
                    "services", "operations", "development", "relations",
                    "approach", "strategy", "response", "initiative", "initiatives",
                    "drugs", "medications", "pills", "pills",
                }
                if not parts:
                    # Nothing left after stripping (e.g., bare "AI") → skip to next pair.
                    continue
                remainder_lower = " ".join(p.lower() for p in parts)
                if len(parts) == 1 and remainder_lower in _too_generic:
                    # Single generic word like "Bubble" or "Sector" → keep the
                    # full subject WITH topic word, it's more informative
                    remainder = _smart_title(re.sub(r'^(the |a |an )', '', all_originals.get(subj_l, subj_l), flags=re.IGNORECASE).strip())
                    qualifier = _distill_assertion(assert_l)
                    if qualifier and len(f"{remainder} ({_smart_title(qualifier)})") <= max_len:
                        combo = f"{remainder} ({_smart_title(qualifier)})"
                    else:
                        combo = remainder
                else:
                    # Use the remainder as label base
                    remainder = _smart_title(" ".join(parts))
                    qualifier = _distill_assertion(assert_l)
                    if qualifier and len(f"{remainder} ({_smart_title(qualifier)})") <= max_len:
                        combo = f"{remainder} ({_smart_title(qualifier)})"
                    else:
                        combo = remainder
            else:
                subj_title = _smart_title(raw_subj)
                qualifier = _distill_assertion(assert_l)
                if qualifier:
                    combo = f"{subj_title} ({_smart_title(qualifier)})"
                    if len(combo) > max_len:
                        combo = subj_title
                else:
                    combo = subj_title

            combo = _truncate(combo).rstrip(":,( ").rstrip(",")
            # Reject labels that are just meta-words or stance values
            if combo and combo.lower() not in _meta_labels and not _is_semantically_duplicate(combo, used_labels):
                candidate = combo
                break

        # --- Fallback 1: subject only (works when entities are diverse) ---
        if not candidate:
            for subj_lower, count in subjects.most_common(10):
                if count < _min_count:
                    continue
                raw = originals.get(subj_lower, subj_lower)
                raw = re.sub(r'^(the |a |an )', '', raw, flags=re.IGNORECASE).strip()
                test = _truncate(_smart_title(raw))
                if test.lower() in _meta_labels:
                    continue
                if not _is_semantically_duplicate(test, used_labels):
                    candidate = test
                    break

        # --- Fallback 2: framing field (narrative angle) ---
        if not candidate:
            framings: Counter[str] = Counter()
            for m in members:
                fr = m.get("framing", "").strip()
                if fr and len(fr) > 3:
                    framings[fr.lower()] += 1
            for fr_low, _ in framings.most_common(5):
                test = _truncate(_smart_title(fr_low))
                if test.lower() in _meta_labels:
                    continue
                if not _is_semantically_duplicate(test, used_labels):
                    candidate = test
                    break

        # Fallback: highest-confidence claim subject
        if not candidate:
            best = max(members, key=lambda m: m.get("confidence", 0))
            raw = best.get("subject", best.get("text", "Unknown")[:max_len])
            raw = re.sub(r'^(the |a |an )', '', raw, flags=re.IGNORECASE).strip()
            candidate = _truncate(_smart_title(raw))

        if _is_semantically_duplicate(candidate, used_labels):
            for suffix_idx in range(2, 20):
                alt = f"{candidate} ({suffix_idx})"
                if not _is_semantically_duplicate(alt, used_labels):
                    candidate = alt
                    break

        used_labels.add(candidate)
        return candidate

    # Build concept-level labels: group all claims by concept, generate one label per concept
    concept_members: dict[str, list[dict]] = {}
    for c in valid_claims:
        if c.get("concept_id"):
            concept_members.setdefault(c["concept_id"], []).append(c)

    # Detect topic-level tautological subjects.
    # A subject like "AI" on an AI topic, or "Iran" on an Iran topic, tells the user nothing.
    #
    # Strategy: find the most frequent FIRST WORD of subjects. If a word starts >20%
    # of all subjects, any subject beginning with that word is tautological.
    # Also check exact full-string frequency (>15%) for multi-word tautologies.
    # Additionally, extract keywords from the topic_id itself and known synonyms.

    # Topic-ID-derived keywords: "ai-workplace" → {"ai", "workplace"},
    # "war-on-iran" → {"war", "iran"}, etc.
    _topic_id_words = {w.lower() for w in topic_id.split("-") if len(w) > 1 and w.lower() not in {"on", "of", "and", "the", "in", "for", "to", "a"}}
    # Known multi-word synonyms: map full phrases to topic keywords
    _synonym_phrases = {
        "artificial intelligence": "ai",
        "cryptocurrency": "crypto",
        "cryptocurrencies": "crypto",
        "glp-1": "ozempic",
        "semaglutide": "ozempic",
        "cost of living": "inflation",
        "diversity equity inclusion": "dei",
        "diversity, equity, and inclusion": "dei",
    }

    from collections import Counter as _Counter
    _first_word_counts: _Counter[str] = _Counter()
    _full_subj_counts: _Counter[str] = _Counter()
    for c in valid_claims:
        subj = c.get("subject", "").strip().lower()
        if subj and len(subj) > 2:
            import re as _re
            cleaned = _re.sub(r'^(the |a |an )', '', subj).strip()
            first_word = cleaned.split()[0] if cleaned else ""
            if first_word and len(first_word) > 1:
                _first_word_counts[first_word] += 1
            _full_subj_counts[subj] += 1
    _total_claims = len(valid_claims)

    # Words that start >20% of all subjects are topic-level entities
    _topic_first_words = {w for w, count in _first_word_counts.items()
                          if count > _total_claims * 0.20}

    # Also catch close variants: words starting with a topic keyword ("ai-powered", "ai-driven")
    # and words that commonly precede topic keywords ("artificial" → "artificial intelligence")
    _variant_first_words = set()
    for w, count in _first_word_counts.items():
        if count < _total_claims * 0.03:  # must appear in >3% of claims
            continue
        # Check if word starts with a topic keyword: "ai-powered" → "ai"
        for tw in _topic_first_words:
            if w.startswith(tw) and w != tw:
                _variant_first_words.add(w)
                break
        # Check if word is a known modifier of the topic entity
        # by looking at whether its subjects mostly start with this word + topic word
        if w not in _topic_first_words:
            # Count how many subjects starting with this word contain a topic keyword
            topic_co_occurrence = sum(
                c for subj, c in _full_subj_counts.items()
                if subj.split()[0] == w and any(tw in subj for tw in _topic_first_words)
            )
            total_w = _first_word_counts[w]
            # If >60% of this word's subjects also contain a topic keyword, it's a variant
            if total_w > 0 and topic_co_occurrence / total_w > 0.6:
                _variant_first_words.add(w)

    _topic_first_words |= _variant_first_words

    # Full subjects >15% frequency are also tautological
    _topic_full_subjects = {subj for subj, count in _full_subj_counts.items()
                            if count > _total_claims * 0.15}

    def _is_tautological_subject(subj_lower: str) -> bool:
        """Check if a subject is a topic-level tautology.

        True if: (a) exact full-subject match, OR (b) first word is a topic keyword,
        OR (c) any word matches a topic-id keyword, OR (d) subject contains a known
        synonym phrase (e.g., "artificial intelligence" → "ai").
        """
        import re
        if subj_lower in _topic_full_subjects:
            return True
        cleaned = re.sub(r'^(the |a |an )', '', subj_lower, flags=re.IGNORECASE).strip()
        words = cleaned.split()
        if not words:
            return False
        # First word match via frequency analysis
        if words[0] in _topic_first_words:
            return True
        # Any word matches a topic-id keyword (catches "immigration policy" on immigration topic)
        # Also strip possessives: "israel's" → "israel"
        for w in words:
            w_base = w.rstrip("'s") if w.endswith("'s") else w
            if w_base in _topic_first_words or w_base in _topic_id_words:
                return True
        # Check known synonym phrases
        for phrase in _synonym_phrases:
            if phrase in subj_lower and _synonym_phrases[phrase] in _topic_id_words:
                return True
        return False

    _topic_subjects = {subj for subj in _full_subj_counts if _is_tautological_subject(subj)}
    if _topic_first_words or _topic_subjects:
        print(f"  Topic-level terms (first-word): {_topic_first_words}")

    concept_labels: dict[str, str] = {}  # concept_id -> label
    concept_label_used: set = set()
    # Process concepts in descending size order (largest gets first pick of labels)
    for concept_id in sorted(concept_members, key=lambda k: -len(concept_members[k])):
        concept_labels[concept_id] = generate_concept_label(
            concept_members[concept_id], concept_label_used, _topic_subjects
        )

    print(f"  Concept labels: {concept_labels}")

    used_labels: set = set()
    clusters = []
    for cid, members in sorted(cluster_members.items()):
        # Label: per-cluster label for drill-down
        label_text = generate_short_label(members, used_labels)

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
            if dist_from_center < 0.4:
                mutation_direction = "mainstreaming"
            elif dist_from_center > 0.6:
                mutation_direction = "radicalizing"
            elif len(members) < 8:
                mutation_direction = "fragmenting"
            else:
                mutation_direction = "stable"
            mutation_magnitude = min(dist_from_center, 1.0)
        else:
            mutation_direction = "stable"
            mutation_magnitude = 0.0

        this_concept_id = concept_map.get(cid, cid)
        clusters.append({
            "id": cid,
            "concept_id": this_concept_id,
            "concept_label": concept_labels.get(this_concept_id, label_text),
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

    _tk_path = Path(__file__).parent / "topic_keywords.json"
    topics = list(json.loads(_tk_path.read_text()).keys()) if _tk_path.exists() else []

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
