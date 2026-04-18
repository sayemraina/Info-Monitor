import { useState, useCallback, useEffect } from 'react'
import type { AppState, TimeWindow, EventType, EntryHint } from './types'
import { useTopics } from './hooks/useTopics'
import { Header } from './components/Header'
import { TopicOverview } from './components/Level0/TopicOverview'
import { TopicView } from './components/TopicView/TopicView'
import { InfoButtonProvider } from './components/shared/InfoButtonContext'
import { DebugOverlay } from './components/DebugOverlay'
import { mark, isDebug } from './utils/perf'

function App() {
  const { topics, refetch: refetchTopics } = useTopics()

  useEffect(() => {
    if (topics.length > 0) mark('topics_loaded', { count: topics.length })
  }, [topics.length])

  const [state, setState] = useState<AppState>({
    level: 0,
    selectedTopicId: null,
    selectedClaimId: null,
    timeWindow: '24h',
    compareMode: false,
    selectedSlices: null,
    eventTypeFilter: 'all',
    searchQuery: '',
  })

  const selectTopic = useCallback((topicId: string, hint?: EntryHint, clusterId?: string) => {
    setState(s => ({
      ...s,
      level: 1,
      selectedTopicId: topicId,
      selectedClaimId: null,
      compareMode: false,
      entryHint: hint,
      entryClusterId: clusterId,
    }))
  }, [])

  const clearEntryHint = useCallback(() => {
    setState(s => ({ ...s, entryHint: undefined, entryClusterId: undefined }))
  }, [])

  const selectClaim = useCallback((claimId: string) => {
    setState(s => ({ ...s, level: 2, selectedClaimId: claimId }))
  }, [])

  const deselectClaim = useCallback(() => {
    setState(s => ({ ...s, level: 1, selectedClaimId: null }))
  }, [])

  const goToOverview = useCallback(() => {
    setState(s => ({
      ...s,
      level: 0,
      selectedTopicId: null,
      selectedClaimId: null,
      compareMode: false,
      entryHint: undefined,
    }))
  }, [])

  const setTimeWindow = useCallback((tw: TimeWindow) => {
    setState(s => ({ ...s, timeWindow: tw }))
  }, [])

  const setCompareMode = useCallback((mode: boolean) => {
    setState(s => ({
      ...s,
      compareMode: mode,
      // Entering compare mode is topic-level — deselect any active claim
      selectedClaimId: mode ? null : s.selectedClaimId,
    }))
  }, [])

  const setSelectedSlices = useCallback((slices: [string, string] | null) => {
    setState(s => ({ ...s, selectedSlices: slices }))
  }, [])

  const setEventTypeFilter = useCallback((filter: EventType | 'all') => {
    setState(s => ({ ...s, eventTypeFilter: filter }))
  }, [])

  const setSearchQuery = useCallback((query: string) => {
    setState(s => ({ ...s, searchQuery: query }))
  }, [])

  // Filter topics by search query
  const filteredTopics = state.searchQuery
    ? topics.filter(t => t.name.toLowerCase().includes(state.searchQuery.toLowerCase()))
    : topics

  return (
    <InfoButtonProvider>
    <div className="h-screen w-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <Header
        topics={topics}
        selectedTopicId={state.selectedTopicId}
        searchQuery={state.searchQuery}
        onSearch={setSearchQuery}
        onSelectTopic={selectTopic}
        onGoToOverview={goToOverview}
        onTopicAdded={selectTopic}
        refetchTopics={refetchTopics}
      />

      <main className="flex-1" style={{ overflow: state.level === 0 ? 'auto' : 'hidden' }}>
        {state.level === 0 ? (
          <div key="level-0" className="h-full animate-fade-in">
            <TopicOverview
              topics={filteredTopics}
              searchQuery={state.searchQuery}
              totalCount={topics.length}
              onSelectTopic={selectTopic}
            />
          </div>
        ) : state.selectedTopicId ? (
          <div key={`level-1-${state.selectedTopicId}`} className="h-full animate-fade-in">
            <TopicView
              topicId={state.selectedTopicId}
              topicSummary={topics.find(t => t.id === state.selectedTopicId)}
              selectedClaimId={state.selectedClaimId}
              timeWindow={state.timeWindow}
              compareMode={state.compareMode}
              selectedSlices={state.selectedSlices}
              eventTypeFilter={state.eventTypeFilter}
              entryHint={state.entryHint}
              entryClusterId={state.entryClusterId}
              onSelectClaim={selectClaim}
              onDeselectClaim={deselectClaim}
              onSetTimeWindow={setTimeWindow}
              onSetCompareMode={setCompareMode}
              onSetSelectedSlices={setSelectedSlices}
              onSetEventTypeFilter={setEventTypeFilter}
              onClearEntryHint={clearEntryHint}
            />
          </div>
        ) : null}
      </main>
      {isDebug() && <DebugOverlay />}
    </div>
    </InfoButtonProvider>
  )
}

export default App
