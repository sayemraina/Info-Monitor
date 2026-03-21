import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { TopicSummary } from '../types'
import { AddTopicButton } from './shared/AddTopicButton'
import { APP_VERSION, GITHUB_URL, GITHUB_HANDLE } from '../constants/version'

function TitleWithTooltip() {
  const [showTip, setShowTip] = useState(false)
  const [tipPos, setTipPos] = useState({ top: 0, left: 0 })
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const showTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const titleRef = useRef<HTMLSpanElement>(null)

  const handleEnter = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    if (titleRef.current) {
      const rect = titleRef.current.getBoundingClientRect()
      setTipPos({ top: rect.bottom + 6, left: rect.left + rect.width / 2 })
    }
    setShowTip(true)
  }
  const handleLeave = () => {
    if (showTimer.current) clearTimeout(showTimer.current)
    hideTimer.current = setTimeout(() => setShowTip(false), 150)
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, calc(-50% + 2px))',
        display: 'flex',
        alignItems: 'baseline',
        gap: '8px',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        ref={titleRef}
        className="font-data"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        style={{
          fontSize: '13px',
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: '#F1F5F9',
          cursor: 'default',
        }}
      >
        INFO MONITOR — US
      </span>
      {showTip && createPortal(
        <div
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          style={{
            position: 'fixed',
            top: tipPos.top,
            left: tipPos.left,
            transform: 'translateX(-50%)',
            background: 'rgba(10,18,32,0.97)',
            border: '1px solid rgba(148,163,184,0.15)',
            borderRadius: '5px',
            padding: '5px 10px',
            fontSize: '9px',
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 500,
            letterSpacing: '0.04em',
            color: '#F1F5F9',
            whiteSpace: 'nowrap',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            zIndex: 9999,
          }}
        >
          World coverage coming soon
        </div>,
        document.body
      )}
    </div>
  )
}

interface HeaderProps {
  topics: TopicSummary[]
  selectedTopicId: string | null
  searchQuery: string
  onSearch: (query: string) => void
  onSelectTopic: (id: string) => void
  onGoToOverview: () => void
  onTopicAdded: (topicId: string) => void
  refetchTopics: () => void
}

function ExpandIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9,1 13,1 13,5" />
      <polyline points="5,13 1,13 1,9" />
      <polyline points="13,9 13,13 9,13" />
      <polyline points="1,5 1,1 5,1" />
    </svg>
  )
}

function CompressIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="10,4 13,1" />
      <polyline points="1,13 4,10" />
      <polyline points="4,1 1,4" />
      <polyline points="13,10 10,13" />
      <polyline points="10,1 10,4 13,4" />
      <polyline points="1,10 4,10 4,13" />
      <polyline points="1,4 4,4 4,1" />
      <polyline points="13,13 10,13 10,10" />
    </svg>
  )
}

export function Header({
  topics,
  selectedTopicId,
  searchQuery,
  onSearch,
  onSelectTopic,
  onGoToOverview,
  onTopicAdded,
  refetchTopics,
}: HeaderProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  return (
    <header
      style={{
        height: '42px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '0 14px 0 20px',
        backgroundColor: '#0F1923',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(148,163,184,0.18)',
        position: 'relative',
      }}
    >
      {/* Search bar — only shown in Level 1+, moved to map overlay in Level 0 */}
      {selectedTopicId && (
        <div className="relative" style={{ width: 300, flexShrink: 0 }}>
          <input
            type="text"
            placeholder="Search topics…"
            value={searchQuery}
            onChange={e => onSearch(e.target.value)}
            className="search-input w-full outline-none transition-all duration-200"
            style={{
              height: '32px',
              paddingLeft: '12px',
              paddingRight: '32px',
              fontSize: '12px',
              borderRadius: '10px',
              backgroundColor: 'rgba(148,163,184,0.04)',
              border: '1px solid rgba(148,163,184,0.06)',
              color: '#F1F5F9',
              caretColor: '#22D3EE',
            }}
          />
          <svg
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ width: '13px', height: '13px', color: 'rgba(148,163,184,0.25)' }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      )}

      {/* Topic tabs (shown in Level 1+) */}
      {selectedTopicId && (
        <nav style={{ display: 'flex', alignItems: 'center', gap: '4px', overflowX: 'auto' }}>
          <button
            onClick={onGoToOverview}
            className="cursor-pointer transition-colors"
            style={{
              padding: '4px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              whiteSpace: 'nowrap',
              color: 'var(--color-text-secondary)',
              backgroundColor: 'transparent',
              border: 'none',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--color-bg-panel-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            Overview
          </button>
          {topics.map(topic => (
            <button
              key={topic.id}
              onClick={() => onSelectTopic(topic.id)}
              className="cursor-pointer transition-colors"
              style={{
                padding: '4px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                whiteSpace: 'nowrap',
                backgroundColor: topic.id === selectedTopicId ? 'var(--color-bg-panel-hover)' : 'transparent',
                color: topic.id === selectedTopicId ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                border: 'none',
              }}
              onMouseEnter={e => {
                if (topic.id !== selectedTopicId) e.currentTarget.style.backgroundColor = 'var(--color-bg-panel-hover)'
              }}
              onMouseLeave={e => {
                if (topic.id !== selectedTopicId) e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              {topic.name}
            </button>
          ))}
        </nav>
      )}

      {/* System title — absolutely centered, Level 0 only */}
      {!selectedTopicId && (
        <TitleWithTooltip />
      )}

      {/* Right side — version + github + add topic */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '20px' }}>

        {/* Meta block: demo badge + version badge + github handle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingTop: '3px' }}>
          {/* Demo data indicator with live pulse dot */}
          <span
            className="font-data"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '10px',
              fontWeight: 500,
              letterSpacing: '0.08em',
              color: 'rgba(241,245,249,0.5)',
              border: '1px solid rgba(148,163,184,0.2)',
              borderRadius: '4px',
              padding: '2px 6px',
              lineHeight: 1,
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#22C55E',
                boxShadow: '0 0 4px rgba(34,197,94,0.6)',
                animation: 'pulse-dot 2s ease-in-out infinite',
              }}
            />
            USING MODELED DATA
          </span>
          <style>{`
            @keyframes pulse-dot {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.4; }
            }
          `}</style>

          {/* Version badge */}
          <span
            className="font-data"
            style={{
              fontSize: '10px',
              fontWeight: 500,
              letterSpacing: '0.08em',
              color: 'rgba(241,245,249,0.7)',
              border: '1px solid rgba(148,163,184,0.3)',
              borderRadius: '4px',
              padding: '2px 6px',
              lineHeight: 1,
            }}
          >
            {APP_VERSION}
          </span>

          {/* GitHub handle */}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-data transition-colors duration-200"
            style={{
              fontSize: '11px',
              letterSpacing: '0.04em',
              color: 'rgba(241,245,249,0.7)',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#F1F5F9' }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(241,245,249,0.7)' }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            {GITHUB_HANDLE}
          </a>

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: 'rgba(241,245,249,0.5)',
              display: 'flex',
              alignItems: 'center',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#F1F5F9' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(241,245,249,0.5)' }}
          >
            {isFullscreen ? <CompressIcon /> : <ExpandIcon />}
          </button>
        </div>

        {/* Add topic button */}
        <AddTopicButton onTopicAdded={onTopicAdded} refetchTopics={refetchTopics} />
      </div>
    </header>
  )
}
