import type { TimeWindow, EventType } from '../../types'
import { useTimeline } from '../../hooks/useTimeline'
import { EventCard } from './EventCard'
import { FilterChips } from './FilterChips'

interface SignalsTimelineProps {
  topicId: string
  timeWindow: TimeWindow
  eventTypeFilter: EventType | 'all'
  onSetEventTypeFilter: (filter: EventType | 'all') => void
  onSelectClaim: (claimId: string) => void
}

export function SignalsTimeline({
  topicId,
  timeWindow,
  eventTypeFilter,
  onSetEventTypeFilter,
  onSelectClaim,
}: SignalsTimelineProps) {
  const { events, loading, error, filterByType, activeFilter } = useTimeline(topicId, timeWindow)

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
    <div className="h-full flex flex-col p-2">
      <FilterChips active={activeFilter} onChange={handleFilterChange} />
      <div className="flex-1 overflow-y-auto mt-2 space-y-1">
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
      </div>
    </div>
  )
}
