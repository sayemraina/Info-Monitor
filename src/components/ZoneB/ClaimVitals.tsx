import type { ClaimDetail, LandscapeData } from '../../types'
import { AdversarialPairsSection } from './AdversarialPairsSection'
import { getMomentumColor, getSourceDiversityColor, getSeverityColor } from '../../utils/colors'
import * as Tooltips from '../../utils/tooltips'
import { useTooltip } from '../../hooks/useTooltip'
import { MetricRow } from './MetricRow'
import { MethodologyTooltip } from './MethodologyTooltip'
import { Sparkline } from '../shared/Sparkline'

interface ClaimVitalsProps {
  detail: ClaimDetail
  landscape?: LandscapeData | null
}

const QUADRANT_LABELS: Record<string, string> = {
  unopposed_advance: 'Unopposed Advance',
  contested_advance: 'Contested Advance',
  successful_suppression: 'Successful Suppression',
  dead: 'Dead',
}

export function ClaimVitals({ detail, landscape }: ClaimVitalsProps) {
  const { claim, momentum, salience, friction, persistence, arousal, expressibility, exposure, confidence_detail, provenance, supply_chain, coordination } = detail
  const lowConfidence = confidence_detail.score < 0.5

  const frictionTooltip = useTooltip<HTMLDivElement>()
  const exposureTooltip = useTooltip<HTMLDivElement>()

  return (
    <div className="p-3 overflow-y-auto h-full">
      {/* Claim text */}
      <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
        "{claim.text}"
      </p>

      {/* Above the fold metrics */}
      <div className="space-y-0.5">
        <MetricRow
          label="Salience"
          value={salience.value}
          sparkline={salience.sparkline}
          suffix={salience.baseline}
          dimmed={lowConfidence}
          tooltip={Tooltips.salience(salience.value, salience.baseline, Math.round(salience.value * 50 + 50))}
        />
        <MetricRow
          label="Momentum"
          value={momentum.value}
          sparkline={momentum.sparkline}
          color={getMomentumColor(momentum.value)}
          dimmed={lowConfidence}
          tooltip={Tooltips.momentum(momentum.value, Math.round(50 + momentum.value * 30 - 15), Math.round(50 + momentum.value * 30), 24, Math.round(momentum.source_diversity * 80 + 10), momentum.bridge_ratio)}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
            title={`Source diversity: ${momentum.source_diversity.toFixed(2)}`}
            style={{ backgroundColor: getSourceDiversityColor(momentum.source_diversity) }}
          />
        </MetricRow>

        {/* Friction — prominent */}
        <div
          ref={frictionTooltip.ref}
          className="rounded px-2 py-2 my-1"
          style={{ backgroundColor: 'rgba(245,158,11,0.06)', borderLeft: '2px solid #F59E0B', opacity: lowConfidence ? 0.4 : 1, cursor: 'help' }}
          {...frictionTooltip.handlers}
        >
          {frictionTooltip.rect && (
            <MethodologyTooltip content={Tooltips.friction(friction.value, momentum.friction_quadrant)} rect={frictionTooltip.rect} />
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: '#F59E0B', textDecoration: 'underline dotted', textUnderlineOffset: '3px' }}>Friction</span>
            <span className="font-data text-sm" style={{ color: 'var(--color-text-primary)' }}>
              {friction.value.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              {QUADRANT_LABELS[momentum.friction_quadrant] ?? momentum.friction_quadrant}
            </span>
            <Sparkline data={friction.sparkline} width={50} height={14} color="#F59E0B" />
          </div>
          {/* Friction bar */}
          <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(friction.value * 100, 100)}%`,
                backgroundColor: friction.value > 0.5 ? '#EF4444' : '#F59E0B',
              }}
            />
          </div>
        </div>

        <MetricRow
          label="Persistence"
          value={`${momentum.persistence_windows} windows`}
          dimmed={lowConfidence}
          tooltip={Tooltips.persistence(momentum.persistence_windows)}
        />
        <MetricRow
          label="Arousal"
          value={arousal.value}
          sparkline={arousal.sparkline}
          dimmed={lowConfidence}
          color={claim.arousal === 'high' ? '#EF4444' : claim.arousal === 'medium' ? '#F59E0B' : '#94A3B8'}
          tooltip={Tooltips.arousal(
            arousal.sparkline.length >= 2 && arousal.sparkline[arousal.sparkline.length - 1] > arousal.sparkline[arousal.sparkline.length - 2] ? 'warming'
            : arousal.sparkline.length >= 2 && arousal.sparkline[arousal.sparkline.length - 1] < arousal.sparkline[arousal.sparkline.length - 2] ? 'cooling'
            : 'stable',
            arousal.value,
            arousal.sparkline.length >= 2 ? arousal.sparkline[arousal.sparkline.length - 2] : arousal.value,
          )}
        />
        <MetricRow
          label="Express."
          value={expressibility.value}
          confidence={expressibility.confidence_interval}
          dimmed={lowConfidence}
          tooltip={Tooltips.expressibility(expressibility.value)}
        />

        {/* Exposure decomposition bar */}
        <div
          ref={exposureTooltip.ref}
          className="mt-2 mb-1"
          style={{ opacity: lowConfidence ? 0.4 : 1, cursor: 'help' }}
          {...exposureTooltip.handlers}
        >
          {exposureTooltip.rect && (
            <MethodologyTooltip content={Tooltips.exposure()} rect={exposureTooltip.rect} />
          )}
          <span className="text-xs" style={{ color: 'var(--color-text-muted)', textDecoration: 'underline dotted', textUnderlineOffset: '3px' }}>Exposure</span>
          <div className="flex h-3 rounded overflow-hidden mt-1 gap-px">
            <div
              title={`Production: ${exposure.production.value.toFixed(2)}`}
              className="rounded-l"
              style={{
                flex: exposure.production.value,
                backgroundColor: '#3B82F6',
              }}
            />
            <div
              title={`Amplification: ${exposure.amplification.value.toFixed(2)}`}
              style={{
                flex: exposure.amplification.value,
                backgroundColor: '#8B5CF6',
              }}
            />
            <div
              title={`Est. Exposure: ${exposure.estimated_exposure.value.toFixed(2)}`}
              className="rounded-r"
              style={{
                flex: exposure.estimated_exposure.value,
                backgroundColor: '#06B6D4',
                opacity: 0.6,
              }}
            />
          </div>
          <div className="flex justify-between text-[9px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            <span>Production</span>
            <span>Amplification</span>
            <span>Est. Exposure</span>
          </div>
        </div>

        <MetricRow
          label="Confidence"
          value={confidence_detail.score}
          dimmed={confidence_detail.score < 0.5}
          tooltip={{
            title: 'Extraction Confidence',
            calculation: 'Composite score of how confidently the extraction model parsed this claim from raw source text.',
            reading: `${confidence_detail.score.toFixed(2)} — ${confidence_detail.score < 0.5 ? 'Low confidence: treat data with caution.' : 'Acceptable confidence.'}${confidence_detail.factors.length > 0 ? ' Factors: ' + confidence_detail.factors.join(', ') + '.' : ''}`,
            caveat: confidence_detail.score < 0.5 ? 'Metrics derived from low-confidence extractions are shown at 40% opacity.' : undefined,
          }}
        />
      </div>

      {/* Below the fold */}
      <div className="mt-4 pt-3 border-t space-y-3" style={{ borderColor: 'var(--color-border)' }}>
        {/* Provenance */}
        <div>
          <h4 className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-muted)' }}>
            Provenance
          </h4>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            First seen: {provenance.first_platform} at {new Date(provenance.first_timestamp).toLocaleDateString()}
          </p>
          {provenance.lead_lag.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {provenance.lead_lag.map((ll, i) => (
                <p key={i} className="text-[10px] font-data" style={{ color: 'var(--color-text-muted)' }}>
                  {ll.platform}: {ll.lag_hours > 0 ? `+${ll.lag_hours}h` : `${ll.lag_hours}h`}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Supply Chain */}
        <div>
          <h4 className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-muted)' }}>
            Supply Chain
          </h4>
          {supply_chain.observation_boundary && (
            <p className="text-[10px] italic mb-1" style={{ color: '#F59E0B' }}>
              {supply_chain.observation_boundary}
            </p>
          )}
          <div className="space-y-1">
            {supply_chain.hops.map((hop, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                <span className="font-data" style={{ color: 'var(--color-text-primary)' }}>{hop.platform}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>
                  fidelity: {(hop.fidelity_to_origin * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Coordination */}
        <div>
          <h4 className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-muted)' }}>
            Coordination Check
          </h4>
          <div className="space-y-1">
            {(['burstiness', 'near_duplicate', 'cross_platform_sync', 'source_diversity_anomaly'] as const).map(key => {
              const signal = coordination[key]
              return (
                <div key={key} className="flex items-center justify-between text-[10px]">
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    {key.replace(/_/g, ' ')}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-data" style={{ color: getSeverityColor(signal.severity) }}>
                      {signal.score.toFixed(2)}
                    </span>
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      / {signal.organic_baseline.toFixed(2)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Semantic Neighbors */}
        {detail.semantic_neighbors.length > 0 && (
          <div>
            <h4 className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-muted)' }}>
              Semantic Neighbors
            </h4>
            <div className="space-y-0.5">
              {detail.semantic_neighbors.slice(0, 5).map((n, i) => {
                const neighborClaim = landscape?.claims.find(c => c.id === n.claim_id)
                const displayText = neighborClaim?.text
                  ? neighborClaim.text.length > 55
                    ? neighborClaim.text.slice(0, 55) + '…'
                    : neighborClaim.text
                  : n.claim_id.slice(0, 20) + '…'
                return (
                  <div key={i} className="flex items-center justify-between text-[10px] gap-2">
                    <span className="truncate" style={{ color: 'var(--color-text-secondary)' }}>
                      {displayText}
                    </span>
                    <span className="font-data shrink-0" style={{ color: 'var(--color-cyan)' }}>
                      {n.similarity.toFixed(2)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Adversarial Pairs / Counter-Narrative Dynamics */}
        <AdversarialPairsSection
          pairs={detail.adversarial_pairs ?? []}
          thisClusterId={claim.cluster_id}
        />

        {/* Example Content */}
        {detail.example_content.length > 0 && (
          <div>
            <h4 className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-muted)' }}>
              Example Content
            </h4>
            <div className="space-y-2">
              {detail.example_content.slice(0, 3).map((ex, i) => (
                <div key={i} className="rounded px-2 py-1.5" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}>
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className="text-[9px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                      {ex.platform}
                    </span>
                    {ex.is_influencer_framing && (
                      <span className="text-[9px] font-medium px-1 rounded" style={{ color: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.12)' }}>
                        Influencer Framing
                      </span>
                    )}
                    <span className="text-[9px] font-data ml-auto" style={{ color: 'var(--color-text-muted)' }}>
                      conf {ex.confidence.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[10px] leading-relaxed" style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                    "{ex.text.length > 120 ? ex.text.slice(0, 120) + '…' : ex.text}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
