# Scratchpad — Living Build Tracker

Session-persistent notes, bugs, decisions, and spec compliance tracker.
**Update this file whenever anything changes.** It is the single source of truth for "what is left to do."

---

## Rules (learned the hard way)
- **Do not use --overwrite flags that touch the project root.** Spec docs live at project root level and must not be overwritten by scaffold tools.
- Before running any scaffold/init tool, list existing files first and back up anything at risk.
- After any `generate_synthetic.py` run that changes claim IDs (any edit to the random path), delete `data/metrics/*/claims/` first to purge stale detail files.
- Python 3.9 does not support `dict[str, float] | None` union syntax — use `Optional[Dict[str, float]]` from `typing`.

---

## Session Log

### Session 1 — Project Init
- Vite + React + TS scaffolded successfully
- Tailwind v4 with @tailwindcss/vite plugin
- D3 + Recharts installed
- TypeScript types written matching end-state §8
- Type check passes clean
- Dev server starts on :5173
- Synthetic data is primary path (no API keys available)
- **BUG:** `npx create-vite . --overwrite` deleted CLAUDE.md, docs/, and scripts/prompts/. Restored concept-note-v6.md from cached context. User restoring: CLAUDE.md, end-state-v3.md, extraction.md.

### Session 2 — All Zones Live
- Phases 1-9 complete. All 4 zones rendering with real synthetic data.
- `generate_synthetic.py` produces 85 JSON files across 4 topics (ai-regulation, immigration-policy, israel-palestine, climate-policy)
- **D3 Force Tuning:** charge=-18 distanceMax=200, collide radius=r+2, cluster attraction=0.08, 200 pre-ticks. Still slightly packed but visually acceptable galaxy-like layout.
- **Zone B:** VitalsPanel gracefully handles missing claim details (only top 7 claims per topic have detail files). Shows "Detail views are generated for top claims per cluster" message.
- **Zone C:** DivergencePanel loads compare data for default slices (x_platform vs reddit_platform). Heatmap, typology bars, arousal comparison all working.
- **Zone D:** 10 events per topic. Filter chips work. Event types: momentum_spike, coordination_flag, claim_dark, arousal_escalation, divergence_shift, lead_lag.
- **Topic switching:** Header tabs switch topics instantly, landscape re-renders with new data.
- **Remaining polish:** FullCompareMode, methodology tooltips on hover, Level 0→1 transition animation, claim selection highlighting needs refinement for claims with detail files.

### Session 3 — Polish + FastAPI
- Phase 10 complete: Full Compare Mode (split Zone A), methodology tooltips (300ms dotted underline), D3 CSS cx/cy transition on time window switch.
- FastAPI backend in `server/`. Live topic ingest with synthetic fallback, AddTopicButton in header (server mode only, `VITE_API_BASE_URL` env var).
- Adversarial pairs (counter-narrative dynamics) done — dashed red SVG lines in Zone A, AdversarialPairsSection in Zone B below fold.
- **D3 tuning final:** charge=-30, distanceMax=320, collide r+1.5 str=0.9 iter=3, cluster attraction=0.14, 350 pre-ticks, alpha=0.15 restart, velocity-aware boundary clamping.

### Session 4 — Gap Fixes + AG Handoff (Part A executed by CC, Part B by AG)
**Part A (Claude Code):**
- `ClaimPosition` now has `momentum?: number` field in `src/types/index.ts`
- `generate_synthetic.py`: Added `MOMENTUM_PATTERN_VALUES` dict, updated `generate_2d_positions()` to emit real `momentum` per position (±noise), built `_momentum_map` from archetype patterns before frontend-stripping
- Fixed semantic neighbors: now samples from `[c for c in frontend_claims if c["concept_id"] != arch["concept"]]` — no more identical neighbor texts
- Regenerated all data. Deleted stale `data/metrics/*/claims/` first.
- **BUG HIT:** Python 3.9 `|` union syntax → fixed with `Optional[Dict[str, float]]`
- **BUG HIT:** Stale claim detail files persisted after random seed shift → fixed by deleting claims/ before regen

**Part B (Antigravity — all Sonnet):**
- B1 ✅ `FilterChips.tsx`: Added 3 chips — Contestation (contestation_emergence), Mutation (phase_transition), Lead-Lag (lead_lag). Now 9 chips total.
- B2 ✅ `ClaimLandscape.tsx`: Replaced synthetic momentumMap with `pos.momentum ?? 0` from pipeline data. Top accelerating claim still gets 0.8 override.
- B3 ✅ `ClaimTooltip.tsx`: Relabeled "Persistence" → "Cluster", shows `{cluster.member_count} claims`.
- B4 ✅ `TopicCard.tsx`: Added hover tooltip via React portal (`createPortal`). Shows contestation level, JSD, key signal.

### Session 6 — IFI Rearchitecture: Temporal √JSD + Entropic Flux Direction
**Problem:** IFI formula (`0.3×Δ(JSD) + 0.25×max(momentum) + ...`) used arbitrary weights with no geometric meaning.
**Solution:** Replaced with temporal √JSD + ΔEntropy (zero free parameters, pure information theory).

**Core change:**
- IFI value (0–100) = √JSD(p_t, p_{t-1}) × 100, where p = normalized cluster-salience vector per window
- flux_character = sign(ΔEntropy) → `consolidating | diversifying | reshuffling`
- flags (coordination_detected, arousal_escalating) are qualitative annotations, NOT weighted in

**Files changed:**
- `scripts/generate_synthetic.py` — added `_ifi_normalize`, `_ifi_entropy_bits`, `_ifi_jsd_sqrt`, `_ifi_flux_character`, `_ifi_window_salience` helpers + new `generate_ifi(clusters, window, coord_count, arousal_escalating)`. Window-specific salience perturbation: 6h amplifies volatile clusters, 7d amplifies stable clusters, 24h is baseline.
- `src/types/index.ts` — `InformationFluxIndex` now has `entropy_delta`, `flux_character`, `flags`, `temporal_window_pair`. Removed `components` (the arbitrary-weights breakdown).
- `src/components/IntelligencePanel/IFICard.tsx` — closed card shows flux character + "Comparing X → Y" label + flag warnings. Expanded shows "Structural Direction" section with ΔEntropy value + character explanation + qualitative flags.
- `src/App.tsx` — added `InfoButtonProvider` wrapper (was missing — InfoButton always threw without it)

**Pre-existing TS errors also fixed:** ReactNode type-only imports in InfoButton/InfoButtonContext/ExpandedCardOverlay, unused `pad` var in ClaimLandscape, unused `divergence` in DivergenceHeatmap, unused `CompareData` import in DivergencePanel, unused `eventTypeFilter` param in SignalsTimeline, unused `value` param in tooltips.ts momentum().

**Result:** `npx tsc -b --force` clean. App live. IFI expanded overlay shows √JSD value, ΔEntropy, flux character with plain-language description, and qualitative flags clearly labeled as non-weighted.

### Session 5 — Frontend Revamp Execution (AG completed, CC fixed issues)
**AG completed Phases 1-6:**
- ✅ All foundation components created (InfoButton, Card, ExpandedCardOverlay, MetricIsolation, etc.)
- ✅ 40/60 layout grid implemented
- ✅ Intelligence Panel container built with 4 default cards (IFI, Situations, Divergence, Signals)
- ✅ 3 claim detail cards (Behavior, Provenance, Coordination)
- ✅ Landscape enhancements (Legend, mutation badges, pulse animation)
- ✅ Level 0 upgrades (IFI + situation on topic cards)
- ✅ New features live: IFI composite score, situation alerts with cross-linking, card-based UI, drill-down model

**CC issue fixes:**
- Fixed invalid Tailwind color class patterns (`text-#EF4444` → inline styles)
- Fixed TypeScript strict mode errors (type-only imports for ReactNode, NodeJS.Timeout → ReturnType<typeof setTimeout>)
- Fixed callback handling (IntelligencePanel close button now properly calls onDeselectClaim)
- Removed unused imports and variables
- **Result:** App now fully functional and live at localhost:5173 ✅

---

### Session 7 — Cluster Label Fixes + Dynamic Label Positioning
**Root cause chain:** UMAP puts same-topic claims close → blobs bunched. Labels tautological ("Artificial Intelligence" on AI topic). `.lstrip("a ")` bug caused tautological detection to fail.

**Fixes applied:**
1. `.lstrip()` bug → `re.sub(r'^(the |a |an )', ...)` for article stripping
2. Added `_topic_id_words` (from topic slug) + `_synonym_phrases` ("artificial intelligence"→"ai") for broader detection
3. `_is_tautological_subject()` now checks: full-subject freq, first-word, any-word match, synonym phrases, possessives
4. Topic word stripping: front AND back, synonym phrase words included, possessives handled
5. `_meta_labels` filter rejects stance values ("neutral", "pro") as standalone labels — applied to all paths
6. Bare assertion-only labels (single word with no subject) now skipped entirely
7. Dynamic label positioning: `concept-label-g` class + D3 tick SLOW PATH updates label x/y from live node centroids
8. Regenerated all 10 topics' clusters + metrics

**Files changed:** `scripts/cluster.py`, `src/components/ZoneA/ClaimLandscape.tsx`

**Known remaining label issues (data quality, not logic):**
- crypto has 3 off-topic HDBSCAN concepts (Birthright Citizenship, Military Interventions, Taylor Sheridan)
- "Orforglipron (Foundayo)" — garbled extraction
- "Cirbtc (Aims)" — garbled entity

---

## Priority Gap List (ranked — do these next)

| # | Priority | Gap | Effort | Location |
|---|----------|-----|--------|----------|
| 1 | HIGH | Node size uses `confidence` as proxy — spec requires `salience` (§7A) | L (data pipeline + UI) | `generate_synthetic.py` + `ClaimLandscape.tsx` |
| 2 | HIGH | Only 7 claim detail files per topic — most node clicks show ClaimFallback | M (data pipeline) | `generate_synthetic.py` |
| 3 | MED | Zone C: `exposure_comparison` data exists but never rendered | S (UI only) | `DivergencePanel.tsx` |
| 4 | MED | Zone C: per-cluster arousal/mutation data exists but not visualized | M (UI only) | `DivergenceHeatmap.tsx` |
| 5 | MED | Zone A hover tooltip: missing persistence duration + friction ratio (spec §4.4) | M (data + UI) | `ClaimTooltip.tsx` + landscape JSON |
| 6 | MED | Level 0: contestation_emergence not highlighted as separate indicator on cards | S (UI only) | `TopicCard.tsx` |
| 7 | LOW | Level 0 → Level 1 transition: should feel like smooth expand, currently fade-in | M (CSS/animation) | `App.tsx` + CSS |
| 8 | LOW | Level 0 search no-results state: spec requires message + fallback topic list | S (UI only) | `TopicOverview.tsx` |
| 9 | LOW | Level 0: top_accelerating_claim missing source diversity dot + momentum value | S (UI only) | `TopicCard.tsx` |
| 10 | LOW | Zone C: only 2 hardcoded slice pairs; 3rd (Reddit vs YouTube) exists in data | S (UI only) | `DivergencePanel.tsx` |

---

## Full Spec Compliance Checklist

Status codes: ✅ Done · ⚠️ Partial (works but not fully spec-correct) · ❌ Missing · 🔷 Deferred (post-ship per §9.3)

---

### ARCHITECTURE (End State §2)
- ✅ Single page, zero routing. All levels via `useState<AppState>`.
- ✅ Level 0 (multi-topic overview) as landing state
- ✅ Level 1 (single-topic zone layout) via click
- ✅ Level 2 (claim selected → Zone B updates) via click
- ✅ No modals, no expansion — all zone content updates in place
- ⚠️ Level 0 → Level 1 transition: `animate-fade-in` but spec says "selected topic card smoothly expands into the full zone layout." Currently opacity fade, not a shared-element expand.

---

### LEVEL 0 (End State §2.1, §5.1)
- ✅ 3–5 pre-loaded topics visible on load (4 topics: ai-regulation, immigration-policy, israel-palestine, climate-policy)
- ✅ Topic name displayed
- ✅ Cluster count displayed with contestation-color badge
- ✅ Headline divergence score + dominant typology + trend arrow
- ✅ Top accelerating claim (text, truncated at 80 chars)
- ✅ Key signal badge (amber pill, if any)
- ✅ Activity sparkline (mini chart)
- ✅ Hover tooltip on card: contestation level, JSD, key signal summary ← **B4 done**
- ✅ Click card → transition to Level 1
- ✅ Search bar with live filtering
- ⚠️ Search no-results state: search filters topics but unclear if empty state shows "No data available... [N] pre-indexed topics" message per spec. Likely just blank.
- ⚠️ `contestation_emergence` field in TopicSummary not separately highlighted. Spec: "if contestation emergence was flagged, a visible '⚡ Contestation emerged Xh ago' indicator appears here." Currently only `key_signal` is shown; it might overlap but is not a dedicated indicator.
- ⚠️ `top_accelerating_claim` row lacks source diversity dot and momentum value. Spec: "name + momentum value + source diversity dot."
- ❌ `most_persistent_claim` and `most_persistent_claim.persistence_windows` are in TopicSummary type but NOT shown in Level 0 card. Spec §2.1 says Level 0 cards show this. (It IS in Zone B TopicOverviewVitals — may be intended there only.)

---

### ZONE A — CLAIM LANDSCAPE (End State §3, §4)
- ✅ D3 force-directed graph, cluster-attracted layout
- ✅ Node **color** = momentum (amber→red accelerating, teal→blue decelerating, silver stable)
- ✅ Node **glow** = arousal (intensity, not color — via SVG filter)
- ✅ Cluster **hulls** with mutation-direction tinting (faint green/red/amber fill + stroke)
- ✅ **Mutation arrows** on cluster centroids (↙ mainstreaming, ↗ radicalizing, ⤢ fragmenting)
- ✅ **Adversarial links** between opposed clusters (dashed red line + "vs" label)
- ✅ Time window control (6h/24h/7d) in zone header
- ✅ CSS `cx/cy 200ms ease` transition on time window switch
- ✅ Cluster labels sitting below clusters (D3 tick-driven position)
- ✅ Hover tooltip on nodes (ClaimTooltip)
- ✅ Click node → select claim → Zone B updates to vitals
- ✅ Click landscape background → deselect
- ✅ Low-confidence nodes dimmed at 40% fillOpacity
- ✅ Selected node scaled up (+2px radius), others dimmed to 35% opacity
- ✅ Compare mode: two ClaimLandscape side-by-side with slice labels, `compareSalience` scaling per cluster
- ✅ Momentum data from real pipeline (`pos.momentum ?? 0`) ← **B2 done**
- ✅ Dedup defense: `dedupedClaims` memo filters by seen Set
- ⚠️ **Node SIZE uses `confidence` as proxy for salience** (line 131: `const baseRadius = 2.5 + confidence * 5`). Comment says "Salience approximation." Spec §3 Zone A is explicit: "**Size = salience (v6 §7A) — louder claims are larger.**" Salience ≠ confidence. Salience measures overrepresentation relative to baseline; confidence measures extraction quality. **`ClaimPosition` has no `salience` field — pipeline change required.**
- ⚠️ Hover tooltip **missing persistence duration and friction ratio**. Spec §4.4 Type 1 hover: "claim text, confidence score, arousal level, persistence duration, friction ratio, one-line summary." Current ClaimTooltip: text, cluster label, confidence, momentum, arousal, cluster member count, mutation. Missing: persistence duration, friction ratio. These live in ClaimDetail (async fetch) not in landscape JSON.

---

### ZONE B — VITALS PANEL (End State §3)
**Topic overview (no claim selected):**
- ✅ Cluster count
- ✅ Contestation level with color
- ✅ Top accelerating claim: momentum value + source diversity dot + cluster label
- ✅ Most persistent claim: persistence windows
- ✅ Top friction claim: friction value
- ✅ Highest arousal concept: trend (warming/cooling/stable)
- ✅ Notable mutation: direction + color
- ✅ "Select a claim to inspect" prompt in header

**Claim vitals (claim selected — above fold):**
- ✅ Claim text (quoted, 80 char max)
- ✅ Salience: value + sparkline + baseline label + methodology tooltip (4-part)
- ✅ Momentum: value + sparkline + source diversity dot + bridge ratio + methodology tooltip
- ✅ Friction: **prominent** amber left-border gauge + quadrant label + methodology tooltip
- ✅ Persistence: window count + methodology tooltip
- ✅ Arousal: value + trend color + sparkline + methodology tooltip
- ✅ Expressibility: original-post ratio + confidence interval + methodology tooltip
- ✅ Confidence: score + low-conf dimming at 40% opacity
- ✅ Exposure decomposition: stacked bar (production / amplification / est. exposure) + methodology tooltip

**Below fold (scrollable in Zone B):**
- ✅ Provenance: first platform + timestamp + lead-lag per platform (±hours)
- ✅ Supply chain: hops with fidelity percentages + observation boundary label
- ✅ Coordination check: 4 signals (burstiness, near_duplicate, cross_platform_sync, source_diversity_anomaly) with severity
- ✅ Semantic neighbors: top 5, with similarity scores, from different concept clusters ← **fixed in Session 4**
- ✅ Adversarial pairs / Counter-narrative dynamics (AdversarialPairsSection): correlation, response lag, mutation evidence ← **stretch goal done**
- ✅ Example content: up to 3 posts, platform labeled, "Influencer Framing" tag for YouTube
- ✅ ClaimFallback: graceful degradation when detail file missing (shows basic claim fields + honest label)

**Critical gap:**
- ⚠️ **Only 7 claim detail JSON files per topic** — 90%+ of node clicks show ClaimFallback instead of full vitals. The full deep-dive (provenance, supply chain, coordination, examples) is a core feature but inaccessible for most claims. `generate_synthetic.py` generates detail files for top 7 claims only; should generate top 20–30.

**Minor gap:**
- ❌ **Silence indicator in Zone B** — When a selected claim has recently "gone dark" (claim_dark event), Zone B doesn't surface this. It appears in Zone D as a `claim_dark` event but there's no per-claim silence flag in the vitals view. Spec §9.1 lists "silence (claim-level)" as in-scope.

---

### ZONE C — DIVERGENCE (End State §3)
- ✅ Headline JSD + trend sparkline
- ✅ Slice labels (colored blue/red badges)
- ✅ JSD methodology tooltip (4-part)
- ✅ 3 typology bars: Info Asymmetry, Interpretive, Paradigmatic
- ✅ Dominant mode marked with `*`
- ✅ Paradigmatic caveat warning when extraction confidence differs
- ✅ Typology tooltip (4-part, divergence type explanation)
- ✅ Divergence heatmap (per-cluster salience A vs B columns, color-graded)
- ✅ Slice selector (X vs Reddit, X vs YouTube)
- ✅ Arousal comparison (slice_a_avg vs slice_b_avg)
- ✅ Full Compare Mode toggle button
- ⚠️ **`exposure_comparison` data loaded in CompareData but never rendered.** `compare.exposure_comparison: {slice_a: Metric, slice_b: Metric}` exists in type + data but DivergencePanel doesn't display it. Spec §3 Zone C: exposure asymmetry should be visible here.
- ⚠️ **Per-cluster arousal/mutation data unused.** `PerClusterComparison` has `arousal_a`, `arousal_b`, `mutation_a`, `mutation_b` but DivergenceHeatmap only renders salience columns. Should add arousal indicators or mutation badges per row.
- ⚠️ Only 2 hardcoded slice pairs. Data for 3rd pair (Reddit vs YouTube) exists at `data/metrics/*/compare/reddit_platform_youtube_influencer_*.json` but the selector doesn't expose it.

---

### ZONE D — SIGNALS TIMELINE (End State §3)
- ✅ Chronological event feed
- ✅ All 8 event types present: momentum_spike, divergence_shift, coordination_flag, contestation_emergence, claim_dark, arousal_escalation, phase_transition (mutation), lead_lag
- ✅ 9 filter chips: All + 8 types ← **B1 done**
- ✅ Event icons per type (emoji: 📈 🔀 ⚠️ ⚡ 🔇 🌡️ ↗️ 🔗)
- ✅ Severity color coding (dim=low, #F59E0B=medium, #EF4444=high)
- ✅ Severity badge per card
- ✅ Time-ago formatting (e.g., "2h ago")
- ✅ Staggered slide-in + highlight-pulse animation on load
- ✅ Click event → `event.claim_id && onSelectClaim(event.claim_id)` — navigates to claim in Zone A and Zone B
- ✅ Empty state message ("No signals detected")
- ✅ Loading/error states

---

### VISUAL DESIGN (End State §4)
- ✅ Background #0A0E17 (dark navy-black)
- ✅ Panel backgrounds #111827
- ✅ Text values #F1F5F9, labels #94A3B8
- ✅ JetBrains Mono (`font-data` class) for data values
- ✅ Inter for labels and text
- ✅ Momentum color ramp via `getMomentumColor()` (red↗ amber → silver → teal → blue↘)
- ✅ Arousal glow via `getArousalGlowFilter()` — SVG filter intensity, not color
- ✅ Mutation arrow colors: green mainstreaming, red radicalizing, amber fragmenting
- ✅ Source diversity green dot (organic) / red dot (concentrated) — in Zone B
- ✅ Heatmap: dark → amber → red per salience
- ✅ Zone D severity: dim / amber / red
- ✅ Low-confidence: 40% opacity throughout
- ✅ Selected claim: highlight ring, others dim to 35%
- ✅ 200ms ease transitions on node cx/cy, fill-opacity, radius
- ✅ Slide-in + highlight-pulse on Zone D new events
- ⚠️ Level 0 → Level 1 transition: currently `animate-fade-in` (opacity only). Spec §4.3: should feel like "zooming into the topic" — topic card expands into zone layout.

---

### METHODOLOGY TOOLTIPS (End State §4.4)
All metric labels use dotted underline + 300ms hover delay pattern (via `useTooltip` hook + `MethodologyTooltip` component):
- ✅ Zone A node hover (Type 1 — immediate data summary)
- ✅ Zone B: Salience, Momentum, Friction, Persistence, Arousal, Expressibility, Exposure, Confidence
- ✅ Zone B: Provenance, Supply Chain, Coordination, Semantic Neighbors, Adversarial Pairs
- ✅ Zone C: JSD, Divergence Typology
- ✅ All tooltips follow 4-part pattern: What it is / How calculated / Current reading / Caveat

---

### DATA CONTRACTS (End State §8)
- ✅ `Claim` — all fields present in data
- ✅ `Cluster` — all fields including adversarial_pairs
- ✅ `ClaimPosition` — x, y, momentum ← added in Session 4
- ❌ `ClaimPosition.salience` — not in type or data. Required for correct node sizing.
- ✅ `Metric` — value, confidence_interval, baseline, time_window, sparkline, source_distribution
- ✅ `MomentumExtended` — extends Metric + source_diversity, bridge_ratio, persistence_windows, friction, friction_quadrant
- ✅ `Divergence` — jsd, jsd_sqrt, trend, typology (all 4 fields)
- ✅ `Slice` — id, type, label, active_volume, meets_minimum_threshold, base_rate_weight
- ✅ `Event` / `NarrativeEvent` — all 8 types, all fields
- ✅ `SupplyChain` — hops with fidelity fields, observation_boundary
- ✅ `TopicSummary` — all fields including contestation_emergence (in type but not rendered in card)
- ✅ `AdversarialPair` — momentum_correlation, response_lag, mutation_evidence

---

### SUCCESS CRITERIA (End State §10)
- ✅ 1. System loads with 3–5 active topics visible, metrics populated, zero clicks required
- ✅ 2. Clicking topic → full zone layout with landscape within 3 seconds
- ✅ 3. Landscape has ≥3 distinct narrative clusters, separated, colored by momentum, glowing by arousal
- ✅ 4. Every Zone B metric has hover tooltip explaining what it is, how calculated, what value means
- ✅ 5. Friction is prominent and shows 4-quadrant interaction with momentum
- ✅ 6. Persistence visible — user can distinguish flash-in-pan from embedded belief
- ✅ 7. Mutation trajectory arrows show mainstreaming/radicalizing/fragmenting per concept
- ✅ 8. Zone C shows divergence with continuous typology scores (WHY groups diverge, not just how much)
- ✅ 9. Zone D surfaces at least 3 distinct event types (all 8 implemented)
- ✅ 10. Low-confidence claims visually dimmed; non-contested topics would show greyed metrics (honest labels exist)
- ⚠️ 11. Supply chain shows ≥1 cross-platform hop with fidelity decay + observation boundary — implemented, but only for the 7 claims with full detail files
- ⚠️ 12. At least one coordination signal functional — implemented in data + Zone B, but only for 7 claims with detail files
- ✅ 13. Uninstructed viewer understands the claim landscape within 30 seconds
- ✅ 14. Technically literate viewer finds real methodology in Layer 3 (JSD values, typology scores, CIs)
- ✅ 15. Visual design looks like classified intelligence instrument, not hackathon project
- ✅ 16. Single page, no routing, everything is zoom in/zoom out

---

### STRETCH GOALS (End State §9.2)
- ✅ Counter-narrative dynamics (adversarial pairs) — Zone A dashed links + Zone B AdversarialPairsSection
- 🔷 Live topic input (FastAPI built in `server/`, AddTopicButton exists, but live extraction requires API keys not available in demo mode)

---

### DEFERRED FEATURES (End State §9.3) — Do Not Build Until Post-Ship
- 🔷 Full expressibility shift metric (v6 §12A)
- 🔷 Algorithmic neighborhoods (v6 §12B)
- 🔷 Full silence-as-signal expected-vs-observed model (v6 §12C)
- 🔷 Adaptive windowing (v6 §12D)
- 🔷 Instagram integration (v6 §12E)
- 🔷 Watchlist / monitoring / notifications
- 🔷 Export (snapshot, JSON, PDF)
- 🔷 Light theme
- 🔷 Raw Source Feed — Level 0 live sources heartbeat, 7 category cards (see PLAN_RAW_SOURCE_FEED.md)
- 🔷 AI Guide — contextual reactive AI navigation + dwell detection (see PLAN_AI_GUIDE.md)

---

## Next Actions by Category

### Data Pipeline (run after code changes, before reviewing in browser)
```bash
cd "/Users/sayemraina/Works/information environment monitoring system"
python scripts/generate_synthetic.py
```
*Always delete `data/metrics/*/claims/` first if claim IDs may have shifted.*

### [CC] Claude Code Tasks
1. **Add `salience` to `ClaimPosition`** (types + pipeline):
   - `src/types/index.ts` → add `salience?: number` to `ClaimPosition`
   - `generate_synthetic.py` → compute per-claim salience (relative to cluster mean volume), emit in positions
   - `ClaimLandscape.tsx` line 131 → replace `confidence * 5` with `(pos.salience ?? claim.confidence) * 5`

2. **Generate detail files for more claims**:
   - `generate_synthetic.py` → change `TOP_CLAIMS_PER_TOPIC = 7` to `20` (or 30)
   - Run regen. Delete stale claims/ first.

### [AG] Antigravity Tasks (frontend/UI — all Sonnet)
1. **Zone C: Render `exposure_comparison`** (`DivergencePanel.tsx`)
   - After the arousal comparison row, add two metric rows showing `compare.exposure_comparison.slice_a.value` and `compare.exposure_comparison.slice_b.value`

2. **Zone C: Add arousal columns to heatmap** (`DivergenceHeatmap.tsx`)
   - Add two columns after salience A/B: arousal_a, arousal_b (or show as colored dots per row)

3. **Level 0: Add `contestation_emergence` indicator** (`TopicCard.tsx`)
   - After the key_signal area, if `topic.contestation_emergence != null`, show `⚡ Contestation emerged {emerged_hours_ago}h ago` in a red/amber pill

4. **Level 0: Add source diversity dot + momentum value to top_accelerating_claim row** (`TopicCard.tsx`)
   - Show `topic.top_accelerating_claim.momentum` value and a colored dot based on `topic.top_accelerating_claim.source_diversity`

5. **Zone C: Add 3rd slice pair (Reddit vs YouTube)** (`DivergencePanel.tsx`)
   - Add `{ label: 'Reddit vs YouTube', a: 'reddit_platform', b: 'youtube_influencer' }` to `SLICE_PAIRS` array

6. **Level 0: Empty search state** (`TopicOverview.tsx`)
   - When `filteredTopics.length === 0` and `searchQuery !== ''`, show: "No data available for '[query]'. The system currently tracks {totalCount} pre-indexed topics — select one below or try a different search."

---

## TypeScript Quick Reference
```
// After changes, verify:
npx tsc --noEmit   # must produce zero errors

// Dev server:
npm run dev        # localhost:5173, no env vars needed

// Regenerate data:
python scripts/generate_synthetic.py
```

## Key File Map
```
src/types/index.ts              ← Single source of truth for all types
src/App.tsx                     ← State machine: level 0/1/2, all handlers
src/components/Level0/          ← TopicCard, TopicOverview, MiniSparkline
src/components/ZoneA/           ← ClaimLandscape (D3), ClaimTooltip
src/components/ZoneB/           ← VitalsPanel, ClaimVitals, TopicOverviewVitals,
                                   ClaimFallback, AdversarialPairsSection,
                                   MetricRow, MethodologyTooltip
src/components/ZoneC/           ← DivergencePanel, DivergenceHeatmap
src/components/ZoneD/           ← SignalsTimeline, EventCard, FilterChips
src/utils/colors.ts             ← getMomentumColor, getArousalGlowFilter, getMutationColor
src/utils/tooltips.ts           ← Tooltip content generators
scripts/generate_synthetic.py   ← Synthetic data generator (primary data path)
data/metrics/                   ← All generated JSON (landscape, timeline, compare, claims)
server/                         ← FastAPI backend (post-demo; requires API keys)
```
