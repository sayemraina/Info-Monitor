# LEVEL 0 REDESIGN SPECIFICATION
## "World Monitor for Narratives" — Landing Page

*This document specifies the Level 0 (landing/overview) screen redesign. Level 1 (single-topic claim landscape) is UNCHANGED. This document does NOT replace the existing frontend — it specifies changes to the Level 0 screen only.*

---

## 1. DESIGN PHILOSOPHY

The user lands and sees a GEOGRAPHIC MAP filling most of the screen. Heat zones glow where narratives have high salience. Their first thought: "this is like World Monitor but for how people THINK, not what HAPPENS."

Everything on Level 0 is synced to ONE active topic at a time. The active topic auto-rotates every 15-20 seconds. The user can click any topic card to lock it and stop rotation. The map, discourse feed, YouTube videos, and signal ticker all update to reflect the active topic.

Every interactive component on Level 0 can drop the user into Level 1 for the relevant topic. Level 1 is the existing claim landscape / topology view — unchanged.

---

## 2. LAYOUT — VERTICAL STACK (top to bottom)

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. SYSTEM BAR (22px)                                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 2. GEOGRAPHIC NARRATIVE MAP (~50-55% of viewport height)         │
│    Search bar + sample topics floating on left side of map       │
│    Heat zones showing narrative salience by geography            │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ 3. YOUTUBE STRIP (full width, ~100-120px height)                 │
│    4-5 video cards horizontal, each: thumbnail + title +         │
│    channel + views                                               │
├──────────────────────────────────────────────────────────────────┤
│ 4. TOPIC CARDS (full width, 2-3 rows, 3-4 cards per row)        │
│    Each card: topic name, IFI, contestation, sparkline           │
│    Spanning: politics, business, finance, culture, tech          │
├──────────────────────────────────────────────────────────────────┤
│ 5. LIVE DISCOURSE FEED (full width, horizontal scroll R→L)       │
│    Actual posts from X/Reddit with platform icons + system tags  │
├──────────────────────────────────────────────────────────────────┤
│ 6. SIGNAL TICKER (26px, horizontal scroll R→L)                   │
└──────────────────────────────────────────────────────────────────┘
```

The page scrolls vertically if needed on smaller screens, but on a standard 1080p+ display, all 6 rows should be visible without scrolling.

---

## 3. COMPONENT SPECIFICATIONS

### 3A. System Bar (Row 1)

Identical to the existing system bar. No changes.
- Height: 22px
- Content: Platform status (X: LIVE, Reddit: LIVE, YT: CACHED), system confidence score, UTC clock
- Font: JetBrains Mono, 8.5px, low opacity
- Background: semi-transparent gradient fading to transparent

### 3B. Geographic Narrative Map (Row 2)

**THE HERO ELEMENT. Dominates the screen.**

- Full width, ~50-55% of viewport height
- Background: dark map tiles (Mapbox dark style, or similar). The map itself is dark-themed matching `#131F30`.
- Shows US map by default (can be toggled to world view if needed, but US is the default for the demo topics).

**Search bar (floating on map, top-left):**
- Position: top-left corner of the map, floating with semi-transparent background
- Contains: text input "Search topics..." with subtle border
- Below the search input: vertical list of sample/available topics as clickable text links
- Each topic shows: topic name, a small colored dot indicating activity level
- Clicking a topic in this list → locks that topic as active (map, feed, YT all update) AND does NOT navigate to Level 1. It just syncs Level 0 to that topic.
- Double-clicking a topic OR clicking a "→" arrow next to it → navigates to Level 1
- Semi-transparent dark background (`rgba(19,31,48,0.85)`) so the map is visible behind it
- Width: ~200-220px
- Style: World Monitor's search panel aesthetic

**Heat zones on the map:**
- For the active topic, show colored regions/circles where that topic's narratives have the highest salience
- Each heat zone corresponds to a geographic region where a particular narrative cluster is dominant
- Color: matches the cluster's momentum color (red = accelerating, amber = mid, teal = decelerating, blue = declining)
- Intensity: proportional to salience (brighter = more dominant)
- The most active zones pulse gently (subtle opacity oscillation, ~2s cycle)
- Hover a heat zone → tooltip showing: cluster name, dominant narrative text (truncated), momentum value, salience score

**Heat zone data source:**
- For the demo: pre-computed JSON file per topic mapping narrative clusters to geographic regions
- Structure: `{ topic_id, cluster_id, regions: [{ lat, lng, radius, salience, cluster_label }] }`
- Geographic proxies: derived from subreddit names (r/Texas, r/nyc, r/europe), hashtag geography, user bio locations
- For production: updated with each batch run

**Click a heat zone → navigates to Level 1** for that topic, with the corresponding cluster pre-highlighted in the claim landscape.

**Map transitions on topic rotation:**
- When the active topic changes (auto-rotation or user click), heat zones animate:
  - Old topic's zones fade out (300ms)
  - New topic's zones fade in (300ms)
  - The transition itself demonstrates liveness — the map is ALWAYS moving

**Map library:** Use Mapbox GL JS (free tier: 50K map loads/month) or Leaflet with dark tiles. Mapbox preferred for visual quality and smooth animations. Dark style: `mapbox://styles/mapbox/dark-v11` or custom style matching `#131F30`.

### 3C. YouTube Strip (Row 3)

**Full-width horizontal row of video cards for the active topic.**

- Height: ~110-130px (enough for a thumbnail + 2 lines of text below)
- Background: slightly darker than main background (`rgba(12,18,28,0.6)`) with subtle top/bottom borders
- Contains: 4-5 video cards arranged horizontally with small gaps between them
- If more than 5 videos, subtle horizontal scroll arrows appear at edges
- Videos swap with a crossfade (200ms) when the active topic changes

**Each video card:**
```
┌─────────────────────────────┐
│ ┌─────────────────────────┐ │
│ │ ▶    [thumbnail image]  │ │
│ │      from YouTube API   │ │
│ └─────────────────────────┘ │
│ "Why border security is the │
│  defining issue of 2026..." │
│ Fox News · 124K views · 3d  │
└─────────────────────────────┘
```

- Thumbnail: YouTube video thumbnail image (available via YouTube Data API or constructed from video ID: `https://img.youtube.com/vi/{VIDEO_ID}/mqdefault.jpg`)
- Play button overlay on thumbnail (centered, semi-transparent circle with triangle)
- Video title: 1-2 lines, truncated with ellipsis. Font: Inter, 10-11px, white 80% opacity
- Channel name + view count + time ago: JetBrains Mono, 8px, dim
- Click thumbnail → video plays in a centered overlay/modal (iframe embed) with a semi-transparent backdrop. The overlay includes a "View topic analysis →" link that navigates to Level 1.
- Do NOT autoplay any video. Click-to-play only.

**Data source:**
- The system already ingests YouTube videos per topic. Each topic's data includes video IDs, titles, channel names.
- For the demo: store video metadata in the topic JSON (video_id, title, channel_name, view_count, published_at)
- Thumbnails are loaded directly from YouTube's image CDN (no API call needed): `https://img.youtube.com/vi/{VIDEO_ID}/mqdefault.jpg`

### 3D. Topic Cards (Row 4)

**Full-width grid of topic cards. 3-4 cards per row. 2-3 rows as needed.**

- Cards span diverse categories: politics, business, finance, culture, tech, science
- The grid accommodates as many topics as the system monitors
- Layout: CSS grid, 3-4 columns, auto rows. Gap: 8-10px.
- Each row should NEVER have more than 4 cards. If there are 10 topics, that's 3 rows of 3-4.

**Each topic card:**
```
┌──────────────────────────────┐
│ Immigration Policy           │
│ IFI: 16.5  HIGH CONTESTATION │
│ ┄┄┄┄┄┄╱╲┄┄╱╲┄╱╲┄ (sparkline)│
│ Top signal: "Border sec..."  │
└──────────────────────────────┘
```

- Topic name: Inter, 12-13px, semi-bold, white 85% opacity
- IFI score: JetBrains Mono, bold, colored by severity (red > 30, amber 15-30, green < 15)
- Contestation level: JetBrains Mono, 8px, uppercase
- Activity sparkline: tiny SVG, 60-80px wide, showing activity over last 24h. Cyan.
- Top signal: one-line preview of the highest-severity situation for this topic, truncated. 9px, dim.
- Active topic card: accent border (`#E94560`), subtle glow/shadow
- Inactive cards: very subtle border (`rgba(148,163,184,0.06)`)
- Background: `rgba(255,255,255,0.015)` with hover effect (border brightens, subtle lift)

**Interactions:**
- Click a topic card → locks that topic as active. Map, YT, discourse feed all sync to it. Auto-rotation stops.
- Click the already-active topic card → navigates to Level 1 for that topic
- OR: each card has a small "→" or "View details ›" affordance that explicitly navigates to Level 1

### 3E. Live Discourse Feed (Row 5)

**Full-width horizontal scrolling feed of actual social media posts for the active topic.**

- Height: ~90-110px
- Background: slightly darker strip with subtle top border
- Posts scroll RIGHT TO LEFT continuously (same direction as signal ticker below)
- Scroll speed: moderate, readable but clearly moving. ~1px per frame.
- Posts transition with crossfade (200ms) when the active topic changes

**Each post card (inline in the horizontal scroll):**
```
┌────────────────────────────────────────┐
│ 🐦  @username · just now               │
│ "Border security is a fundamental      │
│  sovereign right and must be..."       │
│ → Border Security cluster · 🔥 high    │
└────────────────────────────────────────┘
```

- Platform icon: X logo or Reddit logo (small, colored)
- Username: anonymized or display name. JetBrains Mono, 8px, dim.
- Timestamp: "just now", "2 min ago", "5 min ago". JetBrains Mono, 8px, dim.
- Post text: 2-3 lines, truncated. Inter, 10px, white 75% opacity.
- System tag: colored badge showing what the system detected:
  - "→ Border Security cluster" (cluster assignment, cyan)
  - "🔥 arousal: high" (arousal flag, red)
  - "⚠ near-duplicate ×47" (coordination signal, amber)
  - "↗ radicalizing" (mutation direction, red)
- Post card width: ~280-320px. Multiple cards visible at once.
- Each card has subtle left border colored by the detected signal severity

**Click a post card → navigates to Level 1** for that topic, with the corresponding claim node pre-selected in the landscape.

**Data source for demo:**
- The system already has extracted claims with platform source, text, cluster assignment, arousal, coordination flags
- For the demo: replay cached posts with simulated timestamps. Create a JSON array of posts per topic, each with: platform, username (anonymized), text, cluster_id, system_tags[], original_timestamp
- The feed replays these with randomized "just now" / "X min ago" timestamps to simulate liveness
- Posts are drawn from the actual extraction output — real content, real system classifications

### 3F. Signal Ticker (Row 6)

Identical to the existing signal ticker. No changes except:
- Scrolls RIGHT TO LEFT (same direction as discourse feed above it)
- Only shows events for the ACTIVE topic (filters by topic when synced)
- When topic rotates, ticker updates to show that topic's events

---

## 4. TOPIC SYNC SYSTEM

**The core behavior: one topic drives everything.**

### State:
```typescript
interface Level0State {
  activeTopic: string;        // topic ID currently driving all components
  isLocked: boolean;          // true if user manually selected a topic
  rotationTimer: number;      // countdown to next auto-rotation (15-20s)
}
```

### Auto-rotation:
- On page load, start with the topic that has the highest IFI score
- Every 15-20 seconds, rotate to the next topic (ordered by IFI descending, so most active topics get shown first)
- Rotation pauses when user hovers over any interactive component (map, feed, YT, cards)
- Rotation stops entirely when user clicks a topic card to lock

### Sync behavior:
When `activeTopic` changes (by rotation or user click):
1. Map: heat zones crossfade (old fade out 300ms, new fade in 300ms)
2. YouTube strip: video cards crossfade (200ms)
3. Discourse feed: current posts fade, new topic's posts begin flowing (200ms transition)
4. Signal ticker: filters to active topic's events
5. Topic cards: active card gets accent border, previous card loses it
6. Search sidebar: active topic highlighted in the list

### Locking:
- Click any topic card → `isLocked = true`, `activeTopic = clicked topic`
- Click the already-active (locked) topic card → navigate to Level 1
- Click a different topic card while locked → switch lock to new topic
- To unlock: click a small "⟳ Auto" button near the topic cards, or wait 60 seconds of inactivity

---

## 5. NAVIGATION TO LEVEL 1

**Every component provides a path to Level 1.** The transition carries topic context.

| Action | Navigates to |
|--------|-------------|
| Click heat zone on map | Level 1, that topic, corresponding cluster pre-highlighted |
| Double-click topic in search sidebar | Level 1, that topic |
| Click already-active topic card | Level 1, that topic |
| Click "→" on any topic card | Level 1, that topic |
| Click a post in discourse feed | Level 1, that topic, corresponding claim node pre-selected |
| Click a signal event in ticker | Level 1, that topic, corresponding claim/cluster focused |
| Click "View topic analysis →" on YT overlay | Level 1, that topic |

**Transition animation:** The map zooms into the active topic's geographic center, then crossfades into the Level 1 claim landscape. 400-500ms total. This transition is cinematic — geographic view → topological view. You go from "where narratives live" to "what narratives are and how they relate."

---

## 6. DATA REQUIREMENTS

### New data needed (not currently in the pipeline):

**Geographic narrative data (per topic):**
```json
{
  "topic_id": "immigration-policy",
  "geo_clusters": [
    {
      "cluster_id": "border-security",
      "cluster_label": "Border Security",
      "regions": [
        { "lat": 31.9, "lng": -106.4, "radius_km": 200, "salience": 0.82, "momentum": 0.68 },
        { "lat": 32.2, "lng": -110.9, "radius_km": 150, "salience": 0.65, "momentum": 0.54 }
      ]
    }
  ]
}
```

**How to generate for demo:** Create a `scripts/compute_geo.py` script that:
1. Reads extracted claims with source metadata
2. Maps subreddit names to approximate geographic centers (maintain a lookup table: r/Texas → 31.0, -100.0, r/nyc → 40.7, -74.0, r/LosAngeles → 34.0, -118.2, etc.)
3. Maps X hashtag geography where available
4. Aggregates salience per cluster per geographic region
5. Outputs `data/geo/{topic_id}.json`

For demo purposes, this can be partially hand-curated. 15-20 subreddit → location mappings cover the major US regions.

**YouTube video metadata (per topic):**
```json
{
  "topic_id": "immigration-policy",
  "videos": [
    {
      "video_id": "abc123",
      "title": "Why border security is the defining issue of 2026",
      "channel_name": "Fox News",
      "view_count": 124000,
      "published_at": "2026-03-11T14:00:00Z"
    }
  ]
}
```

This data should already exist from the YouTube ingestion pipeline. Just needs to be formatted and included in the topic JSON.

**Discourse feed posts (per topic):**
```json
{
  "topic_id": "immigration-policy",
  "feed_posts": [
    {
      "platform": "x",
      "username": "user_anon_482",
      "text": "Border security is a fundamental sovereign right and must be enforced...",
      "cluster_id": "border-security",
      "system_tags": ["→ Border Security cluster", "🔥 arousal: high"],
      "extracted_at": "2026-03-14T08:23:00Z"
    }
  ]
}
```

This is a subset of the extracted claims, reformatted for the feed display. Create from existing extraction output.

---

## 7. VISUAL DESIGN

All design follows the existing app's visual language:
- Background: `#131F30`
- Font: JetBrains Mono for data values, Inter for labels
- Accent: `#E94560` for active states
- Cyan: `#06B6D4` for sparklines, system info
- Color semantics for momentum, arousal, mutation — same as Level 1

**Map-specific:**
- Map tiles: dark style matching `#131F30` (Mapbox `dark-v11` or custom)
- Heat zones: colored circles/polygons with the cluster's momentum color
- Pulsing: subtle opacity oscillation on the most active zones
- Search sidebar: semi-transparent dark background, map visible behind it

**YouTube strip:**
- Slightly darker background band: `rgba(12,18,28,0.6)`
- Subtle top/bottom borders: `rgba(148,163,184,0.04)`
- Thumbnails have subtle rounded corners (4px)

**Topic cards:**
- Background: `rgba(255,255,255,0.015)`
- Border: `1px solid rgba(148,163,184,0.06)`
- Active border: `1px solid rgba(233,69,96,0.4)` with subtle glow
- Hover: border brightens, subtle shadow lift

**Discourse feed:**
- Darker background band
- Post cards: subtle left border colored by signal severity
- Platform icons: X and Reddit recognizable icons/logos, small

---

## 8. IMPLEMENTATION APPROACH

This is an ADDITION to Level 0, not a rewrite of the entire app. Level 1 is unchanged. The data pipeline is unchanged. The metrics engine is unchanged.

**What changes:**
- `src/components/Level0/` — the landing page components
- New components: `NarrativeMap.tsx`, `YouTubeStrip.tsx`, `DiscourseFeed.tsx`, `TopicSync.tsx`
- New hook: `useTopicSync.ts` — manages active topic, rotation, locking
- New data: `data/geo/*.json`, YouTube metadata in topic JSON, feed posts in topic JSON

**What does NOT change:**
- Level 1 (TopicView, ClaimLandscape, all zones)
- Data pipeline (ingest, extract, embed, cluster, compute_metrics)
- Types, hooks for Level 1, utils
- CLAUDE.md (except adding this doc to Reference Docs)

**New dependencies:**
- `mapbox-gl` or `react-map-gl` for the geographic map (npm package)
- Mapbox access token (free tier: 50K loads/month — more than enough for demo + early users)

---

## 9. DEMO DATA STRATEGY

For the demo with cached data, simulate liveness:

**Discourse feed:** Replay cached posts with randomized timestamps. Create a pool of 30-50 posts per topic from the extraction output. The feed cycles through them, assigning "just now", "1 min ago", "3 min ago" etc. New posts "appear" at the left edge every 5-10 seconds. This creates the illusion of real-time ingestion.

**Map heat zones:** Static for demo (pre-computed geographic salience). The pulsing animation on active zones creates the feeling of liveness even though the data is static.

**YouTube videos:** Real video IDs from the YouTube ingestion. Thumbnails load from YouTube CDN. These are genuinely real and current.

**Signal ticker:** Same as current — replays cached events with the topic filter applied.

**Auto-rotation:** The topic cycling itself creates movement and liveness. Every 15-20 seconds the entire screen transforms — map zones shift, videos change, posts change. Movement = alive.

---

## 10. WHAT THIS ACHIEVES

A user from X lands on this page and sees:

1. **A map with glowing hotspots** (familiar from World Monitor, immediately understandable)
2. **Heat zones labeled with NARRATIVE names** (not conflict names — "Border Security", "Immigration Reform")
3. **Social media posts flowing through** (proof the system is alive and ingesting real data)
4. **YouTube videos from real channels** (familiar format, recognizable names)
5. **Topic cards across multiple domains** (this monitors more than just politics)

Their first thought: **"This is World Monitor but for narratives."** That's the hook.

Every element on screen can drop them into Level 1, where they see the full claim topology, divergence analysis, coordination signals, and all the depth we've built. Level 0 is the storefront. Level 1 is the product.
