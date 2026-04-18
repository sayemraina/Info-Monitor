import { useState, useEffect, useMemo, useRef } from 'react'
import type { CompareData, LandscapeData, TimeWindow } from '../types'
import { api } from '../api/client'
import { computeCompareData } from '../utils/metrics'

const MAX_CACHE_ENTRIES = 24

// Module-level cache — persists across component remounts within session
const cache = new Map<string, CompareData>()

function cacheKey(topicId: string, sliceA: string, sliceB: string, tw: TimeWindow): string {
  return `${topicId}_${sliceA}_${sliceB}_${tw}`
}

function evictIfNeeded(): void {
  while (cache.size > MAX_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value
    if (firstKey) cache.delete(firstKey)
    else break
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
  tw: TimeWindow,
  landscape?: LandscapeData | null,
) {
  const [serverData, setServerData] = useState<CompareData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const abortRef = useRef<AbortController | null>(null)

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
  // IMPORTANT: does NOT depend on clientComputed (that caused potential infinite loop)
  useEffect(() => {
    abortRef.current?.abort()
    abortRef.current = null

    if (!topicId || !sliceA || !sliceB) {
      setServerData(null)
      setLoading(false)
      return
    }

    const key = cacheKey(topicId, sliceA, sliceB, tw)
    const cached = cache.get(key)
    if (cached) {
      setServerData(cached)
      setLoading(false)
      setError(null)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    api.getCompare(topicId, sliceA, sliceB, tw)
      .then(res => {
        if (controller.signal.aborted) return
        if (!res.ok) throw new Error(`Failed to load comparison: ${res.status}`)
        return res.json()
      })
      .then((data: CompareData | undefined) => {
        if (controller.signal.aborted || !data) return
        cache.set(key, data)
        evictIfNeeded()
        setServerData(data)
      })
      .catch(err => {
        if (controller.signal.aborted) return
        setError(err)
      })
      .finally(() => {
        if (!abortRef.current?.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [topicId, sliceA, sliceB, tw])

  // Merge: prefer server data (has sparkline history), fall back to client-computed
  const compare = serverData ?? clientComputed

  return { compare, loading, error }
}
