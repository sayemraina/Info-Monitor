import { type ReactNode } from 'react'
import { Sparkline } from '../shared/Sparkline'
import { InfoButton } from '../shared/InfoButton'

interface MetricRowProps {
  label: string
  value: string | number
  sparkline?: number[]
  confidence?: [number, number]
  suffix?: string
  color?: string
  dimmed?: boolean
  children?: ReactNode
  infoContent?: { what: string; soWhat: string; how: string }
  onIsolate?: () => void
}

export function MetricRow({ label, value, sparkline, confidence, suffix, color, dimmed, children, infoContent, onIsolate }: MetricRowProps) {

  return (
    <div
      className={`flex items-center justify-between py-1.5 border-b transition-colors ${onIsolate ? 'cursor-pointer hover:bg-[#1A2A3C]/30' : ''}`}
      style={{
        borderColor: 'var(--color-border)',
        opacity: dimmed ? 0.3 : 1,
      }}
      onClick={onIsolate}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="text-xs shrink-0"
          style={{
            color: 'var(--color-text-muted)',
            cursor: 'default',
          }}
        >
          {label}
        </span>
        {infoContent && <InfoButton content={infoContent} term={label} />}
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
    </div>
  )
}
