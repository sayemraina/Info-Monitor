import { useState, useEffect, useRef } from 'react'
import type { DiscoursePost } from '../types'
import { api } from '../api/client'

const MAX_CACHE_ENTRIES = 12
const cache = new Map<string, DiscoursePost[]>()

function evictIfNeeded(): void {
  while (cache.size > MAX_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value
    if (firstKey) cache.delete(firstKey)
    else break
  }
}

export function useDiscourseData(topicId: string) {
  const [posts, setPosts] = useState<DiscoursePost[]>(cache.get(topicId) ?? [])
  const [loading, setLoading] = useState(!cache.has(topicId))
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    abortRef.current = null

    if (!topicId) return

    if (cache.has(topicId)) {
      setPosts(cache.get(topicId)!)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    api.getDiscourseData(topicId)
      .then(r => {
        if (controller.signal.aborted) return
        return r.json()
      })
      .then((data: DiscoursePost[] | undefined) => {
        if (controller.signal.aborted || !data) return
        cache.set(topicId, data)
        evictIfNeeded()
        setPosts(data)
      })
      .catch(() => {
        if (!controller.signal.aborted) setPosts([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [topicId])

  return { posts, loading }
}
