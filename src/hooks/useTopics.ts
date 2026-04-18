import { useState, useEffect, useCallback, useRef } from 'react'
import type { TopicSummary } from '../types'
import { api } from '../api/client'
import { mark, measure } from '../utils/perf'

export function useTopics() {
  const [topics, setTopics] = useState<TopicSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchTopics = useCallback(() => {
    abortRef.current?.abort()

    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    mark('topics_fetch_start')
    api.getTopics()
      .then(res => {
        if (controller.signal.aborted) return
        if (!res.ok) throw new Error(`Failed to load topics: ${res.status}`)
        return res.json()
      })
      .then((data: TopicSummary[] | undefined) => {
        if (controller.signal.aborted || !data) return
        mark('topics_fetch_end', { count: data.length })
        measure('topics_fetch', 'topics_fetch_start', 'topics_fetch_end')
        setTopics(data)
      })
      .catch(err => {
        if (!controller.signal.aborted) setError(err)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
  }, [])

  useEffect(() => {
    fetchTopics()
    return () => abortRef.current?.abort()
  }, [fetchTopics])

  return { topics, loading, error, refetch: fetchTopics }
}
