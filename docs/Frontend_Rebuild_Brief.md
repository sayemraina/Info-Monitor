# FRONTEND REBUILD BRIEF
## Single Source of Truth for the Frontend

*This document REPLACES all previous frontend specifications including End State v3 zones, Frontend_UI_UX_Spec_v1, and the Zone Layout section of CLAUDE.md. If anything in CLAUDE.md or end-state-v3.md contradicts this document, THIS DOCUMENT WINS.*

*Reference mockup: `Instrument_Mockup.html` — open this in a browser to see the target aesthetic. The mockup is a simplified canvas prototype. The production build uses React + D3 + TypeScript.*

---

## 1. THE VISION IN ONE SENTENCE

The claim landscape fills the entire viewport as a living topographic terrain. Intelligence data overlays as semi-transparent HUD elements. The aesthetic is classified intelligence instrument, not web dashboard.

---

## 2. ARCHITECTURE: FULL-VIEWPORT LANDSCAPE + HUD OVERLAYS

**There are NO panels, NO sidebars, NO zones, NO cards with borders.** The entire screen is the claim topology. Intelligence appears as floating HUD elements overlaid on the terrain with semi-transparent backgrounds.

```
┌─────────────────────────────────────────────────────────┐
│ [SYS BAR: platform status, confidence, UTC clock]       │
│                                                         │
│ [FLUX INDEX]              [TOPIC NAME + TABS + TIME]    │
│  73 ▲+8                                                │
│                                                         │
│          ●●                                             │
│        ●●●●●         ●●                    [BRIEFING   │
│       ●●●●●●●      ●●●●●                   STRIP:     │
│        ●●●●●       ●●●●●●●    ●●           situations  │
│         ●●          ●●●●      ●●●●●         divergence │
│                      ●●      ●●●●●●●        claim      │
│     ●●●●                     ●●●●●          detail]    │
│    ●●●●●●●         ●●●●●      ●●                      │
│     ●●●●●          ●●●●●●                              │
│      ●●              ●●●●                               │
│                                                         │
│ [LEGEND]                                                │
│ ▸ momentum_spike: 'Border security...' 20→72 pctl ▸ coordination_flag: 47 near-dupes... ▸
└─────────────────────────────────────────────────────────┘
```

**The landscape is rendered on a `<canvas>` element or via D3 SVG that fills 100vw × 100vh.** All HUD elements are positioned with CSS `position: fixed` and have semi-transparent backgrounds that let the topology show through.

---

## 3. VISUAL DIRECTION: CLASSIFIED INTELLIGENCE INSTRUMENT

### The Void
- Background: TRUE BLACK `#000000` or near-black `#030508`
- NOT our old `#0A0E17` — that was a dashboard color. This is the void. The data is the light source.
- Subtle radial vignette: slightly lighter at center of landscape, darker at edges. Creates depth.
- Faint grid lines at ~3% opacity (`rgba(148,163,184,0.015)`). 60px spacing. Creates the topographic/tactical feel.

### Cluster Terrain
Each claim cluster is NOT just a group of dots. It's a terrain feature:
- **Contour rings** at low opacity around each cluster (3-4 concentric rings, decreasing opacity outward). Like elevation contours on a topographic map.
- **Density glow** — a radial gradient emanating from the cluster center in the cluster's dominant color. Subtle (2-8% opacity). Creates the feeling that the cluster is a heat source.
- **Inter-node connection lines** — thin, low-opacity lines (`rgba(148,163,184,0.04)`) between nodes within the same cluster. This makes clusters feel like network structures, not scattered dots. The lines create visual density that distinguishes cluster interiors from the void between clusters. Lines become slightly brighter when the cluster is highlighted via cross-link.
- **On hover (situation card cross-link):** contour rings, density glow, and connection lines intensify. The cluster becomes visually prominent while everything else dims.

### Node Visual Encoding
Every node simultaneously encodes 4 data dimensions:
- **SIZE** = salience (bigger = more of the conversation)
- **COLOR** = momentum (red/amber = accelerating, teal/blue = decelerating, grey = stable). Use the existing color scale: `#EF4444` → `#F59E0B` → `#94A3B8` → `#14B8A6` → `#3B82F6`
- **GLOW** = arousal. High arousal nodes have a visible radial glow halo bleeding into surrounding space. NOT a subtle CSS box-shadow — a real radial gradient that extends 1.5-2× the node radius. The glow color matches the node color. Low arousal = no glow, just a solid dot.
- **PULSE** = friction. High-friction nodes have a breathing size animation (±12%, ~1.5s cycle). Low friction = perfectly still.

### Cluster Labels and Badges
ON the terrain, not in a sidebar:
- **Cluster name** below each cluster in JetBrains Mono, 10-11px, low opacity (`rgba(148,163,184,0.2)`). Becomes brighter on hover.
- **Analytical status label** — one-word computed characterization above or next to the cluster name: "ACCELERATING", "CONTESTED", "MAINSTREAMING", "DORMANT", "FRAGMENTING". Computed from cluster metrics (high momentum → ACCELERATING, high friction → CONTESTED, mainstreaming mutation → MAINSTREAMING, low momentum + low friction → DORMANT). Slightly brighter than the cluster name. Tells the user the cluster's CHARACTER at a glance.
- **Mutation badge** below the name: "→ mainstreaming" in green, "↗ radicalizing" in red, "⇶ fragmenting" in amber. Written-out text, not just symbols.
- **Health score** — one number per cluster (composite of momentum + friction + persistence), positioned near the cluster. JetBrains Mono, low opacity.

### Typography
- **ALL data values:** JetBrains Mono. No exceptions. Every number, every score, every metric.
- **Labels and text:** Inter, light weight.
- **Large numbers (IFI score):** JetBrains Mono, 48-56px, with `text-shadow` glow in the accent color. The number should appear to emit light.
- **Cluster labels:** JetBrains Mono, 10px.

### Color Palette
```
TRUE BLACK:     #000000 or #030508 (void)
ACCENT:         #E94560 (primary highlight, IFI number, selected states)
CYAN:           #06B6D4 (sparklines, ⓘ tooltips, system info)
AMBER:          #F59E0B (warnings, medium signals, interpretive divergence)
RED:            #EF4444 (high severity, acceleration, radicalizing)
GREEN:          #22C55E (organic, mainstreaming, low severity)
TEAL:           #14B8A6 (deceleration)
BLUE:           #3B82F6 (strong deceleration)
MUTED:          #94A3B8 (labels, stable nodes)
DIM:            rgba(148,163,184,0.2-0.4) (background text, contours)
```

### Animations
Meaningful only. Never decorative.
- **Node pulse:** `size × (1 + sin(t × 3) × 0.12)` — subtle breathing for high-friction nodes.
- **Glow:** ambient, persistent, not animated (static radial gradient).
- **Time window switch:** all nodes animate smoothly to new positions/sizes/colors. 300ms ease.
- **Node selection:** selected node gets accent ring, all others fade to 8-10% opacity. 200ms ease.
- **Cluster highlight (cross-link):** density glow and contours intensify, other clusters dim. 200ms ease.
- **Ticker scroll:** constant horizontal movement at ~1px/frame.

---

## 4. HUD ELEMENTS

### 4A. System Status Bar (top edge)
- `position: fixed; top: 0; height: 26px`
- Background: gradient from `rgba(0,0,0,0.8)` to transparent
- Content: platform status (X: LIVE, Reddit: LIVE, YT: CACHED), system confidence score, UTC clock
- Font: JetBrains Mono, 9px, very low opacity
- Purpose: ambient awareness that the system is alive and monitoring

### 4B. Information Flux Index (top-left)
- `position: fixed; top: 36px; left: 24px`
- Label: "INFORMATION FLUX INDEX" in JetBrains Mono, 9px, very dim
- Number: 48-56px, JetBrains Mono, bold, `color: #E94560`, with `text-shadow: 0 0 40px rgba(233,69,96,0.3)`
- Delta: "▲ +8 24h" in amber below
- Sparkline: tiny SVG, 70×16px, cyan, below delta
- ⓘ button next to label (see §6)
- Flags: "⚠ coordination detected" in dim red when applicable
- **CLICK the IFI number or section** → opens a radar/spider chart as a centered overlay (everything else blurs). The radar shows 4 axes: divergence acceleration, momentum concentration, arousal escalation, coordination signals. The current topic's shape is plotted. Different topics produce different shapes — "AI Regulation is high on divergence but low on arousal" looks different from "Israel-Palestine is maxed on arousal and momentum." The shape IS the diagnostic. Click outside or "← back" to close.

**How IFI is computed:** `√JSD(topic_distribution_at_t, topic_distribution_at_t-1)` — the temporal distributional flux. NOT a weighted average of multiple metrics. One clean measurement. Flags for coordination/arousal are qualitative annotations, not weighted into the number. The radar chart shows component CONTRIBUTIONS to context, not component WEIGHTS in the formula.

### 4C. Topic + Time (top-right)
- `position: fixed; top: 36px; right: 24px; text-align: right`
- Topic name: Inter, 20px, semi-weight, high opacity
- Meta line: "8 CLUSTERS · HIGH CONTESTATION · 24H" in JetBrains Mono, 10px, dim
- Topic tabs: small pills with 1px border, JetBrains Mono 9px. Active tab: accent color border.
- Time window: `6H | 24H | 7D` pills below tabs. Active: cyan border.

### 4D. Briefing Strip (right edge)
- `position: fixed; top: 120px; right: 0; bottom: 40px; width: 280-300px`
- **SEMI-TRANSPARENT** background: `linear-gradient(270deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.5) 60%, transparent 100%)`. The topology is visible through it.
- Scrollable. Thin scrollbar (2px, very dim).
- Contains two alternating states:

**Default state (no node selected):**

Section 1: KEY SITUATIONS (3-4 plain-language alerts)
- Each situation: severity bar (3px left edge, red/amber/green), bold title, description text
- `onMouseEnter` → highlight corresponding cluster in landscape (brighten that cluster, dim others)
- `onMouseLeave` → restore landscape

Section 2: DIVERGENCE
- JSD score (large number, amber, with text-shadow glow)
- Typology: "Interpretive" label + continuous scores (Info Asym: 0.18 · Interpret: 0.67 · Paradigm: 0.15)
- Cross-slice arousal comparison
- Mini heatmap (per-cluster divergence values)
- "FULL COMPARE ↔" link (triggers landscape split — two topologies side by side)

**Selected state (node clicked):**

Section 1: CLAIM INSPECTION
- Claim text in quotes, italic, with left border accent
- Confidence, provenance one-liner (Reddit → X, 18h, 73% fidelity)

Section 2: BEHAVIOR METRICS
- Metric rows, each with: label, value, ⓘ button
- Metrics: Momentum (+ source diversity dot), Source Diversity, Bridge Nodes, Friction (+ quadrant label "contested advance"), Persistence, Arousal, Expressibility, Exposure Decomposition (P/A/E inline values)
- Each row clickable → opens metric isolation view (see §5)
- **Metric isolation views have BESPOKE VISUALS per metric (not just text):**
  - **Friction** → SONAR-STYLE 4-QUADRANT ANIMATION. Appears CENTER SCREEN, everything else blurs. A circular chart like a submarine sonar scope — dark circular field, gridlines radiating from center, quadrant labels at edges (Unopposed Advance, Contested Advance, Successful Suppression, Dead Narrative). On open: a sweeping radar line rotates around the circle. When the sweep passes the quadrant where this claim's data point sits, it DETECTS it — the point lights up, the sweep line flashes red, a subtle beep/pulse. The sweep stops. The data point remains highlighted in its quadrant. The user sees the claim's strategic position AND its proximity to quadrant boundaries. Close via "← back" or click outside.
  - **Persistence** → FILLED BLOCKS. A row of squares — filled (cyan) for active consecutive windows, empty (dim) for remaining capacity. Like a battery indicator. 7 filled out of 10 = "persistent but not the longest-running." Immediately scannable.
  - **Exposure Decomposition** → LABELED STACKED BAR. Horizontal bar: Production (teal, 25%) + Amplification (amber, 45%) + Est. Exposure (cyan, 30%) with percentage labels and one-line descriptions per segment.
  - **Other metrics** (Momentum, Source Diversity, Bridge Nodes, Arousal, Expressibility) → standard isolation view: term, plain language, technical, methodology, value with sparkline and context.

Section 3: ORGANIC CHECK
- Green/amber/red indicator
- 4 coordination signals, each with organic baseline comparison

Section 4: PROVENANCE
- **VISUAL SUPPLY CHAIN TIMELINE** — not just text. A horizontal timeline showing:
  - Platform icons (Reddit logo, X logo, YouTube logo) at each hop
  - Fidelity percentage at each hop, COLOR-CODED: green at 100%, amber at 80%+, red-tinted below 70%
  - Arcs between hops showing response lag duration
  - Mini engagement graph per platform (small sparkline showing how engagement evolved on that platform)
  - Observation boundary marker at origin: dotted line, question mark icon, "No public antecedent detected"
- This is a SHAREABLE ARTIFACT — visually compelling enough that someone can screenshot just this section.

Section 5: EXAMPLE POSTS
- 3-5 actual social media posts that contain this claim
- Each shows: platform icon, anonymized username, post text (or excerpt), extraction confidence score
- This is the DEEPEST level of claim detail — the user has scrolled past behavior, organic check, provenance, and now sees the concrete evidence
- Grounds the abstract metrics in reality: "here are the actual posts our system extracted this claim from"

"✕" close button → returns to default state.

### 4E. Signal Ticker (bottom edge)
- `position: fixed; bottom: 0; height: 32px`
- Background: gradient from `rgba(0,0,0,0.85)` upward to transparent
- Horizontally scrolling track with signal events
- Each event: severity dot (colored) + event text in JetBrains Mono 9px
- Scrolls continuously like a news ticker. Duplicated for seamless loop.
- **All 9 event types must appear:** momentum_spike, divergence_shift, coordination_flag, contestation_emergence, claim_dark, arousal_escalation, phase_transition, lead_lag, vocabulary_rotation
- **TEMPORAL ANALYSIS BUTTON** — a visible, inviting button at the left edge of the ticker: "⏱ TIMELINE VIEW". Clicking it opens a pull-up panel or centered overlay showing events as colored bars on a temporal axis (time on X, event types on Y). This reveals patterns the scrolling ticker hides: "three momentum spikes clustered in 6 hours" or "arousal escalation preceded the coordination flag by 12 hours." The ticker continues scrolling underneath. Close via "← back" or click outside.
- **Contestation emergence events** — when a `contestation_emergence` event is clicked or expanded, show a MINI TOPOLOGY TIMELINE: 3 small network snapshots side by side (before: single cluster, during: cluster splitting, after: two distinct clusters) on a time axis (0h → 24h → 48h). This visualizes the split in real time. Shareable artifact.

### 4F. Legend (bottom-left)
- `position: fixed; bottom: 42px; left: 18px`
- JetBrains Mono, 8px, very dim (`rgba(148,163,184,0.25)`)
- Four lines with visual examples:
  - SIZE = salience (show small vs large dot)
  - COLOR = gaining → losing speed (show 5 colored dots)
  - GLOW = arousal (show glowing dot)
  - PULSE = friction (show pulsing dot)
- Always visible. Never hidden.

---

## 5. INTERACTION MODEL

### Level 0: Multi-Topic Overview
- Landing state. 3-5 topics visible.
- Each topic as a compact HUD card with: name, IFI score, divergence + typology label, top situation alert, mini landscape thumbnail
- Click topic → transition to Level 1 (landscape fills viewport for that topic)

### Level 1: Single Topic (Scanning)
- Everything visible: landscape + all HUD elements. No blur. User scans freely.
- Hover node → floating tooltip near cursor (claim text, 4 key metrics). Disappears on mouse leave.
- Hover situation card → corresponding cluster highlights in landscape.
- Click node → enters selected state (see below).
- Click signal in ticker → highlights relevant node and enters selected state.

### Level 1: Selected State (Node Clicked)
- Selected node gets accent ring. All other nodes dim to ~10% opacity. Cluster contours dim.
- Briefing strip switches to claim detail (behavior, organic check, provenance).
- Landscape remains visible as dimmed context — NOT hidden.
- Click ✕ or click empty space → return to default scanning state.

### Level 2: Metric Isolation (Within Selected State)
- Click a metric row in the briefing strip → isolation view opens for that specific metric.
- **Most metrics** expand inline in the briefing strip: term name, plain language, technical, methodology, value with context. Other rows dim.
- **Friction** is special: opens as a CENTERED OVERLAY (everything blurs). Sonar-style quadrant animation. See §4D Section 2 for full spec.
- **IFI click** is special: opens radar chart as centered overlay. See §4B.
- Click "← back" or click outside → returns to metric list / scanning state.

### Level 2: Full Compare Mode
- Triggered from "FULL COMPARE ↔" in divergence section.
- Landscape splits into two: left = Slice A topology, right = Slice B topology.
- Both rendered on the same canvas, separated by a subtle vertical line.
- Briefing strip still visible on right edge.
- "EXIT COMPARE" button clearly visible.

---

## 6. THE ⓘ PATTERN

Every metric, score, and technical term has a circled question mark (ⓘ).

**Component:** `InfoButton` — 12-13px circle, `border: 1px solid rgba(148,163,184,0.2)`, "i" inside.
- Hover → border and text shift to cyan. Tooltip appears after 300ms delay.
- **Only the FIRST ⓘ** (on the IFI label) pulses gently. Once the user hovers it, pulsing stops (sessionStorage). All other ⓘ are static.

**Tooltip structure:**
```
TERM NAME                         ← cyan, bold, JetBrains Mono, uppercase
"Plain language explanation"      ← white, Inter
Technical explanation             ← grey, italic
────────────────────
methodology / formula / caveats   ← dim, JetBrains Mono, small
```

**Metric-specific caveats (NOT generic):**
- Divergence ⓘ: mentions phantom divergence risk
- Paradigmatic ⓘ: mentions possible extraction failure
- Exposure ⓘ: notes estimated exposure is a proxy
- Salience ⓘ: states which baseline is auto-selected
- Friction ⓘ: notes bot amplification can produce artificially low friction
- Arousal ⓘ: notes LLM-scored with calibration uncertainty

**Applied to:** ~20-25 instances across the entire UI. Every number gets one.

---

## 7. SITUATION GENERATION

The briefing strip's KEY SITUATIONS section is generated from computed metrics. Create a `generateSituations(topicData)` function:

```
IF momentum > 0.5 AND arousal = warming AND friction > 0.6:
  → "{cluster} accelerating — emotionally charged, actively contested"

IF mutation = mainstreaming AND persistence > 10:
  → "{cluster} mainstreaming — shedding extreme framing, deeply embedded"

IF friction > 0.8 AND inverse momentum in cluster:
  → "{cluster} polarizing — opposing claims both accelerating, friction {value}"

IF momentum > 0.5 AND source_diversity < 0.3:
  → "{cluster} accelerating with low source diversity — {n} accounts drive {pct}%"

IF mutation = radicalizing:
  → "{cluster} radicalizing — moving toward more extreme framing"
```

Each alert carries: `cluster_id` (for cross-linking), severity (high/medium/low), text.
Sort by severity. Take top 3-4.

---

## 8. DATA CONTRACTS

Same as CLAUDE.md §Data Contracts. No changes. The types remain:
`Claim`, `Cluster`, `Metric`, `MomentumExtended`, `Divergence`, `Slice`, `Event`, `SupplyChain`, `TopicSummary`

Add to `TopicSummary`:
- `information_flux_index: number` (0-100)
- `situations: Array<{text: string, cluster_id: string, severity: 'high'|'medium'|'low'}>`

Add `vocabulary_rotation` to the Event type enum (9th event type, in addition to existing 8).

---

## 9. COMPONENT STRUCTURE

```
src/
├── App.tsx                    # State: currentTopic, selectedNode, compareMode, isolatedMetric, activeOverlay
├── components/
│   ├── Terrain/
│   │   ├── Landscape.tsx      # Full-viewport canvas/SVG. D3 force-directed. Nodes, clusters, contours, density glows, inter-node lines.
│   │   ├── ContourLayer.tsx   # Concentric rings + density gradients per cluster
│   │   ├── NodeRenderer.tsx   # Node rendering (size/color/glow/pulse) + inter-node connection lines within clusters
│   │   └── ClusterLabels.tsx  # Cluster names, analytical status labels, mutation badges, health scores
│   ├── HUD/
│   │   ├── SystemBar.tsx      # Top-edge status bar
│   │   ├── FluxIndex.tsx      # Top-left IFI display + click → IFIRadar overlay
│   │   ├── TopicHeader.tsx    # Top-right topic name, tabs, time window
│   │   ├── BriefingStrip.tsx  # Right-edge semi-transparent panel
│   │   ├── SituationCards.tsx # KEY SITUATIONS alerts within briefing strip
│   │   ├── DivergenceMini.tsx # Divergence display within briefing strip
│   │   ├── ClaimDetail.tsx    # Selected-state: behavior metrics, organic check, provenance, example posts
│   │   ├── SignalTicker.tsx   # Bottom-edge scrolling event feed + temporal analysis button
│   │   └── Legend.tsx         # Bottom-left always-visible encoding key
│   ├── Overlays/              # CENTER-SCREEN overlays that blur everything behind them
│   │   ├── FrictionSonar.tsx  # Sonar-style 4-quadrant animation (momentum × friction position detection)
│   │   ├── IFIRadar.tsx       # Spider/radar chart for IFI component breakdown
│   │   ├── TemporalTimeline.tsx # Events as colored bars on time axis
│   │   └── ContestationSplit.tsx # Mini topology timeline for contestation_emergence (3 snapshots: before/during/after)
│   ├── MetricVisuals/         # Bespoke visual renderings for specific metrics
│   │   ├── PersistenceBlocks.tsx # Filled/empty block indicator
│   │   ├── ExposureBar.tsx    # Labeled stacked bar for P/A/E decomposition
│   │   └── SupplyChainVisual.tsx # Platform icons, fidelity colors, engagement sparklines, lag arcs, observation boundary
│   ├── Shared/
│   │   ├── InfoButton.tsx     # The ⓘ component with 3-layer tooltip
│   │   ├── MetricRow.tsx      # Reusable metric row (label + value + ⓘ + clickable for isolation)
│   │   ├── NodeTooltip.tsx    # Floating tooltip on node hover
│   │   ├── BlurOverlay.tsx    # Full-screen blur backdrop for centered overlays
│   │   └── ExamplePosts.tsx   # 3-5 actual social media posts with platform icons and confidence scores
│   └── Level0/
│       └── TopicOverview.tsx  # Multi-topic landing state
├── hooks/
│   ├── useTopicData.ts        # Loads JSON for current topic
│   ├── useNodeSelection.ts    # Node click/deselect state
│   ├── useCrossLink.ts        # Situation hover ↔ cluster highlight
│   └── useOverlay.ts          # Manages which overlay is active (friction sonar, IFI radar, temporal, etc.)
├── lib/
│   ├── generateSituations.ts  # Rules-based situation alert generation
│   ├── computeIFI.ts          # √JSD temporal flux computation
│   └── formatters.ts          # Number formatting, duration display
└── types/
    └── index.ts               # All TypeScript types (same as CLAUDE.md contracts)
```

---

## 10. BUILD SEQUENCE

**Phase 1: Full-viewport landscape.**
Replace the current Zone A with a 100vw × 100vh canvas/SVG. Port existing D3 force-directed graph to fill the entire viewport. Add the void background (true black + vignette + grid lines). Add contour rings and density glows per cluster. Add cluster labels and mutation badges ON the terrain.

**Phase 2: HUD frame.**
Add all fixed-position HUD elements: SystemBar, FluxIndex, TopicHeader, Legend, SignalTicker. These are pure display components reading from topic JSON. Wire up TopicHeader tabs for topic switching.

**Phase 3: Briefing strip + situations.**
Add the semi-transparent right-edge BriefingStrip. Implement SituationCards with the generation function. Wire up cross-linking: situation hover → cluster highlight in landscape. Add DivergenceMini with typology scores and heatmap.

**Phase 4: Node selection + claim detail.**
Node click → dim all others, briefing strip switches to ClaimDetail. All 8 behavior metrics as MetricRow components. Each with InfoButton. Organic check with 4 coordination signals and baselines. Provenance with supply chain timeline. ✕ to deselect.

**Phase 5: Interactions + polish.**
Metric isolation (click row → expand inline, dim others). Full Compare mode. Node hover tooltips. Signal ticker click → select node. First ⓘ pulse behavior. Time window switching with node animation.

**Phase 6: Level 0.**
Multi-topic landing with HUD-style topic cards. IFI score, divergence, top situation per topic. Click → transitions to Level 1.

---

## 11. CRITICAL DO NOTS

- **Do NOT create panels with visible borders or card edges.** Everything floats on the void.
- **Do NOT use `#0A0E17` as background.** Use `#000000` or `#030508`. The data is the light source.
- **Do NOT put the landscape in a box.** It fills the entire viewport.
- **Do NOT make the briefing strip opaque.** Use a gradient that fades to transparent. The topology bleeds through.
- **Do NOT use the old Zone A/B/C/D layout.** That is dead. Replaced by Landscape + HUD overlays.
- **Do NOT skip the contour rings and density glows.** These are what make it look like terrain instead of a graph.
- **Do NOT make cluster labels or mutation badges large.** They are ambient information, visible but not demanding attention. They become prominent only on hover/cross-link.
- **Do NOT skip the ⓘ pattern.** Every metric gets one. If a number is on screen without an ⓘ, that's a bug.

---

## 12. WHAT THIS REPLACES

This document supersedes:
- End State v3 §2 (Architecture) — replaced by full-viewport + HUD
- End State v3 §3 (Zone Layout) — zones are dead
- End State v3 §4 (Visual Design) — replaced by instrument aesthetic
- Frontend_UI_UX_Spec_v1.md — entirely replaced
- Frontend_Implementation_Plan.md — replaced by §10 above
- CLAUDE.md Zone Layout section — must be updated to reference this document

Everything NOT in this document remains as specified in Concept Note v6 and CLAUDE.md:
- Data pipeline, extraction, embedding, clustering — unchanged
- Metric definitions and computation — unchanged (except IFI addition)
- Data contracts — unchanged (with IFI and vocabulary_rotation additions)
- Coding rules, model usage, cost optimization — unchanged
