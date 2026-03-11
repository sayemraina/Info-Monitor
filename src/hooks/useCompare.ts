import { useState, useEffect } from 'react'
import type { CompareData, TimeWindow } from '../types'
import { api } from '../api/client'

export function useCompare(
  topicId: string | null,
  sliceA: string | null,
  sliceB: string | null,
  window: TimeWindow,
) {
  const [compare, setCompare] = useState<CompareData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!topicId || !sliceA || !sliceB) {
      setCompare(null)
      return
    }

    setLoading(true)
    setError(null)

    api.getCompare(topicId, sliceA, sliceB, window)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load comparison: ${res.status}`)
        return res.json()
      })
      .then((data: CompareData) => setCompare(data))
      .catch(setError)
      .finally(() => setLoading(false))
  }, [topicId, sliceA, sliceB, window])

  return { compare, loading, error }
}
