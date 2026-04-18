import { useEffect, useRef, useState } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useSignals } from '../../hooks/useSignals'
import type { NarrativeEvent } from '../../types'

interface SignalTickerProps {
  activeTopic: string
}

const EVENT_ICONS: Record<string, string> = {
  // NarrativeEvent types
  momentum_spike: '📈',
  divergence_shift: '🔄',
  coordination_flag: '⚠️',
  contestation_emergence: '🔥',
  claim_dark: '🌑',
  arousal_escalation: '🌡️',
  phase_transition: '⚡',
  lead_lag: '🔗',
  vocabulary_rotation: '🔤',
  // EventSignal types
  news_event: '📰',
  economic_indicator: '📊',
  bill_introduced: '🏛️',
  bill_passed: '✅',
  price_movement: '💹',
  regulatory_filing: '📋',
  prediction_market: '🎯',
}

interface TickerItem {
  id: string
  type: string
  severity?: 'high' | 'medium' | 'low'
  summary: string
}

export function SignalTicker({ activeTopic }: SignalTickerProps) {
  const isMobile = useIsMobile()
  const scrollRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number>(0)
  const [narrativeItems, setNarrativeItems] = useState<TickerItem[]>([])
  const { signals } = useSignals(activeTopic)

  // Fetch timeline (claim-derived) events
  useEffect(() => {
    if (!activeTopic) return
    fetch(`/data/metrics/${activeTopic}/timeline_24h.json`)
      .then(r => r.ok ? r.json() : { events: [] })
      .then((data: { events?: NarrativeEvent[] }) => {
        setNarrativeItems(
          (data.events ?? []).map(e => ({
            id: e.id,
            type: e.type,
            severity: e.severity,
            summary: e.summary,
          }))
        )
      })
      .catch(() => setNarrativeItems([]))
  }, [activeTopic])

  // Merge narrative events + external signals into one list
  const signalItems: TickerItem[] = signals.map(s => ({
    id: s.id,
    type: s.type,
    severity: s.severity,
    summary: s.title,
  }))

  const allItems: TickerItem[] = [...narrativeItems, ...signalItems]

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
  }, [allItems])

  // Duplicate for seamless loop
  const displayItems = [...allItems, ...allItems]

  if (allItems.length === 0) {
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
          padding: isMobile ? '0 12px' : '0 24px',
        }}
      >
        {displayItems.map((item, i) => {
          const icon = EVENT_ICONS[item.type] ?? '•'
          const severityColor = item.severity === 'high' ? '#EF4444'
            : item.severity === 'medium' ? '#F59E0B'
            : '#64748B'

          return (
            <span
              key={`${item.id}-${i}`}
              className="font-data flex-shrink-0"
              style={{ fontSize: '8.5px', color: severityColor }}
            >
              {icon} {item.summary}
            </span>
          )
        })}
      </div>
    </div>
  )
}
