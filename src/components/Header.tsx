import type { TopicSummary } from '../types'
import { AddTopicButton } from './shared/AddTopicButton'

interface HeaderProps {
  topics: TopicSummary[]
  selectedTopicId: string | null
  searchQuery: string
  onSearch: (query: string) => void
  onSelectTopic: (id: string) => void
  onGoToOverview: () => void
  onTopicAdded: (topicId: string) => void
  refetchTopics: () => void
}

export function Header({
  topics,
  selectedTopicId,
  searchQuery,
  onSearch,
  onSelectTopic,
  onGoToOverview,
  onTopicAdded,
  refetchTopics,
}: HeaderProps) {
  return (
    <header
      className="h-10 shrink-0 flex items-center gap-4 px-4 border-b"
      style={{ backgroundColor: 'var(--color-bg-panel)', borderColor: 'var(--color-border)' }}
    >
      {/* Search bar */}
      <div className="relative w-64">
        <svg
          className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
          style={{ color: 'var(--color-text-muted)' }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search topics..."
          value={searchQuery}
          onChange={e => onSearch(e.target.value)}
          className="w-full h-7 pl-7 pr-2 rounded text-xs border outline-none focus:border-cyan-500"
          style={{
            backgroundColor: 'var(--color-bg-primary)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        />
      </div>

      {/* Topic tabs (shown in Level 1+) */}
      {selectedTopicId && (
        <nav className="flex items-center gap-1 overflow-x-auto">
          <button
            onClick={onGoToOverview}
            className="px-3 py-1 rounded text-xs whitespace-nowrap transition-colors cursor-pointer"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--color-bg-panel-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            Overview
          </button>
          {topics.map(topic => (
            <button
              key={topic.id}
              onClick={() => onSelectTopic(topic.id)}
              className="px-3 py-1 rounded text-xs whitespace-nowrap transition-colors cursor-pointer"
              style={{
                backgroundColor: topic.id === selectedTopicId ? 'var(--color-bg-panel-hover)' : 'transparent',
                color: topic.id === selectedTopicId ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              }}
              onMouseEnter={e => {
                if (topic.id !== selectedTopicId) e.currentTarget.style.backgroundColor = 'var(--color-bg-panel-hover)'
              }}
              onMouseLeave={e => {
                if (topic.id !== selectedTopicId) e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              {topic.name}
            </button>
          ))}
        </nav>
      )}

      {/* System title */}
      {!selectedTopicId && (
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
          Narrative Monitoring System
        </span>
      )}

      {/* Add Topic button — right side, only visible in server mode */}
      <div className="ml-auto">
        <AddTopicButton onTopicAdded={onTopicAdded} refetchTopics={refetchTopics} />
      </div>
    </header>
  )
}
