import { useState } from 'react'
import { useYouTubeData } from '../../hooks/useYouTubeData'
import { InfoButton } from '../shared/InfoButton'
import { VideoCard } from './VideoCard'
import type { VideoMetadata } from '../../types'
import { useIsMobile } from '../../hooks/useIsMobile'

const YOUTUBE_METHODOLOGY = {
  what: 'Videos ranked by Narrative Framing Score — voices most likely to shape public thinking on this topic.',
  soWhat: 'Prioritizes audience impact over channel size. Diversified across institutional, commentator, and contrarian tiers.',
  how: 'NFS = view velocity (30%) + reach (22%) + framing language (18%) + debate provocation (12%) + authority (10%) + recency (8%). 100K-view minimum.',
}

interface YouTubeStripProps {
  activeTopic: string
  topicName: string
  onNavigateToLevel1: (topicId: string) => void
}

export function YouTubeStrip({ activeTopic, topicName, onNavigateToLevel1 }: YouTubeStripProps) {
  const isMobile = useIsMobile()
  const { videos } = useYouTubeData(activeTopic)
  const [playingVideo, setPlayingVideo] = useState<VideoMetadata | null>(null)
  const [endCapHovered, setEndCapHovered] = useState(false)

  return (
    <>
      {/* Section header */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: isMobile ? '5px 12px' : '5px 24px',
          background: 'rgba(12,18,28,0.6)',
          borderTop: '1px solid rgba(148,163,184,0.08)',
        }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: '#FF0000', fontSize: '9px' }}>▶</span>
          <span style={{ color: '#94A3B8', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' as const }}>
            Narrative Shapers
          </span>
          <InfoButton content={YOUTUBE_METHODOLOGY} term="Narrative Shapers" />
        </div>
        <span
          style={{
            fontSize: '9px',
            fontWeight: 500,
            color: 'rgba(241,245,249,0.75)',
            background: 'rgba(148,163,184,0.1)',
            border: '1px solid rgba(148,163,184,0.2)',
            borderRadius: '3px',
            padding: '2px 8px',
            letterSpacing: '0.3px',
          }}
        >
          {topicName}
        </span>
      </div>

      {/* Video strip — relative wrapper for absolute end-cap */}
      <div
        style={{
          position: 'relative',
          background: 'rgba(12,18,28,0.6)',
          borderBottom: '1px solid rgba(148,163,184,0.04)',
          height: '120px',
        }}
      >
        {/* Scrollable video cards */}
        <div
          className="flex items-center gap-3 overflow-x-auto"
          style={{
            padding: isMobile ? '8px 12px' : '8px 24px',
            paddingRight: isMobile ? '12px' : (videos.length > 0 ? '190px' : '24px'),
            height: '100%',
          }}
        >
          {videos.map(video => (
            <div key={video.video_id} onClick={() => setPlayingVideo(video)}>
              <VideoCard video={video} />
            </div>
          ))}
          {videos.length === 0 && (
            <span className="font-data" style={{ fontSize: '10px', color: 'rgba(148,163,184,0.3)' }}>
              No videos for this topic
            </span>
          )}
        </div>

        {/* End-cap CTA — absolute right, solid bg to prevent overlap (hidden on mobile) */}
        {videos.length > 0 && !isMobile && (
          <div
            className="flex flex-col items-center justify-center cursor-pointer"
            style={{
              position: 'absolute',
              right: '0',
              top: '0',
              bottom: '0',
              width: '190px',
              background: 'linear-gradient(to right, transparent 0%, rgba(12,18,28,0.98) 20%, rgba(12,18,28,1) 35%)',
              zIndex: 5,
            }}
          >
            <div
              className="flex flex-col items-center justify-center"
              style={{
                width: '160px',
                height: '90px',
                border: `1px solid ${endCapHovered ? 'rgba(6,182,212,0.5)' : 'rgba(6,182,212,0.25)'}`,
                borderRadius: '5px',
                background: endCapHovered ? 'rgba(6,182,212,0.1)' : 'rgba(6,182,212,0.04)',
                boxShadow: endCapHovered ? '0 0 14px rgba(6,182,212,0.14)' : 'none',
                transition: 'all 180ms ease',
                padding: '8px',
                gap: '4px',
                textAlign: 'center' as const,
              }}
              onClick={() => onNavigateToLevel1(activeTopic)}
              onMouseEnter={() => setEndCapHovered(true)}
              onMouseLeave={() => setEndCapHovered(false)}
            >
              <span style={{ fontSize: '9.5px', color: '#F1F5F9', fontWeight: 600, lineHeight: '1.4' }}>
                View full narrative<br />analysis / topology for
              </span>
              <span style={{
                fontSize: '10.5px',
                fontWeight: 700,
                color: endCapHovered ? '#22D3EE' : '#06B6D4',
                transition: 'color 150ms ease',
              }}>
                {topicName} →
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Video player modal */}
      {playingVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={() => setPlayingVideo(null)}
        >
          <div
            className="rounded-lg overflow-hidden"
            style={{ width: '640px', maxWidth: '90vw' }}
            onClick={e => e.stopPropagation()}
          >
            <iframe
              width="100%"
              height="360"
              src={`https://www.youtube.com/embed/${playingVideo.video_id}?autoplay=1`}
              title={playingVideo.title}
              allow="autoplay; encrypted-media"
              allowFullScreen
              style={{ border: 'none' }}
            />
            <div
              className="flex items-center justify-between"
              style={{
                padding: '10px 14px',
                background: '#0F1923',
                borderTop: '1px solid rgba(148,163,184,0.1)',
              }}
            >
              <span style={{ fontSize: '12px', color: '#F1F5F9' }}>
                {playingVideo.title}
              </span>
              <button
                onClick={() => { setPlayingVideo(null); onNavigateToLevel1(activeTopic) }}
                className="cursor-pointer"
                style={{
                  fontSize: '10px',
                  color: '#06B6D4',
                  background: 'none',
                  border: 'none',
                }}
              >
                View topic analysis →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
