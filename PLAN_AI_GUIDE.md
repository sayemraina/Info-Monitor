# AI Guide — Contextual Reactive Navigation

**Status:** 🔷 DEFERRED (v2)

---

## Purpose

A reactive, contextual AI inside the system that detects where the user is spending time, pops in to offer guidance, takes them to relevant sections, and helps them understand what they're looking at. Makes the visual instrument accessible to anyone, not just analysts.

**NOT a chatbot.** NOT prescriptive. The AI doesn't decide what's important — it waits for the user, detects their interest, and guides them deeper into what they're already looking at.

---

## Core Behavior

1. **Detects where the user is spending time** (which topic, which zone, which cluster)
2. **Offers to help** — small unobtrusive prompt appears after user dwells for a few seconds
3. **When engaged, guides the user** — explains what they're looking at, answers questions, navigates to relevant sections
4. **Once at a destination, helps understand** — provides context for the metrics, clusters, and signals visible on screen

---

## User Flow Example

```
User lands on Level 0, browses topic cards
→ Clicks into "Immigration & American Identity" (Level 1)
→ Spends 5 seconds looking at the landscape
→ Small AI prompt fades in at bottom-right:
   "I can help you navigate this landscape. Want me to walk you through
    what's happening here?"
   [Yes, guide me] [Dismiss]

User clicks [Yes, guide me]:
→ AI panel slides in from right (or bottom):
   "This landscape shows 19 narrative clusters around immigration.
    The most active cluster right now is Border Security — it has
    43 pro vs 31 anti claims, making it the most contested.

    I also see a coordination signal — want me to show you?"
    [Show me the coordination signal] [What does 'contested' mean?]

User clicks [Show me the coordination signal]:
→ App highlights the relevant cluster (glow/pulse animation)
→ Zone D scrolls to the coordination event
→ AI panel updates:
   "This cluster has 3 accounts that posted nearly identical
    claims within 4 minutes. Organic spread for this topic
    typically takes 2-6 hours. The system flagged this as
    'consistent with coordination' — it doesn't assert intent,
    just surfaces the statistical anomaly for your judgment."
```

---

## Architecture

```
                    ┌──────────────────┐
                    │  AI Guide Panel  │
                    │  (React component)│
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  useAIGuide hook  │
                    │  - dwell detection│
                    │  - context builder│
                    │  - action parser  │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌──────────────┐ ┌──────────┐ ┌──────────────┐
     │ Claude API   │ │ App State│ │ Data Context  │
     │ (via server  │ │ (navigate│ │ (topics.json, │
     │  proxy)      │ │  highlight│ │  events.json, │
     │              │ │  select) │ │  clusters)    │
     └──────────────┘ └──────────┘ └──────────────┘
```

### Dwell Detection
- Track which Level (0/1/2), which topic, which zone the user is in, and how long they've been there
- After configurable threshold: 5s on first visit, 10s on return visits
- Show the offer prompt (small bubble, bottom-right)
- Dismiss behavior: don't re-prompt in same session

### Context Builder
When user engages, gather:
- Current topic's summary (from topics.json)
- Top 3 signals by severity (from events.json)
- Cluster data for the visible landscape (from clusters.json)
- Currently selected claim if any
- ~1-2K tokens of structured context

### Action System
Claude responds with mixed text + structured actions:
```json
{
  "message": "This cluster has unusual coordination signals...",
  "actions": [
    {"type": "highlight_cluster", "clusterId": "clu_immigration_003"},
    {"type": "scroll_zone_d", "eventType": "coordination_flag"}
  ]
}
```

Action types:
- `highlight_cluster` — glow/pulse animation on a specific cluster in Zone A
- `navigate_topic` — switch to a different topic
- `scroll_zone_d` — scroll Zone D to a specific event type
- `select_claim` — select a specific claim in the landscape

React executes actions while displaying the message.

### Server Proxy
`server/ai_guide.py` — FastAPI endpoint proxying Claude API calls to avoid exposing API key in frontend. Accepts context + user message, returns streamed response.

---

## What Makes This NOT Just a Chatbot

1. **Reactive, not prescriptive** — AI waits for the user, doesn't push opinions
2. **Spatial** — AI can highlight, navigate, point to specific visual elements
3. **Contextual** — AI knows exactly what's on screen and what the data says
4. **Educational** — helps users build intuition about the instrument over time
5. **Transparent** — uses the same honest labeling as the system ("consistent with coordination", not "coordinated attack")

---

## Files to Create/Modify

- `src/components/AIGuide/AIGuidePanel.tsx` — NEW (~200 lines)
  - Floating panel with chat messages + action buttons
  - Minimized state: small prompt bubble
  - Expanded state: scrollable conversation with suggested actions
- `src/components/AIGuide/AIGuidePrompt.tsx` — NEW (~60 lines)
  - The small "Want me to help?" bubble that appears on dwell
- `src/hooks/useAIGuide.ts` — NEW (~200 lines)
  - Dwell detection (tracks user position + time)
  - Context builder (assembles data for Claude)
  - API call management (streaming responses)
  - Action parser + dispatcher
- `src/utils/aiGuideActions.ts` — NEW (~80 lines)
  - Action type definitions
  - Action executor (calls into App state: navigate, highlight, select)
- `src/utils/aiGuideContext.ts` — NEW (~100 lines)
  - Builds structured context from current app state + data files
  - System prompt with personality (helpful, honest, non-prescriptive)
- `server/ai_guide.py` — NEW (~60 lines)
  - FastAPI endpoint proxying Claude API
  - Accepts context + message, streams response
- `src/App.tsx` — ADD AIGuidePanel + action listener integration

---

## Build Sequence

### Phase 1: Dwell Detection + Prompt (~2 hours)
- Implement dwell tracking in useAIGuide
- Create the small bubble prompt ("Want me to help?")
- Wire into App.tsx
- Verify: bubble appears after dwelling on Level 1 landscape

### Phase 2: Context + API (~4 hours)
- Build context assembler from current app state + data
- Create server proxy endpoint
- Implement streaming chat in AIGuidePanel
- Verify: AI responds with relevant context about current topic

### Phase 3: Navigation Actions (~3 hours)
- Define action types (highlight_cluster, navigate_topic, scroll_zone, select_claim)
- Implement action parser for Claude responses
- Wire action executor into App state
- Verify: clicking "[Show me]" navigates and highlights correctly

### Phase 4: Polish (~2 hours)
- Suggested action buttons based on current context
- Smooth transitions for panel open/close
- Dismiss behavior (don't re-prompt for same session)
- Error handling (API failures, empty responses)

---

## Build Estimate
~11 hours total across 4 phases.

## Verification
- Dwelling on Level 1 landscape shows help prompt after 5s
- Clicking "Yes" opens AI panel with topic context
- AI correctly describes what's on screen
- "[Show me]" buttons navigate to correct clusters/events
- AI uses honest labeling (consistent with system's epistemic philosophy)
- Dismissing doesn't re-prompt in same session
