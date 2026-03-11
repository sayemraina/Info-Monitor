import type { ReactNode } from 'react'

interface GreyedMetricProps {
  reason: string
  children: ReactNode
}

/** Wraps a metric at 30% opacity with a one-line explanation when data can't be computed. */
export function GreyedMetric({ reason, children }: GreyedMetricProps) {
  return (
    <div className="relative">
      <div style={{ opacity: 0.3, pointerEvents: 'none' }}>{children}</div>
      <p className="text-[9px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
        {reason}
      </p>
    </div>
  )
}
