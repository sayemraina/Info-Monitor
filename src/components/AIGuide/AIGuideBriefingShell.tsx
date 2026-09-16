import { useEffect } from 'react'
import { useAIGuide } from '../../hooks/useAIGuide'
import { AIGuideBriefingHeader } from './AIGuideBriefingHeader'
import { AIGuideModeSelector } from './AIGuideModeSelector'
import { AIGuideAutoSequence } from './AIGuideAutoSequence'
import { AIGuideQueryMode } from './AIGuideQueryMode'
import { AIGuideAmbient } from './AIGuideAmbient'

export function AIGuideBriefingShell() {
  const {
    briefingActive,
    briefingMode,
    sessionId,
    exitBriefing,
  } = useAIGuide()

  // Handle Esc key to exit
  useEffect(() => {
    if (!briefingActive) return

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        exitBriefing()
      }
    }

    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [briefingActive, exitBriefing])

  // Don't render if not active
  if (!briefingActive) return null

  // Ambient mode: no backdrop, no header, just floating panel
  if (briefingMode === 'ambient') {
    return <AIGuideAmbient />
  }

  // Auto-sequence mode: no backdrop, no header, just compact panel
  // TopicView remains visible, panel floats on top
  if (briefingMode === 'auto-sequence') {
    return <AIGuideAutoSequence />
  }

  // Query mode and mode selector: full-screen with backdrop and header
  return (
    <div className="fixed inset-0 z-[999]">
      {/* Backdrop - Blur overlay matching InfoMonitor's BlurOverlay pattern */}
      <div
        className="absolute inset-0"
        onClick={exitBriefing}
        style={{
          backgroundColor: 'rgba(3,5,8,0.50)',
          backdropFilter: 'blur(16px)',
        }}
      />

      {/* Main container */}
      <div className="relative h-full flex flex-col">
        {/* Header (persistent across modes) */}
        <AIGuideBriefingHeader
          sessionId={sessionId}
          mode={briefingMode}
          onExit={exitBriefing}
        />

        {/* Mode-specific content */}
        <div className="flex-1 relative">
          {briefingMode === null && <AIGuideModeSelector />}
          {briefingMode === 'query' && <AIGuideQueryMode />}
        </div>
      </div>
    </div>
  )
}
