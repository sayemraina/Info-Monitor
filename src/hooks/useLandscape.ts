import { useState, useEffect } from 'react'
import type { LandscapeData, TimeWindow } from '../types'
import { api } from '../api/client'

export function useLandscape(topicId: string | null, window: TimeWindow) {
  const [landscape, setLandscape] = useState<LandscapeData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!topicId) {
      setLandscape(null)
      return
    }

    setLoading(true)
    setError(null)

    api.getLandscape(topicId, window)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load landscape: ${res.status}`)
        return res.json()
      })
      .then((data: LandscapeData) => setLandscape(data))
      .catch(setError)
      .finally(() => setLoading(false))
  }, [topicId, window])

  return { landscape, loading, error }
}
