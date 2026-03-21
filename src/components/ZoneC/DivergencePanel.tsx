import type { LandscapeData, TimeWindow } from '../../types'
import { useCompare } from '../../hooks/useCompare'
import { Sparkline } from '../shared/Sparkline'
import { DivergenceHeatmap } from './DivergenceHeatmap'
import { InfoButton } from '../shared/InfoButton'
import { GLOSSARY } from '../../constants/glossary'

interface DivergencePanelProps {
  topicId: string
  timeWindow: TimeWindow
  sliceA: string
  sliceB: string
  landscape?: LandscapeData | null
  compareMode?: boolean
  onSetCompareMode?: (mode: boolean) => void
}

export function DivergencePanel({ topicId, timeWindow, sliceA, sliceB, landscape, compareMode, onSetCompareMode }: DivergencePanelProps) {
  const { compare, loading, error } = useCompare(topicId, sliceA, sliceB, timeWindow, landscape)

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

  const { divergence, per_cluster, arousal_comparison, exposure_comparison } = compare
  const typo = divergence.typology

  return (
    <div className="p-3 h-full overflow-y-auto space-y-3">
      {/* Headline JSD */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Overall Divergence (JSD)</span>
            <InfoButton term="Divergence" content={GLOSSARY.Divergence} />
          </div>
          <div className="flex items-center gap-3">
            <span className="font-data text-sm" style={{ color: 'var(--color-text-primary)' }}>
              {divergence.jsd.toFixed(3)}
            </span>
            <Sparkline data={divergence.trend} width={70} height={18} />
          </div>
        </div>
        <div className="text-[10px] text-slate-500 italic mb-2">
          (0 = identical narratives, 1 = completely disjointed information realities)
        </div>
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
        <TypologyBar label="Info Asymmetry" value={typo.information_asymmetry} dominant={typo.dominant_mode === 'information_asymmetry'} />
        <TypologyBar label="Interpretive" value={typo.interpretive} dominant={typo.dominant_mode === 'interpretive'} />
        <TypologyBar label="Paradigmatic" value={typo.paradigmatic} dominant={typo.dominant_mode === 'paradigmatic'} />
        {typo.paradigmatic_caveat && (
          <p className="text-[9px] italic" style={{ color: '#F59E0B' }}>
            Extraction confidence differs across slices — paradigmatic score may be inflated
          </p>
        )}
      </div>

      {/* Emotional Temperature insight — headline metric, shown before heatmap detail */}
      {(() => {
        const a = arousal_comparison.slice_a_avg;
        const b = arousal_comparison.slice_b_avg;
        const diff = Math.abs(a - b);
        const higherSlice = a > b ? compare.slice_a.label : compare.slice_b.label;
        const lowerSlice = a > b ? compare.slice_b.label : compare.slice_a.label;
        const higherVal = Math.max(a, b).toFixed(2);
        const lowerVal = Math.min(a, b).toFixed(2);
        const intensity = diff > 0.3 ? 'dramatically more charged' : diff > 0.15 ? 'significantly more charged' : 'slightly more charged';
        return (
          <div
            className="rounded-lg p-2.5"
            style={{ backgroundColor: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)' }}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#EF4444' }}>Emotional Temperature</span>
              <InfoButton term="Arousal" content={GLOSSARY.Arousal} />
            </div>
            <p className="text-[12px] leading-snug" style={{ color: '#CBD5E1' }}>
              <span className="font-semibold" style={{ color: '#F1F5F9' }}>{higherSlice}</span> is{' '}
              <span className="font-semibold" style={{ color: '#EF4444' }}>{intensity}</span>{' '}
              ({higherVal}) compared to {lowerSlice} ({lowerVal})
            </p>
          </div>
        );
      })()}

      {/* Exposure Distribution — how visibility is distributed across slices */}
      {exposure_comparison && (
        <div
          className="rounded-lg p-2.5"
          style={{ backgroundColor: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.12)' }}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#06B6D4' }}>
              Exposure Distribution
            </span>
            <InfoButton term="Exposure" content={GLOSSARY.ExposureAsymmetry} />
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <div>
              <span style={{ color: '#3B82F6' }}>{compare.slice_a.label}</span>
              <span className="font-data ml-1.5" style={{ color: '#F1F5F9' }}>
                {exposure_comparison.slice_a.value.toFixed(2)}
              </span>
            </div>
            <div>
              <span style={{ color: '#EF4444' }}>{compare.slice_b.label}</span>
              <span className="font-data ml-1.5" style={{ color: '#F1F5F9' }}>
                {exposure_comparison.slice_b.value.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="flex justify-between mt-1.5">
            <Sparkline data={exposure_comparison.slice_a.sparkline} width={90} height={16} color="#3B82F6" />
            <Sparkline data={exposure_comparison.slice_b.sparkline} width={90} height={16} color="#EF4444" />
          </div>
        </div>
      )}

      {/* Per-cluster heatmap — detail breakdown */}
      <DivergenceHeatmap clusters={per_cluster} />

      {/* Full Compare toggle */}
      {onSetCompareMode && (
        <button
          onClick={() => onSetCompareMode(!compareMode)}
          className="w-full text-center text-[10px] py-1.5 mt-2 rounded cursor-pointer"
          style={{
            color: compareMode ? '#F1F5F9' : '#06B6D4',
            border: `1px solid ${compareMode ? 'rgba(239,68,68,0.3)' : 'rgba(6,182,212,0.2)'}`,
            background: compareMode ? 'rgba(239,68,68,0.1)' : 'rgba(6,182,212,0.05)',
            transition: 'all 150ms ease',
          }}
        >
          {compareMode ? '← Exit Compare' : 'Full Compare →'}
        </button>
      )}

    </div>
  )
}

function TypologyBar({ label, value, dominant }: { label: string; value: number; dominant: boolean }) {
  const glossaryContent = label === 'Info Asymmetry' ? GLOSSARY.InformationAsymmetry
    : label === 'Interpretive' ? GLOSSARY.InterpretiveDivergence
    : GLOSSARY.ParadigmaticDivergence

  return (
    <div>
      <div className="flex items-center justify-between text-[10px] mb-0.5">
        <span className="flex items-center gap-1" style={{ color: dominant ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
          {label} {dominant && '*'}
          <InfoButton term={label} content={glossaryContent} />
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
