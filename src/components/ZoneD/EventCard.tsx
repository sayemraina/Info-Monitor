import type { NarrativeEvent } from '../../types'
import { getSeverityColor } from '../../utils/colors'
import { formatTimeAgo } from '../../utils/format'

interface EventCardProps {
  event: NarrativeEvent
  onClick: () => void
  index?: number
}

const TYPE_ICONS: Record<string, string> = {
  momentum_spike: '\u{1F4C8}',
  divergence_shift: '\u{1F500}',
  coordination_flag: '\u{26A0}\u{FE0F}',
  contestation_emergence: '\u{26A1}',
  claim_dark: '\u{1F507}',
  arousal_escalation: '\u{1F321}\u{FE0F}',
  phase_transition: '\u{2197}\u{FE0F}',
  lead_lag: '\u{1F517}',
}

export function EventCard({ event, onClick, index = 0 }: EventCardProps) {
  const icon = TYPE_ICONS[event.type] ?? '\u{2022}'
  const severityColor = getSeverityColor(event.severity)
  const staggerDelay = `${Math.min(index * 50, 400)}ms`

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-2 py-1.5 rounded transition-colors cursor-pointer animate-slide-in animate-highlight-pulse"
      style={{ backgroundColor: 'transparent', animationDelay: staggerDelay }}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--color-bg-panel-hover)' }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
    >
      <div className="flex items-start gap-1.5">
        <span className="text-xs shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] leading-tight" style={{ color: severityColor }}>
            {event.summary}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[9px] font-data" style={{ color: 'var(--color-text-muted)' }}>
              {formatTimeAgo(event.timestamp)}
            </span>
            <span
              className="text-[9px] px-1 rounded"
              style={{
                backgroundColor: `${severityColor}15`,
                color: severityColor,
              }}
            >
              {event.severity}
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}
