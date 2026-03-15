import React, { useState } from 'react';
import type { InformationFluxIndex } from '../../types';
import { Card } from '../shared/Card';
import { ExpandedCardOverlay } from '../shared/ExpandedCardOverlay';
import { MetricIsolation } from '../shared/MetricIsolation';
import { MetricRow } from '../ZoneB/MetricRow';
import { InfoButton } from '../shared/InfoButton';
import { GLOSSARY } from '../../constants/glossary';

interface IFICardProps {
  ifi: InformationFluxIndex;
}

export const IFICard: React.FC<IFICardProps> = ({ ifi }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isolatedMetric, setIsolatedMetric] = useState<string | null>(null);

  const ifiInfo = {
    plain: "Rate of structural change in this topic's narrative topology between consecutive time windows.",
    technical: "√JSD between cluster-salience distributions at consecutive time windows. Zero = no topology change. 100 = complete restructuring.",
    methodology: "IFI = √JSD(p_t, p_{t−1}) × 100\nFlux character = sign(H(p_t) − H(p_{t−1}))\nwhere p = normalized cluster-salience vector",
    caveat: "Computed from synthetic distribution snapshots. In production, derived from actual claim volumes per cluster per window."
  };

  const trendIcon = ifi.trend === 'increasing' ? '↑' : ifi.trend === 'decreasing' ? '↓' : '→';
  const trendColor = ifi.trend === 'increasing' ? 'text-red-500' : 'text-slate-400';

  // Flux character display
  const fluxIcon = ifi.flux_character === 'diversifying' ? '↗'
    : ifi.flux_character === 'consolidating' ? '↘'
    : '⇄';

  const fluxColor = ifi.flux_character === 'diversifying' ? '#F59E0B'
    : ifi.flux_character === 'consolidating' ? '#06B6D4'
    : '#94A3B8';

  const fluxDescription = ifi.flux_character === 'diversifying'
    ? 'More clusters gaining proportional presence. Narrative space expanding.'
    : ifi.flux_character === 'consolidating'
    ? 'Fewer clusters dominating. A narrative is winning the attention economy.'
    : 'Clusters trading prominence without overall entropy change. Dominance shift.';

  const fluxGlossaryTerm = ifi.flux_character === 'diversifying' ? 'Fragmenting/Diversifying' 
    : ifi.flux_character === 'consolidating' ? 'Consolidating/Mainstreaming' : 'Stable';

  const [prevWindow, currWindow] = ifi.temporal_window_pair;

  if (isExpanded) {
    return (
      <ExpandedCardOverlay title="Information Flux Index (IFI) Detail" onClose={() => setIsExpanded(false)}>
        {isolatedMetric === 'ifi' ? (
          <MetricIsolation
            metric={{
              label: "Information Flux Index",
              value: <>{ifi.value.toFixed(1)} <span className={`text-[20px] ${trendColor}`}>{trendIcon}</span></>,
              sparkline: ifi.sparkline,
              confidence_interval: ifi.confidence_interval
            }}
            infoContent={ifiInfo}
            onBack={() => setIsolatedMetric(null)}
          />
        ) : (
          <div className="flex flex-col gap-4 animate-fadeIn">
            <MetricRow
              label="Information Flux Index"
              value={ifi.value}
              suffix={trendIcon}
              color={ifi.trend === 'increasing' ? 'var(--color-crimson)' : undefined}
              sparkline={ifi.sparkline}
              infoContent={ifiInfo}
              onIsolate={() => setIsolatedMetric('ifi')}
            />

            {/* Structural Direction */}
            <div className="mt-2">
              <h4 className="text-[11px] uppercase tracking-widest text-slate-500 mb-2 font-semibold">
                Structural Direction
              </h4>
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none mt-0.5" style={{ color: fluxColor }}>
                  {fluxIcon}
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-white font-mono capitalize">{ifi.flux_character}</span>
                    <InfoButton term={fluxGlossaryTerm} content={GLOSSARY.Mutation} />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{fluxDescription}</p>
                </div>
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-3">
                ΔEntropy = {ifi.entropy_delta > 0 ? '+' : ''}{ifi.entropy_delta.toFixed(4)} bits
                &nbsp;·&nbsp;Comparing {prevWindow} → {currWindow}
              </div>
            </div>

            {/* Qualitative Flags */}
            {(ifi.flags.coordination_detected || ifi.flags.arousal_escalating) && (
              <div className="mt-1 flex flex-col gap-1.5 border-t border-[#1E3044] pt-3">
                <h4 className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">
                  Qualitative Flags
                </h4>
                {ifi.flags.coordination_detected && (
                  <span className="text-[11px] text-amber-400 flex items-center gap-1">
                    ⚠ Coordination signatures detected <InfoButton term="Coordination" content={GLOSSARY.Coordination} />
                  </span>
                )}
                {ifi.flags.arousal_escalating && (
                  <span className="text-[11px] text-orange-400 flex items-center gap-1">
                    ⚠ Emotional escalation active <InfoButton term="Arousal" content={GLOSSARY.Arousal} />
                  </span>
                )}
                <p className="text-[10px] text-slate-600 mt-0.5">
                  Flags are qualitative annotations. They are not weighted into the IFI value.
                </p>
              </div>
            )}
          </div>
        )}
      </ExpandedCardOverlay>
    );
  }

  return (
    <Card
      title="Information Flux (IFI)"
      expandable={true}
      onExpand={() => setIsExpanded(true)}
      className="h-full"
      headerRight={<InfoButton term="Information Flux Index" content={ifiInfo} />}
    >
      {/* Value + trend + flux character */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-mono text-white">{ifi.value.toFixed(1)}</span>
          <span className={`text-xl font-bold ${trendColor}`}>{trendIcon}</span>
        </div>
        <span className="text-[11px] font-mono" style={{ color: fluxColor }}>
          {fluxIcon} {ifi.flux_character}
        </span>
      </div>

      {/* Mini sparkline */}
      <div className="flex-1 flex items-end gap-[1px] mt-1 opacity-80 min-h-[32px]">
        {ifi.sparkline.map((val, i) => (
          <div
            key={i}
            className="w-full bg-cyan-900 rounded-t-sm"
            style={{ height: `${Math.max(10, val)}%` }}
          />
        ))}
      </div>

      {/* Comparing label + flags */}
      <div className="mt-2 flex flex-col gap-[2px]">
        <span className="text-[10px] text-slate-600 font-mono">
          Comparing {prevWindow} → {currWindow}
        </span>
        {ifi.flags.coordination_detected && (
          <span className="text-[10px] text-amber-400 flex items-center gap-1">
            ⚠ coordination signatures detected <InfoButton term="Coordination" content={GLOSSARY.Coordination} />
          </span>
        )}
        {ifi.flags.arousal_escalating && (
          <span className="text-[10px] text-orange-400 flex items-center gap-1">
            ⚠ emotional escalation <InfoButton term="Arousal" content={GLOSSARY.Arousal} />
          </span>
        )}
      </div>
    </Card>
  );
};
