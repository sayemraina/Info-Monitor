import { useState, useEffect } from 'react'
import type { LandscapeData, TimeWindow } from '../types'
import { api } from '../api/client'

const ALL_WINDOWS: TimeWindow[] = ['6h', '24h', '7d']
const MAX_CACHE_ENTRIES = 12 // 4 topics × 3 windows

// Module-level cache — persists across component remounts within session
const cache = new Map<string, LandscapeData>()

function cacheKey(topicId: string, window: TimeWindow): string {
  return `${topicId}_${window}`
}

function evictIfNeeded(): void {
  if (cache.size > MAX_CACHE_ENTRIES) {
    // Evict oldest entry (first key in insertion order)
    const firstKey = cache.keys().next().value
    if (firstKey) cache.delete(firstKey)
  }
}

async function fetchLandscape(topicId: string, window: TimeWindow): Promise<LandscapeData> {
  const res = await api.getLandscape(topicId, window)
  if (!res.ok) throw new Error(`Failed to load landscape: ${res.status}`)
  return res.json()
}

function prefetchAdjacentWindows(topicId: string, currentWindow: TimeWindow): void {
  const adjacent = ALL_WINDOWS.filter(w => w !== currentWindow)
  const prefetch = () => {
    for (const w of adjacent) {
      const key = cacheKey(topicId, w)
      if (!cache.has(key)) {
        fetchLandscape(topicId, w)
          .then(data => {
            evictIfNeeded()
            cache.set(key, data)
          })
          .catch(() => {}) // Silent — prefetch failures are non-critical
      }
    }
  }

  if ('requestIdleCallback' in window) {
    (window as Window).requestIdleCallback(prefetch)
  } else {
    setTimeout(prefetch, 200)
  }
}

export function useLandscape(topicId: string | null, window: TimeWindow) {
  const [landscape, setLandscape] = useState<LandscapeData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!topicId) {
      setLandscape(null)
      return
    }

    const key = cacheKey(topicId, window)
    const cached = cache.get(key)
    if (cached) {
      setLandscape(cached)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    fetchLandscape(topicId, window)
      .then(data => {
        evictIfNeeded()
        cache.set(key, data)
        setLandscape(data)
        prefetchAdjacentWindows(topicId, window)
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }, [topicId, window])

  return { landscape, loading, error }
}
