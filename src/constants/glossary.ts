export const GLOSSARY = {
  SemanticLayout: {
    what: "Clusters are positioned by semantic similarity — how closely related their claims are in meaning.",
    soWhat: "Clusters near each other share overlapping narrative territory. Clusters far apart are semantically distinct. Only relative distance matters — the axes have no inherent meaning.",
    how: "Claim embeddings are mapped to 2D using UMAP, which preserves distances from high-dimensional semantic space. Claims with similar language, framing, and subjects land near each other.",
  },
  ClaimLandscape: {
    what: "Claims making similar arguments cluster into narrative threads.",
    soWhat: "Dot size = salience, color = momentum, glow = arousal. Hulls group claims into named clusters.",
    how: "Claims are embedded into semantic space by similarity. Proximity = conceptual closeness.",
  },
  NarrativeCluster: {
    what: "A group of claims making similar arguments about the same narrative thread. Named by its dominant theme.",
    soWhat: "Large clusters = dominant narratives. Small clusters = emerging or fringe positions.",
    how: "Claims are grouped by semantic similarity. Member count shows how many distinct claims share this framing.",
  },
  Salience: {
    what: "How visible a claim is within a population — its share of the conversation.",
    soWhat: "High → dominant narrative. Low → fringe or fading.",
    how: "Distributional share with shrinkage to prevent small-sample volatility.",
  },
  Momentum: {
    what: "How fast a claim is rising or falling in prominence.",
    soWhat: "High → rapid narrative shift. Low → stable or fading.",
    how: "Salience percentile change between consecutive time windows.",
  },
  Arousal: {
    what: "Emotional temperature — moral outrage and fear vs. clinical detachment.",
    soWhat: "Rising → escalation risk. Cooling → discourse normalizing.",
    how: "LLM-classified per claim, aggregated per concept over time.",
  },
  Mutation: {
    what: "How a narrative is evolving — mainstreaming, radicalizing, or fragmenting.",
    soWhat: "Mainstreaming → consensus forming. Radicalizing → fringe hardening.",
    how: "Concept centroid movement relative to the overall claim-space center.",
  },
  Confidence: {
    what: "How reliably the AI extracted this claim from raw, messy internet text.",
    soWhat: "Low → treat with caution. Dimmed claims may be sarcasm or misparse.",
    how: "Extraction score penalizing irony, quote-tweets, and ambiguous syntax.",
  },
  Friction: {
    what: "Active pushback a narrative is facing — disagreement and debunking.",
    soWhat: "High friction + high momentum → contested advance. Zero friction → echo chamber.",
    how: "Ratio of oppositional engagement to total engagement within a slice.",
  },
  Persistence: {
    what: "How long a narrative stays above the noise floor — flash trend vs. embedded belief.",
    soWhat: "High → structurally embedded. Low → transient spike.",
    how: "Consecutive windows a claim holds above the 50th salience percentile.",
  },
  SourceDiversity: {
    what: "Whether a trend comes from many independent voices or a concentrated few.",
    soWhat: "Green → organic spread. Red → potential artificial amplification.",
    how: "Effective independent source count normalized by expected diversity for this volume.",
  },
  BridgeNodes: {
    what: "Accounts that cross-pollinate narratives across distinct communities.",
    soWhat: "Present → narrative is spreading across boundaries, not contained.",
    how: "Accounts with engagement across 3+ distinct structural communities.",
  },
  Divergence: {
    what: "How differently two populations discuss the same topic.",
    soWhat: "High → populations are in separate realities. Low → broad agreement.",
    how: "Jensen-Shannon Divergence (JSD) between slice claim distributions.",
  },
  InformationAsymmetry: {
    what: "Groups are exposed to entirely different sets of facts and claims.",
    soWhat: "High → filter-bubble effect. Each side doesn't see what the other sees.",
    how: "Max-to-min salience ratio for shared clusters across slices.",
  },
  InterpretiveDivergence: {
    what: "Groups see the same facts but rank their importance completely differently.",
    soWhat: "High → same evidence, opposite conclusions.",
    how: "Spearman rank correlation between salience rankings across slices.",
  },
  ParadigmaticDivergence: {
    what: "Groups operate in incompatible frameworks with almost zero shared ground.",
    soWhat: "High → no common language for resolution. Lowest-common-denominator debate.",
    how: "Overlap fraction of clusters with non-trivial mass in both slices.",
  },
  ExposureAsymmetry: {
    what: "One group's influential voices push a narrative that another group's voices ignore.",
    soWhat: "High → elite-driven gap. The divide is top-down, not grassroots.",
    how: "Claim presence in high-visibility accounts vs. absence in the other slice.",
  },
  Silence: {
    what: "A previously active narrative suddenly drops off while the topic stays alive.",
    soWhat: "May indicate suppression, narrative pivot, or strategic withdrawal.",
    how: "Near-zero salience drop while total topic volume remains stable.",
  },
  Expressibility: {
    what: "How comfortable people feel actively stating a position vs. quietly engaging.",
    soWhat: "Low → high social cost to express. Leading indicator of Overton shifts.",
    how: "Ratio of original posts expressing the claim to total engagements.",
  },
  CounterNarrative: {
    what: "The opposing argument that emerges when a dominant claim gains traction.",
    soWhat: "Strong counter → healthy discourse. Absent → narrative monopoly.",
    how: "Inverse momentum correlation + geometric opposition in embedding space.",
  },
  Coordination: {
    what: "Patterns suggesting artificial amplification rather than organic sharing.",
    soWhat: "Flagged → narrative may be manufactured. Always relative to baseline.",
    how: "Composite of burstiness, near-duplicates, cross-platform sync, and source concentration.",
  },
  TopicContestation: {
    what: "Whether a topic has genuine disagreement or broad consensus.",
    soWhat: "Contested → active fault line. Uncontested → settled or suppressed.",
    how: "Requires 2+ claim clusters with detectable semantic opposition.",
  },
  Burstiness: {
    what: "Content spreading too fast or too uniformly to be normal human sharing.",
    soWhat: "High → possible bot activity or coordinated campaign. Can also be breaking news.",
    how: "Inter-event timing regularity vs. topic-specific 14-day rolling baseline.",
  },
  NearDuplicate: {
    what: "Copy-pasted or nearly identical content appearing across many accounts.",
    soWhat: "High → coordinated messaging campaign. Low → organic rephrasing.",
    how: "Fraction of posts with >0.85 cosine similarity posted within 3 hours.",
  },
  CrossPlatformSync: {
    what: "Same talking points appearing on X, Reddit, and YouTube almost simultaneously.",
    soWhat: "Near-zero lag → likely coordinated. Hours of lag → organic spillover.",
    how: "Temporal cross-correlation of cluster volumes across platform slices.",
  },
  SourceDiversityAnomaly: {
    what: "High volume coming from suspiciously few accounts.",
    soWhat: "Flagged → artificial amplification, not genuine public interest.",
    how: "Gini impurity on source distribution vs. expected volume-diversity curve.",
  },
  PopulationPartitioning: {
    what: "Slicing data by population to reveal how different groups experience the same topic.",
    soWhat: "Different lenses expose different fault lines — platform, geography, behavior.",
    how: "Distributional shares, not raw counts. Normalized so volume doesn't equal influence.",
  },
};
