# INFOMONITOR DATA SOURCES SPECIFICATION
## 34 Sources — Final, Zero Fat

*Every source earns its place. No redundancy within category.*

---

## ARCHITECTURAL CONTEXT

Two parallel topologies in a shared embedding space:

**Topology A — Population Discourse:** Claims from social media where ordinary people express beliefs.

**Topology B — Elite/Institutional Discourse:** Claims from news, think tanks, policy docs.

Divergence between topologies = high-value output: "elites say X, populations express Y, gap growing."

Every claim carries `source_type`: `population`, `elite_media`, `think_tank`, `government`, `prediction_market`, `event_signal`.

**Extraction Pipeline:** Gemini Flash first-pass, Claude Sonnet for low-confidence refinement.

---

## POPULATION DISCOURSE (Topology A) — 8 sources

### 1. Bluesky (AT Protocol API)
**Why:** Fully open API, ~25M+ users. Best accessible source for real-time public opinion. Firehose available.
**Take:** Public posts by keyword/hashtag. Author, text, timestamp, engagement, reply threads.
**Feeds system:** `source_type: population`, `platform: bluesky`. Engagement feeds exposure decomposition. Replies inform friction. Firehose = real-time.
**API:** Free. No rate limits at our volume.

### 2. Reddit (Data API)
**Why:** 500M+ MAU. Community structure = population segmentation. Subreddits = geographic/demographic proxies.
**Take:** Posts + top comments from topic subreddits. Subreddit, author, text, upvote ratio, timestamp.
**Feeds system:** `source_type: population`, `platform: reddit`, `community: {subreddit}`. Subreddit metadata feeds geographic map. Upvotes inform friction.
**API:** Free tier (100 QPM). $0.24/1K calls at scale.

### 3. Rumble
**Why:** Right-wing/conservative discourse. Without it, Topology A skews left. Critical for immigration, DEI, AI.
**Take:** Video titles, descriptions, channels, view counts, comments.
**Feeds system:** `source_type: population`, `platform: rumble`. Channels feed Narrative Shapers on Level 0.
**API:** rumble.com/api/v0/ (key from contact). Apify scrapers as alternative.

### 4. Mastodon (ActivityPub API)
**Why:** Fully open. ~1.5M MAU. Tech/privacy/academic/left-leaning.
**Take:** Public posts from relevant instances/hashtags. Author, instance, text, boosts, timestamp.
**Feeds system:** `source_type: population`, `platform: mastodon`, `instance: {name}`.
**API:** Free per-instance REST API.

### 5. Telegram Public Channels
**Why:** Major for geopolitics, conflict, crypto. Often LEADS mainstream platforms.
**Take:** Messages from curated public channels. Channel, text, views, forwards, timestamp.
**Feeds system:** `source_type: population`, `platform: telegram`. Forwards = amplification. Lead-lag detection.
**API:** Web-accessible without auth. Bot API free.

### 6. YouTube (Data API)
**Why:** Video = major narrative vehicle. Already in pipeline for Level 0 Narrative Shapers.
**Take:** Video metadata (titles, descriptions, views, comments), channel info, trending per topic. Thumbnails.
**Feeds system:** `source_type: population`, `platform: youtube`. Tag all "Source: YouTube (influencer framing)."
**API:** Free tier 10K units/day. Thumbnails: img.youtube.com/vi/{ID}/mqdefault.jpg.

### 7. Truth Social
**Why:** ONLY platform for MAGA/right-wing TEXT discourse. Rumble covers video; Truth Social = political text posts.
**Take:** Public posts from prominent accounts + topic hashtags. Author, text, engagement, timestamp.
**Feeds system:** `source_type: population`, `platform: truth_social`.
**API:** No official API. Use: Apify scrapers, ScrapeCreators (REST, pay-as-you-go), Stanford truthbrush. Public viewing limited to prominent accounts without auth. Scraping = standard practice.

### 8. X/Twitter
**Why:** Highest velocity discourse. API expensive — use third-party alternatives.
**Take:** Posts by keyword, engagement, author metadata.
**Feeds system:** `source_type: population`, `platform: x`.
**API:** Official $100/mo Basic. Alternatives: Netrows ($49/mo), TwitterAPI.io, Data365. For launch use LLM bridge; prioritize Bluesky/Reddit.

**Optional:** Lemmy — open federated Reddit alternative. Fully open API. Small but zero gatekeeping.

---

## ELITE/INSTITUTIONAL DISCOURSE (Topology B) — 11 sources

### 9. Curated RSS Feeds (100-200 outlets)
**Why:** Free, zero legal issues. Backbone of Topology B.
**Take:** Headlines, article text, outlet name, timestamp, author, URL.
**Feeds system:** `source_type: elite_media`, `outlet: {name}`. Build across spectrum: NYT, WSJ, Fox, CNN, AP, Reuters, BBC, Al Jazeera, Breitbart, The Intercept, etc.
**API:** Standard RSS/Atom. Free. Poll every 10-30 min.

### 10. Perigon (AI-Enriched News API)
**Why:** 150K+ sources, AI pre-tagged (sentiment, entities, topics). Reduces extraction cost. Affordable per SV contact.
**Take:** Enriched articles + full text for our extraction.
**Feeds system:** `source_type: elite_media`. Pre-enrichment supplements pipeline.
**API:** REST with SDKs. Free monthly datasets on GitHub.

### 11. NewsAPI.ai
**Why:** Alternative/backup to Perigon. Strong free tier. Ranked #1 in independent comparisons. Insurance if Perigon has gaps.
**Take:** Categorized articles with metadata.
**Feeds system:** `source_type: elite_media`. CC evaluates Perigon vs NewsAPI.ai head-to-head.
**API:** Free tier available.

### 12. Brookings Institution (RSS)
**Why:** Centrist DC think tank. Establishment/moderate baseline.
**Take:** Research, briefs, commentary via RSS.
**Feeds system:** `source_type: think_tank`, `institution: brookings`.
**API:** Free RSS.

### 13. Heritage Foundation (RSS)
**Why:** Conservative think tank. Project 2025. Conservative policy establishment.
**Take:** Research, commentary, recommendations via RSS.
**Feeds system:** `source_type: think_tank`, `institution: heritage`.
**API:** Free RSS.

### 14. Center for American Progress (RSS)
**Why:** Progressive think tank. Progressive policy establishment.
**Take:** Policy analysis, commentary via RSS.
**Feeds system:** `source_type: think_tank`, `institution: cap`.
**API:** Free RSS.

### 15. CSIS (RSS)
**Why:** Bipartisan security/defense. Strong on AI, cyber, geopolitics.
**Take:** Research, commentary via RSS.
**Feeds system:** `source_type: think_tank`, `institution: csis`.
**API:** Free RSS.

### 16. Council on Foreign Relations (RSS + Conflict Tracker)
**Why:** Preeminent foreign policy. Foreign Affairs magazine. Conflict Tracker for ~30 conflicts.
**Take:** Commentary via RSS. Tracker status changes (worsening/stabilizing/unchanging).
**Feeds system:** `source_type: think_tank`, `institution: cfr`. Status changes = event signals.
**API:** Free RSS. Tracker via web.

### 17. RAND Corporation (RSS)
**Why:** Nonpartisan defense/health/education/tech. Government-influential.
**Take:** Research, commentary via RSS.
**Feeds system:** `source_type: think_tank`, `institution: rand`.
**API:** Free RSS.

### 18. Atlantic Council DFRLab (Research + FIAT)
**Why:** Disinformation research. FIAT tracks foreign interference with credibility scoring. Ground truth for coordination detection.
**Take:** Research on influence ops. FIAT entries with attribution scores, actors.
**Feeds system:** `source_type: think_tank`, `institution: dfrlab`. FIAT = ground truth for our coordination detection validation.
**API:** Research via RSS/web. FIAT interactive and open.

### 19. Think Tank Alert
**Why:** Monitors 82 think tanks, 92K+ articles. Unique signal: INSTITUTIONAL CONVERGENCE. When 5 think tanks publish on same topic in one week = elite consensus forming. Individual feeds can't provide this.
**Take:** Trending topics across ecosystem. Citation patterns. Convergence signals.
**Feeds system:** `source_type: think_tank`.
**API:** Web-accessible. May need data access arrangement.

---

## EVENT/CONTEXT SIGNALS — 13 sources

### 20. GDELT Events
**Why:** Real-time global news events. Every country, every language. "What's happening now."
**Take:** Event records (actor, action, target, location, tone), geographic anchoring, themes.
**Feeds system:** `source_type: event_signal`. Context triggers — protest in Texas = narrative acceleration in Immigration.
**API:** Free REST. Updates every 15 min. No auth.

### 21. GDELT Doc API
**Why:** Article-level news analysis from world's largest news database. Different from GDELT Events — analyzes HOW media covers events (tone, themes, entities per article). Free insurance on most critical data layer alongside Perigon.
**Take:** Article tone scores, theme codes, entity mentions, source attribution, geographic tags.
**Feeds system:** `source_type: elite_media`. Supplements Perigon. Two article analysis sources = redundancy on critical layer. Free.
**API:** Free REST. No auth. Billions of articles.

### 22. ACLED
**Why:** Every protest, riot, strike, demonstration globally. Actors, fatalities.
**Take:** Event type, location, date, actors, fatalities, severity.
**Feeds system:** `source_type: event_signal`. Conflict events on geographic map. Protest surges = narrative acceleration.
**API:** Tokenized, free research. 30-day window.

### 23. Polymarket
**Why:** Money-weighted sentiment. Markets move BEFORE narratives. Real people, real money.
**Take:** Odds for geopolitical/policy questions, probability shifts, volume.
**Feeds system:** `source_type: prediction_market`. LEADING INDICATOR. Market-narrative divergence = high signal.
**API:** Tag filters. 5-min caching. Cloudflare JA3 may need workaround.

### 24. FRED
**Why:** CPI, unemployment, housing, rates — hard data narratives reference.
**Take:** Key indicator values and changes.
**Feeds system:** `source_type: event_signal`. Data releases = discourse triggers.
**API:** Free REST. No auth.

### 25. Congress.gov
**Why:** Bills, votes, hearings — policy actions narratives form around.
**Take:** New bills, hearings, votes on our topics.
**Feeds system:** `source_type: government`. Bill text enters Topology B.
**API:** Free REST.

### 26. Federal Register
**Why:** Executive orders, agency rules — executive branch signals.
**Take:** EOs, proposed/final rules on our topics.
**Feeds system:** `source_type: government`. Policy text enters Topology B.
**API:** Free REST.

### 27. Google Trends
**Why:** Search spikes = leading indicator. Search precedes social discourse.
**Take:** Volume by keyword and geography. Breakout terms.
**Feeds system:** `source_type: event_signal`. Early warning. Geographic breakdown feeds map.
**API:** pytrends (unofficial). Free.

### 28. Wikipedia Recent Changes
**Why:** Live edit wars = narrative contestation. NO other tool uses this. Unique signal.
**Take:** Edit velocity on topic articles. Revert rates.
**Feeds system:** `source_type: event_signal`. High velocity = active contestation. Reverts = friction.
**API:** EventStreams SSE. Free.

### 29. SEC EDGAR
**Why:** Corporate filings. AI investment data for AI Bubble topic.
**Take:** 10-K/10-Q mentioning AI, risk factors.
**Feeds system:** `source_type: government`. Grounds AI discourse in actual financials.
**API:** Free. No auth.

### 30. Yahoo Finance / CoinGecko
**Why:** Price movements trigger discourse.
**Take:** NVDA, MSFT, GOOGL, BTC, ETH, oil, homebuilders.
**Feeds system:** `source_type: event_signal`. Price to narrative correlation.
**API:** Yahoo free unofficial. CoinGecko free (30/min).

### 31. Cloudflare Radar
**Why:** Internet outages. Country goes dark = censorship/crisis.
**Take:** Outage events by country, duration, severity.
**Feeds system:** `source_type: event_signal`. Outage + silence = manufactured silence.
**API:** Free. Real-time.

### 32. ICG CrisisWatch
**Why:** Monthly conflict updates. Flags escalation before mainstream media.
**Take:** Crisis alerts, deterioration/improvement assessments.
**Feeds system:** `source_type: event_signal`. Early warning for geopolitical narrative shifts.
**API:** RSS. Monthly.

---

## REFERENCE/META-ANALYSIS — 2 sources

### 33. MediaCloud
**Why:** Tracks COVERAGE PATTERNS — which outlets cover what, when niche goes mainstream. Unique signal.
**Take:** Coverage patterns, volume by outlet category, niche-to-mainstream detection.
**Feeds system:** Meta-analysis. "Immigration spiked 300% in right-leaning outlets, flat in left-leaning" = divergence signal.
**API:** Open-source. Free for research.

### 34. WorldPop
**Why:** Population density by region. Weights geographic narrative map.
**Take:** Population counts by region.
**Feeds system:** Weighting multiplier. NYC narrative (8M) differs from rural Montana (50K). Salience-adjusted maps.
**API:** Free datasets. Annual.

**Optional lookups:** OpenSanctions (sanctioned entity flagging, free API). FDA (GLP-1 alerts, free).

---

## PIPELINE ARCHITECTURE

```
POPULATION (Topology A)                ELITE/INSTITUTIONAL (Topology B)
Bluesky, Reddit, Rumble,              RSS (100-200), Perigon, NewsAPI.ai,
Mastodon, Telegram, YouTube,           GDELT Doc, Brookings, Heritage,
Truth Social, X                        CAP, CSIS, CFR, RAND, DFRLab,
       |                               Think Tank Alert
       v                                        |
  EXTRACTION (Gemini + Sonnet)                   v
  Every claim: text, source_type,      EXTRACTION (Gemini + Sonnet)
  platform, author, timestamp          Same pipeline, same format
       |                                        |
       +----------------+-------------------+
                        |
                        v
              SHARED EMBEDDING SPACE
              All claims, same vectors
              Positions comparable
                        |
              +---------+---------+
              |                   |
              v                   v
        TOPOLOGY A          TOPOLOGY B
        Population          Elite/Institutional
              |                   |
              +---CROSS-TOPO------+
                  DIVERGENCE
                  ANALYSIS

EVENT SIGNALS feed both: GDELT Events, ACLED, Polymarket,
FRED, Congress, Fed Register, Google Trends, Wikipedia,
SEC EDGAR, Yahoo/CoinGecko, Cloudflare, ICG

REFERENCE: MediaCloud (patterns), WorldPop (weighting)
```

---

## NOTES FOR CLAUDE CODE

1. **Build order is your call.** Highest signal-to-effort first.
2. **Every source needs:** Ingestion script, normalization, error handling, caching, health check.
3. **`source_type` is CRITICAL.** Enables dual topology. Every claim must carry it.
4. **For launch:** Not all 34 need to be live. Move fastest from Scenario 2 toward real data.
5. **Cost:** All free except X/Twitter and potentially Perigon.
6. **Perigon vs NewsAPI.ai:** CC evaluates head-to-head, decides primary vs backup.
7. **Dual topology viz:** Layer toggle in Level 1. Default = Population. "Compare with Elite" overlays institutional.
