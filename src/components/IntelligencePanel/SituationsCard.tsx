import React, { useState } from 'react';
import type { Situation } from '../../types';
import { Card } from '../shared/Card';
import { ExpandedCardOverlay } from '../shared/ExpandedCardOverlay';
import { InfoButton } from '../shared/InfoButton';

interface SituationsCardProps {
  situations: Situation[];
  onSelectCluster?: (clusterId: string) => void;
}

export const SituationsCard: React.FC<SituationsCardProps> = ({ situations, onSelectCluster }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getSeverityStyle = (severity: string): React.CSSProperties => {
    switch (severity) {
      case 'high': return { backgroundColor: 'rgba(239,68,68,0.2)', color: '#EF4444', borderColor: 'rgba(239,68,68,0.5)' };
      case 'medium': return { backgroundColor: 'rgba(245,158,11,0.2)', color: '#F59E0B', borderColor: 'rgba(245,158,11,0.5)' };
      case 'low': return { backgroundColor: 'rgba(107,114,128,0.4)', color: '#D1D5DB', borderColor: 'rgb(75,85,99)' };
      default: return { backgroundColor: 'rgba(107,114,128,0.4)', color: '#D1D5DB', borderColor: 'rgb(75,85,99)' };
    }
  };

  const renderSituation = (sit: Situation, detailed: boolean) => (
    <div 
      key={sit.id} 
      className={`p-3.5 bg-[#1A2A3C]/50 border border-[#1E3044]/60 rounded-lg flex gap-3 ${
        detailed && sit.cluster_id ? 'hover:border-cyan-500/50 cursor-pointer transition-colors' : ''
      }`}
      onClick={() => {
        if (detailed && sit.cluster_id && onSelectCluster) {
          onSelectCluster(sit.cluster_id);
          setIsExpanded(false);
        }
      }}
    >
      <div className="shrink-0 mt-0.5">
        <span className="text-[10px] uppercase font-bold px-2 py-1 rounded border" style={getSeverityStyle(sit.severity)}>
          {sit.severity}
        </span>
      </div>
      <div className="flex-1">
        <p className="text-[13px] text-slate-100 leading-snug font-medium">
          {sit.summary}
        </p>
        <div className="mt-1.5 text-[10px] font-mono text-slate-500">
          TRIGGER: {sit.metric_basis}
        </div>
        {detailed && sit.cluster_id && (
          <div className="mt-1 text-[10px] text-cyan-500/70">↗ Click to view cluster</div>
        )}
      </div>
    </div>
  );

  if (isExpanded) {
    return (
      <ExpandedCardOverlay 
        title="Active Situations" 
        onClose={() => setIsExpanded(false)}
      >
        <div className="flex items-center gap-2 mb-4">
          <p className="text-[13px] text-slate-400">
            Algorithmic assessments of narrative trajectory based on combination triggers.
          </p>
          <InfoButton 
            term="Situations"
            content={{
              plain: "Automated synthesis of underlying metrics into human-readable alerts.",
              technical: "A rules-engine evaluating bounding boxes around momentum, friction, and persistence.",
              methodology: "Evaluated per-cluster against predefined heuristics (e.g. momentum > 0.5 AND friction > 0.6 = 'escalating')."
            }}
          />
        </div>

        <div className="flex flex-col gap-2 animate-fadeIn">
          {situations.map(sit => renderSituation(sit, true))}
          {situations.length === 0 && (
            <div className="text-center p-6 text-slate-500 text-sm">No active situations detected.</div>
          )}
        </div>
      </ExpandedCardOverlay>
    );
  }

  return (
    <Card 
      title="Active Situations" 
      expandable={situations.length > 0} 
      onExpand={() => setIsExpanded(true)}
    >
      <div className="flex flex-col gap-2 overflow-hidden max-h-[320px] custom-scrollbar">
        {situations.slice(0, 4).map(sit => renderSituation(sit, false))}
        {situations.length > 4 && (
          <div className="text-[11px] text-slate-500 text-center pt-1 font-medium">
            +{situations.length - 4} more
          </div>
        )}
        {situations.length === 0 && (
          <div className="text-[12px] text-slate-500 italic p-2">
            No active situations
          </div>
        )}
      </div>
    </Card>
  );
};
