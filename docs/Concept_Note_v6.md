# Conceptual Specification v6.0
## Real-Time Narrative Dynamics & Influence Monitoring System

*Final pre-build specification. Incorporates IO operator stress-test findings. Every section documents what we build, why, and what we decided against with reasoning. This document is the single source of truth for the end state definition, build plan, and CLAUDE.md.*

---

## 0. Why This System Exists

Every contested topic — immigration, AI regulation, vaccine policy, any subject where people disagree — has a structure. There are distinct positions, they cluster into narratives, different populations hold different distributions of those positions, and the distributions shift over time. This structure is the **topology** of the disagreement.

That topology is currently invisible. Analysts read feeds. Researchers compile datasets months after the fact. Decision-makers rely on gut feel. No one can see the shape of a contested topic as a structured object — how many distinct positions exist, how they cluster, which are gaining energy, where populations are diverging into incompatible realities, whether the divergence is organic or manufactured, and how each platform's structure filters which positions can even survive in its environment.

This system makes that topology visible and measurable in real time.

### What this enables

**Epistemic value:** Seeing the structure of a disagreement that was previously invisible. The same value a weather map provides over feeling rain — you see the system, not just its effects.

**Strategic value:** Compressed situational awareness of the information environment around any topic. What takes a researcher weeks of manual analysis, the system shows in seconds.

**Defensive value:** Influence operations produce statistical signatures that are invisible at the individual post level but visible at the distributional level — anomalous burstiness, low source diversity, synchronized cross-platform seeding, manufactured contestation. The system surfaces these signatures without attributing intent.

### How this differs from existing tools

Sentiment analysis measures positive/negative. That is a thermometer. This system maps the full topology — every distinct position, how they relate, how they propagate, where the fracture lines are.

Topic tracking measures volume and trending keywords. That is a seismograph reading amplitude. This system maps the fault lines — structural divergences between populations, adversarial dynamics between competing claims, supply chains through which narratives transform as they propagate across platforms.

---

## 1. Epistemic Foundation

**[DAY 1]**

The system is built on a strict epistemic distinction:

- **Beliefs are latent** (not directly observable)
- **Information exposure and expressed behavior are observable**
- **Belief-consistent shifts can be inferred probabilistically** from changes in exposure and expression distributions

The system does not claim to read minds. It measures how the information environment changes, and how expressed narratives respond, across population slices and time.

*This framing is not a compromise — it is the only way the system remains intellectually honest and analytically powerful.*

### 1A. Exposure Observability Model

Exposure is a latent variable. In public internet data, we typically observe production (posts) and reaction (engagement), not what most people actually saw. The system decomposes exposure into three independently measurable distributions:

- **Production distribution:** what was posted. Measures speaker behavior and content generation rates across slices.
- **Amplification distribution:** what got engagement (likes, shares, replies, algorithmic boost signals). Measures platform behavior and audience resonance.
- **Estimated exposure distribution:** a proxy for what was likely seen, constructed from amplification signals, platform-specific reach heuristics, and visibility-tier weighting. Always marked as an estimate with stated confidence bounds.

These three distributions can diverge in analytically meaningful ways. A claim can be heavily produced but not amplified (organic but ignored), rarely produced but algorithmically boosted (platform-driven), or widely amplified but concentrated in narrow exposure pools (echo chamber dynamics). Each divergence pattern implies a different influence mechanism.

**Mathematical note:** This is a latent variable estimation problem. Exposure is the unobserved variable; production and amplification are observed proxies with known, platform-specific bias structures. The estimated exposure distribution is a reconstruction from these proxies — analogous to estimating a posterior from observable likelihoods. Confidence bounds reflect the uncertainty inherent in this reconstruction, not measurement noise.

*All downstream metrics must specify which distribution they reference. No metric may reference undifferentiated "exposure."*

### 1B. Feedback Loops

The inference chain (production → amplification → exposure → salience → expression) is presented as a pipeline for analytical clarity, but the real system has feedback loops: expression generates content that enters production, gets amplified, changes exposure, shifts future expression. On algorithmic platforms, this feedback can be rapid and non-linear.

For v1, each observation window is treated as an independent snapshot and the system measures change between windows. Future iterations may model dynamical system properties directly, including amplification feedback coefficients by platform.

---

## 2. Topics

**[DAY 1]**

### 2A. Topic Definition

A topic is not a keyword or LDA blob. A topic is defined as: **a contested domain in which multiple competing claims exist and can be empirically distinguished.**

Each topic must:
- Contain ≥ 2 distinct claim clusters
- Show detectable disagreement
- Have sufficient volume to support comparison

### 2B. Non-Contested Topics: Honest Labeling, Not Suppression

**Decision:** Topics that fail the contestation threshold are NOT suppressed. The system always shows the user something.

**Reasoning:** World Monitor never shows a blank screen. If you search a country with zero events, you still see baseline risk, infrastructure, static data. We follow the same principle. If someone searches "quantum computing" and there's no contestation, they still see: the claim landscape (likely a unified cluster), platform distribution, volume metrics. The system honestly labels it: *"Low contestation detected — this topic shows broad consensus with minor variation."*

Metrics that depend on contestation (divergence, friction, counter-narrative dynamics) are greyed out with explanation rather than shown as zeros. The user always gets a meaningful result while understanding the topic's structural character.

### 2C. Manufactured Contestation Detection

**[DAY 5]**

The system tracks the rate of contestation emergence. A topic shifting from uncontested to contested within 48–72 hours is flagged with a "contestation emergence alert." This does not assert the contestation is manufactured — it surfaces the temporal signature and lets the analyst investigate.

Relevant signals: sudden appearance of counter-claim clusters on a previously stable topic, correlated cross-platform seeding of the counter-position, and low source diversity among counter-claim producers.

---

## 3. Claims and Narratives

**[DAY 1]**

### 3A. Claims as Primary Analytic Unit

Claims are structured assertions extracted from content: subject, assertion, framing or implied causality, and sentiment or stance. Narratives emerge as clusters of semantically related claims, not as predefined labels.

### 3B. Semantic Embedding and Concept Layer

Claim clustering operates in a **high-dimensional semantic embedding space where distance corresponds to disagreement** — claims making similar assertions are geometrically close, opposing assertions are distant. This is a metric space with meaningful distance: cosine similarity between claim vectors measures semantic proximity in a space whose topology reflects the structure of the disagreement itself.

The system maintains a **concept layer** above the claim layer. Claims are observable units; concepts are higher-order contested positions that claims map to. Multiple claims with zero lexical overlap can map to the same concept if they occupy the same embedding region. This is critical for cross-slice comparison: if different population slices use different vocabulary for the same underlying position ("medical freedom" vs. "vaccine hesitancy" vs. "anti-vax"), concept-level normalization ensures divergence metrics measure real narrative divergence, not vocabulary divergence.

The system monitors for **adversarial vocabulary rotation** — a concept's surface expressions changing rapidly, indicating strategic reframing by sophisticated actors.

**Decision on cross-linguistic consistency:** We discussed building a separate subsystem for cross-register claim consistency (AAVE vs. academic English vs. meme format). We decided against it as a separate component because LLM-based extraction inherently handles this — Claude produces structured claims in a neutral canonical form regardless of input register. The extraction prompt instructs register-agnostic output. Sarcasm/irony edge cases are handled by claim confidence scoring (Section 3C). Meme/image-based claims are out of scope for v1 (text-only extraction). The requirement remains: same position must cluster regardless of register. The LLM handles this implicitly rather than through a dedicated engineering subsystem.

### 3C. Claim Extraction Confidence

**[DAY 2]**

Every extracted claim carries a confidence score reflecting extraction reliability. Confidence is reduced by: sarcasm/irony markers, quote-tweets and retweets (ambiguous stance), heavy paraphrase or meme references, multilingual mixing or code-switching, and short-form content with insufficient context.

Claims below a configurable threshold are excluded from primary metrics or displayed in a separate low-confidence layer. This prevents noisy extractions from receiving the same visual weight as clean ones.

**Critical insight:** Extraction errors are NOT uniformly distributed across population slices. Slices that communicate through more indirect, ironic, or vernacular-heavy styles will have systematically higher extraction error, creating **phantom divergence** — the system would measure extraction divergence and present it as narrative divergence. The confidence layer mitigates this, and the system tracks extraction error rates per slice for correction factors applied to divergence computations.

### 3D. Counter-Narrative Dynamics

**[STRETCH GOAL — Day 5 if core is complete]**

Claims exist in pairwise adversarial relationships. A counter-narrative's momentum is often a function of the original narrative's visibility. When Claim A gains salience, Counter-Claim B frequently emerges with characteristic lag τ, and Claim A may subsequently mutate in response to B's framing.

The system models this through:

- **Adversarial pair detection:** Identify claim pairs with inverse momentum correlation or high semantic opposition in embedding space. This operates on cluster centroids (not individual claims), so for 15 clusters it's only 105 pairs — computationally trivial, not the O(n²) problem it initially appeared to be.
- **Response lag measurement:** Time delay between momentum spike in Claim A and response in Counter-Claim B. Consistent short lags may indicate organized rapid response; long lags suggest organic counter-mobilization.
- **Mutation tracking:** Monitor whether Claim A's framing shifts after Counter-Claim B emerges — adopting B's terminology to reframe it, or shifting to new talking points that circumvent B's critique.

**Cost note:** This was initially flagged as expensive. It's not. Pairwise comparison on cluster centroids (not individual claims) is negligible compute. The cross-correlation on momentum time series is standard signal processing. No expensive model calls needed — it's all vector math on embeddings already generated. Reclassified from "stretch" concern to "stretch" only because it depends on the core metrics pipeline being fully working first, not because of cost.

Without counter-narrative modeling, the system sees claims as isolated objects floating in space. With it, the system sees the argument.

### 3E. Narrative Supply Chain Mapping

**[DAY 5]**

A claim rarely arrives in public discourse fully formed. Typical chain: think tank paper → partisan media headline → commentator talking point → meme → social media saturation. At each stage the claim is simplified, reframed, and adapted to platform affordances. The final meme may bear no lexical resemblance to the original paper yet carry the same core assertion.

The system reconstructs supply chains through:

- **Temporal provenance tracking:** For each concept, identifying the earliest instances across platforms and tracing the chronological sequence of related claims.
- **Fidelity decay measurement:** Tracking how semantic distance from the original concept increases at each propagation stage. High fidelity decay means the message distorts significantly through propagation; low fidelity decay means it stays intact through many hops. This is measurable: compute embedding distance between the earliest instance and each subsequent instance at each platform hop.
- **Platform transition analysis:** Identifying where a claim crosses from one platform to another and how it transforms at each crossing.

**Data constraint and honest approach:** With X + Reddit (+ possibly YouTube), supply chains show 2–3 hops, not the full 5-stage chain described above. This is a real limitation. The system handles it by showing what it can show and being honest about what it can't:

*"Based on available cross-platform data, this claim was first detected on Reddit (March 3, 14:22 UTC) and appeared on X 18 hours later with 73% semantic fidelity to the original framing. Origin prior to Reddit is unknown — no public antecedent detected."*

This is useful intelligence even with 2 hops. The analyst sees the direction and investigates. We don't pretend to have the full chain. The probabilistic framing ("no public antecedent detected" rather than "originated on Reddit") is honest about the limits of our observation. This approach — leading the analyst to look in a direction, then leaving interpretation to them — aligns with the system's core principle of surfacing patterns without asserting causation.

When additional platforms are integrated post-v1, supply chains automatically become richer without changing the underlying architecture.

---

## 4. Population Partitioning

**[DAY 1]**

*Population slices are analytic lenses, not ontological truths.*

### Tier 1 — Hard anchors (used freely)
- Geography (coarse)
- Language
- Platform (X, Reddit, YouTube for v1 — see Section 10 for platform exclusions)
- Time

### Tier 2 — Structural proxies (used with warnings)
- Urban vs rural (derived from geography)
- Media market boundaries
- Political context (elections, crises, major events)

### Tier 3 — Behavioral (high value, partial v1 implementation)
- Engagement style (broadcast vs reply-driven)
- Visibility tier (viral vs long-tail content)

*Algorithmic neighborhoods (shared exposure patterns) are deferred — see Section 12.*

### Tier 4 — Identity-correlated (handled carefully)
- Self-declared identity markers
- Hashtag-based affinity clusters
- Cultural meme ecosystems

### 4A. Tier 4 Ethical Boundary: Explicit Resolution

Tier 4 axes will in practice often correlate with race, gender, ethnicity, and political identity. The system draws a clear line between two analytically similar but ethically distinct operations:

**Permitted — behavioral clustering:** "Users who engage with #BlackLivesMatter content are exposed to narrative set X; users who engage with #BlueLivesMatter content are exposed to narrative set Y." This describes observable behavioral affinity. It does not infer identity from behavior.

**Prohibited — identity inference:** "Black users see narrative set X; white users see narrative set Y." This infers identity from behavioral proxies and presents it as demographic fact.

**Operational rule:** Slices are ALWAYS labeled by the behavioral signal that defines them (the hashtag, the affinity cluster, the meme ecosystem), NEVER by an inferred demographic category. The system may note that a behavioral cluster correlates with a demographic group at the area level (e.g., "this hashtag cluster is geographically concentrated in areas with high Hispanic population share") but it never relabels the cluster by the demographic inference. The cluster remains "#ImmigrationReform affinity cluster," not "Hispanic users."

This line is ethically real even if analytically thin. It preserves the distinction between observing what people do and asserting who people are. Any user or reviewer who pushes on this boundary should find a coherent, defensible position rather than hand-waving.

### 4B. Comparability Principle

**[DAY 2]**

All cross-slice comparisons are normalized to distributional shares, not raw counts. A slice that produces 50× more content than another will not be presented as having 50× more "influence" — the comparison shows the relative salience of the claim within each slice.

Minimum sample sizes are enforced per slice per time window. Slices below the volume threshold are shown with explicit low-confidence warnings, not suppressed. This prevents the system from overweighting loud populations and underweighting quiet ones — the opposite of what an influence-monitoring tool should do.

---

## 5. Platforms and Their Roles

**[DAY 1]**

*Platforms are not symmetric. Each contributes differently to the information environment.*

### 5A. Platform as Narrative Selection Pressure

Each platform's structural affordances (character limits, format constraints, algorithmic ranking, community norms) exert **selection pressure** on which claims can survive in articulated form. A nuanced policy argument can survive on Reddit but must be compressed to survive on X and must be visualized to survive on Instagram. Some positions are simply inexpressible in meme format. Some are inexpressible in 280 characters.

This means the same contested topic has a **structurally different claim topology on each platform** — not because of timing or audience differences, but because format constraints filter out claims that cannot be expressed within the platform's affordances. The system treats this as a first-class analytical object: comparing claim landscapes across platforms reveals not just who is saying what, but **what each platform's structure allows to be said.**

This is distinct from lead-lag correlation (Section 6A), which measures temporal propagation. Platform narrative selection pressure is a **structural** phenomenon, not a temporal one. A claim may exist on Reddit for months and never jump to another platform — not because it hasn't been seeded, but because it cannot survive that platform's format constraints.

### 5B. V1 Active Platforms

**X (text-forward):** Primary source of articulated claims. Rapid narrative mutation. High signal for momentum and divergence. For v1 demo: cached data, $0 cost. For live operation: $200/month Basic tier or pay-per-use pilot (credits-based, $500 voucher for beta participants). The new pay-per-use model (launched Feb 2026) is ideal for our use case — sporadic pulls for specific topics, not continuous streaming.

**Reddit (text-forward):** Longform discourse, structured threading, community-level slicing by subreddit. Free API tier is sufficient for demo and moderate live use. Rate-limited but workable. Most stable and cost-effective data source in our stack.

**YouTube (hybrid, targeted strategy):** YouTube comments are noisy — short, often off-topic, full of spam, shallow threading. But YouTube has two things the other platforms don't:

1. **Video titles and descriptions from news/commentary channels** — these are high-quality claim sources. A Ben Shapiro video title IS a claim. A Vox explainer description IS a framing. We don't need to process the video itself.
2. **Comment engagement signals** — like/dislike ratios on comments show friction directly. A top comment with 10k likes and 500 replies is a different signal than one with 100 likes and 2 replies.

**YouTube data strategy:** Do NOT try to ingest all comments on a topic. Instead: identify the top 10–20 channels that discuss the topic (for "AI regulation" that might be Vox, CNBC, Lex Fridman, specific policy channels), pull their video titles + descriptions + top 20 comments per video. This gives high-quality claim sources (titles/descriptions) plus friction signals (comment engagement) without drowning in noise. YouTube's free API quota (~10,000 units/day) is more than sufficient for this targeted approach.

### 5C. Excluded Platforms (with reasoning)

**TikTok — REMOVED ENTIRELY.** TikTok is banned in India (where the builder is based). API access is geopolitically contingent globally, competitive to obtain, and unstable. Despite being theoretically the purest test case for exposure asymmetry (algorithm-driven content delivery with minimal social graph dependence), it is operationally unavailable. All TikTok references are removed from active build sections.

**Instagram — DEFERRED TO POST-V1.** Instagram's API (Graph API) only allows access to accounts that have explicitly authorized your app via OAuth. You cannot programmatically search arbitrary public posts, do broad hashtag discovery, or pull public content at scale. The Hashtag Search API exists but is limited to business/creator accounts and returns limited metadata. Using an individual personal account only gives access to that account's own data, not discourse on a topic.

More fundamentally: Instagram's analytical value in our system is as a "belief normalization layer" — it shows what's *safe to post*, not what's being argued. That signal comes from the *type* of content (aesthetic, polished, identity-performing), not from caption text. Capturing this requires image/visual analysis capabilities that are out of scope for v1 (text-only extraction). The engineering cost of Instagram integration exceeds the analytical return for v1.

**Telegram, WhatsApp, Discord — CANNOT INGEST DIRECTLY.** These are private/semi-private platforms where narratives increasingly originate before surfacing publicly. The system cannot ingest from them, but can detect **emergence signatures** from the public platforms it does have: sudden appearance of a novel claim with no detectable public antecedent, initial propagation concentrated among accounts known to bridge public and private platforms, and rapid cross-platform synchronization inconsistent with organic discovery. These signals don't prove private-platform origin — they flag temporal anomalies that warrant analyst attention.

**4chan — NOT INCLUDED.** No official API. Would require scraping (ethical/legal grey zone). Content is extremely noisy. Historically important for narrative seeding but not worth the engineering and compliance cost for v1. Third-party archives (like 4plebs) with search APIs could be added post-v1 if needed.

---

## 6. Time Model

**[DAY 2]**

The system rejects "live = minute-by-minute." Instead it models narrative half-life by platform:

- X / news-driven narratives: ~6–48 hours
- Reddit longform discourse: ~3–10 days
- YouTube comment ecosystems: days–weeks

Aggregation windows: 6h (fast signals), 24h (daily shifts), 7d (structural change). Users can slide between windows. The UI never privileges "now" by default.

### 6A. Cross-Platform Lead-Lag Correlation

**[DAY 5]**

The system measures temporal correlation between the same claim's appearance across platforms. If a claim appears on lower-visibility platforms (small subreddits, niche forums) and subsequently surfaces on high-visibility platforms (mainstream X, YouTube) with a consistent lag pattern, this is flagged as a potential "narrative seeding" signature.

Lead-lag is computed per claim per platform pair. The system does not assert intent — it surfaces temporal structure. Consistent patterns across multiple claims from similar origin points are stronger signals than single instances.

**Data timing decision:** We identified that if ingestion from X and Reddit runs at different batch intervals, measured "lag" might reflect ingestion delay rather than actual propagation. **Solution:** All platform ingestion jobs run on the same cron schedule with timestamps normalized to UTC at ingestion time. For pre-computed demo data, this is trivially controlled since we determine when data is pulled. For live operation, synchronized batch scheduling ensures measured lags are real propagation delays.

---

## 7. Core Analytic Metrics

**[DAY 2]**

*The system never presents a single metric in isolation. Every view combines at least two orthogonal metrics. Confidence bounds and uncertainty are always visible. No causal claims are implied by default.*

### A Note on Baselines

Unlike physical systems where "normal" is statistically stable (military flights over a region have a natural base rate that algorithms like Welford's can learn), narrative dynamics **violate stationarity by definition** — the distribution is shifting, which is the entire point of measurement. A topic that didn't exist last month has no baseline. A topic that existed last month may have fundamentally changed in character.

We discussed this extensively and concluded that absolute baselines (like World Monitor uses for military flight anomaly detection) do not transfer to narrative dynamics. The system instead relies on three approaches:

1. **Rate-of-change as the primary signal.** Momentum measures acceleration, not level. It requires no baseline — a claim moving from the 35th to the 70th percentile in 72 hours is a signal regardless of what "normal" is.
2. **Relative comparison across topics at similar volume and age.** A topic's divergence score is contextualized against other topics with comparable characteristics, not against its own history.
3. **Event-anchored baselines where applicable.** For topics tied to real-world events, template curves (how does divergence typically evolve in the 7 days following a major policy announcement?) provide comparison points.

Metrics that depend on expected-vs-observed comparison (notably Silence as Signal) carry explicit acknowledgment of this baseline dependency.

### 7A. Salience

Measures whether a claim is disproportionately present in a given slice relative to a defined baseline. Baseline choice must be explicit: global (all content across all slices), platform-local (all content on the same platform), or geo-local. Different baselines answer different questions.

Minimum volume thresholds enforced — salience is not computed for slices below the sample floor. For small samples, conservative shrinkage pulls estimates toward the global baseline to prevent small-n volatility from generating false signals.

### 7B. Momentum + Source Diversity + Bridge Node Indicator

Momentum measures the rate of change in a claim's distributional position within a slice over a defined time window. Momentum is prioritized over prevalence for influence detection: a claim moving from the 35th to the 70th percentile in 72 hours is a stronger influence signal than a claim sitting at the 90th percentile for weeks.

**Every momentum reading is accompanied by a source diversity score:** Is the momentum driven by 10,000 independent accounts (high diversity = likely organic) or by 50 accounts with outsized reach (low diversity = possibly coordinated)? Computed as the effective number of independent sources contributing to a claim's momentum, normalized by the expected diversity for that volume level.

**Decision:** Source diversity was originally buried in the Coordination Signals section (Section 8). We relocated it to be paired directly with momentum because it qualifies the metric it sits next to. A momentum score without diversity context is incomplete — manufactured momentum should never receive the same visual weight as organic momentum. Source diversity anomalies are ALSO surfaced in coordination signals, but their primary home is here.

**Bridge node indicator:** Beyond counting *how many* sources drive momentum, the system tracks *what kind* of sources they are structurally. A bridge node is an account that engages across multiple distinct communities — posting in multiple subreddits on Reddit, engaging across different hashtag clusters on X. In influence operations, narratives are seeded through bridge nodes because they sit at community boundaries and can cross-pollinate a claim from one population to another. A claim amplified by 5 bridge nodes is structurally more impactful than one amplified by 50 community-contained accounts.

Implementation: For each account contributing to a claim's momentum, check whether they have engagement history across multiple distinct communities (subreddits for Reddit, hashtag clusters for X). Flag accounts that engage across ≥3 distinct communities as bridge nodes. Report the ratio of bridge-node amplification to total amplification alongside source diversity. On Reddit this is directly feasible via user post history across subreddits. On X, it's approximated through engagement across distinct hashtag clusters — less precise but still directionally useful.

**What this surfaces:** When a claim's momentum is driven disproportionately by bridge nodes (high bridge ratio), it suggests the claim is being deliberately or structurally cross-pollinated across communities. When it's driven by community-contained accounts (low bridge ratio), propagation is organic within a single group. Neither is inherently suspicious, but the distinction is operationally important.

### 7C. Friction

**[Elevated from position E to C based on IO operator assessment — friction is the second most important tactical signal after momentum.]**

Ratio of oppositional engagement (disagreement replies, counter-claims, debunking content) to total engagement on a claim within a slice. High exposure + near-zero friction = echo chamber. High friction = actively contested.

A claim can be highly salient, accelerating, and frictionless (indicating echo-chamber amplification) or highly salient, decelerating, and high-friction (indicating active pushback is working). The friction profile is analytically distinct from salience and momentum.

**Why friction is elevated:** From an influence operations perspective, friction is the single most important tactical signal. When assessing whether a narrative is succeeding or failing, the first question is: is it encountering organized resistance or propagating in a vacuum? A frictionless narrative isn't necessarily successful — it might just mean nobody important has noticed yet. A high-friction narrative that maintains momentum *despite* pushback is far more strategically significant than a frictionless one with the same salience score.

**Bot detection angle:** Coordinated bot amplification tends to produce broadcast-heavy, reply-light engagement patterns — high exposure with anomalously low friction. The friction metric partially functions as a bot/coordination detector independent of the dedicated coordination signals layer.

**Friction + Momentum interaction:** The most informative reading is the combination:
- High momentum + low friction = unopposed advance (echo chamber or unnoticed narrative)
- High momentum + high friction = contested advance (narrative is winning despite pushback)
- Low momentum + high friction = narrative is being successfully suppressed by counter-speech
- Low momentum + low friction = dead narrative (nobody cares enough to either spread or fight it)

### 7D. Persistence

**[NEW — Added based on IO operator assessment. Measures how long a claim maintains position, not just how fast it gets there.]**

Persistence measures how many consecutive time windows a claim maintains its distributional position above a defined threshold after reaching it. A flash-in-the-pan viral claim has high momentum but low persistence — it spikes and decays within a single news cycle. A slow-burn narrative that gradually becomes embedded in a community's worldview has moderate momentum but high persistence — once it reaches a certain salience level, it stays there.

**Why this matters:** From an operator's perspective, a persistent narrative is orders of magnitude more strategically significant than a viral one. Viral claims dominate attention briefly and disappear. Persistent claims reshape the information environment permanently. A claim with high momentum AND high persistence is a structurally embedded narrative — it has taken root. High momentum and low persistence is noise, regardless of how loud it was.

**Implementation:** Once a claim reaches the Nth percentile in a slice (configurable threshold, default: 50th percentile), count the number of consecutive aggregation windows it remains above that threshold before decaying below. This is computed from the same momentum time series — no new data required, just a different calculation.

**Persistence + Momentum + Friction interaction:** The three-metric combination is the most complete single-claim assessment:
- High momentum + high persistence + low friction = embedded narrative, unopposed — the most dangerous signal for an analyst tracking influence operations
- High momentum + low persistence + high friction = contested flash point — lots of attention but the counter-speech is working
- Low momentum + high persistence + low friction = deeply embedded belief that nobody talks about because it's assumed — the hardest to detect and the most important to surface

### 7E. Emotional Arousal Profile

**[NEW — Added based on IO assessment. Emotional charge is the single best predictor of propagation velocity and weaponization potential.]**

This is NOT sentiment analysis (positive/negative). It is **arousal classification** — is this claim packaged in high-arousal emotion (anger, fear, disgust, moral outrage) or low-arousal framing (analytical, explanatory, hedged)?

**Approach:** Rather than a standalone metric, emotional arousal is tracked as metadata on each claim during extraction. The LLM rates arousal (high/medium/low) as one additional field in the extraction prompt — zero additional API cost since it's already analyzing the text. The arousal tag is stored per claim, then aggregated per concept per time window.

**What the system tracks:** The arousal profile of a concept over time — specifically whether the average arousal of a concept's expressions is rising or falling. Two claims can occupy the same position in embedding space (same subject, same assertion) but one is framed with moral outrage and the other with clinical detachment. The outrage version propagates faster, further, and is more vulnerable to weaponization.

**The signal that matters:** When the emotional temperature of a concept's expression is rising while the semantic content stays the same, that's either organic radicalization (the population is getting angrier about something real) or deliberate emotional escalation by an operator (someone is repackaging a calm claim in outrage framing to accelerate its spread). Both are critical to detect.

**Frontend display:** The arousal trend is shown as a temperature indicator per concept — warming (arousal rising), cooling (arousal falling), or stable. When a concept's arousal profile diverges sharply across slices (one population is angry, the other is analytical about the same topic), that's visible in the comparison view.

### 7F. Claim Mutation Directionality

**[NEW — Added based on IO assessment. The direction of semantic drift over time indicates what phase a narrative is in.]**

When a claim or concept mutates over time, the *direction* of mutation is a primary indicator of narrative strategy. The system tracks the embedding trajectory of a concept's centroid across time windows:

**Mainstreaming trajectory:** The concept's centroid is moving toward the center of the overall claim space — it's shedding extreme framings and becoming more palatable to a broader audience. This is the signature of a narrative being deliberately or organically prepared for mass adoption. The cluster may also be diffusing (becoming less tightly defined as more moderate variations appear).

**Radicalizing trajectory:** The concept's centroid is moving toward the periphery of the claim space — it's becoming more extreme, more specific, more divergent from mainstream discourse. The cluster may be tightening (crystallizing around a specific extreme version as moderates drop out).

**Fragmenting trajectory:** The concept's centroid isn't moving coherently — it's splitting into sub-clusters that each move in different directions. This indicates a narrative that's losing coherence, with different factions within the same broad position diverging.

**Implementation:** Compute the vector difference between a concept's centroid at time t and t+1. Compare this vector to the direction of the overall claim space center. If the centroid is moving toward center: mainstreaming. Away from center: radicalizing. If the cluster's internal variance is increasing: fragmenting. This builds on existing infrastructure — centroids are already computed for clustering, and tracking their movement between windows is a simple vector operation.

**Why this matters operationally:** Sophisticated influence operations don't just amplify a message — they steer it through phases. A common pattern: seed an extreme version in niche communities (radicalizing phase), then gradually introduce softer versions for mainstream consumption (mainstreaming phase). Detecting the phase transition — a concept that was radicalizing and suddenly begins mainstreaming — is a high-value signal.

### 7G. Divergence

Measures the distributional distance between how two slices discuss the same topic. The measure must satisfy three mathematical properties: **symmetry** (distance A→B equals B→A), **boundedness** (values in a fixed range for interpretability), and **stability under sparsity** (no extreme values when slices have limited data).

**Mathematical note:** Jensen-Shannon divergence satisfies all three required properties. Its square root is a **true metric** in the information-theoretic sense, giving the divergence measure geometric meaning in the claim embedding space — the distance between two slices' claim distributions can be interpreted as a length in a well-defined metric space, not just a statistical score. When we say "slice A and slice B are diverging," we mean they are moving apart in a space where distance has formal mathematical properties.

#### 7G-ii. Divergence Typology

**This is one of the most intellectually distinctive contributions in the system.**

Divergence is not monolithic. Two populations can diverge for fundamentally different reasons, and the type matters as much as the magnitude. The system classifies divergence into three modes using **continuous scores**, not binary categories:

**Information asymmetry:** Groups exposed to different facts. **Continuous signature:** salience ratio — claim clusters that have extreme salience differences between slices (one slice at the 90th percentile, the other at the 5th). Measured as the ratio of maximum to minimum salience for each claim cluster across compared slices. High asymmetry ratio across multiple clusters = information asymmetry mode.

**Interpretive divergence:** Groups interpret the same facts differently. **Continuous signature:** rank correlation coefficient — both slices have non-zero mass on the same claim clusters, but the relative rankings differ. Measured as Spearman's rank correlation between the two slices' salience rankings of shared claim clusters. Strong negative correlation = interpretive divergence mode.

**Paradigmatic divergence:** Groups operating in incommensurable frameworks. **Continuous signature:** support overlap score — the fraction of claim clusters that have non-trivial mass in both slices. Low overlap = paradigmatic divergence mode. **Important caveat:** low support overlap can also indicate extraction/embedding failure across linguistically different slices. When paradigmatic divergence is flagged, the system cross-checks against extraction confidence per slice. If one slice has systematically lower extraction confidence, the paradigmatic divergence flag carries a warning that it may reflect extraction limitations rather than genuine incommensurability.

Each mode produces a continuous score (0–1). Real-world divergence is typically a mixture of modes. The system reports the dominant mode and the mixture weights, not a single categorical label.

### 7H. Exposure Asymmetry

Measures whether a claim appears disproportionately in high-visibility content in one slice relative to another. High-visibility is **platform-specific:**

- On X: weighted by follower count and retweet cascade depth
- On YouTube: treated as elite/influencer framing — view count and channel subscriber count, NOT representative of population-level discourse. YouTube data is labeled as "influencer framing source" not "population expression" in all outputs.
- On Reddit: by subreddit size and upvote rank

Each platform's visibility proxy is explicitly stated and acknowledged as a proxy with known limitations.

**Decision on YouTube:** Based on IO operator assessment, YouTube content creators are professional engagement optimizers, not representative of any population's narrative landscape. A Ben Shapiro video title tells you what Shapiro wants to say, not what his audience thinks. YouTube data is used exclusively as a source of high-visibility claim framings from influential actors and is never treated with the same analytical weight as X or Reddit population expression data.

### 7I. Silence as Signal (Claim-Level Detection)

**[DAY 5]**

If a previously active claim suddenly disappears from a slice's production distribution without a corresponding decline in the topic's overall volume, that's a claim-specific silence signal. The system flags these as "claim went dark" events in the signals timeline, linked to the relevant slice and time window.

This is the **tractable subset** of the full silence-as-signal concept. The full version — modeling expected salience vs. observed salience for topics that *should* be salient given real-world events but aren't — is deferred (see Section 12C) because it requires baseline models we cannot build in 5 days.

**Honest caveat in the system:** Silence detection is the most baseline-dependent analytical capability. Claim-level disappearance detection (implemented in v1) requires only change detection, not baseline estimation. The full expected-vs-observed model requires event detection, historical salience patterns, and enough topic history to calibrate. We implement what's tractable and are honest about the rest.

### 7J. Expressibility (Lightweight Indicator)

**[DAY 5]**

The **original-post ratio:** for each claim in each slice, the ratio of unique original posts expressing the claim to total engagements (likes, retweets, replies) on those posts. A high ratio suggests comfort expressing the position (many people willing to put their name on it). A low ratio suggests the claim circulates through engagement but few are willing to originate new posts expressing it — people agree but don't want to say it publicly.

*This is a single-signal lightweight indicator. The full expressibility metric (hedging index, deletion rates, temporal posting patterns, Overton window tracking) is deferred — see Section 12A.*

---

## 8. Coordination Signals (Non-Attributional)

**[DAY 5]**

The system does not attribute intent. It surfaces statistical signatures consistent with coordination. The analyst decides what to investigate further.

**Observable coordination signatures:**

- **Burstiness beyond baseline:** A claim's production rate exceeds what would be expected from organic adoption curves for that topic/platform/slice combination.
- **Near-duplicate content proliferation:** High semantic similarity across posts from accounts that don't share audience overlap, suggesting coordinated messaging rather than organic convergence.
- **Synchronized cross-platform seeding:** A claim appears on multiple platforms within a window too narrow for organic cross-pollination, especially if the posting accounts have no prior co-engagement history.
- **Source diversity anomalies:** Momentum being driven by a small number of accounts with outsized reach, or by many accounts with suspiciously similar creation dates, posting patterns, or content profiles.

Coordination signals are ALWAYS presented alongside organic baselines for the same metric. A burstiness score without comparison to the topic's normal burstiness range is meaningless. The system flags anomalies, not accusations.

---

## 9. Failure Modes & Misinterpretation Risks

*Every measurement declares how it can be wrong.*

**Sampling bias:** Platform APIs provide non-random samples. X overrepresents high-engagement content. Reddit truncates low-traffic subreddits. YouTube comment data is noisy. The system's view is a sample of a sample, and biases compound across platforms. All cross-platform comparisons carry this caveat.

**Engagement manipulation:** Likes, shares, and replies can be purchased or botted. The amplification distribution is vulnerable, propagating into estimated exposure. Coordination signals partially mitigate but cannot guarantee genuine behavior.

**Extraction errors:** Sarcasm, irony, quote-tweets, meme references degrade accuracy. Errors are non-uniform across slices — indirect/ironic styles have systematically higher error, risking phantom divergence. The confidence layer mitigates but does not eliminate this.

**Loud minority vs. silent majority:** The system measures expressed narratives, not held beliefs. A vocal minority can dominate the production distribution without representing broader views. The system is explicit: it measures what is said, not what is thought.

**Cross-platform visibility proxy divergence:** High-visibility on X (follower-weighted) and on YouTube (recommendation-driven) measure fundamentally different constructs. Never presented as a unified cross-platform metric.

**Small-n volatility:** Narrow slices and niche topics produce unstable metrics. A single viral post can swing salience by orders of magnitude. Mitigated by conservative shrinkage, volume thresholds, and confidence intervals.

**Supply chain data sparsity:** With 2–3 platform sources, supply chains show limited hops. The system presents what it observes and is explicit about the observation boundary ("no public antecedent detected" rather than "originated here").

---

## 10. What the System Shows

The system answers:

- Where is a claim becoming unusually loud?
- Where is it accelerating fastest — and is that acceleration organic or concentrated in a few sources?
- Are bridge nodes (cross-community accounts) disproportionately driving this claim's spread?
- Is this claim encountering organized resistance or propagating in a frictionless vacuum?
- How long has this claim maintained its position — is it a flash or an embedded belief?
- Is the emotional temperature of this narrative rising or falling — and does it differ across populations?
- Is this narrative mainstreaming (becoming more moderate) or radicalizing (becoming more extreme)?
- Where are realities diverging — and is it because of different facts, different interpretations, or different frameworks?
- Which populations are disproportionately exposed to which narratives?
- How do platforms differ in shaping the same topic — not just who says what, but what each platform's structure allows to be said?
- Did this narrative originate upstream on a different platform?
- How did this claim transform as it moved between platforms?
- What claims have gone dark — previously active but suddenly silent?
- When Claim A gained momentum, how quickly did the counter-claim emerge? *(stretch goal)*

It does not answer:

- "What do people truly believe?"
- "Who is right or wrong?"
- "How should someone be influenced?"
- "Who is responsible for this campaign?"

---

## 11. Final Framing

> A real-time system that extracts structured claims from public discourse, maps them into a semantic topology of competing positions on any contested topic, and measures how that topology differs across platforms, populations, and time — surfacing where narratives are gaining momentum, where groups are diverging into incompatible realities, whether that divergence is organic or shows coordination signatures, and how each platform's structure filters which positions can even survive in its environment — all built on the epistemic constraint that beliefs are latent and only expressed distributions are observable, with every metric decomposing exposure into production, amplification, and estimated reach, carrying explicit confidence bounds, and declaring its own failure modes.

---

## 12. Deferred — Post-Ship

*These components are architecturally sound but require more data, more time, or empirical validation. They remain in the specification as the documented next layer of depth. Nothing in the v1 build prevents their addition.*

### 12A. Full Expressibility Shift Metric

**Why deferred:** 3 of 4 approximation signals are technically infeasible with current data. The single feasible signal (original-post ratio) is implemented in v1 as a lightweight indicator.

The full metric would track expressibility through four signals: original-post ratio (implemented), linguistic hedging index (requires robust NLP detection of distancing language — a research problem in itself), deletion/retraction rates (platform-dependent, often unobservable — X doesn't surface deleted tweets via API, Reddit deletions partially visible through archives), and temporal posting patterns (requires timezone inference and per-user behavioral data at scale).

Together these would track Overton window movement: when a position transitions from low to high expressibility, it's becoming normalized regardless of salience change. This is often a **leading indicator** of future salience shifts — people start feeling safe to say something before they start saying it loudly.

**What makes this powerful (for future implementation):** Expressibility is distinct from salience (how loud) and momentum (how fast). A claim can have low salience but high expressibility (few saying it, but no social cost) or high salience but declining expressibility (many said it last week, but social sanctions are increasing). Tracking the boundary of what people feel comfortable expressing publicly is arguably the most sensitive indicator in the entire system.

### 12B. Algorithmic Neighborhoods

**Why deferred:** Requires user-interaction graph data not available in batch API pulls.

An algorithmic neighborhood is a cluster of accounts exposed to substantially similar content, regardless of whether they follow each other or share demographics. Approximated through co-engagement proxies: accounts consistently engaging with the same content, following the same niche accounts, or appearing in the same reply threads.

This captures the actual structure of the information environment as people experience it, rather than using geography or demographics as proxies. Two users in the same city may inhabit completely different information environments; two in different countries may share one.

**Why this matters:** Potentially the most powerful partitioning axis in the system. It captures de facto information communities that transcend geography and demographics. But building the co-engagement graph requires sustained data collection and network analysis that exceeds the v1 timeline.

### 12C. Full Silence as Signal (Expected vs. Observed Salience Model)

**Why deferred:** Most baseline-dependent metric. Requires event detection and historical salience models that cannot be built in 5 days.

The full version would model expected salience given real-world events (a policy announcement, crisis, viral incident) and compare to observed salience. When observed is significantly below expected, this flags suppression, self-censorship, or attention displacement. Requires: event detection system, historical salience patterns for calibration, enough topic history to establish reliable templates.

Claim-level silence detection (Section 7F) is the tractable subset implemented in v1.

### 12D. Adaptive Windowing

**Why deferred:** Requires empirical decay data across enough topics to calibrate.

Instead of fixed 6h/24h/7d windows for every topic, the system would detect how fast a specific topic's narratives decay and adjust aggregation intervals. A political scandal decays in hours (needs shorter windows); a public health narrative persists for months (needs longer windows). Requires per-topic decay curve tracking. The v1 architecture (parameterized by window size) accommodates this without rewriting.

### 12E. Instagram Integration

**Why deferred:** API restrictions (only authorized accounts, no broad public search), and Instagram's primary analytical value is in visual content (meme aesthetics, belief normalization signals) which requires image analysis capabilities out of scope for v1 text-only extraction. When image analysis is added, Instagram becomes the primary source for expressibility and normalization signals.

### 12F. Payment Gateway for Cost-Heavy Tasks

**Why deferred:** Growth problem, not a launch problem. For demo and initial distribution, everything runs on pre-computed cached data at $0 cost. If the tool gains traction and live topic search is added (user types topic → Claude extracts claims in real-time), per-query costs from Claude API become material. At that point, a simple usage-based model ("5 free topic analyses, then $2 per analysis") covers extraction + embedding costs. Don't build the payment system in the 5-day sprint.

### 12G. Amplifier-to-Originator Ratio

**Why deferred:** Requires distinguishing between accounts that write original expressions of a claim vs. accounts that merely amplify (retweet/share) existing expressions. On X, this is partially feasible (retweets vs. original tweets are distinguishable). On Reddit, it's harder (every comment is technically "original" even if it's parroting). The ratio is analytically powerful — when 95% of a claim's spread is pure amplification of a small number of original posts, that's a signature of either coordinated amplification or authority-driven adoption. Both are important to distinguish from true organic adoption where many people independently express the position in their own words. Deferred because accurate implementation requires reliable RT/original classification across platforms, which adds complexity to the extraction pipeline.

### 12H. Manufactured Contestation: Multi-Signal Verification

**Why deferred:** The current manufactured contestation detection (Section 2C) flags topics that shift from uncontested to contested rapidly. This is a useful first-pass alert. However, rapid contestation emergence can have multiple non-manufactured causes: genuine events triggering legitimate disagreement, previously private disagreement becoming public (whistleblower, court ruling), or seasonal/cyclical topic resurgence. A more robust version would require convergence of multiple signals (rapid emergence + low source diversity + cross-platform synchronization) before flagging with elevated confidence. For v1, the system flags the temporal anomaly and leaves interpretation to the analyst. Future iterations should implement a multi-signal convergence score for contestation alerts, reducing false positive rate.

---

## 13. Build Timeline

| Day | Focus | Delivers |
|-----|-------|----------|
| 1 | Data + Extraction | 3–5 topics collected from X + Reddit (cached), claim extraction via Claude API (including arousal tag), embeddings generated, clusters formed, structured JSON output |
| 2 | Metrics Engine | Salience, momentum + source diversity + bridge node indicator, friction, persistence, emotional arousal profile, claim mutation directionality, divergence (JSD + typology with continuous scores), exposure decomposition, comparability normalization, confidence scoring |
| 3 | Frontend: Claim Landscape | D3 force-directed claim graph, metrics panel (friction elevated, persistence visible, arousal trend indicator), platform toggle, time window slider, topic search |
| 4 | Frontend: Comparison + Drill-Down | Divergence heatmap with typology labels and continuous scores, slice comparison view, claim deep-dive with examples, provenance, mutation trajectory |
| 5 | Intelligence Layer + Polish | Lead-lag (with synchronized ingestion timestamps), coordination signals, manufactured contestation, supply chain (2–3 hop with honest labeling), silence detection (claim-level), expressibility (original-post ratio), failure states, visual polish |

**Stretch goals (Day 5 if core is complete):**
- Counter-narrative dynamics (adversarial pair detection + response lag — reclassified as lightweight compute, not expensive)
- Live topic input (user types a new topic, Claude API extracts claims in real-time)

---

## 14. Data Sourcing Reality

| Platform | Access | Cost (Demo) | Cost (Live) | Risk Level | Notes |
|----------|--------|-------------|-------------|------------|-------|
| X | API (Basic or pay-per-use) | $0 (cached) | $200/mo or credits-based | Medium-High | Pricing volatile. Pay-per-use pilot ideal for sporadic pulls. |
| Reddit | API (free tier) | $0 | $0 | Low | Most stable source. Rate-limited but sufficient. |
| YouTube | Comments/Data API | $0 | $0 (free quota) | Low-Medium | ~10k units/day free. Use targeted strategy: top channels, titles+descriptions+top comments. |

**V1 builds on X + Reddit + YouTube (targeted).** The system must work compellingly with 2–3 platforms. Nothing in the architecture assumes more platforms than are available. Pre-computed/cached data is used for demo reliability.

---

## 15. Cost and Complication Risks

**Claude API for claim extraction:** ~1,500 calls for 3 topics × 500 posts. At Sonnet pricing this is ~$5–15 for the full demo dataset. Live operation scales linearly with volume. Cache aggressively — identical posts should never trigger duplicate extractions.

**Embedding generation:** One-time cost per claim. Negligible whether using OpenAI embeddings or open-source alternatives.

**Lead-lag timing accuracy:** SOLVED. Synchronized batch ingestion on the same cron schedule with UTC timestamp normalization at ingestion time. For cached demo data, timing is controlled by construction.

**Supply chain with 2–3 platforms:** Shows limited hops. Design the UI to be compelling with 2 hops and richer with 3+. The honest labeling approach ("no public antecedent detected") makes sparse data a feature of intellectual honesty rather than a visible failure.

**Counter-narrative pairwise computation:** Operates on cluster centroids, NOT individual claims. For 15 clusters: 105 pairs. Negligible compute. Originally flagged as expensive — reclassified after realizing the comparison is on centroids, not on the full claim set. If topics scale to 50+ clusters, can cap or sample.

**D3 force-directed layout tuning:** The claim landscape graph needs significant iteration to look good rather than like a random mess of nodes. Budget 4–6 hours of tuning, not just implementation. This is where "visual impact for the builder/VC audience" lives — the graph must be beautiful, not just functional.

---

## 16. Where the Math Shows

### Backend (the brain)

1. **Claim embedding as metric space** — positions mapped into a space where cosine distance = degree of disagreement; topology of the space reflects the structure of the debate
2. **HDBSCAN density-based clustering** — finds narrative groups without specifying how many exist; cluster count is an emergent property of the data
3. **Jensen-Shannon divergence (√JSD is a true metric)** — distributional distance with formal geometric meaning in information-theoretic space
4. **Divergence typology via continuous distributional signatures** — salience ratio (different facts), rank correlation coefficient (different interpretations), support overlap score (incommensurable frames)
5. **Latent variable estimation for exposure** — reconstructing an unobserved distribution from observable proxies, analogous to posterior estimation
6. **Source diversity as effective independent source count** — normalized against expected diversity at volume level; distinguishes organic from manufactured momentum
7. **Bridge node detection via cross-community engagement** — accounts engaging across ≥3 distinct communities flagged as structural cross-pollinators
8. **Persistence as duration above threshold** — consecutive time windows a claim maintains distributional position; separates embedded narratives from viral noise
9. **Arousal profile trending** — aggregated emotional charge per concept per time window; rising arousal on stable semantic content = escalation signal
10. **Centroid trajectory for mutation directionality** — vector difference between concept centroids across windows compared to overall claim space center; movement toward center = mainstreaming, away = radicalizing, variance increase = fragmenting
11. **Cross-correlation for lead-lag detection** — signal processing on momentum time series across platforms to detect propagation timing
12. **Fidelity decay as embedding distance** — semantic distance from original concept measured at each propagation stage, quantifying distortion through the supply chain
13. **Conservative shrinkage for small samples** — Bayesian-flavored estimation pulling uncertain measurements toward global priors
14. **Adversarial pair detection via centroid opposition** — pairwise cosine similarity on cluster centroids to find semantically opposed claim pairs with inverse momentum correlation

### Frontend (what users see)

1. **Force-directed claim graph** — the topology IS the visualization; clusters visible, distances meaningful, size = salience, color = momentum direction, border glow = arousal level
2. **Divergence heatmap with typology labels and continuous scores** — red cells = groups in different realities; the label tells you WHY with a confidence weight across three modes
3. **Momentum sparklines with diversity + bridge indicators** — green = organic/distributed, red = concentrated sources, bridge icon when cross-community accounts dominate
4. **Friction gauge (elevated, prominent)** — echo-chamber silence vs. active resistance shown prominently per claim; combined with momentum to show the 4-quadrant interaction (unopposed advance, contested advance, successful suppression, dead narrative)
5. **Persistence bar** — how long a claim has maintained position, shown as a duration indicator alongside momentum; distinguishes flash-in-pan from embedded belief
6. **Arousal temperature per concept** — warming/cooling/stable indicator; divergent arousal across slices visible in comparison view
7. **Mutation trajectory arrow** — directional indicator on each concept showing mainstreaming (→ center), radicalizing (→ periphery), or fragmenting (→ dispersal)
8. **Three-layer exposure bars** — stacked bars showing production vs. amplification vs. estimated exposure, making "produced but ignored" vs. "boosted but not produced" visible at a glance
9. **Platform comparison panels** — same topic, different claim topologies side by side; YouTube labeled as "influencer framing" not "population expression"
10. **Supply chain timeline with fidelity markers** — a claim's journey shown as a path across platforms with semantic distance markers at each hop and honest "observation boundary" labels
11. **"Claim went dark" flags** — timeline events for claims that disappeared, making silence visible
12. **Confidence dimming** — low-confidence claims visually faded, not hidden; uncertainty is part of the display
13. **Grey-out for inapplicable metrics** — non-contested topics show available data with contestation-dependent metrics greyed out and explained, never faked with zeros
