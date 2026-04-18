import type { InfluencerImpact } from '../../types'

interface NarrativeShapingCardProps {
  impact: InfluencerImpact
}

function directionLabel(dir: string): { text: string; color: string } {
  switch (dir) {
    case 'top_down': return { text: 'Top-down driven', color: '#EF4444' }
    case 'bottom_up': return { text: 'Bottom-up amplified', color: '#22C55E' }
    default: return { text: 'Mixed propagation', color: '#F59E0B' }
  }
}

export function NarrativeShapingCard({ impact }: NarrativeShapingCardProps) {
  const dir = directionLabel(impact.direction)
  const pct = Math.round((impact.influencer_salience_share ?? 0) * 100)

  if (impact.seeded_cluster_count === 0) {
    return (
      <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>
        <h3 className="font-sans text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Narrative Shaping
        </h3>
        <p className="text-[10px]" style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>
          No influencer-seeded clusters detected. Narrative appears organically emerged.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>
      <h3 className="font-sans text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Narrative Shaping
      </h3>

      {/* Headline metric */}
      <div className="flex items-baseline gap-2 mb-3">
        <span className="font-data font-bold text-lg" style={{ color: '#14B8A6' }}>
          {impact.seeded_cluster_count}/{impact.total_clusters}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
          clusters influencer-seeded
        </span>
      </div>

      {/* Metrics grid */}
      <div className="flex flex-col gap-2">
        {/* Salience share */}
        <div className="flex items-center justify-between">
          <span className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>
            Influencer salience
          </span>
          <span className="font-data text-[11px]" style={{ color: pct > 30 ? '#F59E0B' : '#94A3B8' }}>
            {pct}%
          </span>
        </div>

        {/* Salience bar */}
        <div style={{ height: '3px', backgroundColor: 'rgba(148,163,184,0.1)', borderRadius: '2px' }}>
          <div style={{
            height: '100%',
            width: `${Math.min(pct, 100)}%`,
            backgroundColor: '#14B8A6',
            borderRadius: '2px',
            transition: 'width 300ms ease',
          }} />
        </div>

        {/* Propagation speed */}
        <div className="flex items-center justify-between mt-1">
          <span className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>
            Avg propagation
          </span>
          <span className="font-data text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
            {impact.avg_propagation_x ?? '—'}h → X · {impact.avg_propagation_reddit ?? '—'}h → Reddit
          </span>
        </div>

        {/* Direction */}
        <div className="flex items-center justify-between mt-1">
          <span className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>
            Direction
          </span>
          <span className="font-data text-[10px]" style={{ color: dir.color }}>
            {dir.text}
          </span>
        </div>
      </div>
    </div>
  )
}
