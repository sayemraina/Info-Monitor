import type { InfluencerImpact, Cluster } from '../../types'

interface NarrativeShapersCardProps {
  impact: InfluencerImpact
  clusters?: Cluster[]
}

function directionLabel(dir: string): { text: string; color: string } {
  switch (dir) {
    case 'top_down': return { text: 'Top-down driven', color: '#EF4444' }
    case 'bottom_up': return { text: 'Bottom-up amplified', color: '#22C55E' }
    default: return { text: 'Mixed propagation', color: '#F59E0B' }
  }
}

export function NarrativeShapersCard({ impact, clusters }: NarrativeShapersCardProps) {
  const dir = directionLabel(impact.direction)
  const pct = Math.round(impact.influencer_salience_share * 100)

  // Get seeded clusters with their details
  const seededClusters = clusters?.filter(c => c.influencer_seeding?.influencer_seeded) ?? []

  if (impact.seeded_cluster_count === 0) {
    return (
      <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>
        <h3 className="font-sans text-[11px] font-semibold uppercase tracking-wider text-[#CBD5E1] mb-2" style={{ borderLeft: '2.5px solid #06B6D4', paddingLeft: '8px' }}>
          Narrative Shapers
        </h3>
        <p className="text-[10px]" style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>
          No shaper-seeded clusters detected. Narrative appears organically emerged.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>
      <h3 className="font-sans text-[11px] font-semibold uppercase tracking-wider text-[#CBD5E1] mb-3" style={{ borderLeft: '2.5px solid #06B6D4', paddingLeft: '8px' }}>
        Narrative Shapers
      </h3>

      {/* Headline metric — connects back to YouTubeStrip language */}
      <div className="flex items-baseline gap-2 mb-3">
        <span className="font-data font-bold text-lg" style={{ color: '#14B8A6' }}>
          {impact.seeded_cluster_count}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
          of {impact.total_clusters} narrative clusters trace to Narrative Shapers on YouTube
        </span>
      </div>

      {/* Metrics grid */}
      <div className="flex flex-col gap-2">
        {/* Salience share */}
        <div className="flex items-center justify-between">
          <span className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>
            Shaper salience
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
            Reaches X in
          </span>
          <span className="font-data text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
            ~{impact.avg_propagation_x}h avg
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>
            Reaches Reddit in
          </span>
          <span className="font-data text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
            ~{impact.avg_propagation_reddit}h avg
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

      {/* Per-cluster influencer propagation detail */}
      {seededClusters.length > 0 && (
        <div className="mt-3 pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
          <span className="text-[8px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            Seeded Clusters
          </span>
          <div className="flex flex-col gap-2 mt-1.5">
            {seededClusters.map(cluster => {
              const seeding = cluster.influencer_seeding!
              const contrib = Math.round(seeding.influencer_salience_contribution * 100)
              const mutDir = cluster.mutation_direction
              const mutColor = mutDir === 'mainstreaming' ? '#22C55E'
                : mutDir === 'radicalizing' ? '#EF4444'
                : mutDir === 'fragmenting' ? '#F59E0B' : '#94A3B8'

              return (
                <div
                  key={cluster.id}
                  className="rounded px-2 py-1.5"
                  style={{ backgroundColor: 'rgba(148,163,184,0.04)' }}
                >
                  <p className="text-[9px] text-slate-300 leading-snug mb-1 line-clamp-2">
                    {cluster.label}
                  </p>
                  <div className="flex items-center gap-3 text-[8px]" style={{ color: 'var(--color-text-muted)' }}>
                    <span>
                      Contribution: <span className="font-data" style={{ color: '#14B8A6' }}>{contrib}%</span>
                    </span>
                    <span>
                      <span style={{ color: mutColor }}>{mutDir}</span>
                    </span>
                  </div>
                  <div className="text-[8px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    Reaches X in ~{seeding.avg_propagation_hours.x}h · Reddit in ~{seeding.avg_propagation_hours.reddit}h
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
