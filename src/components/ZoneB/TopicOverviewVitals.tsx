import type { LandscapeData } from '../../types'
import { getContestationColor, getMutationColor, getSourceDiversityColor } from '../../utils/colors'
import * as Tooltips from '../../utils/tooltips'
import { MetricRow } from './MetricRow'

interface TopicOverviewVitalsProps {
  landscape: LandscapeData
}

export function TopicOverviewVitals({ landscape }: TopicOverviewVitalsProps) {
  const m = landscape.topic_metrics

  return (
    <div className="p-3 space-y-1">
      <MetricRow
        label="Clusters"
        value={m.cluster_count}
      />
      <MetricRow
        label="Contestation"
        value={m.contestation_level}
        color={getContestationColor(m.contestation_level)}
      />
      <MetricRow
        label="Top Accel."
        value={m.top_accelerating.momentum.value}
        sparkline={m.top_accelerating.momentum.sparkline}
        tooltip={Tooltips.momentum(
          m.top_accelerating.momentum.value,
          Math.round(50 + m.top_accelerating.momentum.value * 30 - 15),
          Math.round(50 + m.top_accelerating.momentum.value * 30),
          24,
          Math.round(m.top_accelerating.momentum.source_diversity * 80 + 10),
          m.top_accelerating.momentum.bridge_ratio,
        )}
      >
        <span
          className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: getSourceDiversityColor(m.top_accelerating.momentum.source_diversity) }}
        />
      </MetricRow>
      <MetricRow
        label="Most Persistent"
        value={`${m.most_persistent.persistence_windows} windows`}
        tooltip={Tooltips.persistence(m.most_persistent.persistence_windows)}
      />
      <MetricRow
        label="Top Friction"
        value={m.top_friction.friction}
        tooltip={Tooltips.friction(m.top_friction.friction, m.top_accelerating.momentum.friction_quadrant)}
      />
      <MetricRow
        label="Highest Arousal"
        value={m.highest_arousal.arousal_trend}
        color={m.highest_arousal.arousal_trend === 'warming' ? '#EF4444'
          : m.highest_arousal.arousal_trend === 'cooling' ? '#3B82F6' : '#94A3B8'}
        tooltip={Tooltips.arousal(m.highest_arousal.arousal_trend, 0.6, 0.5)}
      />
      {m.notable_mutation && (
        <MetricRow
          label="Mutation"
          value={m.notable_mutation.direction}
          color={getMutationColor(m.notable_mutation.direction)}
        />
      )}
    </div>
  )
}
