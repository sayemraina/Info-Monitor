import { useMemo } from 'react'
import type { TimeWindow, EventType } from '../../types'
import { useLandscape } from '../../hooks/useLandscape'
import { useCompare } from '../../hooks/useCompare'
import { ZonePanel } from './ZonePanel'
import { ClaimLandscape } from '../ZoneA/ClaimLandscape'
import { TimeWindowControl } from '../ZoneA/TimeWindowControl'
import { VitalsPanel } from '../ZoneB/VitalsPanel'
import { DivergencePanel } from '../ZoneC/DivergencePanel'
import { SignalsTimeline } from '../ZoneD/SignalsTimeline'

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

  // Use selected slices from App state for compare data
  const sliceA = selectedSlices?.[0] ?? 'x_platform'
  const sliceB = selectedSlices?.[1] ?? 'reddit_platform'
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
        <div className="flex-1 h-full border-r" style={{ borderColor: '#1E293B' }}>
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
    <div
      className="h-full gap-1.5 p-1.5"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr 25%',
        gridTemplateRows: '60% 40%',
      }}
    >
      {/* Zone A: Claim Landscape — top left, spans 3 cols */}
      <ZonePanel
        title={compareMode
          ? `Comparing ${compare?.slice_a.label ?? sliceA} vs ${compare?.slice_b.label ?? sliceB} — ${topicId} [${timeWindow}]`
          : `Claim Landscape — ${topicId} [${timeWindow}]`}
        className="col-span-3 row-span-1"
        noPadding
        headerRight={
          <TimeWindowControl value={timeWindow} onChange={onSetTimeWindow} />
        }
      >
        {landscapeContent}
      </ZonePanel>

      {/* Zone B: Vitals — right sidebar, full height */}
      <ZonePanel
        title={!compareMode && selectedClaimId ? 'Claim Vitals' : 'Topic Overview'}
        className="col-start-4 row-span-2"
        noPadding
      >
        <VitalsPanel
          topicId={topicId}
          selectedClaimId={selectedClaimId}
          landscape={landscape}
          compareMode={compareMode}
        />
      </ZonePanel>

      {/* Zone C: Divergence — bottom left */}
      <ZonePanel
        title="Divergence"
        className="col-span-2 row-start-2"
        noPadding
      >
        <DivergencePanel
          topicId={topicId}
          timeWindow={timeWindow}
          sliceA={sliceA}
          sliceB={sliceB}
          compareMode={compareMode}
          onSetCompareMode={onSetCompareMode}
          onSetSlices={onSetSelectedSlices}
        />
      </ZonePanel>

      {/* Zone D: Signals — bottom right of left area */}
      <ZonePanel
        title={`Signals [${eventTypeFilter}]`}
        className="col-start-3 row-start-2"
        noPadding
      >
        <SignalsTimeline
          topicId={topicId}
          timeWindow={timeWindow}
          eventTypeFilter={eventTypeFilter}
          onSetEventTypeFilter={onSetEventTypeFilter}
          onSelectClaim={onSelectClaim}
        />
      </ZonePanel>
    </div>
  )
}
