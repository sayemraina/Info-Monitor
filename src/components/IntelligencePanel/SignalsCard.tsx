import React, { useState } from 'react';
import type { TimeWindow, EventType } from '../../types';
import { ExpandedCardOverlay } from '../shared/ExpandedCardOverlay';
import { SignalsTimeline } from '../ZoneD/SignalsTimeline';
import { useIsMobile } from '../../hooks/useIsMobile';

interface SignalsCardProps {
  topicId: string;
  timeWindow: TimeWindow;
  eventTypeFilter: EventType | 'all';
  onSetEventTypeFilter: (filter: EventType | 'all') => void;
  onSelectClaim: (claimId: string) => void;
  keySignal?: { type: string; summary: string } | null;
}

export const SignalsCard: React.FC<SignalsCardProps> = ({ keySignal, ...props }) => {
  const isMobile = useIsMobile()
  const [isExpanded, setIsExpanded] = useState(false);

  if (isExpanded) {
    return (
      <ExpandedCardOverlay title="Signals & Events Timeline" onClose={() => setIsExpanded(false)}>
        <div className="h-[500px]">
          <SignalsTimeline {...props} />
        </div>
      </ExpandedCardOverlay>
    );
  }

  return (
    <div className="flex flex-col h-full rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <h3 className="font-sans text-[11px] font-semibold text-[#CBD5E1] uppercase tracking-wider" style={{ borderLeft: '2.5px solid #06B6D4', paddingLeft: '8px' }}>
          Signals
        </h3>
      </div>

      {/* Pinned key signal */}
      {keySignal && (
        <div className="px-3 py-2 shrink-0" style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'rgba(6,182,212,0.03)' }}>
          <div className="flex items-center gap-1.5">
            <span className="font-data uppercase tracking-wider shrink-0" style={{ fontSize: '8px', color: '#06B6D4', letterSpacing: '0.8px' }}>KEY</span>
            <span className="text-[10px] text-slate-300 truncate">{keySignal.summary}</span>
          </div>
        </div>
      )}

      {/* Scrollable timeline body — overflow-y-auto enables actual scrolling */}
      <div className="flex-1 min-h-0 relative overflow-y-auto custom-scrollbar">
        <div style={{ transform: 'scale(0.85)', transformOrigin: 'top left', width: '117%' }}>
          <SignalsTimeline {...props} />
        </div>
        {/* Fade-out gradient at the bottom — purely cosmetic */}
        <div className="sticky bottom-0 inset-x-0 h-12 pointer-events-none" style={{ background: 'linear-gradient(to top, #030508, rgba(3,5,8,0.7), transparent)' }} />
      </div>

      {/* Always-visible View Details button pinned above the gradient */}
      <div className="px-3 pb-2 pt-1 text-right shrink-0 relative z-10">
        <button
          className={`${isMobile ? 'text-[13px] py-2 px-3' : 'text-[11px]'} text-slate-500 hover:text-red-500 transition-colors inline-block cursor-pointer`}
          onClick={() => setIsExpanded(true)}
        >
          View details ›
        </button>
      </div>
    </div>
  );
};
