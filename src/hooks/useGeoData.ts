import { useState, useEffect } from 'react'
import type { TopicGeoData } from '../types'
import { api } from '../api/client'

const cache = new Map<string, TopicGeoData>()

export function useGeoData(topicId: string) {
  const [geoData, setGeoData] = useState<TopicGeoData | null>(cache.get(topicId) ?? null)
  const [loading, setLoading] = useState(!cache.has(topicId))

  useEffect(() => {
    if (!topicId) return
    if (cache.has(topicId)) {
      setGeoData(cache.get(topicId)!)
      setLoading(false)
      return
    }

    setLoading(true)
    api.getGeoData(topicId)
      .then(r => r.json())
      .then((data: TopicGeoData) => {
        cache.set(topicId, data)
        setGeoData(data)
      })
      .catch(() => setGeoData(null))
      .finally(() => setLoading(false))
  }, [topicId])

  return { geoData, loading }
}
