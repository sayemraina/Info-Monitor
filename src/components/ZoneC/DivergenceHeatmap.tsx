import type { PerClusterComparison } from '../../types'
import { getDivergenceHeatmapColor } from '../../utils/colors'
import { useIsMobile } from '../../hooks/useIsMobile'

interface DivergenceHeatmapProps {
  clusters: PerClusterComparison[]
  sliceALabel?: string
  sliceBLabel?: string
}

function heatmapTextColor(value: number): string {
  return value > 0.5 ? '#F1F5F9' : '#CBD5E1'
}

export function DivergenceHeatmap({ clusters, sliceALabel = 'X', sliceBLabel = 'Reddit' }: DivergenceHeatmapProps) {
  const isMobile = useIsMobile()
  if (clusters.length === 0) return null

  // Stable sort by cluster_id
  const sorted = [...clusters].sort((a, b) => a.cluster_id.localeCompare(b.cluster_id))

  const cellH = 22
  const labelW = isMobile ? 70 : 110  // narrower on mobile
  const colW = isMobile ? 36 : 44
  const gap = isMobile ? 8 : 14       // tighter on mobile
  const totalW = labelW + gap + colW + gap + colW
  const totalH = sorted.length * cellH + 22  // 22px for headers

  return (
    <svg width="100%" height={totalH} viewBox={`0 0 ${totalW} ${totalH}`} className="block">
      {/* Column headers — real platform names */}
      <text
        x={labelW + gap + colW / 2}
        y={12}
        textAnchor="middle"
        fill="#3B82F6"
        fontSize={9}
        fontFamily="var(--font-data)"
        fontWeight={600}
        letterSpacing={0.5}
      >
        {sliceALabel}
      </text>
      <text
        x={labelW + gap + colW + gap + colW / 2}
        y={12}
        textAnchor="middle"
        fill="#EF4444"
        fontSize={9}
        fontFamily="var(--font-data)"
        fontWeight={600}
        letterSpacing={0.5}
      >
        {sliceBLabel}
      </text>

      {sorted.map((c, i) => {
        const y = 20 + i * cellH
        const a = c.salience_a
        const b = c.salience_b
        // Use cluster label if available, fall back to index
        const label = c.label || `Cluster ${i + 1}`
        // Truncate long labels — 20 chars is enough for most cluster names
        const displayLabel = label.length > 20 ? label.substring(0, 18) + '…' : label

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

            {/* Slice A cell */}
            <rect
              x={labelW + gap}
              y={y + 1}
              width={colW}
              height={cellH - 3}
              rx={3}
              fill={getDivergenceHeatmapColor(Math.min(a, 1))}
            />
            <text
              x={labelW + gap + colW / 2}
              y={y + cellH / 2 + 3}
              textAnchor="middle"
              fill={heatmapTextColor(a)}
              fontSize={10}
              fontFamily="var(--font-data)"
              fontWeight={600}
            >
              {a.toFixed(2)}
            </text>

            {/* Slice B cell */}
            <rect
              x={labelW + gap + colW + gap}
              y={y + 1}
              width={colW}
              height={cellH - 3}
              rx={3}
              fill={getDivergenceHeatmapColor(Math.min(b, 1))}
            />
            <text
              x={labelW + gap + colW + gap + colW / 2}
              y={y + cellH / 2 + 3}
              textAnchor="middle"
              fill={heatmapTextColor(b)}
              fontSize={10}
              fontFamily="var(--font-data)"
              fontWeight={600}
            >
              {b.toFixed(2)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
