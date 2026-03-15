import { useState, useEffect } from 'react'
import type { VideoMetadata } from '../types'
import { api } from '../api/client'

const cache = new Map<string, VideoMetadata[]>()

export function useYouTubeData(topicId: string) {
  const [videos, setVideos] = useState<VideoMetadata[]>(cache.get(topicId) ?? [])
  const [loading, setLoading] = useState(!cache.has(topicId))

  useEffect(() => {
    if (!topicId) return
    if (cache.has(topicId)) {
      setVideos(cache.get(topicId)!)
      setLoading(false)
      return
    }

    setLoading(true)
    api.getYouTubeData(topicId)
      .then(r => r.json())
      .then((data: VideoMetadata[]) => {
        cache.set(topicId, data)
        setVideos(data)
      })
      .catch(() => setVideos([]))
      .finally(() => setLoading(false))
  }, [topicId])

  return { videos, loading }
}
