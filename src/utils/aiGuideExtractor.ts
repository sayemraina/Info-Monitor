import type { Cluster, NarrativeEvent } from '../types'
import type { FocusedComponent } from '../hooks/useAIGuide'

/**
 * Extract the most interesting cluster from landscape data
 * Priority: highest momentum or arousal
 */
export function extractInterestingCluster(
  clusters: Cluster[],
  topicName?: string
): FocusedComponent {
  if (!clusters || clusters.length === 0) return null

  // Find cluster with highest combined score (mutation + arousal)
  const scored = clusters.map((cluster) => ({
    cluster,
    score: cluster.mutation_magnitude + cluster.arousal_value,
  }))

  scored.sort((a, b) => b.score - a.score)

  return {
    type: 'cluster',
    data: scored[0].cluster,
    topicName,
  }
}

/**
 * Extract the most interesting event from timeline data
 * Priority: high severity events first
 */
export function extractInterestingEvent(
  events: NarrativeEvent[],
  topicName?: string
): FocusedComponent {
  if (!events || events.length === 0) return null

  // Sort by severity (high > medium > low) then confidence
  const sorted = [...events].sort((a, b) => {
    const severityOrder = { high: 3, medium: 2, low: 1 }
    const severityDiff = severityOrder[b.severity] - severityOrder[a.severity]
    if (severityDiff !== 0) return severityDiff
    return b.confidence - a.confidence
  })

  return {
    type: 'event',
    data: sorted[0],
    topicName,
  }
}

/**
 * Pick the best component to teach about from current view
 * Strategy: events are more interesting than clusters (they're signals)
 */
export function pickComponentToTeach(
  clusters: Cluster[] | undefined,
  events: NarrativeEvent[] | undefined,
  topicName?: string
): FocusedComponent {
  // Prefer high-severity events over clusters
  const event = events && events.length > 0 ? extractInterestingEvent(events, topicName) : null
  if (event && (event.data as NarrativeEvent).severity === 'high') {
    return event
  }

  // Fall back to interesting cluster
  const cluster = clusters && clusters.length > 0 ? extractInterestingCluster(clusters, topicName) : null
  if (cluster) return cluster

  // Fall back to any event
  if (event) return event

  return null
}
