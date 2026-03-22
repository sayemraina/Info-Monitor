import { useEffect, useRef, useState } from 'react'
import { useDiscourseData } from '../../hooks/useDiscourseData'
import { useIsMobile } from '../../hooks/useIsMobile'
import type { DiscoursePost } from '../../types'

interface DiscourseFeedProps {
  activeTopic: string
  onNavigateToLevel1: (topicId: string) => void
}

// Simulated "time ago" for liveness
const TIME_LABELS = [
  'just now', '1 min ago', '2 min ago', '3 min ago', '5 min ago',
  '8 min ago', '12 min ago', '15 min ago', '20 min ago', '25 min ago',
]

function DiscourseCard({ post, index, isMobile }: { post: DiscoursePost; index: number; isMobile: boolean }) {
  const platformIcon = post.platform === 'x' ? '𝕏' : '💬'
  const timeLabel = TIME_LABELS[index % TIME_LABELS.length]

  // Severity color from system tags
  const hasFire = post.system_tags.some(t => t.includes('arousal: high'))
  const hasWarning = post.system_tags.some(t => t.includes('coordination') || t.includes('near-duplicate'))
  const borderColor = hasFire ? 'rgba(239,68,68,0.5)'
    : hasWarning ? 'rgba(245,158,11,0.5)'
    : 'rgba(6,182,212,0.3)'

  return (
    <div
      className="flex-shrink-0 rounded-md"
      style={{
        width: isMobile ? '250px' : '290px',
        padding: '8px 10px',
        background: 'rgba(255,255,255,0.015)',
        borderLeft: `2px solid ${borderColor}`,
        cursor: 'pointer',
      }}
    >
      {/* Header: platform + username + time */}
      <div className="flex items-center gap-2 font-data" style={{ marginBottom: '4px' }}>
        <span style={{ fontSize: '11px' }}>{platformIcon}</span>
        <span style={{ fontSize: '8px', color: 'rgba(148,163,184,0.5)' }}>
          {post.platform === 'x' ? '@' : ''}{post.username}
        </span>
        <span style={{ fontSize: '8px', color: 'rgba(148,163,184,0.35)', marginLeft: 'auto' }}>
          {timeLabel}
        </span>
      </div>

      {/* Post text */}
      <p
        className="line-clamp-2"
        style={{
          fontSize: '10px',
          color: 'rgba(241,245,249,0.75)',
          lineHeight: '1.4',
          marginBottom: '4px',
        }}
      >
        {post.text}
      </p>

      {/* System tags */}
      <div className="flex items-center gap-2 flex-wrap">
        {post.system_tags.slice(0, 2).map((tag, i) => (
          <span
            key={i}
            className="font-data"
            style={{
              fontSize: '7.5px',
              color: tag.includes('🔥') ? 'rgba(239,68,68,0.7)'
                : tag.includes('⚠') ? 'rgba(245,158,11,0.7)'
                : tag.includes('📈') ? 'rgba(6,182,212,0.7)'
                : 'rgba(6,182,212,0.5)',
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

export function DiscourseFeed({ activeTopic, onNavigateToLevel1 }: DiscourseFeedProps) {
  const isMobile = useIsMobile()
  const { posts } = useDiscourseData(activeTopic)
  const scrollRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number>(0)
  const [fadeKey, setFadeKey] = useState(0)

  useEffect(() => {
    setFadeKey(k => k + 1)
  }, [activeTopic])

  // Continuous scroll animation R→L
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    let scrollPos = 0
    const speed = 0.5 // px per frame

    const tick = () => {
      scrollPos += speed
      if (scrollPos >= el.scrollWidth / 2) {
        scrollPos = 0
      }
      el.scrollLeft = scrollPos
      animRef.current = requestAnimationFrame(tick)
    }

    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [posts])

  // Duplicate posts for seamless loop
  const displayPosts = [...posts, ...posts]

  return (
    <div
      style={{
        background: 'rgba(10,16,24,0.6)',
        borderTop: '1px solid rgba(148,163,184,0.04)',
        height: '100px',
        overflow: 'hidden',
      }}
    >
      <div
        ref={scrollRef}
        key={fadeKey}
        className="flex items-center gap-3 h-full animate-fade-in"
        style={{
          padding: isMobile ? '0 12px' : '0 24px',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        {displayPosts.map((post, i) => (
          <div key={`${post.username}-${i}`} onClick={() => onNavigateToLevel1(activeTopic)}>
            <DiscourseCard post={post} index={i} isMobile={isMobile} />
          </div>
        ))}
      </div>
    </div>
  )
}
