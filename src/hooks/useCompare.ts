import { useState, useEffect, useMemo } from 'react'
import type { CompareData, LandscapeData, TimeWindow } from '../types'
import { api } from '../api/client'
import { computeCompareData } from '../utils/metrics'

const MAX_CACHE_ENTRIES = 24

// Module-level cache — persists across component remounts within session
const cache = new Map<string, CompareData>()

function cacheKey(topicId: string, sliceA: string, sliceB: string, window: TimeWindow): string {
  return `${topicId}_${sliceA}_${sliceB}_${window}`
}

function evictIfNeeded(): void {
  if (cache.size > MAX_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value
    if (firstKey) cache.delete(firstKey)
  }
}

/**
 * useCompare — fetches or computes slice comparison data.
 *
 * If `landscape` is provided, computes JSD/typology/per_cluster client-side
 * for instant results (no network round-trip). Then enriches with pre-computed
 * data from the server (sparkline history, slice metadata) when available.
 */
export function useCompare(
  topicId: string | null,
  sliceA: string | null,
  sliceB: string | null,
  window: TimeWindow,
  landscape?: LandscapeData | null,
) {
  const [serverData, setServerData] = useState<CompareData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Client-side computation — instant, no loading state
  const clientComputed = useMemo(() => {
    if (!landscape || !sliceA || !sliceB) return null
    try {
      return computeCompareData(landscape, sliceA, sliceB)
    } catch {
      return null
    }
  }, [landscape, sliceA, sliceB])

  // Server fetch — enriches with sparkline history + authoritative slice metadata
  useEffect(() => {
    if (!topicId || !sliceA || !sliceB) {
      setServerData(null)
      return
    }

    const key = cacheKey(topicId, sliceA, sliceB, window)
    const cached = cache.get(key)
    if (cached) {
      setServerData(cached)
      setLoading(false)
      setError(null)
      return
    }

    // If we have client-computed data, don't show loading state
    if (!clientComputed) {
      setLoading(true)
    }
    setError(null)

    api.getCompare(topicId, sliceA, sliceB, window)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load comparison: ${res.status}`)
        return res.json()
      })
      .then((data: CompareData) => {
        evictIfNeeded()
        cache.set(key, data)
        setServerData(data)
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }, [topicId, sliceA, sliceB, window, clientComputed])

  // Merge: prefer server data (has sparkline history), fall back to client-computed
  const compare = serverData ?? clientComputed

  return { compare, loading, error }
}
