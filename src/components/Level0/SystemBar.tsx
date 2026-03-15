import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export function SystemBar() {
  const [time, setTime] = useState(new Date())
  const [showInfo, setShowInfo] = useState(false)
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 })
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const showTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const iconRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const utc = time.toISOString().slice(11, 19)

  const handleMouseEnter = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    showTimer.current = setTimeout(() => {
      if (iconRef.current) {
        const rect = iconRef.current.getBoundingClientRect()
        setPopupPos({ top: rect.bottom + 8, left: rect.left + rect.width / 2 })
      }
      setShowInfo(true)
    }, 300)
  }

  const handleMouseLeave = () => {
    if (showTimer.current) clearTimeout(showTimer.current)
    hideTimer.current = setTimeout(() => setShowInfo(false), 150)
  }

  return (
    <div
      className="flex-shrink-0 flex items-center justify-between font-data"
      style={{
        height: '22px',
        padding: '0 24px 0 24px',
        fontSize: '8.5px',
        color: 'rgba(148,163,184,0.45)',
        background: 'linear-gradient(to bottom, rgba(15,25,35,0.9), transparent)',
        borderBottom: '1px solid rgba(148,163,184,0.06)',
        letterSpacing: '0.5px',
        position: 'relative',
      }}
    >
      {/* Platform status — left */}
      <div className="flex items-center gap-4">
        <span>
          <span style={{ color: '#22C55E' }}>●</span> X: LIVE
        </span>
        <span>
          <span style={{ color: '#22C55E' }}>●</span> REDDIT: LIVE
        </span>
        <span>
          <span style={{ color: '#F59E0B' }}>●</span> YT: CACHED
        </span>
      </div>

      {/* System confidence — center */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          zIndex: 9999,
          overflow: 'visible',
        }}
      >
        <span>SYSTEM CONFIDENCE:</span>
        <span
          style={{
            color: '#22D3EE',
            fontSize: '9.5px',
            fontWeight: 600,
            border: '1px solid rgba(34,211,238,0.25)',
            borderRadius: '3px',
            padding: '1px 6px',
            lineHeight: 1,
          }}
        >
          0.87
        </span>

        {/* Info icon with hover popup */}
        <span
          ref={iconRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '13px',
            height: '13px',
            borderRadius: '50%',
            border: '1px solid rgba(148,163,184,0.3)',
            fontSize: '8px',
            color: 'rgba(148,163,184,0.5)',
            cursor: 'pointer',
            transition: 'all 200ms',
            ...(showInfo ? { color: '#22D3EE', borderColor: 'rgba(34,211,238,0.4)' } : {}),
          }}
        >
          i
        </span>

        {/* Downward info popup — portal to escape overflow:hidden parents */}
        {showInfo && createPortal(
          <div
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{
              position: 'fixed',
              top: popupPos.top,
              left: popupPos.left,
              transform: 'translateX(-50%)',
              background: 'rgba(10,18,32,0.97)',
              border: '1px solid rgba(148,163,184,0.15)',
              borderRadius: '8px',
              padding: '12px 14px',
              fontSize: '10px',
              lineHeight: '1.5',
              color: '#CBD5E1',
              width: '280px',
              zIndex: 9999,
              backdropFilter: 'blur(12px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              letterSpacing: '0.2px',
            }}
          >
            {/* Upward caret */}
            <div
              style={{
                position: 'absolute',
                top: '-5px',
                left: '50%',
                transform: 'translateX(-50%) rotate(45deg)',
                width: '8px',
                height: '8px',
                background: 'rgba(10,18,32,0.97)',
                borderTop: '1px solid rgba(148,163,184,0.15)',
                borderLeft: '1px solid rgba(148,163,184,0.15)',
              }}
            />

            <div style={{ fontWeight: 600, color: '#F1F5F9', marginBottom: '6px', fontSize: '11px' }}>
              System Confidence
            </div>

            <div style={{ marginBottom: '8px' }}>
              Weighted average of data freshness, extraction quality, and embedding coverage
              across all monitored topics. Higher values indicate more complete and recent data.
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '6px', borderTop: '1px solid rgba(148,163,184,0.1)' }}>
              <span style={{ color: 'rgba(148,163,184,0.5)' }}>Current:</span>
              <span style={{ color: '#22D3EE', fontWeight: 600, fontSize: '11px' }}>0.87</span>
              <span style={{ color: 'rgba(34,211,238,0.5)', fontSize: '9px' }}>HIGH</span>
            </div>
          </div>,
          document.body
        )}
      </div>

      {/* UTC clock — right */}
      <span style={{ color: 'rgba(241,245,249,0.7)' }}>
        {utc} UTC
      </span>
    </div>
  )
}
