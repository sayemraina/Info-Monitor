import React, { useState } from 'react';
import type { LandscapeData, TimeWindow } from '../../types';
import { Card } from '../shared/Card';
import { ExpandedCardOverlay } from '../shared/ExpandedCardOverlay';
import { DivergencePanel } from '../ZoneC/DivergencePanel';

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

  return (
    <Card 
      title="Divergence" 
      expandable={true} 
      onExpand={() => setIsExpanded(true)}
      className="h-full"
    >
      <div className="flex-1 relative pointer-events-none -mx-3 -mt-3" style={{ overflow: 'hidden' }}>
        <div style={{ transform: 'scale(0.85)', transformOrigin: 'top left', width: '117%' }}>
          <DivergencePanel {...props} />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-900 to-transparent pointer-events-none" />
      </div>
    </Card>
  );
};
