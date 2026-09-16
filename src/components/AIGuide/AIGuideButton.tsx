import { useEffect, useState } from 'react'
import { useAIGuide } from '../../hooks/useAIGuide'

export function AIGuideButton() {
  const { openBriefing, briefingActive, isJourneyActive } = useAIGuide()
  const [shouldPulse, setShouldPulse] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [isScaled, setIsScaled] = useState(false)
  const [isGlowing, setIsGlowing] = useState(false)
  const [scrollOpacity, setScrollOpacity] = useState(1)

  // Progressive attention escalation: 5s → hint, 7s → scale+glow, 12s → stop
  useEffect(() => {
    const hasSeenPrompt = sessionStorage.getItem('ai_guide_seen')
    if (hasSeenPrompt || briefingActive || isJourneyActive) return

    // Timer 1: 5s - Show hint + start pulse
    const timer1 = setTimeout(() => {
      setShowHint(true)
      setShouldPulse(true)
    }, 5000)

    // Timer 2: 7s - Scale up + glow
    const timer2 = setTimeout(() => {
      setIsScaled(true)
      setIsGlowing(true)
    }, 7000)

    // Timer 3: 12s - Stop everything
    const timer3 = setTimeout(() => {
      setShowHint(false)
      setIsScaled(false)
      setIsGlowing(false)
      setShouldPulse(false)
      sessionStorage.setItem('ai_guide_seen', 'true')
    }, 12000)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
    }
  }, [briefingActive, isJourneyActive])

  // Scroll opacity handling
  useEffect(() => {
    let scrollTimeout: ReturnType<typeof setTimeout>

    const handleScroll = () => {
      // Fade to 60% while scrolling
      setScrollOpacity(0.6)

      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        // Back to 100% when scroll stops
        setScrollOpacity(1)
      }, 500)
    }

    window.addEventListener('scroll', handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimeout)
    }
  }, [])

  const handleClick = () => {
    // Clear all animation states immediately
    setShowHint(false)
    setIsScaled(false)
    setIsGlowing(false)
    setShouldPulse(false)
    sessionStorage.setItem('ai_guide_seen', 'true')
    openBriefing()
  }

  // Hide button if journey is active (split layout takes over)
  if (isJourneyActive) return null

  return (
    <button
      onClick={handleClick}
      className="group fixed z-[1000] transition-all duration-300"
      style={{
        bottom: '24px',
        right: '24px',
        opacity: scrollOpacity,
        transform: isScaled ? 'scale(1.08)' : 'scale(1)',
        filter: isGlowing
          ? 'drop-shadow(0 0 12px rgba(6, 182, 212, 0.6))'
          : 'none'
      }}
      title="Launch AI Mode"
    >
      <div
        className="flex items-center justify-center transition-all duration-300"
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: '#0F1923',
          border: briefingActive
            ? '2px solid #06B6D4'
            : '2px solid rgba(6,182,212,0.5)',
          boxShadow: briefingActive
            ? '0 4px 16px rgba(6,182,212,0.4)'
            : 'none'
        }}
      >
        {/* Sparkle icon */}
        <svg
          style={{
            width: '24px',
            height: '24px',
            color: '#06B6D4',
            opacity: shouldPulse ? 0.7 : 1,
            transition: 'opacity 600ms ease-in-out'
          }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
          />
        </svg>

        {/* Tooltip on hover */}
        <div
          className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none font-mono uppercase"
          style={{
            bottom: '100%',
            right: '0',
            marginBottom: '8px',
            padding: '6px 10px',
            borderRadius: '6px',
            background: '#0F1923',
            border: '1px solid rgba(148,163,184,0.06)',
            fontSize: '9px',
            color: '#CBD5E1',
            whiteSpace: 'nowrap',
            letterSpacing: '0.05em',
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
          }}
        >
          Launch AI Mode
        </div>
      </div>

      {/* Floating hint - clean and minimal */}
      {showHint && (
        <div
          className="absolute font-mono uppercase animate-fade-in"
          style={{
            bottom: '100%',
            right: '0',
            marginBottom: '16px',
            padding: '6px 12px',
            borderRadius: '6px',
            background: '#0F1923',
            border: '1px solid rgba(6,182,212,0.3)',
            fontSize: '10px',
            color: '#06B6D4',
            whiteSpace: 'nowrap',
            letterSpacing: '0.05em',
            fontWeight: 600,
            boxShadow: '0 4px 16px rgba(6,182,212,0.2)',
            animation: 'fade-in 300ms ease-out'
          }}
        >
          Try AI Guide
        </div>
      )}
    </button>
  )
}
