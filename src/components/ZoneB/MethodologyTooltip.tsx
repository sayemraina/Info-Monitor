import type { TooltipContent } from '../../types'

interface MethodologyTooltipProps {
  content: TooltipContent
  rect: DOMRect
}

export function MethodologyTooltip({ content, rect }: MethodologyTooltipProps) {
  const tooltipWidth = 340
  const gap = 10

  // Position to the left if room, else to the right
  const left = rect.left > tooltipWidth + gap
    ? rect.left - tooltipWidth - gap
    : rect.right + gap

  const top = Math.max(8, Math.min(rect.top - 8, window.innerHeight - 200))

  return (
    <div
      className="fixed z-50 pointer-events-none rounded-lg text-xs"
      style={{
        left,
        top,
        width: tooltipWidth,
        backgroundColor: '#1A2234',
        border: '1px solid #2D3748',
        boxShadow: '0 8px 32px rgba(0,0,0,0.75)',
        padding: '10px 12px',
      }}
    >
      <p className="font-semibold mb-2" style={{ color: '#F1F5F9', fontSize: 11 }}>
        {content.title}
      </p>
      <div className="space-y-1.5">
        <div>
          <span style={{ color: '#64748B' }}>What: </span>
          <span style={{ color: '#94A3B8' }}>{content.calculation}</span>
        </div>
        <div>
          <span style={{ color: '#64748B' }}>Reading: </span>
          <span style={{ color: '#F1F5F9' }}>{content.reading}</span>
        </div>
        {content.caveat && (
          <div>
            <span style={{ color: '#F59E0B' }}>Caveat: </span>
            <span style={{ color: '#94A3B8' }}>{content.caveat}</span>
          </div>
        )}
      </div>
    </div>
  )
}
