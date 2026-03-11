import { useState } from 'react'
import type { CompareData, TimeWindow, TooltipContent } from '../../types'
import { useCompare } from '../../hooks/useCompare'
import { useTooltip } from '../../hooks/useTooltip'
import * as Tooltips from '../../utils/tooltips'
import { Sparkline } from '../shared/Sparkline'
import { MethodologyTooltip } from '../ZoneB/MethodologyTooltip'
import { DivergenceHeatmap } from './DivergenceHeatmap'

const SLICE_PAIRS: Array<{ label: string; a: string; b: string }> = [
  { label: 'X vs Reddit', a: 'x_platform', b: 'reddit_platform' },
  { label: 'X vs YouTube', a: 'x_platform', b: 'youtube_influencer' },
]

interface DivergencePanelProps {
  topicId: string
  timeWindow: TimeWindow
  sliceA: string
  sliceB: string
  compareMode?: boolean
  onSetCompareMode?: (mode: boolean) => void
  onSetSlices?: (slices: [string, string]) => void
}

export function DivergencePanel({ topicId, timeWindow, compareMode, onSetCompareMode, onSetSlices }: DivergencePanelProps) {
  const [pairIdx, setPairIdx] = useState(0)
  const activePair = SLICE_PAIRS[pairIdx]
  const { compare, loading, error } = useCompare(topicId, activePair.a, activePair.b, timeWindow)
  const jsdTooltip = useTooltip<HTMLDivElement>()

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Loading divergence...</p>
      </div>
    )
  }

  if (error || !compare) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Divergence data not available
        </p>
      </div>
    )
  }

  const { divergence, per_cluster, arousal_comparison } = compare
  const typo = divergence.typology

  return (
    <div className="p-3 h-full overflow-y-auto space-y-3">
      {/* Slice selector */}
      <div className="flex items-center gap-1">
        {SLICE_PAIRS.map((pair, i) => (
          <button
            key={pair.label}
            onClick={() => {
              setPairIdx(i)
              onSetSlices?.([pair.a, pair.b])
            }}
            className="text-[10px] px-2 py-0.5 rounded transition-colors"
            style={{
              backgroundColor: i === pairIdx ? 'rgba(6,182,212,0.15)' : 'transparent',
              color: i === pairIdx ? '#06B6D4' : 'var(--color-text-muted)',
              border: `1px solid ${i === pairIdx ? 'rgba(6,182,212,0.3)' : 'var(--color-border)'}`,
              cursor: 'pointer',
            }}
          >
            {pair.label}
          </button>
        ))}
      </div>

      {/* Headline JSD */}
      <div
        ref={jsdTooltip.ref}
        className="flex items-center justify-between"
        style={{ cursor: 'help' }}
        {...jsdTooltip.handlers}
      >
        {jsdTooltip.rect && (
          <MethodologyTooltip
            content={{
              title: 'Jensen-Shannon Divergence',
              calculation: 'Symmetric measure of distributional difference between two populations. 0 = identical, 1 = maximally different.',
              reading: `JSD of ${divergence.jsd.toFixed(3)} — ${divergence.jsd > 0.5 ? 'high' : divergence.jsd > 0.25 ? 'moderate' : 'low'} divergence between these populations.`,
              caveat: 'JSD is sensitive to small-sample clusters. Scores above 0.7 with fewer than 50 claims per slice warrant caution.',
            }}
            rect={jsdTooltip.rect}
          />
        )}
        <div>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)', textDecoration: 'underline dotted', textUnderlineOffset: '3px' }}>JSD: </span>
          <span className="font-data text-sm" style={{ color: 'var(--color-text-primary)' }}>
            {divergence.jsd.toFixed(3)}
          </span>
        </div>
        <Sparkline data={divergence.trend} width={70} height={18} />
      </div>

      {/* Slices */}
      <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
        <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(59,130,246,0.15)', color: '#3B82F6' }}>
          {compare.slice_a.label}
        </span>
        <span>vs</span>
        <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
          {compare.slice_b.label}
        </span>
      </div>

      {/* Typology scores */}
      <div className="space-y-1.5">
        <TypologyBar label="Info Asymmetry" value={typo.information_asymmetry} dominant={typo.dominant_mode === 'information_asymmetry'} tooltip={Tooltips.divergenceTypology(typo)} />
        <TypologyBar label="Interpretive" value={typo.interpretive} dominant={typo.dominant_mode === 'interpretive'} tooltip={Tooltips.divergenceTypology(typo)} />
        <TypologyBar label="Paradigmatic" value={typo.paradigmatic} dominant={typo.dominant_mode === 'paradigmatic'} tooltip={Tooltips.divergenceTypology(typo)} />
        {typo.paradigmatic_caveat && (
          <p className="text-[9px] italic" style={{ color: '#F59E0B' }}>
            Extraction confidence differs across slices — paradigmatic score may be inflated
          </p>
        )}
      </div>

      {/* Heatmap */}
      <DivergenceHeatmap clusters={per_cluster} />

      {/* Arousal comparison */}
      <div className="flex items-center justify-between text-[10px]">
        <span style={{ color: 'var(--color-text-muted)' }}>Arousal</span>
        <div className="flex items-center gap-3">
          <span className="font-data" style={{ color: '#3B82F6' }}>
            A: {arousal_comparison.slice_a_avg.toFixed(2)}
          </span>
          <span className="font-data" style={{ color: '#EF4444' }}>
            B: {arousal_comparison.slice_b_avg.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Full Compare toggle */}
      {onSetCompareMode && (
        <button
          onClick={() => onSetCompareMode(!compareMode)}
          className="w-full text-[10px] py-1 rounded transition-colors"
          style={{
            backgroundColor: compareMode ? 'rgba(6,182,212,0.15)' : 'transparent',
            color: compareMode ? '#06B6D4' : 'var(--color-text-muted)',
            border: `1px solid ${compareMode ? 'rgba(6,182,212,0.3)' : 'var(--color-border)'}`,
            cursor: 'pointer',
          }}
        >
          {compareMode ? '← Exit Compare Mode' : 'Full Compare Mode →'}
        </button>
      )}
    </div>
  )
}

function TypologyBar({ label, value, dominant, tooltip }: { label: string; value: number; dominant: boolean; tooltip?: TooltipContent }) {
  const { ref, rect, handlers } = useTooltip<HTMLDivElement>()
  return (
    <div ref={ref} style={{ cursor: tooltip ? 'help' : 'default' }} {...handlers}>
      {rect && tooltip && <MethodologyTooltip content={tooltip} rect={rect} />}
      <div className="flex items-center justify-between text-[10px] mb-0.5">
        <span style={{
          color: dominant ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
          textDecoration: tooltip ? 'underline dotted' : 'none',
          textUnderlineOffset: '3px',
        }}>
          {label} {dominant && '*'}
        </span>
        <span className="font-data" style={{ color: 'var(--color-text-primary)' }}>
          {value.toFixed(2)}
        </span>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(value * 100, 100)}%`,
            backgroundColor: dominant ? '#F59E0B' : '#64748B',
          }}
        />
      </div>
    </div>
  )
}
