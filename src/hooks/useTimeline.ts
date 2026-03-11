import { useState, useEffect, useCallback } from 'react'
import type { NarrativeEvent, EventType, TimeWindow } from '../types'
import { api } from '../api/client'

export function useTimeline(topicId: string | null, window: TimeWindow) {
  const [allEvents, setAllEvents] = useState<NarrativeEvent[]>([])
  const [events, setEvents] = useState<NarrativeEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [activeFilter, setActiveFilter] = useState<EventType | 'all'>('all')

  useEffect(() => {
    if (!topicId) {
      setAllEvents([])
      setEvents([])
      return
    }

    setLoading(true)
    setError(null)

    api.getTimeline(topicId, window)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load timeline: ${res.status}`)
        return res.json()
      })
      .then((data: { events: NarrativeEvent[]; total_count: number }) => {
        setAllEvents(data.events)
        setEvents(activeFilter === 'all'
          ? data.events
          : data.events.filter(e => e.type === activeFilter))
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }, [topicId, window, activeFilter])

  const filterByType = useCallback((type: EventType | 'all') => {
    setActiveFilter(type)
    if (type === 'all') {
      setEvents(allEvents)
    } else {
      setEvents(allEvents.filter(e => e.type === type))
    }
  }, [allEvents])

  return { events, loading, error, filterByType, activeFilter }
}
