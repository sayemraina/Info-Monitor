import { useState, useRef, useCallback, type ReactNode } from 'react'
import type { TooltipContent } from '../../types'
import { Sparkline } from '../shared/Sparkline'
import { MethodologyTooltip } from './MethodologyTooltip'

interface MetricRowProps {
  label: string
  value: string | number
  sparkline?: number[]
  confidence?: [number, number]
  suffix?: string
  color?: string
  dimmed?: boolean
  tooltip?: TooltipContent
  children?: ReactNode
}

export function MetricRow({ label, value, sparkline, confidence, suffix, color, dimmed, tooltip, children }: MetricRowProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const labelRef = useRef<HTMLSpanElement>(null)

  const handleMouseEnter = useCallback(() => {
    if (!tooltip) return
    timerRef.current = setTimeout(() => {
      if (labelRef.current) {
        setTooltipRect(labelRef.current.getBoundingClientRect())
        setShowTooltip(true)
      }
    }, 300)
  }, [tooltip])

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setShowTooltip(false)
    setTooltipRect(null)
  }, [])

  return (
    <div
      className="flex items-center justify-between py-1.5 border-b"
      style={{
        borderColor: 'var(--color-border)',
        opacity: dimmed ? 0.3 : 1,
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          ref={labelRef}
          className="text-xs shrink-0"
          style={{
            color: 'var(--color-text-muted)',
            cursor: tooltip ? 'help' : 'default',
            textDecoration: tooltip ? 'underline dotted' : 'none',
            textUnderlineOffset: '3px',
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {label}
        </span>
        {children}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {sparkline && <Sparkline data={sparkline} />}
        <span
          className="font-data text-xs"
          style={{ color: color ?? 'var(--color-text-primary)' }}
        >
          {typeof value === 'number' ? value.toFixed(2) : value}
          {suffix && <span style={{ color: 'var(--color-text-muted)' }}> {suffix}</span>}
        </span>
        {confidence && (
          <span className="font-data text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
            [{confidence[0].toFixed(2)}, {confidence[1].toFixed(2)}]
          </span>
        )}
      </div>

      {showTooltip && tooltipRect && tooltip && (
        <MethodologyTooltip content={tooltip} rect={tooltipRect} />
      )}
    </div>
  )
}
