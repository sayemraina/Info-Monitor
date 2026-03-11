import type { ReactNode } from 'react'

interface LowConfidenceProps {
  confidence: number
  threshold?: number
  children: ReactNode
}

/** Renders children at 40% opacity when confidence is below threshold (default 0.5). */
export function LowConfidence({ confidence, threshold = 0.5, children }: LowConfidenceProps) {
  if (confidence >= threshold) return <>{children}</>
  return <div style={{ opacity: 0.4 }}>{children}</div>
}
