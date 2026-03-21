import { useMemo } from 'react'
import type { TopicSummary, EntryHint } from '../../types'
import { useTopicSync } from '../../hooks/useTopicSync'
import { TopicCard } from './TopicCard'
import { NarrativeMap } from './NarrativeMap'
import { YouTubeStrip } from './YouTubeStrip'
import { DiscourseFeed } from './DiscourseFeed'
import { SignalTicker } from './SignalTicker'
import { SystemBar } from './SystemBar'
import { InfoButton } from '../shared/InfoButton'

const TOPIC_LANDSCAPE_METHODOLOGY = {
  what: 'Topics ranked by narrative flux — rate and intensity of claim evolution across platforms.',
  soWhat: 'Higher rank → more structural change in how this topic is being discussed.',
  how: 'IFI (40%) × contestation (30%) × 7d trend (20%) × claim diversity (10%). Pre-indexed topics only.',
}

interface TopicOverviewProps {
  topics: TopicSummary[]
  searchQuery: string
  totalCount: number
  onSelectTopic: (id: string, hint?: EntryHint, clusterId?: string) => void
}

export function TopicOverview({ topics, searchQuery, totalCount, onSelectTopic }: TopicOverviewProps) {
  const [syncState, syncActions] = useTopicSync(topics)

  // Show per-topic confidence when a topic is active, otherwise global average
  const activeTopicConfidence = useMemo(() => {
    if (syncState.activeTopic) {
      const active = topics.find(t => t.id === syncState.activeTopic)
      if (active?.system_confidence != null) return active.system_confidence
    }
    const withConf = topics.filter(t => t.system_confidence != null)
    if (withConf.length === 0) return undefined
    return withConf.reduce((sum, t) => sum + t.system_confidence!, 0) / withConf.length
  }, [topics, syncState.activeTopic])

  // Filter topics by search query for the card grid
  const filteredTopics = useMemo(() => {
    if (!searchQuery) return topics
    return topics.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [topics, searchQuery])

  const handleCardClick = (topicId: string) => {
    if (syncState.activeTopic === topicId && syncState.isLocked) {
      // Already active + locked → navigate to Level 1
      onSelectTopic(topicId)
    } else {
      // Lock this topic
      syncActions.lockTopic(topicId)
    }
  }

  const activeTopicName = topics.find(t => t.id === syncState.activeTopic)?.name ?? syncState.activeTopic

  const handleNavigateToLevel1 = (topicId: string, hint?: EntryHint, clusterId?: string) => {
    onSelectTopic(topicId, hint, clusterId)
  }

  return (
    <div className="flex flex-col" style={{ minHeight: '100%' }}>
      {/* Row 1: System Bar — 22px */}
      <SystemBar systemConfidence={activeTopicConfidence} />

      {/* Row 2: Geographic Narrative Map — ~50% viewport */}
      <div
        className="relative flex-shrink-0"
        style={{ height: '50vh' }}
        onMouseEnter={syncActions.pauseRotation}
        onMouseLeave={syncActions.resumeRotation}
      >
        <NarrativeMap
          activeTopic={syncState.activeTopic}
          topics={topics}
          onSelectTopic={(topicId, hint, clusterId) => handleNavigateToLevel1(topicId, hint ?? 'map_cta', clusterId)}
          onLockTopic={syncActions.lockTopic}
          searchQuery={searchQuery}
        />
      </div>

      {/* Row 3: YouTube Strip — ~120px */}
      <div
        className="flex-shrink-0"
        onMouseEnter={syncActions.pauseRotation}
        onMouseLeave={syncActions.resumeRotation}
      >
        <YouTubeStrip
          activeTopic={syncState.activeTopic}
          topicName={activeTopicName}
          onNavigateToLevel1={(topicId) => handleNavigateToLevel1(topicId, 'youtube_cta')}
        />
      </div>

      {/* Row 4: Topic Cards — section header + scrollable card grid */}
      <div
        className="flex-shrink-0"
        style={{ marginTop: '6px' }}
        onMouseEnter={syncActions.pauseRotation}
        onMouseLeave={syncActions.resumeRotation}
      >
        {/* Section header — matches NARRATIVE SHAPERS pattern */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: '5px 24px',
            background: 'rgba(12,18,28,0.6)',
            borderTop: '1px solid rgba(148,163,184,0.08)',
          }}
        >
          <div className="flex items-center gap-2">
            <span style={{ color: '#06B6D4', fontSize: '9px' }}>◈</span>
            <span style={{ color: '#94A3B8', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Topic Landscape
            </span>
            <InfoButton content={TOPIC_LANDSCAPE_METHODOLOGY} term="Topic Landscape" />
          </div>
          <div className="flex items-center gap-3">
            <span
              style={{
                fontSize: '9px',
                color: 'rgba(148,163,184,0.5)',
                background: 'rgba(148,163,184,0.06)',
                border: '1px solid rgba(148,163,184,0.1)',
                borderRadius: '3px',
                padding: '1px 6px',
              }}
            >
              {totalCount} topics
            </span>
            {syncState.isLocked && (
              <button
                onClick={syncActions.unlockTopic}
                className="cursor-pointer"
                style={{
                  fontSize: '9px',
                  color: 'rgba(148,163,184,0.5)',
                  background: 'rgba(148,163,184,0.06)',
                  border: '1px solid rgba(148,163,184,0.1)',
                  borderRadius: '3px',
                  padding: '1px 6px',
                }}
              >
                ⟳ Auto
              </button>
            )}
          </div>
        </div>

        {/* Card grid */}
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            maxWidth: '100%',
            padding: '12px 24px 16px',
          }}
        >
          {filteredTopics.map((topic) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              isActive={syncState.activeTopic === topic.id}
              isLocked={syncState.isLocked && syncState.activeTopic === topic.id}
              onClick={() => handleCardClick(topic.id)}
              onNavigate={(hint) => handleNavigateToLevel1(topic.id, hint)}
            />
          ))}
        </div>

        {/* Empty state when search returns no matches */}
        {filteredTopics.length === 0 && searchQuery && (
          <div style={{ textAlign: 'center', padding: '40px 24px', color: 'rgba(148,163,184,0.4)', fontSize: '12px' }}>
            No topics match &ldquo;{searchQuery}&rdquo;
          </div>
        )}
      </div>

      {/* Row 5: Live Discourse Feed — ~100px */}
      <div
        className="flex-shrink-0"
        onMouseEnter={syncActions.pauseRotation}
        onMouseLeave={syncActions.resumeRotation}
      >
        <DiscourseFeed
          activeTopic={syncState.activeTopic}
          onNavigateToLevel1={(topicId) => handleNavigateToLevel1(topicId, 'discourse')}
        />
      </div>

      {/* Row 6: Signal Ticker — 26px */}
      <SignalTicker activeTopic={syncState.activeTopic} />
    </div>
  )
}
