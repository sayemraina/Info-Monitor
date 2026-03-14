import type { PerClusterComparison } from '../../types'
import { getDivergenceHeatmapColor } from '../../utils/colors'

interface DivergenceHeatmapProps {
  clusters: PerClusterComparison[]
}

function heatmapTextColor(value: number): string {
  return value > 0.5 ? '#F1F5F9' : '#CBD5E1'
}

export function DivergenceHeatmap({ clusters }: DivergenceHeatmapProps) {
  if (clusters.length === 0) return null

  // Stable sort by cluster_id — matches the Cluster N badge numbers on the map
  const sorted = [...clusters].sort((a, b) => a.cluster_id.localeCompare(b.cluster_id))

  const cellH = 22
  const labelW = 52   // just enough for "Claim 8" at 10px
  const colW = 52
  const gap = 16      // generous column separation for clean visual rhythm
  const totalW = labelW + gap + colW + gap + colW
  const totalH = sorted.length * cellH + 22  // 22px for headers

  return (
    <svg width="100%" height={totalH} viewBox={`0 0 ${totalW} ${totalH}`} className="block">
      {/* Column headers */}
      <text
        x={labelW + gap + colW / 2}
        y={12}
        textAnchor="middle"
        fill="var(--color-text-muted)"
        fontSize={9}
        fontFamily="var(--font-data)"
        fontWeight={600}
        letterSpacing={0.5}
      >
        Slice A
      </text>
      <text
        x={labelW + gap + colW + gap + colW / 2}
        y={12}
        textAnchor="middle"
        fill="var(--color-text-muted)"
        fontSize={9}
        fontFamily="var(--font-data)"
        fontWeight={600}
        letterSpacing={0.5}
      >
        Slice B
      </text>

      {sorted.map((c, i) => {
        const y = 20 + i * cellH
        const a = c.salience_a
        const b = c.salience_b
        const label = `Claim ${i + 1}`

        return (
          <g key={c.cluster_id}>
            {/* Row label — right-aligned, fixed column */}
            <text
              x={labelW - 2}
              y={y + cellH / 2 + 3}
              textAnchor="end"
              fill="#64748B"
              fontSize={10}
              fontFamily="var(--font-sans)"
              fontWeight={500}
            >
              {label}
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
