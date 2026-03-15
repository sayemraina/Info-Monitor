import { useEffect, useRef, useState } from 'react'
import type { NarrativeEvent } from '../../types'

interface SignalTickerProps {
  activeTopic: string
}

const EVENT_ICONS: Record<string, string> = {
  momentum_spike: '📈',
  divergence_shift: '🔄',
  coordination_flag: '⚠️',
  contestation_emergence: '🔥',
  claim_dark: '🌑',
  arousal_escalation: '🌡️',
  phase_transition: '⚡',
  lead_lag: '🔗',
  vocabulary_rotation: '🔤',
}

export function SignalTicker({ activeTopic }: SignalTickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number>(0)
  const [events, setEvents] = useState<NarrativeEvent[]>([])

  // Fetch timeline data for active topic
  useEffect(() => {
    if (!activeTopic) return
    fetch(`/data/metrics/${activeTopic}/timeline_24h.json`)
      .then(r => r.ok ? r.json() : { events: [] })
      .then(data => setEvents(data.events ?? []))
      .catch(() => setEvents([]))
  }, [activeTopic])

  // Continuous scroll R→L
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    let scrollPos = 0
    const speed = 0.3

    const tick = () => {
      scrollPos += speed
      if (scrollPos >= el.scrollWidth / 2) scrollPos = 0
      el.scrollLeft = scrollPos
      animRef.current = requestAnimationFrame(tick)
    }

    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [events])

  // Duplicate events for seamless loop
  const displayEvents = [...events, ...events]

  if (events.length === 0) {
    return (
      <div
        className="flex-shrink-0 flex items-center px-6 font-data"
        style={{
          height: '26px',
          background: 'rgba(8,12,20,0.8)',
          borderTop: '1px solid rgba(148,163,184,0.04)',
          fontSize: '8px',
          color: 'rgba(148,163,184,0.3)',
        }}
      >
        No signals for this topic
      </div>
    )
  }

  return (
    <div
      className="flex-shrink-0"
      style={{
        height: '26px',
        background: 'rgba(8,12,20,0.8)',
        borderTop: '1px solid rgba(148,163,184,0.04)',
        overflow: 'hidden',
      }}
    >
      <div
        ref={scrollRef}
        className="flex items-center gap-6 h-full"
        style={{
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          padding: '0 24px',
        }}
      >
        {displayEvents.map((event, i) => {
          const icon = EVENT_ICONS[event.type] ?? '•'
          const severityColor = event.severity === 'high' ? '#EF4444'
            : event.severity === 'medium' ? '#F59E0B'
            : '#64748B'

          return (
            <span
              key={`${event.id}-${i}`}
              className="font-data flex-shrink-0"
              style={{ fontSize: '8.5px', color: severityColor }}
            >
              {icon} {event.summary}
            </span>
          )
        })}
      </div>
    </div>
  )
}
