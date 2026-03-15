import React, { useState } from 'react';
import type { TimeWindow, EventType } from '../../types';
import { ExpandedCardOverlay } from '../shared/ExpandedCardOverlay';
import { SignalsTimeline } from '../ZoneD/SignalsTimeline';

interface SignalsCardProps {
  topicId: string;
  timeWindow: TimeWindow;
  eventTypeFilter: EventType | 'all';
  onSetEventTypeFilter: (filter: EventType | 'all') => void;
  onSelectClaim: (claimId: string) => void;
}

export const SignalsCard: React.FC<SignalsCardProps> = (props) => {
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
        <h3 className="font-sans text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Signals
        </h3>
      </div>

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
          className="text-[11px] text-slate-500 hover:text-red-500 transition-colors inline-block cursor-pointer"
          onClick={() => setIsExpanded(true)}
        >
          View details ›
        </button>
      </div>
    </div>
  );
};
