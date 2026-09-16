import { useState, useEffect } from 'react'

interface Interaction {
  interaction_id: string
  timestamp: string
  session_id: string
  user_question: string
  provider: string
  model: string
  intent?: string
  response_text: string
  timing_ms: number
  cache_hit: boolean
  context_bytes: number
}

interface AuditSummary {
  total: number
  provider_split: {
    claude?: number
    gemini?: number
  }
  cache_hit_rate: number
}

export function AuditViewer() {
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [summary, setSummary] = useState<AuditSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedInteraction, setSelectedInteraction] = useState<Interaction | null>(null)

  useEffect(() => {
    // Fetch recent interactions and summary
    Promise.all([
      fetch('/api/ai-guide/audit/recent?limit=50').then((r) => r.json()),
      fetch('/api/ai-guide/audit/summary').then((r) => r.json()),
    ])
      .then(([interactionsData, summaryData]) => {
        setInteractions(interactionsData)
        setSummary(summaryData)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to load audit data:', err)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0E17] flex items-center justify-center">
        <div className="text-gray-400">Loading audit data...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0E17] text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">AI Guide Audit Log</h1>
          <p className="text-gray-400">Interaction history and performance metrics</p>
        </div>

        {/* Summary stats */}
        {summary && (
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <div className="text-sm text-gray-400 mb-1">Total Interactions</div>
              <div className="text-2xl font-bold">{summary.total}</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <div className="text-sm text-gray-400 mb-1">Claude Usage</div>
              <div className="text-2xl font-bold text-purple-400">
                {summary.total > 0
                  ? ((summary.provider_split.claude || 0) * 100).toFixed(0)
                  : 0}
                %
              </div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <div className="text-sm text-gray-400 mb-1">Gemini Usage</div>
              <div className="text-2xl font-bold text-green-400">
                {summary.total > 0
                  ? ((summary.provider_split.gemini || 0) * 100).toFixed(0)
                  : 0}
                %
              </div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <div className="text-sm text-gray-400 mb-1">Cache Hit Rate</div>
              <div className="text-2xl font-bold text-cyan-400">
                {(summary.cache_hit_rate * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        )}

        {/* Interactions table */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Question
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Provider
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Intent
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Latency
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Cache
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {interactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No interactions yet
                  </td>
                </tr>
              ) : (
                interactions.map((interaction) => (
                  <tr
                    key={interaction.interaction_id}
                    onClick={() => setSelectedInteraction(interaction)}
                    className="hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {new Date(interaction.timestamp).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-sm text-white max-w-md truncate">
                      {interaction.user_question}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          interaction.provider === 'claude'
                            ? 'bg-purple-900/50 text-purple-300'
                            : 'bg-green-900/50 text-green-300'
                        }`}
                      >
                        {interaction.provider}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {interaction.intent || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-400">
                      {interaction.timing_ms.toFixed(0)}ms
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {interaction.cache_hit ? (
                        <span className="text-cyan-400">✓</span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Detail modal */}
        {selectedInteraction && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-8"
            onClick={() => setSelectedInteraction(null)}
          >
            <div
              className="bg-gray-900 rounded-lg border border-gray-800 max-w-3xl w-full max-h-[80vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">Interaction Detail</h2>
                  <button
                    onClick={() => setSelectedInteraction(null)}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-gray-500 uppercase mb-1">Question</div>
                    <div className="text-white">{selectedInteraction.user_question}</div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 uppercase mb-1">Response</div>
                    <div className="text-gray-300 whitespace-pre-wrap bg-gray-800 p-3 rounded">
                      {selectedInteraction.response_text}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 uppercase mb-1">Provider</div>
                      <div className="text-white">{selectedInteraction.provider}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase mb-1">Model</div>
                      <div className="text-white">{selectedInteraction.model}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase mb-1">Intent</div>
                      <div className="text-white">{selectedInteraction.intent || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase mb-1">Latency</div>
                      <div className="text-white font-mono">
                        {selectedInteraction.timing_ms.toFixed(0)}ms
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase mb-1">Context Size</div>
                      <div className="text-white font-mono">
                        {(selectedInteraction.context_bytes / 1024).toFixed(1)}KB
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase mb-1">Cache Hit</div>
                      <div className="text-white">
                        {selectedInteraction.cache_hit ? 'Yes' : 'No'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
