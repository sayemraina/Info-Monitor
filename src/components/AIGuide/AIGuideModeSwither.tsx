import type { BriefingMode } from '../../hooks/useAIGuide'

interface ModeSwitcherProps {
  currentMode: BriefingMode
  onSwitch: (newMode: BriefingMode) => void
  compact?: boolean
}

const modes: Array<{ id: Exclude<BriefingMode, null>, label: string }> = [
  { id: 'auto-sequence', label: 'AUTO' },
  { id: 'query', label: 'QUERY' },
  { id: 'ambient', label: 'AMBIENT' },
]

export function AIGuideModeSwither({
  currentMode,
  onSwitch,
  compact = false,
}: ModeSwitcherProps) {
  return (
    <div className="flex items-center gap-3">
      {!compact && (
        <span
          className="font-mono uppercase"
          style={{
            fontSize: '9px',
            color: '#64748B',
            letterSpacing: '0.05em',
            fontWeight: 600,
          }}
        >
          Mode:
        </span>
      )}

      <div
        className="flex rounded overflow-hidden"
        style={{
          border: '1px solid rgba(148,163,184,0.15)',
          background: 'rgba(0,0,0,0.2)',
        }}
      >
        {modes.map((mode, index) => {
          const isActive = currentMode === mode.id
          return (
            <button
              key={mode.id}
              onClick={() => onSwitch(mode.id)}
              disabled={currentMode === mode.id}
              className="font-mono uppercase"
              style={{
                fontSize: compact ? '9px' : '10px',
                padding: compact ? '6px 12px' : '7px 16px',
                borderLeft: index !== 0 ? '1px solid rgba(148,163,184,0.15)' : 'none',
                background: isActive ? 'rgba(6,182,212,0.15)' : 'transparent',
                color: isActive ? '#06B6D4' : '#94A3B8',
                cursor: isActive ? 'default' : 'pointer',
                transition: 'all 200ms ease',
                fontWeight: isActive ? 600 : 500,
                letterSpacing: '0.05em',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                  e.currentTarget.style.color = '#CBD5E1'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = '#94A3B8'
                }
              }}
            >
              {mode.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
