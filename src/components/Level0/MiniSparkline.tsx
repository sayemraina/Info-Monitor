interface MiniSparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  filled?: boolean
}

export function MiniSparkline({
  data,
  width = 120,
  height = 28,
  color = 'var(--color-cyan)',
  filled = true,
}: MiniSparklineProps) {
  if (data.length < 2) return null

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const padding = 2

  const coords = data.map((v, i) => ({
    x: padding + (i / (data.length - 1)) * (width - padding * 2),
    y: height - padding - ((v - min) / range) * (height - padding * 2),
  }))

  const linePoints = coords.map(c => `${c.x},${c.y}`).join(' ')

  // Closed polygon for fill: line points + bottom-right + bottom-left
  const fillPoints = [
    ...coords.map(c => `${c.x},${c.y}`),
    `${coords[coords.length - 1].x},${height}`,
    `${coords[0].x},${height}`,
  ].join(' ')

  const lastPoint = coords[coords.length - 1]
  const gradientId = `sparkFill-${width}-${height}`

  return (
    <svg width={width} height={height} className="inline-block">
      {filled && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.15} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
      )}
      {filled && (
        <polygon
          points={fillPoints}
          fill={`url(#${gradientId})`}
        />
      )}
      <polyline
        points={linePoints}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Current value dot */}
      <circle
        cx={lastPoint.x}
        cy={lastPoint.y}
        r={2.5}
        fill={color}
        opacity={0.8}
      />
    </svg>
  )
}
