import { useState, useEffect } from 'react'
import type { BriefingMode } from '../../hooks/useAIGuide'

interface BriefingHeaderProps {
  sessionId: string
  mode: BriefingMode
  onExit: () => void
}

export function AIGuideBriefingHeader({
  sessionId,
  mode,
  onExit,
}: BriefingHeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update timestamp every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Format time as HH:MM:SS ET
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'America/New_York',
      hour12: false,
    }) + ' ET'
  }

  // Mode label and color mapping
  const getModeLabel = (mode: BriefingMode): string => {
    switch (mode) {
      case 'auto-sequence':
        return 'AUTO-SEQUENCE'
      case 'query':
        return 'QUERY MODE'
      case 'ambient':
        return 'AMBIENT ADVISORY'
      default:
        return 'BRIEFING'
    }
  }

  const getModeColor = (mode: BriefingMode): string => {
    switch (mode) {
      case 'auto-sequence':
        return '#06B6D4' // Cyan - guided
      case 'query':
        return '#F59E0B' // Amber - interactive
      case 'ambient':
        return '#3B82F6' // Blue - passive
      default:
        return '#06B6D4'
    }
  }

  return (
    <header
      style={{
        backgroundColor: '#0F1923',
        borderBottom: '1px solid rgba(148,163,184,0.06)',
      }}
    >
      {/* Main header line - matches Zone B card header */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: '6px 12px',
        }}
      >
        <div className="flex items-center gap-3">
          <h3
            className="font-mono font-semibold uppercase"
            style={{
              fontSize: '11px',
              color: '#CBD5E1',
              letterSpacing: '0.05em',
              borderLeft: '2.5px solid #06B6D4',
              paddingLeft: '8px',
            }}
          >
            NARRATIVE INTELLIGENCE
          </h3>
          {mode && (
            <>
              <span style={{ color: '#64748B' }}>|</span>
              <span
                className="font-mono font-semibold uppercase"
                style={{
                  fontSize: '11px',
                  color: getModeColor(mode),
                  letterSpacing: '0.05em',
                }}
              >
                {getModeLabel(mode)}
              </span>
            </>
          )}
        </div>

        <button
          onClick={onExit}
          style={{
            padding: '4px',
            color: '#64748B',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            transition: 'color 200ms ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#06B6D4')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#64748B')}
          aria-label="Exit briefing"
        >
          <svg
            width="16"
            height="16"
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

      {/* Session info line */}
      <div
        style={{
          borderTop: '1px solid rgba(148,163,184,0.06)',
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '9px',
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="font-mono uppercase"
            style={{
              color: '#64748B',
              letterSpacing: '0.05em',
            }}
          >
            Session:
          </span>
          <span
            className="font-mono"
            style={{
              color: '#06B6D4',
              fontWeight: 600,
              letterSpacing: '0.02em',
            }}
          >
            {sessionId}
          </span>
        </div>

        <div style={{ width: '1px', height: '10px', background: 'rgba(148,163,184,0.15)' }} />

        <div className="flex items-center gap-2">
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#22C55E',
              boxShadow: '0 0 6px rgba(34,197,94,0.6)',
            }}
          />
          <span
            className="font-mono uppercase"
            style={{
              color: '#22C55E',
              fontWeight: 600,
              letterSpacing: '0.05em',
            }}
          >
            ACTIVE
          </span>
        </div>

        <div style={{ marginLeft: 'auto' }}>
          <span
            className="font-mono"
            style={{
              color: '#64748B',
              letterSpacing: '0.02em',
            }}
          >
            {formatTime(currentTime)}
          </span>
        </div>
      </div>
    </header>
  )
}
