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
  onExpand?: () => void
}

/** Semantic label for JSD value — makes the number meaningful */
function jsdSemanticLabel(jsd: number): { label: string; color: string } {
  if (jsd < 0.1) return { label: 'Low divergence — broad agreement', color: '#22C55E' }
  if (jsd < 0.3) return { label: 'Moderate divergence — some blind spots', color: '#F59E0B' }
  if (jsd < 0.6) return { label: 'High divergence — significant information gaps', color: '#EF4444' }
  return { label: 'Extreme divergence — separate information realities', color: '#DC2626' }
}

/** Plain-english insight for the dominant typology mode */
function typologyInsight(mode: string): string {
  const m = mode.toLowerCase().replace(/\s+/g, '_')
  if (m.includes('asymmetry') || m.includes('information')) return "They're seeing different facts"
  if (m.includes('interpretive')) return 'Same facts, different priorities'
  if (m.includes('paradigmatic')) return 'Incompatible frameworks — zero shared ground'
  return ''
}

/** Plain-english description for dominant mode (for contextual notes) */
function dominantModeDescription(mode: string): string {
  const m = mode.toLowerCase().replace(/\s+/g, '_')
  if (m.includes('asymmetry') || m.includes('information')) return 'information gaps (different facts reaching each group)'
  if (m.includes('interpretive')) return 'interpretive differences (same facts, different priorities)'
  if (m.includes('paradigmatic')) return 'paradigmatic divides (incompatible frameworks)'
  return 'divergence'
}

/** Severity label + color for typology bar values */
function typologySeverity(value: number): { label: string; color: string } {
  if (value >= 0.6) return { label: 'high', color: '#EF4444' }
  if (value >= 0.3) return { label: 'moderate', color: '#F59E0B' }
  if (value >= 0.1) return { label: 'low', color: '#94A3B8' }
  return { label: 'negligible', color: 'rgba(148,163,184,0.4)' }
}

/** Strip redundant "Platform" suffix from slice labels */
function cleanSliceLabel(label: string): string {
  return label.replace(/ Platform$/i, '')
}

/** Check if dominant mode matches a given typology key */
function isDominant(dominantMode: string, key: 'asymmetry' | 'interpretive' | 'paradigmatic'): boolean {
  const m = dominantMode.toLowerCase()
  if (key === 'asymmetry') return m.includes('asymmetry') || m.includes('information')
  return m.includes(key)
}

export function DivergencePanel({ topicId, timeWindow, sliceA, sliceB, landscape, compareMode, onSetCompareMode, onExpand }: DivergencePanelProps) {
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
  const semantic = jsdSemanticLabel(divergence.jsd)
  const labelA = cleanSliceLabel(compare.slice_a.label)
  const labelB = cleanSliceLabel(compare.slice_b.label)

  // Check for JSD vs typology contradiction
  const maxTypology = Math.max(typo.information_asymmetry, typo.interpretive, typo.paradigmatic)
  const showContradictionNote = divergence.jsd < 0.15 && maxTypology > 0.5

  return (
    <div className="p-3 h-full overflow-y-auto space-y-3">

      {/* ═══ ACT 1: ORIENTATION — "What are we comparing?" ═══ */}

      {/* Slice pair — prominent, first thing */}
      <div className="flex items-center gap-2 text-[10px]">
        <span className="px-1.5 py-0.5 rounded font-semibold" style={{ backgroundColor: 'rgba(59,130,246,0.15)', color: '#3B82F6' }}>
          {labelA}
        </span>
        <span style={{ color: '#64748B' }}>vs</span>
        <span className="px-1.5 py-0.5 rounded font-semibold" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
          {labelB}
        </span>
      </div>

      {/* JSD headline with semantic label */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Overall Divergence (JSD)</span>
            <InfoButton term="JSD" content={{ what: "Jensen-Shannon Divergence — a statistical measure of how different two probability distributions are.", soWhat: "Here it compares the claim distributions of each population slice. 0 = identical narratives, 1 = completely separate information realities.", how: "√JSD between normalized claim-frequency vectors for each slice." }} />
          </div>
          <div className="flex items-center gap-3">
            <span className="font-data text-sm" style={{ color: 'var(--color-text-primary)' }}>
              {divergence.jsd.toFixed(3)}
            </span>
            <Sparkline data={divergence.trend} width={70} height={18} />
          </div>
        </div>
        <div className="text-[10px] font-mono" style={{ color: semantic.color }}>
          {semantic.label}
        </div>
      </div>

      {/* ═══ ACT 2: DIAGNOSIS — "What kind of disagreement?" ═══ */}

      {/* Separator */}
      <div className="border-t" style={{ borderColor: 'rgba(148,163,184,0.1)' }} />

      {/* Typology bars with severity labels + plain-english insight */}
      <div className="space-y-1.5">
        <TypologyBar label="Info Asymmetry" value={typo.information_asymmetry} dominant={isDominant(typo.dominant_mode, 'asymmetry')} />
        <TypologyBar label="Interpretive" value={typo.interpretive} dominant={isDominant(typo.dominant_mode, 'interpretive')} />
        <TypologyBar label="Paradigmatic" value={typo.paradigmatic} dominant={isDominant(typo.dominant_mode, 'paradigmatic')} />
        {typo.paradigmatic_caveat && (
          <p className="text-[9px] italic" style={{ color: '#F59E0B' }}>
            Extraction confidence differs across slices — paradigmatic score may be inflated
          </p>
        )}
        {/* Plain-english insight for dominant mode */}
        <p className="text-[10px] font-mono mt-1" style={{ color: '#F59E0B' }}>
          {typologyInsight(typo.dominant_mode)}
        </p>
        {/* Contextual note when JSD is low but typology is high */}
        {showContradictionNote && (
          <p className="text-[9px] italic mt-0.5" style={{ color: '#94A3B8' }}>
            Overall narrative alignment is high — but where differences exist, they're driven by {dominantModeDescription(typo.dominant_mode)}
          </p>
        )}
      </div>

      {/* Emotional Temperature */}
      {(() => {
        const a = arousal_comparison.slice_a_avg;
        const b = arousal_comparison.slice_b_avg;
        const diff = Math.abs(a - b);

        // Below threshold — no meaningful difference
        if (diff < 0.08) {
          return (
            <div
              className="rounded-lg p-2"
              style={{ backgroundColor: 'rgba(148,163,184,0.05)', border: '1px solid rgba(148,163,184,0.1)' }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Emotional Temperature</span>
                <InfoButton term="Arousal" content={GLOSSARY.Arousal} />
              </div>
              <p className="text-[11px] leading-snug" style={{ color: '#64748B' }}>
                Similar emotional charge across both populations
              </p>
            </div>
          );
        }

        const higherSlice = a > b ? labelA : labelB;
        const lowerSlice = a > b ? labelB : labelA;
        const higherVal = Math.max(a, b).toFixed(2);
        const lowerVal = Math.min(a, b).toFixed(2);
        const intensity = diff >= 0.3 ? 'dramatically more charged' : diff >= 0.15 ? 'significantly more charged' : 'slightly more charged';
        return (
          <div
            className="rounded-lg p-2"
            style={{ backgroundColor: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)' }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#EF4444' }}>Emotional Temperature</span>
              <InfoButton term="Arousal" content={GLOSSARY.Arousal} />
            </div>
            <p className="text-[11px] leading-snug" style={{ color: '#CBD5E1' }}>
              <span className="font-semibold" style={{ color: '#F1F5F9' }}>{higherSlice}</span> is{' '}
              <span className="font-semibold" style={{ color: '#EF4444' }}>{intensity}</span>{' '}
              ({higherVal}) compared to {lowerSlice} ({lowerVal})
            </p>
          </div>
        );
      })()}

      {/* Exposure Comparison */}
      {exposure_comparison && (() => {
        const valA = exposure_comparison.slice_a?.value
        const valB = exposure_comparison.slice_b?.value
        if (valA == null || valB == null) return null

        const diff = Math.abs(valA - valB)
        if (diff < 0.05) {
          return (
            <div
              className="rounded-lg p-2"
              style={{ backgroundColor: 'rgba(148,163,184,0.05)', border: '1px solid rgba(148,163,184,0.1)' }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Estimated Exposure</span>
                <InfoButton term="Exposure" content={{ what: "Estimated reach of claims within each population slice.", soWhat: "Similar exposure means both groups are encountering these narratives at comparable rates.", how: "Weighted combination of production volume, amplification signals, and platform-specific reach estimates." }} />
              </div>
              <p className="text-[11px] leading-snug" style={{ color: '#64748B' }}>
                Similar estimated exposure across both populations
              </p>
            </div>
          )
        }

        const higherSlice = valA > valB ? labelA : labelB
        const lowerSlice = valA > valB ? labelB : labelA
        const higherVal = Math.max(valA, valB).toFixed(2)
        const lowerVal = Math.min(valA, valB).toFixed(2)
        const ratio = Math.max(valA, valB) / Math.max(Math.min(valA, valB), 0.01)
        const intensity = ratio >= 3 ? 'dramatically higher' : ratio >= 1.5 ? 'significantly higher' : 'moderately higher'

        return (
          <div
            className="rounded-lg p-2"
            style={{ backgroundColor: 'rgba(6,182,212,0.07)', border: '1px solid rgba(6,182,212,0.15)' }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#06B6D4' }}>Estimated Exposure</span>
              <InfoButton term="Exposure" content={{ what: "Estimated reach of claims within each population slice.", soWhat: "Unequal exposure suggests one group encounters these narratives far more frequently — a potential information asymmetry driver.", how: "Weighted combination of production volume, amplification signals, and platform-specific reach estimates." }} />
            </div>
            <p className="text-[11px] leading-snug" style={{ color: '#CBD5E1' }}>
              <span className="font-semibold" style={{ color: '#F1F5F9' }}>{higherSlice}</span> has{' '}
              <span className="font-semibold" style={{ color: '#06B6D4' }}>{intensity}</span>{' '}
              exposure ({higherVal}) compared to {lowerSlice} ({lowerVal})
            </p>
          </div>
        )
      })()}

      {/* ═══ ACT 3: DETAIL + ACTION — "Where exactly?" ═══ */}

      {/* Separator */}
      <div className="border-t" style={{ borderColor: 'rgba(148,163,184,0.1)' }} />

      {/* Per-cluster salience heatmap with real labels */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#94A3B8' }}>
              Per-Cluster Salience
            </span>
            <InfoButton term="Salience" content={GLOSSARY.Salience} />
          </div>
          {onExpand && (
            <button
              onClick={onExpand}
              className="text-[9px] font-mono tracking-wide cursor-pointer"
              style={{ color: '#06B6D4', background: 'none', border: 'none', padding: 0 }}
            >
              View Full Details →
            </button>
          )}
        </div>
        <DivergenceHeatmap
          clusters={per_cluster}
          sliceALabel={labelA}
          sliceBLabel={labelB}
        />
      </div>

      {/* Full Compare CTA with guidance text */}
      {onSetCompareMode && (
        <div className="mt-2">
          {!compareMode && (
            <p className="text-[9px] italic mb-1.5" style={{ color: '#64748B' }}>
              See how each population maps the narrative landscape side by side
            </p>
          )}
          <button
            onClick={() => onSetCompareMode(!compareMode)}
            className="w-full text-center text-[10px] py-1.5 rounded cursor-pointer"
            style={{
              color: compareMode ? '#F1F5F9' : '#06B6D4',
              border: `1px solid ${compareMode ? 'rgba(239,68,68,0.3)' : 'rgba(6,182,212,0.2)'}`,
              background: compareMode ? 'rgba(239,68,68,0.1)' : 'rgba(6,182,212,0.05)',
              transition: 'all 150ms ease',
            }}
          >
            {compareMode ? '← Exit Compare' : 'Full Compare →'}
          </button>
        </div>
      )}
    </div>
  )
}

function TypologyBar({ label, value, dominant }: { label: string; value: number; dominant: boolean }) {
  const glossaryContent = label === 'Info Asymmetry' ? GLOSSARY.InformationAsymmetry
    : label === 'Interpretive' ? GLOSSARY.InterpretiveDivergence
    : GLOSSARY.ParadigmaticDivergence

  const severity = typologySeverity(value)

  return (
    <div>
      <div className="flex items-center justify-between text-[10px] mb-0.5">
        <span className="flex items-center gap-1" style={{ color: dominant ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
          {label} {dominant && '*'}
          <InfoButton term={label} content={glossaryContent} />
        </span>
        <span className="flex items-center gap-1.5">
          <span className="font-data" style={{ color: 'var(--color-text-primary)' }}>
            {value.toFixed(2)}
          </span>
          <span className="text-[8px] font-mono" style={{ color: severity.color }}>
            {severity.label}
          </span>
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
