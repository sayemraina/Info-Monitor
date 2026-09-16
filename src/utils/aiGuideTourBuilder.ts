import type { Claim, Cluster, NarrativeEvent, TopicSummary } from '../types'
import type { TourStep } from '../hooks/useAIGuide'

/**
 * Build a guided tour sequence from available data.
 * Creates action-based steps that guide user through the ACTUAL interface.
 *
 * Level 0 tour: Pick most important topic → navigate → Level 1 tour
 * Level 1 tour: Guide through landscape/clusters/events using actual claim texts
 */
export function buildTour(
  clusters: Cluster[] | undefined,
  events: NarrativeEvent[] | undefined,
  topicName?: string,
  level?: number,
  topics?: TopicSummary[],
  claims?: Claim[]
): TourStep[] {
  if (level === 0 && topics && topics.length > 0) {
    return buildLevel0Tour(topics)
  }

  return buildLevel1Tour(clusters, events, topicName, claims)
}

/**
 * Build Level 0 tour: Analyze topics → pick most important → navigate to it
 */
function buildLevel0Tour(topics: TopicSummary[]): TourStep[] {
  const steps: TourStep[] = []

  const scoredTopics = topics.map(topic => {
    let score = 0
    if (topic.contestation_level === 'high') score += 100
    else if (topic.contestation_level === 'medium') score += 50
    if (topic.contestation_emergence) {
      const hoursAgo = topic.contestation_emergence.emerged_hours_ago
      if (hoursAgo < 6) score += 50
      else if (hoursAgo < 24) score += 25
    }
    score += topic.cluster_count * 2
    score += (topic.key_signal ? 20 : 0)
    if (topic.headline_divergence.jsd > 0.5) score += 30
    return { topic, score }
  })

  scoredTopics.sort((a, b) => b.score - a.score)
  const selectedTopic = scoredTopics[0]?.topic

  if (!selectedTopic) return steps

  steps.push({
    explanation: `Looking across all ${topics.length} topics in the system...`,
    durationSeconds: 6,
  })

  const reason = selectedTopic.contestation_level === 'high'
    ? 'it shows the highest contestation right now — multiple competing narratives actively in conflict'
    : selectedTopic.contestation_emergence
    ? `contestation emerged ${selectedTopic.contestation_emergence.emerged_hours_ago < 24 ? 'in the last 24 hours' : 'recently'} — a topic that was quiet and suddenly isn't`
    : selectedTopic.headline_divergence.jsd > 0.5
    ? `it shows significant narrative divergence (JSD ${selectedTopic.headline_divergence.jsd.toFixed(2)}) — different populations are discussing it very differently`
    : 'it has the most active signals right now'

  steps.push({
    explanation: `The most critical topic right now is "${selectedTopic.name}" — ${reason}. Taking you there now.`,
    actions: [
      { type: 'navigate_topic', topicId: selectedTopic.id }
    ],
    durationSeconds: 10,
  })

  return steps
}

/**
 * Get up to n representative claim texts for a cluster.
 * Prefers high-confidence claims, deduplicates by text prefix.
 */
function getRepresentativeClaims(
  claims: Claim[] | undefined,
  clusterId: string,
  n: number = 2
): string[] {
  if (!claims || claims.length === 0) return []

  const clusterClaims = claims.filter(c => c.cluster_id === clusterId)
  if (clusterClaims.length === 0) return []

  const arousalScore = (a: string) =>
    a === 'high' ? 0.3 : a === 'medium' ? 0.15 : 0

  const sorted = [...clusterClaims].sort((a, b) => {
    const scoreA = (a.confidence ?? 0) + arousalScore(a.arousal ?? 'low')
    const scoreB = (b.confidence ?? 0) + arousalScore(b.arousal ?? 'low')
    return scoreB - scoreA
  })

  const seen = new Set<string>()
  const result: string[] = []
  for (const c of sorted) {
    const key = c.text.slice(0, 60).toLowerCase()
    if (!seen.has(key) && c.text.trim()) {
      seen.add(key)
      result.push(c.text.trim())
    }
    if (result.length >= n) break
  }
  return result
}

/**
 * Format mutation direction into a plain-language phrase.
 */
function getMutationPhrase(direction: string, magnitude: number): string {
  const pct = Math.round(magnitude * 100)
  switch (direction) {
    case 'radicalizing':
      return `shifting toward more extreme language (${pct}% magnitude) — the framing is hardening`
    case 'mainstreaming':
      return `moving toward more moderate framing (${pct}% magnitude) — shedding extreme elements`
    case 'fragmenting':
      return `fragmenting (${pct}% magnitude) — the cluster is splitting into different directions`
    default:
      return `stable (${pct}% shift from origin)`
  }
}

/**
 * Format arousal trend into a plain-language phrase.
 */
function getArousalPhrase(trend: string, value: number): string {
  const pct = Math.round(value * 100)
  switch (trend) {
    case 'warming':
      return `emotional temperature rising (${pct}% arousal and climbing) — the language is getting angrier`
    case 'cooling':
      return `emotional temperature falling (${pct}% arousal, declining)`
    default:
      return `emotionally stable at ${pct}% arousal`
  }
}

/**
 * Build Level 1 tour: Walk through clusters and events using actual claim texts.
 * No hardcoded spatial references — the highlight action makes location obvious.
 */
function buildLevel1Tour(
  clusters: Cluster[] | undefined,
  events: NarrativeEvent[] | undefined,
  topicName?: string,
  claims?: Claim[]
): TourStep[] {
  const steps: TourStep[] = []

  const hasData = (clusters && clusters.length > 0) || (events && events.length > 0)
  if (!hasData) return steps

  const shownClusterIds = new Set<string>()

  // Step 1: Overview
  const clusterCount = clusters?.length ?? 0
  const eventCount = events?.length ?? 0
  steps.push({
    explanation: `Let's walk through what's happening in "${topicName}". There are ${clusterCount} distinct narrative clusters with ${eventCount} active signals. I'll highlight the most important ones.`,
    durationSeconds: 8,
  })

  // Step 2: Highest-severity event → scroll to it in ticker
  if (events && events.length > 0) {
    const highSevEvents = events
      .filter(e => e.severity === 'high')
      .sort((a, b) => b.confidence - a.confidence)

    if (highSevEvents.length > 0) {
      const event = highSevEvents[0]
      const typeLabel = getEventTypeLabel(event.type)

      steps.push({
        explanation: `First, the most critical signal in the timeline: a ${typeLabel}. ${event.summary}. Severity: high, detected with ${Math.round(event.confidence * 100)}% confidence. This is in the signal ticker at the bottom — I've scrolled to it.`,
        actions: [{ type: 'scroll_zone_d', eventId: event.id }],
        durationSeconds: 12,
      })
    }
  }

  // Step 3: Most notable mutating cluster — with actual claim texts
  if (clusters && clusters.length > 0) {
    const mutatingClusters = clusters
      .filter(c => c.mutation_direction !== 'stable')
      .sort((a, b) => b.mutation_magnitude - a.mutation_magnitude)

    if (mutatingClusters.length > 0) {
      const cluster = mutatingClusters[0]
      shownClusterIds.add(cluster.id)

      const repClaims = getRepresentativeClaims(claims, cluster.id, 2)
      const claimLine = repClaims.length > 0
        ? ` This cluster contains claims like: "${repClaims[0]}"${repClaims[1] ? ` and "${repClaims[1]}"` : ''}.`
        : ''

      const mutationPhrase = getMutationPhrase(
        cluster.mutation_direction,
        cluster.mutation_magnitude
      )

      steps.push({
        explanation: `Now look at the highlighted cluster — "${cluster.label}" with ${cluster.member_count} claims.${claimLine} It's currently ${mutationPhrase}. Watch the mutation badge on the terrain.`,
        actions: [
          { type: 'highlight_cluster', clusterId: cluster.id, durationMs: 15000 }
        ],
        durationSeconds: 14,
      })
    }
  }

  // Step 4: Coordination flag event if present
  if (events && events.length > 0) {
    const coordEvent = events.find(e => e.type === 'coordination_flag')
    if (coordEvent) {
      steps.push({
        explanation: `There's a coordination signal worth noting: ${coordEvent.summary}. This means the system detected a timing or similarity anomaly — multiple accounts, similar content, narrow window. That's a statistical flag, not proof of intent. Worth your attention.`,
        actions: [{ type: 'scroll_zone_d', eventId: coordEvent.id }],
        durationSeconds: 13,
      })
    }
  }

  // Step 5: Warming arousal cluster (only if different from mutation cluster)
  if (clusters && clusters.length > 0) {
    const warmingClusters = clusters
      .filter(c => c.arousal_trend === 'warming')
      .sort((a, b) => b.arousal_value - a.arousal_value)

    if (warmingClusters.length > 0) {
      const cluster = warmingClusters[0]

      if (!shownClusterIds.has(cluster.id)) {
        shownClusterIds.add(cluster.id)

        const repClaims = getRepresentativeClaims(claims, cluster.id, 1)
        const claimLine = repClaims.length > 0
          ? ` People in this cluster are saying things like: "${repClaims[0]}".`
          : ''

        const arousalPhrase = getArousalPhrase(cluster.arousal_trend, cluster.arousal_value)

        steps.push({
          explanation: `One more cluster to watch: "${cluster.label}" — ${arousalPhrase}.${claimLine} Notice the glow on those nodes in the landscape. When the arousal rises while the argument stays the same, that's an escalation signal.`,
          actions: [
            { type: 'highlight_cluster', clusterId: cluster.id, durationMs: 15000 }
          ],
          durationSeconds: 13,
        })
      }
    }
  }

  // Step 6: Synthesis
  const highSevCount = events?.filter(e => e.severity === 'high').length ?? 0
  let synthesis = `That's the overview. ${clusterCount} distinct narrative clusters, ${eventCount} active signals`
  if (highSevCount > 0) {
    synthesis += `, ${highSevCount} of them high severity`
  }
  synthesis += `. Click any cluster in the landscape to see what people inside it are actually saying, or ask me anything about what you're seeing.`

  steps.push({
    explanation: synthesis,
    durationSeconds: 10,
  })

  return steps
}

/**
 * Human-readable event type labels
 */
function getEventTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    momentum_spike: 'rapid momentum surge',
    divergence_shift: 'divergence shift',
    coordination_flag: 'coordination signal',
    contestation_emergence: 'contestation emergence',
    claim_dark: 'claim going dark',
    arousal_escalation: 'arousal escalation',
    phase_transition: 'narrative phase transition',
    lead_lag: 'cross-platform lead-lag pattern',
    vocabulary_rotation: 'vocabulary rotation',
  }
  return labels[type] ?? 'signal'
}
