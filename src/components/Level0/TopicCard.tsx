import { useState } from 'react'
import type { TopicSummary } from '../../types'
import { MiniSparkline } from './MiniSparkline'
import { getContestationColor, getTrendColor } from '../../utils/colors'
import { createPortal } from 'react-dom'

interface TopicCardProps {
  topic: TopicSummary
  onSelect: (id: string) => void
}

const CONTESTATION_BORDER: Record<string, string> = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#22C55E',
}

export function TopicCard({ topic, onSelect }: TopicCardProps) {
  const contestColor = getContestationColor(topic.contestation_level)
  const accentColor = CONTESTATION_BORDER[topic.contestation_level] ?? '#94A3B8'

  const [mousePos, setMousePos] = useState<{ x: number, y: number } | null>(null)

  return (
    <button
      onClick={() => onSelect(topic.id)}
      className="text-left rounded-lg p-4 w-full transition-all cursor-pointer relative overflow-hidden"
      style={{
        backgroundColor: '#141B2D',
        border: '1px solid #2D3748',
        borderLeft: `3px solid ${accentColor}`,
      }}
      onMouseMove={e => {
        if (mousePos) {
          setMousePos({ x: e.clientX, y: e.clientY })
        }
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = `#2D3748`
        e.currentTarget.style.borderLeftColor = accentColor
        e.currentTarget.style.backgroundColor = '#1A2240'
        e.currentTarget.style.boxShadow = `0 0 20px rgba(6, 182, 212, 0.08), inset 0 0 0 1px rgba(6,182,212,0.1)`
        setMousePos({ x: e.clientX, y: e.clientY })
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = '#141B2D'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.borderColor = '#2D3748'
        e.currentTarget.style.borderLeftColor = accentColor
        setMousePos(null)
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold tracking-wide" style={{ color: '#F1F5F9' }}>
          {topic.name}
        </h3>
        <div className="flex items-center gap-2">
          <span
            className="font-data text-xs px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: `${contestColor}18`,
              color: contestColor,
              border: `1px solid ${contestColor}30`,
            }}
          >
            {topic.cluster_count} clusters
          </span>
        </div>
      </div>

      <div className="space-y-2 text-xs">
        {/* Divergence row */}
        <div className="flex items-center gap-2">
          <span style={{ color: '#64748B' }}>Divergence</span>
          <span className="font-data font-semibold" style={{ color: '#F1F5F9' }}>
            {topic.headline_divergence.jsd.toFixed(2)}
          </span>
          <span style={{ color: '#64748B' }}>—</span>
          <span style={{ color: '#94A3B8' }}>
            {topic.headline_divergence.dominant_typology}
          </span>
          <span style={{ color: getTrendColor(topic.headline_divergence.trend), fontSize: 11 }}>
            {topic.headline_divergence.trend === 'increasing' ? '↑' :
              topic.headline_divergence.trend === 'decreasing' ? '↓' : '→'}
          </span>
        </div>

        {/* Top accelerating claim */}
        <div className="leading-relaxed" style={{ color: '#64748B' }}>
          Top accelerating:{' '}
          <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>
            "{topic.top_accelerating_claim.text.length > 80 ? topic.top_accelerating_claim.text.slice(0, 80) + '...' : topic.top_accelerating_claim.text}"
          </span>
        </div>

        {/* Sparkline + key signal */}
        <div className="flex items-center justify-between pt-1">
          <MiniSparkline data={topic.activity_sparkline} width={80} height={22} />
          {topic.key_signal && (
            <span
              className="text-[11px] px-2 py-1 rounded truncate ml-3"
              style={{
                backgroundColor: 'rgba(245,158,11,0.08)',
                color: '#F59E0B',
                border: '1px solid rgba(245,158,11,0.2)',
                maxWidth: '65%',
              }}
            >
              {topic.key_signal.summary.length > 65 ? topic.key_signal.summary.slice(0, 65) + '…' : topic.key_signal.summary}
            </span>
          )}
        </div>
      </div>

      {mousePos && createPortal(
        <div
          className="fixed z-50 pointer-events-none rounded-lg text-xs"
          style={{
            left: Math.min(mousePos.x + 14, window.innerWidth - 300),
            top: Math.min(mousePos.y + 14, window.innerHeight - 100),
            width: 280,
            backgroundColor: '#0F1929',
            border: '1px solid #2D3748',
            boxShadow: '0 8px 32px rgba(0,0,0,0.75)',
            padding: '10px 12px',
          }}
        >
          <div className="font-semibold mb-1.5" style={{ color: '#F1F5F9', fontSize: 11 }}>
            {topic.name}
          </div>
          <div className="space-y-1">
            <div>
              <span style={{ color: '#64748B' }}>Contestation: </span>
              <span style={{ color: '#94A3B8' }}>{topic.contestation_level} · {topic.cluster_count} clusters</span>
            </div>
            <div>
              <span style={{ color: '#64748B' }}>Divergence: </span>
              <span style={{ color: '#94A3B8' }}>{topic.headline_divergence.jsd.toFixed(2)} ({topic.headline_divergence.dominant_typology})</span>
            </div>
            {topic.key_signal && (
              <div className="mt-2 text-[11px]" style={{ color: '#F1F5F9' }}>
                {topic.key_signal.summary}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </button>
  )
}
