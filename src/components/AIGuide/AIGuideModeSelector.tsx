import { useState } from 'react'
import { useAIGuide, type BriefingMode } from '../../hooks/useAIGuide'

interface ModeOption {
  id: BriefingMode
  icon: string
  title: string
  description: string
  duration: string
}

const modes: ModeOption[] = [
  {
    id: 'auto-sequence',
    icon: '◉',
    title: 'AUTO-SEQUENCE',
    description: 'Analyst-guided walkthrough of key signals in priority order.',
    duration: '4-6 MIN',
  },
  {
    id: 'query',
    icon: '?',
    title: 'QUERY MODE',
    description: 'User-directed analysis. Ask specific questions about signals.',
    duration: 'FLEXIBLE',
  },
  {
    id: 'ambient',
    icon: '⊙',
    title: 'AMBIENT ADVISORY',
    description: 'Background monitoring mode. Available on demand.',
    duration: 'CONTINUOUS',
  },
]

export function AIGuideModeSelector() {
  const { startBriefing } = useAIGuide()
  const [hoveredId, setHoveredId] = useState<BriefingMode | null>(null)

  const handleSelect = (mode: BriefingMode) => {
    if (mode) {
      startBriefing(mode)
    }
  }

  return (
    <div className="flex items-center justify-center h-full px-8">
      <div className="w-full max-w-6xl">
        {/* Title */}
        <div className="text-center" style={{ marginBottom: '48px' }}>
          <h2
            className="font-mono text-sm font-semibold uppercase tracking-wider"
            style={{ color: '#CBD5E1', letterSpacing: '0.1em', marginBottom: '12px' }}
          >
            SELECT BRIEFING FORMAT
          </h2>
          <p style={{ fontSize: '10px', color: '#94A3B8', letterSpacing: '0.05em' }}>
            Choose intelligence delivery method
          </p>
        </div>

        {/* Mode cards - using Topic Card pattern */}
        <div className="grid grid-cols-3" style={{ gap: '32px' }}>
          {modes.map((mode) => {
            const isHovered = hoveredId === mode.id
            return (
              <button
                key={mode.id}
                onClick={() => handleSelect(mode.id)}
                onMouseEnter={() => setHoveredId(mode.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="rounded-lg text-left"
                style={{
                  padding: '20px 24px',
                  backgroundColor: isHovered
                    ? 'rgba(255,255,255,0.03)'
                    : 'rgba(255,255,255,0.015)',
                  border: isHovered
                    ? '1px solid rgba(148,163,184,0.15)'
                    : '1px solid rgba(148,163,184,0.06)',
                  transition: 'all 200ms ease',
                  cursor: 'pointer',
                }}
              >
                {/* Icon */}
                <div style={{ marginBottom: '12px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      border: `1px solid ${isHovered ? 'rgba(6,182,212,0.3)' : 'rgba(148,163,184,0.15)'}`,
                      backgroundColor: 'rgba(6,182,212,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      color: '#06B6D4',
                      transition: 'all 200ms ease',
                    }}
                  >
                    {mode.icon}
                  </div>
                </div>

                {/* Title */}
                <h3
                  className="font-mono font-semibold uppercase"
                  style={{
                    fontSize: '11px',
                    color: '#F1F5F9',
                    letterSpacing: '0.05em',
                    marginBottom: '8px',
                  }}
                >
                  {mode.title}
                </h3>

                {/* Description */}
                <p
                  style={{
                    fontSize: '11px',
                    lineHeight: '1.5',
                    color: '#94A3B8',
                    marginBottom: '12px',
                    minHeight: '3rem',
                  }}
                >
                  {mode.description}
                </p>

                {/* Duration */}
                <div
                  style={{
                    paddingTop: '8px',
                    borderTop: '1px solid rgba(148,163,184,0.06)',
                  }}
                >
                  <span
                    className="font-mono uppercase"
                    style={{
                      fontSize: '9px',
                      color: '#64748B',
                      letterSpacing: '0.05em',
                    }}
                  >
                    DURATION: {mode.duration}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Helper text */}
        <div className="text-center" style={{ marginTop: '48px' }}>
          <p
            className="font-mono uppercase"
            style={{
              fontSize: '9px',
              color: '#64748B',
              letterSpacing: '0.05em',
            }}
          >
            You can switch modes at any time during the briefing
          </p>
        </div>
      </div>
    </div>
  )
}
