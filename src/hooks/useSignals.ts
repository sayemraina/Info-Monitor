import { useState, useEffect, useRef } from 'react'
import type { EventSignal } from '../types'
import { api } from '../api/client'

const MAX_CACHE_ENTRIES = 12
const cache = new Map<string, EventSignal[]>()

function evictIfNeeded(): void {
  while (cache.size > MAX_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value
    if (firstKey) cache.delete(firstKey)
    else break
  }
}

export function useSignals(topicId: string) {
  const [signals, setSignals] = useState<EventSignal[]>(cache.get(topicId) ?? [])
  const [loading, setLoading] = useState(!cache.has(topicId))
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    abortRef.current = null

    if (!topicId) return

    if (cache.has(topicId)) {
      setSignals(cache.get(topicId)!)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    api.getSignals(topicId)
      .then(r => {
        if (controller.signal.aborted) return
        return r.json()
      })
      .then((data: EventSignal[] | undefined) => {
        if (controller.signal.aborted || !data) return
        cache.set(topicId, data)
        evictIfNeeded()
        setSignals(data)
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSignals([])
          setError('Failed to load signals')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [topicId])

  return { signals, loading, error }
}
