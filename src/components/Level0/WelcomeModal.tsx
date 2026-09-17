import { useState, useEffect } from 'react'
import { useAIGuide } from '../../hooks/useAIGuide'
import { useIsMobile } from '../../hooks/useIsMobile'

const SEEN_KEY = 'infomonitor_welcome_seen'

interface WelcomeModalProps {
  /** Fired when the user chooses the guided walkthrough instead of entering cold. */
  onStartGuide: () => void
  /** Fired on plain entry. Used to suppress the dwell prompt they just declined. */
  onEnter: () => void
}

const WM_LINK = (
  <a
    href="https://www.worldmonitor.app"
    target="_blank"
    rel="noopener noreferrer"
    style={{ color: '#22D3EE', textDecoration: 'underline', textUnderlineOffset: '2px' }}
    onClick={e => e.stopPropagation()}
  >
    worldmonitor.app
  </a>
)

const SECTIONS: Array<{ label: string; body?: React.ReactNode; bullets?: string[] }> = [
  {
    label: 'What this is',
    body: (
      <>
        A feed shows you posts. This shows you the argument underneath them — every side being
        made, which one is winning, and whether it's winning on its own or being pushed by a
        few accounts.
      </>
    ),
  },
  {
    label: 'Who uses this kind of thing',
    body: (
      <>
        Newsrooms, think tanks and funds pay five figures a year for tools like this — Dataminr,
        Graphika, Blackbird.AI. This is the free, simpler version, the way {WM_LINK} did it for
        world events. Built entirely on public posts anyone can read.
      </>
    ),
  },
  {
    label: 'What you can do here',
    bullets: [
      'See every position on one map — size is reach, colour is what\u2019s accelerating, glow is heat',
      'Split the screen and compare two groups — which arguments exist in one and not the other',
      'Find out why they disagree: different facts, same facts framed differently, or incompatible worldviews',
      'Trace any claim backwards to where it first surfaced and how it changed on the way',
      'Watch an argument go mainstream, or get more extreme',
      'Check whether something spreads on its own or through a handful of accounts',
      'Catch claims that went quiet — active one day, silent the next',
      'Read the actual posts behind any of it',
    ],
  },
]

export function WelcomeModal({ onStartGuide, onEnter }: WelcomeModalProps) {
  const isMobile = useIsMobile()
  const { dismissPrompt } = useAIGuide()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem(SEEN_KEY)) return
    setVisible(true)
  }, [])

  const close = () => {
    sessionStorage.setItem(SEEN_KEY, 'true')
    setVisible(false)
  }

  const handleEnter = () => {
    close()
    // They just declined a walkthrough. Don't let the dwell prompt ask again.
    dismissPrompt()
    onEnter()
  }

  const handleGuide = () => {
    close()
    // Already entering a guided tour — don't let the dwell prompt offer one too.
    dismissPrompt()
    onStartGuide()
  }

  if (!visible) return null

  return (
    // Above the AI Guide stack (998 prompt / 999 shell / 1000 FAB) so nothing punches through.
    // No Escape or click-outside dismiss: entering is a deliberate choice, not an accident.
    <div className="fixed inset-0 z-[1100] flex items-center justify-center">
      {/* Softer than a standard scrim on purpose: the landscape should still read
          as a real instrument behind the glass, not a black screen. */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(3,5,8,0.55)', backdropFilter: 'blur(7px)' }}
      />
      {/* Radial vignette keeps contrast behind the panel without flattening the edges. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(3,5,8,0.72) 0%, rgba(3,5,8,0.45) 45%, rgba(3,5,8,0.15) 100%)',
        }}
      />

      <div
        className="relative animate-fade-in"
        style={{
          width: isMobile ? 'calc(100% - 32px)' : '560px',
          // Constrained on every viewport, not just mobile: the bullet list pushes
          // the panel to ~724px, which overflows a short laptop with no way to scroll.
          maxHeight: isMobile ? '88vh' : '90vh',
          overflowY: 'auto',
          backgroundColor: 'rgba(10,16,24,0.97)',
          border: '1px solid rgba(148,163,184,0.12)',
          borderRadius: '10px',
          padding: isMobile ? '22px 20px' : '28px 32px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <div
            className="font-data uppercase"
            style={{
              fontSize: '9px',
              letterSpacing: '1.4px',
              color: '#06B6D4',
              marginBottom: '8px',
            }}
          >
            ● Orientation
          </div>
          <h1
            className="font-data"
            style={{
              fontSize: isMobile ? '19px' : '23px',
              letterSpacing: '2px',
              color: '#F1F5F9',
              fontWeight: 600,
              marginBottom: '6px',
            }}
          >
            INFO MONITOR
          </h1>
          <p
            style={{
              fontSize: isMobile ? '12px' : '13px',
              color: '#94A3B8',
              lineHeight: 1.4,
            }}
          >
            See the shape of any argument, before it reaches you.
          </p>
        </div>

        <div style={{ height: '1px', background: 'rgba(148,163,184,0.1)', marginBottom: '18px' }} />

        {/* Body */}
        <div className="flex flex-col" style={{ gap: '15px' }}>
          {SECTIONS.map(s => (
            <div key={s.label}>
              <div
                className="font-data uppercase"
                style={{
                  fontSize: '8.5px',
                  letterSpacing: '1.1px',
                  color: '#64748B',
                  marginBottom: '5px',
                }}
              >
                {s.label}
              </div>
              {s.bullets ? (
                <ul
                  style={{
                    fontSize: isMobile ? '12px' : '12.5px',
                    lineHeight: 1.5,
                    color: '#CBD5E1',
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px',
                  }}
                >
                  {s.bullets.map(b => (
                    <li key={b} style={{ display: 'flex', gap: '8px' }}>
                      <span style={{ color: '#06B6D4', flexShrink: 0, lineHeight: 1.5 }}>›</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div
                  style={{
                    fontSize: isMobile ? '12.5px' : '13px',
                    lineHeight: 1.55,
                    color: '#CBD5E1',
                  }}
                >
                  {s.body}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div
          className={isMobile ? 'flex flex-col' : 'flex items-center'}
          style={{ gap: '10px', marginTop: '24px' }}
        >
          <button
            onClick={handleEnter}
            className="font-data uppercase"
            style={{
              flex: isMobile ? undefined : 1,
              padding: '11px 18px',
              background: '#06B6D4',
              border: 'none',
              borderRadius: '5px',
              color: '#06121A',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '1px',
              cursor: 'pointer',
              transition: 'background 180ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#22D3EE' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#06B6D4' }}
          >
            Enter the instrument
          </button>

          <button
            onClick={handleGuide}
            className="font-data uppercase"
            style={{
              flex: isMobile ? undefined : 1,
              padding: '11px 18px',
              background: 'transparent',
              border: '1px solid rgba(148,163,184,0.22)',
              borderRadius: '5px',
              color: '#94A3B8',
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '1px',
              cursor: 'pointer',
              transition: 'all 180ms',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(6,182,212,0.4)'
              e.currentTarget.style.color = '#CBD5E1'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(148,163,184,0.22)'
              e.currentTarget.style.color = '#94A3B8'
            }}
          >
            Guide me through it · 5 min
          </button>
        </div>
      </div>
    </div>
  )
}
