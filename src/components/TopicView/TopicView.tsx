import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import type { TimeWindow, EventType, EntryHint, TopicSummary } from '../../types'
import { useLandscape } from '../../hooks/useLandscape'
import { useCompare } from '../../hooks/useCompare'
import { useEntryCascade } from '../../hooks/useEntryCascade'
import { ZonePanel } from './ZonePanel'
import { LensBar } from './LensBar'
import { TopicVitalsStrip } from './TopicVitalsStrip'
import { ClaimLandscape } from '../ZoneA/ClaimLandscape'
import { RightSidebar } from './RightSidebar'
import { IFICard } from '../IntelligencePanel/IFICard'
import { IFIRadar } from '../IntelligencePanel/IFIRadar'
import { BlurOverlay } from '../shared/BlurOverlay'
import { DivergenceCard } from '../IntelligencePanel/DivergenceCard'
import { InfoButton } from '../shared/InfoButton'
import { GLOSSARY } from '../../constants/glossary'

interface TopicViewProps {
  topicId: string
  topicSummary?: TopicSummary
  selectedClaimId: string | null
  timeWindow: TimeWindow
  compareMode: boolean
  selectedSlices: [string, string] | null
  eventTypeFilter: EventType | 'all'
  entryHint?: EntryHint
  entryClusterId?: string
  onSelectClaim: (claimId: string) => void
  onDeselectClaim: () => void
  onSetTimeWindow: (tw: TimeWindow) => void
  onSetCompareMode: (mode: boolean) => void
  onSetSelectedSlices: (slices: [string, string] | null) => void
  onSetEventTypeFilter: (filter: EventType | 'all') => void
  onClearEntryHint: () => void
}

export function TopicView({
  topicId,
  topicSummary,
  selectedClaimId,
  timeWindow,
  compareMode,
  selectedSlices,
  eventTypeFilter,
  entryHint,
  entryClusterId,
  onSelectClaim,
  onDeselectClaim,
  onSetTimeWindow,
  onSetCompareMode,
  onSetSelectedSlices,
  onSetEventTypeFilter,
  onClearEntryHint,
}: TopicViewProps) {
  const { landscape, loading, error } = useLandscape(topicId, timeWindow)
  const cascade = useEntryCascade(entryHint, onClearEntryHint)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-select top claim in cluster when entering via map hotspot
  useEffect(() => {
    if (!entryClusterId || !landscape) return
    const clusterClaims = landscape.claims.filter(c => c.cluster_id === entryClusterId)
    console.log('[cascade] entryClusterId:', entryClusterId, 'matched:', clusterClaims.length, 'claims. Available clusters:', [...new Set(landscape.claims.map(c => c.cluster_id))])
    if (clusterClaims.length === 0) return
    // Find highest-momentum claim in the cluster
    const topClaim = clusterClaims.reduce((best, claim) => {
      const pos = landscape.positions.find(p => p.claim_id === claim.id)
      const bestPos = landscape.positions.find(p => p.claim_id === best.id)
      return (pos?.momentum ?? 0) > (bestPos?.momentum ?? 0) ? claim : best
    })
    const timer = setTimeout(() => onSelectClaim(topClaim.id), 2700)
    return () => clearTimeout(timer)
  }, [entryClusterId, landscape]) // eslint-disable-line react-hooks/exhaustive-deps

  // Global click-to-dismiss: after protected period (3s), any click anywhere dismisses all cascades
  useEffect(() => {
    if (cascade.isProtected) return // Don't listen during protected period
    const hasCascade = Object.keys(cascade.state.vitals).length > 0 || Object.keys(cascade.state.zones).length > 0
    if (!hasCascade) return

    const handler = () => cascade.dismissAll()
    const el = containerRef.current
    if (!el) return
    el.addEventListener('click', handler, { once: true })
    return () => el.removeEventListener('click', handler)
  }, [cascade.isProtected, cascade.state, cascade.dismissAll])

  // Allow narrative tag clicks to trigger the same cascade
  const handleTagClick = useCallback((hint: EntryHint) => {
    void hint
  }, [])

  const [showIFIRadar, setShowIFIRadar] = useState(false)

  const radarValues = useMemo(() => {
    if (!landscape) return undefined
    const clusters = landscape.clusters
    const totalMembers = clusters.reduce((s, c) => s + c.member_count, 0)
    return {
      salienceShift: Math.min(1, (landscape.topic_metrics.ifi?.value ?? 0) / 60),
      mutation: totalMembers ? clusters.reduce((s, c) => s + c.mutation_magnitude * c.member_count, 0) / totalMembers : 0,
      arousal: Math.min(1, Math.max(...clusters.map(c => c.arousal_value), 0) * (clusters.some(c => c.arousal_trend === 'warming') ? 1.2 : 1.0)),
      friction: landscape.topic_metrics.top_friction?.friction ?? (landscape.topic_metrics.contestation_level === 'high' ? 0.8 : landscape.topic_metrics.contestation_level === 'medium' ? 0.5 : 0.2),
    }
  }, [landscape])

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
    <div ref={containerRef} className="h-full flex flex-col relative">
      <LensBar activePair={activeLensPair} onSelectPair={handleLensChange} />
      <div
        className="flex-1 min-h-0 gap-2 p-2"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)',
          gridTemplateRows: 'auto 1fr minmax(0, 40%)',
        }}
      >
      {/* Vitals strip — spans left 2 columns only */}
      {topicSummary && (
        <div className="col-span-2 row-start-1">
          <TopicVitalsStrip
            topic={topicSummary}
            landscape={landscape}
            cascadeClasses={cascade.state.vitals}
            onTagClick={handleTagClick}
          />
        </div>
      )}

      {/* Zone A: Claim Landscape */}
      <ZonePanel
        className={`col-span-2 row-start-2 ${cascade.state.zones.landscape ?? ''}`}
        title={compareMode
          ? `Comparing ${compare?.slice_a.label ?? sliceA} vs ${compare?.slice_b.label ?? sliceB}`
          : 'Claim-Cluster Landscape'}
        titleInfo={!compareMode ? <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center' }}><InfoButton term="Claim-Cluster Landscape" content={GLOSSARY.ClaimLandscape} wrapperClassName="relative inline-flex items-center [&>div]:w-3.5 [&>div]:h-3.5 [&>div]:text-[9px]" /></span> : undefined}
        noPadding
      >
        {landscapeContent}
      </ZonePanel>

      {/* Zone B: Right Sidebar — spans all 3 rows */}
      <div className={`col-start-3 row-span-3 min-h-0 relative ${selectedClaimId && cascade.state.zones.claimDetail ? cascade.state.zones.claimDetail : ''}`}>
        <RightSidebar
          topicId={topicId}
          selectedClaimId={selectedClaimId}
          landscape={landscape}
          compareMode={compareMode}
          timeWindow={timeWindow}
          eventTypeFilter={eventTypeFilter}
          cascadeZones={cascade.state.zones}
          onSetEventTypeFilter={onSetEventTypeFilter}
          onSelectClaim={onSelectClaim}
          onDeselectClaim={onDeselectClaim}
          keySignal={topicSummary?.key_signal}
        />
      </div>

      {/* Zone C: Divergence (Bottom Left) */}
      <div className={`col-span-1 row-start-3 min-h-0 rounded-lg p-3 overflow-hidden ${cascade.state.zones.divergence ?? ''}`} style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>
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

      {/* Zone D: IFI (Bottom Middle) */}
      <div className={`col-start-2 row-start-3 min-h-0 rounded-lg p-3 overflow-hidden flex flex-col items-center justify-center ${cascade.state.zones.ifiCard ?? ''}`} style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>
        {landscape?.topic_metrics.ifi ? (
          <div className="w-full h-full">
            <IFICard ifi={landscape.topic_metrics.ifi} onOpenRadar={() => setShowIFIRadar(true)} radarValues={radarValues} />
          </div>
        ) : (
          <p className="text-xs text-slate-500">Loading IFI...</p>
        )}
      </div>
      </div>

      {/* IFI Radar overlay */}
      {showIFIRadar && radarValues && landscape && (
        <BlurOverlay onClose={() => setShowIFIRadar(false)}>
          <IFIRadar
            salienceShift={radarValues.salienceShift}
            mutation={radarValues.mutation}
            arousal={radarValues.arousal}
            friction={radarValues.friction}
            ifiValue={landscape.topic_metrics.ifi?.value ?? 0}
            trend={landscape.topic_metrics.ifi?.trend}
            fluxCharacter={landscape.topic_metrics.ifi?.flux_character}
          />
        </BlurOverlay>
      )}
    </div>
  )
}
