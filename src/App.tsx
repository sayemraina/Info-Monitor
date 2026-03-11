import { useState, useCallback } from 'react'
import type { AppState, TimeWindow, EventType } from './types'
import { useTopics } from './hooks/useTopics'
import { Header } from './components/Header'
import { TopicOverview } from './components/Level0/TopicOverview'
import { TopicView } from './components/TopicView/TopicView'

function App() {
  const { topics, refetch: refetchTopics } = useTopics()

  const [state, setState] = useState<AppState>({
    level: 0,
    selectedTopicId: null,
    selectedClaimId: null,
    timeWindow: '24h',
    compareMode: false,
    selectedSlices: ['x_platform', 'reddit_platform'],
    eventTypeFilter: 'all',
    searchQuery: '',
  })

  const selectTopic = useCallback((topicId: string) => {
    setState(s => ({
      ...s,
      level: 1,
      selectedTopicId: topicId,
      selectedClaimId: null,
      compareMode: false,
    }))
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

      <main className="flex-1 overflow-hidden">
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
              selectedClaimId={state.selectedClaimId}
              timeWindow={state.timeWindow}
              compareMode={state.compareMode}
              selectedSlices={state.selectedSlices}
              eventTypeFilter={state.eventTypeFilter}
              onSelectClaim={selectClaim}
              onDeselectClaim={deselectClaim}
              onSetTimeWindow={setTimeWindow}
              onSetCompareMode={setCompareMode}
              onSetSelectedSlices={setSelectedSlices}
              onSetEventTypeFilter={setEventTypeFilter}
            />
          </div>
        ) : null}
      </main>
    </div>
  )
}

export default App
