import type { FC } from 'react';
import type { LandscapeData, TimeWindow, EventType } from '../../types';
import { SituationsCard } from '../IntelligencePanel/SituationsCard';
import { SignalsCard } from '../IntelligencePanel/SignalsCard';
import { ClaimBehaviorCard } from '../IntelligencePanel/ClaimBehaviorCard';
import { ClaimProvenanceCard } from '../IntelligencePanel/ClaimProvenanceCard';
import { ClaimCoordinationCard } from '../IntelligencePanel/ClaimCoordinationCard';
import { useClaimDetail } from '../../hooks/useClaimDetail';
import { ClaimFallback } from '../ZoneB/ClaimFallback';

interface RightSidebarProps {
  topicId: string;
  selectedClaimId: string | null;
  landscape: LandscapeData | null;
  compareMode: boolean;
  timeWindow: TimeWindow;
  eventTypeFilter: EventType | 'all';
  onSetEventTypeFilter: (filter: EventType | 'all') => void;
  onSelectClaim: (claimId: string) => void;
  onDeselectClaim: () => void;
}

export const RightSidebar: FC<RightSidebarProps> = ({
  topicId,
  selectedClaimId,
  landscape,
  compareMode,
  timeWindow,
  eventTypeFilter,
  onSetEventTypeFilter,
  onSelectClaim,
  onDeselectClaim
}) => {
  const effectiveClaimId = compareMode ? null : selectedClaimId;
  const { detail, loading, error } = useClaimDetail(topicId, effectiveClaimId);

  return (
    <div className="h-full flex flex-col gap-3 overflow-y-auto p-3 min-h-0 rounded-lg custom-scrollbar" style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>
      
      {!selectedClaimId && landscape && (
        <div className="flex flex-col gap-3 flex-1 min-h-0">
          {landscape.topic_metrics.situations && (
            <div className="shrink-0 pb-6 border-b border-[#1E3044] mb-1">
              <SituationsCard 
                situations={landscape.topic_metrics.situations} 
                onSelectCluster={(cid) => {
                  const claim = landscape.claims.find(c => c.cluster_id === cid);
                  if (claim) onSelectClaim(claim.id);
                }}
              />
            </div>
          )}

          <div className="flex-1 min-h-0 flex flex-col">
             <SignalsCard
               topicId={topicId}
               timeWindow={timeWindow}
               eventTypeFilter={eventTypeFilter}
               onSetEventTypeFilter={onSetEventTypeFilter}
               onSelectClaim={onSelectClaim}
             />
          </div>
        </div>
      )}

      {selectedClaimId && !compareMode && (
        <div className="flex flex-col gap-3 flex-shrink-0">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1E3044]">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">Claim Details</h3>
            <button
              onClick={() => onDeselectClaim()}
              className="text-[10px] text-slate-500 hover:text-white transition-colors cursor-pointer"
            >
              ✕ Close
            </button>
          </div>
          
          {loading ? (
            <div className="h-32 flex items-center justify-center">
              <p className="text-xs text-slate-500">Loading claim data...</p>
            </div>
          ) : error || !detail ? (
            (() => {
              const fallbackClaim = landscape?.claims.find(c => c.id === selectedClaimId);
              if (!fallbackClaim) return <div className="text-sm text-slate-500 text-center py-10">Claim not found in landscape.</div>;
              const fallbackCluster = landscape?.clusters.find(c => c.id === fallbackClaim.cluster_id);
              return <ClaimFallback claim={fallbackClaim} cluster={fallbackCluster} />;
            })()
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs italic text-slate-300 mb-2 border-l-2 border-cyan-500 pl-2">
                "{detail.claim.text}"
              </p>
              <ClaimBehaviorCard detail={detail} />
              <ClaimProvenanceCard detail={detail} />
              <ClaimCoordinationCard detail={detail} landscape={landscape} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
