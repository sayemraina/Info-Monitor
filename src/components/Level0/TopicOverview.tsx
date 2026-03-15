import { useMemo } from 'react'
import type { TopicSummary } from '../../types'
import { useTopicSync } from '../../hooks/useTopicSync'
import { TopicCard } from './TopicCard'
import { NarrativeMap } from './NarrativeMap'
import { YouTubeStrip } from './YouTubeStrip'
import { DiscourseFeed } from './DiscourseFeed'
import { SignalTicker } from './SignalTicker'
import { SystemBar } from './SystemBar'
import { InfoButton } from '../shared/InfoButton'

const TOPIC_LANDSCAPE_METHODOLOGY = {
  plain: 'Topics ranked by narrative flux — the rate and intensity of claim evolution across platforms.',
  technical: 'Composite ranking = IFI score (40%) × contestation level ordinal (30%) × 7-day activity trend slope (20%) × claim diversity index (10%). Topics with insufficient data are greyed out, not removed.',
  methodology: 'Pipeline: ingest (X + Reddit + YouTube) → claim extraction (Claude Sonnet) → embedding (OpenAI) → HDBSCAN clustering → per-topic IFI + contestation + activity metrics → rank + display.',
  caveat: 'Topic selection reflects pre-indexed narratives only. Emerging topics not yet in the index will not appear. Activity sparklines are 7-day windows; longer trends may differ.',
}

interface TopicOverviewProps {
  topics: TopicSummary[]
  searchQuery: string
  totalCount: number
  onSelectTopic: (id: string) => void
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

  const handleNavigateToLevel1 = (topicId: string) => {
    onSelectTopic(topicId)
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
          onSelectTopic={handleNavigateToLevel1}
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
          onNavigateToLevel1={handleNavigateToLevel1}
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
              onNavigate={() => handleNavigateToLevel1(topic.id)}
            />
          ))}

        </div>
      </div>

      {/* Row 5: Live Discourse Feed — ~100px */}
      <div
        className="flex-shrink-0"
        onMouseEnter={syncActions.pauseRotation}
        onMouseLeave={syncActions.resumeRotation}
      >
        <DiscourseFeed
          activeTopic={syncState.activeTopic}
          onNavigateToLevel1={handleNavigateToLevel1}
        />
      </div>

      {/* Row 6: Signal Ticker — 26px */}
      <SignalTicker activeTopic={syncState.activeTopic} />
    </div>
  )
}
