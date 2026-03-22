import { useState } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import type { TopicSummary } from '../../types'

interface MapSearchPanelProps {
  topics: TopicSummary[]
  activeTopic: string
  searchQuery: string
  onLockTopic: (topicId: string) => void
  onNavigateToLevel1: (topicId: string) => void
}

export function MapSearchPanel({ topics, activeTopic, searchQuery, onLockTopic, onNavigateToLevel1 }: MapSearchPanelProps) {
  const isMobile = useIsMobile()
  const [localSearch, setLocalSearch] = useState(searchQuery)
  const [mobileOpen, setMobileOpen] = useState(false)

  const filtered = localSearch
    ? topics.filter(t => t.name.toLowerCase().includes(localSearch.toLowerCase()))
    : topics

  // Preserve original order from topics.json
  const sorted = filtered

  const panelContent = (
    <>
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
              onClick={() => { onLockTopic(topic.id); if (isMobile) setMobileOpen(false) }}
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
    </>
  )

  if (isMobile) {
    return (
      <>
        {/* Floating search icon */}
        {!mobileOpen && (
          <button
            onClick={() => setMobileOpen(true)}
            className="absolute top-3 left-3 z-20 cursor-pointer"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'rgba(15,25,35,0.88)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(148,163,184,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(148,163,184,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        )}

        {/* Full-width overlay panel */}
        {mobileOpen && (
          <div
            className="absolute top-0 left-0 right-0 z-20 rounded-b-lg"
            style={{
              background: 'rgba(15,25,35,0.95)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(148,163,184,0.1)',
              padding: '10px',
            }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: '6px' }}>
              <span style={{ fontSize: '9px', color: 'rgba(148,163,184,0.5)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Topics</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="cursor-pointer"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(148,163,184,0.5)',
                  fontSize: '14px',
                  padding: '0 4px',
                }}
              >
                ×
              </button>
            </div>
            {panelContent}
          </div>
        )}
      </>
    )
  }

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
      {panelContent}
    </div>
  )
}
