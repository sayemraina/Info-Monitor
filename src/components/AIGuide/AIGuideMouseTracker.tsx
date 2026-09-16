import { useEffect } from 'react'
import { useAIGuide } from '../../hooks/useAIGuide'

/**
 * Tracks mouse activity for dwell detection.
 *
 * Listens for:
 * - Mouse movement (general exploration)
 * - Hover on clusters (pause timer)
 * - Clicks on claims/clusters (cancel timer)
 */
export function AIGuideMouseTracker() {
  const { trackMouseActivity, setHoverState, markInteraction, briefingActive } = useAIGuide()

  useEffect(() => {
    if (briefingActive) {
      console.log('[MouseTracker] Briefing active, not tracking')
      return
    }

    console.log('[MouseTracker] Initialized and tracking')

    // Track general mouse movement
    const handleMouseMove = () => {
      trackMouseActivity()
    }

    // Track hover on specific elements (clusters, claims)
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement

      // Check if hovering on cluster node (D3 renders as circle/g elements)
      const clusterNode = target.closest('[data-cluster-id]')
      if (clusterNode) {
        const clusterId = clusterNode.getAttribute('data-cluster-id')
        console.log('[MouseTracker] Hovering on cluster:', clusterId)
        setHoverState({
          isHovering: true,
          elementType: 'cluster',
          elementId: clusterId,
        })
        return
      }

      // Check if hovering on claim (if claims have data-claim-id)
      const claimNode = target.closest('[data-claim-id]')
      if (claimNode) {
        const claimId = claimNode.getAttribute('data-claim-id')
        console.log('[MouseTracker] Hovering on claim:', claimId)
        setHoverState({
          isHovering: true,
          elementType: 'claim',
          elementId: claimId,
        })
        return
      }

      // Not hovering on anything specific (log only on transitions)
      setHoverState({
        isHovering: false,
        elementType: null,
        elementId: null,
      })
    }

    // Track clicks on specific elements (marks as interacted)
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement

      // If clicking on cluster or claim, mark as interacted
      if (target.closest('[data-cluster-id]') || target.closest('[data-claim-id]')) {
        markInteraction()
      }
    }

    // Add listeners
    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mouseover', handleMouseOver, { passive: true })
    document.addEventListener('click', handleClick)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseover', handleMouseOver)
      document.removeEventListener('click', handleClick)
    }
  }, [briefingActive, trackMouseActivity, setHoverState, markInteraction])

  return null
}
