import type { LandscapeData } from '../../types'
import { useClaimDetail } from '../../hooks/useClaimDetail'
import { TopicOverviewVitals } from './TopicOverviewVitals'
import { ClaimVitals } from './ClaimVitals'
import { ClaimFallback } from './ClaimFallback'

interface VitalsPanelProps {
  topicId: string
  selectedClaimId: string | null
  landscape: LandscapeData | null
  compareMode?: boolean
}

export function VitalsPanel({ topicId, selectedClaimId, landscape, compareMode }: VitalsPanelProps) {
  // In compare mode, show topic overview regardless of claim selection
  const effectiveClaimId = compareMode ? null : selectedClaimId
  const { detail, loading, error } = useClaimDetail(topicId, effectiveClaimId)

  if (effectiveClaimId) {
    if (loading) {
      return (
        <div className="h-full flex items-center justify-center">
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Loading claim data...</p>
        </div>
      )
    }
    if (error || !detail) {
      // Graceful degradation: show basic claim info from the landscape if available
      const basicClaim = landscape?.claims.find(c => c.id === effectiveClaimId)
      if (basicClaim) {
        const cluster = landscape?.clusters.find(c => c.id === basicClaim.cluster_id)
        return <ClaimFallback claim={basicClaim} cluster={cluster} />
      }
      // No landscape data at all — generic message
      return (
        <div className="h-full flex flex-col items-center justify-center gap-2 p-4">
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Claim detail unavailable
          </p>
          <p className="text-[10px] text-center" style={{ color: 'var(--color-text-muted)' }}>
            Insufficient data volume for this claim
          </p>
        </div>
      )
    }
    return <ClaimVitals detail={detail} landscape={landscape} />
  }

  if (!landscape) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Select a claim to inspect</p>
      </div>
    )
  }

  return <TopicOverviewVitals landscape={landscape} />
}
