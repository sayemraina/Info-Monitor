import React, { useState } from 'react';
import type { LandscapeData, TimeWindow } from '../../types';
import { Card } from '../shared/Card';
import { ExpandedCardOverlay } from '../shared/ExpandedCardOverlay';
import { DivergencePanel } from '../ZoneC/DivergencePanel';
import { HoverTip } from '../shared/HoverTip';

interface DivergenceCardProps {
  topicId: string;
  timeWindow: TimeWindow;
  sliceA: string;
  sliceB: string;
  compareMode: boolean;
  onSetCompareMode: (mode: boolean) => void;
  landscape?: LandscapeData | null;
}

export const DivergenceCard: React.FC<DivergenceCardProps> = (props) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (isExpanded) {
    return (
      <ExpandedCardOverlay title="Cross-Slice Divergence" onClose={() => setIsExpanded(false)}>
        <div className="h-[500px]">
          <DivergencePanel {...props} />
        </div>
      </ExpandedCardOverlay>
    );
  }

  // Derive readable slice labels
  const sliceLabelA = props.sliceA.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace('Platform', '').trim()
  const sliceLabelB = props.sliceB.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace('Platform', '').trim()

  const compareToggle = props.compareMode ? (
    <button
      onClick={(e) => {
        e.stopPropagation();
        props.onSetCompareMode(false);
      }}
      className="flex items-center gap-1.5 cursor-pointer"
      style={{
        padding: '3px 12px 3px 8px',
        borderRadius: '6px',
        color: '#FECACA',
        background: 'linear-gradient(180deg, rgba(239,68,68,0.2) 0%, rgba(239,68,68,0.08) 100%)',
        border: '1px solid rgba(239,68,68,0.4)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3), 0 0 8px rgba(239,68,68,0.08)',
        transition: 'all 180ms ease',
      }}
      onMouseEnter={e => {
        const t = e.currentTarget;
        t.style.background = 'linear-gradient(180deg, rgba(239,68,68,0.3) 0%, rgba(239,68,68,0.15) 100%)';
        t.style.borderColor = 'rgba(239,68,68,0.6)';
        t.style.color = '#FEE2E2';
      }}
      onMouseLeave={e => {
        const t = e.currentTarget;
        t.style.background = 'linear-gradient(180deg, rgba(239,68,68,0.2) 0%, rgba(239,68,68,0.08) 100%)';
        t.style.borderColor = 'rgba(239,68,68,0.4)';
        t.style.color = '#FECACA';
      }}
    >
      <span style={{ fontSize: '11px', lineHeight: 1 }}>×</span>
      <span className="text-[9px] font-semibold tracking-wide">Exit Comparison</span>
    </button>
  ) : (
    <HoverTip instant text={`Split the Claim Landscape into two side-by-side views — one for ${sliceLabelA}, one for ${sliceLabelB} — to see how each population frames the same topic differently`}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          props.onSetCompareMode(true);
        }}
        className="flex items-center gap-1.5 cursor-pointer"
        style={{
          padding: '3px 12px 3px 8px',
          borderRadius: '6px',
          color: '#E2E8F0',
          background: 'linear-gradient(180deg, rgba(241,245,249,0.08) 0%, rgba(241,245,249,0.03) 100%)',
          border: '1px solid rgba(241,245,249,0.1)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
          transition: 'all 180ms ease',
        }}
        onMouseEnter={e => {
          const t = e.currentTarget;
          t.style.background = 'linear-gradient(180deg, rgba(241,245,249,0.12) 0%, rgba(241,245,249,0.05) 100%)';
          t.style.borderColor = 'rgba(6,182,212,0.4)';
          t.style.color = '#FFFFFF';
        }}
        onMouseLeave={e => {
          const t = e.currentTarget;
          t.style.background = 'linear-gradient(180deg, rgba(241,245,249,0.08) 0%, rgba(241,245,249,0.03) 100%)';
          t.style.borderColor = 'rgba(241,245,249,0.1)';
          t.style.color = '#E2E8F0';
        }}
      >
        <span className="text-[9px] font-semibold tracking-wide">Full Comparison</span>
        <span className="text-[8px]" style={{ color: '#94A3B8' }}>{sliceLabelA} vs {sliceLabelB}</span>
      </button>
    </HoverTip>
  );

  return (
    <Card
      title="Divergence"
      expandable={true}
      onExpand={() => setIsExpanded(true)}
      className="h-full"
      headerRight={compareToggle}
    >
      <div className="flex-1 relative -mx-3 -mt-3" style={{ overflow: 'hidden' }}>
        <div style={{ transform: 'scale(0.85)', transformOrigin: 'top left', width: '117%' }}>
          <DivergencePanel {...props} />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-900 to-transparent pointer-events-none" />
      </div>
    </Card>
  );
};
