import type { EventType } from '../../types'

interface FilterChipsProps {
  active: EventType | 'all'
  onChange: (filter: EventType | 'all') => void
}

const FILTERS: Array<{ label: string; value: EventType | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Momentum', value: 'momentum_spike' },
  { label: 'Divergence', value: 'divergence_shift' },
  { label: 'Coordination', value: 'coordination_flag' },
  { label: 'Silence', value: 'claim_dark' },
  { label: 'Arousal', value: 'arousal_escalation' },
  { label: 'Contestation', value: 'contestation_emergence' as EventType },
  { label: 'Mutation', value: 'phase_transition' as EventType },
  { label: 'Lead-Lag', value: 'lead_lag' as EventType },
]

export function FilterChips({ active, onChange }: FilterChipsProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {FILTERS.map(f => (
        <button
          key={f.value}
          onClick={() => onChange(f.value)}
          className="px-1.5 py-0.5 rounded text-[9px] transition-colors cursor-pointer"
          style={{
            backgroundColor: active === f.value ? 'var(--color-bg-panel-hover)' : 'transparent',
            color: active === f.value ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
            border: `1px solid ${active === f.value ? 'var(--color-border)' : 'transparent'}`,
          }}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}
