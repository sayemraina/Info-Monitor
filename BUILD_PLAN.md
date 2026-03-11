# Narrative Monitoring System — Complete Build Plan

> **Storage:** Upon approval, this plan will be copied to `BUILD_PLAN.md` in the project root so all tools (CC, CX, AG, CW) can reference it as shared context.

## Context

Building a real-time narrative topology system from scratch. The project directory contains only spec docs (concept-note-v6, end-state-v3), CLAUDE.md, and an extraction prompt. Every file listed below must be created. The system extracts claims from social media, maps them into semantic space, measures divergence across populations, and renders a single-page dark-themed intelligence dashboard. Demo runs on pre-computed cached JSON data.

**Data path decision:** No API keys available. **Synthetic data generator is the primary path.** Real `ingest.py` + `extract.py` are built but secondary — they become useful when API keys are acquired.

The plan is ordered by **dependency chain** — what must exist before what. Each component lists every file, the implementation approach, exit criteria, risks, and the execution tool.

### Execution Tool Legend
- **[CC] Claude Code** — High-judgment tasks: architecture decisions, complex algorithms, D3 tuning, data modeling. Full token budget, most capable. Use for tasks requiring deep reasoning about tradeoffs.
- **[CX] Codex** — Clear-spec implementation tasks. Each [CX] task includes a Codex-ready spec: input files, output contract, algorithm description. Feed the spec + relevant type definitions as context.
- **[AG] Antigravity** — Available models: Claude Sonnet, Claude Opus, Gemini. Lower token limits than Claude Code, so provide focused context (not entire codebase). Best for: bulk code generation, synthetic data generation, large-file processing, repetitive implementation across many files. When handing off to AG, include: (a) the exact files to read as context, (b) the type contracts they must conform to, (c) the output file paths and format.
- **[CW] Cowork** — *(Optional)* Mechanical tasks: file creation, directory structure, config files. These tasks can also be done by any other tool if Cowork is not available.

### Hand-Off Protocol Between Tools

Every step boundary includes explicit hand-off instructions so the next tool/model can pick up seamlessly:

1. **Output contract:** Each step's output is a file (or set of files) at a specific path, conforming to a specific type/schema. The next step's instructions reference these files by path.
2. **Context bundle:** When handing to [CX] or [AG], provide a focused context package:
   - The relevant type definitions from `src/types/index.ts`
   - Any upstream output files the task depends on
   - The spec section from this plan for that component
   - Do NOT dump the entire codebase — these tools have smaller token budgets
3. **Verification gate:** Each step has exit criteria. Run the check before proceeding to the next step. If it fails, fix in the same tool before handing off.
4. **Shared reference:** This plan file is stored at `BUILD_PLAN.md` in the project root. All tools can read it to understand the full system context, their specific task, and how their output feeds the next step.

### Optimal Model Recommendations (Per Tool)

**Consistent operating principle:** Every step/substep specifies not just the tool, but the optimal MODEL within that tool.

| Tool | Model | When to Use |
|------|-------|-------------|
| **[CC]** | **Claude Opus** | Default for CC tasks. Architecture, D3 tuning, complex algorithms, metrics engine, state management. Full context window. |
| **[CX]** | **Claude Sonnet** (via Codex API) | All Codex tasks. Clear-spec implementation with structured prompts. |
| **[AG]** | **Claude Sonnet** | Default for AG. Bulk generation, repetitive components, presentational files. Good quality-to-token ratio. |
| **[AG]** | **Claude Opus** | Upgrade to Opus in AG only when Sonnet output quality is insufficient (e.g., semantic coherence issues, complex data relationships). |
| **[AG]** | **Gemini** | Large-context bulk processing where quality bar is lower (e.g., code review, consistency checks across many files). |

**Model selection per component (quick reference):**

| Component | Tool | Model | Rationale |
|-----------|------|-------|-----------|
| 0A-0C. Scaffolding | [CC] | Opus | One-time setup, low risk |
| 1A. Core types | [CC] | Opus | Contract foundation, zero tolerance for errors |
| 2A. Synthetic data gen | [AG] | Sonnet → Opus if needed | Bulk generation; upgrade if claim coherence is poor |
| 2B-2C. Extract/Embed | [CC]/[CX] | Opus / Sonnet | CC=extract (judgment), CX=embed (mechanical) |
| 2D. Clustering | [CC] | Opus | HDBSCAN tuning requires iteration |
| 2E. Metrics computation | [CC] | Opus | Most complex script, many algorithms |
| 3A. Data hooks | [CX] | Sonnet | Clear pattern, 5 files |
| 3B. Utils (format/colors) | [CX] | Sonnet | Pure functions, test-case-driven |
| 3B. Utils (tooltips) | [CC] | Opus | Domain knowledge of metric methodology |
| 4A. App state + shell | [CC] | Opus | State machine architecture |
| 4A. Header | [CX] | Sonnet | Presentational component |
| 5A. Level 0 cards | [CX] | Sonnet | Presentational, clear spec |
| 5A. TopicOverview | [AG] | Sonnet | Bulk: generate all Level0 files together |
| 6. Zone A landscape | [CC] | **Opus (mandatory)** | Hero component. D3 + React integration. Iterative tuning. No delegation. |
| 6. TimeWindowControl | [CX] | Sonnet | Simple segmented button |
| 6. ClaimTooltip | [CX] | Sonnet | Positioned tooltip |
| 7. Zone B primitives | [CX] | Sonnet | MetricRow, gauges, bars — all parallelizable |
| 7. VitalsPanel + ClaimVitals | [CC] | Opus | Orchestration, data flow, scroll layout |
| 8. Zone C heatmap/selector | [CX] | Sonnet | Presentational |
| 8. DivergencePanel | [CC] | Opus | Data orchestration |
| 8. FullCompareMode | [CC] | Opus | Complex: splits Zone A, coordinates state |
| 9. Zone D (all files) | [CX] | Sonnet | All 3 files in one session |
| 10. Shared components | [CX] | Sonnet | GreyedMetric, LowConfidence, etc. |
| 10. Animations + D3 tuning | [CC] | Opus | Visual judgment, iterative |
| 10. Bulk code review | [AG] | Gemini | Large context review across all files |

---

## Component 0: Project Scaffolding

### 0A. Python Environment [CW/CC]
**File:** `requirements.txt`
```
anthropic>=0.40.0
openai>=1.50.0
hdbscan>=0.8.38
scikit-learn>=1.4.0
numpy>=1.26.0
scipy>=1.12.0
requests>=2.31.0
praw>=7.7.0           # Reddit API
google-api-python-client>=2.100.0  # YouTube Data API
python-dotenv>=1.0.0
```
- Implementation: Pin versions. Single `pip install -r requirements.txt`.
- Exit criteria: `python -c "import anthropic, openai, hdbscan, sklearn, scipy, praw"` succeeds.
- Risk: hdbscan install can fail on macOS ARM. Recovery: `pip install hdbscan --no-build-isolation`.

**File:** `.env.example`
```
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USER_AGENT=
YOUTUBE_API_KEY=
X_BEARER_TOKEN=
```

### 0B. Frontend Scaffolding [CW/CC]
**File:** `package.json` — Create via `npm create vite@latest . -- --template react-ts`

**Additional deps to install:**
```
npm install d3 @types/d3 recharts tailwindcss @tailwindcss/vite
npm install -D @types/node
```

**File:** `vite.config.ts`
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  publicDir: 'public',
})
```

**File:** `tsconfig.json` — Vite default + `"strict": true`, `"noUncheckedIndexedAccess": true`

**File:** `src/index.css`
```css
@import "tailwindcss";
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
```
Plus CSS custom properties for the color system from end-state §4.

**File:** `public/data` — Symlink to `../data/` so Vite serves JSON.

- Exit criteria: `npm run dev` serves blank page at localhost:5173. Tailwind classes render. Fonts load.
- Risk: Symlink may not work on all OS. Recovery: Copy data/ to public/data/ in a build script.

### 0C. Directory Structure [CW/CC]
Create all empty directories per CLAUDE.md project structure:
```
data/raw/  data/claims/  data/metrics/
src/components/Level0/  src/components/TopicView/
src/components/ZoneA/  src/components/ZoneB/
src/components/ZoneC/  src/components/ZoneD/
src/hooks/  src/types/  src/utils/
```

---

## Component 1: TypeScript Type System

Must exist before any frontend component or data hook.

### 1A. Core Types [CC]
**File:** `src/types/index.ts`

Every type matches end-state §8 exactly. This is the contract between data pipeline and frontend.

```ts
// Claim — the atomic unit
export interface Claim {
  id: string
  text: string
  subject: string
  assertion: string
  framing: string
  stance: 'pro' | 'anti' | 'neutral' | 'ambiguous'
  confidence: number        // 0–1
  arousal: 'high' | 'medium' | 'low'
  register: 'academic' | 'journalistic' | 'vernacular' | 'meme' | 'sarcastic' | 'formal'
  cluster_id: string
  concept_id: string
  first_seen_platform: string
  first_seen_timestamp: string  // ISO8601
}

// Cluster — group of semantically related claims
export interface Cluster {
  id: string
  concept_id: string
  label: string
  member_count: number
  mutation_direction: 'mainstreaming' | 'radicalizing' | 'fragmenting' | 'stable'
  mutation_magnitude: number  // 0–1
  arousal_trend: 'warming' | 'cooling' | 'stable'
  arousal_value: number       // 0–1
  adversarial_pairs: string[] // cluster IDs
}

// Metric — base metric with confidence
export interface Metric {
  value: number
  confidence_interval: [number, number]
  baseline: 'global' | 'platform-local' | 'geo-local'
  time_window: '6h' | '24h' | '7d'
  sparkline: number[]
  source_distribution: 'production' | 'amplification' | 'estimated_exposure'
}

// MomentumExtended — extends Metric
export interface MomentumExtended extends Metric {
  source_diversity: number
  bridge_ratio: number
  persistence_windows: number
  friction: number
  friction_quadrant: 'unopposed_advance' | 'contested_advance' | 'successful_suppression' | 'dead'
}

// Divergence
export interface Divergence {
  jsd: number
  jsd_sqrt: number
  trend: number[]
  typology: {
    information_asymmetry: number  // 0–1
    interpretive: number           // 0–1
    paradigmatic: number           // 0–1
    dominant_mode: string
    paradigmatic_caveat: boolean
  }
}

// Slice
export interface Slice {
  id: string
  type: 'platform' | 'geography' | 'language' | 'behavioral'
  label: string
  active_volume: number
  meets_minimum_threshold: boolean
  base_rate_weight: number
  is_influencer_framing: boolean
}

// Event
export type EventType = 'momentum_spike' | 'divergence_shift' | 'coordination_flag' |
  'contestation_emergence' | 'claim_dark' | 'arousal_escalation' | 'phase_transition' | 'lead_lag'

export interface NarrativeEvent {
  id: string
  type: EventType
  timestamp: string
  claim_id: string | null
  slice_id: string | null
  severity: 'low' | 'medium' | 'high'
  confidence: number
  summary: string
  detail: Record<string, unknown>
}

// SupplyChain
export interface SupplyChainHop {
  platform: string
  timestamp: string
  claim_id: string
  fidelity_to_origin: number
  fidelity_to_previous: number
}

export interface SupplyChain {
  concept_id: string
  hops: SupplyChainHop[]
  observation_boundary: string | null
}

// TopicSummary — Level 0
export interface TopicSummary {
  id: string
  name: string
  cluster_count: number
  contestation_level: 'high' | 'medium' | 'low'
  contestation_emergence: {
    emerged_hours_ago: number
    source_diversity: number
  } | null
  headline_divergence: {
    jsd: number
    dominant_typology: string
    trend: 'increasing' | 'stable' | 'decreasing'
  }
  top_accelerating_claim: {
    text: string
    momentum: number
    source_diversity: number
  }
  most_persistent_claim: {
    text: string
    persistence_windows: number
  }
  key_signal: {
    type: string
    summary: string
  } | null
  activity_sparkline: number[]
}

// API response types for each endpoint
export interface LandscapeData {
  claims: Claim[]
  clusters: Cluster[]
  positions: Array<{ claim_id: string; x: number; y: number }>
  topic_metrics: {
    cluster_count: number
    contestation_level: 'high' | 'medium' | 'low'
    top_accelerating: { claim_id: string; momentum: MomentumExtended }
    most_persistent: { claim_id: string; persistence_windows: number }
    top_friction: { claim_id: string; friction: number }
    highest_arousal: { concept_id: string; arousal_trend: string }
    notable_mutation: { concept_id: string; direction: string } | null
  }
}

export interface ClaimDetail {
  claim: Claim
  momentum: MomentumExtended
  salience: Metric
  friction: Metric
  persistence: Metric
  arousal: Metric
  expressibility: Metric
  exposure: { production: Metric; amplification: Metric; estimated_exposure: Metric }
  confidence_detail: { score: number; factors: string[] }
  provenance: { first_platform: string; first_timestamp: string; lead_lag: Array<{ platform: string; lag_hours: number }> }
  supply_chain: SupplyChain
  coordination: {
    burstiness: { score: number; organic_baseline: number; severity: 'low' | 'medium' | 'high' }
    near_duplicate: { score: number; organic_baseline: number; severity: 'low' | 'medium' | 'high' }
    cross_platform_sync: { score: number; organic_baseline: number; severity: 'low' | 'medium' | 'high' }
    source_diversity_anomaly: { score: number; organic_baseline: number; severity: 'low' | 'medium' | 'high' }
  }
  semantic_neighbors: Array<{ claim_id: string; similarity: number }>
  example_content: Array<{ text: string; platform: string; confidence: number; is_influencer_framing: boolean }>
}

export interface CompareData {
  slice_a: Slice
  slice_b: Slice
  divergence: Divergence
  per_cluster: Array<{
    cluster_id: string
    label: string
    salience_a: number
    salience_b: number
    arousal_a: number
    arousal_b: number
    mutation_a: string
    mutation_b: string
  }>
  arousal_comparison: { slice_a_avg: number; slice_b_avg: number }
  exposure_comparison: { slice_a: Metric; slice_b: Metric }
}

export interface TimelineData {
  events: NarrativeEvent[]
  total_count: number
}

export type TimeWindow = '6h' | '24h' | '7d'
```

- Exit criteria: `npx tsc --noEmit` passes with zero errors.
- Risk: Types may need iteration as data pipeline output stabilizes. Keep types as source of truth; pipeline conforms to types.

---

## Component 2: Data Pipeline (Python)

Dependency: Python env (0A). Each script feeds the next.

### 2A. Synthetic Data Generator (PRIMARY PATH) — `scripts/generate_synthetic.py` [AG]

**This is the primary data path.** Generates realistic demo data for 3-5 topics without API keys. Uses Gemini (large context) to generate coherent, topic-specific claim datasets that exercise every metric in the system.

**Input:** Topic definitions hardcoded in script. No external dependencies.
**Output:** All files that the real pipeline would produce:
- `/data/raw/{topic_id}/{platform}.json` — synthetic raw posts
- `/data/claims/{topic_id}/extracted.json` — pre-extracted claims
- `/data/claims/{topic_id}/clusters.json` — cluster definitions
- `/data/topics.json` — topic index

**Topics to generate (chosen to exercise all metrics):**
1. `ai-regulation` — moderate contestation, clear platform differences (Reddit=nuanced, X=polarized, YouTube=influencer framing). Good for divergence typology demo.
2. `immigration-policy` — high polarization, high friction, strong adversarial pairs. Good for friction quadrants demo.
3. `israel-palestine` — paradigmatic divergence, high arousal, rapid mutation. Good for arousal and mutation demos.
4. `climate-policy` — embedded persistent beliefs, clear mainstreaming/radicalizing dynamics. Good for persistence + mutation trajectory demos.

**Implementation approach:**
- For each topic, define 8-15 claim archetypes by hand (the canonical positions people take). Each archetype has: text, subject, assertion, framing, stance, arousal level, which platforms it appears on, approximate popularity.
- Generate 300-500 synthetic source posts per topic per platform by varying the archetypes: different wordings, engagement levels, timestamps spread across 7 days, author diversity levels.
- **Temporal structure:** Build in specific temporal patterns so metrics produce non-trivial results:
  - At least 1 claim that spikes in momentum (low→high in 24h window)
  - At least 1 claim that's persistent (stable above 50th percentile for 3+ days)
  - At least 1 claim that goes dark (active→zero while topic volume stable)
  - At least 1 claim with low source diversity (concentrated in few authors)
  - At least 1 concept with rising arousal (low→high over 48h)
  - At least 1 concept that shows mainstreaming trajectory
  - At least 1 concept that shows radicalizing trajectory
  - Cross-platform lead-lag: at least 1 claim appears on Reddit 12-24h before X
  - Near-duplicate cluster: 30+ similar posts from different accounts within 3h
- **Engagement patterns:** Vary likes, replies, shares realistically per platform. Include some high-friction claims (many oppositional replies) and some frictionless claims.
- For each claim archetype, generate an embedding vector by starting with a base vector and adding Gaussian noise (σ=0.1 for same-cluster, σ=0.5 for different clusters). This ensures embeddings cluster correctly without needing the OpenAI API.
- Pre-assign cluster IDs and concept IDs based on the archetype groupings.
- Output raw data in the same format as ingest.py would produce, and pre-extracted claims in the same format as extract.py would produce.

**Why [AG]:** This is a bulk generation task that benefits from large context (needs to maintain consistency across 2000+ synthetic posts and their relationships). **Recommended AG model: Claude Sonnet** — good balance of quality and token efficiency for structured data generation. Use Opus only if Sonnet output quality is insufficient (e.g., claims aren't semantically coherent or temporal patterns are wrong).

**AG context bundle to provide:**
1. TypeScript type definitions from `src/types/index.ts` (the output contract)
2. The topic archetype definitions (from this section of the plan)
3. The temporal pattern requirements (spike, persistence, silence, etc.)
4. The Python output format: what JSON files to generate and where

**AG task description:**
- Write a Python script `scripts/generate_synthetic.py` that generates all demo data
- For each topic, generate claim archetypes → expand to synthetic posts → assign temporal patterns → generate embeddings (numpy random with controlled clustering) → assign clusters → compute 2D UMAP-like positions → output JSON
- Script must be self-contained (only uses numpy, no API calls needed)

Exit criteria: All JSON files exist and are loadable by the frontend hooks. At least 4 topics. Each topic has 8+ clusters. Temporal patterns produce non-trivial metric results (verified after compute_metrics.py runs).

### 2A-alt. Real Ingestion (SECONDARY) — `scripts/ingest.py` [CX]

**Built but secondary.** Activates when API keys are available.

**Input:** API credentials from `.env`. Topic list hardcoded.
**Output:** `/data/raw/{topic_id}/{platform}.json`

**Codex spec:**
- Input context: `.env.example` for required credentials, output JSON schema matching raw data format
- Output: Python script using `praw` (Reddit), `requests` (X API v2), `google-api-python-client` (YouTube)
- Per platform: pull ~300-500 documents per topic, normalize timestamps to UTC ISO8601, content-hash each document for dedup
- X: `api.x.com/2/tweets/search/recent`, store `{id, text, author_id, created_at, public_metrics}`
- Reddit: `praw` subreddit search, store `{id, body, author, subreddit, created_utc, score, num_comments}`
- YouTube: targeted channel search (top 10-20), store `{video_id, title, description, channel_title, comment_text, comment_likes, view_count}`

### 2B. Claim Extraction (SECONDARY) — `scripts/extract.py` [CC]

**Built but secondary.** Only needed when running against real ingested data. Synthetic path pre-generates extracted claims.

**Input:** `/data/raw/{topic_id}/{platform}.json`
**Output:** `/data/claims/{topic_id}/extracted.json`

**Implementation:**
- Load extraction prompt from `scripts/prompts/extraction_prompt.md`.
- For each raw document, compute content hash. Check against cache file (`/data/claims/{topic_id}/.cache.json` mapping hash→claims). Skip if cached.
- Call Claude Sonnet (`claude-sonnet-4-20250514`) via `anthropic` SDK:
  - System prompt: extraction prompt's system section
  - User prompt: template filled with document metadata
  - `max_tokens=1024`, `temperature=0`
- Parse JSON response. Validate each claim against expected schema. Reject malformed responses.
- Assign each claim a unique ID: `{topic_id}_{platform}_{hash[:8]}_{idx}`.
- Store source metadata alongside: `{claim_fields, source_document_id, source_platform, source_timestamp, source_engagement}`.
- Rate limit: 50 requests/minute to avoid API throttling. Use `asyncio` with semaphore for parallelism.

Exit criteria: Claims have all required fields. Manual spot-check: 10 random claims make semantic sense.

Risks:
- Extraction quality on sarcasm/memes. Recovery: iterate on extraction prompt.
- API cost overrun. Recovery: sample documents if >2000 per topic.

### 2C. Embedding Generation — `scripts/embed.py` [CX]

**For the synthetic path:** `generate_synthetic.py` already produces embeddings. This script is only needed for the real pipeline path (when running against API-extracted claims).

**Input:** `/data/claims/{topic_id}/extracted.json` (claims without embeddings)
**Output:** `/data/claims/{topic_id}/embedded.json` (claims with `embedding: float[1536]`)

**Codex spec:**
- Input context: Claim type definition, OpenAI embeddings API docs
- Output: Python script that batch-embeds claims using OpenAI `text-embedding-3-small`
- Algorithm: Load claims → batch in groups of 100 → call `openai.embeddings.create(model="text-embedding-3-small", input=texts)` → L2-normalize vectors → write back
- Cache: skip claims that already have embeddings (check by claim ID hash)
- Embed the canonical claim `text` field prepended with `subject: assertion:` for richer context

Exit criteria: Every claim has a 1536-dim embedding vector. Cosine similarity between related claims >0.7, between unrelated claims <0.4.

Risks:
- Requires OPENAI_API_KEY. Recovery: for demo, synthetic embeddings from `generate_synthetic.py` suffice.

### 2D. Clustering — `scripts/cluster.py` [CC]

**For the synthetic path:** `generate_synthetic.py` pre-assigns clusters. This script is needed for the real pipeline path AND to re-cluster synthetic data if tuning is needed.

**Input:** `/data/claims/{topic_id}/embedded.json`
**Output:** `/data/claims/{topic_id}/clustered.json` (claims with cluster_id, concept_id). `/data/claims/{topic_id}/clusters.json` (Cluster objects).

**Implementation:**
1. Load all claim embeddings for a topic into a numpy matrix.
2. Reduce dimensionality: UMAP to 50 dims for HDBSCAN (high-dim clustering is unreliable). Use `umap-learn` package.
3. Run HDBSCAN: `hdbscan.HDBSCAN(min_cluster_size=5, min_samples=3, metric='euclidean')`. Tune `min_cluster_size` per topic — polarized topics need smaller clusters.
4. Assign `cluster_id` to each claim. Noise points (label=-1) get `cluster_id="noise"`.
5. **Concept layer:** Merge clusters whose centroids are within cosine distance 0.15 into a single concept. This handles vocabulary variation per §3B.
6. **Compute cluster metadata:**
   - `label`: Pick the claim with highest confidence in the cluster as representative text.
   - `member_count`: len(cluster members)
   - `centroid`: mean of member embeddings (in original 1536-dim space, not UMAP-reduced)
   - `arousal_value`: mean arousal score (high=1.0, medium=0.5, low=0.0) across members
   - `arousal_trend`: compare arousal_value across time windows (requires temporal bucketing)
   - `mutation_direction`: computed in metrics engine (stub as "stable" here)
   - `mutation_magnitude`: 0.0 (stub)
   - `adversarial_pairs`: [] (stretch goal)
7. **2D positions for visualization:** Run UMAP to 2 dims on cluster centroids. Store as `{cluster_id: {x, y}}`. These become the initial positions for the D3 force layout.

**Additional dependency:** Add `umap-learn>=0.5.5` to requirements.txt.

Exit criteria: Each topic has 5-20 clusters (not 1, not 100+). Noise <20% of claims. Manual check: clusters are semantically coherent (claims in same cluster argue similar positions).

Risks:
- HDBSCAN produces 1 giant cluster or all noise. Detection: log cluster count and noise ratio. Recovery: tune `min_cluster_size` and `min_samples`. Try different UMAP `n_neighbors` values.
- UMAP non-deterministic. Recovery: set `random_state=42` for reproducibility.

### 2E. Metrics Computation — `scripts/compute_metrics.py` [CC]

**Input:** `/data/claims/{topic_id}/clustered.json`, `/data/claims/{topic_id}/clusters.json`
**Output:** `/data/metrics/{topic_id}/` containing:
- `landscape_{window}.json` — LandscapeData per time window
- `claims/{claim_id}.json` — ClaimDetail per claim (or top-N claims)
- `compare/{slice_a}_{slice_b}_{window}.json` — CompareData
- `timeline_{window}.json` — TimelineData
- `topic_summary.json` — TopicSummary for Level 0

This is the most complex script. **Implement metrics in priority order per CLAUDE.md:**

**1. Momentum + Source Diversity + Bridge Nodes (§7B)**
- For each claim in each time window, compute percentile rank by engagement volume.
- Momentum = percentile_at_t - percentile_at_(t-1). Sparkline = array of percentile values across windows.
- Source diversity: count unique authors. Normalize by expected diversity at that volume (use log-normal model). Score 0-1 where 1=maximally distributed.
- Bridge nodes (Reddit only for v1): For each author contributing to a claim, count distinct subreddits they've posted in. Flag authors with >=3 subreddits as bridge nodes. Bridge ratio = bridge_node_engagement / total_engagement.
- Confidence interval: bootstrap resampling (100 iterations) on the engagement counts.

**2. Friction (§7C)**
- For each claim, classify engagement as oppositional vs. supportive:
  - Reddit: replies that quote-reply with counter-claims (use embedding distance >0.6 from parent as proxy for opposition). Downvote ratio if available.
  - X: Quote tweets with high embedding distance. Reply sentiment (simple heuristic: negation words + embedding distance).
- Friction = oppositional / total. Range 0-1.
- Friction quadrant: combine with momentum. High momentum (>0.5) + low friction (<0.3) = "unopposed_advance". High+high = "contested_advance". Low+high = "successful_suppression". Low+low = "dead".

**3. Divergence + Typology (§7G)**
- Define slices: platform-based (X vs Reddit vs YouTube), behavioral (high-engagement vs low-engagement users).
- For each slice pair, compute claim distribution: vector of salience values per cluster.
- **JSD:** `scipy.spatial.distance.jensenshannon(p, q)` — returns sqrt(JSD), which is a true metric. Square it for JSD. Store both.
- **Typology (continuous scores):**
  - Information asymmetry: For each cluster, compute `max(salience_a, salience_b) / (min(salience_a, salience_b) + epsilon)`. Average across clusters where one side has near-zero mass. Normalize to 0-1.
  - Interpretive: `1 - abs(scipy.stats.spearmanr(salience_ranks_a, salience_ranks_b).statistic)` on shared clusters. Normalize to 0-1. Low correlation = high interpretive divergence.
  - Paradigmatic: Compute support overlap = fraction of clusters with non-trivial mass (>5th percentile) in both slices. `1 - overlap` = paradigmatic score.
  - Dominant mode: argmax of the three scores.
  - Paradigmatic caveat: True if mean extraction confidence differs by >0.1 across slices.
- Trend sparkline: JSD values across time windows.

**4. Persistence (§7D)**
- For each claim, track consecutive windows where salience >= 50th percentile.
- `persistence_windows` = count of consecutive above-threshold windows.

**5. Arousal Profile (§7E)**
- Per concept per window: mean arousal value (high=1.0, med=0.5, low=0.0).
- Trend: compare current window to previous. Rising = "warming", falling = "cooling", stable = "stable" (delta < 0.1).

**6. Mutation Directionality (§7F)**
- Per concept: compute centroid at window t and t+1.
- Compute vector from centroid_t to centroid_{t+1}.
- Compute vector from centroid_t to overall claim space center (mean of all centroids).
- Dot product of the two vectors: positive = moving toward center (mainstreaming), negative = moving away (radicalizing).
- Check internal cluster variance: if variance increased >20%, flag as "fragmenting".
- `mutation_magnitude` = norm of the centroid displacement, normalized.

**7. Salience (§7A)**
- Per claim per slice: `(claim_count_in_slice / total_in_slice) / (claim_count_global / total_global)`.
- Apply shrinkage for small samples: `shrunk = alpha * observed + (1-alpha) * global_rate` where `alpha = n / (n + k)`, k=10.
- Confidence interval via Wilson score interval.

**8. Exposure Decomposition (§7H + §1A)**
- Production: unique original posts expressing the claim.
- Amplification: shares/retweets/upvotes on those posts.
- Estimated exposure: production * avg_follower_count (crude proxy with wide CI).

**9. Silence Detection (§7I) — Day 5 metric**
- For each claim that was active (above 50th percentile) in window t-1: if it drops below 10th percentile in window t while topic volume is stable (±20%), flag as `claim_dark` event.

**10. Expressibility (§7J) — Day 5 metric**
- Per claim per slice: original_posts / total_engagement. Store as Metric with CI.

**11. Coordination Signals (§8) — Day 5 metric**
- Burstiness: compute inter-arrival times of posts for a claim. Compare to exponential distribution (Poisson process). KS-test p-value < 0.01 = anomalous.
- Near-duplicate: for each claim cluster, compute pairwise cosine similarity of raw source texts (not canonical claims). If >30% of pairs have similarity >0.9, flag.
- Cross-platform sync: for each claim, check if it appears on 2+ platforms within 2 hours. Compare to baseline cross-platform lag for that topic.
- Source diversity anomaly: if source_diversity < 0.3 (concentrated), flag.

**12. Supply Chain (§3E) — Day 5 metric**
- Per concept: sort instances by timestamp across platforms.
- Build hop chain: earliest instance → next platform appearance → next.
- Compute fidelity: cosine similarity between each hop's embedding and the origin embedding (fidelity_to_origin) and previous hop (fidelity_to_previous).
- `observation_boundary`: if no earlier instance found, set "No public antecedent detected".

**13. Lead-Lag (§6A) — Day 5 metric**
- Per claim: cross-correlate momentum time series across platforms using `numpy.correlate`.
- Peak lag = the offset with maximum correlation. If consistent across claims from same concept, flag as `lead_lag` event.

**14. Event Generation (Zone D)**
- Scan all computed metrics for threshold violations:
  - `momentum_spike`: claim jumps >30 percentile points in one window
  - `divergence_shift`: JSD changes >0.15 over 2+ windows
  - `coordination_flag`: any coordination signal exceeds threshold
  - `contestation_emergence`: topic contestation shifts from low to high within 48-72h
  - `claim_dark`: active claim drops to zero (see silence detection)
  - `arousal_escalation`: concept arousal trend shifts to "warming"
  - `phase_transition`: mutation direction reverses
  - `lead_lag`: consistent temporal offset detected
- Assign severity based on confidence and magnitude. Sort severity-first, then recency.

**15. Topic Summary (Level 0)**
- Aggregate per topic: cluster count, contestation level, headline divergence (highest JSD pair), top accelerating claim, most persistent claim, key signal (highest severity event), activity sparkline.

Exit criteria: All JSON files in `/data/metrics/` are valid and match TypeScript types. At least 3 topics have full metric sets. Divergence typology produces non-trivial continuous scores (not all zeros). Events timeline has >=3 distinct event types.

Risks:
- JSD computation fails on sparse distributions. Recovery: add Laplace smoothing (add epsilon to all bins).
- Bridge node detection noisy on X. Recovery: only compute for Reddit, stub for X.
- Too many events generated. Recovery: add minimum severity threshold; cap at 50 per topic.

---

## Component 3: Data Fetching Layer (Frontend)

Depends on: Types (1A), static JSON from pipeline (2E).

### 3A. Data Hooks [CX]

**Codex spec for all 5 hooks:** Provide `src/types/index.ts` as context. Each hook follows the same pattern:
- Use `useState<T | null>(null)`, `useState<boolean>(true)` for loading, `useState<Error | null>(null)` for error
- `useEffect` with `fetch(url).then(res => res.json()).then(setData).catch(setError).finally(() => setLoading(false))`
- Re-fetch when params change (include params in useEffect dependency array)
- Return typed object, never `any`

**File:** `src/hooks/useTopics.ts`
- URL: `/data/topics.json`
- Returns `{ topics: TopicSummary[], loading: boolean, error: Error | null }`

**File:** `src/hooks/useLandscape.ts`
- URL: `/data/metrics/${topicId}/landscape_${window}.json`
- Params: `topicId: string, window: TimeWindow`
- Returns `{ landscape: LandscapeData | null, loading, error }`

**File:** `src/hooks/useClaimDetail.ts`
- URL: `/data/metrics/${topicId}/claims/${claimId}.json`
- Returns `{ detail: ClaimDetail | null, loading, error }`

**File:** `src/hooks/useCompare.ts`
- URL: `/data/metrics/${topicId}/compare/${sliceA}_${sliceB}_${window}.json`
- Returns `{ compare: CompareData | null, loading, error }`

**File:** `src/hooks/useTimeline.ts`
- URL: `/data/metrics/${topicId}/timeline_${window}.json`
- Client-side filtering: `filterByType(type: EventType | 'all')` filters the fetched events array
- Returns `{ events: NarrativeEvent[], loading, error, filterByType }`

Exit criteria: Each hook successfully fetches and types its data. No `any` types.

### 3B. Utility Functions [CX]

**Codex spec for format.ts:** Pure functions, no side effects, no imports needed beyond standard JS. Provide function signatures and expected outputs as test cases.

**File:** `src/utils/format.ts`
- `formatMetricValue(value: number, precision?: number): string` — `formatMetricValue(0.7345, 2)` → `"0.73"`
- `formatConfidenceInterval(ci: [number, number]): string` — `formatConfidenceInterval([0.65, 0.82])` → `"[0.65, 0.82]"`
- `formatTimeAgo(timestamp: string): string` — relative time: `"4h ago"`, `"3d ago"`, `"< 1h ago"`
- `formatPercentile(value: number): string` — `formatPercentile(72)` → `"72nd"`, `formatPercentile(1)` → `"1st"`

**Codex spec for colors.ts:** Pure functions mapping numeric values to CSS color strings. Provide the color system from end-state §4.1.

**File:** `src/utils/colors.ts`
- `getMomentumColor(momentum: number): string` — 5-stop gradient: momentum < -0.5 → #3B82F6, -0.5 to -0.1 → #14B8A6, -0.1 to 0.1 → #94A3B8, 0.1 to 0.5 → #F59E0B, >0.5 → #EF4444. Use HSL interpolation for smooth transitions.
- `getArousalGlow(arousal: number): { boxShadow: string; opacity: number }` — arousal 0-1 maps to glow radius 0-15px
- `getMutationColor(direction: string): string` — mainstreaming=#22C55E, radicalizing=#EF4444, fragmenting=#F59E0B, stable=#94A3B8
- `getSeverityColor(severity: string): string` — low=#64748B (dim), medium=#F59E0B, high=#EF4444
- `getSourceDiversityColor(score: number): string` — score>0.6 → #22C55E (green/organic), score<0.3 → #EF4444 (red/concentrated), between → interpolated
- `getDivergenceHeatmapColor(value: number): string` — 0→#0A0E17 (dark), 0.5→#F59E0B (amber), 1.0→#DC2626 (crimson)

**File:** `src/utils/tooltips.ts`
- Factory functions that generate tooltip content for each metric following the 4-part pattern:
  - `salience(value, baseline, percentile): TooltipContent`
  - `momentum(value, percentileFrom, percentileTo, hours, sourceCount, bridgeRatio): TooltipContent`
  - `friction(value, quadrant): TooltipContent`
  - `persistence(windows, thresholdPercentile): TooltipContent`
  - `arousal(trend, currentValue, previousValue): TooltipContent`
  - `divergenceTypology(typology): TooltipContent`
  - etc.
- `interface TooltipContent { title: string; calculation: string; reading: string; caveat?: string }`

Exit criteria: All utility functions handle edge cases (NaN, undefined, zero). Color functions return valid CSS color strings.

---

## Component 4: App Shell + State Management

Depends on: Types (1A), Hooks (3A).

### 4A. App State [CC]
**File:** `src/App.tsx`

**Implementation:**
- State machine with 3 levels: `level: 0 | 1 | 2`
- `selectedTopicId: string | null` — null = Level 0
- `selectedClaimId: string | null` — null = Level 1 (topic overview in Zone B)
- `timeWindow: TimeWindow` — default '24h'
- `compareMode: boolean` — false by default
- `selectedSlices: [string, string] | null` — for Zone C comparison
- `eventTypeFilter: EventType | 'all'` — for Zone D filtering
- `searchQuery: string`

State transitions:
- Level 0 → Level 1: set `selectedTopicId`, `level=1`
- Level 1 → Level 2: set `selectedClaimId`, `level=2`
- Level 2 → Level 1: set `selectedClaimId=null`, `level=1`
- Level 1 → Level 0: set `selectedTopicId=null`, `level=0`

No routing. No context providers needed — prop-drill is fine for this flat hierarchy. If prop drilling gets unwieldy, add a single `useReducer` at App level.

**File:** `src/components/Header.tsx` [CX]
- Search bar (input with magnifying glass icon)
- Topic tabs when in Level 1 (clickable topic names + "Overview" to return to Level 0)
- Height: 40px fixed
- Background: #111827, border-bottom: 1px solid #1E293B

Exit criteria: App renders. Level transitions work via state changes. Header shows search bar and topic tabs. No routing in codebase.

---

## Component 5: Level 0 — Multi-Topic Overview

Depends on: App shell (4A), useTopics hook (3A), Types (1A).

### 5A. Topic Card Grid [CX]
**File:** `src/components/Level0/TopicOverview.tsx`
- Renders when `level === 0`.
- Fetches topics via `useTopics()`.
- Displays 3-5 TopicSummary cards in a grid.
- No-results state for search: "No data available for this topic. The system currently tracks N pre-indexed topics."

**File:** `src/components/Level0/TopicCard.tsx`
- Single topic card. Displays:
  - Topic name (Inter, 18px, #F1F5F9)
  - Cluster count badge
  - Contestation level indicator (color-coded)
  - Contestation emergence flag if non-null ("Contestation emerged Xh ago")
  - Headline divergence: JSD value + typology label + trend arrow
  - Top accelerating claim (one-line truncated) + momentum value + source diversity dot
  - Most persistent claim + window count
  - Key signal (emoji + summary) if non-null
  - Activity sparkline (Recharts `<Sparkline>` or inline SVG)
- Click handler → calls parent's `onSelectTopic(id)`.
- Background: #111827, border-radius: 8px, hover: subtle glow.

**File:** `src/components/Level0/MiniSparkline.tsx` [CX]
- Tiny sparkline component using Recharts `<LineChart>` or raw SVG path.
- Cyan (#06B6D4) line on transparent background.
- Props: `data: number[], width: number, height: number`.

Exit criteria: Level 0 renders 3+ topic cards. Each card shows all required fields. Clicking a card transitions to Level 1. Screenshot looks like an intelligence dashboard, not a hackathon project.

---

## Component 6: Level 1 — Zone Layout Container

Depends on: App shell (4A).

### 6A. Zone Layout [CX]
**File:** `src/components/TopicView/TopicView.tsx`
- Renders when `level >= 1`.
- CSS Grid layout matching the zone spec:
  ```
  grid-template-columns: 75fr 25fr;
  grid-template-rows: 60fr 40fr;
  ```
- Zone A: top-left (col 1, row 1)
- Zone B: right sidebar (col 2, row 1-2, full height)
- Zone C: bottom-left-left (col 1, row 2, left half)
- Zone D: bottom-left-right (col 1, row 2, right half)
- Full height: `calc(100vh - 40px)` (minus header).
- Each zone gets a panel wrapper: background #111827, subtle border, overflow handling.

**File:** `src/components/TopicView/ZonePanel.tsx` [CX]
- Reusable panel wrapper. Props: `title?: string, className?: string, children`.
- Adds panel styling: bg-[#111827], rounded, padding.

Exit criteria: All 4 zones visible simultaneously. Layout doesn't break at 1280px or 1920px widths. Zones fill available space proportionally.

---

## Component 7: Zone A — Claim Landscape (D3)

Depends on: Zone layout (6A), useLandscape hook (3A), color utils (3B), Types (1A).

**This is the hero component. Budget maximum implementation effort here.**

### 7A. Force-Directed Graph [CC]
**File:** `src/components/ZoneA/ClaimLandscape.tsx`

**Implementation approach:**
- Use D3 force simulation (`d3-force`) with React for DOM (not D3 DOM manipulation).
- `useRef` for the SVG container. `useEffect` to run simulation.
- **Force configuration:**
  - `forceCenter()` — keep graph centered
  - `forceManyBody().strength(-100)` — repulsion between nodes
  - `forceCollide().radius(d => salience_to_radius(d.salience))` — prevent overlap
  - `forceLink()` — connect nodes in same cluster with weak links (strength 0.1)
  - Custom `forceCluster()` — attract nodes toward their cluster centroid position (from UMAP 2D positions)
- **Node visual encoding:**
  - Size: `radius = 8 + salience_percentile * 30` (salience maps to 8-38px radius)
  - Color: `getMomentumColor(momentum)` — 5-stop gradient
  - Border glow: CSS filter `drop-shadow(0 0 ${arousal * 15}px ${color})` — arousal intensity
  - Opacity: `confidence < 0.5 ? 0.4 : 1.0` — confidence dimming
- **Cluster boundaries:** Render convex hulls for each cluster using `d3.polygonHull()`. Fill with cluster color at 5% opacity. Stroke at 10% opacity. Should feel like galaxy boundaries.
- **Mutation arrows:** Small SVG arrows on concept cluster centroids. Direction based on `mutation_direction`. Color from `getMutationColor()`.
- **Interactions:**
  - Hover: show tooltip (Type 1 — data summary). 100ms delay. Content: claim text, confidence, arousal, persistence, friction.
  - Click: select node → dim others to 60% opacity, highlight ring on selected, dispatch `onClaimSelect(claimId)`.
  - Click background: deselect → restore all nodes, dispatch `onClaimDeselect()`.

**File:** `src/components/ZoneA/TimeWindowControl.tsx` [CX]
- Segmented button control: `6h | 24h | 7d`.
- Positioned in Zone A header area.
- On change: parent updates `timeWindow` state. Landscape re-fetches data and animates transition.

**File:** `src/components/ZoneA/ClaimTooltip.tsx` [CX]
- Positioned tooltip that follows mouse.
- Shows: claim text (in quotes), confidence score, arousal level, persistence duration, friction ratio, "Click to inspect".
- Style: bg-[#1E293B], border 1px #334155, text-sm, max-width 300px.

**Animation on time window switch:**
- When `timeWindow` changes, new data loads. D3 simulation restarts with new positions.
- Nodes animate from old position to new position over 200ms using D3 transition.
- Growing nodes = accelerating. Shrinking = decelerating. The animation IS the data.

**Compare mode (split landscape):**
- When `compareMode === true`, render TWO force simulations side-by-side.
- Left = Slice A topology. Right = Slice B topology.
- Same claims may appear in both with different sizes/colors reflecting per-slice metrics.
- Label each side with slice name.

Exit criteria: Graph renders 50+ nodes without performance issues. Clusters are visually separated. Momentum colors are distinct. Arousal glow is visible on high-arousal nodes. Time window switch animates smoothly (200ms). Hover tooltips appear. Click selects a node. The landscape looks beautiful — galaxy-like, not a random mess.

Risks:
- D3 force layout converges to ugly shapes. Detection: visual inspection. Recovery: Tune force parameters extensively. Use UMAP positions as initial positions (not random). Add forceX/forceY to anchor clusters.
- Performance with many nodes. Detection: FPS drops below 30. Recovery: Use canvas rendering instead of SVG for >200 nodes. Or: aggregate small clusters into single meta-nodes.
- React re-renders kill D3 animation. Detection: stuttering. Recovery: Isolate D3 in `useRef`, never let React re-render the SVG directly.

---

## Component 8: Zone B — Vitals Panel

Depends on: Zone layout (6A), useClaimDetail hook (3A), tooltip utils (3B), Types (1A).

### 8A. Topic Overview (default state) [CX]
**File:** `src/components/ZoneB/VitalsPanel.tsx`
- Controller component. Renders TopicOverviewVitals when no claim selected, ClaimVitals when claim selected.
- Header: "Topic Overview" or "Claim: {text}" based on state.
- When no claim selected, shows: "Select a claim to inspect" invitation.
- Full-height scrollable container.

**File:** `src/components/ZoneB/TopicOverviewVitals.tsx`
- Reads from `landscape.topic_metrics`.
- Displays:
  - Total claim clusters with labels
  - Overall contestation level (color badge)
  - Contestation emergence indicator if flagged
  - Top accelerating claim: name + momentum value + source diversity dot (green/red)
  - Most persistent claim: name + window count
  - Top friction claim: name + friction value
  - Highest arousal concept: name + temperature trend (warming/cooling/stable icon)
  - Notable mutation: concept name + direction arrow if any

### 8B. Claim Detail (selected state) [CC]
**File:** `src/components/ZoneB/ClaimVitals.tsx`
- Fetches ClaimDetail via `useClaimDetail(topicId, claimId)`.
- **Above the fold (visible without scrolling):**
  - Salience value + baseline label + hover tooltip
  - Momentum value + sparkline (Recharts) + source diversity dot + bridge ratio if elevated
  - Friction gauge (prominent!) + quadrant label
  - Persistence duration bar (visual bar showing consecutive windows)
  - Arousal trend temperature indicator
  - Expressibility (original-post ratio)
  - Exposure decomposition (3-layer stacked bar: production/amplification/estimated exposure)
  - Confidence score + factors that reduced it
- **Below the fold (scrollable):**
  - Provenance: first-detected platform + timestamp + lead-lag timeline
  - Supply chain: hop timeline with fidelity decay % + observation boundary
  - Coordination check: 4 signals as severity indicators with organic baseline bars
  - Semantic neighbors: list of related claims with similarity scores
  - Example content: 3-5 real posts with confidence per extraction. YouTube tagged "Influencer Framing".

**File:** `src/components/ZoneB/MetricRow.tsx` [CX]
- Reusable row component for a single metric.
- Props: `label, value, sparkline?, confidenceInterval, tooltip: TooltipContent`.
- Label in Inter #94A3B8. Value in JetBrains Mono #F1F5F9.
- Hover: show methodology tooltip (Type 2, 300ms delay).
- Grey-out mode: 30% opacity + explanation when metric inapplicable.

**File:** `src/components/ZoneB/FrictionGauge.tsx` [CX]
- Prominent visual gauge for friction. Circular or bar gauge.
- Shows value 0-1, color-coded, quadrant label.

**File:** `src/components/ZoneB/PersistenceBar.tsx` [CX]
- Horizontal bar showing consecutive windows. Each window segment filled/empty.
- Length = total possible windows. Filled segments = consecutive above-threshold.

**File:** `src/components/ZoneB/ExposureBar.tsx` [CX]
- Three-layer stacked horizontal bar: production (base), amplification (middle), estimated exposure (top).
- Each layer in a distinct shade. Labels on hover.

**File:** `src/components/ZoneB/SupplyChainTimeline.tsx` [CX]
- Vertical timeline showing hops across platforms.
- Each hop: platform icon + timestamp + fidelity % badge.
- Observation boundary label at the start: "No public antecedent detected."

**File:** `src/components/ZoneB/CoordinationCheck.tsx` [CX]
- 4 rows: burstiness, near-duplicate, cross-platform sync, source diversity anomaly.
- Each row: label + severity indicator (dim/amber/red) + score vs organic baseline bar.

**File:** `src/components/ZoneB/MethodologyTooltip.tsx` [CX]
- Reusable tooltip component for Type 2 (methodology) hovers.
- Shows 4-part content: what it is, how calculated, current reading, caveats.
- Appears after 300ms delay. Disappears on mouse leave.
- Style: bg-[#1E293B], max-width 350px, shadow-lg.

Exit criteria: All metrics visible with correct formatting. Every metric has a methodology tooltip. Friction is prominent (not buried). Persistence distinguishes embedded beliefs from flashes. Low-confidence metrics dimmed at 40%. Inapplicable metrics greyed at 30% with explanation. YouTube content tagged "Influencer Framing". Supply chain shows observation boundaries.

---

## Component 9: Zone C — Divergence

Depends on: Zone layout (6A), useCompare hook (3A), Types (1A).

### 9A. Divergence Panel [CC]
**File:** `src/components/ZoneC/DivergencePanel.tsx`
- Default: compact divergence view between auto-selected most-divergent slice pair.
- Headline JSD score + trend sparkline
- Typology labels with continuous scores: "Info Asymmetry: 0.72 | Interpretive: 0.18 | Paradigmatic: 0.10"
- Compact heatmap
- Arousal comparison per slice
- "Full Compare" button → sets `compareMode=true`

**File:** `src/components/ZoneC/DivergenceHeatmap.tsx` [CX]
- Rows = claim clusters. Columns = the two compared slices.
- Cell color intensity = how differently the claim is distributed.
- Color scale: dark (#0A0E17) → amber (#F59E0B) → crimson (#DC2626).
- Implementation: SVG rect grid. Color via `getDivergenceHeatmapColor()`.

**File:** `src/components/ZoneC/SliceSelector.tsx` [CX]
- Dropdown to select which two slices to compare.
- Options: platform-based slices + behavioral slices.
- YouTube slices labeled "Influencer Framing (YouTube)".
- On change: re-fetch comparison data.

**File:** `src/components/ZoneC/TypologyScores.tsx` [CX]
- Three horizontal bars showing continuous typology scores.
- Dominant mode highlighted.
- Hover on paradigmatic: extraction confidence caveat if `paradigmatic_caveat` is true.

**File:** `src/components/ZoneC/FullCompareMode.tsx` [CC]
- Expands Zone C. Zone A splits into two landscapes (handled in ClaimLandscape).
- Zone B compresses to slim vitals.
- Shows: per-cluster comparison bars, exposure decomposition per slice, arousal comparison, mutation trajectory comparison.
- "Exit Compare" button → sets `compareMode=false`.

Exit criteria: Divergence scores display correctly. Heatmap is visually compelling (dark background, hot cells pop). Typology shows continuous scores, not binary. Slice selector works. Full Compare mode splits the landscape and restores cleanly. Base-rate normalization active (no raw counts shown).

---

## Component 10: Zone D — Signals Timeline

Depends on: Zone layout (6A), useTimeline hook (3A), Types (1A).

### 10A. Event Feed [CX]
**File:** `src/components/ZoneD/SignalsTimeline.tsx`
- Chronological event feed. Shows 5 most recent/important events initially.
- Each event: one-liner with severity color coding (dim/amber/red).
- Scrollable beyond initial 5.
- Click any event → selects relevant claim in Zone A, updates Zone B.
- Filter chips at top: All | Momentum | Divergence | Coordination | Silence | Arousal | Mutation | Lead-Lag.

**File:** `src/components/ZoneD/EventCard.tsx` [CX]
- Single event display. Props: `event: NarrativeEvent, onClickEvent`.
- Emoji prefix based on type: momentum_spike=📈, divergence_shift=🔀, coordination_flag=⚠️, claim_dark=🔇, arousal_escalation=🌡️, phase_transition=↗️, lead_lag=🔗, contestation_emergence=⚡
- Severity colors: low=muted text, medium=#F59E0B, high=#EF4444.
- Hover: pointer cursor + subtle highlight.

**File:** `src/components/ZoneD/FilterChips.tsx` [CX]
- Row of toggleable chips for event type filtering.
- Active chip: filled background. Inactive: outline.
- "All" resets filter.

Exit criteria: Events display sorted by severity then recency. Clicking an event navigates to the relevant claim. Filter chips work. At least 3 distinct event types visible.

---

## Component 11: Animations & Transitions

Depends on: All zone components.

### 11A. Level Transitions [CX]
**File:** Update `src/App.tsx` and `src/components/Level0/TopicCard.tsx`
- Level 0 → Level 1: selected topic card smoothly expands into zone layout. Use CSS transitions or Framer Motion if needed. If animation is hard, clean instant-switch is acceptable.
- Claim selection: 200ms ease transition. Selected node scales up + highlight ring. Others dim to 60%.

### 11B. Time Window Animation [CX]
**File:** Update `src/components/ZoneA/ClaimLandscape.tsx`
- D3 transition on window switch: nodes interpolate position, size, color over 200ms.
- Use `d3.transition().duration(200)` on the simulation restart.

### 11C. Zone D Event Animation [CX]
**File:** Update `src/components/ZoneD/EventCard.tsx`
- New events slide in from top with brief highlight pulse.
- CSS animation: `@keyframes slideIn { from { transform: translateY(-20px); opacity: 0; } }` + highlight glow that fades.

Exit criteria: Transitions are smooth, not janky. Animation duration ≤200ms. No layout shifts during transitions.

---

## Component 12: Visual Polish & Failure States

### 12A. Global Styles [CX]
**File:** Update `src/index.css`
- Background: #0A0E17 on body
- All panel backgrounds: #111827
- Font families: JetBrains Mono for `.font-mono`, Inter for `.font-sans`
- Custom Tailwind theme extensions in CSS variables
- Scrollbar styling (dark)
- Selection color styling

### 12B. Failure State Components [CX]
**File:** `src/components/shared/GreyedMetric.tsx`
- Wraps any metric display at 30% opacity with explanation text.
- Props: `reason: string, children`.

**File:** `src/components/shared/LowConfidence.tsx`
- Wraps any element at 40% opacity.
- Props: `confidence: number, threshold?: number, children`.

**File:** `src/components/shared/InsufficientData.tsx`
- Displayed when data can't be computed.
- "Low contestation detected" not "No results."
- "Estimated" not stated as fact.
- "Consistent with coordination" not "Coordinated attack."
- "No public antecedent detected" not "Originated on Reddit."

**File:** `src/components/shared/Sparkline.tsx` [CX]
- Reusable sparkline for all metric displays.
- Cyan (#06B6D4) line. No axes. Just the trend.
- Uses Recharts `<LineChart>` in minimal mode.

Exit criteria: Every metric that can't be computed shows grey-out with explanation. Low-confidence items are dimmed. No "0" values displayed where data is missing. Honest labeling throughout.

---

## Summary: File Dependency Order

**Phase 1 — Foundation (parallel tracks):**
```
[CC] requirements.txt, .env.example, directory structure (CW optional — CC can do this)
[CC] package.json (vite init), vite.config.ts, tsconfig.json, src/index.css
[CC] src/types/index.ts ← THE critical file. Everything depends on this.
```
*Hand-off: Once types exist, share src/types/index.ts with every downstream tool.*

**Phase 2 — Data Pipeline:**
```
PRIMARY (synthetic, no API keys needed):
  [AG/Sonnet] scripts/generate_synthetic.py → produces /data/raw/, /data/claims/, /data/topics.json
    Context to provide AG: src/types/index.ts + plan §2A + topic archetype definitions
  [CC] scripts/compute_metrics.py → reads claims, produces /data/metrics/
    Hand-off: verify JSON matches types before moving to Phase 3

SECONDARY (real pipeline, when API keys available):
  [CX] scripts/ingest.py → /data/raw/
    Codex context: .env.example + raw data JSON schema
  [CC] scripts/extract.py → /data/claims/extracted.json
  [CX] scripts/embed.py → /data/claims/embedded.json
    Codex context: Claim type + OpenAI embeddings API
  [CC] scripts/cluster.py → /data/claims/clustered.json + clusters.json
  [CC] scripts/compute_metrics.py → /data/metrics/ (same script, shared)
```

**Phase 3 — Frontend Data Layer (parallelizable — all [CX] tasks can run simultaneously):**
```
[CX] src/hooks/useTopics.ts, useLandscape.ts, useClaimDetail.ts, useCompare.ts, useTimeline.ts
    Codex context: src/types/index.ts + hook pattern template (fetch → useState → useEffect)
[CX] src/utils/format.ts, colors.ts
    Codex context: function signatures + test cases from plan §3B
[CC] src/utils/tooltips.ts ← requires domain knowledge of each metric's methodology
```
*Hand-off: All hooks + utils must compile before Phases 4+. Run `npx tsc --noEmit` as gate.*

**Phase 4 — App Shell [CC]:**
```
[CC] src/App.tsx — state machine, level transitions, prop threading
[CX] src/components/Header.tsx — search bar + topic tabs
    Codex context: App.tsx props interface + Tailwind classes from plan
[CX] src/components/TopicView/TopicView.tsx, ZonePanel.tsx — CSS Grid layout
    Codex context: zone layout spec from plan §6A + Tailwind
```
*Hand-off: Verify zone layout renders 4 empty panels at correct proportions.*

**Phase 5 — Level 0 [CX/AG]:**
```
[CX] src/components/Level0/TopicCard.tsx, MiniSparkline.tsx — presentational
    Codex context: TopicSummary type + color utils + Recharts sparkline API
[AG/Sonnet] src/components/Level0/TopicOverview.tsx — if doing bulk: generate all 3 Level0 files at once
    AG context: TopicSummary type + useTopics hook + TopicCard component interface
```
*Hand-off: Verify Level 0 renders topic cards from /data/topics.json.*

**Phase 6 — Zone A (hero component, most effort) [CC]:**
```
[CC] src/components/ZoneA/ClaimLandscape.tsx ← THIS IS THE MOST IMPORTANT FILE
    Must be done in Claude Code. D3 force simulation + React integration requires
    iterative tuning that can't be spec'd for Codex.
[CX] src/components/ZoneA/TimeWindowControl.tsx — simple segmented button
[CX] src/components/ZoneA/ClaimTooltip.tsx — positioned tooltip component
```
*Hand-off: Visual inspection required. Screenshot the landscape. If it looks like a random mess, iterate on force parameters before proceeding.*

**Phase 7 — Zone B [CX + CC]:**
```
[CX] Primitives first (all parallelizable):
    MetricRow.tsx, MethodologyTooltip.tsx, FrictionGauge.tsx, PersistenceBar.tsx,
    ExposureBar.tsx, SupplyChainTimeline.tsx, CoordinationCheck.tsx
    Codex context: Metric types + tooltip utils + Recharts/Tailwind
[CX] TopicOverviewVitals.tsx — composes primitives
[CC] VitalsPanel.tsx, ClaimVitals.tsx — orchestration + data flow + scroll layout
```

**Phase 8 — Zone C [CC + CX]:**
```
[CX] DivergenceHeatmap.tsx, SliceSelector.tsx, TypologyScores.tsx — presentational
    Codex context: Divergence/Slice/CompareData types + color utils
[CC] DivergencePanel.tsx — data orchestration
[CC] FullCompareMode.tsx — complex: splits Zone A, compresses Zone B, coordinates state
```

**Phase 9 — Zone D [CX]:**
```
[CX] EventCard.tsx, FilterChips.tsx, SignalsTimeline.tsx
    Codex context: NarrativeEvent type + EventType union + severity colors
    All 3 files can be generated in one Codex session.
```

**Phase 10 — Polish [CC]:**
```
[CX] src/components/shared/ — GreyedMetric, LowConfidence, InsufficientData, Sparkline
[CC] Animations, transitions — requires visual judgment
[CC] Final D3 tuning — iterative, can't be spec'd
[AG/Opus] Bulk code review — feed all component files for consistency check
    AG context: all src/components/**/*.tsx files + CLAUDE.md coding rules
```

---

## Verification Plan

1. **Data pipeline:** Run each script sequentially. Verify JSON output matches TypeScript types (write a quick validation script or spot-check).
2. **Embedding quality:** Before proceeding past cluster.py, manually inspect: do related claims cluster together? Compute a small similarity matrix and review.
3. **Frontend rendering:** `npm run dev` → Level 0 shows topic cards with all fields populated.
4. **Zone A:** Click a topic → landscape renders with colored nodes, visible clusters, arousal glow. Switch time windows → animation plays.
5. **Zone B:** Click a node → vitals update. Hover metrics → tooltips appear. Scroll → deep-dive content visible.
6. **Zone C:** Divergence heatmap renders. Typology scores are non-trivial. Slice selector changes data. Full Compare mode works and exits cleanly.
7. **Zone D:** Events display. Click an event → navigates to relevant claim. Filters work.
8. **Failure states:** Find a low-confidence claim → verify dimming. Find a non-contested topic → verify grey-out.
9. **The screenshot test:** Take a screenshot of Level 1 for a polarized topic. Does it look like a classified intelligence instrument? Would a VC understand it in 30 seconds?
10. **The methodology test:** Have someone drill into Layer 3 (hover everything in Zone B). Do they find real math (JSD values, typology scores, confidence intervals)?

---

## Critical Risks (System-Level)

| Risk | Detection | Recovery |
|------|-----------|----------|
| API keys unavailable for demo | Can't run ingest.py | Use `generate_synthetic.py` to create realistic demo data from scratch |
| Embedding quality poor | Similarity check fails in 2C | Prepend subject+assertion to text. Try `text-embedding-3-large` ($0.13/1M) |
| HDBSCAN produces garbage clusters | 1 cluster or all noise | Tune params. Fallback: KMeans with k=10 |
| D3 layout looks ugly | Visual inspection | Budget 4-6h tuning. Use UMAP positions as fixed initial positions. Add strong cluster attraction force |
| compute_metrics.py takes too long | >10 min for 3 topics | Profile. Pre-compute expensive operations. Cache intermediate results |
| Frontend state complexity explodes | Prop-drilling becomes unmaintainable | Extract to `useReducer` with typed actions |
| JSON files too large for frontend | >5MB per fetch | Split by time window (already done). Paginate claims. Aggregate small clusters |
