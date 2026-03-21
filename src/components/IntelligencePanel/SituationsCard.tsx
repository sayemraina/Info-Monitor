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
      className={`p-2.5 bg-[#1A2A3C]/50 border border-[#1E3044]/60 rounded-lg flex gap-2.5 ${
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
        <span className="text-[8px] uppercase font-bold px-1.5 py-0.5 rounded border" style={getSeverityStyle(sit.severity)}>
          {sit.severity}
        </span>
      </div>
      <div className="flex-1">
        <p className="text-[10px] text-slate-100 leading-snug font-medium">
          {sit.summary}
        </p>
        <div className="mt-1 text-[8px] font-mono text-slate-500">
          TRIGGER: {sit.metric_basis}
        </div>
        {detailed && sit.cluster_id && (
          <div className="mt-1 text-[9px] text-cyan-500/70">↗ Click to view cluster</div>
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
              what: "Automated synthesis of metrics into human-readable narrative alerts.",
              soWhat: "Each situation flags a specific combination of momentum, friction, and persistence.",
              how: "Rules engine evaluating per-cluster metric thresholds."
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
      <div className="flex flex-col gap-1.5 overflow-hidden custom-scrollbar">
        {situations.slice(0, 2).map(sit => renderSituation(sit, false))}
        {situations.length > 2 && (
          <div className="pt-0.5">
            <span className="text-[9px] text-slate-500 font-medium">
              +{situations.length - 2} more
            </span>
          </div>
        )}
        {situations.length === 0 && (
          <div className="text-[10px] text-slate-500 italic p-2">
            No active situations
          </div>
        )}
      </div>
    </Card>
  );
};
