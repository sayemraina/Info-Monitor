import type { PerClusterComparison } from '../../types'
import { getDivergenceHeatmapColor } from '../../utils/colors'

interface DivergenceHeatmapProps {
  clusters: PerClusterComparison[]
}

export function DivergenceHeatmap({ clusters }: DivergenceHeatmapProps) {
  if (clusters.length === 0) return null

  const cellH = 18
  const labelW = 90
  const colW = 50
  const width = labelW + colW * 2 + 10
  const height = clusters.length * cellH + 24

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="block">
      {/* Column headers */}
      <text x={labelW + colW / 2} y={12} textAnchor="middle" fill="var(--color-text-muted)" fontSize={8} fontFamily="var(--font-data)">
        Slice A
      </text>
      <text x={labelW + colW + 5 + colW / 2} y={12} textAnchor="middle" fill="var(--color-text-muted)" fontSize={8} fontFamily="var(--font-data)">
        Slice B
      </text>

      {clusters.map((c, i) => {
        const y = 20 + i * cellH
        const diffA = c.salience_a
        const diffB = c.salience_b
        // Normalize for color: use the absolute difference from mean
        const mean = (diffA + diffB) / 2 || 0.01
        const divergence = Math.abs(diffA - diffB) / (mean * 2)

        return (
          <g key={c.cluster_id}>
            <text
              x={labelW - 4}
              y={y + cellH / 2 + 3}
              textAnchor="end"
              fill="var(--color-text-muted)"
              fontSize={8}
              fontFamily="var(--font-sans)"
            >
              {c.label.length > 16 ? c.label.slice(0, 15) + '…' : c.label}
            </text>
            <rect
              x={labelW}
              y={y}
              width={colW}
              height={cellH - 2}
              rx={2}
              fill={getDivergenceHeatmapColor(Math.min(diffA, 1))}
            />
            <text
              x={labelW + colW / 2}
              y={y + cellH / 2 + 3}
              textAnchor="middle"
              fill="#F1F5F9"
              fontSize={8}
              fontFamily="var(--font-data)"
            >
              {diffA.toFixed(2)}
            </text>
            <rect
              x={labelW + colW + 5}
              y={y}
              width={colW}
              height={cellH - 2}
              rx={2}
              fill={getDivergenceHeatmapColor(Math.min(diffB, 1))}
            />
            <text
              x={labelW + colW + 5 + colW / 2}
              y={y + cellH / 2 + 3}
              textAnchor="middle"
              fill="#F1F5F9"
              fontSize={8}
              fontFamily="var(--font-data)"
            >
              {diffB.toFixed(2)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
