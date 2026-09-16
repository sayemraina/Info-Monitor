import type { Cluster } from '../../types'

interface IsolatedClusterProps {
  cluster: Cluster
  topicName?: string
}

export function IsolatedCluster({ cluster, topicName }: IsolatedClusterProps) {
  // Mutation color
  const mutationColor =
    cluster.mutation_direction === 'mainstreaming'
      ? 'text-green-400'
      : cluster.mutation_direction === 'radicalizing'
        ? 'text-red-400'
        : cluster.mutation_direction === 'fragmenting'
          ? 'text-amber-400'
          : 'text-gray-400'

  // Arousal color
  const arousalColor =
    cluster.arousal_trend === 'warming'
      ? 'text-orange-400'
      : cluster.arousal_trend === 'cooling'
        ? 'text-blue-400'
        : 'text-gray-400'

  return (
    <div className="w-[500px] bg-gray-900 rounded-xl border border-gray-800 p-8 shadow-2xl animate-fade-in">
      {topicName && (
        <div className="text-xs text-gray-500 mb-4 uppercase tracking-wider">
          {topicName}
        </div>
      )}

      <h2 className="text-2xl font-semibold text-white mb-6">{cluster.label}</h2>

      <div className="space-y-4">
        {/* Member count */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Claims in cluster</span>
          <span className="text-lg font-mono text-white">{cluster.member_count}</span>
        </div>

        {/* Concept */}
        {cluster.concept_label && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Parent concept</span>
            <span className="text-sm text-cyan-400">{cluster.concept_label}</span>
          </div>
        )}

        {/* Mutation */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Mutation</span>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${mutationColor}`}>
              {cluster.mutation_direction}
            </span>
            <span className="text-xs text-gray-500 font-mono">
              {(cluster.mutation_magnitude * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Arousal */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Arousal</span>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${arousalColor}`}>
              {cluster.arousal_trend}
            </span>
            <span className="text-xs text-gray-500 font-mono">
              {(cluster.arousal_value * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Adversarial pairs */}
        {cluster.adversarial_pairs && cluster.adversarial_pairs.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-800">
            <span className="text-xs text-gray-500 uppercase tracking-wider">
              Adversarial pairs detected
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {cluster.adversarial_pairs.map((pairId) => (
                <span
                  key={pairId}
                  className="px-2 py-1 text-xs bg-red-900/30 text-red-400 rounded border border-red-800/50"
                >
                  {pairId}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
