import { useState } from 'react'
import { useAIGuide } from '../../hooks/useAIGuide'

export function AIGuideAmbient() {
  const { switchMode, exitBriefing, sessionId } = useAIGuide()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [quickQuery, setQuickQuery] = useState('')

  const handleQuickQuery = () => {
    if (!quickQuery.trim()) return
    // Switch to query mode (which will handle the question)
    switchMode('query')
    // Note: The question input will be lost in transition
    // In a full implementation, we'd preserve it
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleQuickQuery()
    }
  }

  if (isCollapsed) {
    // Collapsed state: small badge
    return (
      <div
        style={{
          position: 'fixed',
          right: '24px',
          bottom: '96px',
          zIndex: 998,
        }}
      >
        <button
          onClick={() => setIsCollapsed(false)}
          className="flex items-center gap-2 font-mono uppercase"
          style={{
            background: '#0F1923',
            border: '1px solid rgba(148,163,184,0.06)',
            borderRadius: '999px',
            padding: '8px 16px',
            fontSize: '11px',
            color: '#06B6D4',
            cursor: 'pointer',
            transition: 'transform 200ms ease',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            letterSpacing: '0.05em',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
          }}
        >
          <div
            className="animate-pulse"
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#06B6D4',
              boxShadow: '0 0 6px rgba(6,182,212,0.6)',
            }}
          />
          <span>AI Advisory</span>
        </button>
      </div>
    )
  }

  // Expanded state: floating panel
  return (
    <div
      style={{
        position: 'fixed',
        right: '24px',
        bottom: '96px',
        zIndex: 998,
        width: '320px',
      }}
    >
      <div
        style={{
          background: '#0F1923',
          border: '1px solid rgba(148,163,184,0.06)',
          borderRadius: '8px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid rgba(148,163,184,0.06)',
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="animate-pulse"
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#06B6D4',
                boxShadow: '0 0 6px rgba(6,182,212,0.6)',
              }}
            />
            <span
              className="font-mono uppercase"
              style={{
                fontSize: '11px',
                color: '#06B6D4',
                letterSpacing: '0.05em',
                fontWeight: 600,
              }}
            >
              Advisory Active
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCollapsed(true)}
              className="font-mono uppercase"
              style={{
                fontSize: '9px',
                color: '#94A3B8',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                transition: 'color 200ms ease',
                letterSpacing: '0.05em',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#CBD5E1'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#94A3B8'
              }}
            >
              Minimize
            </button>
            <button
              onClick={exitBriefing}
              aria-label="Exit briefing"
              style={{
                padding: '4px',
                color: '#64748B',
                background: 'transparent',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 200ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#06B6D4'
                e.currentTarget.style.background = 'rgba(6,182,212,0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#64748B'
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <svg
                style={{ width: '16px', height: '16px' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Session info */}
        <div
          style={{
            padding: '8px 16px',
            borderBottom: '1px solid rgba(148,163,184,0.04)',
          }}
        >
          <span
            className="font-mono"
            style={{
              fontSize: '9px',
              color: '#64748B',
            }}
          >
            Session: {sessionId}
          </span>
        </div>

        {/* Quick query input */}
        <div style={{ padding: '16px' }}>
          <label
            className="font-mono uppercase block"
            style={{
              fontSize: '9px',
              color: '#94A3B8',
              letterSpacing: '0.05em',
              marginBottom: '8px',
              fontWeight: 600,
            }}
          >
            Quick Question:
          </label>
          <input
            type="text"
            value={quickQuery}
            onChange={(e) => setQuickQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about what you're seeing..."
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '11px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(148,163,184,0.15)',
              borderRadius: '4px',
              color: '#F1F5F9',
              marginBottom: '12px',
              transition: 'all 200ms ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(6,182,212,0.4)'
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(148,163,184,0.15)'
              e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
            }}
          />
          <button
            onClick={handleQuickQuery}
            disabled={!quickQuery.trim()}
            className="font-mono uppercase"
            style={{
              width: '100%',
              padding: '8px',
              fontSize: '9px',
              background: '#06B6D4',
              border: 'none',
              borderRadius: '4px',
              color: '#0F1923',
              cursor: !quickQuery.trim() ? 'not-allowed' : 'pointer',
              opacity: !quickQuery.trim() ? 0.4 : 1,
              transition: 'all 200ms ease',
              letterSpacing: '0.05em',
              fontWeight: 600,
            }}
            onMouseEnter={(e) => {
              if (quickQuery.trim()) {
                e.currentTarget.style.background = 'rgba(6,182,212,0.9)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#06B6D4'
            }}
          >
            Send Query
          </button>
        </div>

        {/* Mode switch options */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(148,163,184,0.06)',
          }}
        >
          <p style={{ fontSize: '10px', color: '#64748B', marginBottom: '8px' }}>
            Or switch to:
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => switchMode('auto-sequence')}
              className="font-mono uppercase flex-1"
              style={{
                fontSize: '9px',
                padding: '8px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(148,163,184,0.15)',
                color: '#94A3B8',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 200ms ease',
                letterSpacing: '0.05em',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                e.currentTarget.style.color = '#CBD5E1'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                e.currentTarget.style.color = '#94A3B8'
              }}
            >
              Auto
            </button>
            <button
              onClick={() => switchMode('query')}
              className="font-mono uppercase flex-1"
              style={{
                fontSize: '9px',
                padding: '8px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(148,163,184,0.15)',
                color: '#94A3B8',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 200ms ease',
                letterSpacing: '0.05em',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                e.currentTarget.style.color = '#CBD5E1'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                e.currentTarget.style.color = '#94A3B8'
              }}
            >
              Query
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
