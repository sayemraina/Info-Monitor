import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '../../hooks/useIsMobile'

interface SystemBarProps {
  systemConfidence?: number
}

type SourceStatus = 'LIVE' | 'CACHED' | 'DELAYED'

interface SourceItem {
  name: string
  status: SourceStatus
  info?: string
}


interface SourceItemWithSubs extends SourceItem {
  subs?: string[]
}

interface SourceCategoryWithSubs {
  key: string
  label: string
  items: SourceItemWithSubs[]
}

const SOURCE_CATEGORIES: SourceCategoryWithSubs[] = [
  {
    key: 'social',
    label: 'SOCIAL PLATFORMS',
    items: [
      { name: 'X (Twitter)', status: 'LIVE' },
      { name: 'Bluesky', status: 'LIVE' },
      { name: 'YouTube', status: 'CACHED' },
    ],
  },
  {
    key: 'news',
    label: 'NEWS & MEDIA',
    items: [
      {
        name: 'RSS Feeds (52 outlets)',
        status: 'LIVE',
        subs: [
          'NYT', 'Washington Post', 'BBC', 'The Guardian', 'Reuters', 'AP News',
          'Fox News', 'Fox Business', 'NPR', 'CNBC', 'Bloomberg', 'The Economist',
          'Al Jazeera', 'NBC News', 'CBS News', 'ABC News', 'Sky News',
          'Politico', 'The Hill', 'Axios', 'Vox', 'The Intercept',
          'Breitbart', 'Daily Wire', 'Mother Jones', 'Reason', 'Jacobin',
          'Salon', 'National Review', 'Wall Street Journal', 'Forbes',
          'Business Insider', 'Fortune', 'TechCrunch', 'Wired', 'The Verge',
          'Ars Technica', 'ProPublica', 'PBS NewsHour', 'USA Today',
          'LA Times', 'Chicago Tribune', 'DW News', 'France24',
          'Daily Beast', 'HuffPost', 'Newsweek', 'The Nation',
          'Common Dreams', 'The Atlantic', 'STAT News', 'ScienceDaily',
        ],
      },
      { name: 'NewsAPI (30K+ publishers)', status: 'LIVE' },
    ],
  },
  {
    key: 'think-tanks',
    label: 'THINK TANKS & POLICY',
    items: [
      { name: 'Brookings', status: 'LIVE' },
      { name: 'Heritage Foundation', status: 'LIVE' },
      { name: 'Center for American Progress', status: 'LIVE' },
      { name: 'CSIS', status: 'LIVE' },
      { name: 'Council on Foreign Relations', status: 'LIVE' },
      { name: 'RAND Corporation', status: 'LIVE' },
      { name: 'Atlantic Council', status: 'LIVE' },
      { name: 'AEI', status: 'LIVE' },
      { name: 'Urban Institute', status: 'LIVE' },
      { name: 'Cato Institute', status: 'LIVE' },
      { name: 'Carnegie Endowment', status: 'LIVE' },
      { name: 'Hoover Institution', status: 'LIVE' },
      { name: 'Economic Policy Institute', status: 'LIVE' },
      { name: 'New America', status: 'LIVE' },
      { name: 'Bipartisan Policy Center', status: 'LIVE' },
      { name: 'Peterson Institute', status: 'LIVE' },
      { name: "Int'l Crisis Group", status: 'LIVE' },
    ],
  },
  {
    key: 'economic',
    label: 'ECONOMIC DATA',
    items: [
      { name: 'FRED (8 series)', status: 'CACHED' },
      { name: 'Yahoo Finance', status: 'LIVE' },
      { name: 'Polymarket', status: 'LIVE' },
    ],
  },
  {
    key: 'conflict',
    label: 'CONFLICT & EVENTS',
    items: [
      { name: 'GDELT', status: 'LIVE' },
      { name: 'ACLED', status: 'CACHED' },
    ],
  },
  {
    key: 'gov',
    label: 'GOVERNMENT',
    items: [
      { name: 'Congress.gov', status: 'CACHED' },
      { name: 'Federal Register', status: 'CACHED' },
      { name: 'SEC EDGAR', status: 'DELAYED' },
    ],
  },
  {
    key: 'digital',
    label: 'DIGITAL SIGNALS',
    items: [
      { name: 'Wikipedia (NOT a data source)', status: 'LIVE', info: 'We monitor edit activity on topic-specific articles.\n\nSudden edit wars (3+ reverts) or velocity spikes (10+ edits/24h) are strong inference signals that real-world narrative contestation is intensifying.' },
      { name: 'Cloudflare Radar', status: 'CACHED', info: 'Monitors country-level internet outages and disruptions via Cloudflare\'s global network.\n\nSudden outages in topic-relevant countries (e.g., Iran, Palestine) are strong signals of censorship events or crisis escalation that typically precede narrative shifts.' },
      { name: 'WorldPop', status: 'CACHED', info: 'Population density reference data used for normalization.\n\nConverts raw engagement volumes into per-capita rates, so a surge in a small metro carries appropriate weight versus baseline noise in a large city.' },
    ],
  },
]

const INGESTER_COUNT = SOURCE_CATEGORIES.reduce((sum, cat) => sum + cat.items.length, 0)
const INLINE_SOURCES = SOURCE_CATEGORIES[0].items // Social platforms shown inline
const NON_INLINE_COUNT = INGESTER_COUNT - INLINE_SOURCES.length

const dotColor = (s: SourceStatus) =>
  s === 'LIVE' ? '#22C55E' : s === 'CACHED' ? '#F59E0B' : '#94A3B8'

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
      style={{ transition: 'transform 150ms', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}
    >
      <polyline points="2,1 6,4 2,7" />
    </svg>
  )
}

export function SystemBar({ systemConfidence }: SystemBarProps) {
  const isMobile = useIsMobile()
  const [time, setTime] = useState(new Date())
  const [showInfo, setShowInfo] = useState(false)
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 })
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const showTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const iconRef = useRef<HTMLSpanElement>(null)

  // Sources popup state
  const [showSources, setShowSources] = useState(false)
  const [sourcesPos, setSourcesPos] = useState({ top: 0, left: 0 })
  const sourcesRef = useRef<HTMLSpanElement>(null)
  const sourcesHideTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const sourcesShowTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set())
  const [activeInfo, setActiveInfo] = useState<string | null>(null)
  const [infoPos, setInfoPos] = useState({ top: 0, left: 0 })
  const infoTimer = useRef<ReturnType<typeof setTimeout>>(null)

  const confidence = systemConfidence ?? 0.87
  const confidenceLabel = confidence >= 0.85 ? 'HIGH' : confidence >= 0.70 ? 'MODERATE' : 'LOW'
  const confidenceColor = confidence >= 0.85 ? '#22D3EE' : confidence >= 0.70 ? '#F59E0B' : '#EF4444'

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const et = time.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })

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

  const handleSourcesEnter = () => {
    if (sourcesHideTimer.current) clearTimeout(sourcesHideTimer.current)
    sourcesShowTimer.current = setTimeout(() => {
      if (sourcesRef.current) {
        const rect = sourcesRef.current.getBoundingClientRect()
        setSourcesPos({ top: rect.bottom + 8, left: rect.left + rect.width / 2 })
      }
      setShowSources(true)
    }, 300)
  }

  const handleSourcesLeave = () => {
    if (sourcesShowTimer.current) clearTimeout(sourcesShowTimer.current)
    sourcesHideTimer.current = setTimeout(() => {
      setShowSources(false)
      setExpandedCats(new Set())
      setExpandedSubs(new Set())
    }, 150)
  }

  const toggleCategory = (key: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const catAggregateStatus = (items: SourceItemWithSubs[]): SourceStatus => {
    if (items.every(i => i.status === 'LIVE')) return 'LIVE'
    if (items.some(i => i.status === 'DELAYED')) return 'DELAYED'
    return 'CACHED'
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
      {/* Data sources — left */}
      <div className="flex items-center gap-4">
        {INLINE_SOURCES.map(s => (
          <span key={s.name}>
            <span style={{ color: dotColor(s.status) }}>●</span>
            {!isMobile && ` ${s.name.replace(' (Twitter)', '')}: ${s.status}`}
          </span>
        ))}
        <span
          ref={sourcesRef}
          onMouseEnter={handleSourcesEnter}
          onMouseLeave={handleSourcesLeave}
          style={{
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            fontSize: '8px',
            color: showSources ? '#F1F5F9' : 'rgba(241,245,249,0.85)',
            fontWeight: 600,
            border: `1px solid ${showSources ? 'rgba(34,211,238,0.3)' : 'rgba(148,163,184,0.25)'}`,
            borderRadius: '3px',
            padding: '0px 5px',
            lineHeight: '14px',
            transition: 'all 200ms',
            letterSpacing: '0.3px',
          }}
        >
          +{NON_INLINE_COUNT} sources
        </span>
      </div>

      {/* Sources hover popup — portal */}
      {showSources && createPortal(
        <div
          onMouseEnter={handleSourcesEnter}
          onMouseLeave={handleSourcesLeave}
          style={{
            position: 'fixed',
            top: sourcesPos.top,
            left: Math.min(sourcesPos.left, window.innerWidth - 160),
            transform: 'translateX(-50%)',
            background: 'rgba(10,18,32,0.97)',
            border: '1px solid rgba(148,163,184,0.15)',
            borderRadius: '8px',
            padding: '10px 0',
            fontSize: '9px',
            lineHeight: '1.5',
            color: '#CBD5E1',
            width: '280px',
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: '70vh',
            overflowY: 'auto',
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

          <div style={{ fontWeight: 600, color: '#F1F5F9', marginBottom: '6px', fontSize: '10px', padding: '0 14px' }}>
            Data Sources ({INGESTER_COUNT})
          </div>

          {SOURCE_CATEGORIES.map(cat => {
            const isExpanded = expandedCats.has(cat.key)
            const aggStatus = catAggregateStatus(cat.items)
            const hasMultiple = cat.items.length > 1

            return (
              <div key={cat.key} style={{ borderTop: '1px solid rgba(148,163,184,0.06)' }}>
                {/* Category header */}
                <div
                  onClick={hasMultiple ? () => toggleCategory(cat.key) : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 14px',
                    cursor: hasMultiple ? 'pointer' : 'default',
                    transition: 'background 100ms',
                  }}
                  onMouseEnter={e => { if (hasMultiple) e.currentTarget.style.background = 'rgba(148,163,184,0.06)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  {hasMultiple && <ChevronIcon expanded={isExpanded} />}
                  <span style={{ color: 'rgba(148,163,184,0.5)', fontSize: '7.5px', fontWeight: 600, letterSpacing: '0.8px' }}>
                    {cat.label}
                  </span>
                  <span style={{ color: 'rgba(148,163,184,0.35)', fontSize: '7.5px', marginLeft: '2px' }}>
                    ({cat.items.length})
                  </span>
                  <span style={{ color: dotColor(aggStatus), fontSize: '7px', marginLeft: 'auto', fontWeight: 600 }}>
                    {aggStatus}
                  </span>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div style={{ padding: '0 14px 6px 14px', maxHeight: '240px', overflowY: 'auto' }}>
                      <div style={{ paddingLeft: hasMultiple ? '13px' : '0' }}>
                        {cat.items.map(item => (
                          <div key={item.name}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '1.5px 0', position: 'relative', cursor: item.subs ? 'pointer' : 'default' }}
                              onClick={item.subs ? () => setExpandedSubs(prev => { const next = new Set(prev); if (next.has(item.name)) next.delete(item.name); else next.add(item.name); return next }) : undefined}
                            >
                              {item.subs && <ChevronIcon expanded={expandedSubs.has(item.name)} />}
                              <span style={{ color: dotColor(item.status), fontSize: '5px' }}>●</span>
                              <span style={{ fontSize: '8.5px' }}>{item.name}</span>
                              {item.info && (
                                <span
                                  onMouseEnter={e => {
                                    if (infoTimer.current) clearTimeout(infoTimer.current)
                                    const rect = e.currentTarget.getBoundingClientRect()
                                    setInfoPos({ top: rect.bottom + 6, left: Math.min(rect.left, window.innerWidth - 260) })
                                    setActiveInfo(item.name)
                                  }}
                                  onMouseLeave={() => {
                                    infoTimer.current = setTimeout(() => setActiveInfo(null), 150)
                                  }}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    width: '12px', height: '12px', borderRadius: '50%',
                                    border: '1px solid rgba(34,211,238,0.5)', fontSize: '7.5px', fontWeight: 700,
                                    color: '#22D3EE', cursor: 'pointer', flexShrink: 0,
                                  }}
                                >i</span>
                              )}
                              <span style={{ color: dotColor(item.status), fontSize: '7px', marginLeft: 'auto', flexShrink: 0 }}>{item.status}</span>
                            </div>
                            {item.subs && expandedSubs.has(item.name) && (
                              <div style={{ paddingLeft: '21px', paddingBottom: '4px' }}>
                                {item.subs.map(sub => (
                                  <div key={sub} style={{ fontSize: '8px', color: 'rgba(148,163,184,0.6)', padding: '1px 0' }}>
                                    <span style={{ color: '#22C55E', fontSize: '4px', marginRight: '4px' }}>●</span>
                                    {sub}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>,
        document.body
      )}

      {/* Source info tooltip */}
      {activeInfo && (() => {
        const item = SOURCE_CATEGORIES.flatMap(c => c.items).find(i => i.name === activeInfo)
        if (!item?.info) return null
        return createPortal(
          <div
            onMouseEnter={() => { if (infoTimer.current) clearTimeout(infoTimer.current) }}
            onMouseLeave={() => { infoTimer.current = setTimeout(() => setActiveInfo(null), 150) }}
            style={{
              position: 'fixed',
              top: infoPos.top,
              left: infoPos.left,
              background: 'rgba(10,18,32,0.97)',
              border: '1px solid rgba(148,163,184,0.2)',
              borderRadius: '6px',
              padding: '8px 10px',
              fontSize: '9px',
              lineHeight: '1.5',
              color: '#CBD5E1',
              width: '240px',
              zIndex: 10000,
              backdropFilter: 'blur(12px)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{ fontWeight: 600, color: '#F1F5F9', marginBottom: '4px', fontSize: '9.5px' }}>
              {item.name}
            </div>
            {item.info.split('\n\n').map((para, i) => (
              <div key={i} style={{ marginTop: i > 0 ? '6px' : 0 }}>{para}</div>
            ))}
          </div>,
          document.body
        )
      })()}

      {/* System confidence — center (hidden on mobile) */}
      {!isMobile && <div
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
            color: confidenceColor,
            fontSize: '9.5px',
            fontWeight: 600,
            border: `1px solid ${confidenceColor}40`,
            borderRadius: '3px',
            padding: '1px 6px',
            lineHeight: 1,
          }}
        >
          {confidence.toFixed(2)}
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
            border: `1px solid ${confidenceColor}70`,
            fontSize: '8px',
            color: confidenceColor,
            cursor: 'pointer',
            transition: 'all 200ms',
            ...(showInfo ? { color: confidenceColor, borderColor: `${confidenceColor}66` } : {}),
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
              maxWidth: 'calc(100vw - 32px)',
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
              <span style={{ color: confidenceColor, fontWeight: 600, fontSize: '11px' }}>{confidence.toFixed(2)}</span>
              <span style={{ color: `${confidenceColor}80`, fontSize: '9px' }}>{confidenceLabel}</span>
            </div>
          </div>,
          document.body
        )}
      </div>}

      {/* ET clock — right */}
      <span style={{ color: 'rgba(241,245,249,0.7)' }}>
        {et} ET
      </span>
    </div>
  )
}
