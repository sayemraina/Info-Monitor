import React, { useState } from 'react';
import type { ClaimDetail } from '../../types';
import { Card } from '../shared/Card';
import { ExpandedCardOverlay } from '../shared/ExpandedCardOverlay';

interface ClaimProvenanceCardProps {
  detail: ClaimDetail;
}

export const ClaimProvenanceCard: React.FC<ClaimProvenanceCardProps> = ({ detail }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { provenance, supply_chain, example_content } = detail;

  const content = (
    <div className="flex flex-col gap-4">
      <div>
        <h4 className="text-[10px] font-medium uppercase tracking-wide mb-1 text-slate-500">First Seen</h4>
        <p className="text-xs text-slate-300">
          <span className="text-cyan-400 font-mono mr-2">{provenance.first_platform}</span> 
          {new Date(provenance.first_timestamp).toLocaleDateString()}
        </p>
        {provenance.lead_lag.length > 0 && (
          <div className="mt-2 space-y-0.5">
            {provenance.lead_lag.map((ll, i) => (
              <p key={i} className="text-[10px] font-mono text-slate-400 flex justify-between border-b border-[#1E3044]/50 pb-0.5">
                <span>{ll.platform}</span>
                <span className={ll.lag_hours > 0 ? 'text-amber-500' : 'text-cyan-400'}>
                  {ll.lag_hours > 0 ? `+${ll.lag_hours}h` : `${ll.lag_hours}h`}
                </span>
              </p>
            ))}
          </div>
        )}
      </div>

      <div>
        <h4 className="text-[10px] font-medium uppercase tracking-wide mb-1 text-slate-500">Supply Chain</h4>
        {supply_chain.observation_boundary && (
          <p className="text-[10px] italic mb-2 text-amber-500/80 bg-amber-500/10 p-1.5 rounded">
            {supply_chain.observation_boundary}
          </p>
        )}
        <div className="space-y-1.5">
          {supply_chain.hops.map((hop, i) => (
            <div key={i} className="flex items-center gap-2 text-[10px] bg-[#1A2A3C]/30 p-1.5 rounded">
              <span className="font-mono text-slate-300 w-24 truncate shrink-0" title={hop.platform}>{hop.platform}</span>
              <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-cyan-500" 
                  style={{ width: `${Math.max(0, (hop.fidelity_to_origin ?? 0) * 100)}%` }}
                />
              </div>
              <span className="text-slate-400 w-12 text-right">
                {((hop.fidelity_to_origin ?? 0) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (isExpanded) {
    return (
      <ExpandedCardOverlay title="Provenance & Supply Chain" onClose={() => setIsExpanded(false)}>
        {content}
        
        {example_content.length > 0 && (
          <div className="mt-6 pt-4 border-t border-[#1E3044]">
            <h4 className="text-[11px] font-medium uppercase tracking-wide mb-3 text-slate-500">Source Posts</h4>
            <div className="space-y-3">
              {example_content.slice(0, 3).map((ex, i) => (
                <div key={i} className="rounded p-3 bg-[#1A2A3C]/50 border border-[#1E3044] relative">
                  <div className="absolute top-0 right-0 p-1">
                    <span className="text-[9px] font-mono text-slate-500">conf {(ex.confidence ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-cyan-400">
                      {ex.platform}
                    </span>
                    {ex.is_influencer_framing && (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500">
                        Influencer
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] leading-relaxed text-slate-300 italic">
                    "{ex.text}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </ExpandedCardOverlay>
    );
  }

  return (
    <Card 
      title="Provenance" 
      expandable={true} 
      onExpand={() => setIsExpanded(true)}
    >
      {content}
    </Card>
  );
};
