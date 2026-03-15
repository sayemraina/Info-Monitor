import { useState, useEffect } from 'react'
import type { DiscoursePost } from '../types'
import { api } from '../api/client'

const cache = new Map<string, DiscoursePost[]>()

export function useDiscourseData(topicId: string) {
  const [posts, setPosts] = useState<DiscoursePost[]>(cache.get(topicId) ?? [])
  const [loading, setLoading] = useState(!cache.has(topicId))

  useEffect(() => {
    if (!topicId) return
    if (cache.has(topicId)) {
      setPosts(cache.get(topicId)!)
      setLoading(false)
      return
    }

    setLoading(true)
    api.getDiscourseData(topicId)
      .then(r => r.json())
      .then((data: DiscoursePost[]) => {
        cache.set(topicId, data)
        setPosts(data)
      })
      .catch(() => setPosts([]))
      .finally(() => setLoading(false))
  }, [topicId])

  return { posts, loading }
}
