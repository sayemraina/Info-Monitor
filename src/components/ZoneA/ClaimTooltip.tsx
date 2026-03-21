import type { Claim, Cluster } from '../../types'
import { getMomentumColor } from '../../utils/colors'
import { InfoButton } from '../shared/InfoButton'
import { GLOSSARY } from '../../constants/glossary'

interface ClaimTooltipProps {
  claim: Claim
  cluster: Cluster | undefined
  momentum: number
  x: number
  y: number
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onClick?: (e: React.MouseEvent) => void
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

export function ClaimTooltip({ claim, cluster, momentum, x, y, onMouseEnter, onMouseLeave, onClick }: ClaimTooltipProps) {
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
      className={`fixed z-50 pointer-events-auto rounded-lg border text-xs ${onClick ? 'cursor-pointer hover:border-slate-500 transition-colors' : ''}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      style={{
        left: leftPos,
        top: topPos,
        width: 300,
        backgroundColor: '#0F1923',
        borderColor: '#1E3044',
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
      }}
    >
      {/* Claim text */}
      <div className="px-3 pt-2.5 pb-2 border-b" style={{ borderColor: '#152540' }}>
        <p className="leading-snug" style={{ color: '#F1F5F9' }}>
          "{claim.text.slice(0, 110)}{claim.text.length > 110 ? '...' : ''}"
        </p>
      </div>

      {/* Metrics grid */}
      <div className="px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {/* Confidence */}
        <div>
          <span style={{ color: '#64748B' }} className="flex items-center gap-1">
            Confidence <InfoButton term="Confidence" content={GLOSSARY.Confidence} />
          </span>
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
          <span style={{ color: '#64748B' }} className="flex items-center gap-1">
            Momentum <InfoButton term="Momentum" content={GLOSSARY.Momentum} />
          </span>
          <div className="font-data font-medium mt-0.5" style={{ color: momentumColor }}>
            {momentum > 0 ? '+' : ''}{momentum.toFixed(2)}
          </div>
        </div>

        {/* Arousal */}
        <div>
          <span style={{ color: '#64748B' }} className="flex items-center gap-1">
            Arousal <InfoButton term="Arousal" content={GLOSSARY.Arousal} />
          </span>
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
          <span style={{ color: '#64748B' }} className="flex items-center gap-1">
            Cluster <InfoButton term="Narrative Cluster" content={GLOSSARY.NarrativeCluster} />
          </span>
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
          <span style={{ color: '#64748B' }} className="flex items-center gap-1">
            Mutation <InfoButton term="Mutation Direction" content={GLOSSARY.Mutation} />
          </span>
          {cluster ? (
            <div className="font-data mt-0.5" style={{ color: '#94A3B8' }}>
              {cluster.mutation_direction}
            </div>
          ) : (
            <div className="mt-0.5" style={{ color: '#4A5568' }}>—</div>
          )}
        </div>
      </div>

      {/* Platform Presence */}
      {claim.platform_presence && (
        <div className="px-3 py-1.5 border-t" style={{ borderColor: '#152540' }}>
          <div className="text-[9px] uppercase tracking-wider mb-1" style={{ color: '#475569' }}>
            Platform Presence
          </div>
          <div className="flex gap-3">
            {Object.entries(claim.platform_presence)
              .sort(([, a], [, b]) => b - a)
              .map(([platform, share]) => {
                const label = platform === 'x_platform' ? 'X'
                  : platform === 'reddit_platform' ? 'Reddit'
                  : platform === 'youtube_influencer' ? 'YouTube'
                  : platform
                return (
                  <div key={platform} className="flex items-center gap-1">
                    <span className="text-[10px] font-mono" style={{ color: '#94A3B8' }}>{label}</span>
                    <span className="text-[10px] font-mono" style={{ color: '#F1F5F9' }}>
                      {Math.round(share * 100)}%
                    </span>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-3 pb-2 flex items-center justify-between">
        <span className="relative group/meta">
          <span
            className="text-[10px] cursor-help border-b border-dotted"
            style={{ color: '#64748B', borderColor: '#1E3044' }}
          >
            {claim.register} · {claim.stance}
          </span>
          <span
            className="absolute bottom-full left-0 mb-1.5 hidden group-hover/meta:block z-10 rounded px-2 py-1.5 text-[10px] leading-relaxed whitespace-nowrap pointer-events-none"
            style={{ backgroundColor: '#152540', border: '1px solid #1E3044', color: '#CBD5E1' }}
          >
            <span style={{ color: '#94A3B8' }}>Register:</span> how the claim is expressed<br />
            <span style={{ color: '#94A3B8' }}>Stance:</span> orientation toward the topic
          </span>
        </span>
        <span className="text-[10px] italic" style={{ color: '#4A5568' }}>
          Click for full detail cards
        </span>
      </div>
    </div>
  )
}
