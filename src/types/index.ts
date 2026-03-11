// ============================================================================
// Narrative Monitoring System — Type Contracts
// Must match end-state v3 §8 exactly.
// This file is the single source of truth for data shapes between
// the Python pipeline and the React frontend.
// ============================================================================

// --- Core Domain Types ---

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
}

export interface Cluster {
  id: string
  concept_id: string
  label: string
  member_count: number
  mutation_direction: 'mainstreaming' | 'radicalizing' | 'fragmenting' | 'stable'
  mutation_magnitude: number // 0–1
  arousal_trend: 'warming' | 'cooling' | 'stable'
  arousal_value: number // 0–1
  adversarial_pairs: string[] // cluster IDs of detected opponents (stretch)
}

// --- Metric Types ---

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
}

export interface TopicMetrics {
  cluster_count: number
  contestation_level: 'high' | 'medium' | 'low'
  top_accelerating: { claim_id: string; momentum: MomentumExtended }
  most_persistent: { claim_id: string; persistence_windows: number }
  top_friction: { claim_id: string; friction: number }
  highest_arousal: { concept_id: string; arousal_trend: string }
  notable_mutation: { concept_id: string; direction: string } | null
}

export interface LandscapeData {
  claims: Claim[]
  clusters: Cluster[]
  positions: ClaimPosition[]
  topic_metrics: TopicMetrics
  adversarial_pairs?: AdversarialPair[]
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
  coordination: CoordinationCheck
  semantic_neighbors: Array<{ claim_id: string; similarity: number }>
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
}

// --- Shared UI Types ---

export type TimeWindow = '6h' | '24h' | '7d'

export interface TooltipContent {
  title: string
  calculation: string
  reading: string
  caveat?: string
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
}
