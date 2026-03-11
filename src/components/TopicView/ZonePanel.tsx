import type { ReactNode } from 'react'

interface ZonePanelProps {
  title?: string
  headerRight?: ReactNode
  className?: string
  noPadding?: boolean
  children: ReactNode
}

export function ZonePanel({ title, headerRight, className = '', noPadding, children }: ZonePanelProps) {
  return (
    <div
      className={`rounded-lg overflow-hidden flex flex-col ${className}`}
      style={{ backgroundColor: 'var(--color-bg-panel)' }}
    >
      {(title || headerRight) && (
        <div
          className="px-3 py-1.5 border-b text-xs font-medium shrink-0 flex items-center justify-between"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
        >
          <span>{title}</span>
          {headerRight}
        </div>
      )}
      <div className={`flex-1 overflow-auto ${noPadding ? '' : 'p-3'}`}>
        {children}
      </div>
    </div>
  )
}
