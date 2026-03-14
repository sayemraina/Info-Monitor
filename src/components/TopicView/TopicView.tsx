import { useState, useMemo } from 'react'
import type { TimeWindow, EventType } from '../../types'
import { useLandscape } from '../../hooks/useLandscape'
import { useCompare } from '../../hooks/useCompare'
import { ZonePanel } from './ZonePanel'
import { LensBar } from './LensBar'
import { ClaimLandscape } from '../ZoneA/ClaimLandscape'
import { TimeWindowControl } from '../ZoneA/TimeWindowControl'
import { RightSidebar } from './RightSidebar'
import { IFICard } from '../IntelligencePanel/IFICard'
import { DivergenceCard } from '../IntelligencePanel/DivergenceCard'

interface TopicViewProps {
  topicId: string
  selectedClaimId: string | null
  timeWindow: TimeWindow
  compareMode: boolean
  selectedSlices: [string, string] | null
  eventTypeFilter: EventType | 'all'
  onSelectClaim: (claimId: string) => void
  onDeselectClaim: () => void
  onSetTimeWindow: (tw: TimeWindow) => void
  onSetCompareMode: (mode: boolean) => void
  onSetSelectedSlices: (slices: [string, string] | null) => void
  onSetEventTypeFilter: (filter: EventType | 'all') => void
}

export function TopicView({
  topicId,
  selectedClaimId,
  timeWindow,
  compareMode,
  selectedSlices,
  eventTypeFilter,
  onSelectClaim,
  onDeselectClaim,
  onSetTimeWindow,
  onSetCompareMode,
  onSetSelectedSlices,
  onSetEventTypeFilter,
}: TopicViewProps) {
  const { landscape, loading, error } = useLandscape(topicId, timeWindow)

  const [activeLensPair, setActiveLensPair] = useState({
    label: 'X vs Reddit', a: 'x_platform', b: 'reddit_platform',
  })

  const handleLensChange = (pair: { label: string; a: string; b: string }) => {
    setActiveLensPair(pair)
    onSetSelectedSlices([pair.a, pair.b])
  }

  // Use selected slices from App state, falling back to active lens pair
  const sliceA = selectedSlices?.[0] ?? activeLensPair.a
  const sliceB = selectedSlices?.[1] ?? activeLensPair.b
  const { compare } = useCompare(topicId, sliceA, sliceB, timeWindow)

  // Build salience maps keyed by cluster_id for compare mode
  const salienceMapA = useMemo(() => {
    if (!compare) return undefined
    const m = new Map<string, number>()
    for (const c of compare.per_cluster) m.set(c.cluster_id, c.salience_a)
    return m
  }, [compare])

  const salienceMapB = useMemo(() => {
    if (!compare) return undefined
    const m = new Map<string, number>()
    for (const c of compare.per_cluster) m.set(c.cluster_id, c.salience_b)
    return m
  }, [compare])

  const landscapeContent = loading ? (
    <div className="h-full flex items-center justify-center">
      <p className="font-data text-sm" style={{ color: 'var(--color-text-muted)' }}>
        Loading landscape...
      </p>
    </div>
  ) : error ? (
    <div className="h-full flex items-center justify-center">
      <p className="font-data text-sm" style={{ color: '#EF4444' }}>
        Failed to load landscape data
      </p>
    </div>
  ) : landscape ? (
    compareMode ? (
      // Split landscape: left = Slice A, right = Slice B
      <div className="w-full h-full flex gap-px">
        <div className="flex-1 h-full border-r" style={{ borderColor: '#152540' }}>
          <ClaimLandscape
            landscape={landscape}
            selectedClaimId={null}
            onSelectClaim={onSelectClaim}
            onDeselectClaim={onDeselectClaim}
            compareSalience={salienceMapA}
            compareLabel={compare?.slice_a.label ?? sliceA}
          />
        </div>
        <div className="flex-1 h-full">
          <ClaimLandscape
            landscape={landscape}
            selectedClaimId={null}
            onSelectClaim={onSelectClaim}
            onDeselectClaim={onDeselectClaim}
            compareSalience={salienceMapB}
            compareLabel={compare?.slice_b.label ?? sliceB}
          />
        </div>
      </div>
    ) : (
      <ClaimLandscape
        landscape={landscape}
        selectedClaimId={selectedClaimId}
        onSelectClaim={onSelectClaim}
        onDeselectClaim={onDeselectClaim}
      />
    )
  ) : null

  return (
    <div className="h-full flex flex-col relative">
      <LensBar activePair={activeLensPair} onSelectPair={handleLensChange} />
      <div
        className="flex-1 min-h-0 gap-2 p-2"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)',
          gridTemplateRows: '60% 40%',
        }}
      >
      {/* Zone A: Claim Landscape (Top Left, 75% width, 60% height) */}
      <ZonePanel
        title={compareMode
          ? `Comparing ${compare?.slice_a.label ?? sliceA} vs ${compare?.slice_b.label ?? sliceB} — ${topicId} [${timeWindow}]`
          : `Claim Landscape — ${topicId} [${timeWindow}]`}
        className="col-span-2 row-span-1"
        noPadding
        headerRight={
          <TimeWindowControl value={timeWindow} onChange={onSetTimeWindow} />
        }
      >
        {landscapeContent}
      </ZonePanel>

      {/* Zone B: Right Sidebar (Right, 25% width, 100% height) */}
      <div className="col-start-3 row-span-2 min-h-0 relative">
        <RightSidebar
          topicId={topicId}
          selectedClaimId={selectedClaimId}
          landscape={landscape}
          compareMode={compareMode}
          timeWindow={timeWindow}
          eventTypeFilter={eventTypeFilter}
          onSetEventTypeFilter={onSetEventTypeFilter}
          onSelectClaim={onSelectClaim}
          onDeselectClaim={onDeselectClaim}
        />
      </div>

      {/* Zone C: Divergence (Bottom Left, 50% width, 40% height) */}
      <div className="col-span-1 row-start-2 min-h-0 rounded-lg p-3 overflow-hidden" style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>
        <DivergenceCard
          topicId={topicId}
          timeWindow={timeWindow}
          sliceA={sliceA}
          sliceB={sliceB}
          compareMode={compareMode}
          onSetCompareMode={onSetCompareMode}
          landscape={landscape}
        />
      </div>

      {/* Zone D: IFI (Bottom Middle, 25% width, 40% height) */}
      <div className="col-start-2 row-start-2 min-h-0 rounded-lg p-3 overflow-hidden flex flex-col items-center justify-center" style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>
        {landscape?.topic_metrics.ifi ? (
          <div className="w-full h-full">
            <IFICard ifi={landscape.topic_metrics.ifi} />
          </div>
        ) : (
          <p className="text-xs text-slate-500">Loading IFI...</p>
        )}
      </div>
      </div>
    </div>
  )
}
