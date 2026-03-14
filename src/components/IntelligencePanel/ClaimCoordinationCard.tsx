import React, { useState } from 'react';
import type { ClaimDetail, LandscapeData } from '../../types';
import { Card } from '../shared/Card';
import { ExpandedCardOverlay } from '../shared/ExpandedCardOverlay';
import { getSeverityColor } from '../../utils/colors';
import { InfoButton } from '../shared/InfoButton';
import { GLOSSARY } from '../../constants/glossary';

interface ClaimCoordinationCardProps {
  detail: ClaimDetail;
  landscape?: LandscapeData | null;
}

export const ClaimCoordinationCard: React.FC<ClaimCoordinationCardProps> = ({ detail, landscape }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { coordination, adversarial_pairs, semantic_neighbors } = detail;

  const content = (
    <div className="flex flex-col gap-4">
      <div>
        <h4 className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide mb-2 text-slate-500">
          Algorithmic Coordination Checks <InfoButton term="Coordination" content={GLOSSARY.Coordination} />
        </h4>
        <div className="space-y-1.5">
          {([
            { key: 'burstiness', label: 'Burstiness', glossaryKey: 'Burstiness' },
            { key: 'near_duplicate', label: 'Near Duplicate', glossaryKey: 'NearDuplicate' },
            { key: 'cross_platform_sync', label: 'Cross Platform Sync', glossaryKey: 'CrossPlatformSync' },
            { key: 'source_diversity_anomaly', label: 'Source Diversity Anomaly', glossaryKey: 'SourceDiversityAnomaly' },
          ] as const).map(({ key, label, glossaryKey }) => {
            const signal = coordination[key];
            return (
              <div key={key} className="flex items-center justify-between text-[11px] bg-[#1A2A3C]/30 p-1.5 rounded">
                <span className="text-slate-300 flex items-center gap-0.5">
                  {label}
                  <InfoButton term={label} content={GLOSSARY[glossaryKey]} />
                </span>
                <div className="flex items-center gap-2 font-mono">
                  <span style={{ color: getSeverityColor(signal.severity) }}>
                    {signal.score.toFixed(2)}
                  </span>
                  <span className="text-slate-500">/ {signal.organic_baseline.toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {adversarial_pairs && adversarial_pairs.length > 0 && (
        <div>
          <h4 className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide mb-2 text-slate-500">
            Detected Counter-Narratives <InfoButton term="Counter-Narrative" content={GLOSSARY.CounterNarrative} />
          </h4>
          <div className="flex flex-col gap-2">
            {adversarial_pairs.map((pair, idx) => (
              <div key={idx} className="border rounded p-2 border-l-2" style={{ backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', borderLeftColor: 'rgba(239,68,68,0.5)' }}>
                <div className="text-[10px] font-bold mb-1 uppercase tracking-wider" style={{ color: '#EF4444' }}>Adversarial Pair</div>
                <div className="text-[11px] text-slate-300">
                  <span className="text-slate-400 line-through mr-1 text-[10px]">vs</span>
                  {pair.cluster_id_a === detail.claim.cluster_id ? pair.label_b : pair.label_a}
                </div>
                <div className="mt-1 text-[10px] text-slate-500 font-mono">
                  Corr: {pair.momentum_correlation.toFixed(2)} | Lag: {pair.response_lag.median_hours}h
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (isExpanded) {
    return (
      <ExpandedCardOverlay title="Coordination & Network Structure" onClose={() => setIsExpanded(false)}>
        {content}

        {semantic_neighbors.length > 0 && (
          <div className="mt-6 pt-4 border-t border-[#1E3044]">
            <h4 className="text-[11px] font-medium uppercase tracking-wide mb-3 text-slate-500">Semantic Neighborhood</h4>
            <div className="space-y-2">
              {semantic_neighbors.slice(0, 5).map((n, i) => {
                const neighborClaim = landscape?.claims.find(c => c.id === n.claim_id);
                const text = neighborClaim?.text || `Claim ${n.claim_id.substring(0, 8)}...`;
                return (
                  <div key={i} className="flex items-start gap-3 bg-[#1A2A3C]/50 p-2 rounded">
                    <div className="bg-cyan-900/50 text-cyan-400 font-mono text-[10px] px-1.5 py-0.5 rounded border border-cyan-800">
                      {(n.similarity * 100).toFixed(0)}%
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed pt-0.5 max-w-sm">
                      {text}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </ExpandedCardOverlay>
    );
  }

  return (
    <Card 
      title="Coordination Context" 
      expandable={true} 
      onExpand={() => setIsExpanded(true)}
    >
      {content}
    </Card>
  );
};
