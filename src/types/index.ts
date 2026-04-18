// ============================================================================
// Narrative Monitoring System — Type Contracts
// Must match end-state v3 §8 exactly.
// This file is the single source of truth for data shapes between
// the Python pipeline and the React frontend.
// ============================================================================

// --- Core Domain Types ---

export type SourceType = 'population' | 'elite_media' | 'think_tank' | 'government' | 'prediction_market' | 'event_signal'

export interface Claim {
  id: string
  text: string
  subject: string
  assertion: string
  framing: string
  stance: 'pro' | 'anti' | 'neutral' | 'ambiguous'
  confidence: number // 0–1
  arousal: 'high' | 'medium' | 'low'
  register: 'academic' | 'journalistic' | 'vernacular' | 'meme' | 'sarcastic' | 'formal'
  cluster_id: string
  concept_id: string
  first_seen_platform: string
  first_seen_timestamp: string // ISO8601
  source_type?: SourceType // Topology tag: population (Topology A) vs elite_media/think_tank (Topology B)
  platform_presence?: Record<string, number> // distributional share per platform, e.g. { x_platform: 0.82, reddit_platform: 0.45 }
}

// --- Event Signal Types (bypass extraction pipeline — served as-is) ---

export interface EventSignal {
  id: string
  source: string                    // "gdelt", "fred", "congress", "yahoo_finance", etc.
  source_type: SourceType
  type: string                      // "news_event", "economic_indicator", "bill_introduced", "price_movement", etc.
  title: string
  summary: string
  timestamp: string                 // ISO8601
  location?: { lat: number; lng: number; label: string }
  severity?: 'high' | 'medium' | 'low'
  value?: number                    // for numeric signals (prices, odds, CPI)
  change?: number                   // delta from previous
  url?: string
  topic_relevance: string[]         // which topic IDs this relates to
  metadata: Record<string, unknown>
}

export interface Cluster {
  id: string
  concept_id: string
  concept_label?: string
  label: string
  member_count: number
  mutation_direction: 'mainstreaming' | 'radicalizing' | 'fragmenting' | 'stable'
  mutation_magnitude: number // 0–1
  arousal_trend: 'warming' | 'cooling' | 'stable'
  arousal_value: number // 0–1
  adversarial_pairs: string[] // cluster IDs of detected opponents (stretch)
  influencer_seeding?: InfluencerSeeding
}

export interface Concept {
  id: string
  label: string
  cluster_ids: string[]
  member_count: number
  arousal_trend: 'warming' | 'cooling' | 'stable'
  arousal_value: number
  mutation_direction: 'mainstreaming' | 'radicalizing' | 'fragmenting' | 'stable'
  mutation_magnitude: number
}

// --- Metric Types ---

export interface InformationFluxIndex {
  value: number // 0–100, scaled √JSD between consecutive window distributions
  trend: 'increasing' | 'stable' | 'decreasing'
  sparkline: number[]
  confidence_interval: [number, number]
  // Entropic flux direction — zero free parameters, computed from same salience vectors
  entropy_delta: number // ΔH = H(p_t) − H(p_{t-1}). Positive = diversifying, negative = consolidating
  flux_character: 'consolidating' | 'diversifying' | 'reshuffling'
  flags: {
    coordination_detected: boolean
    arousal_escalating: boolean
  }
  temporal_window_pair: [string, string] // e.g., ["6h", "24h"] — windows being compared
}

export interface Situation {
  id: string
  severity: 'high' | 'medium' | 'low'
  summary: string // plain-language alert
  cluster_id: string // for cross-linking
  metric_basis: string // which rule triggered
}

export interface Metric {
  value: number
  confidence_interval: [number, number]
  baseline: 'global' | 'platform-local' | 'geo-local'
  time_window: TimeWindow
  sparkline: number[]
  source_distribution: 'production' | 'amplification' | 'estimated_exposure'
}

export interface MomentumExtended extends Metric {
  source_diversity: number // effective independent sources, normalized
  bridge_ratio: number // fraction of momentum from bridge nodes
  persistence_windows: number // consecutive windows above threshold
  friction: number // oppositional / total engagement
  friction_quadrant: FrictionQuadrant
}

export type FrictionQuadrant =
  | 'unopposed_advance'
  | 'contested_advance'
  | 'successful_suppression'
  | 'dead'

// --- Divergence Types ---

export interface DivergenceTypology {
  information_asymmetry: number // 0–1, continuous (salience ratio)
  interpretive: number // 0–1, continuous (rank correlation)
  paradigmatic: number // 0–1, continuous (support overlap)
  dominant_mode: string
  paradigmatic_caveat: boolean // true if extraction confidence differs across slices
}

export interface Divergence {
  jsd: number
  jsd_sqrt: number // true metric distance
  trend: number[] // sparkline
  typology: DivergenceTypology
}

// --- Slice Types ---

export interface Slice {
  id: string
  type: 'platform' | 'geography' | 'language' | 'behavioral'
  label: string // ALWAYS behavioral label, never demographic inference
  active_volume: number
  meets_minimum_threshold: boolean
  base_rate_weight: number
  is_influencer_framing: boolean // true for YouTube slices
}

// --- Event Types ---

export type EventType =
  | 'momentum_spike'
  | 'divergence_shift'
  | 'coordination_flag'
  | 'contestation_emergence'
  | 'claim_dark'
  | 'arousal_escalation'
  | 'phase_transition'
  | 'lead_lag'
  | 'vocabulary_rotation'

export interface NarrativeEvent {
  id: string
  type: EventType
  timestamp: string // ISO8601
  claim_id: string | null
  slice_id: string | null
  severity: 'low' | 'medium' | 'high'
  confidence: number
  summary: string // human-readable one-line description
  detail: Record<string, unknown> // type-specific payload
}

// --- Supply Chain Types ---

export interface SupplyChainHop {
  platform: string
  timestamp: string // ISO8601
  claim_id: string
  fidelity_to_origin: number // 0–1, embedding distance from earliest instance
  fidelity_to_previous: number // 0–1, embedding distance from previous hop
}

export interface SupplyChain {
  concept_id: string
  hops: SupplyChainHop[]
  observation_boundary: string | null // "No public antecedent detected" or null
}

// --- Adversarial Pair Types (Stretch Goal — v6 §3D) ---

export interface AdversarialPair {
  cluster_id_a: string
  cluster_id_b: string
  label_a: string
  label_b: string
  momentum_correlation: number // -1 to +1 (negative = inverse = adversarial signal)
  response_lag: {
    median_hours: number
    consistency: 'high' | 'medium' | 'low'
    interpretation: string // honest label, never causal assertion
  }
  mutation_evidence: {
    detected: boolean
    description: string
    confidence: number
  }
  confidence: number // 0–1
}

// --- Coordination Types ---

export interface CoordinationSignal {
  score: number
  organic_baseline: number
  severity: 'low' | 'medium' | 'high'
}

export interface CoordinationCheck {
  burstiness: CoordinationSignal
  near_duplicate: CoordinationSignal
  cross_platform_sync: CoordinationSignal
  source_diversity_anomaly: CoordinationSignal
}

// --- API Response Types ---

export interface ClaimPosition {
  claim_id: string
  x: number
  y: number
  momentum?: number // -1 to +1, emitted by data pipeline
  salience?: number
  friction?: number // 0–1, oppositional / total engagement
  persistence?: number // consecutive windows above threshold
}

export interface TopicMetrics {
  cluster_count: number
  contestation_level: 'high' | 'medium' | 'low'
  top_accelerating: { claim_id: string; momentum: MomentumExtended }
  most_persistent: { claim_id: string; persistence_windows: number }
  top_friction: { claim_id: string; friction: number }
  highest_arousal: { concept_id: string; arousal_trend: string }
  notable_mutation: { concept_id: string; direction: string } | null
  ifi: InformationFluxIndex
  situations: Situation[]
  influencer_impact?: InfluencerImpact
}

export interface LandscapeData {
  claims: Claim[]
  clusters: Cluster[]
  concepts?: Concept[]
  positions: ClaimPosition[]
  topic_metrics: TopicMetrics
  adversarial_pairs?: AdversarialPair[]
  available_slices?: Array<{ id: string; type: string; label: string }>
  available_pairs?: Array<[string, string]>
}

export interface ClaimDetail {
  claim: Claim
  momentum: MomentumExtended
  salience: Metric
  friction: Metric
  persistence: Metric
  arousal: Metric
  expressibility: Metric
  exposure: {
    production: Metric
    amplification: Metric
    estimated_exposure: Metric
  }
  confidence_detail: {
    score: number
    factors: string[]
  }
  provenance: {
    first_platform: string
    first_timestamp: string
    lead_lag: Array<{ platform: string; lag_hours: number }>
  }
  supply_chain: SupplyChain
  coordination?: CoordinationCheck
  semantic_neighbors: Array<{ claim_id: string; similarity: number; text?: string }>
  adversarial_pairs?: AdversarialPair[]
  example_content: Array<{
    text: string
    platform: string
    confidence: number
    is_influencer_framing: boolean
  }>
}

export interface PerClusterComparison {
  cluster_id: string
  label: string
  salience_a: number
  salience_b: number
  arousal_a: number
  arousal_b: number
  mutation_a: string
  mutation_b: string
}

export interface CompareData {
  slice_a: Slice
  slice_b: Slice
  divergence: Divergence
  per_cluster: PerClusterComparison[]
  arousal_comparison: { slice_a_avg: number; slice_b_avg: number }
  exposure_comparison: { slice_a: Metric; slice_b: Metric }
}

export interface TimelineData {
  events: NarrativeEvent[]
  total_count: number
}

// --- Topic Summary (Level 0) ---

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
  ifi?: { value: number; trend: string }
  top_situation?: { summary: string; severity: string }
  system_confidence?: number
  influencer_impact?: InfluencerImpact
}

// --- Level 0 Redesign Types ---

export interface GeoRegion {
  lat: number
  lng: number
  radius_km: number
  salience: number
  momentum: number
}

export interface GeoCluster {
  cluster_id: string
  cluster_label: string
  regions: GeoRegion[]
}

export interface TopicGeoData {
  topic_id: string
  geo_clusters: GeoCluster[]
}

export type ShaperRole =
  | 'frame_setter'
  | 'institutional'
  | 'primary_commentator'
  | 'counter_voice'
  | 'authentic_witness'
  | 'velocity_outlier'
  | 'supplementary'

export interface VideoMetadata {
  video_id: string
  title: string
  channel_name: string
  view_count: number
  published_at: string // ISO8601
  // Optional fields from discovery pipeline (not present in static demo data)
  tier?: 1 | 2 | 3
  composite_score?: number
  channel_subscribers?: number
  role?: ShaperRole // Narrative shaper role assigned by 6-slot selection
}

export interface DiscoursePost {
  platform: 'x' | 'reddit' | 'bluesky' | 'youtube'
  username: string
  text: string
  cluster_id: string
  system_tags: string[]
  extracted_at: string // ISO8601
}

export interface Level0State {
  activeTopic: string
  isLocked: boolean
  rotationTimer: number
}

// --- Shared UI Types ---

export type TimeWindow = '6h' | '24h' | '7d'

export interface TooltipContent {
  title: string
  calculation: string
  reading: string
  caveat?: string
}

// --- Entry Hint (Level 0 → Level 1 continuity) ---

export type EntryHint =
  | 'ifi'
  | 'contestation'
  | 'situation'
  | 'signal'
  | 'sparkline'
  | 'diversity'
  | 'map_cta'
  | 'youtube_cta'
  | 'discourse'
  | 'explore'
  | 'map_hotspot'

// --- Influencer Impact Types ---

export interface InfluencerSeeding {
  influencer_seeded: boolean
  influencer_origin_count: number
  influencer_salience_contribution: number
  avg_propagation_hours: { x: number; reddit: number }
}

export interface InfluencerImpact {
  seeded_cluster_count: number
  total_clusters: number
  influencer_salience_share: number
  direction: 'top_down' | 'bottom_up' | 'mixed'
  avg_propagation_x: number
  avg_propagation_reddit: number
}

// --- App State ---

export interface AppState {
  level: 0 | 1 | 2
  selectedTopicId: string | null
  selectedClaimId: string | null
  timeWindow: TimeWindow
  compareMode: boolean
  selectedSlices: [string, string] | null
  eventTypeFilter: EventType | 'all'
  searchQuery: string
  entryHint?: EntryHint
  entryClusterId?: string
}
