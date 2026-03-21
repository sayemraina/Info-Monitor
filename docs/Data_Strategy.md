# Data Strategy — Narrative Monitoring System

## Overview

This document defines three data scenarios for the system, their trade-offs, and which is currently active. The system's analytical framework (metrics, visualization, topology) works identically regardless of data source — only the quality and realism of the underlying claims changes.

---

## Scenario 3: Pure Synthetic (DEPRECATED)

**Status:** Replaced by Scenario 2.

**What it was:** `generate_synthetic.py` produced claims using hardcoded archetype texts with mechanical `vary_text()` transforms (prefix/suffix/restructure). Timestamps were random (`random.uniform(0, 7)` days ago). Momentum patterns were dice-rolled. No connection to real events.

**What worked:** The narrative *positions* were realistic (correct clusters, correct fault lines) because they were authored by an LLM trained on real discourse. The data contract was correct — every field the UI expected was present.

**What didn't work:**
- Claim texts read like position papers, not social media posts
- Dynamics were meaningless — momentum spikes had no cause
- Metrics were circular — computed from random inputs, impossible to evaluate
- Anyone with 30 seconds of scrutiny could tell it was fake
- The voice was wrong — no platform-specific language, no event references

**Legacy:** The `vary_text()` mechanical transform approach and the `generate_synthetic.py` pipeline structure are preserved. The pipeline functions (embedding generation, 2D positioning, event generation, compare data, etc.) remain unchanged — only the input archetypes changed.

---

## Scenario 2: LLM as Data Layer (CURRENT)

**Status:** Active. This is what the system runs on.

### How It Works

The LLM (Claude) — trained on massive volumes of real X posts, Reddit threads, YouTube comments, and news articles — authors the claim archetypes directly. Instead of generic position statements, each archetype:

1. **References a real event** from the LLM's training data (through early 2025)
2. **Uses platform-specific voice** (X = terse/hot-take, Reddit = analytical/community, YouTube = performative/explainer)
3. **Carries pre-written variations** (10-12 per archetype) instead of mechanical transforms
4. **Is anchored to a real date** via `time_anchor`, then time-shifted to the demo window

### Architecture

```
scripts/archetypes/{topic_id}.json    ← LLM-authored, human-reviewable
         ↓
scripts/generate_synthetic.py         ← Loads archetypes, runs pipeline
         ↓
data/metrics/, data/claims/, etc.     ← Same output format as before
         ↓
React frontend                        ← No changes needed
```

### What's Real vs. Modeled

| Layer | Source | Confidence |
|---|---|---|
| Narrative positions / clusters | LLM training data | High — these are the actual fault lines in discourse |
| Platform behavior differences | LLM training data | High — X vs Reddit vs YouTube voice is well-characterized |
| Event timing / causal triggers | LLM training data | Medium-high — real events, dates may be ±days off |
| Momentum curves | Modeled from event timing | Medium — follows realistic patterns, not measured |
| Specific claim texts | LLM-authored | Medium — reflects real framing, not actual posts |
| Engagement metrics (views, counts) | Synthetic | Low — generated numbers, not observed |
| Coordination signals | Synthetic | Low — probabilistic generation, not detection |
| User attribution | Synthetic | None — no real users referenced |

### Archetype File Format

Each topic has a JSON file in `scripts/archetypes/`:
```json
{
  "id": "topic-id",
  "name": "Display Name",
  "adversarial_pairs": [["cluster-a", "cluster-b"]],
  "archetypes": [
    {
      "text": "Event-anchored claim text",
      "subject": "...",
      "assertion": "...",
      "framing": "...",
      "stance": "pro|anti|neutral",
      "arousal": "high|medium|low",
      "cluster": "cluster-name",
      "concept": "concept-name",
      "platforms": {"x": 0.55, "reddit": 0.25, "youtube": 0.20},
      "momentum_pattern": "spike|rising|stable|declining|goes_dark",
      "persistence": 5,
      "time_anchor": {"event": "Real event description", "date": "2025-01-15"},
      "variations": [
        {"text": "X-style variation", "platform": "x"},
        {"text": "Reddit-style variation", "platform": "reddit"}
      ],
      "geo_hotspots": ["sf", "nyc", "detroit"]
    }
  ]
}
```

### Edge Case Fixtures

`scripts/archetypes/_edge_cases.json` contains synthetic archetypes specifically designed to exercise UI edge states (goes_dark, low confidence, coordination flags, etc.). These are injected into specific topics during generation so the UI handles all states correctly.

### Strategic Data Gaps

`scripts/archetypes/_gaps.json` defines intentional data gaps per topic for empirical honesty. Example: a topic with sparse YouTube influencer coverage won't have a YouTube comparison slice. The UI shows these as greyed-out with an explanation.

### Verification

`scripts/verify_data.py` runs pre-generation (archetype schema validation) and post-generation (output contract validation) checks. See script for full check list.

### How to Regenerate

```bash
# Regenerate all topic data
python scripts/generate_synthetic.py

# Regenerate Level 0 data (geo hotspots, discourse feed)
python scripts/generate_level0_data.py

# Verify output
python scripts/verify_data.py
```

### How to Add/Modify a Topic

1. Create or edit `scripts/archetypes/{topic_id}.json`
2. Follow the archetype format above
3. Ensure 12-16 archetypes across 5-7 clusters
4. Include `time_anchor` for event-anchored claims
5. Include 10-12 `variations` per archetype
6. Run `python scripts/generate_synthetic.py --topic {topic_id}`
7. Run `python scripts/verify_data.py`

---

## Scenario 1: LLM + Live Signal Layer (FUTURE — NOT TO BUILD NOW)

**Status:** Deferred to next version. Do not implement during current sprint.

### What It Would Add

Everything from Scenario 2, plus a live signal ingestion layer that feeds current events into the LLM before discourse generation. This bridges the gap between the LLM's training cutoff and the present.

### Architecture (Conceptual)

```
Live signals (GDELT, RSS, FRED, Polymarket, ACLED, Google Trends)
         ↓
Signal Aggregator (Python) → Context Bundle
         ↓
LLM generates event-anchored discourse (same as Scenario 2, but current)
         ↓
Embedding → Clustering → Metrics → Dashboard
```

### Candidate Signal Sources

| Source | Type | Relevance | Cost |
|---|---|---|---|
| GDELT Project | Real-time global news events | High — event timing, geographic anchoring | Free |
| RSS feeds (NYT, Reuters, AP, etc.) | News headlines | High — event detection | Free |
| FRED API | Economic indicators | High — inflation, housing, employment data | Free |
| Polymarket API | Prediction market odds | High — crowd sentiment proxy, REAL user behavior | Free |
| ACLED | Conflict event data | High — war topics | Free for research |
| Google Trends | Search volume spikes | Medium — discourse heat detection | Free (unofficial) |
| Congress.gov API | Bills, votes, hearings | Medium — policy topics | Free |
| CoinGecko | Crypto prices | Medium — crypto topic | Free |
| FDA API | Drug approvals, safety alerts | Medium — Ozempic topic | Free |
| Wikipedia Recent Changes | Edit wars | Low-medium — narrative contestation signal | Free |

### What It Solves That Scenario 2 Doesn't

- Claims can reference events from TODAY, not just the training window
- Timestamps are genuinely current
- Some signals (Polymarket, FRED) represent REAL observed human behavior
- Geographic relevance shifts based on real events

### What It Doesn't Solve

- The DISCOURSE is still LLM-generated — what people actually said is still modeled
- Engagement metrics are still estimated
- Coordination detection is still probabilistic
- Emergent/surprising reactions that nobody predicted will be missed

### Key Risk: False Precision

The more real context you add, the more credible the modeled parts become — making it harder to distinguish observed from modeled. The "USING MODELED DATA" badge becomes more important, not less.

### Prerequisites Before Building

1. Scenario 2 must be stable and validated
2. Signal source APIs must be evaluated for reliability and rate limits
3. Context bundling format must be designed
4. Refresh cadence must be determined (hourly? daily?)
5. Failure handling: what happens when a signal source goes down?

### Honest "Blindness Window" Approach (Discussed, Deferred)

An alternative to time-shifting: keep real event dates, fill the gap from training cutoff to present with explicitly labeled projections, and show the blindness window transparently in the UI. Revisit when building Scenario 1.

---

## Data Quality Principles

These apply regardless of scenario:

1. **No naked numbers.** Every metric carries a confidence interval.
2. **Honest labeling.** "No public antecedent detected" not "Originated on Reddit."
3. **Grey out, don't zero.** When data is insufficient, show 30% opacity with explanation.
4. **No demographic inference.** Slices labeled by behavior only.
5. **No causation claims.** "Correlation detected" not "caused by."
6. **Source tagging.** YouTube claims tagged as influencer framing, distinct from population expression.
7. **Observation boundaries.** Supply chains acknowledge visibility limits.
