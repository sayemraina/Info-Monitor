import { useEffect } from 'react'
import { useAIGuide } from '../../hooks/useAIGuide'
import { useLandscape } from '../../hooks/useLandscape'
import { useTimeline } from '../../hooks/useTimeline'
import { useTopics } from '../../hooks/useTopics'
import { pickComponentToTeach } from '../../utils/aiGuideExtractor'
import { buildTour } from '../../utils/aiGuideTourBuilder'
import type { TimeWindow } from '../../types'

interface AIGuideSyncProps {
  topicId: string | null
  timeWindow: TimeWindow
  level: number
  compareMode: boolean
  selectedSlices: [string, string] | null
}

/**
 * Syncs app state with AI Guide and auto-selects interesting components
 * This component doesn't render anything - it's just for side effects
 */
export function AIGuideSync({
  topicId,
  timeWindow,
  level,
  compareMode,
  selectedSlices,
}: AIGuideSyncProps) {
  const {
    isJourneyActive,
    pacingMode,
    setViewState,
    setFocusedComponent,
    setTourSteps,
    focusedComponent,
    tourSteps,
    updateDwellLocation,
  } = useAIGuide()
  const { topics } = useTopics()

  // Only fetch data when journey is active and we have a topic
  const { landscape } = useLandscape(
    isJourneyActive && topicId ? topicId : null,
    timeWindow
  )
  const { events } = useTimeline(
    isJourneyActive && topicId ? topicId : null,
    timeWindow
  )

  // Sync view state whenever it changes
  useEffect(() => {
    setViewState({
      topic_id: topicId,
      level,
      timeWindow,
      compareMode,
      selectedSlices,
    })
  }, [topicId, level, timeWindow, compareMode, selectedSlices, setViewState])

  // Clear tour steps when level changes (separate effect to avoid loop)
  useEffect(() => {
    if (tourSteps.length > 0 && isJourneyActive && pacingMode === 'auto-tour') {
      console.log('[AIGuideSync] Level changed, clearing tour steps for rebuild')
      setTourSteps([])
    }
  }, [level]) // Only depend on level, not tourSteps.length!

  // Sync dwell location for dwell detection
  useEffect(() => {
    console.log('[AIGuideSync] Level/topic changed:', { level, topicId })
    updateDwellLocation({
      level,
      topicId,
      zone: null, // Zone tracking can be added later if needed
    })
  }, [level, topicId, updateDwellLocation])

  // Auto-select interesting component when journey starts (qa-mode and focus-mode)
  useEffect(() => {
    if (!isJourneyActive || !topicId) {
      return
    }

    // Auto-tour builds its own sequence, skip
    if (pacingMode === 'auto-tour') return

    // Only auto-select if nothing is focused yet
    if (focusedComponent) return

    // Wait for data to load
    if (!landscape || !events) return

    const topicName = topics.find((t) => t.id === topicId)?.name

    const component = pickComponentToTeach(landscape.clusters, events, topicName)
    if (component) {
      setFocusedComponent(component)
    }
  }, [
    isJourneyActive,
    topicId,
    pacingMode,
    landscape,
    events,
    focusedComponent,
    topics,
    setFocusedComponent,
  ])

  // Build tour sequence for auto-tour mode
  useEffect(() => {
    console.log('[AIGuideSync] Auto-tour check:', {
      isJourneyActive,
      pacingMode,
      level,
      topicId,
      hasLandscape: !!landscape,
      hasEvents: !!events,
      tourStepsCount: tourSteps.length,
    })

    if (!isJourneyActive || pacingMode !== 'auto-tour') {
      console.log('[AIGuideSync] Auto-tour conditions not met, skipping')
      return
    }

    // Only build tour once per level/topic combination
    if (tourSteps.length > 0) {
      console.log('[AIGuideSync] Tour already built, skipping')
      return
    }

    // Level 0: Overview tour (pick topic and navigate)
    if (level === 0) {
      if (!topics || topics.length === 0) {
        console.log('[AIGuideSync] Waiting for topics to load...')
        return
      }

      console.log('[AIGuideSync] Building Level 0 tour with', topics.length, 'topics')
      try {
        const steps = buildTour(undefined, undefined, undefined, 0, topics)
        console.log('[AIGuideSync] Level 0 tour steps generated:', steps)

        if (steps.length > 0) {
          setTourSteps(steps)
          console.log('[AIGuideSync] Level 0 tour built:', steps.length, 'steps')
        } else {
          console.warn('[AIGuideSync] Level 0 buildTour returned empty steps')
        }
      } catch (error) {
        console.error('[AIGuideSync] Error building Level 0 tour:', error)
      }
      return
    }

    // Level 1: Topic-specific tour (landscape/zones)
    if (level === 1 && topicId) {
      // Wait for data to load
      if (!landscape || !events) {
        console.log('[AIGuideSync] Waiting for Level 1 data to load...')
        return
      }

      console.log('[AIGuideSync] Building Level 1 tour with:', {
        clusters: landscape.clusters?.length,
        events: events.length,
        topicId,
      })

      const topicName = topics.find((t) => t.id === topicId)?.name
      const steps = buildTour(landscape.clusters, events, topicName, 1, topics, landscape.claims)

      console.log('[AIGuideSync] Level 1 tour built:', steps.length, 'steps')

      if (steps.length > 0) {
        setTourSteps(steps)
        console.log('[AIGuideSync] Tour steps set!')
      } else {
        console.warn('[AIGuideSync] No steps generated from buildTour')
      }
    }
  }, [
    isJourneyActive,
    pacingMode,
    level,
    topicId,
    landscape,
    events,
    tourSteps.length,
    topics,
    setTourSteps,
  ])

  return null
}
