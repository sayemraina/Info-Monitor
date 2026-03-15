interface StatusDotProps {
  color: string
  size?: number
  pulse?: boolean
  className?: string
}

export function StatusDot({ color, size = 6, pulse = false, className = '' }: StatusDotProps) {
  return (
    <span
      className={`inline-block shrink-0 rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        boxShadow: pulse ? `0 0 ${size}px ${color}` : undefined,
      }}
    />
  )
}
