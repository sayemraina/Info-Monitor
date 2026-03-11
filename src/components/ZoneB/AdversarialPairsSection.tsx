import type { AdversarialPair } from '../../types'
import { getCorrelationColor } from '../../utils/colors'
import * as Tooltips from '../../utils/tooltips'
import { useTooltip } from '../../hooks/useTooltip'
import { MethodologyTooltip } from './MethodologyTooltip'

interface AdversarialPairsSectionProps {
  pairs: AdversarialPair[]
  thisClusterId: string
}

export function AdversarialPairsSection({ pairs, thisClusterId }: AdversarialPairsSectionProps) {
  const headerTooltip = useTooltip<HTMLHeadingElement>()

  // Derive the opposing cluster label for each pair
  const getOpposingLabel = (pair: AdversarialPair): string => {
    return pair.cluster_id_a === thisClusterId
      ? pair.label_b.length > 55 ? pair.label_b.slice(0, 55) + '…' : pair.label_b
      : pair.label_a.length > 55 ? pair.label_a.slice(0, 55) + '…' : pair.label_a
  }

  return (
    <div>
      <h4
        ref={headerTooltip.ref}
        className="text-[10px] font-medium uppercase tracking-wide mb-1"
        style={{
          color: 'var(--color-text-muted)',
          cursor: 'help',
          textDecoration: 'underline dotted',
          textUnderlineOffset: '3px',
        }}
        {...headerTooltip.handlers}
      >
        Counter-Narrative Dynamics
      </h4>
      {headerTooltip.rect && pairs.length > 0 && (
        <MethodologyTooltip
          content={Tooltips.adversarialPair(
            pairs[0].momentum_correlation,
            pairs[0].response_lag.median_hours,
            pairs[0].response_lag.consistency,
            pairs[0].mutation_evidence.detected,
          )}
          rect={headerTooltip.rect}
        />
      )}

      {pairs.length === 0 ? (
        <p className="text-[10px]" style={{ color: 'var(--color-text-muted)', opacity: 0.3 }}>
          No adversarial cluster pairs detected
        </p>
      ) : (
        <div className="space-y-2">
          {pairs.map((pair, i) => {
            const lowConf = pair.confidence < 0.5
            const corrColor = getCorrelationColor(pair.momentum_correlation)
            const opposingLabel = getOpposingLabel(pair)

            return (
              <div
                key={i}
                className="rounded px-2 py-1.5"
                style={{
                  backgroundColor: 'rgba(239,68,68,0.04)',
                  border: '1px solid rgba(239,68,68,0.12)',
                  opacity: lowConf ? 0.4 : 1,
                }}
              >
                {/* Opposing cluster label */}
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>vs</span>
                  <span className="text-[10px] truncate" style={{ color: 'var(--color-text-secondary)' }}>
                    {opposingLabel}
                  </span>
                </div>

                {/* Momentum correlation */}
                <div className="flex items-center justify-between text-[10px]">
                  <span style={{ color: 'var(--color-text-muted)' }}>Momentum Corr.</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-data" style={{ color: corrColor }}>
                      {pair.momentum_correlation.toFixed(3)}
                    </span>
                    <span
                      className="text-[9px] px-1 rounded"
                      style={{
                        backgroundColor: `${corrColor}15`,
                        color: corrColor,
                      }}
                    >
                      {pair.momentum_correlation < -0.6 ? 'strong' : pair.momentum_correlation < -0.3 ? 'moderate' : 'weak'}
                    </span>
                  </div>
                </div>

                {/* Response lag */}
                <div className="flex items-center justify-between text-[10px] mt-0.5">
                  <span style={{ color: 'var(--color-text-muted)' }}>Response Lag</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-data" style={{ color: 'var(--color-text-primary)' }}>
                      {pair.response_lag.median_hours}h
                    </span>
                    <span
                      className="text-[9px] px-1 rounded"
                      style={{
                        backgroundColor: pair.response_lag.consistency === 'high'
                          ? 'rgba(239,68,68,0.12)' : 'rgba(100,116,139,0.12)',
                        color: pair.response_lag.consistency === 'high'
                          ? '#EF4444' : 'var(--color-text-muted)',
                      }}
                    >
                      {pair.response_lag.consistency}
                    </span>
                  </div>
                </div>

                {/* Interpretation */}
                <p className="text-[9px] italic mt-1" style={{ color: '#F59E0B' }}>
                  {pair.response_lag.interpretation}
                </p>

                {/* Mutation evidence */}
                {pair.mutation_evidence.detected ? (
                  <div className="mt-1.5 flex items-center justify-between text-[10px]">
                    <span className="truncate" style={{ color: 'var(--color-text-secondary)' }}>
                      {pair.mutation_evidence.description.length > 70
                        ? pair.mutation_evidence.description.slice(0, 70) + '…'
                        : pair.mutation_evidence.description}
                    </span>
                    <span className="font-data shrink-0 ml-1" style={{ color: 'var(--color-text-muted)' }}>
                      conf {pair.mutation_evidence.confidence.toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <p className="text-[9px] mt-1" style={{ color: 'var(--color-text-muted)', opacity: 0.3 }}>
                    No framing shift detected
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
