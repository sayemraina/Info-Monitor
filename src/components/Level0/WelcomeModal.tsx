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

const SECTIONS: Array<{ label: string; lead?: React.ReactNode; bullets?: React.ReactNode[]; paras?: React.ReactNode[]; trailer?: React.ReactNode }> = [
  {
    label: 'What this is',
    lead: <>A self-updating narrative topology instrument. It:</>,
    bullets: [
      'Extracts structured claims from public discourse',
      'Maps them into a semantic topology of competing positions on any contested topic',
      'Measures how that topology differs across platforms, populations, and time',
    ],
  },
  {
    label: 'Why InfoMonitor?',
    paras: [
      'Every contested topic - immigration, AI regulation, vaccine policy, any subject where people disagree - has a structure. There are distinct positions, they cluster into narratives, different populations hold different distributions of those positions, and the distributions shift over time. That structure is the topology of the disagreement, and it is normally invisible.',
      'InfoMonitor makes it visible and measurable.',
    ],
  },
  {
    label: 'Who uses this kind of thing',
    paras: [
      'Newsrooms, think tanks, and government agencies buy tools like this - Dataminr, Graphika, Blackbird.AI - at enterprise prices.',
      'This is a free, stripped-down version of the same idea, built entirely on public posts anyone can read.',
      <>{WM_LINK} tracks what happens in the world. This tracks what people make of it.</>,
    ],
  },
  {
    label: 'What you can do here',
    bullets: [
      'Pick a topic and the whole argument appears as a map - every position, sized by how far it reaches, coloured by what\'s accelerating',
      'Split it in two to see where two groups have stopped sharing the same reality',
      'Find out why they split: different facts, the same facts framed differently, or incompatible worldviews',
      'Trace any claim backwards to where it first surfaced and what it turned into on the way',
      'Watch an argument go mainstream, or turn more extreme',
      'Check whether something is spreading on its own or through a handful of accounts',
      'Catch claims that went quiet - active one day, silent the next',
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
    // Already entering a guided tour - don't let the dwell prompt offer one too.
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
        style={{ backgroundColor: 'rgba(3,5,8,0.32)', backdropFilter: 'blur(6px)' }}
      />
      {/* Radial vignette keeps contrast behind the panel without flattening the edges. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(3,5,8,0.48) 0%, rgba(3,5,8,0.26) 45%, rgba(3,5,8,0.04) 100%)',
        }}
      />

      <div
        className="relative animate-fade-in"
        style={{
          width: isMobile ? 'calc(100% - 32px)' : '640px',
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
            The structure of every narrative - made visible, and measurable.
          </p>
        </div>

        <div style={{ height: '1px', background: 'rgba(148,163,184,0.1)', marginBottom: '18px' }} />

        {/* Body */}
        <div className="flex flex-col" style={{ gap: '19px' }}>
          {SECTIONS.map(s => (
            <div key={s.label}>
              <div
                className="font-data uppercase"
                style={{
                  fontSize: '10px',
                  letterSpacing: '1.1px',
                  color: '#F1F5F9',
                  fontWeight: 700,
                  marginBottom: '7px',
                }}
              >
                {s.label}
              </div>
              {s.lead && (
                <div
                  style={{
                    fontSize: isMobile ? '12.5px' : '13px',
                    lineHeight: 1.6,
                    color: '#64748B',
                    marginBottom: '7px',
                  }}
                >
                  {s.lead}
                </div>
              )}
              {s.paras && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '9px',
                    fontSize: isMobile ? '12.5px' : '13px',
                    lineHeight: 1.6,
                    color: '#64748B',
                  }}
                >
                  {s.paras.map((para, i) => <p key={i}>{para}</p>)}
                </div>
              )}
              {s.bullets && (
              <ul
                style={{
                  fontSize: isMobile ? '12.5px' : '13px',
                  lineHeight: 1.6,
                  color: '#64748B',
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '7px',
                }}
              >
                {s.bullets.map((b, i) => (
                  <li key={i} style={{ display: 'flex', gap: '9px' }}>
                    <span style={{ color: '#06B6D4', flexShrink: 0, lineHeight: 1.6 }}>›</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              )}
              {s.trailer && (
                <div
                  style={{
                    fontSize: isMobile ? '12.5px' : '13px',
                    lineHeight: 1.6,
                    color: '#64748B',
                    marginTop: '11px',
                  }}
                >
                  {s.trailer}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        {/* Sticky so the primary action is always reachable - the content can
            exceed 90vh and the CTAs were falling below the fold. */}
        <div
          className={isMobile ? 'flex flex-col' : 'flex items-center'}
          style={{
            gap: '10px',
            position: 'sticky',
            bottom: isMobile ? '-22px' : '-28px',
            marginTop: '20px',
            marginBottom: isMobile ? '-22px' : '-28px',
            paddingTop: '16px',
            paddingBottom: isMobile ? '22px' : '28px',
            background: 'linear-gradient(to top, rgba(10,16,24,0.99) 78%, rgba(10,16,24,0))',
          }}
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
