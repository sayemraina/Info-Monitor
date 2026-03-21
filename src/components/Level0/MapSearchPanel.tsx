import { useState } from 'react'
import type { TopicSummary } from '../../types'

interface MapSearchPanelProps {
  topics: TopicSummary[]
  activeTopic: string
  searchQuery: string
  onLockTopic: (topicId: string) => void
  onNavigateToLevel1: (topicId: string) => void
}

export function MapSearchPanel({ topics, activeTopic, searchQuery, onLockTopic, onNavigateToLevel1 }: MapSearchPanelProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery)

  const filtered = localSearch
    ? topics.filter(t => t.name.toLowerCase().includes(localSearch.toLowerCase()))
    : topics

  // Preserve original order from topics.json
  const sorted = filtered

  return (
    <div
      className="absolute top-4 left-4 z-20 rounded-lg"
      style={{
        width: '210px',
        background: 'rgba(15,25,35,0.88)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(148,163,184,0.1)',
        padding: '10px',
      }}
    >
      {/* Search input */}
      <input
        type="text"
        placeholder="Search topics..."
        value={localSearch}
        onChange={e => setLocalSearch(e.target.value)}
        className="w-full rounded"
        style={{
          background: 'rgba(148,163,184,0.08)',
          border: '1px solid rgba(148,163,184,0.12)',
          color: '#F1F5F9',
          fontSize: '11px',
          padding: '5px 8px',
          outline: 'none',
          marginBottom: '8px',
        }}
      />

      {/* Topic list */}
      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {sorted.map(topic => {
          const isActive = topic.id === activeTopic
          const activityColor = (topic.ifi?.value ?? 0) > 20 ? '#EF4444'
            : (topic.ifi?.value ?? 0) > 10 ? '#F59E0B'
            : '#22C55E'

          return (
            <div
              key={topic.id}
              className="flex items-center gap-2 cursor-pointer rounded"
              style={{
                padding: '4px 6px',
                backgroundColor: isActive ? 'rgba(233,69,96,0.1)' : 'transparent',
                marginBottom: '1px',
              }}
              onClick={() => onLockTopic(topic.id)}
              onDoubleClick={() => onNavigateToLevel1(topic.id)}
            >
              {/* Activity dot */}
              <div
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  backgroundColor: activityColor,
                  flexShrink: 0,
                }}
              />

              {/* Topic name */}
              <span
                className="truncate"
                style={{
                  fontSize: '10px',
                  color: isActive ? '#E94560' : 'rgba(241,245,249,0.7)',
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {topic.name}
              </span>

              {/* Navigate arrow */}
              <button
                onClick={(e) => { e.stopPropagation(); onNavigateToLevel1(topic.id) }}
                className="cursor-pointer ml-auto flex-shrink-0"
                style={{
                  color: 'rgba(148,163,184,0.3)',
                  fontSize: '9px',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                }}
              >
                →
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
