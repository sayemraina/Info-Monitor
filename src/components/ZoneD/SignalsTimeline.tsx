import type { TimeWindow, EventType } from '../../types'
import { useTimeline } from '../../hooks/useTimeline'
import { useSignals } from '../../hooks/useSignals'
import { EventCard } from './EventCard'
import { FilterChips } from './FilterChips'

interface SignalsTimelineProps {
  topicId: string
  timeWindow: TimeWindow
  eventTypeFilter: EventType | 'all'
  onSetEventTypeFilter: (filter: EventType | 'all') => void
  onSelectClaim: (claimId: string) => void
}

const SOURCE_TYPE_COLORS: Record<string, string> = {
  government:        '#3B82F6',
  prediction_market: '#8B5CF6',
  event_signal:      '#F59E0B',
}

const SOURCE_LABELS: Record<string, string> = {
  gdelt:        'GDELT',
  fred:         'FRED',
  congress:     'Congress',
  fed_register: 'Fed Register',
  sec_edgar:    'SEC Edgar',
  yahoo_finance:'Yahoo Finance',
  polymarket:   'Polymarket',
}

export function SignalsTimeline({
  topicId,
  timeWindow,
  eventTypeFilter: _eventTypeFilter,
  onSetEventTypeFilter,
  onSelectClaim,
}: SignalsTimelineProps) {
  const { events, loading, error, filterByType, activeFilter } = useTimeline(topicId, timeWindow)
  const { signals } = useSignals(topicId)

  const handleFilterChange = (filter: EventType | 'all') => {
    onSetEventTypeFilter(filter)
    filterByType(filter)
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Loading signals...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-xs" style={{ color: '#EF4444' }}>Failed to load signals</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-3">
      <FilterChips active={activeFilter} onChange={handleFilterChange} />
      <div className="flex-1 overflow-y-auto mt-2 space-y-1.5">
        {events.length === 0 ? (
          <p className="text-xs text-center mt-4" style={{ color: 'var(--color-text-muted)' }}>
            No signals detected
          </p>
        ) : (
          events.map((event, index) => (
            <EventCard
              key={event.id}
              event={event}
              index={index}
              onClick={() => event.claim_id && onSelectClaim(event.claim_id)}
            />
          ))
        )}

        {/* Context Signals from external sources */}
        {signals.length > 0 && (
          <>
            <div
              className="flex items-center gap-2 pt-2 pb-1"
              style={{ borderTop: '1px solid rgba(148,163,184,0.1)' }}
            >
              <span
                className="text-[9px] font-bold uppercase tracking-wider"
                style={{ color: '#64748B' }}
              >
                Context Signals
              </span>
            </div>
            {signals.map(signal => {
              const color = SOURCE_TYPE_COLORS[signal.source_type] ?? '#64748B'
              const sourceLabel = SOURCE_LABELS[signal.source] ?? signal.source
              const severityColor = signal.severity === 'high' ? '#EF4444'
                : signal.severity === 'medium' ? '#F59E0B'
                : 'rgba(148,163,184,0.5)'

              return (
                <div
                  key={signal.id}
                  className="rounded p-2 space-y-0.5"
                  style={{
                    backgroundColor: 'rgba(148,163,184,0.04)',
                    border: '1px solid rgba(148,163,184,0.08)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded"
                      style={{
                        color,
                        backgroundColor: `${color}18`,
                        border: `1px solid ${color}30`,
                        flexShrink: 0,
                      }}
                    >
                      {sourceLabel}
                    </span>
                    {signal.severity && (
                      <span className="text-[8px] font-mono" style={{ color: severityColor, flexShrink: 0 }}>
                        {signal.severity}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] leading-snug" style={{ color: 'var(--color-text-primary)' }}>
                    {signal.title}
                  </p>
                  {signal.summary && signal.summary !== signal.title && (
                    <p className="text-[9px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
                      {signal.summary}
                    </p>
                  )}
                  {signal.url && (
                    <a
                      href={signal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[8px] font-mono"
                      style={{ color: '#06B6D4' }}
                    >
                      source →
                    </a>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
