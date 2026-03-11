# CLAUDE.md — Narrative Monitoring System

## What This Is
Real-time narrative topology system. Extracts claims from social media, maps them into semantic space, measures divergence across populations. Single-page dark-themed intelligence dashboard. Demo runs entirely on pre-computed cached data.

## Reference Docs (read on demand, not upfront)
- `docs/concept-note-v6.md` — WHAT we measure and WHY. Metric definitions, analytical frameworks, epistemic constraints. Read before implementing any metric.
- `docs/end-state-v3.md` — WHAT the user sees and HOW data flows. Screen spec, zone layout, data contracts, API surface, visual design. Read before implementing any UI component.
- `scripts/prompts/extraction.md` — The claim extraction prompt sent to Claude Sonnet. Read before modifying extract.py.

## Tech Stack
- **Frontend:** React + TypeScript + Vite. Single page app, zero routing.
- **Visualization:** D3.js (force-directed claim landscape) + Recharts (sparklines, bars)
- **Styling:** Tailwind CSS. Dark theme only. Background #0A0E17.
- **Data layer for demo:** Frontend reads static JSON files from `/data/`. No backend server needed.
- **Backend (post-demo):** Python FastAPI. Not built during the 5-day sprint unless stretch goal (live topic input) is reached.
- **Storage:** JSON files for demo. PostgreSQL + pgvector for production.

## Model Usage — Cost Optimization
- **Claim extraction:** Claude Sonnet (claude-sonnet-4-20250514). Quality bottleneck for the entire system. Do not downgrade. ~1,500 calls for demo dataset, ~$5-15 total.
- **Embeddings:** OpenAI text-embedding-3-small. Commodity task. Cheapest option that's good enough.
- **Clustering:** HDBSCAN via `hdbscan` Python package. Runs locally. No API cost.
- **Live extraction (stretch goal only):** Gemini Flash for fast first-pass, Sonnet for low-confidence refinement only.

## Project Structure
```
/
├── CLAUDE.md                      # This file. The brain.
├── SCRATCHPAD.md                  # Session-persistent notes: bugs hit, patterns learned, decisions made mid-build. Update via # command.
├── docs/
│   ├── concept-note-v6.md         # Analytical spec (read on demand)
│   └── end-state-v3.md            # Product spec (read on demand)
├── scripts/
│   ├── prompts/
│   │   └── extraction.md          # Claim extraction prompt for Claude Sonnet
│   ├── ingest.py                  # Pull data from X + Reddit + YouTube. RUN ONCE. Output → /data/raw/
│   ├── extract.py                 # Claim extraction via Claude API. Input: /data/raw/ → Output: /data/claims/
│   ├── embed.py                   # Generate embedding vectors. Updates /data/claims/ with vectors.
│   ├── cluster.py                 # HDBSCAN clustering + concept layer + centroid computation
│   └── compute_metrics.py         # All v6 §7 metrics. Output → /data/metrics/
├── data/
│   ├── raw/                       # Raw ingested content (JSON per topic per platform). Immutable after ingest.
│   ├── claims/                    # Extracted claims with embeddings and cluster assignments
│   ├── metrics/                   # Precomputed metrics per topic per window
│   └── topics.json                # Topic index for Level 0 (TopicSummary objects)
├── src/
│   ├── App.tsx                    # Single page app. State-based levels, NOT routes.
│   ├── components/
│   │   ├── Level0/                # Multi-topic overview (landing state)
│   │   ├── TopicView/             # Single-topic zone layout container
│   │   ├── ZoneA/                 # Claim landscape (D3 force-directed graph)
│   │   ├── ZoneB/                 # Vitals panel (metrics + scrollable deep-dive)
│   │   ├── ZoneC/                 # Divergence (heatmap + comparison + Full Compare mode)
│   │   └── ZoneD/                 # Signals timeline (event feed)
│   ├── hooks/                     # Data fetching, state management
│   ├── types/                     # TypeScript types. MUST match end-state §8 exactly.
│   └── utils/                     # Metric display helpers, formatting, tooltip content generators
└── public/
    └── data/ -> ../data/          # Symlink or copy so Vite serves JSON files
```

## Coding Rules

### Do
- TypeScript strict mode everywhere.
- Components: one per file, max 200 lines.
- All metric values carry confidence intervals. No naked numbers on screen.
- Every hover tooltip follows the 4-part pattern: what it is / how it's calculated / what this reading means / caveats if any.
- Cache extraction responses. Identical content hash = skip. Never extract the same document twice.
- Fonts: JetBrains Mono for data values, Inter for labels and text.
- Color semantics are fixed and meaningful. See Visual Design section below.
- Honest labeling everywhere: "No public antecedent detected" not "Originated on Reddit." "Low contestation detected" not "No results." "Estimated" not stated as fact. "Consistent with coordination" not "Coordinated attack."
- Tag every YouTube-sourced claim with "Source: YouTube (influencer framing)" to distinguish from population expression data (X, Reddit).
- When a metric can't be computed (insufficient data, non-contested topic): grey it out at 30% opacity with a one-line explanation. Never show zero.

### Do Not
- Do not add routing. Level 0 → Level 1 → Level 2 are state changes, not URL routes.
- Do not add a platform toggle to the UI. Platforms are data sources, not user-facing filters. Platform details surface in provenance/supply chain within Zone B.
- Do not add light theme.
- Do not add user auth, accounts, or multi-tenancy.
- Do not build the FastAPI backend during the 5-day sprint. Demo reads JSON directly.
- Do not show raw counts in cross-slice comparisons. Always normalize to distributional shares.
- Do not infer demographics from behavioral clusters. Slices labeled by behavior only (e.g., "#ImmigrationReform affinity cluster" never "Hispanic users").
- Do not assert causation. "Correlation detected" not "caused by."
- Do not make salience baseline user-configurable in v1. Auto-select: platform-local for single-platform views, global for cross-platform.

## Data Contracts (Quick Reference)
Types in `src/types/`. Must match end-state §8 exactly:
- `Claim` — id, text, subject, assertion, framing, stance, confidence, arousal, register, cluster_id, concept_id, first_seen_platform, first_seen_timestamp
- `Cluster` — id, concept_id, label, member_count, mutation_direction, mutation_magnitude, arousal_trend, arousal_value, adversarial_pairs
- `Metric` — value, confidence_interval, baseline, time_window, sparkline, source_distribution
- `MomentumExtended` — extends Metric + source_diversity, bridge_ratio, persistence_windows, friction, friction_quadrant
- `Divergence` — jsd, jsd_sqrt, trend, typology {information_asymmetry, interpretive, paradigmatic, dominant_mode, paradigmatic_caveat}
- `Slice` — id, type, label (behavioral only), active_volume, meets_minimum_threshold, base_rate_weight
- `Event` — id, type, timestamp, claim_id, slice_id, severity, confidence, summary, detail
- `SupplyChain` — concept_id, hops [{platform, timestamp, claim_id, fidelity_to_origin, fidelity_to_previous}], observation_boundary
- `TopicSummary` — id, name, cluster_count, contestation_level, headline_divergence, top_accelerating_claim, key_signal, activity_sparkline, mini_landscape_nodes

## Event Types (Zone D)
8 types. Each has a trigger condition. Sorted severity-first then recency. Scrollable beyond initial 5.
1. `momentum_spike` — claim percentile jump exceeds threshold in single window
2. `divergence_shift` — JSD change exceeds threshold over 2+ windows
3. `coordination_flag` — any coordination signal (burstiness / near-duplicate / cross-platform sync / source diversity anomaly) exceeds organic baseline
4. `contestation_emergence` — topic contestation shifts low→high within 48-72h
5. `claim_dark` — active claim drops to zero production while topic volume stable
6. `arousal_escalation` — concept arousal trend shifts stable/cool → warming
7. `phase_transition` — mutation trajectory reverses (radicalizing ↔ mainstreaming)
8. `lead_lag` — same claim detected across platforms with consistent temporal offset

## Zone Layout
Single page. Fixed zones. All visible simultaneously in Level 1.
```
┌─────────────────────────────────────┬──────────────────┐
│         ZONE A (D3 landscape)       │   ZONE B         │
│         75% width, 60% height       │   25% width      │
│                                     │   100% height    │
├──────────────────┬──────────────────┤   (scrollable)   │
│   ZONE C         │   ZONE D         │                  │
│   (divergence)   │   (signals)      │                  │
│   50% of left    │   50% of left    │                  │
│   40% height     │   40% height     │                  │
└──────────────────┴──────────────────┘                  │
                                       └──────────────────┘
```
Header: search bar + topic tabs (~40px). Zone B spans full height as right sidebar.

## Build Sequence
1. **Day 1 — Data pipeline.** Run ingest.py ONCE for 3-5 topics. Choose topics: one highly polarized (immigration or Israel-Palestine), one with platform differences (AI regulation), one with recent dynamics (a topic that shifted in the past week). Extract claims. Generate embeddings. HDBSCAN cluster. **Verify embedding quality manually before Day 2** — do claims you know are related actually cluster together? If not, change embedding model before proceeding.
2. **Day 2 — Metrics engine.** compute_metrics.py against Day 1 JSON. All metrics in priority order below. Output: /data/metrics/.
3. **Day 3 — Frontend shell + Zone A.** Level 0 multi-topic cards with mini landscape thumbnails. Level 1 zone layout container. D3 force-directed landscape with full visual encoding (size=salience, color=momentum, glow=arousal, arrows=mutation). Time window segmented control. **Budget 4-6 hours on D3 tuning — this is the screenshot artifact.**
4. **Day 4 — Zones B, C, D.** Zone B: topic overview default + claim-selected vitals above the fold (momentum, friction, persistence, arousal, expressibility, exposure, confidence) + scrollable deep-dive below the fold (provenance, supply chain, coordination, semantic neighbors, example content). Zone C: divergence heatmap + continuous typology scores + slice selector + Full Compare mode (landscape splits, Zone B compresses to slim vitals, Zone D unchanged, clear Exit button). Zone D: signals timeline + type filter chips. All hover-for-methodology tooltips with 4-part pattern.
5. **Day 5 — Intelligence + polish.** Lead-lag, coordination signals, manufactured contestation, supply chain (2-3 hop with honest observation boundaries), claim-level silence, expressibility (original-post ratio). Visual polish. Failure states (confidence dimming, grey-out, honest labels). Stretch: counter-narrative dynamics (adversarial pairs + response lag, centroid-based, cheap compute), live topic input.

## Metric Priority (if Day 2 runs long)
Implement in this order. Items 4-6 can slip to Day 3 morning:
1. Momentum + source diversity + bridge nodes
2. Friction (elevated — 2nd most important tactical signal after momentum)
3. Divergence (JSD + continuous typology: salience ratio, rank correlation, support overlap)
4. Persistence (consecutive windows above threshold)
5. Arousal profile (mean arousal per concept per window, trending direction)
6. Mutation directionality (centroid vector movement vs. claim space center)
7. Salience (overrepresentation with shrinkage for small samples)
8. Exposure decomposition (production / amplification / estimated exposure)

## Visual Design (Quick Reference)
Full spec in end-state §4.
- **Background:** #0A0E17 (dark navy-black)
- **Panels:** #111827
- **Text values:** #F1F5F9 in JetBrains Mono
- **Labels:** #94A3B8 in Inter
- **Sparklines:** #06B6D4 (cyan)
- **Node colors:** #F59E0B → #EF4444 (accelerating) | #14B8A6 → #3B82F6 (decelerating) | #94A3B8 (stable)
- **Arousal:** border glow intensity, not color. High = radiating energy, low = solid calm.
- **Source diversity:** #22C55E green dot (organic) | #EF4444 red dot (concentrated)
- **Mutation arrows:** #22C55E (mainstreaming) | #EF4444 (radicalizing) | #F59E0B (fragmenting)
- **Heatmap:** dark (low) → #F59E0B (medium) → #DC2626 (high)
- **Low confidence:** 40% opacity
- **Greyed-out:** 30% opacity + explanation text
- **Animations:** meaningful only. Topology transition on window switch (200ms ease). Selection: highlight ring + dim others to 60%.

## When Stuck
1. Stop. Do not add context to a confused model.
2. `/clear` to wipe context.
3. Re-read this CLAUDE.md.
4. Break the task into atomic units.
5. Metric unclear → read `docs/concept-note-v6.md` §7.
6. UI component unclear → read `docs/end-state-v3.md` §3.
7. Extraction producing bad results → iterate on `scripts/prompts/extraction.md`.
8. Log what went wrong in SCRATCHPAD.md so next session doesn't repeat.
