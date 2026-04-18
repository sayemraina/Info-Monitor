import { useState, useEffect, useRef } from 'react'
import type { TopicGeoData } from '../types'
import { api } from '../api/client'

const MAX_CACHE_ENTRIES = 12
const cache = new Map<string, TopicGeoData>()

function evictIfNeeded(): void {
  while (cache.size > MAX_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value
    if (firstKey) cache.delete(firstKey)
    else break
  }
}

export function useGeoData(topicId: string) {
  const [geoData, setGeoData] = useState<TopicGeoData | null>(cache.get(topicId) ?? null)
  const [loading, setLoading] = useState(!cache.has(topicId))
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    abortRef.current = null

    if (!topicId) return

    if (cache.has(topicId)) {
      setGeoData(cache.get(topicId)!)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    api.getGeoData(topicId)
      .then(r => {
        if (controller.signal.aborted) return
        return r.json()
      })
      .then((data: TopicGeoData | undefined) => {
        if (controller.signal.aborted || !data) return
        cache.set(topicId, data)
        evictIfNeeded()
        setGeoData(data)
      })
      .catch(() => {
        if (!controller.signal.aborted) setGeoData(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [topicId])

  return { geoData, loading }
}
