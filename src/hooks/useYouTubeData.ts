import { useState, useEffect, useRef } from 'react'
import type { VideoMetadata } from '../types'
import { api } from '../api/client'

const MAX_CACHE_ENTRIES = 12
const cache = new Map<string, VideoMetadata[]>()

function evictIfNeeded(): void {
  while (cache.size > MAX_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value
    if (firstKey) cache.delete(firstKey)
    else break
  }
}

export function useYouTubeData(topicId: string) {
  const [videos, setVideos] = useState<VideoMetadata[]>(cache.get(topicId) ?? [])
  const [loading, setLoading] = useState(!cache.has(topicId))
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    abortRef.current = null

    if (!topicId) return

    if (cache.has(topicId)) {
      setVideos(cache.get(topicId)!)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    api.getYouTubeData(topicId)
      .then(r => {
        if (controller.signal.aborted) return
        return r.json()
      })
      .then((data: VideoMetadata[] | undefined) => {
        if (controller.signal.aborted || !data) return
        cache.set(topicId, data)
        evictIfNeeded()
        setVideos(data)
      })
      .catch(() => {
        if (!controller.signal.aborted) setVideos([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [topicId])

  return { videos, loading }
}
