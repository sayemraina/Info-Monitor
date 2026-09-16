import { useState, useEffect } from 'react'
import { useAIGuide } from '../../hooks/useAIGuide'
import { AIGuideCompactPanel } from './AIGuideCompactPanel'

export function AIGuideAutoSequence() {
  const {
    tourSteps,
    currentStepIndex,
    tourPaused,
    pauseTour,
    resumeTour,
    nextStep,
    prevStep,
    exitBriefing,
    viewState,
    sessionId,
  } = useAIGuide()

  const [showFallback, setShowFallback] = useState(false)

  useEffect(() => {
    if (tourSteps.length === 0) {
      const timer = setTimeout(() => setShowFallback(true), 2000)
      return () => clearTimeout(timer)
    } else {
      setShowFallback(false)
    }
  }, [tourSteps.length])

  if (tourSteps.length === 0) {
    const explanation = showFallback
      ? "This topic doesn't have enough high-priority signals for a guided tour yet. Try exploring manually or check back later."
      : "Building your guided tour..."

    return (
      <AIGuideCompactPanel
        explanation={explanation}
        step={0}
        totalSteps={0}
        onPause={() => {}}
        onResume={() => {}}
        onNext={() => {}}
        onPrev={() => {}}
        onExit={exitBriefing}
        isPaused={false}
        canGoNext={false}
        canGoPrev={false}
        viewState={viewState}
        sessionId={sessionId}
      />
    )
  }

  const currentStep = tourSteps[currentStepIndex]
  const progress = ((currentStepIndex + 1) / tourSteps.length) * 100
  const explanation = currentStep.explanation || 'Analyzing...'

  return (
    <AIGuideCompactPanel
      explanation={explanation}
      step={currentStepIndex + 1}
      totalSteps={tourSteps.length}
      progress={progress}
      onPause={pauseTour}
      onResume={resumeTour}
      onNext={nextStep}
      onPrev={prevStep}
      onExit={exitBriefing}
      isPaused={tourPaused}
      canGoNext={currentStepIndex < tourSteps.length - 1}
      canGoPrev={currentStepIndex > 0}
      viewState={viewState}
      sessionId={sessionId}
    />
  )
}
