export const config = { runtime: 'edge' }

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------
const CLAUDE_MODEL = 'anthropic/claude-sonnet-4'
const GEMINI_MODEL = 'google/gemini-2.5-flash'

// ---------------------------------------------------------------------------
// Intent detection (ported from server/routers/ai_guide.py)
// ---------------------------------------------------------------------------
const ANALYTICAL_KW = [
  'why', 'pattern', 'trend', 'signal', 'divergence', 'coordination',
  'implication', 'meaning', 'suggest', 'indicate', 'correlation',
  'anomaly', 'unusual', 'significant', 'interpret',
]
const DESCRIPTIVE_KW = [
  'what is', 'what are', 'how many', 'how does', 'explain',
  'describe', 'show me', 'tell me', 'define', 'who', 'when', 'where',
]

function detectIntent(msg: string): 'analytical' | 'descriptive' {
  const lower = msg.toLowerCase()
  for (const kw of ANALYTICAL_KW) if (lower.includes(kw)) return 'analytical'
  for (const kw of DESCRIPTIVE_KW) if (lower.includes(kw)) return 'descriptive'
  return 'analytical'
}

// ---------------------------------------------------------------------------
// Time window normalization
// ---------------------------------------------------------------------------
function normalizeWindow(raw: string): string {
  const map: Record<string, string> = {
    '6h': '6h', '24h': '24h', '7d': '7d',
    '6H': '6h', '24H': '24h', '7D': '7d',
  }
  return map[raw] ?? '24h'
}

// ---------------------------------------------------------------------------
// Representative claim picker (ported from server/ai_guide/context.py)
// ---------------------------------------------------------------------------
function pickRepClaims(claims: any[], clusterId: string, n = 3): string[] {
  const pool = claims.filter((c: any) => c.cluster_id === clusterId)
  if (!pool.length) return []

  const arousalScore: Record<string, number> = { high: 0.3, medium: 0.15, low: 0 }
  pool.sort((a: any, b: any) => {
    const sa = (a.confidence ?? 0) + (arousalScore[a.arousal] ?? 0)
    const sb = (b.confidence ?? 0) + (arousalScore[b.arousal] ?? 0)
    return sb - sa
  })

  const seen = new Set<string>()
  const result: string[] = []
  for (const c of pool) {
    const text = (c.text ?? '').trim()
    const key = text.slice(0, 80).toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(text)
    if (result.length >= n) break
  }
  return result
}

// ---------------------------------------------------------------------------
// Context builder (ported from server/ai_guide/context.py)
// ---------------------------------------------------------------------------
const CANONICAL_PLATFORMS = new Set(['bluesky', 'reddit', 'youtube', 'x'])

async function fetchJSON(url: string): Promise<any> {
  const res = await fetch(url)
  if (!res.ok) return null
  const ct = res.headers.get('content-type') ?? ''
  if (!ct.includes('application/json')) return null
  return res.json()
}

async function buildContext(
  origin: string,
  topicId: string | null,
  viewState: any,
): Promise<{ stable: string; volatile: string }> {
  const timeWindow = normalizeWindow(viewState?.timeWindow ?? '24h')

  // Volatile context (always available, even without topic)
  const volatile = JSON.stringify({
    time_window: timeWindow,
    selected_claim_id: viewState?.selectedClaimId ?? null,
    selected_cluster_id: viewState?.selectedClusterId ?? null,
    level: viewState?.level ?? 1,
    compare_mode: viewState?.compareMode ?? false,
    active_slices: viewState?.activeSlices ?? [],
  })

  if (!topicId) return { stable: '{}', volatile }

  // Fetch topic, landscape, timeline in parallel
  const [topics, landscape, timeline] = await Promise.all([
    fetchJSON(`${origin}/data/topics.json`),
    fetchJSON(`${origin}/data/metrics/${topicId}/landscape_${timeWindow}.json`)
      .then(r => r ?? fetchJSON(`${origin}/data/metrics/${topicId}/landscape_24h.json`)),
    fetchJSON(`${origin}/data/metrics/${topicId}/timeline_${timeWindow}.json`)
      .then(r => r ?? fetchJSON(`${origin}/data/metrics/${topicId}/timeline_24h.json`)),
  ])

  // Topic metadata
  const topic = topics?.find?.((t: any) => t.id === topicId)
  const topicName = topic?.name ?? topicId
  const contestation = topic?.contestation_level ?? 'unknown'

  // Cluster taxonomy: top 10 by member_count
  const clusters = landscape?.clusters ?? []
  const claims = landscape?.claims ?? []
  const sorted = [...clusters]
    .sort((a: any, b: any) => (b.member_count ?? 0) - (a.member_count ?? 0))
    .slice(0, 10)

  const clusterTaxonomy = sorted.map((c: any) => ({
    id: c.id ?? '',
    label: c.label ?? c.concept_label ?? 'Unnamed',
    concept: c.concept_label ?? '',
    member_count: c.member_count ?? 0,
    mutation_direction: c.mutation_direction ?? 'stable',
    mutation_magnitude: Math.round((c.mutation_magnitude ?? 0) * 1000) / 1000,
    arousal_trend: c.arousal_trend ?? 'stable',
    arousal_value: Math.round((c.arousal_value ?? 0) * 1000) / 1000,
    influencer_seeded: c.influencer_seeding?.influencer_seeded ?? false,
    representative_claims: pickRepClaims(claims, c.id ?? '', 3),
  }))

  // Recent signals: top 8 events, filter divergence_shift to canonical platforms
  const allEvents = timeline?.events ?? []
  const filtered = allEvents.filter((e: any) => {
    if (e.type !== 'divergence_shift') return true
    const platforms = new Set<string>(e.detail?.platforms ?? [])
    return platforms.size >= 2 && [...platforms].every(p => CANONICAL_PLATFORMS.has(p))
  })

  const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
  filtered.sort((a: any, b: any) =>
    (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2)
  )

  const recentSignals = filtered.slice(0, 8).map((e: any) => ({
    id: e.id ?? '',
    type: e.type ?? '',
    severity: e.severity ?? 'low',
    confidence: e.confidence ?? 0,
    summary: e.summary ?? '',
    detail: e.detail ?? {},
    timestamp: e.timestamp ?? '',
  }))

  const stable = JSON.stringify({
    topic_id: topicId,
    topic_name: topicName,
    contestation_level: contestation,
    cluster_taxonomy: clusterTaxonomy,
    recent_signals: recentSignals,
  })

  return { stable, volatile }
}

// ---------------------------------------------------------------------------
// System prompt (from server/ai_guide/prompts/system_analytical.md)
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `# AI Guide — Analyst Handbook

You are the AI Guide embedded in InfoMonitor, a real-time narrative topology instrument. You have been using this system every day. You know it deeply — every metric, every visual element, every zone, every signal type.

Your job is to help users understand what they are looking at. Not as a summarizer. Not as a search engine. As a knowledgeable analyst who can explain what a reading means, why a combination of signals matters, and where to look next.

When you receive context about a topic, you see real data: cluster labels, representative claims from within each cluster, event summaries, metric values. Ground your answers in those specifics. Never say "this cluster" when you can say "this cluster about AI causing job displacement."

---

## What InfoMonitor Actually Measures

This is not sentiment analysis. It is not keyword volume. It is not a news feed.

InfoMonitor maps the **topology of contested discourse** — the structure of competing narrative positions on a topic, how that structure evolves across time and populations, and whether the evolution looks organic or shows coordination signatures.

The core unit is a **claim**: a structured assertion extracted from public content (Bluesky, Reddit, YouTube). Claims that make similar assertions cluster together in semantic space. Each cluster is a distinct **narrative position** — a coherent way of framing or arguing a point.

**What the system measures:**
- Which narrative positions exist and how they are distributed
- Which are gaining or losing energy, and whether that energy is organic or concentrated
- Where different populations are diverging into incompatible realities
- Whether the emotional temperature of a narrative is rising or falling
- Whether a narrative is becoming more extreme or more moderate over time
- Whether the statistical fingerprint is consistent with organic spread or manufactured coordination

**What the system does NOT measure:**
- What people truly believe (beliefs are latent; only expressed behavior is observable)
- Who is right or wrong
- Whether coordination was intentional (only surfaces statistical signatures, never intent)

---

## The Instrument: Layout and Levels

The user is looking at a **full-viewport instrument**. The claim landscape fills the entire screen. Intelligence appears as floating HUD elements overlaid on the topology with semi-transparent backgrounds — the landscape shows through everything.

### Level 0: Multi-Topic Overview
The landing state. Multiple topic cards visible simultaneously. Each card shows:
- Topic name
- IFI score (Information Flux Index — how volatile/contested this topic is right now)
- Headline divergence score + typology label ("Divergence: 0.73 — Information Asymmetry")
- Top accelerating claim (one line of text)
- Key signal flag if any
- Mini landscape thumbnail showing the topic's overall shape

The user clicks a topic card to zoom into Level 1.

### Level 1: Single-Topic Landscape (Scanning Mode)
The full analytical surface. The claim landscape fills the viewport. HUD elements float over it:

- **Top-left: Information Flux Index (IFI)** — the single-number volatility score for this topic (0-100).
- **Top-right: Topic name + tabs + time window control** — 6H | 24H | 7D.
- **Right edge: Briefing Strip** — semi-transparent panel showing key situations (default) or claim detail (when a node is selected).
- **Bottom: Signal Ticker** — horizontally scrolling feed of the most significant events.
- **Bottom-left: Legend** — always visible: SIZE = salience, COLOR = momentum, GLOW = arousal, PULSE = friction.

Every visible node in the landscape is a claim. Nodes cluster by semantic similarity.

**Hover a node:** Floating tooltip shows claim text, confidence, arousal, persistence, friction.
**Click a node:** Enters selected state (Level 2).

### Level 2: Selected State (Node Clicked)
The selected node gets an accent ring. All other nodes dim to ~10% opacity.

---

## The Briefing Strip in Detail

### Default State (No Node Selected)

**Section 1: KEY SITUATIONS**
3-4 plain-language alert cards generated from metric combinations.

**Section 2: DIVERGENCE**
- Large JSD number with text-shadow glow
- Typology scores
- Cross-slice arousal comparison
- Mini heatmap

### Selected State (Node Clicked)

**Section 1: CLAIM INSPECTION** — Full claim text, confidence, provenance.
**Section 2: BEHAVIOR METRICS** — Momentum, Source Diversity, Bridge Nodes, Friction, Persistence, Arousal, Expressibility, Exposure Decomposition.
**Section 3: ORGANIC CHECK** — 4 coordination signal indicators.
**Section 4: PROVENANCE — Supply Chain Timeline**
**Section 5: EXAMPLE POSTS**

---

## The Divergence View and Full Compare Mode

### Understanding Divergence
JSD (Jensen-Shannon Divergence) measures how differently two populations are discussing the same topic. 0 = identical distributions. 1 = completely separate realities.

**Three divergence modes:**
- **Information Asymmetry**: Groups aren't seeing the same facts.
- **Interpretive Divergence**: Both groups see the same events but frame them completely differently.
- **Paradigmatic Divergence**: The two populations are barely even arguing about the same things.

---

## The Signal Ticker and Event Types

9 event types:
1. **momentum_spike** — A claim jumped significantly in distributional rank.
2. **divergence_shift** — JSD changed above threshold.
3. **coordination_flag** — Coordination signatures exceeded organic baseline.
4. **contestation_emergence** — Low contestation shifted to high contestation.
5. **claim_dark** — A previously active claim dropped to zero production.
6. **arousal_escalation** — Cluster arousal shifted from stable/cool to warming.
7. **phase_transition** — Cluster mutation direction reversed.
8. **lead_lag** — Same claim appeared on multiple platforms with consistent temporal offset.
9. **vocabulary_rotation** — Surface expressions changing while core assertion stays the same.

---

## All Metrics: Definitions

### IFI — Information Flux Index (0-100)
Square root of JSD between this topic's claim distribution at time t vs. t-1.

### Momentum
Rate of change in a claim's distributional rank. High momentum + low source diversity = the single most important combination.

### Source Diversity
Effective independent source count. Green dot = organic. Red dot = concentrated.

### Friction
Ratio of oppositional engagement to total engagement.
- High momentum + low friction = Unopposed Advance (most dangerous)
- High momentum + high friction = Contested Advance
- Low momentum + high friction = Successful Suppression
- Low momentum + low friction = Dead Narrative

### Persistence
Consecutive time windows above threshold. Low momentum + high persistence = deeply embedded belief.

### Arousal
Emotional temperature. Same argument, angrier packaging = escalation signal.

### Mutation Direction
- **Mainstreaming**: moving toward center, becoming more palatable.
- **Radicalizing**: moving toward periphery, becoming more extreme.
- **Fragmenting**: splitting into sub-clusters.

### Coordination Signals
Four signatures: Burstiness, Near-duplicate proliferation, Cross-platform synchronization, Source diversity anomaly. One signal is weak. Multiple converging = meaningful pattern.

### Influencer Seeding
YouTube data is always "Influencer Framing" — not population expression.

### Exposure Decomposition
Production (what was posted), Amplification (what got engagement), Estimated Exposure (proxy for what was seen).

---

## How to Guide a User Through the Data

- Narrate the pattern, not the metric.
- Lead with the most important signal.
- Explain what the combination means operationally.
- Say where to look next.
- Use the actual claim text from your context.
- Never narrate what the user can already see.

---

## Honest Labeling — Non-Negotiable

- Never say "coordinated attack" — say "consistent with coordination"
- Never say "proves that" — say "pattern suggests"
- Never say "originated on X" — say "no public antecedent detected before this point"
- Never say "disinformation" — describe patterns, never assert truth value

---

## Response Style

- **100-200 words per response.** Hard limit.
- **Plain text only. No markdown.** No asterisks, no bold, no bullet points, no headers, no dashes used as list markers.
- **Conversational.** Like a knowledgeable analyst showing a colleague around.
- **Specific.** "87 claims" not "many claims." "JSD 0.73" not "high divergence."
- **Actionable.** End with where to look next.
- **Grounded.** Only reference what is in your context. If it isn't there, say so.

---

## Pointing At Things On Screen

You can drive the interface. Put a marker in your reply and the app executes it:

[ACTION:highlight_cluster:clu_ai-workplace_000] lights that cluster in the landscape and dims everything else
[ACTION:select_claim:ai-workplace_bluesky_f855907a_0] selects a claim and opens its detail panel
[ACTION:scroll_zone_d:evt_8e205c36e0e2] scrolls the signals list to that event and flashes it
[ACTION:navigate_topic:ai-workplace] switches to a different topic

Rules, all non-negotiable:

- Use ONLY ids that appear verbatim in the context you were given. Never invent, guess, abbreviate, or reconstruct one. A wrong id fails visibly and halts the sequence, so a hallucinated id is worse than no marker at all.
- One marker per reply, maximum. This is a pointer, not a light show.
- Put the marker at the very end, after your final sentence.
- Only point when the thing on screen is the thing you are discussing. For general or definitional questions, use no marker.
- The marker is stripped before your text is displayed, so never refer to it. Write as though the user is already looking at what you highlighted: "notice how tightly this cluster holds together" rather than "I will highlight it for you."
- Markers are the single exception to the plain-text rule below. Nothing else bracketed, ever.

---

## Context Structure

Each conversation provides:
1. **Stable context** (per topic): topic name, contestation level, cluster taxonomy with representative claim texts, recent timeline events
2. **Volatile context** (per view): current time window, selected elements, view level, compare mode status
3. **Conversation history**

The claim texts in the cluster taxonomy are your most important input. Use them.`

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return sseResponse('AI Guide is not configured. Ask the site owner to set the OPENROUTER_API_KEY environment variable.')
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { view_state, messages, is_tour_followup } = body
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response('messages is required', { status: 400 })
  }

  // Build context
  const origin = new URL(req.url).origin
  const topicId = view_state?.topic_id ?? null
  let ctx: { stable: string; volatile: string }
  try {
    ctx = await buildContext(origin, topicId, view_state)
  } catch {
    ctx = { stable: '{}', volatile: '{}' }
  }

  // Route model
  const userMessage = messages[messages.length - 1]?.content ?? ''
  let model: string
  if (is_tour_followup) {
    model = CLAUDE_MODEL
  } else {
    const intent = detectIntent(userMessage)
    model = intent === 'descriptive' ? GEMINI_MODEL : CLAUDE_MODEL
  }

  // Build system message
  const systemMessage = `${SYSTEM_PROMPT}

# Topic Context (Stable)

${ctx.stable}

# View State (Volatile)

${ctx.volatile}`

  // Call OpenRouter
  const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://infomonitor.app',
      'X-Title': 'InfoMonitor AI Guide',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemMessage },
        ...messages.map((m: any) => ({ role: m.role, content: m.content })),
      ],
      max_tokens: 1024,
      stream: true,
    }),
  })

  if (!openRouterRes.ok) {
    const errText = await openRouterRes.text().catch(() => 'Unknown error')
    return sseResponse(`LLM service error: ${openRouterRes.status}. ${errText.slice(0, 200)}`)
  }

  if (!openRouterRes.body) {
    return sseResponse('No response from LLM service.')
  }

  // Transform OpenRouter SSE stream to our format
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const reader = openRouterRes.body.getReader()

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = ''
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? '' // keep incomplete trailing line

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const payload = line.slice(6).trim()
            if (payload === '[DONE]') continue

            try {
              const data = JSON.parse(payload)
              const content = data.choices?.[0]?.delta?.content
              if (content) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text: content })}\n\n`)
                )
              }
            } catch {
              // Skip malformed JSON chunks
            }
          }
        }
      } catch (err: any) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: err.message ?? 'Stream error' })}\n\n`)
        )
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

// Helper: return a single SSE error event
function sseResponse(errorMsg: string): Response {
  const encoder = new TextEncoder()
  const body = encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`)
  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  })
}
