import type { TimeWindow } from '../../types'

interface TimeWindowControlProps {
  value: TimeWindow
  onChange: (tw: TimeWindow) => void
}

const windows: TimeWindow[] = ['6h', '24h', '7d']

export function TimeWindowControl({ value, onChange }: TimeWindowControlProps) {
  return (
    <div className="flex items-center gap-0.5 rounded p-0.5" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      {windows.map(tw => (
        <button
          key={tw}
          onClick={() => onChange(tw)}
          className="px-2.5 py-0.5 rounded text-xs font-data transition-colors cursor-pointer"
          style={{
            backgroundColor: tw === value ? 'var(--color-bg-panel-hover)' : 'transparent',
            color: tw === value ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
          }}
        >
          {tw}
        </button>
      ))}
    </div>
  )
}
