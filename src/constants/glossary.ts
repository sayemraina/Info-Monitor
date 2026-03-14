export const GLOSSARY = {
  Salience: {
    plain: "How prevalent or visible a specific claim is within a given population slice.",
    technical: "A measure of disproportionate presence relative to a defined baseline (global, platform-local, or geo-local).",
    methodology: "Computed as the distributional share of expressions within a slice. Minimum volume thresholds are enforced with conservative shrinkage to prevent small-n volatility."
  },
  Momentum: {
    plain: "The acceleration of a narrative—how fast a claim is moving up or down in prominence.",
    technical: "Rate of change in a claim's distributional position within a slice over a defined time window.",
    methodology: "Measured by comparing salience percentiles between consecutive windows (e.g., moving from 35th to 70th percentile in 72h). Prioritized over raw salience for influence detection."
  },
  Arousal: {
    plain: "The emotional temperature of a claim—whether it's framed with moral outrage/fear or clinical detachment.",
    technical: "Arousal classification (high/medium/low) assigned during LLM extraction, aggregated per concept over time to track escalation.",
    methodology: "LLM rates arousal based on lexical/semantic markers. An escalation signal triggers when a stable concept's arousal profile consistently rises."
  },
  Mutation: {
    plain: "How a narrative evolves over time—whether it's becoming more mainstream, more extreme, or fracturing.",
    technical: "The vector difference of a concept's centroid across time windows relative to the overall claim space center.",
    methodology: "Movement toward the global center = Mainstreaming. Movement away = Radicalizing. Increased internal variance = Fragmenting."
  },
  Confidence: {
    plain: "How reliably the AI extracted this structured claim from the raw, messy internet text.",
    technical: "Extraction reliability score penalizing sarcasm, irony, quote-tweets, and ambiguous syntax to prevent phantom divergence.",
    methodology: "Claims below a threshold are visually dimmed. This prevents noisy extractions in vernacular-heavy slices from skewing the divergence metrics."
  },
  Friction: {
    plain: "The amount of active pushback or disagreement a narrative is facing from its audience.",
    technical: "Ratio of oppositional engagement (disagreement replies, debunking) to total engagement within a slice.",
    methodology: "High exposure + zero friction = echo chamber. High friction + high momentum = contested advance. Acts as a key IO tactical signal."
  },
  Persistence: {
    plain: "How long a narrative stays relevant—separating flash-in-the-pan viral trends from deeply embedded beliefs.",
    technical: "Number of consecutive time windows a claim maintains a distributional position above a defined threshold (e.g., 50th percentile).",
    methodology: "Calculated from the momentum time series. High persistence indicates structural embedding."
  },
  SourceDiversity: {
    plain: "Whether a trend is driven by thousands of regular people or heavily artificially pushed by a few loud accounts.",
    technical: "Effective number of independent sources contributing to a claim's momentum, normalized by expected diversity.",
    methodology: "Low diversity flags potential coordination. Never presented simply as volume; always paired with momentum."
  },
  BridgeNodes: {
    plain: "Highly influential accounts that cross-pollinate narratives by engaging deeply across multiple distinct communities.",
    technical: "Accounts with engagement history across ≥3 distinct structural communities (subreddits, hashtag clusters), acting as structural cross-pollinators.",
    methodology: "Identifies whether momentum is community-contained or being deliberately seeded across boundaries."
  },
  Divergence: {
    plain: "The gap between different populations in how they discuss the same topic or events.",
    technical: "Distributional distance measuring the structural disparity between two slices' claim representations.",
    methodology: "Computed using Jensen-Shannon Divergence (JSD). It satisfies symmetry, boundedness, and stability under sparsity."
  },
  InformationAsymmetry: {
    plain: "Groups are simply exposed to entirely different sets of facts and claims.",
    technical: "Divergence characterized by extreme salience differences for the same clusters between slices.",
    methodology: "Measured as the ratio of maximum to minimum salience for shared clusters across slices."
  },
  InterpretiveDivergence: {
    plain: "Groups are looking at the exact same facts, but ranking their importance or interpreting them completely differently.",
    technical: "Both slices have non-zero mass on identical clusters, but their relative rankings are inverted.",
    methodology: "Measured via Spearman's rank correlation coefficient between salience rankings. Strong negative correlation flags interpretive divergence."
  },
  ParadigmaticDivergence: {
    plain: "Groups are operating in completely incompatible realities or frameworks with almost zero overlap.",
    technical: "Characterized by low support overlap—very few claim clusters exist in both slices simultaneously.",
    methodology: "Measured as the overlap fraction of clusters with non-trivial mass. Cross-checked against extraction confidence bounds."
  },
  ExposureAsymmetry: {
    plain: "When one group's elite/influential accounts push a narrative, but another group's influential accounts completely ignore it.",
    technical: "Disproportionate presence of a claim in high-visibility platform-specific proxy content (e.g., follower-weighted X, or big YouTube channels).",
    methodology: "Always explicitly bounded by platform-specific proxy limitations. YouTube is specifically labeled as 'influencer framing' only."
  },
  Silence: {
    plain: "When a narrative that used to be actively discussed suddenly drops off the radar, without the overall topic dying down.",
    technical: "A claim-level disappearance signal within a slice's production distribution.",
    methodology: "Detected as an unexpected drop to near-zero salience while total topic volume remains stable."
  },
  Expressibility: {
    plain: "How comfortable people feel actively saying something, compared to just quietly liking or sharing it.",
    technical: "Approximated via Original-Post Ratio: the ratio of unique original posts expressing the claim to total engagements.",
    methodology: "Low expressibility indicates high social cost for the position, acting as a leading indicator of Overton window shifts."
  },
  CounterNarrative: {
    plain: "The opposing argument that naturally emerges when a dominant narrative gains traction.",
    technical: "Adversarial pairs detected via inverse momentum correlation and geometric opposition in semantic embedding space.",
    methodology: "Provides response lag measurement and mutation tracking to see if the original claim reframes itself in response."
  },
  Coordination: {
    plain: "Suspicious, potentially artificial behavior designed to push a narrative faster than organic human sharing would allow.",
    technical: "Statistical anomaly signatures including extreme burstiness, near-duplicate content proliferation, and synchronized cross-platform seeding.",
    methodology: "Does not attribute intent. Always presented relative to the topic/slice specific organic baseline."
  },
  TopicContestation: {
    plain: "Whether a topic actually has real disagreement, or if everyone basically agrees.",
    technical: "The structural requirement for a topic to contain ≥2 distinct claim clusters with detectable semantic opposition.",
    methodology: "Uncontested topics are not suppressed; they are honestly labeled. Manufactured contestation emergence is flagged for sudden anomalies."
  },
  Burstiness: {
    plain: "An unnaturally sudden spike in activity — content that spreads far too fast to be normal human sharing.",
    technical: "Statistical measure of inter-event timing regularity. Organic sharing follows Weibull distributions; bots and coordinated actors show Poisson-like regularity or extreme brevity.",
    methodology: "Compared against the topic-specific baseline computed over the prior 14-day rolling window to account for breaking news spikes.",
    caveat: "High burstiness alone doesn't confirm coordination — a major breaking news event can also spike naturally."
  },
  NearDuplicate: {
    plain: "Content that is copy-pasted or nearly identical across many accounts — a hallmark of coordinated messaging campaigns.",
    technical: "Fraction of posts with cosine similarity >0.85 to a cluster centroid that share < 3 hours of post time between them.",
    methodology: "Threshold calibrated on historical organic resharing behavior. Cross-checked with source diversity to separate organic retweets from inauthentic syndication."
  },
  CrossPlatformSync: {
    plain: "The same talking points appearing on X, Reddit, and YouTube within hours of each other — as if coordinated from the same source.",
    technical: "Temporal cross-correlation of salient cluster volumes across platform slices. A high score means all platforms spike simultaneously.",
    methodology: "Organic cross-platform spillover is expected with a lag (hours to days). Near-zero lag at scale is the anomaly flag."
  },
  SourceDiversityAnomaly: {
    plain: "A narrative being pushed hard, but coming from suspiciously few accounts — suggesting artificial amplification rather than genuine public interest.",
    technical: "Compares the effective number of unique contributing sources to the expected diversity given volume. Low ratio = concentrated push.",
    methodology: "Gini impurity applied to source distribution, normalized by empirical volume-diversity curve for the topic over the prior window."
  },
  PopulationPartitioning: {
    plain: "The same topic looks different depending on which group you examine. Choosing a lens slices the data by that dimension and reveals how different populations experience the same contested topic.",
    technical: "Population partitioning decomposes the claim distribution into sub-populations along observable dimensions (platform, geography, language) or inferred dimensions (behavioral clusters, affinity groups). Each tier has different confidence and reveals different dynamics.",
    methodology: "All comparisons normalized to distributional shares, not raw counts. A population that posts 50× more is not shown as having 50× more influence — we compare what fraction of each group's conversation a claim occupies.",
    caveat: "Only Platform lens is currently active. Other lenses require additional data sources but are documented here to communicate the analytical framework."
  }
};
