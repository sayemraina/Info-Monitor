import type { ReactNode } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'

interface ZonePanelProps {
  title?: string
  titleInfo?: ReactNode
  headerRight?: ReactNode
  className?: string
  noPadding?: boolean
  children: ReactNode
}

export function ZonePanel({ title, titleInfo, headerRight, className = '', noPadding, children }: ZonePanelProps) {
  const isMobile = useIsMobile();
  return (
    <div
      className={`rounded-lg overflow-hidden flex flex-col ${className}`}
      style={{ backgroundColor: 'var(--color-bg-panel)' }}
    >
      {(title || headerRight) && (
        <div
          className={`${isMobile ? 'px-2 py-1' : 'px-3 py-1.5'} border-b text-[11px] font-semibold uppercase tracking-wider shrink-0 flex items-center justify-between`}
          style={{ borderColor: 'var(--color-border)', color: '#CBD5E1' }}
        >
          <span className="flex items-center" style={{ borderLeft: '2.5px solid #06B6D4', paddingLeft: '8px' }}>{title}{titleInfo}</span>
          {headerRight}
        </div>
      )}
      <div className={`flex-1 overflow-auto ${noPadding ? '' : (isMobile ? 'p-2' : 'p-3')}`}>
        {children}
      </div>
    </div>
  )
}
