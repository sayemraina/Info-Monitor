import type { FC } from 'react';
import type { LandscapeData, TimeWindow, EventType } from '../../types';
import { SituationsCard } from '../IntelligencePanel/SituationsCard';
import { NarrativeShapersCard } from '../IntelligencePanel/NarrativeShapersCard';
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
  keySignal?: { type: string; summary: string } | null;
  cascadeZones?: Record<string, string>;
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
  onDeselectClaim,
  keySignal,
  cascadeZones
}) => {
  const effectiveClaimId = compareMode ? null : selectedClaimId;
  const { detail, loading, error } = useClaimDetail(topicId, effectiveClaimId);

  return (
    <div className="h-full flex flex-col gap-2 overflow-y-auto p-2 min-h-0 rounded-lg custom-scrollbar" style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>

      {!selectedClaimId && landscape && (
        <div className="flex flex-col gap-2 flex-1 min-h-0">
          {landscape.topic_metrics.situations && (
            <div className={`shrink-0 pb-1 border-b border-[#1E3044] rounded-lg ${cascadeZones?.situations ?? ''}`}>
              <SituationsCard
                situations={landscape.topic_metrics.situations}
                onSelectCluster={(cid) => {
                  const claim = landscape.claims.find(c => c.cluster_id === cid);
                  if (claim) onSelectClaim(claim.id);
                }}
              />
            </div>
          )}

          {/* Narrative Shapers — influencer propagation depth (same heading as L0 YouTubeStrip) */}
          {landscape.topic_metrics.influencer_impact && landscape.topic_metrics.influencer_impact.seeded_cluster_count > 0 && (
            <div className={`shrink-0 pb-1 border-b border-[#1E3044] rounded-lg ${cascadeZones?.shaping ?? ''}`}>
              <NarrativeShapersCard
                impact={landscape.topic_metrics.influencer_impact}
                clusters={landscape.clusters}
              />
            </div>
          )}

          <div className={`flex-1 min-h-0 flex flex-col rounded-lg ${cascadeZones?.signals ?? ''}`}>
             <SignalsCard
               topicId={topicId}
               timeWindow={timeWindow}
               eventTypeFilter={eventTypeFilter}
               onSetEventTypeFilter={onSetEventTypeFilter}
               onSelectClaim={onSelectClaim}
               keySignal={keySignal}
             />
          </div>
        </div>
      )}

      {selectedClaimId && !compareMode && (
        <div className={`flex flex-col gap-3 flex-shrink-0 rounded-lg animate-claim-detail-in ${cascadeZones?.claimDetail ?? ''}`}>
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
              {(() => {
                const cluster = landscape?.clusters.find(c => c.id === detail.claim.cluster_id);
                if (!cluster) return null;
                return (
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 -mt-1 mb-1">
                    <span className="text-slate-400 font-medium">{cluster.label}</span>
                    <span className="text-slate-600">›</span>
                    <span>{cluster.concept_id.replace(/-/g, ' ')}</span>
                  </div>
                );
              })()}
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
