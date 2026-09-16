/**
 * AI Guide action types for spatial navigation.
 *
 * These actions allow the AI to highlight, navigate, and point to specific
 * visual elements in the InfoMonitor interface.
 */

export type AIGuideAction =
  | HighlightClusterAction
  | NavigateTopicAction
  | ScrollZoneDAction
  | SelectClaimAction

export interface HighlightClusterAction {
  type: 'highlight_cluster'
  clusterId: string
  durationMs?: number  // Default 3000ms
}

export interface NavigateTopicAction {
  type: 'navigate_topic'
  topicId: string
}

export interface ScrollZoneDAction {
  type: 'scroll_zone_d'
  eventType?: string  // Optional: scroll to specific event type
  eventId?: string    // Optional: scroll to specific event ID
}

export interface SelectClaimAction {
  type: 'select_claim'
  claimId: string
}

export interface AIGuideActionResult {
  success: boolean
  message?: string
}
