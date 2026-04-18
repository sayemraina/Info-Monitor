import type { PerClusterComparison } from '../../types'
import { getDivergenceHeatmapColor, getMutationColor } from '../../utils/colors'
import { useIsMobile } from '../../hooks/useIsMobile'

interface DivergenceHeatmapProps {
  clusters: PerClusterComparison[]
  sliceALabel?: string
  sliceBLabel?: string
}

function heatmapTextColor(value: number): string {
  return value > 0.5 ? '#F1F5F9' : '#CBD5E1'
}

/** Arousal value → background color */
function arousalColor(value: number): string {
  if (value >= 0.7) return 'rgba(239,68,68,0.5)'   // high — warm red
  if (value >= 0.4) return 'rgba(245,158,11,0.35)'  // medium — amber
  return 'rgba(148,163,184,0.2)'                     // low — slate
}

/** Mutation direction → compact arrow symbol */
function mutationArrow(direction: string): string {
  switch (direction) {
    case 'mainstreaming': return '→'
    case 'radicalizing': return '↗'
    case 'fragmenting': return '⤳'
    case 'stable': return '·'
    default: return '·'
  }
}

export function DivergenceHeatmap({ clusters, sliceALabel = 'X', sliceBLabel = 'Reddit' }: DivergenceHeatmapProps) {
  const isMobile = useIsMobile()
  if (clusters.length === 0) return null

  // Stable sort by cluster_id
  const sorted = [...clusters].sort((a, b) => a.cluster_id.localeCompare(b.cluster_id))

  const cellH = 22
  const labelW = isMobile ? 66 : 100
  const colW = isMobile ? 30 : 36     // salience columns
  const arousalW = isMobile ? 24 : 28 // arousal columns
  const mutW = isMobile ? 16 : 18     // mutation columns
  const gap = isMobile ? 4 : 6
  const sectionGap = isMobile ? 8 : 12

  // Layout: label | gap | salA | gap | salB | sectionGap | aroA | gap | aroB | sectionGap | mutA | gap | mutB
  const salStart = labelW + gap
  const aroStart = salStart + colW + gap + colW + sectionGap
  const mutStart = aroStart + arousalW + gap + arousalW + sectionGap
  const totalW = mutStart + mutW + gap + mutW
  const headerH = 28
  const subHeaderH = 14
  const totalH = sorted.length * cellH + headerH + subHeaderH

  return (
    <svg width="100%" height={totalH} viewBox={`0 0 ${totalW} ${totalH}`} className="block">
      {/* Section headers */}
      <text x={salStart + colW + gap / 2} y={10} textAnchor="middle" fill="#94A3B8" fontSize={8} fontFamily="var(--font-sans)" fontWeight={600} letterSpacing={0.8}>
        SALIENCE
      </text>
      <text x={aroStart + arousalW + gap / 2} y={10} textAnchor="middle" fill="#94A3B8" fontSize={8} fontFamily="var(--font-sans)" fontWeight={600} letterSpacing={0.8}>
        AROUSAL
      </text>
      <text x={mutStart + mutW + gap / 2} y={10} textAnchor="middle" fill="#94A3B8" fontSize={8} fontFamily="var(--font-sans)" fontWeight={600} letterSpacing={0.8}>
        MUT
      </text>

      {/* Column sub-headers — slice labels */}
      <text x={salStart + colW / 2} y={10 + subHeaderH} textAnchor="middle" fill="#3B82F6" fontSize={8} fontFamily="var(--font-data)" fontWeight={600}>
        {sliceALabel.substring(0, 6)}
      </text>
      <text x={salStart + colW + gap + colW / 2} y={10 + subHeaderH} textAnchor="middle" fill="#EF4444" fontSize={8} fontFamily="var(--font-data)" fontWeight={600}>
        {sliceBLabel.substring(0, 6)}
      </text>
      <text x={aroStart + arousalW / 2} y={10 + subHeaderH} textAnchor="middle" fill="#3B82F6" fontSize={8} fontFamily="var(--font-data)" fontWeight={600}>
        {sliceALabel.substring(0, 3)}
      </text>
      <text x={aroStart + arousalW + gap + arousalW / 2} y={10 + subHeaderH} textAnchor="middle" fill="#EF4444" fontSize={8} fontFamily="var(--font-data)" fontWeight={600}>
        {sliceBLabel.substring(0, 3)}
      </text>
      <text x={mutStart + mutW / 2} y={10 + subHeaderH} textAnchor="middle" fill="#3B82F6" fontSize={8} fontFamily="var(--font-data)" fontWeight={600}>
        {sliceALabel.substring(0, 2)}
      </text>
      <text x={mutStart + mutW + gap + mutW / 2} y={10 + subHeaderH} textAnchor="middle" fill="#EF4444" fontSize={8} fontFamily="var(--font-data)" fontWeight={600}>
        {sliceBLabel.substring(0, 2)}
      </text>

      {sorted.map((c, i) => {
        const y = headerH + subHeaderH + i * cellH
        const label = c.label || `Cluster ${i + 1}`
        const displayLabel = label.length > 16 ? label.substring(0, 14) + '…' : label

        return (
          <g key={c.cluster_id}>
            {/* Row label — cluster name */}
            <text
              x={labelW - 4}
              y={y + cellH / 2 + 3}
              textAnchor="end"
              fill="#94A3B8"
              fontSize={9}
              fontFamily="var(--font-sans)"
              fontWeight={500}
            >
              {displayLabel}
            </text>

            {/* Salience A */}
            <rect x={salStart} y={y + 1} width={colW} height={cellH - 3} rx={3}
              fill={getDivergenceHeatmapColor(Math.min(c.salience_a, 1))} />
            <text x={salStart + colW / 2} y={y + cellH / 2 + 3} textAnchor="middle"
              fill={heatmapTextColor(c.salience_a)} fontSize={9} fontFamily="var(--font-data)" fontWeight={600}>
              {c.salience_a.toFixed(2)}
            </text>

            {/* Salience B */}
            <rect x={salStart + colW + gap} y={y + 1} width={colW} height={cellH - 3} rx={3}
              fill={getDivergenceHeatmapColor(Math.min(c.salience_b, 1))} />
            <text x={salStart + colW + gap + colW / 2} y={y + cellH / 2 + 3} textAnchor="middle"
              fill={heatmapTextColor(c.salience_b)} fontSize={9} fontFamily="var(--font-data)" fontWeight={600}>
              {c.salience_b.toFixed(2)}
            </text>

            {/* Arousal A */}
            <rect x={aroStart} y={y + 1} width={arousalW} height={cellH - 3} rx={3}
              fill={arousalColor(c.arousal_a)} />
            <text x={aroStart + arousalW / 2} y={y + cellH / 2 + 3} textAnchor="middle"
              fill="#F1F5F9" fontSize={9} fontFamily="var(--font-data)" fontWeight={500}>
              {c.arousal_a.toFixed(1)}
            </text>

            {/* Arousal B */}
            <rect x={aroStart + arousalW + gap} y={y + 1} width={arousalW} height={cellH - 3} rx={3}
              fill={arousalColor(c.arousal_b)} />
            <text x={aroStart + arousalW + gap + arousalW / 2} y={y + cellH / 2 + 3} textAnchor="middle"
              fill="#F1F5F9" fontSize={9} fontFamily="var(--font-data)" fontWeight={500}>
              {c.arousal_b.toFixed(1)}
            </text>

            {/* Mutation A */}
            <text x={mutStart + mutW / 2} y={y + cellH / 2 + 3} textAnchor="middle"
              fill={getMutationColor(c.mutation_a)} fontSize={11} fontFamily="var(--font-data)" fontWeight={600}>
              {mutationArrow(c.mutation_a)}
            </text>

            {/* Mutation B */}
            <text x={mutStart + mutW + gap + mutW / 2} y={y + cellH / 2 + 3} textAnchor="middle"
              fill={getMutationColor(c.mutation_b)} fontSize={11} fontFamily="var(--font-data)" fontWeight={600}>
              {mutationArrow(c.mutation_b)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
