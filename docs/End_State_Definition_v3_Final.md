# End State Definition v3
## Real-Time Narrative Dynamics & Influence Monitoring System

*This document translates the Concept Note v6 (what we measure and why) into the product specification (what the user sees, what they can do, how the data flows, and what "done" looks like). It is the single reference for Claude Code to work backwards from.*

*Metrics and analytical frameworks are referenced by v6 section number, not re-derived here.*

---

## 1. Design Constraints

Every design decision is governed by four constraints. When they conflict, numbering reflects priority.

### 1.1 The 30-Second Test

A builder, VC, or technical founder encounters this system as a screenshot on X or a link in a portfolio. Within 30 seconds of looking at the main screen, they must understand: "this shows me the structure of contested narratives — where the positions are, which are gaining energy, where groups are diverging." If they can't grasp this from the default view without clicking anything, the UI has failed.

### 1.2 The 5-Day Build Constraint

The system is built in 5 days. Every component has a build day assignment (v6 §13). Nothing built on Day 1 requires rewriting on Day 5. Architecture for the whole; implement in slices.

### 1.3 Progressive Disclosure (Three Layers)

**Layer 1 — The Screenshot (0–10 seconds).** What appears in a tweet or portfolio thumbnail. Visually striking, core insight graspable without clicking. The multi-topic overview or claim landscape graph for a polarized topic — clusters clearly separated, colored by momentum, sized by salience, glowing by arousal. Someone sees this and immediately gets it.

**Layer 2 — The Exploration (30 seconds – 5 minutes).** Interactive experience. Click a topic, see the landscape, hover for methodology, click claim nodes for detail, compare slices. This is where the "oh shit" moment lives.

**Layer 3 — The Methodology (5+ minutes).** Builders and analysts drill into component weights, confidence intervals, divergence typology scores, coordination signature details. This layer proves the system isn't faking it.

**Key principle:** Layer 3 is invisible to Layer 1 users but it's what makes Layer 1 credible to Layer 3 users.

### 1.4 Intellectual Honesty Constraint

Every number on screen has a visible basis. Where data is insufficient, it says so. Where a metric is a proxy, it labels the proxy. Where confidence is low, the visual treatment reflects it. Manifests as: confidence dimming, grey-out for inapplicable metrics, honest labeling, observation boundary markers.

---

## 2. Architecture: Single Page, Three Levels

The application is **one page, zero routing.** Like World Monitor: everything lives on a single surface. The user never "navigates away" — they zoom in and zoom out of detail within the same environment.

### 2.1 The Three Levels of Zoom

**Level 0: Multi-Topic Overview (Landing State)**

The system loads with topics already active. No search required to see value. The product is alive when you arrive.

3–5 topics are pre-loaded — the ones with the highest action across our metrics (highest divergence acceleration, most active momentum, coordination flags, arousal escalation). Each topic appears as a row/card showing at a glance:

- Topic name
- Number of active claim clusters
- Headline divergence score with typology label (e.g., "Divergence: 0.73 — Information Asymmetry")
- Top accelerating claim (one-line text)
- Key signal if any ("⚡ Coordination flag detected" or "🔥 Arousal escalating" or "📈 Contestation emerged 18h ago")
- A compact mini-landscape sparkline or activity indicator showing the topic's overall shape

A search bar at the top allows the user to search for any topic beyond the pre-loaded set. But search is for exploration, not the entry point. The entry point is the system already showing them the most compelling narratives.

**No-results state:** If the user searches a topic the system has no data for, a clear message appears: "No data available for this topic. The system currently tracks [N] pre-indexed topics — select one below or try a different search." The pre-loaded topic cards remain visible below the message so the user always has something to click into. For live topic search (stretch goal), this state would instead show "Analyzing... extracting claims from live data" with a loading indicator.

**Layer 1 value:** A screenshot of Level 0 — multiple topics with divergence scores, signal flags, and activity indicators — immediately communicates "this system is tracking the information environment in real time across multiple contested topics."

**Level 1: Single-Topic Deep View (Click a topic)**

When the user clicks any topic from Level 0, the view transitions smoothly into the full single-topic analysis layout. Topic tabs at the top allow switching between pre-loaded topics or returning to the multi-topic overview.

This is the primary analytical surface where 80% of time is spent. It uses a **fixed zone layout** — all four zones are visible simultaneously. No expand/collapse, no modals. Clicking a claim node updates zone content in place. The user scans across zones like scanning across a Bloomberg terminal.

**Level 2: Single-Claim Inspection (Click a node)**

When the user clicks a specific claim node in the landscape, the Vitals zone updates to show that claim's specific metrics, provenance, supply chain, coordination check, and example content. The landscape dims the unselected nodes and highlights the selected one. Click away (click the landscape background) to deselect and return to topic-level overview in the Vitals zone.

No page change. No modal. Just zone content updating in response to selection.

---

## 3. The Fixed Zone Layout (Level 1 — Single Topic View)

Four zones, always visible, fixed positions. Everything visible at once. Depth comes from hover-for-methodology and click-to-update-in-place, never from hiding or expanding.

```
┌──────────────────────────────────────────────────┬────────────────────┐
│                                                  │                    │
│            ZONE A: CLAIM LANDSCAPE               │   ZONE B: VITALS  │
│            (Force-directed graph)                 │   (Metrics panel) │
│            ~75% width, ~60% height               │   ~25% width      │
│                                                  │   Full height     │
│                                                  │                    │
├──────────────────────────┬───────────────────────┤                    │
│                          │                       │                    │
│   ZONE C: DIVERGENCE     │  ZONE D: SIGNALS     │                    │
│   (Comparison/heatmap)   │  (Event timeline)     │                    │
│   ~55% of lower width    │  ~45% of lower width  │                    │
│   ~40% height            │  ~40% height          │                    │
└──────────────────────────┴───────────────────────┘                    │
                                                    └────────────────────┘
```

*Search bar + topic tabs sit above the zones in a slim header.*

### Zone A: Claim Landscape (~75% width, ~60% height — top left)

**Default state (no claim selected — Layer 1):**

Force-directed graph of claim nodes. Each node is a claim cluster (narrative position):
- **Size** = salience (v6 §7A) — louder claims are larger
- **Color** = momentum direction (v6 §7B) — warm amber→red for accelerating, cool teal→blue for decelerating, neutral silver-grey for stable
- **Border glow** = emotional arousal (v6 §7E) — brighter glow = higher arousal packaging. High arousal nodes radiate energy; low arousal nodes are solid and calm
- **Small directional arrow** on concept clusters = mutation trajectory (v6 §7F) — arrow toward center = mainstreaming (green), arrow outward = radicalizing (red), splitting arrows = fragmenting (amber)

Clusters of related claims are visually grouped with subtle background tinting. Spatial positioning reflects semantic distance — similar positions close, opposing positions distant. The topology IS the visualization.

**Time window control:** Segmented buttons in Zone A header: `6h | 24h | 7d`. Switching animates the landscape — nodes grow/shrink/move smoothly to their new positions. The animation IS the data; a node that grows as you switch from 7d to 24h is showing you momentum.

**Hover (Layer 2):** Hovering any node shows a tooltip with: claim text, confidence score, arousal level, persistence duration, friction ratio, one-line summary.

**Click (Level 2 transition):** Clicking a node selects it — node highlights, others dim, Zone B updates to that claim's specific metrics.

**Low-contestation handling:** If the topic has <2 distinct clusters, the landscape shows the unified cluster with label: "Low contestation detected — broad consensus with minor variation." Contestation-dependent metrics in other zones are greyed out with explanation.

### Zone B: Vitals (~25% width, full height, right sidebar)

**Default state (no claim selected):**

Topic-level overview:
- Total claim clusters with labels
- Overall contestation level (if contestation emergence was flagged, a visible "⚡ Contestation emerged Xh ago" indicator appears here — v6 §2C)
- Top accelerating claim (name + momentum value + source diversity dot)
- Most persistent claim (name + window count — distinguishes embedded beliefs from flashes — v6 §7D)
- Top friction claim (name + friction value)
- Highest arousal concept (name + temperature trend)
- Notable mutation (if any concept is changing trajectory)

**When a claim is selected (clicked in Zone A):**

Zone B transforms to show that specific claim's full vitals:

- **Salience** — numerical value with baseline label (v6 §7A). Hover → "Salience: overrepresentation relative to global baseline. This claim is at the 84th percentile — 2.3× more present in this slice than expected. Baseline: global. Shrinkage applied: yes (small sample)."
- **Momentum** — value + sparkline + source diversity indicator (green dot = organic/distributed, red dot = concentrated) + bridge node ratio if elevated (v6 §7B). Hover → "Momentum: rate of change in distributional position. 35th→72nd percentile in 72h. Source diversity: 847 independent accounts (high). Bridge nodes: 12% of amplifiers engage across 3+ communities."
- **Friction** — prominent gauge + 4-quadrant label (v6 §7C). Hover → "Friction: oppositional engagement / total engagement. 0.73 = heavily contested. Quadrant: contested advance (high momentum + high friction)."
- **Persistence** — duration bar showing consecutive windows above threshold (v6 §7D). Hover → "Persistence: 14 consecutive 6h windows above 50th percentile. This claim has held position for 3.5 days — structurally embedded, not a flash."
- **Arousal trend** — temperature indicator: warming/cooling/stable (v6 §7E). Hover → "Arousal: average emotional charge rising from low to medium over 48h while semantic content stable. Possible escalation signal."
- **Expressibility** — original-post ratio (v6 §7J). Hover → "Expressibility: 0.34 original post ratio. For every original post expressing this claim, there are ~3 engagements. Moderate comfort level."
- **Exposure decomposition** — three-layer stacked bar: production / amplification / estimated exposure (v6 §1A). Hover → explains each layer and notes that estimated exposure is a proxy with confidence bounds.
- **Confidence** — score with explanation of what reduced it. Low-confidence claims are visually dimmed throughout the interface.

**Scrolling deeper in Zone B (still within the zone, no expand needed):**

- **Provenance** — first-detected platform and timestamp, lead-lag timeline if cross-platform hops detected (v6 §6A)
- **Supply chain** — timeline path with fidelity decay percentage at each hop + observation boundary label (v6 §3E). "First detected on Reddit Mar 3 14:22 UTC → appeared on X 18h later, 73% semantic fidelity. No public antecedent detected."
- **Coordination check** — each coordination signature (burstiness, near-duplicate, cross-platform sync, source diversity) shown as severity indicator with organic baseline comparison (v6 §8)
- **Semantic neighbors** — related claims in embedding space, concept-level mapping
- **Adversarial pairs** *(stretch goal — v6 §3D)* — if counter-narrative dynamics is implemented, detected adversarial claim pairs appear here with response lag measurement and mutation tracking. "Counter-claim Y emerged 4h after this claim spiked. Response lag suggests organized rapid response."
- **Example content** — 3–5 real posts this claim was extracted from, with confidence score per extraction and platform source. YouTube examples are labeled "Influencer Framing" to distinguish from population expression data.

**Click away to deselect:** Click Zone A background → Zone B returns to topic-level overview.

### Zone C: Divergence (~55% of lower-left width, ~40% height)

**Default state:**

Compact divergence view between two default slices. The system auto-selects the most divergent slice pair for the current topic (e.g., the two communities or platforms showing the highest JSD score).

Shows:
- Headline divergence score (JSD) with trend sparkline
- **Typology label with continuous scores:** "Info Asymmetry: 0.72 | Interpretive: 0.18 | Paradigmatic: 0.10" (v6 §7G-ii)
- Compact heatmap — rows are claim clusters, color intensity shows how differently each claim is distributed across the slices
- Arousal comparison — if arousal diverges across slices, temperature indicators per slice are visible

**Hover on any metric:** Methodology explanation. Hover on typology → "Divergence classified as primarily Information Asymmetry: claim clusters present in one slice are largely absent in the other. Suggests exposure difference — one group has seen evidence the other hasn't. Measured via salience ratio across shared claim clusters."

**Hover on paradigmatic divergence (when flagged):** Includes extraction confidence caveat per v6 §7G-ii.

**Slice selector:** Small dropdown or toggle allowing the user to switch which two slices are being compared. Options include geography-based and behavioral-tier-based slices. Always labeled by behavioral signal, never by inferred demographic (v6 §4A). When YouTube data is involved in a comparison, it is labeled "Influencer Framing (YouTube)" not treated as population expression — YouTube content creators are professional engagement optimizers, not representative of population-level discourse (v6 §7H).

**Base-rate normalization (v6 §4B):** Always active. All comparisons show distributional shares, not raw counts. A slice with 50× more content is not presented as having 50× more influence. Raw counts available in tooltip only. Slices below minimum volume threshold show a low-confidence warning.

**Compare mode (the single exception to the fixed-zone rule):** A visible "Full Compare" button triggers the landscape in Zone A to split — left half = Slice A's topology, right half = Slice B's topology. Zone C expands to show the full comparison overlay with per-cluster comparison bars, exposure decomposition per slice, arousal comparison, mutation trajectory comparison. A clearly visible "Exit Compare" button restores the unified layout. This is the only mode change in the entire interface — every other interaction updates content within fixed zones without changing the layout.

### Zone D: Signals (~45% of lower-right width, ~40% height)

**Default state:**

Chronological event feed — the 5 most recent/important events, each as a compact one-liner with severity color coding (low = dim, medium = amber, high = red):

- "📈 Claim 'AI will replace 40% of jobs' accelerated from 35th→72nd percentile in 12h. Source diversity: low (12 accounts, 3 bridge nodes)."
- "🔀 X↔Reddit divergence increased 23% over 48h. Mode: information asymmetry."
- "⚠️ Near-duplicate content: 47 similar posts from non-overlapping accounts within 3h."
- "🔇 'Regulation will stifle innovation' went dark — active in last 3 windows, now zero production."
- "🌡️ 'AI safety concerns' arousal shifted low→high over 48h, semantic content stable."
- "↗️ 'Open source AI' shifted from radicalizing → mainstreaming trajectory in 7d window."
- "🔗 'Corporate AI lobbying' first detected on Reddit, appeared on X 22h later. Fidelity: 81%."

**Click any event:** Selects the relevant claim in Zone A, updates Zone B to that claim's vitals. The signal feed is a navigation tool as well as a display.

**Filter:** Small type-filter chips at the top of Zone D: All | Momentum | Divergence | Coordination | Silence | Arousal | Mutation | Lead-Lag. Default: All.

---

## 4. Visual Design Specification

### 4.1 Color System

**Background:** #0A0E17 (very dark navy-black). Not pure black — subtle cool undertone. The void that data lives in.

**Claim node colors (momentum-based):**
- Rapid acceleration: #EF4444 (hot red)
- Moderate acceleration: #F59E0B (warm amber)
- Stable: #94A3B8 (silver-grey)
- Moderate deceleration: #14B8A6 (teal)
- Rapid deceleration: #3B82F6 (blue)

**Arousal glow:** Not a color change but an intensity change. High arousal = luminous border glow radiating from the node. Low arousal = solid, calm node. A large, red, glowing node = "loud, accelerating, emotionally charged" — danger signal. A large, blue, dim node = "loud, decelerating, calm" — cooling narrative.

**Cluster boundaries:** Very subtle — faint background gradient or thin opacity boundary. Not hard borders. Spatial clustering should feel organic like galaxies, not items in containers.

**Divergence heatmap:**
- Low divergence (consensus): dark/muted, barely distinguishable from background — these cells fade away
- Medium divergence: warm amber (#F59E0B)
- High divergence: intense crimson (#DC2626) — demands attention

**Mutation trajectory arrows:**
- Mainstreaming (toward center): #22C55E (green) — convergence
- Radicalizing (toward periphery): #EF4444 (red) — divergence
- Fragmenting (splitting): #F59E0B (amber) — multiple directions

**Source diversity indicators:**
- Organic/distributed: #22C55E (green dot)
- Concentrated/suspicious: #EF4444 (red dot)
- Bridge node presence: small bridge icon or distinct marker shape

**Signal severity in Zone D:**
- Low: dim, muted text
- Medium: #F59E0B (amber)
- High: #EF4444 (red)

**Panel backgrounds:** Zone panels use #111827 (slightly lighter than main canvas) to create visual separation without borders.

**Metrics panel (Zone B):** Clean white text (#F1F5F9) for values. Muted labels (#94A3B8). Sparklines in cyan (#06B6D4) — reads as "data" without emotional loading.

**Confidence dimming:** Low-confidence claims rendered at 40% opacity throughout the interface. Not hidden — visually faded. Uncertainty is part of the display.

**Grey-out for inapplicable metrics:** Metrics that require contestation on non-contested topics rendered at 30% opacity with a one-line explanation in muted text.

### 4.2 Typography

**Numbers and data values:** Monospace font (JetBrains Mono or IBM Plex Mono). Creates the "instrument" feel — every digit perfectly aligned, like a cockpit readout.

**Labels, explanations, and text:** Sans-serif (Inter or system SF Pro on Mac). Clean, readable, professional.

**Claim text in tooltips/examples:** Sans-serif, slightly smaller than labels, with quotation marks to distinguish extracted claims from system-generated labels.

### 4.3 Animations

Minimal but meaningful. Not decorative — they ARE data.

**Time window switch:** When the user switches 6h→24h→7d, the landscape smoothly transitions — nodes grow/shrink/move to new positions. A node that grows as you slide from 7d to 24h is literally showing you momentum. This animation is the system showing narrative dynamics.

**Claim selection:** Selected node scales up slightly with a highlight ring. Unselected nodes dim to 60% opacity. Transition: 200ms ease.

**Topic switch:** When switching from Level 0 (multi-topic) to Level 1 (single-topic), the selected topic card smoothly expands into the full zone layout. The transition should feel like zooming into the topic.

**Events in Zone D:** New events slide in from the top with a brief highlight pulse, then settle. The pulse says "this just happened."

### 4.4 Hover Patterns (Two Types)

The interface uses two distinct hover patterns:

**Type 1 — Data Summary Hover (Zone A claim nodes).** Quick-scan tooltip showing key values for the hovered item. Appears immediately (100ms delay). Content: claim text, confidence score, arousal level, persistence duration, friction ratio. Purpose: let the user scan the landscape by mousing over nodes without clicking.

**Type 2 — Methodology Hover (Zone B/C/D metric values).** Explanatory tooltip showing what a metric is, how it's calculated, and what the current value means. Appears after 300ms delay (prevents flickering on quick mouse movement). Content follows this structure:
1. **What it is** — plain English, one line
2. **How it's calculated** — methodology, 1-2 lines
3. **The current reading** — what this specific value means
4. **Confidence / caveats** — if applicable

Example (hovering over friction value "0.73"):
```
Friction
Ratio of oppositional engagement to total engagement.
Computed from: disagreement replies + counter-claims / total engagement.
0.73 = heavily contested — strong organized pushback.
Quadrant: Contested Advance (high momentum + high friction)
```

Example (hovering over divergence typology score):
```
Divergence Typology
Classifies WHY two groups diverge, not just how much.
Info Asymmetry: 0.72 — claim clusters present in one slice are largely absent in the other
Interpretive: 0.18 — same claims present, different salience rankings  
Paradigmatic: 0.10 — low support overlap (⚠️ check extraction confidence)
Dominant mode: Information Asymmetry
```

Tooltip appears on hover with 300ms delay (prevents flickering on quick mouse movement). Disappears when mouse moves away. No click required.

### 4.5 Overall Aesthetic

The system should feel like a classified intelligence feed, not a marketing dashboard. Dense with information but not cluttered — every pixel carries signal. When someone screenshots this and posts it on X, the visual should communicate: "this person is seeing something most people can't see."

Dark theme only for v1. The dark canvas is not just aesthetic — it makes the color-coded nodes, arousal glows, and heatmap cells visually pop. Light theme would require a complete color system redesign and is not worth the effort for v1.

---

## 5. Interaction Inventory

### 5.1 What the User Can Do

**At Level 0 (Multi-Topic Overview):**
- See 3-5 active topics with headline metrics — zero clicks required
- Hover any topic card for a summary tooltip
- Click a topic card to drill into Level 1
- Type in search bar to find a different topic

**At Level 1 (Single-Topic Deep View):**
- See claim landscape with all nodes visible — zero clicks required
- See headline metrics in Zone B, divergence in Zone C, signals in Zone D — zero clicks required
- Switch time window via 6h | 24h | 7d segmented control
- Hover any claim node for tooltip (claim text, key metrics, "click to inspect")
- Click any claim node to select → Zone B updates to that claim's vitals
- Click Zone A background to deselect
- Hover any metric value in Zone B for methodology explanation
- Click "Full Compare" in Zone C to enter split-landscape comparison mode
- Click "Exit Compare" to return to unified view
- Change slice comparison via dropdown in Zone C
- Click any event in Zone D to navigate to the relevant claim
- Filter Zone D events by type chips
- Switch topics via tabs in the header
- Return to Level 0 via back button or "Overview" tab

**At Level 2 (Single-Claim Inspection — within Level 1):**
- Scroll Zone B for full claim detail (provenance, supply chain, coordination, examples)
- Hover any metric for methodology
- Click example content to see source posts with confidence scores

### 5.2 What the User Cannot Do

- Search for or profile individual accounts
- See individual posts outside the example-content sample
- Set up automated messaging, counter-narrative campaigns, or influence actions
- Modify or inject data
- Override confidence or normalization layers
- View raw unprocessed data feeds
- See identity-inferred labels on Tier 4 slices (behavioral labels only — v6 §4A)
- Toggle between individual platform views (platforms are data sources, not user-facing filters — platform details surface in provenance/supply chain within Zone B)

### 5.3 Discoverability Principles

Every interactive element visually signals that it's interactive:
- Claim nodes have subtle hover glow before mouse reaches them — the landscape feels alive
- The time window control is always visible in Zone A header as labeled segmented buttons, not a dropdown
- "Full Compare" is a visible labeled button in Zone C, not discoverable only through right-click or menus
- Events in Zone D are visually clickable (pointer cursor, subtle highlight on hover)
- Zone B has a persistent header that says "Select a claim to inspect" when nothing is selected, inviting the click
- No hidden gestures, no keyboard shortcuts required, no context menus needed

**The test:** If a viewer watches a 30-second screen recording of someone using the tool, they can replicate every interaction they saw without instructions.

---

## 6. Data Architecture

Five layers. Unchanged from concept note v6 — summarized here with screen mappings.

### Layer 1: Ingestion
Raw content from X + Reddit + YouTube (targeted). All jobs on same cron schedule, UTC timestamps. For demo: pre-pulled cached JSON.
→ Feeds: Layer 2

### Layer 2: Extraction
Claude API (Sonnet) extracts per document: structured claims (subject, assertion, framing, stance), confidence score, arousal tag. Cache keyed by content hash.
→ Feeds: Layer 3

### Layer 3: Embedding & Clustering
Embedding vectors per claim. HDBSCAN clustering. Concept layer assignment. Centroid computation. Re-run per aggregation window. Centroid movement between windows feeds mutation directionality.
→ Feeds: Layer 4

### Layer 4: Metrics Computation
All v6 §7 metrics computed per claim per slice per window. Event detection for Zone D. Cross-slice metrics (divergence, typology, exposure asymmetry, lead-lag). Coordination signals.
→ Feeds: Layer 5

### Layer 5: Storage
Three stores: raw content (immutable), claim store (extracted + embedded + clustered), metrics store (precomputed, what the UI reads). For demo: all JSON files. For production: PostgreSQL + pgvector.

---

## 7. API Surface

7 endpoints. For demo: static JSON file reads. Same fetch interface regardless of live API or static files.

| Endpoint | Returns | Feeds |
|----------|---------|-------|
| `GET /topics/active` | Pre-loaded active topics with headline metrics | Level 0 |
| `GET /topics/search?q={query}` | Matching topics | Search bar |
| `GET /topics/{id}/landscape?window={6h\|24h\|7d}` | Claim nodes, clusters, positions, summary metrics | Zone A |
| `GET /topics/{id}/claims/{claim_id}` | Full claim detail: all metrics, provenance, supply chain, coordination, examples | Zone B (selected state) |
| `GET /topics/{id}/compare?slices={a,b}&window={...}` | Divergence data, typology scores, per-claim comparison, arousal/mutation comparison | Zone C |
| `GET /topics/{id}/timeline?window={...}&types={...}` | Event log | Zone D |
| `GET /topics/{id}/metrics?claim_id={...}&slice={...}` | Detailed metric breakdown with confidence intervals and methodology | Zone B hover/expand |

Note: no platform toggle endpoint. Platform is not a user-facing filter. Platform details (which platform a claim was detected on, lead-lag across platforms) are returned within claim detail and supply chain responses.

---

## 8. Data Contracts

*Every object passed between backend and frontend. Claude Code implements these as TypeScript types.*

### Claim Object
```
{
  id: string,
  text: string,                    // canonical extracted claim text
  subject: string,
  assertion: string,
  framing: string,
  stance: string,
  confidence: float (0–1),
  arousal: "high" | "medium" | "low",
  register: string,                // "academic" | "vernacular" | "meme" | etc.
  cluster_id: string,
  concept_id: string,
  first_seen_platform: string,
  first_seen_timestamp: ISO8601,
  embedding: float[]               // not sent to frontend
}
```

### Cluster Object
```
{
  id: string,
  concept_id: string,
  label: string,                   // representative claim text or summary
  member_count: int,
  centroid: float[],               // not sent to frontend
  mutation_direction: "mainstreaming" | "radicalizing" | "fragmenting" | "stable",
  mutation_magnitude: float (0–1),
  arousal_trend: "warming" | "cooling" | "stable",
  arousal_value: float (0–1),
  adversarial_pairs: string[]      // cluster IDs of detected opponents (stretch)
}
```

### Metric Object
```
{
  value: float,
  confidence_interval: [float, float],
  baseline: string,                // "global" | "platform-local" | "geo-local"
  time_window: string,             // "6h" | "24h" | "7d"
  sparkline: float[],              // historical values for trend display
  source_distribution: string      // "production" | "amplification" | "estimated_exposure"
}
```

### Momentum-Extended Object
```
{
  ...Metric,
  source_diversity: float,         // effective independent sources, normalized
  bridge_ratio: float,             // fraction of momentum from bridge nodes
  persistence_windows: int,        // consecutive windows above threshold
  friction: float,                 // oppositional / total engagement
  friction_quadrant: string        // "unopposed_advance" | "contested_advance" | "successful_suppression" | "dead"
}
```

### Divergence Object
```
{
  jsd: float,
  jsd_sqrt: float,                 // true metric distance
  trend: float[],                  // sparkline
  typology: {
    information_asymmetry: float,  // 0–1, continuous (salience ratio)
    interpretive: float,           // 0–1, continuous (rank correlation)
    paradigmatic: float,           // 0–1, continuous (support overlap)
    dominant_mode: string,
    paradigmatic_caveat: boolean   // true if extraction confidence differs across slices
  }
}
```

### Slice Object
```
{
  id: string,
  type: "platform" | "geography" | "language" | "behavioral",
  label: string,                   // ALWAYS behavioral label, never demographic inference
  active_volume: int,
  meets_minimum_threshold: boolean,
  base_rate_weight: float,
  is_influencer_framing: boolean   // true for YouTube slices — not population expression
}
```

### Event Object
```
{
  id: string,
  type: "momentum_spike" | "divergence_shift" | "coordination_flag" | "contestation_emergence" | "claim_dark" | "arousal_escalation" | "phase_transition" | "lead_lag",
  timestamp: ISO8601,
  claim_id: string | null,
  slice_id: string | null,
  severity: "low" | "medium" | "high",
  confidence: float,
  summary: string,                 // human-readable one-line description
  detail: object                   // type-specific payload
}
```

### Supply Chain Object
```
{
  concept_id: string,
  hops: [
    {
      platform: string,
      timestamp: ISO8601,
      claim_id: string,
      fidelity_to_origin: float,   // 0–1, embedding distance from earliest instance
      fidelity_to_previous: float  // 0–1, embedding distance from previous hop
    }
  ],
  observation_boundary: string     // "no public antecedent detected" or null
}
```

### Topic Summary Object (for Level 0 multi-topic overview)
```
{
  id: string,
  name: string,
  cluster_count: int,
  contestation_level: "high" | "medium" | "low",
  contestation_emergence: {        // null if no recent emergence
    emerged_hours_ago: int,
    source_diversity: float
  } | null,
  headline_divergence: {
    jsd: float,
    dominant_typology: string,
    trend: "increasing" | "stable" | "decreasing"
  },
  top_accelerating_claim: {
    text: string,
    momentum: float,
    source_diversity: float
  },
  most_persistent_claim: {
    text: string,
    persistence_windows: int
  },
  key_signal: {
    type: string,
    summary: string
  } | null,
  activity_sparkline: float[]
}
```

---

## 9. Scope Control

### 9.1 In Scope — Build This

- Multi-topic landing state (Level 0) with 3–5 pre-loaded active topics
- Single-page architecture with fixed zone layout (no routing)
- Smooth Level 0 → Level 1 transition
- Claim extraction via Claude API with confidence scoring and arousal tagging
- Embedding generation and HDBSCAN clustering with concept layer
- Claim landscape visualization (D3 force-directed graph) with momentum color, salience size, arousal glow, mutation arrows
- All v6 §7 metrics: salience, momentum + source diversity + bridge nodes, friction (elevated), persistence, emotional arousal profile, mutation directionality, divergence (JSD + continuous typology), exposure asymmetry, silence (claim-level), expressibility (original-post ratio)
- Fixed zone layout: Zone A (landscape), Zone B (vitals), Zone C (divergence), Zone D (signals)
- Two hover types: data summary (Zone A nodes) and methodology explanation (Zone B/C/D metrics)
- Time window slider (6h / 24h / 7d) with animated transitions
- Slice comparison with divergence heatmap and continuous typology scores
- Full Compare mode (landscape splits — single exception to fixed-zone rule)
- Zone B claim deep-dive: provenance, supply chain (2–3 hop with honest observation boundaries), coordination flags, semantic neighbors, example content
- Coordination signal detection (burstiness, near-duplicate, cross-platform sync, source diversity)
- Cross-platform lead-lag detection (with synchronized ingestion)
- Manufactured contestation detection with visible indicator in Zone B default state
- Timeline/signals event log with type filtering
- Failure modes: confidence dimming, insufficient-data warnings, grey-out for inapplicable metrics, observation boundary labels
- YouTube labeled as "influencer framing" throughout, never treated as population expression
- Base-rate normalization always active in Zone C
- No-results search state with fallback to pre-loaded topics
- Full visual design spec (dark theme, color system, typography, animations)
- Pre-computed demo mode with cached data for 3–5 topics

### 9.2 Stretch Goals — Day 5 If Core Complete

- Counter-narrative dynamics: adversarial pair detection + response lag (lightweight compute on centroids). UI placement: Zone B scrollable content under semantic neighbors.
- Live topic input: user types a new topic, Claude API extracts claims in real-time

### 9.3 Deferred — Post-Ship (Architecture Must Not Prevent)

- Full expressibility shift metric (v6 §12A)
- Algorithmic neighborhoods (v6 §12B)
- Full silence-as-signal expected-vs-observed model (v6 §12C)
- Adaptive windowing (v6 §12D)
- Instagram integration (v6 §12E)
- Payment gateway for cost-heavy tasks (v6 §12F)
- Amplifier-to-originator ratio (v6 §12G)
- Manufactured contestation multi-signal verification (v6 §12H)
- Watchlist / monitoring journey with notifications
- Export: snapshot or report (image, JSON, PDF)
- Light theme

### 9.4 Out of Scope — Do Not Build

- User accounts, authentication, multi-tenancy
- TikTok integration (banned in India, geopolitically contingent)
- Individual account profiling
- Automated messaging or influence actions
- Image/video content analysis (text-only for v1)
- Mobile-responsive design (desktop-first)
- Custom alert rules or notification system
- Integration with external tools (Slack, email, SIEM)
- Platform toggle (platforms are data sources, not user-facing filters)

---

## 10. Success Criteria

The end state is reached when:

1. The system loads with 3–5 active topics visible, metrics populated, zero clicks required to see value.
2. Clicking any topic transitions smoothly into the full zone layout with claim landscape rendered within 3 seconds.
3. The claim landscape has at least 3 distinct narrative clusters, visually separated, colored by momentum, glowing by arousal.
4. Every metric in Zone B has a hover tooltip explaining what it is, how it's calculated, and what the current value means.
5. Friction is prominent (not buried) and shows the 4-quadrant interaction with momentum.
6. Persistence is visible — the user can distinguish a flash-in-pan from an embedded belief at a glance.
7. Mutation trajectory arrows show mainstreaming/radicalizing/fragmenting per concept.
8. Zone C shows divergence with continuous typology scores. The user can see WHY groups diverge, not just how much.
9. Zone D surfaces at least 3 distinct event types.
10. Low-confidence claims are visually dimmed. Non-contested topics show honest labeling with greyed-out contestation-dependent metrics.
11. The supply chain view shows at least one cross-platform hop with fidelity decay and observation boundary.
12. At least one coordination signal (burstiness or near-duplicate) is functional.
13. An uninstructed viewer understands the claim landscape within 30 seconds.
14. A technically literate viewer drilling into Layer 3 finds real methodology (JSD values, typology scores, confidence intervals).
15. The visual design looks like a classified intelligence instrument, not a hackathon project. The D3 landscape is beautiful.
16. The system is a single page. No routing. No separate screens. Everything is zoom in/zoom out within one surface.

---

## 11. Risk Registry

1. **Claim extraction prompt quality** — won't be right first try. Budget 2–3 iterations on Day 1. Test diverse content.
2. **D3 force-directed layout** — can easily look like garbage. Budget 4–6 hours tuning. This is the Layer 1 artifact.
3. **Day 2 metrics overload** — many metrics to implement. Prioritize: momentum+diversity → friction → divergence+typology → persistence/arousal/mutation. Last three can slip to Day 3 morning.
4. **Embedding quality** — if embeddings don't place related claims close together, everything downstream fails. Test early on Day 1.
5. **Demo topic selection** — topics need contestation, platform variation, temporal dynamics. At least one highly polarized, one with clear platform differences, one with recent temporal shifts.
6. **Bridge node detection on X** — less precise than Reddit (subreddit history). If noisy, keep for Reddit only.
7. **Supply chain sparsity** — 2 platforms = 1 hop. Design UI to be compelling with minimal data + honest labeling.
8. **Level 0 → Level 1 transition animation** — can be jarring if not smooth. If animation is hard, a clean instant-switch is better than a broken animation.
9. **Zone layout responsiveness** — fixed zones with percentage widths need to work across screen sizes. Test on 13" laptop and 27" monitor early.

---

## Appendix: Transition to Build

This end state document + Concept Note v6 provide everything Claude Code needs.

1. **Write the CLAUDE.md** — coding conventions, v6 metric definitions by reference, data contracts from Section 8, build timeline from v6 §13, design spec from Section 4 of this document.
2. **Day 1** — Ingestion + extraction. Get 3–5 topics into structured JSON. Verify embedding quality manually.
3. **Day 2** — Metrics engine against Day 1 JSON. All v6 §7 metrics.
4. **Day 3** — Frontend. Level 0 multi-topic view + Level 1 zone layout + Zone A D3 landscape. Static JSON → React.
5. **Day 4** — Zone B (vitals + claim deep-dive), Zone C (divergence + comparison), Zone D (signals timeline). Interactions: hover, click, filter.
6. **Day 5** — Intelligence layer (lead-lag, coordination, supply chain, silence, expressibility), visual polish, failure states, design spec refinement.

The concept note tells Claude Code WHAT to measure and WHY.
This document tells Claude Code WHAT the user sees and HOW the data flows.
The CLAUDE.md tells Claude Code HOW to write the code.
