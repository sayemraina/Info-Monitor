/**
 * AI Guide action executor.
 *
 * Parses and executes actions from Claude responses.
 */

import type { AIGuideAction, AIGuideActionResult } from '../types/aiGuideActions'

export interface ActionExecutor {
  highlightCluster: (clusterId: string, durationMs?: number) => Promise<AIGuideActionResult>
  navigateTopic: (topicId: string) => Promise<AIGuideActionResult>
  scrollZoneD: (eventType?: string, eventId?: string) => Promise<AIGuideActionResult>
  selectClaim: (claimId: string) => Promise<AIGuideActionResult>
}

/**
 * Execute a single action.
 */
export async function executeAction(
  action: AIGuideAction,
  executor: ActionExecutor
): Promise<AIGuideActionResult> {
  try {
    switch (action.type) {
      case 'highlight_cluster':
        return await executor.highlightCluster(action.clusterId, action.durationMs)

      case 'navigate_topic':
        return await executor.navigateTopic(action.topicId)

      case 'scroll_zone_d':
        return await executor.scrollZoneD(action.eventType, action.eventId)

      case 'select_claim':
        return await executor.selectClaim(action.claimId)

      default:
        return {
          success: false,
          message: `Unknown action type: ${(action as any).type}`
        }
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Action execution failed'
    }
  }
}

/**
 * Execute multiple actions in sequence.
 */
export async function executeActions(
  actions: AIGuideAction[],
  executor: ActionExecutor
): Promise<AIGuideActionResult[]> {
  const results: AIGuideActionResult[] = []

  for (const action of actions) {
    const result = await executeAction(action, executor)
    results.push(result)

    // If an action fails, stop executing subsequent actions
    if (!result.success) {
      break
    }

    // Add small delay between actions for better UX
    await new Promise(resolve => setTimeout(resolve, 300))
  }

  return results
}

/**
 * Parse actions from Claude's response text.
 *
 * Actions are embedded in the response as special markers:
 * [ACTION:highlight_cluster:clu_123]
 * [ACTION:navigate_topic:ai-workplace]
 * [ACTION:scroll_zone_d:coordination_flag]
 * [ACTION:select_claim:clm_456]
 */
export function parseActionsFromText(text: string): {
  cleanText: string
  actions: AIGuideAction[]
} {
  const actionPattern = /\[ACTION:([^:]+):([^\]]+)\]/g
  const actions: AIGuideAction[] = []

  // Extract actions
  let match
  while ((match = actionPattern.exec(text)) !== null) {
    const [, actionType, actionData] = match

    switch (actionType) {
      case 'highlight_cluster':
        actions.push({ type: 'highlight_cluster', clusterId: actionData })
        break

      case 'navigate_topic':
        actions.push({ type: 'navigate_topic', topicId: actionData })
        break

      case 'scroll_zone_d':
        actions.push({ type: 'scroll_zone_d', eventType: actionData })
        break

      case 'select_claim':
        actions.push({ type: 'select_claim', claimId: actionData })
        break
    }
  }

  // Remove action markers from text
  const cleanText = text.replace(actionPattern, '').trim()

  return { cleanText, actions }
}
