import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface HoverTipProps {
  text: string
  children: React.ReactNode
  /** Use for block-level text rows so truncation (overflow:hidden) still works */
  block?: boolean
  /** Show instantly on hover (no delay). Default: 250ms delay */
  instant?: boolean
}

const TIP_MAX_W = 220
const EDGE_PAD = 8

export function HoverTip({ text, children, block, instant }: HoverTipProps) {
  const [show, setShow] = useState(false)
  const [, setHinting] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, flipBelow: false })
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const showTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const wrapRef = useRef<HTMLSpanElement>(null)

  const handleEnter = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setHinting(true)
    showTimer.current = setTimeout(() => {
      if (wrapRef.current) {
        const rect = wrapRef.current.getBoundingClientRect()
        const flipBelow = rect.top < 60

        // Center horizontally on the element, then clamp to viewport
        let left = rect.left + rect.width / 2 - TIP_MAX_W / 2
        if (left < EDGE_PAD) left = EDGE_PAD
        if (left + TIP_MAX_W > window.innerWidth - EDGE_PAD) {
          left = window.innerWidth - EDGE_PAD - TIP_MAX_W
        }

        setPos({
          top: flipBelow ? rect.bottom + 8 : rect.top - 8,
          left,
          flipBelow,
        })
      }
      setShow(true)
    }, instant ? 0 : 250)
  }, [instant])

  const handleLeave = useCallback(() => {
    if (showTimer.current) clearTimeout(showTimer.current)
    setHinting(false)
    hideTimer.current = setTimeout(() => setShow(false), 150)
  }, [])

  return (
    <span
      ref={wrapRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={block
        ? { display: 'block', width: '100%', overflow: 'hidden', cursor: 'help' }
        : { display: 'inline-flex', cursor: 'help' }
      }
    >
      {children}
      {show && createPortal(
        <div
          onMouseEnter={() => { if (hideTimer.current) clearTimeout(hideTimer.current) }}
          onMouseLeave={handleLeave}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            transform: pos.flipBelow ? undefined : 'translateY(-100%)',
            background: 'rgba(10,18,32,0.97)',
            border: '1px solid rgba(148,163,184,0.15)',
            borderRadius: '5px',
            padding: '5px 10px',
            fontSize: '9px',
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 500,
            letterSpacing: '0.04em',
            color: '#F1F5F9',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            zIndex: 9999,
            maxWidth: `${TIP_MAX_W}px`,
            whiteSpace: 'pre-line',
            lineHeight: 1.4,
            pointerEvents: 'auto',
          }}
        >
          {text}
        </div>,
        document.body
      )}
    </span>
  )
}
