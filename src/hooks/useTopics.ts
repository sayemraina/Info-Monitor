import { useState, useEffect, useCallback } from 'react'
import type { TopicSummary } from '../types'
import { api } from '../api/client'

export function useTopics() {
  const [topics, setTopics] = useState<TopicSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchTopics = useCallback(() => {
    setLoading(true)
    setError(null)
    api.getTopics()
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load topics: ${res.status}`)
        return res.json()
      })
      .then((data: TopicSummary[]) => setTopics(data))
      .catch(setError)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchTopics()
  }, [fetchTopics])

  return { topics, loading, error, refetch: fetchTopics }
}
