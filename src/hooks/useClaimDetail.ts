import { useState, useEffect } from 'react'
import type { ClaimDetail } from '../types'
import { api } from '../api/client'

export function useClaimDetail(topicId: string | null, claimId: string | null) {
  const [detail, setDetail] = useState<ClaimDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!topicId || !claimId) {
      setDetail(null)
      return
    }

    setLoading(true)
    setError(null)

    api.getClaimDetail(topicId, claimId)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load claim detail: ${res.status}`)
        return res.json()
      })
      .then((data: ClaimDetail) => setDetail(data))
      .catch(setError)
      .finally(() => setLoading(false))
  }, [topicId, claimId])

  return { detail, loading, error }
}
