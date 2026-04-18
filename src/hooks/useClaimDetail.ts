import { useState, useEffect, useRef } from 'react'
import type { ClaimDetail } from '../types'
import { api } from '../api/client'

const MAX_CACHE_ENTRIES = 20
const cache = new Map<string, ClaimDetail>()

function detailKey(topicId: string, claimId: string): string {
  return `${topicId}_${claimId}`
}

function evictIfNeeded(): void {
  while (cache.size > MAX_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value
    if (firstKey) cache.delete(firstKey)
    else break
  }
}

export function useClaimDetail(topicId: string | null, claimId: string | null) {
  const [detail, setDetail] = useState<ClaimDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    abortRef.current = null

    if (!topicId || !claimId) {
      setDetail(null)
      setLoading(false)
      setError(null)
      return
    }

    const key = detailKey(topicId, claimId)
    const cached = cache.get(key)
    if (cached) {
      setDetail(cached)
      setLoading(false)
      setError(null)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    api.getClaimDetail(topicId, claimId)
      .then(res => {
        if (controller.signal.aborted) return
        if (!res.ok) throw new Error(`Failed to load claim detail: ${res.status}`)
        return res.json()
      })
      .then((data: ClaimDetail | undefined) => {
        if (controller.signal.aborted || !data) return
        cache.set(key, data)
        evictIfNeeded()
        setDetail(data)
      })
      .catch(err => {
        if (controller.signal.aborted) return
        setError(err)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [topicId, claimId])

  return { detail, loading, error }
}
