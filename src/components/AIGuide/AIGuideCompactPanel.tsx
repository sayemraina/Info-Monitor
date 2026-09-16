import { useEffect, useRef, useState, useCallback } from 'react'
import type { ViewState } from '../../hooks/useAIGuide'

interface AIGuideCompactPanelProps {
  explanation: string
  step: number
  totalSteps: number
  progress?: number
  onPause: () => void
  onResume: () => void
  onNext: () => void
  onPrev: () => void
  onExit: () => void
  isPaused: boolean
  canGoNext: boolean
  canGoPrev: boolean
  viewState: ViewState
  sessionId: string
}

export function AIGuideCompactPanel({
  explanation,
  step,
  totalSteps,
  progress = 0,
  onPause,
  onResume,
  onNext,
  onPrev,
  onExit,
  isPaused,
  canGoNext,
  canGoPrev,
  viewState,
  sessionId,
}: AIGuideCompactPanelProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [textKey, setTextKey] = useState(0)

  // Follow-up chat — fully local, never touches the shared messages store
  const [followUpInput, setFollowUpInput] = useState('')
  const [followUpResponse, setFollowUpResponse] = useState('')
  const [isFollowUpStreaming, setIsFollowUpStreaming] = useState(false)
  const [inFollowUpMode, setInFollowUpMode] = useState(false)

  const contentRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const prevExplanationRef = useRef('')
  const prevStepRef = useRef(step)

  useEffect(() => { setIsVisible(true) }, [])

  // Animate text when explanation changes
  useEffect(() => {
    if (prevExplanationRef.current !== explanation && prevExplanationRef.current !== '') {
      setTextKey(k => k + 1)
      if (contentRef.current) contentRef.current.scrollTop = 0
    }
    prevExplanationRef.current = explanation
  }, [explanation])

  // When step changes (user navigated), exit follow-up mode
  useEffect(() => {
    if (prevStepRef.current !== step) {
      setInFollowUpMode(false)
      setFollowUpInput('')
      setFollowUpResponse('')
      setIsFollowUpStreaming(false)
      prevStepRef.current = step
    }
  }, [step])

  // Escape to exit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onExit() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onExit])

  // Auto-focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFollowUpInput(e.target.value)
    // Pause auto-advance the moment they start typing
    if (e.target.value.length === 1 && !isPaused) {
      onPause()
    }
  }

  const sendFollowUp = useCallback(async () => {
    const text = followUpInput.trim()
    if (!text || isFollowUpStreaming) return

    setFollowUpInput('')
    setFollowUpResponse('')
    setIsFollowUpStreaming(true)
    setInFollowUpMode(true)
    onPause() // ensure paused

    let accumulated = ''

    try {
      const response = await fetch('/api/ai-guide/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          view_state: viewState,
          is_tour_followup: true,
          messages: [
            // Inject the current tour step as a prior assistant turn so the LLM
            // knows what it was saying when the user asked. Fixes "you said / you
            // mentioned" dangling references (e.g. "where is this signal ticker
            // you say you have hovered to?").
            {
              role: 'assistant',
              content: explanation,
            },
            {
              role: 'user',
              content: text,
            },
          ],
        }),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.text) {
                accumulated += data.text
                setFollowUpResponse(accumulated)
              } else if (data.error) {
                accumulated = "Something went wrong on my end. Try asking again."
                setFollowUpResponse(accumulated)
              }
            } catch {
              // skip malformed
            }
          }
        }
      }
    } catch {
      setFollowUpResponse("I'm having trouble connecting right now. Try again in a moment.")
    } finally {
      if (!accumulated) {
        setFollowUpResponse("No response received. Try asking again.")
      }
      setIsFollowUpStreaming(false)
    }
  }, [followUpInput, isFollowUpStreaming, sessionId, viewState, onPause, explanation])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendFollowUp()
    }
  }

  const handleContinue = () => {
    setInFollowUpMode(false)
    setFollowUpInput('')
    setFollowUpResponse('')
    setIsFollowUpStreaming(false)
    onResume()
  }

  const handleNav = (direction: 'prev' | 'next') => {
    // Clear follow-up state when navigating
    setInFollowUpMode(false)
    setFollowUpInput('')
    setFollowUpResponse('')
    setIsFollowUpStreaming(false)
    if (direction === 'prev') onPrev()
    else onNext()
  }

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // What to show in the main content area
  const displayText = inFollowUpMode ? (followUpResponse || '…') : explanation
  const displayKey = inFollowUpMode ? `followup-${followUpResponse.length}` : `step-${textKey}`

  const header = (
    <div style={{
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: '1px solid rgba(148,163,184,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '7px', height: '7px', borderRadius: '50%',
          background: inFollowUpMode ? '#F59E0B' : '#06B6D4',
          animation: 'pulse 2s infinite',
          transition: 'background 300ms',
        }} />
        <span style={{
          fontSize: '10px', fontWeight: 500, letterSpacing: '0.05em',
          color: inFollowUpMode ? '#F59E0B' : '#94A3B8',
          transition: 'color 300ms',
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          {inFollowUpMode ? (isFollowUpStreaming ? 'GUIDE RESPONDING...' : 'GUIDE') : 'ANALYST GUIDE'}
        </span>
      </div>
      <button
        onClick={onExit}
        style={{ width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '16px', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'color 150ms' }}
        onMouseEnter={e => e.currentTarget.style.color = '#F1F5F9'}
        onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}
        aria-label="Exit"
      >×</button>
    </div>
  )

  const content = (
    <>
      <div
        ref={contentRef}
        style={{ padding: '14px 16px 10px', maxHeight: '160px', overflowY: 'auto' }}
      >
        <p
          key={displayKey}
          style={{
            fontSize: '11px', lineHeight: '1.65', color: inFollowUpMode ? '#E2E8F0' : '#CBD5E1',
            fontFamily: 'Inter, system-ui, sans-serif', margin: 0,
            animation: 'fadeIn 250ms ease-out',
          }}
        >
          {displayText}
          {isFollowUpStreaming && (
            <span style={{
              display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%',
              background: '#F59E0B', marginLeft: '4px', verticalAlign: 'middle',
              boxShadow: '0 0 6px rgba(245,158,11,0.6)', animation: 'pulse 1s infinite',
            }} />
          )}
        </p>
      </div>

      {/* Continue tour button — outside scroll area so it's always visible */}
      {inFollowUpMode && !isFollowUpStreaming && (
        <div style={{ padding: '0 16px 10px' }}>
          <button
            onClick={handleContinue}
            style={{
              padding: '6px 12px',
              fontSize: '9px',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 600,
              letterSpacing: '0.04em',
              background: 'rgba(6,182,212,0.12)',
              border: '1px solid rgba(6,182,212,0.3)',
              borderRadius: '4px',
              color: '#06B6D4',
              cursor: 'pointer',
              transition: 'all 150ms',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(6,182,212,0.2)'
              e.currentTarget.style.borderColor = 'rgba(6,182,212,0.5)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(6,182,212,0.12)'
              e.currentTarget.style.borderColor = 'rgba(6,182,212,0.3)'
            }}
          >
            ↩ Continue tour
          </button>
        </div>
      )}
    </>
  )

  const controls = (
    <div style={{ padding: '10px 14px 12px', borderTop: '1px solid rgba(148,163,184,0.06)' }}>
      {/* Step nav row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
        <span style={{ fontSize: '9px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap', minWidth: '28px' }}>
          {step > 0 ? `${step}/${totalSteps}` : '—'}
        </span>
        <div style={{ flex: 1, height: '2px', background: 'rgba(148,163,184,0.1)', borderRadius: '1px', overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: '#06B6D4', transition: 'width 200ms ease-out' }} />
        </div>

        {/* ← */}
        <button onClick={() => handleNav('prev')} disabled={!canGoPrev} title="Previous step" style={{
          width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px', color: canGoPrev ? '#94A3B8' : '#334155',
          background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.1)',
          borderRadius: '4px', cursor: canGoPrev ? 'pointer' : 'not-allowed',
          opacity: canGoPrev ? 1 : 0.3, transition: 'all 150ms', flexShrink: 0,
        }}
          onMouseEnter={e => { if (canGoPrev) e.currentTarget.style.color = '#F1F5F9' }}
          onMouseLeave={e => { if (canGoPrev) e.currentTarget.style.color = '#94A3B8' }}
        >←</button>

        {/* → */}
        <button onClick={() => handleNav('next')} disabled={!canGoNext} title="Next step" style={{
          width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px', color: canGoNext ? '#0F1923' : '#64748B',
          background: canGoNext ? '#06B6D4' : 'rgba(148,163,184,0.06)',
          border: 'none', borderRadius: '4px',
          cursor: canGoNext ? 'pointer' : 'not-allowed',
          opacity: canGoNext ? 1 : 0.3, transition: 'all 150ms', flexShrink: 0,
        }}
          onMouseEnter={e => { if (canGoNext) e.currentTarget.style.background = '#0EA5C5' }}
          onMouseLeave={e => { if (canGoNext) e.currentTarget.style.background = '#06B6D4' }}
        >→</button>

        {/* Pause / Resume — only visible when not in follow-up mode */}
        {!inFollowUpMode && (
          <button
            onClick={isPaused ? onResume : onPause}
            title={isPaused ? 'Resume auto-advance' : 'Pause auto-advance'}
            style={{
              padding: '0 8px', height: '28px', fontSize: '9px', fontWeight: 500,
              letterSpacing: '0.04em', color: '#94A3B8',
              background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.1)',
              borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap',
              flexShrink: 0, transition: 'all 150ms',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#F1F5F9'}
            onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}
          >
            {isPaused ? '▶ Resume' : '⏸ Pause'}
          </button>
        )}
      </div>

      {/* Follow-up input — always visible, drives pause behavior */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          ref={inputRef}
          type="text"
          value={followUpInput}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder={inFollowUpMode ? 'Ask another question...' : 'Ask about this...'}
          disabled={isFollowUpStreaming}
          style={{
            flex: 1, padding: '6px 10px', fontSize: '10px',
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${isFollowUpStreaming ? 'rgba(245,158,11,0.3)' : 'rgba(148,163,184,0.15)'}`,
            borderRadius: '4px', color: '#F1F5F9', outline: 'none',
            transition: 'border-color 150ms',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.4)' }}
          onBlur={e => { e.currentTarget.style.borderColor = isFollowUpStreaming ? 'rgba(245,158,11,0.3)' : 'rgba(148,163,184,0.15)' }}
        />
        <button
          onClick={sendFollowUp}
          disabled={!followUpInput.trim() || isFollowUpStreaming}
          style={{
            padding: '6px 10px', fontSize: '9px', fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 600, background: '#F59E0B', border: 'none', borderRadius: '4px',
            color: '#0F1923', cursor: !followUpInput.trim() || isFollowUpStreaming ? 'not-allowed' : 'pointer',
            opacity: !followUpInput.trim() || isFollowUpStreaming ? 0.4 : 1,
            transition: 'opacity 150ms', whiteSpace: 'nowrap',
          }}
        >Ask</button>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-[997]" style={{
        maxHeight: '65vh', display: 'flex', flexDirection: 'column',
        background: 'rgba(15,25,35,0.97)', backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(148,163,184,0.1)',
        transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 200ms ease-out',
      }}>
        <div className="flex justify-center py-3">
          <div style={{ width: '48px', height: '4px', background: 'rgba(148,163,184,0.3)', borderRadius: '2px' }} />
        </div>
        {header}
        <div style={{ flex: 1, overflowY: 'auto' }}>{content}</div>
        {controls}
        <Styles />
      </div>
    )
  }

  return (
    <div className="fixed z-[997]" style={{
      bottom: '96px', right: '24px', width: '400px',
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? 'translateY(0)' : 'translateY(8px)',
      transition: 'opacity 200ms ease-out, transform 200ms ease-out',
      borderRadius: '6px',
      overflow: 'hidden',
      border: '1px solid rgba(148,163,184,0.1)',
      background: 'rgba(15,25,35,0.95)',
      backdropFilter: 'blur(16px)',
    }}>
      {header}
      {content}
      {controls}
      <Styles />
    </div>
  )
}

function Styles() {
  return (
    <style>{`
      @keyframes fadeIn { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    `}</style>
  )
}
