import type { TopicSummary } from '../../types'
import { TopicCard } from './TopicCard'

interface TopicOverviewProps {
  topics: TopicSummary[]
  searchQuery: string
  totalCount: number
  onSelectTopic: (id: string) => void
}

export function TopicOverview({ topics, searchQuery, totalCount, onSelectTopic }: TopicOverviewProps) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-base font-semibold mb-1" style={{ color: '#F1F5F9' }}>
            Active Narrative Topics
          </h1>
          <p className="text-xs" style={{ color: '#64748B' }}>
            {totalCount} pre-indexed topics · ranked by divergence acceleration · click to inspect
          </p>
        </div>

        {topics.length === 0 ? (
          <div className="rounded-lg p-8 text-center" style={{ backgroundColor: '#141B2D', border: '1px solid #2D3748' }}>
            <p className="text-sm mb-1" style={{ color: '#94A3B8' }}>
              {searchQuery ? `No data available for "${searchQuery}"` : 'Loading topics...'}
            </p>
            {searchQuery && (
              <p className="text-xs mt-1" style={{ color: '#64748B' }}>
                The system currently tracks {totalCount} pre-indexed topics — select one above or try a different search.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {topics.map(topic => (
              <TopicCard key={topic.id} topic={topic} onSelect={onSelectTopic} />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
