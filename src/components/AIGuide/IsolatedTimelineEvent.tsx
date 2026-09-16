import type { NarrativeEvent } from '../../types'

interface IsolatedTimelineEventProps {
  event: NarrativeEvent
  topicName?: string
}

// Event type labels
const EVENT_LABELS: Record<string, string> = {
  momentum_spike: 'Momentum Spike',
  divergence_shift: 'Divergence Shift',
  coordination_flag: 'Coordination Flag',
  contestation_emergence: 'Contestation Emergence',
  claim_dark: 'Claim Dark',
  arousal_escalation: 'Arousal Escalation',
  phase_transition: 'Phase Transition',
  lead_lag: 'Lead-Lag Pattern',
  vocabulary_rotation: 'Vocabulary Rotation',
}

// Event type colors
const EVENT_COLORS: Record<string, string> = {
  momentum_spike: 'text-amber-400 border-amber-700',
  divergence_shift: 'text-purple-400 border-purple-700',
  coordination_flag: 'text-red-400 border-red-700',
  contestation_emergence: 'text-orange-400 border-orange-700',
  claim_dark: 'text-gray-400 border-gray-700',
  arousal_escalation: 'text-rose-400 border-rose-700',
  phase_transition: 'text-cyan-400 border-cyan-700',
  lead_lag: 'text-blue-400 border-blue-700',
  vocabulary_rotation: 'text-green-400 border-green-700',
}

export function IsolatedTimelineEvent({ event, topicName }: IsolatedTimelineEventProps) {
  const colorClass = EVENT_COLORS[event.type] || 'text-gray-400 border-gray-700'
  const label = EVENT_LABELS[event.type] || event.type

  // Severity badge color
  const severityColor =
    event.severity === 'high'
      ? 'bg-red-900/50 text-red-300 border-red-700'
      : event.severity === 'medium'
        ? 'bg-amber-900/50 text-amber-300 border-amber-700'
        : 'bg-gray-800 text-gray-400 border-gray-700'

  // Format timestamp
  const timestamp = new Date(event.timestamp)
  const timeStr = timestamp.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="w-[500px] bg-gray-900 rounded-xl border border-gray-800 p-8 shadow-2xl animate-fade-in">
      {topicName && (
        <div className="text-xs text-gray-500 mb-4 uppercase tracking-wider">
          {topicName}
        </div>
      )}

      {/* Event type badge */}
      <div className={`inline-block px-3 py-1 mb-4 text-xs font-medium rounded-full border ${colorClass}`}>
        {label}
      </div>

      {/* Summary */}
      <h2 className="text-xl font-medium text-white mb-6 leading-relaxed">
        {event.summary}
      </h2>

      <div className="space-y-4">
        {/* Timestamp */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Detected</span>
          <span className="text-sm font-mono text-gray-300">{timeStr}</span>
        </div>

        {/* Severity */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Severity</span>
          <span className={`px-2 py-1 text-xs font-medium rounded border ${severityColor}`}>
            {event.severity.toUpperCase()}
          </span>
        </div>

        {/* Confidence */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Confidence</span>
          <span className="text-sm font-mono text-white">
            {(event.confidence * 100).toFixed(0)}%
          </span>
        </div>

        {/* Claim ID (if present) */}
        {event.claim_id && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Related claim</span>
            <span className="text-xs font-mono text-cyan-400">{event.claim_id}</span>
          </div>
        )}

        {/* Slice ID (if present) */}
        {event.slice_id && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Slice</span>
            <span className="text-xs font-mono text-purple-400">{event.slice_id}</span>
          </div>
        )}

        {/* Detail payload */}
        {event.detail && Object.keys(event.detail).length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-800">
            <span className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
              Details
            </span>
            <div className="space-y-2">
              {Object.entries(event.detail).map(([key, value]) => (
                <div key={key} className="flex items-start justify-between text-xs">
                  <span className="text-gray-500">{key}</span>
                  <span className="text-gray-300 font-mono text-right max-w-[60%]">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
