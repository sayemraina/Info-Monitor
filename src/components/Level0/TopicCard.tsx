import { useState } from 'react'
import type { TopicSummary, EntryHint } from '../../types'
import { MiniSparkline } from './MiniSparkline'
import { getContestationColor } from '../../utils/colors'
import { HoverTip } from '../shared/HoverTip'

interface TopicCardProps {
  topic: TopicSummary
  isActive: boolean
  isLocked: boolean
  onClick: () => void
  onNavigate: (hint?: EntryHint) => void
}

export function TopicCard({ topic, isActive, isLocked, onClick, onNavigate }: TopicCardProps) {
  const [hovered, setHovered] = useState(false)

  // IFI color based on severity thresholds
  const ifiValue = topic.ifi?.value ?? 0
  const ifiColor = ifiValue > 30 ? '#EF4444'
    : ifiValue > 15 ? '#F59E0B'
    : '#22C55E'
  const ifiSeverity = ifiValue > 30 ? 'critical' : ifiValue > 15 ? 'elevated' : 'normal'

  const contestColor = getContestationColor(topic.contestation_level)

  return (
    <div
      className="relative rounded-lg cursor-pointer"
      style={{
        padding: '10px 12px',
        backgroundColor: isActive
          ? 'rgba(233,69,96,0.06)'
          : hovered
            ? 'rgba(255,255,255,0.03)'
            : 'rgba(255,255,255,0.015)',
        border: isActive
          ? '1px solid rgba(233,69,96,0.4)'
          : hovered
            ? '1px solid rgba(148,163,184,0.15)'
            : '1px solid rgba(148,163,184,0.06)',
        boxShadow: isActive
          ? '0 0 12px rgba(233,69,96,0.12)'
          : 'none',
        transition: 'all 200ms ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {/* Row 1: Topic name + navigate arrow */}
      <div className="flex items-center justify-between" style={{ marginBottom: '6px' }}>
        <span
          className="font-semibold truncate"
          style={{ color: 'rgba(241,245,249,0.85)', fontSize: '12px' }}
        >
          {topic.name}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate('explore') }}
          className="cursor-pointer flex-shrink-0"
          style={{
            color: hovered ? '#06B6D4' : 'rgba(148,163,184,0.4)',
            fontSize: hovered ? '9.5px' : '11px',
            background: 'none',
            border: 'none',
            padding: '0 0 0 6px',
            transition: 'color 150ms ease',
            whiteSpace: 'nowrap',
          }}
          title="View topic analysis"
        >
          {hovered ? 'Explore →' : '→'}
        </button>
      </div>

      {/* Row 2: IFI + contestation + sparkline */}
      <div className="flex items-center gap-3">
        {/* IFI score */}
        {topic.ifi && (
          <HoverTip text={`IFI ${topic.ifi.value.toFixed(1)} — ${ifiSeverity} information flooding intensity`}>
            <span
              className="font-data font-bold"
              style={{ fontSize: '14px', color: ifiColor, cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); onNavigate('ifi') }}
            >
              {topic.ifi.value.toFixed(1)}
            </span>
          </HoverTip>
        )}

        {/* Source diversity dot — green (organic) or red (concentrated) */}
        {topic.top_accelerating_claim && (
          <HoverTip text={topic.top_accelerating_claim.source_diversity > 0.5
            ? 'Source diversity: organic — spread across many voices'
            : 'Source diversity: concentrated — few dominant sources'}>
            <span
              style={{
                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                backgroundColor: topic.top_accelerating_claim.source_diversity > 0.5
                  ? '#22C55E' : '#EF4444',
                outline: '4px solid transparent', /* larger hover target */
              }}
              onClick={(e) => { e.stopPropagation(); onNavigate('diversity') }}
            />
          </HoverTip>
        )}

        {/* Contestation badge */}
        <HoverTip text={`Contestation: ${topic.contestation_level} — how actively claims are being disputed`}>
          <span
            className="font-data uppercase"
            style={{
              fontSize: '7.5px',
              letterSpacing: '1px',
              color: contestColor,
              opacity: 0.8,
              cursor: 'pointer',
            }}
            onClick={(e) => { e.stopPropagation(); onNavigate('contestation') }}
          >
            {topic.contestation_level}
          </span>
        </HoverTip>

        {/* Sparkline — pushed to right */}
        <HoverTip text="Activity trend — claim volume over recent windows">
          <div className="ml-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); onNavigate('sparkline') }}>
            <MiniSparkline data={topic.activity_sparkline} width={60} height={18} />
          </div>
        </HoverTip>
      </div>

      {/* Row 3: Top signal — labeled one-line preview */}
      {topic.key_signal && (
        <HoverTip block text={topic.key_signal.summary}>
          <div
            className="flex items-center gap-1.5 cursor-pointer"
            style={{ marginTop: '5px' }}
            onClick={(e) => { e.stopPropagation(); onNavigate('signal') }}
          >
            <span
              className="font-data uppercase flex-shrink-0"
              style={{ fontSize: '7px', letterSpacing: '0.5px', color: '#06B6D4', opacity: 0.7 }}
            >
              Signal
            </span>
            <p
              className="truncate"
              style={{ fontSize: '9px', color: 'rgba(148,163,184,0.5)' }}
            >
              {topic.key_signal.summary}
            </p>
          </div>
        </HoverTip>
      )}

      {/* Row 4: Situation alert — labeled (conditional) */}
      {topic.top_situation && (
        <HoverTip block text={`${topic.top_situation.severity === 'high' ? 'High' : 'Medium'} severity: ${topic.top_situation.summary}`}>
          <div
            className="flex items-center gap-1.5 cursor-pointer"
            style={{ marginTop: '4px' }}
            onClick={(e) => { e.stopPropagation(); onNavigate('situation') }}
          >
            <span
              className="font-data uppercase flex-shrink-0"
              style={{
                fontSize: '7px', letterSpacing: '0.5px',
                color: topic.top_situation.severity === 'high' ? '#EF4444' : '#F59E0B',
                opacity: 0.8,
              }}
            >
              Alert
            </span>
            <span
              className="truncate"
              style={{
                fontSize: '8.5px',
                color: topic.top_situation.severity === 'high'
                  ? 'rgba(239,68,68,0.6)'
                  : 'rgba(245,158,11,0.6)',
              }}
            >
              {topic.top_situation.summary}
            </span>
          </div>
        </HoverTip>
      )}

      {/* Locked indicator */}
      {isLocked && (
        <div
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            backgroundColor: '#E94560',
          }}
        />
      )}
    </div>
  )
}
