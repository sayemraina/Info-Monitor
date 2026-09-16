import { create } from 'zustand'
import type { Cluster, NarrativeEvent } from '../types'
import type { AIGuideAction } from '../types/aiGuideActions'
import type { ActionExecutor } from '../utils/aiGuideActionsExecutor'
import { parseActionsFromText, executeActions } from '../utils/aiGuideActionsExecutor'

export type Message = {
  role: 'user' | 'assistant'
  content: string
  isError?: boolean
}

export type FocusedComponent = {
  type: 'cluster' | 'event' | 'claim'
  data: Cluster | NarrativeEvent | any
  topicName?: string
} | null

export type ViewState = {
  topic_id: string | null
  level: number
  timeWindow: string
  compareMode?: boolean
  selectedSlices?: [string, string] | null
}

export type TourStep = {
  explanation: string
  actions?: AIGuideAction[]
  durationSeconds: number
}

export type BriefingMode = 'auto-sequence' | 'query' | 'ambient' | null

export type DwellLocation = {
  level: number
  topicId: string | null
  zone: string | null // 'zone-a' | 'zone-b' | 'zone-c' | 'zone-d' | null
}

export type HoverState = {
  isHovering: boolean
  elementType: 'cluster' | 'claim' | null
  elementId: string | null
}

type AIGuideState = {
  // Legacy modal state (keep for backward compatibility during migration)
  isModalOpen: boolean
  isJourneyActive: boolean

  // NEW: Briefing system state
  briefingActive: boolean
  briefingMode: BriefingMode
  sessionStartTime: string

  // Conversation
  messages: Message[]
  sessionId: string
  isStreaming: boolean

  // Context preservation
  lastViewedComponent: FocusedComponent

  // Pacing (legacy, will map to briefingMode)
  pacingMode: 'auto-tour' | 'qa-mode' | 'focus-mode' | null

  // Auto-tour state
  tourSteps: TourStep[]
  currentStepIndex: number
  tourPaused: boolean
  autoAdvanceTimer: ReturnType<typeof setTimeout> | null

  // Current component being shown
  focusedComponent: FocusedComponent

  // View state (for context building)
  viewState: ViewState

  // Dwell detection state
  dwellLocation: DwellLocation
  dwellStartTime: number | null
  dwellTimer: ReturnType<typeof setTimeout> | null
  promptVisible: boolean
  promptDismissed: boolean
  hasVisitedLocations: Set<string>

  // Mouse activity tracking
  lastMouseActivity: number | null
  hoverState: HoverState
  hasInteracted: boolean  // True if user clicked on specific element

  // Action execution
  actionExecutor: ActionExecutor | null

  // Legacy actions (keep for backward compatibility)
  openModal: () => void
  closeModal: () => void
  startJourney: () => void
  exitJourney: () => void
  sendMessage: (text: string) => Promise<void>
  setPacingMode: (mode: 'auto-tour' | 'qa-mode' | 'focus-mode') => void
  setFocusedComponent: (component: FocusedComponent) => void
  setViewState: (state: Partial<ViewState>) => void

  // NEW: Briefing system actions
  openBriefing: () => void
  startBriefing: (mode: BriefingMode) => void
  switchMode: (newMode: BriefingMode) => void
  exitBriefing: () => void
  preserveContext: () => void

  // Auto-tour actions
  setTourSteps: (steps: TourStep[]) => void
  startTourStep: (index: number) => Promise<void>
  nextStep: () => void
  prevStep: () => void
  pauseTour: () => void
  resumeTour: () => void
  startAutoAdvance: () => void
  stopAutoAdvance: () => void

  // Dwell detection actions
  updateDwellLocation: (location: DwellLocation) => void
  dismissPrompt: () => void
  acceptPrompt: () => void
  resetDwellTimer: () => void

  // Mouse activity actions
  trackMouseActivity: () => void
  setHoverState: (hover: HoverState) => void
  markInteraction: () => void

  // Action execution
  setActionExecutor: (executor: ActionExecutor) => void
}

// Generate session ID (intelligence format: AI-XXXXXX)
function generateSessionId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const id = Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')
  return `AI-${id}`
}

export const useAIGuide = create<AIGuideState>((set, get) => ({
  // Legacy state
  isModalOpen: false,
  isJourneyActive: false,

  // NEW: Briefing system state
  briefingActive: false,
  briefingMode: null,
  sessionStartTime: new Date().toISOString(),

  // Conversation
  messages: [],
  sessionId: generateSessionId(),
  isStreaming: false,

  // Context
  lastViewedComponent: null,
  focusedComponent: null,

  // Legacy pacing
  pacingMode: null,

  // Auto-tour
  tourSteps: [],
  currentStepIndex: 0,
  tourPaused: false,
  autoAdvanceTimer: null,

  // View state
  viewState: {
    topic_id: null,
    level: 0,
    timeWindow: '24h',
  },

  // Dwell detection state (initialize with invalid state so first update triggers)
  dwellLocation: {
    level: -1, // Invalid level so first update triggers timer
    topicId: null,
    zone: null,
  },
  dwellStartTime: null,
  dwellTimer: null,
  promptVisible: false,
  promptDismissed: false,
  hasVisitedLocations: new Set(),

  // Mouse activity tracking
  lastMouseActivity: null,
  hoverState: {
    isHovering: false,
    elementType: null,
    elementId: null,
  },
  hasInteracted: false,

  // Action execution
  actionExecutor: null,

  openModal: () => {
    set({ isModalOpen: true })
  },

  closeModal: () => {
    get().stopAutoAdvance()
    set({ isModalOpen: false, isJourneyActive: false })
  },

  startJourney: () => {
    set({ isModalOpen: false, isJourneyActive: true })
  },

  exitJourney: () => {
    get().stopAutoAdvance()
    set({
      isJourneyActive: false,
      focusedComponent: null,
      tourSteps: [],
      currentStepIndex: 0,
      tourPaused: false,
    })
  },

  setPacingMode: (mode) => {
    set({ pacingMode: mode })
  },

  setFocusedComponent: (component) => {
    set({ focusedComponent: component })
  },

  setViewState: (state) => {
    set({ viewState: { ...get().viewState, ...state } })
  },

  // NEW: Briefing system actions
  openBriefing: () => {
    set({
      briefingActive: true,
      briefingMode: null, // Show mode selector first
      sessionId: generateSessionId(),
      sessionStartTime: new Date().toISOString(),
    })
  },

  startBriefing: (mode) => {
    set({
      briefingMode: mode,
      isJourneyActive: mode !== 'ambient', // Auto-sequence and query are "journey" modes
    })

    // Map to legacy pacingMode for backward compatibility
    if (mode === 'auto-sequence') {
      set({ pacingMode: 'auto-tour' })
      // Auto-sequence will build tour steps automatically via AIGuideSync
    } else if (mode === 'query') {
      set({ pacingMode: 'qa-mode' })
    } else if (mode === 'ambient') {
      set({ pacingMode: 'focus-mode' })
    }
  },

  switchMode: (newMode) => {
    const { focusedComponent } = get()

    // Clear messages when switching modes
    set({
      lastViewedComponent: focusedComponent,
      briefingMode: newMode,
      isJourneyActive: newMode !== 'ambient',
      messages: [], // Clear previous mode's messages
    })

    // Map to legacy pacingMode
    if (newMode === 'auto-sequence') {
      set({ pacingMode: 'auto-tour' })
      // Auto-sequence will build tour steps automatically via AIGuideSync
    } else if (newMode === 'query') {
      set({ pacingMode: 'qa-mode' })
    } else if (newMode === 'ambient') {
      set({ pacingMode: 'focus-mode' })
    }
  },

  exitBriefing: () => {
    get().stopAutoAdvance()
    set({
      briefingActive: false,
      briefingMode: null,
      isJourneyActive: false,
      isModalOpen: false,
      focusedComponent: null,
      lastViewedComponent: null,
      tourSteps: [],
      currentStepIndex: 0,
      tourPaused: false,
      messages: [],
      pacingMode: null,
      // Reset dwell detection flags so prompt can appear again
      hasInteracted: false,
      promptDismissed: false,
      promptVisible: false,
    })
    console.log('[AIGuide] Briefing exited, dwell flags reset')
  },

  preserveContext: () => {
    const { focusedComponent } = get()
    set({ lastViewedComponent: focusedComponent })
  },

  setTourSteps: (steps) => {
    console.log('[AIGuide] setTourSteps called with', steps.length, 'steps')
    set({ tourSteps: steps, currentStepIndex: 0 })

    // If in auto-tour mode, start first step
    if (get().pacingMode === 'auto-tour' && steps.length > 0) {
      console.log('[AIGuide] Starting first tour step')
      get().startTourStep(0)
    } else {
      console.log('[AIGuide] Not in auto-tour mode or no steps, skipping setup')
    }
  },

  startTourStep: async (index: number) => {
    const { tourSteps, actionExecutor } = get()
    if (index >= tourSteps.length) {
      // Tour complete
      set({ tourSteps: [], currentStepIndex: 0 })
      return
    }

    const step = tourSteps[index]
    set({ currentStepIndex: index })

    console.log('[AIGuide] Starting step', index + 1, '/', tourSteps.length)

    // Execute actions if present and wait for completion
    if (step.actions && step.actions.length > 0 && actionExecutor) {
      console.log('[AIGuide] Executing', step.actions.length, 'actions')
      await executeActions(step.actions, actionExecutor)
      console.log('[AIGuide] Actions completed')

      // Small delay after actions complete before starting timer
      await new Promise(resolve => setTimeout(resolve, 300))
    }

    // Start auto-advance timer ONLY if tour hasn't been paused while actions were running
    if (!get().tourPaused) {
      get().startAutoAdvance()
    } else {
      console.log('[AIGuide] Tour was paused during action execution, not starting auto-advance')
    }
  },

  nextStep: () => {
    const { tourSteps, currentStepIndex } = get()
    const nextIndex = currentStepIndex + 1

    console.log('[AIGuide] nextStep called, current:', currentStepIndex, 'next:', nextIndex, 'total:', tourSteps.length)

    if (nextIndex >= tourSteps.length) {
      // Tour complete - panel stays open per user request
      console.log('[AIGuide] Tour complete')
      get().stopAutoAdvance()
      set({ tourPaused: true })
      return
    }

    // Stop current auto-advance timer before starting next step
    get().stopAutoAdvance()

    // Start next step (which handles actions + timer)
    get().startTourStep(nextIndex)

    // Restart auto-advance if not paused
    if (!get().tourPaused) {
      get().startAutoAdvance()
    }
  },

  prevStep: () => {
    const { currentStepIndex } = get()

    console.log('[AIGuide] prevStep called, current:', currentStepIndex)

    if (currentStepIndex <= 0) {
      console.log('[AIGuide] Already at first step, cannot go back')
      return
    }

    // Stop current auto-advance timer before starting previous step
    get().stopAutoAdvance()

    // Start previous step (which handles actions + timer)
    get().startTourStep(currentStepIndex - 1)

    // Restart auto-advance if not paused
    if (!get().tourPaused) {
      get().startAutoAdvance()
    }
  },

  pauseTour: () => {
    set({ tourPaused: true })
    get().stopAutoAdvance()
  },

  resumeTour: () => {
    set({ tourPaused: false })
    get().startAutoAdvance()
  },

  startAutoAdvance: () => {
    get().stopAutoAdvance() // Clear any existing timer

    const { tourSteps, currentStepIndex } = get()
    if (currentStepIndex >= tourSteps.length) return

    const currentStep = tourSteps[currentStepIndex]
    const timer = setTimeout(() => {
      get().nextStep()
    }, currentStep.durationSeconds * 1000)

    set({ autoAdvanceTimer: timer })
  },

  stopAutoAdvance: () => {
    const { autoAdvanceTimer } = get()
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer)
      set({ autoAdvanceTimer: null })
    }
  },

  sendMessage: async (text: string) => {
    const { messages, sessionId, viewState } = get()

    // Add user message
    const userMsg: Message = { role: 'user', content: text }
    set({ messages: [...messages, userMsg], isStreaming: true })

    try {

      // Call backend API
      const response = await fetch('/api/ai-guide/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          view_state: viewState,
          messages: [...messages, userMsg],
        }),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      // Guard: backend must return an SSE stream. A 200 with HTML means the API
      // route is missing and the SPA fallback served index.html instead.
      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.includes('text/event-stream')) {
        throw new Error('AI Guide backend unavailable')
      }

      // Stream response
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let aiMsg: Message = { role: 'assistant', content: '' }
      let fullResponseText = ''

      // Add empty AI message to start streaming
      set({ messages: [...get().messages, aiMsg] })

      // Buffer partial lines: SSE events can split across TCP chunks.
      let buffer = ''
      let streamError: string | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? '' // keep incomplete trailing line for next chunk

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.error) {
              streamError = data.error
              continue
            }
            if (data.text) {
              fullResponseText += data.text
              aiMsg.content += data.text
              // Update last message
              const currentMessages = get().messages
              set({
                messages: [
                  ...currentMessages.slice(0, -1),
                  { ...aiMsg },
                ],
              })
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }

      // Backend reported an error mid-stream — surface it instead of a blank bubble.
      if (streamError) {
        const currentMessages = get().messages
        set({
          messages: [
            ...currentMessages.slice(0, -1),
            { role: 'assistant', content: streamError, isError: true },
          ],
          isStreaming: false,
        })
        return
      }

      // Stream produced nothing — surface it instead of a blank bubble.
      if (!fullResponseText) {
        const currentMessages = get().messages
        set({
          messages: [
            ...currentMessages.slice(0, -1),
            { role: 'assistant', content: "I didn't get a response. Try again in a moment?", isError: true },
          ],
          isStreaming: false,
        })
        return
      }

      // After streaming completes, parse and execute actions from response text
      const { actionExecutor } = get()
      if (actionExecutor && fullResponseText) {
        const { cleanText, actions } = parseActionsFromText(fullResponseText)

        // Update message with clean text (action markers removed)
        if (actions.length > 0) {
          aiMsg.content = cleanText
          const currentMessages = get().messages
          set({
            messages: [
              ...currentMessages.slice(0, -1),
              { ...aiMsg },
            ],
          })

          // Execute actions
          try {
            await executeActions(actions, actionExecutor)
          } catch (error) {
            console.error('Action execution error:', error)
          }
        }
      }

      set({ isStreaming: false })
    } catch (error) {
      console.error('AI Guide error:', error)
      const errorMsg: Message = {
        role: 'assistant',
        content: "I'm having trouble right now. Your question was logged. Try again in a moment?",
        isError: true,
      }
      set({ messages: [...get().messages, errorMsg], isStreaming: false })
    }
  },

  // Dwell detection actions
  updateDwellLocation: (location) => {
    const { dwellLocation, dwellTimer, hasVisitedLocations, promptDismissed, briefingActive, hasInteracted } = get()

    console.log('[Dwell] ===== UPDATE LOCATION =====')
    console.log('[Dwell] New location:', location)
    console.log('[Dwell] State:', { briefingActive, promptDismissed, hasInteracted })

    // Don't track if briefing is active, prompt was dismissed, or user has interacted
    if (briefingActive || promptDismissed || hasInteracted) {
      console.log('[Dwell] ❌ Skipping - already active/dismissed/interacted')
      return
    }

    // Build location key for tracking visits
    const locationKey = `${location.level}-${location.topicId || 'none'}-${location.zone || 'none'}`
    const prevLocationKey = `${dwellLocation.level}-${dwellLocation.topicId || 'none'}-${dwellLocation.zone || 'none'}`

    // If location changed, reset timer
    if (locationKey !== prevLocationKey) {
      // Clear existing timer
      if (dwellTimer) {
        clearTimeout(dwellTimer)
      }

      // Determine dwell threshold: 5s for first visit, 10s for return visits
      const hasVisited = hasVisitedLocations.has(locationKey)
      const threshold = hasVisited ? 10000 : 5000

      // Show prompt for Level 0 (overview) or Level 1 (topic view)
      if (location.level === 0 || (location.level === 1 && location.topicId)) {
        const levelName = location.level === 0 ? 'Level 0 (overview)' : 'Level 1 (topic view)'
        console.log(`[Dwell] ✅ Valid location for dwelling: ${levelName}`)
        console.log(`[Dwell] 🕐 Starting timer, threshold:`, hasVisited ? '10s (return visit)' : '5s (first visit)')

        // Start intelligent timer that checks hover state periodically
        const startTime = Date.now()
        let accumulatedTime = 0

        const checkTimer = () => {
          const { hoverState, hasInteracted, briefingActive, promptDismissed } = get()

          // Cancel if user has interacted or prompt was dismissed
          if (hasInteracted || briefingActive || promptDismissed) {
            return
          }

          // If hovering on specific element, pause (don't accumulate time)
          if (hoverState.isHovering) {
            // Check again in 200ms
            setTimeout(checkTimer, 200)
            return
          }

          // Not hovering, accumulate time
          const now = Date.now()
          const elapsed = now - startTime
          accumulatedTime = elapsed

          // Check if threshold reached
          if (accumulatedTime >= threshold) {
            console.log('[Dwell] ✅ Threshold reached! Showing prompt')
            set({ promptVisible: true, dwellTimer: null })
            return
          }

          console.log('[Dwell] Check:', Math.round(accumulatedTime / 1000) + 's /', Math.round(threshold / 1000) + 's')

          // Check again in 200ms
          setTimeout(checkTimer, 200)
        }

        // Start the intelligent timer
        checkTimer()

        set({
          dwellLocation: location,
          dwellStartTime: Date.now(),
          dwellTimer: null, // Using checkTimer instead
          hasVisitedLocations: new Set([...hasVisitedLocations, locationKey]),
          lastMouseActivity: Date.now(),
        })
      } else {
        console.log('[Dwell] ❌ Invalid location - not Level 0 or Level 1 with topicId')
        set({
          dwellLocation: location,
          dwellStartTime: Date.now(),
          dwellTimer: null,
        })
      }
    }
  },

  dismissPrompt: () => {
    const { dwellTimer } = get()
    if (dwellTimer) {
      clearTimeout(dwellTimer)
    }
    set({
      promptVisible: false,
      promptDismissed: true,
      dwellTimer: null,
    })
  },

  acceptPrompt: () => {
    const { dwellTimer } = get()
    if (dwellTimer) {
      clearTimeout(dwellTimer)
    }
    set({
      promptVisible: false,
      dwellTimer: null,
    })
    // Open briefing and show mode selector
    get().openBriefing()
  },

  resetDwellTimer: () => {
    const { dwellTimer } = get()
    if (dwellTimer) {
      clearTimeout(dwellTimer)
    }
    set({
      dwellStartTime: null,
      dwellTimer: null,
      promptVisible: false,
    })
  },

  // Mouse activity actions
  trackMouseActivity: () => {
    const { briefingActive, promptDismissed } = get()
    if (briefingActive || promptDismissed) return

    set({ lastMouseActivity: Date.now() })
  },

  setHoverState: (hover) => {
    const { briefingActive, promptDismissed } = get()
    if (briefingActive || promptDismissed) return

    set({ hoverState: hover })
  },

  markInteraction: () => {
    const { dwellTimer } = get()

    // Cancel timer and mark as interacted
    if (dwellTimer) {
      clearTimeout(dwellTimer)
    }

    set({
      hasInteracted: true,
      promptVisible: false,
      dwellTimer: null,
    })
  },

  // Action execution
  setActionExecutor: (executor) => {
    set({ actionExecutor: executor })
  },
}))
