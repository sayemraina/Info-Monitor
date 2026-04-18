import { useState, useEffect, useRef } from 'react'
import type { LandscapeData, TimeWindow } from '../types'
import { api } from '../api/client'
import { mark, measure } from '../utils/perf'

const ALL_WINDOWS: TimeWindow[] = ['6h', '24h', '7d']
const MAX_CACHE_ENTRIES = 12 // 4 topics × 3 windows

// Module-level cache — persists across component remounts within session
const cache = new Map<string, LandscapeData>()

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

async function fetchLandscape(topicId: string, tw: TimeWindow, signal?: AbortSignal): Promise<LandscapeData> {
  const res = await api.getLandscape(topicId, tw)
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
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
            cache.set(key, data)
            evictIfNeeded()
          })
          .catch(() => {}) // Silent — prefetch failures are non-critical
      }
    }
  }

  if ('requestIdleCallback' in globalThis) {
    (globalThis as unknown as Window).requestIdleCallback(prefetch)
  } else {
    setTimeout(prefetch, 200)
  }
}

export function useLandscape(topicId: string | null, tw: TimeWindow) {
  const [landscape, setLandscape] = useState<LandscapeData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Abort any in-flight request
    abortRef.current?.abort()
    abortRef.current = null

    if (!topicId) {
      setLandscape(null)
      setLoading(false)
      return
    }

    const key = cacheKey(topicId, tw)
    const cached = cache.get(key)
    if (cached) {
      setLandscape(cached)
      setLoading(false)
      setError(null)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    const startMark = `landscape_fetch_start:${key}`
    const endMark = `landscape_fetch_end:${key}`
    mark(startMark)

    fetchLandscape(topicId, tw, controller.signal)
      .then(data => {
        if (controller.signal.aborted) return
        mark(endMark, { bytes: JSON.stringify(data).length })
        measure(`landscape_fetch:${key}`, startMark, endMark)
        cache.set(key, data)
        evictIfNeeded()
        setLandscape(data)
        prefetchAdjacentWindows(topicId, tw)
      })
      .catch(err => {
        if (controller.signal.aborted) return
        setError(err)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [topicId, tw])

  return { landscape, loading, error }
}
