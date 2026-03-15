import { useState } from 'react'
import type { TopicSummary } from '../../types'
import { MiniSparkline } from './MiniSparkline'
import { getContestationColor } from '../../utils/colors'

interface TopicCardProps {
  topic: TopicSummary
  isActive: boolean
  isLocked: boolean
  onClick: () => void
  onNavigate: () => void
}

export function TopicCard({ topic, isActive, isLocked, onClick, onNavigate }: TopicCardProps) {
  const [hovered, setHovered] = useState(false)

  // IFI color based on severity thresholds
  const ifiColor = (topic.ifi?.value ?? 0) > 30 ? '#EF4444'
    : (topic.ifi?.value ?? 0) > 15 ? '#F59E0B'
    : '#22C55E'

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
          onClick={(e) => { e.stopPropagation(); onNavigate() }}
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
          <span
            className="font-data font-bold"
            style={{ fontSize: '14px', color: ifiColor }}
          >
            {topic.ifi.value.toFixed(1)}
          </span>
        )}

        {/* Contestation badge */}
        <span
          className="font-data uppercase"
          style={{
            fontSize: '7.5px',
            letterSpacing: '1px',
            color: contestColor,
            opacity: 0.8,
          }}
        >
          {topic.contestation_level}
        </span>

        {/* Sparkline — pushed to right */}
        <div className="ml-auto">
          <MiniSparkline data={topic.activity_sparkline} width={60} height={18} />
        </div>
      </div>

      {/* Row 3: Top signal — one-line preview */}
      {topic.key_signal && (
        <p
          className="truncate"
          style={{
            fontSize: '9px',
            color: 'rgba(148,163,184,0.5)',
            marginTop: '5px',
          }}
        >
          {topic.key_signal.summary}
        </p>
      )}

      {/* Row 4: Situation alert (conditional) */}
      {topic.top_situation && (
        <div
          className="flex items-center gap-2"
          style={{ marginTop: '5px' }}
        >
          <div
            style={{
              width: '14px',
              height: '2px',
              borderRadius: '1px',
              backgroundColor: topic.top_situation.severity === 'high' ? '#EF4444' : '#F59E0B',
              flexShrink: 0,
            }}
          />
          <span
            className="truncate"
            style={{
              fontSize: '8.5px',
              color: topic.top_situation.severity === 'high'
                ? 'rgba(239,68,68,0.7)'
                : 'rgba(245,158,11,0.7)',
            }}
          >
            {topic.top_situation.summary}
          </span>
        </div>
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
