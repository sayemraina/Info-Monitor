import type { Claim, Cluster } from '../../types'
import { getMomentumColor } from '../../utils/colors'

interface ClaimTooltipProps {
  claim: Claim
  cluster: Cluster | undefined
  momentum: number
  x: number
  y: number
}

const AROUSAL_TREND_LABEL: Record<string, string> = {
  warming: '↑ warming',
  cooling: '↓ cooling',
  stable: '→ stable',
}

const AROUSAL_TREND_COLOR: Record<string, string> = {
  warming: '#EF4444',
  cooling: '#3B82F6',
  stable: '#94A3B8',
}

export function ClaimTooltip({ claim, cluster, momentum, x, y }: ClaimTooltipProps) {
  const momentumColor = getMomentumColor(momentum)

  // Clamp tooltip so it stays within viewport
  const tooltipH = 180 // approximate
  const leftPos = Math.min(Math.max(x + 14, 8), window.innerWidth - 316)
  const topPos = Math.min(Math.max(y - 10, 8), window.innerHeight - tooltipH - 8)

  const arousalTrend = cluster?.arousal_trend ?? 'stable'
  const arousalTrendLabel = AROUSAL_TREND_LABEL[arousalTrend] ?? arousalTrend
  const arousalTrendColor = AROUSAL_TREND_COLOR[arousalTrend] ?? '#94A3B8'

  return (
    <div
      className="fixed z-50 pointer-events-none rounded-lg border text-xs"
      style={{
        left: leftPos,
        top: topPos,
        width: 300,
        backgroundColor: '#0F1929',
        borderColor: '#2D3748',
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
      }}
    >
      {/* Claim text */}
      <div className="px-3 pt-2.5 pb-2 border-b" style={{ borderColor: '#1E293B' }}>
        <p className="leading-snug" style={{ color: '#F1F5F9' }}>
          "{claim.text.slice(0, 110)}{claim.text.length > 110 ? '...' : ''}"
        </p>
        {cluster && (
          <p className="mt-1 text-[10px]" style={{ color: '#64748B' }}>
            {cluster.label}
          </p>
        )}
      </div>

      {/* Metrics grid */}
      <div className="px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {/* Confidence */}
        <div>
          <span style={{ color: '#64748B' }}>Confidence</span>
          <div className="font-data font-medium mt-0.5" style={{
            color: claim.confidence < 0.5 ? '#94A3B8' : '#F1F5F9',
            opacity: claim.confidence < 0.5 ? 0.6 : 1,
          }}>
            {claim.confidence.toFixed(2)}
            {claim.confidence < 0.5 && <span className="text-[9px] ml-1" style={{ color: '#F59E0B' }}>low</span>}
          </div>
        </div>

        {/* Momentum */}
        <div>
          <span style={{ color: '#64748B' }}>Momentum</span>
          <div className="font-data font-medium mt-0.5" style={{ color: momentumColor }}>
            {momentum > 0 ? '+' : ''}{momentum.toFixed(2)}
          </div>
        </div>

        {/* Arousal */}
        <div>
          <span style={{ color: '#64748B' }}>Arousal</span>
          <div className="font-data mt-0.5" style={{ color: '#F1F5F9' }}>
            {claim.arousal}
          </div>
        </div>

        {/* Arousal trend (cluster-level) */}
        <div>
          <span style={{ color: '#64748B' }}>Trend</span>
          <div className="font-data mt-0.5" style={{ color: arousalTrendColor }}>
            {arousalTrendLabel}
          </div>
        </div>

        {/* Cluster — cluster-level proxy */}
        <div>
          <span style={{ color: '#64748B' }}>Cluster</span>
          {cluster ? (
            <div className="font-data mt-0.5" style={{ color: '#94A3B8' }}>
              {cluster.member_count} claims
            </div>
          ) : (
            <div className="mt-0.5" style={{ color: '#4A5568' }}>—</div>
          )}
        </div>

        {/* Friction — mutation as proxy */}
        <div>
          <span style={{ color: '#64748B' }}>Mutation</span>
          {cluster ? (
            <div className="font-data mt-0.5" style={{ color: '#94A3B8' }}>
              {cluster.mutation_direction}
            </div>
          ) : (
            <div className="mt-0.5" style={{ color: '#4A5568' }}>—</div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 pb-2 flex items-center justify-between">
        <span className="text-[10px]" style={{ color: '#4A5568' }}>
          {claim.register} · {claim.stance}
        </span>
        <span className="text-[10px] italic" style={{ color: '#4A5568' }}>
          Click for full vitals
        </span>
      </div>
    </div>
  )
}
