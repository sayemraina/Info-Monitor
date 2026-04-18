# Raw Source Feed — Level 0 Live Sources Heartbeat

**Status:** 🔷 DEFERRED (v2)

---

## Purpose

Show the system's INPUT below the existing DiscourseFeed ticker on Level 0. Everything above (topic cards, signal ticker, discourse feed) shows processed output. This section shows what the system is actually reading before it processes anything — building trust, proving liveness, and giving users a feel for each source's raw texture.

**Operating principle:** "Heartbeat monitor for each source — glanceable proof the system is alive, with just enough texture to understand what each source sounds like before the system processes it."

NOT competing with the intelligence above. This is a trust/liveness signal, not a dashboard.

---

## Position in Layout

```
┌─────────────────────────────────────────────────┐
│ SignalTicker (26px, event icons scrolling R→L)   │ ← existing
├─────────────────────────────────────────────────┤
│ DiscourseFeed (100px, post cards scrolling R→L)  │ ← existing
├─────────────────────────────────────────────────┤
│ RAW SOURCE FEED (NEW)                            │ ← add here
└─────────────────────────────────────────────────┘
```

---

## Layout: One Card Per Source Category, Horizontal

Cards sit side by side in a horizontal row, matching the horizontal visual language of SignalTicker and DiscourseFeed above.

### 7 Source Categories (from SystemBar.tsx SOURCE_CATEGORIES)

| # | Category | Sources | Data Status |
|---|---|---|---|
| 1 | **Social Platforms** | X (Twitter), Bluesky, YouTube | ✅ Have normalized JSON |
| 2 | **News & Media** | RSS Feeds (52 outlets), NewsAPI (30K+ publishers) | ✅ Have normalized JSON |
| 3 | **Think Tanks & Policy** | Brookings, Heritage, CAP, CSIS, CFR, RAND, Atlantic Council, AEI, Urban Institute, Cato, Carnegie, Hoover, EPI, New America, BPC, Peterson, ICG | ✅ Via RSS normalized JSON |
| 4 | **Economic Data** | FRED (8 series), Yahoo Finance, Polymarket | ⚠️ Need normalization |
| 5 | **Conflict & Events** | GDELT, ACLED | ⚠️ Need normalization |
| 6 | **Government** | Congress.gov, Federal Register, SEC EDGAR | ⚠️ Need normalization |
| 7 | **Digital Signals** | Wikipedia (edit activity), Cloudflare Radar (outages), WorldPop (population density) | ⚠️ Need normalization |

```
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────┬──────────┬──────────┐
│ 🗣 Social    │ 📰 News &   │ 🏛 Think     │ 📊 Economic  │ ⚔ Conflict│ 🏛 Gov   │ 📡 Digital│
│  Platforms   │  Media       │  Tanks       │  Data        │ & Events │          │  Signals │
│  3 sources   │  52+ outlets │  17 orgs     │  3 sources   │ 2 sources│ 3 sources│ 3 sources│
│──────────────│──────────────│──────────────│──────────────│──────────│──────────│──────────│
│ 𝕏 @user · 3m│ Breitbart    │ Brookings    │ FRED: CPI    │ GDELT    │ Congress │ Wikipedia│
│ "After six   │ "Fed says    │ "The future  │ 3.2% (+0.1)  │ 47 events│ H.R.1234 │ 12 edits │
│  years of    │  economy now │  of H-1B:    │              │ this week│ Immigration│ in 24h on│
│  PhD work.." │  needs..."   │  policy..."  │ Yahoo: $SPY  │          │ Reform Act│ "Gaza"   │
│ 👁 1.2K      │              │              │ +1.2% today  │          │          │          │
│  ↕ scroll    │  ↕ scroll    │  ↕ scroll    │  ↕ scroll    │ ↕ scroll │ ↕ scroll │ ↕ scroll │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────┴──────────┴──────────┘
```

---

## Per-Item Content (Minimal, Glanceable)

Each item within a card:
- **Who** — @username, outlet name, or data source identifier
- **What** — two lines of text (enough to understand the claim/data point, not just see it exists)
- **One reach signal** — the single most meaningful metric per source type:
  - X: 👁 views (reach)
  - Bluesky: ♡ likes (engagement)
  - YouTube: 👁 views (reach)
  - NewsAPI/RSS: outlet name IS the signal — no extra metric needed
  - Economic: the data point itself (CPI value, stock price)
  - Conflict: event count or severity
  - Government: bill/filing identifier
  - Digital: activity metric (edit count, outage status)
- Click → opens original URL in new tab

## Per-Card Header
- Category icon + name
- Volume badge (e.g., "297 posts", "52 outlets", "8 series") — proves active monitoring
- Vertically scrollable within card container

---

## Data Sources

### Currently available (normalized JSON):
Read from `/data/raw/{topicId}/normalized/*.json`:
- `x.json` — X/Twitter posts
- `bluesky.json` — Bluesky posts
- `newsapi.json` — NewsAPI articles
- `rss.json` — RSS feeds (includes think tanks)
- `youtube.json` — YouTube videos

Schema per item:
```json
{
  "id": "string",
  "source": "string",
  "source_type": "population | elite_media",
  "platform": "string",
  "content": "string",
  "title": "string | null",
  "author": "string",
  "timestamp": "ISO 8601",
  "url": "string",
  "engagement": { "likes": 0, "replies": 0, "shares": 0, "views": 0 },
  "metadata": { ... }
}
```

### Need normalization for v2:
- Economic data (FRED, Yahoo Finance, Polymarket)
- Conflict data (GDELT, ACLED)
- Government data (Congress.gov, Federal Register, SEC EDGAR)
- Digital signals (Wikipedia edits, Cloudflare Radar, WorldPop)

---

## Files to Create/Modify

- `src/components/Level0/RawSourceFeed.tsx` — NEW (~200 lines)
  - Seven source cards in a horizontal row (one per category)
  - SourceCard component: header (icon + name + count), scrollable item list
  - SourceItem component: author, 2-line text, one reach metric
  - Click item → open original URL in new tab
  - Refresh timestamp in section header
- `src/hooks/useRawSources.ts` — NEW (~100 lines)
  - Fetches normalized JSON from `/data/raw/{topicId}/normalized/`
  - Groups by source category (maps platform → category)
  - Sorts each group by timestamp (most recent first)
  - Returns `{ categoryGroups: Map<category, items[]>, lastRefresh: Date }`
- `src/components/Level0/Level0.tsx` — ADD RawSourceFeed below DiscourseFeed

---

## Build Estimate
~3-4 hours. Phase 1 covers the 5 existing data sources. Phase 2 (separate effort) normalizes economic/conflict/gov/digital sources.

## Verification
- Level 0 shows 7 category cards below DiscourseFeed
- Each card shows category icon, name, item count, and scrollable items
- Items show who + 2 lines of text + one reach metric
- Switching active topic updates all cards
- Click on item opens original URL in new tab
- Cards feel like heartbeat monitors — glanceable, not information-dense
