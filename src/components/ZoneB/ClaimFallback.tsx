import type { Claim, Cluster } from '../../types'
import { getSourceDiversityColor } from '../../utils/colors'

interface ClaimFallbackProps {
  claim: Claim
  cluster?: Cluster
}

const STANCE_LABELS: Record<string, string> = {
  pro: 'Pro',
  anti: 'Anti',
  neutral: 'Neutral',
  ambiguous: 'Ambiguous',
}

const AROUSAL_COLORS: Record<string, string> = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#94A3B8',
}

export function ClaimFallback({ claim, cluster }: ClaimFallbackProps) {
  const arousalColor = AROUSAL_COLORS[claim.arousal] ?? '#94A3B8'
  const confidencePercent = Math.round(claim.confidence * 100)

  return (
    <div className="p-3 h-full overflow-y-auto">
      {/* Claim text */}
      <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
        "{claim.text}"
      </p>

      {/* Partial vitals from landscape */}
      <div className="space-y-2">
        {/* Cluster */}
        {cluster && (
          <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Cluster</span>
            <span className="text-xs font-data" style={{ color: 'var(--color-text-primary)' }}>
              {cluster.label.length > 30 ? cluster.label.slice(0, 30) + '…' : cluster.label}
            </span>
          </div>
        )}

        {/* Confidence */}
        <div className="py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Confidence</span>
            <span className="font-data text-xs" style={{ color: 'var(--color-text-primary)' }}>
              {claim.confidence.toFixed(2)}
            </span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${confidencePercent}%`,
                backgroundColor: getSourceDiversityColor(claim.confidence),
              }}
            />
          </div>
        </div>

        {/* Arousal */}
        <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Arousal</span>
          <span className="font-data text-xs" style={{ color: arousalColor }}>
            {claim.arousal}
          </span>
        </div>

        {/* Stance */}
        <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Stance</span>
          <span className="font-data text-xs" style={{ color: 'var(--color-text-primary)' }}>
            {STANCE_LABELS[claim.stance] ?? claim.stance}
          </span>
        </div>

        {/* Register */}
        <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Register</span>
          <span className="font-data text-xs" style={{ color: 'var(--color-text-primary)' }}>
            {claim.register}
          </span>
        </div>

        {/* First seen */}
        <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>First seen</span>
          <span className="font-data text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {claim.first_seen_platform} · {new Date(claim.first_seen_timestamp).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Unavailability notice */}
      <div
        className="mt-4 px-2 py-2 rounded text-[10px] leading-relaxed"
        style={{
          backgroundColor: 'rgba(100,116,139,0.08)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-muted)',
        }}
      >
        <span style={{ color: '#F59E0B' }}>⚠</span>{' '}
        Full vitals unavailable — insufficient data volume for this claim.
        Metrics require a minimum claim count per window.
      </div>
    </div>
  )
}
