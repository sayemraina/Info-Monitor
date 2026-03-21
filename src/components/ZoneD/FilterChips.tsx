import type { EventType } from '../../types'
import { HoverTip } from '../shared/HoverTip'

interface FilterChipsProps {
  active: EventType | 'all'
  onChange: (filter: EventType | 'all') => void
}

const FILTERS: Array<{ label: string; value: EventType | 'all'; tip: string }> = [
  { label: 'All', value: 'all', tip: 'Show all signal types' },
  { label: 'Momentum', value: 'momentum_spike', tip: 'Claim velocity spike — a claim jumped percentile rank in a single window' },
  { label: 'Divergence', value: 'divergence_shift', tip: 'Cross-platform divergence shift — populations are framing the same topic differently' },
  { label: 'Coordination', value: 'coordination_flag', tip: 'Coordination signature — burstiness, near-duplicates, or cross-platform sync exceeds organic baseline' },
  { label: 'Silence', value: 'claim_dark', tip: 'Claim gone dark — active claim dropped to zero production while topic volume is stable' },
  { label: 'Arousal', value: 'arousal_escalation', tip: 'Arousal escalation — emotional temperature trending from stable/cool to warming' },
  { label: 'Contestation', value: 'contestation_emergence' as EventType, tip: 'Contestation emergence — topic shifted from low to high contestation within 48-72h' },
  { label: 'Mutation', value: 'phase_transition' as EventType, tip: 'Phase transition — mutation trajectory reversed (radicalizing ↔ mainstreaming)' },
  { label: 'Lead-Lag', value: 'lead_lag' as EventType, tip: 'Lead-lag pattern — same claim detected across platforms with consistent temporal offset' },
]

export function FilterChips({ active, onChange }: FilterChipsProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {FILTERS.map(f => (
        <HoverTip key={f.value} text={f.tip}>
          <button
            onClick={() => onChange(f.value)}
            className="px-1.5 py-0.5 rounded text-[9px] transition-colors"
            style={{
              backgroundColor: active === f.value ? 'rgba(6,182,212,0.12)' : 'rgba(148,163,184,0.06)',
              color: active === f.value ? '#22D3EE' : '#94A3B8',
              border: `1px solid ${active === f.value ? 'rgba(6,182,212,0.3)' : 'rgba(148,163,184,0.12)'}`,
              cursor: 'help',
            }}
          >
            {f.label}
          </button>
        </HoverTip>
      ))}
    </div>
  )
}
