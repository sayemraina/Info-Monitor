import React, { useState } from 'react';
import type { ClaimDetail } from '../../types';
import { Card } from '../shared/Card';
import { ExpandedCardOverlay } from '../shared/ExpandedCardOverlay';
import { MetricRow } from '../ZoneB/MetricRow';
import { getMomentumColor, getSourceDiversityColor } from '../../utils/colors';
import { InfoButton } from '../shared/InfoButton';
import { GLOSSARY } from '../../constants/glossary';

interface ClaimBehaviorCardProps {
  detail: ClaimDetail;
}

const QUADRANT_LABELS: Record<string, string> = {
  unopposed_advance: 'Unopposed Advance',
  contested_advance: 'Contested Advance',
  successful_suppression: 'Successful Suppression',
  dead: 'Dead',
};

export const ClaimBehaviorCard: React.FC<ClaimBehaviorCardProps> = ({ detail }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { claim, momentum, salience, friction, arousal, expressibility, confidence_detail } = detail;
  const lowConfidence = confidence_detail.score < 0.5;

  const content = (
    <div className="flex flex-col gap-1">
      <MetricRow
        label="Salience"
        value={salience.value}
        sparkline={salience.sparkline}
        suffix={salience.baseline}
        dimmed={lowConfidence}
        infoContent={GLOSSARY.Salience}
      />
      <MetricRow
        label="Momentum"
        value={momentum.value}
        sparkline={momentum.sparkline}
        color={getMomentumColor(momentum.value)}
        dimmed={lowConfidence}
        infoContent={GLOSSARY.Momentum}
      >
        <span
          className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
          title={`Source diversity: ${momentum.source_diversity.toFixed(2)}`}
          style={{ backgroundColor: getSourceDiversityColor(momentum.source_diversity) }}
        />
      </MetricRow>
      
      {/* Mini Friction Bar */}
      <div className="rounded px-2 py-2 my-1 bg-amber-500/10 border-l-2 border-amber-500" style={{ opacity: lowConfidence ? 0.4 : 1 }}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-amber-500 flex items-center gap-1">
            Friction <InfoButton term="Friction" content={GLOSSARY.Friction} />
          </span>
          <span className="font-data text-sm text-white">{friction.value.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-slate-400">
            {QUADRANT_LABELS[momentum.friction_quadrant] ?? momentum.friction_quadrant}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full overflow-hidden bg-[#131F30]">
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
        infoContent={GLOSSARY.Persistence}
      />
      <MetricRow
        label="Arousal"
        value={arousal.value}
        sparkline={arousal.sparkline}
        dimmed={lowConfidence}
        color={claim.arousal === 'high' ? '#EF4444' : claim.arousal === 'medium' ? '#F59E0B' : '#94A3B8'}
        infoContent={GLOSSARY.Arousal} 
      />
      <MetricRow
        label="Expressibility"
        value={expressibility.value}
        confidence={expressibility.confidence_interval}
        dimmed={lowConfidence}
        infoContent={GLOSSARY.Expressibility}
      />
    </div>
  );

  if (isExpanded) {
    return (
      <ExpandedCardOverlay title="Claim Behavior Overview" onClose={() => setIsExpanded(false)}>
        <div className="mt-6 pt-4 border-t border-[#1E3044]">
            <h4 className="text-[11px] font-medium uppercase tracking-wide mb-2 text-slate-500 flex items-center gap-1.5">
              Exposure Breakdown <InfoButton term="Exposure Asymmetry" content={GLOSSARY.ExposureAsymmetry} />
            </h4>
            <div className="flex h-4 rounded overflow-hidden mt-1 gap-px">
              <div
                title={`Production: ${detail.exposure.production.value.toFixed(2)}`}
                className="bg-blue-500"
                style={{ flex: Math.max(0.1, detail.exposure.production.value) }}
              />
              <div
                title={`Amplification: ${detail.exposure.amplification.value.toFixed(2)}`}
                className="bg-purple-500"
                style={{ flex: Math.max(0.1, detail.exposure.amplification.value) }}
              />
              <div
                title={`Est. Exposure: ${detail.exposure.estimated_exposure.value.toFixed(2)}`}
                className="bg-cyan-500 opacity-60"
                style={{ flex: Math.max(0.1, detail.exposure.estimated_exposure.value) }}
              />
            </div>
            <div className="flex justify-between text-[10px] mt-1 text-slate-400">
              <span>Production</span>
              <span>Amplification</span>
              <span>Est. Exposure</span>
            </div>
        </div>
      </ExpandedCardOverlay>
    );
  }

  return (
    <Card 
      title="Behavior & Trajectory" 
      expandable={true} 
      onExpand={() => setIsExpanded(true)}
    >
      {content}
    </Card>
  );
};
