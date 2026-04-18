import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { NarrativeEvent, EventType, TimeWindow } from '../types'
import { api } from '../api/client'
import { mark, measure } from '../utils/perf'

const MAX_CACHE_ENTRIES = 12

interface TimelinePayload {
  events: NarrativeEvent[]
  total_count: number
}

// Module-level cache — persists across component remounts within session
const cache = new Map<string, TimelinePayload>()

function cacheKey(topicId: string, tw: TimeWindow): string {
  return `${topicId}_${tw}`
}

function evictIfNeeded(): void {
  while (cache.size > MAX_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value
    if (firstKey) cache.delete(firstKey)
    else break
  }
}

export function useTimeline(topicId: string | null, tw: TimeWindow) {
  const [allEvents, setAllEvents] = useState<NarrativeEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [activeFilter, setActiveFilter] = useState<EventType | 'all'>('all')
  const abortRef = useRef<AbortController | null>(null)

  // Fetch data — only depends on topicId and window, NOT activeFilter
  useEffect(() => {
    abortRef.current?.abort()
    abortRef.current = null

    if (!topicId) {
      setAllEvents([])
      setLoading(false)
      return
    }

    const key = cacheKey(topicId, tw)
    const cached = cache.get(key)
    if (cached) {
      setAllEvents(cached.events)
      setLoading(false)
      setError(null)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    const startMark = `timeline_fetch_start:${key}`
    const endMark = `timeline_fetch_end:${key}`
    mark(startMark)

    api.getTimeline(topicId, tw)
      .then(res => {
        if (controller.signal.aborted) return
        if (!res.ok) throw new Error(`Failed to load timeline: ${res.status}`)
        return res.json()
      })
      .then((data: TimelinePayload | undefined) => {
        if (controller.signal.aborted || !data) return
        mark(endMark, { events: data.events.length })
        measure(`timeline_fetch:${key}`, startMark, endMark)
        cache.set(key, data)
        evictIfNeeded()
        setAllEvents(data.events)
      })
      .catch(err => {
        if (controller.signal.aborted) return
        setError(err)
      })
      .finally(() => {
        if (!abortRef.current?.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [topicId, tw])

  // Client-side filter — derived state, no extra fetches
  const events = useMemo(() => {
    if (activeFilter === 'all') return allEvents
    return allEvents.filter(e => e.type === activeFilter)
  }, [allEvents, activeFilter])

  const filterByType = useCallback((type: EventType | 'all') => {
    setActiveFilter(type)
  }, [])

  return { events, loading, error, filterByType, activeFilter }
}
