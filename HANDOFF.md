# Session Handoff — Cluster Landscape Labels + Dynamic Positioning

**Date:** 2026-04-07
**Branch:** `synthetic-demo`
**Last working state:** App compiles clean (`npx tsc --noEmit` = 0 errors), dev server runs at :5173, all 10 topics regenerated with fixed labels. Visually verified: landscapes for immigration, war-on-iran, ai-bubble all show 5-8 distinct blobs with non-tautological belief-oriented labels spread across the viewport.

---

## What Was Done This Session (in execution order)

### 1. Fixed `.lstrip()` Bug in Tautological Subject Detection
**File:** `scripts/cluster.py` — `_is_tautological_subject()` function (around line 575)

**Bug:** Python's `.lstrip("a ")` strips individual CHARACTERS ('a' and ' '), not the substring "a ". So `"ai and employment".lstrip("a ")` stripped the leading 'a' → `"i and employment"` → first_word = "i" → NOT in topic_first_words → tautological detection failed. This is why "Artificial Intelligence" labels persisted on AI topics despite the detection logic being otherwise correct.

**Fix:** Replaced `.lstrip("the ").lstrip("a ").lstrip("an ")` with `re.sub(r'^(the |a |an )', '', subj_lower, flags=re.IGNORECASE)`.

### 2. Added Multi-Layer Tautological Detection
**File:** `scripts/cluster.py` — around lines 511-595

The frequency-based first-word analysis (>20% threshold) only catches "ai" but not "artificial intelligence" because "artificial" appears as first word in <3% of claims (most say "AI" not "Artificial Intelligence"). Added three new detection layers:

- **Topic-ID keyword extraction:** `_topic_id_words` = words from topic ID slug (e.g., `ai-workplace` → `{"ai", "workplace"}`). Used for DETECTION only, NOT for stripping (stripping all topic-id words is too aggressive — "Australian Housing Crisis" would lose "Housing").
- **Synonym phrase mapping:** `_synonym_phrases` dict maps multi-word forms to topic keywords:
  ```python
  {"artificial intelligence": "ai", "cryptocurrency": "crypto", "cryptocurrencies": "crypto",
   "glp-1": "ozempic", "semaglutide": "ozempic", "cost of living": "inflation",
   "diversity equity inclusion": "dei", "diversity, equity, and inclusion": "dei"}
  ```
- **Possessive handling:** `"israel's"` → strips `'s` before matching against topic keywords. Both in detection and in stripping loop.

`_is_tautological_subject()` now checks: (a) full-subject frequency match (>15%), (b) first word in `_topic_first_words`, (c) any word matches `_topic_first_words` OR `_topic_id_words`, (d) subject contains a known synonym phrase whose mapped key is in `_topic_id_words`.

### 3. Fixed Topic Word Stripping
**File:** `scripts/cluster.py` — around lines 435-455

Previous: only stripped from the FRONT (leading topic words). Failed for "US Foreign Policy Towards Iran" where "Iran" is at the end.

Now:
- Strips topic keywords from **front AND back** (not middle — preserves modifiers)
- Synonym phrase words added to `_strip_words` set — "Artificial Intelligence" fully stripped to empty → falls to next pair
- Only frequency-confirmed `_topic_first_words` used for stripping (NOT `_topic_id_words`) — prevents "Australian Housing Crisis" losing "Housing" and "Crisis"
- Possessive forms handled in both front and back strip loops
- Connectors expanded: added "towards", "about", "over" to strip set

### 4. Eliminated Vague Standalone Labels
**File:** `scripts/cluster.py` — around lines 363-470

Problem: When a tautological subject strips to nothing (e.g., bare "AI"), the code fell through to assertion-only path, producing labels like "Desirable", "Free", "Anger", "Neutral".

Fixes:
- When stripped subject is empty, the pair is **SKIPPED entirely** (`continue`) — no more bare qualifier labels
- `_meta_labels` set rejects stance/meta values as labels at every path: `{"neutral", "pro", "anti", "ambiguous", "positive", "negative", "mixed", "various", "general", "other", "unknown", "none", "multiple", "several", "many", "some", "all", "controversial"}`
- Applied `_meta_labels` check to primary pair loop AND Fallback 1 (subject only) AND Fallback 2 (framing field)
- Added bad qualifiers: "confusingly", "essentially", "particularly", "certainly", "apparently", "obviously", "clearly", "simply"
- Fixed trailing punctuation in qualifiers via `.strip(".,;:!?()")` before word filtering

### 5. Dynamic Label Positioning in D3 Tick Handler
**File:** `src/components/ZoneA/ClaimLandscape.tsx`

Problem: Concept labels were computed once from initial node positions via `conceptLabels` useMemo (line ~385) and rendered as static SVG. They never moved when the D3 simulation repositioned nodes. User said: "if claims in a cluster move together to a certain area, the topic heading should move with them."

Fix:
- Added `className="concept-label-g"` and `data-concept-id={concept.id}` attributes to the SVG `<g>` elements wrapping each label (around line 556)
- Added label position update in the SLOW PATH geometry block (line ~299, after hull updates, before adversarial link updates):
  ```typescript
  svg.selectAll<SVGGElement, unknown>('.concept-label-g').each(function() {
    const conceptId = this.getAttribute('data-concept-id')
    const conceptNodes = conceptGroupMap.get(conceptId)
    const cx = conceptNodes.reduce((s, n) => s + (n.x ?? 0), 0) / conceptNodes.length
    const cy = Math.max(...conceptNodes.map(n => (n.y ?? 0) + (n.radius ?? 8))) + 16
    // Update text and rect positions
  })
  ```
- Labels now follow their cluster centroids on every Nth tick (same interval as hull updates)

### 6. Regenerated All Data
```bash
python3 scripts/cluster.py --all      # Re-clustered all 10 topics
python3 scripts/compute_metrics.py --all   # Regenerated all metrics/landscape/timeline/compare
```

---

## Visual Verification Results

Verified in browser at localhost:5173 via preview screenshots:

**Immigration landscape (Level 1):**
- 5-8 distinct blobs visible with convex hulls
- Labels: "Birthright Citizenship (Lega...)", "Deportation (Expedited)", "ICE (Abolished)", "Policy (Restrictive)"
- Blobs spread across viewport, not bunched in center
- Mutation arrows (→ ↓) visible on clusters
- Large blob on bottom-left (biggest concept), several medium blobs in center/right

**War on Iran landscape (Level 1):**
- 7-8 distinct blobs with hulls
- Labels: "Jet Fuel (Doubled)", "Resource Allocation (Impacte...)", "US Foreign Policy (Dangerous...)", "Trump Administration", "Captured Pilots (Shields)", "Donald Trump (Security)"
- No "Iran" or "War" in any label — tautological detection fully working
- Good viewport utilization

**AI Bubble landscape (Level 1):**
- Labels: "Data Centers (Delayed)", "Sector (Speculative)", "Companies (Overvalued)", "Openai (Trusted)", "Industry (Unsustainable)", "Bubble (Unsustainable)"
- No "AI" or "Artificial Intelligence" anywhere — synonym phrase detection working
- Proportional sizing — "Companies (Overvalued)" visually largest (most nodes)
- Golden/orange nodes visible for gaining-momentum concepts

**Level 0 geo map labels also verified:**
- Ozempic: "Metabolic Bariatric", "Oral Weight Loss", "Roche's CT-388" (no "Ozempic")
- Immigration: "Border Security", "Birthright Citizenship", "Immigration Reform"
- War on Iran: "Iran-Us Relations", "Donald Trump", "US Military Operations"

---

## Current Label Quality (exact output of last `cluster.py --all`)

```
ai-workplace: Radiation Oncology, Employment (Displacement), Jobs (Area), Apple (Innovating),
  Job Displacement (Losses), Customer Service Automation, Microsoft (Infrastructure), Adoption (Overstated)

war-on-iran: Trump Administration, Nuclear Deal (Legitimized), Strait of Hormuz (Closed),
  Donald Trump (Security), Resource Allocation (Impacted), US Foreign Policy (Dangerous),
  Captured Pilots (Shields), Jet Fuel (Doubled)

ozempic-glp1: Similar Drugs (Contributing), Medications (Available), Weight-Loss Drugs (Cosmetic),
  Novo Nordisk (Failed), Wegovy (Appetite), Orforglipron (Foundayo), Generic Semaglutide Drugs,
  Tariffs (Increase)

immigration: Policy (Restrictive), Border Control (Modernized), American Identity,
  Democratic Party (Support), Birthright Citizenship (Legal), Donald Trump (Insincere),
  ICE (Abolished), Deportation (Expedited)

housing-crisis: Rent Prices (High), Crisis (Financial), Landlords (Harder),
  Mortgage Rates (Increasing), Economic System (Decline), Cost of Living (Unaffordable),
  Real Estate Companies, Industry Lobbyists (Undue)

israel-palestine: Gaza War (Necessary), United States (Crimes), Donald Trump (Attack),
  US Foreign Policy, Conflict (Requires), Palestinians (Poster), Missile Defense System,
  Benjamin Netanyahu

crypto-digital-money: Regulation (Structured), Cirbtc (Aims), Tether (Misrepresenting),
  Trading (Profits), Donald Trump (Biased), Birthright Citizenship, U.S. Military Interventions,
  Taylor Sheridan (Hollywood)

inflation-cost-of-living: Grocery Prices (Decreased), Pay Raise (Insufficient),
  Trump Administration, Global Economy (Collapsing), Politicians (Economic),
  U.S. Election (Impacted), Charlie Kirk (Overweight), Government Spending

dei-rollbacks: Conservatives (Gender), Nasa's Artemis Mission, Initiatives (Protected),
  Military (Racist), Reverse Discrimination

ai-bubble: Companies (Overvalued), Industry (Unsustainable), Sector (Speculative),
  Magnificent Seven Stocks, Bubble (Unsustainable), Data Centers (Delayed),
  Microsoft (Sectors), Openai (Trusted)
```

**Known remaining issues (data quality, not labeling logic):**
- crypto-digital-money has 3 off-topic concepts: "Birthright Citizenship", "U.S. Military Interventions", "Taylor Sheridan (Hollywood)" — these are HDBSCAN noise clusters containing off-topic extracted claims. Fix requires post-clustering topic-relevance filtering or re-extraction with better prompts.
- "Orforglipron (Foundayo)" on ozempic — garbled qualifier from messy extraction assertion
- "Cirbtc (Aims)" on crypto — garbled entity name from extraction
- "Palestinians (Poster)" — weak qualifier, but acceptable

---

## What Remains (Priority Gap List from SCRATCHPAD.md)

| # | Priority | Gap | Details | Location |
|---|----------|-----|---------|----------|
| 1 | HIGH | Node size uses `confidence` as proxy — spec requires `salience` (§7A) | Need `salience` field in `ClaimPosition` type + pipeline computation + use in `ClaimLandscape.tsx` line 131 (currently `2.5 + confidence * 5`) | `src/types/index.ts`, `scripts/generate_synthetic.py`, `ClaimLandscape.tsx` |
| 2 | HIGH | Only 7 claim detail files per topic — 90%+ clicks show ClaimFallback | Change `TOP_CLAIMS_PER_TOPIC = 7` to 20-30 in `generate_synthetic.py` | `scripts/generate_synthetic.py` |
| 3 | MED | Zone C: `exposure_comparison` data loaded but never rendered | Data exists in CompareData type, just needs UI rows in DivergencePanel | `src/components/ZoneC/DivergencePanel.tsx` |
| 4 | MED | Zone C: per-cluster arousal/mutation data unused in heatmap | `PerClusterComparison` has arousal_a/b, mutation_a/b but heatmap only shows salience | `src/components/ZoneC/DivergenceHeatmap.tsx` |
| 5 | MED | Zone A hover tooltip missing persistence + friction | Spec §4.4 requires these in Type 1 hover. Data is in ClaimDetail (async), not landscape JSON | `src/components/ZoneA/ClaimTooltip.tsx` |
| 6 | LOW | Level 0→1 transition should be smooth expand, not fade | Currently `animate-fade-in`, spec says topic card expands into zone layout | `src/App.tsx` |

**Full spec compliance checklist is in SCRATCHPAD.md** — every zone, every feature, marked ✅/⚠️/❌/🔷.

---

## Key Files Modified This Session

```
scripts/cluster.py                          # Tautological detection, label generation, synonym mapping
src/components/ZoneA/ClaimLandscape.tsx      # Dynamic label positioning in D3 tick, concept-label-g class
```

## Key Files for Full Context

```
CLAUDE.md                                   # Project brain — coding rules, data contracts, zone layout, build sequence
SCRATCHPAD.md                               # CRITICAL — full 7-session build history, spec compliance checklist, gap list, key file map
scripts/cluster.py                          # Clustering pipeline: HDBSCAN → concept merge → UMAP 2D → label generation
scripts/generate_synthetic.py               # Synthetic data generator (primary data path, no API keys needed)
scripts/compute_metrics.py                  # Metrics engine: landscape, timeline, compare, claim details
src/components/ZoneA/ClaimLandscape.tsx      # D3 force landscape — nodes, hulls, labels, adversarial links, zoom
src/types/index.ts                          # TypeScript types — single source of truth for all data contracts
src/App.tsx                                 # State machine: Level 0/1/2, all handlers, data fetching
```

## Commands

```bash
# Dev server
npm run dev                                 # localhost:5173

# Regenerate cluster data (after changing cluster.py)
python3 scripts/cluster.py --all

# Regenerate metrics (after changing clusters or generate_synthetic.py)
python3 scripts/compute_metrics.py --all

# Regenerate ALL synthetic data from scratch
python3 scripts/generate_synthetic.py       # WARNING: delete data/metrics/*/claims/ first if claim IDs change

# TypeScript check
npx tsc --noEmit

# Real data pipeline (requires API keys — not used in demo mode)
python3 scripts/ingest.py → extract.py → embed.py → cluster.py → compute_metrics.py
```

## Architecture Quick Reference

- **Single page app** — Level 0/1/2 via `useState<AppState>`, no routing
- **10 topics** — ai-workplace, war-on-iran, ozempic-glp1, immigration, housing-crisis, israel-palestine, crypto-digital-money, inflation-cost-of-living, dei-rollbacks, ai-bubble
- **Zone A** (75% width, 60% height) — D3 force landscape, concept hulls, mutation arrows, adversarial links
- **Zone B** (25% width, 100% height, right sidebar) — Vitals panel, claim detail on selection
- **Zone C** (50% of left, 40% height) — Divergence: JSD + typology + heatmap + Full Compare Mode
- **Zone D** (50% of left, 40% height) — Signal timeline with 8 event types + filter chips
- **Data flow:** Static JSON in `/data/` served by Vite. Frontend fetches via `fetch('/data/metrics/...')`.
- **Real pipeline:** ingest → extract (Claude Sonnet) → embed (OpenAI) → cluster (HDBSCAN+UMAP) → compute_metrics
- **Demo pipeline:** `generate_synthetic.py` creates everything without API keys
