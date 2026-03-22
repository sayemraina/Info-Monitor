import { useState, useRef, useEffect } from 'react'
import { GLOSSARY } from '../../constants/glossary'
import { InfoButton } from '../shared/InfoButton'
import { useIsMobile } from '../../hooks/useIsMobile'

// ---------------------------------------------------------------------------
// Tier configuration — the full analytical framework
// ---------------------------------------------------------------------------

interface LensPair {
  label: string
  a: string
  b: string
}

interface LensEntry {
  id: string
  label: string
  available: boolean
  description: string
  pairs?: LensPair[]
}

interface TierConfig {
  name: string
  confidence: string
  lenses: LensEntry[]
}

const LENS_TIERS: TierConfig[] = [
  {
    name: 'Hard Anchors',
    confidence: 'directly observable · highest confidence',
    lenses: [
      {
        id: 'platform',
        label: 'Platform',
        available: true,
        description: "What each platform's structure allows to be said",
        pairs: [
          { label: 'X vs Reddit', a: 'x_platform', b: 'reddit_platform' },
          { label: 'X vs YouTube', a: 'x_platform', b: 'youtube_influencer' },
          { label: 'Reddit vs YouTube', a: 'reddit_platform', b: 'youtube_influencer' },
        ],
      },
      {
        id: 'geography',
        label: 'Geography',
        available: true,
        description: 'How claims cluster by region — same event, different salience by locale',
        pairs: [
          { label: 'Eg: Coastal vs Heartland', a: 'coastal_metros', b: 'heartland_metros' },
        ],
      },
      {
        id: 'language',
        label: 'Language',
        available: false,
        description: 'Structural framing differences across languages — translation shifts meaning',
      },
      {
        id: 'time',
        label: 'Time',
        available: false,
        description: "How the same population's narrative evolves across time windows",
      },
    ],
  },
  {
    name: 'Structural Proxies',
    confidence: 'derived · used with warnings',
    lenses: [
      {
        id: 'urban_rural',
        label: 'Urban/Rural',
        available: false,
        description: 'Derived from geography — proxy, not direct observation',
      },
      {
        id: 'media_market',
        label: 'Media Market',
        available: false,
        description: 'Regional media ecosystem influence on framing',
      },
    ],
  },
  {
    name: 'Behavioral',
    confidence: 'high value · partial data',
    lenses: [
      {
        id: 'engagement_style',
        label: 'Engagement Style',
        available: false,
        description: 'Broadcast accounts vs. reply-driven conversationalists — different claim production styles',
      },
      {
        id: 'visibility_tier',
        label: 'Visibility Tier',
        available: false,
        description: 'Viral content vs. long-tail — what spreads wide vs. what persists deep',
      },
    ],
  },
  {
    name: 'Identity-Correlated',
    confidence: 'labeled by behavior · never demographics',
    lenses: [
      {
        id: 'hashtag_affinity',
        label: 'Hashtag Affinity',
        available: false,
        description: 'e.g., #AIRegulation community vs #OpenSource community — labeled by the behavior that defines them, never by inferred demographic',
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// LensBar
// ---------------------------------------------------------------------------

interface LensBarProps {
  activePair: LensPair
  onSelectPair: (pair: LensPair) => void
}

// Abbreviated labels for inline pair toggles
const PAIR_ABBREV: Record<string, string> = {
  'X vs Reddit': 'X / Red',
  'X vs YouTube': 'X / YT',
  'Reddit vs YouTube': 'Red / YT',
  'Coastal vs Heartland': 'Coast / Heart',
}

// All available lenses with pairs
const ALL_AVAILABLE_LENSES = LENS_TIERS.flatMap(t => t.lenses).filter(l => l.available && l.pairs)

function findActiveLens(activePair: LensPair) {
  return ALL_AVAILABLE_LENSES.find(lens =>
    lens.pairs?.some(p => p.a === activePair.a && p.b === activePair.b)
  ) ?? ALL_AVAILABLE_LENSES[0]
}

export function LensBar({ activePair, onSelectPair }: LensBarProps) {
  const isMobile = useIsMobile()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (
        barRef.current && !barRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false)
      }
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  const handlePairSelect = (pair: LensPair) => {
    onSelectPair(pair)
    setDropdownOpen(false)
  }

  const handleInlinePairSelect = (pair: LensPair) => {
    onSelectPair(pair)
  }

  return (
    <>
      {/* Lens bar — 32px HUD strip */}
      <div
        ref={barRef}
        className="flex items-center px-3 shrink-0 relative"
        style={{
          height: '32px',
          backgroundColor: '#0F1923',
          borderBottom: '1px solid #1E3044',
          gap: '10px',
        }}
      >
        {/* Cyan accent bar */}
        <div
          className="shrink-0 rounded-sm"
          style={{ width: '2px', height: '14px', backgroundColor: 'rgba(34,211,238,0.35)' }}
        />

        {/* PLATFORM ▾ — dropdown trigger */}
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 shrink-0 cursor-pointer group"
          style={{
            padding: '4px 14px 4px 10px',
            borderRadius: '6px',
            color: dropdownOpen ? '#FFFFFF' : '#E2E8F0',
            background: dropdownOpen
              ? 'linear-gradient(180deg, rgba(6,182,212,0.25) 0%, rgba(6,182,212,0.12) 100%)'
              : 'linear-gradient(180deg, rgba(241,245,249,0.08) 0%, rgba(241,245,249,0.03) 100%)',
            border: `1px solid ${dropdownOpen ? 'rgba(6,182,212,0.6)' : 'rgba(241,245,249,0.1)'}`,
            boxShadow: dropdownOpen
              ? '0 1px 3px rgba(0,0,0,0.3), 0 0 12px rgba(6,182,212,0.1)'
              : '0 1px 2px rgba(0,0,0,0.2)',
            transition: 'all 180ms ease',
          }}
          onMouseEnter={e => {
            const b = e.currentTarget
            if (!dropdownOpen) {
              b.style.background = 'linear-gradient(180deg, rgba(241,245,249,0.12) 0%, rgba(241,245,249,0.05) 100%)'
              b.style.borderColor = 'rgba(6,182,212,0.4)'
              b.style.color = '#FFFFFF'
            }
          }}
          onMouseLeave={e => {
            const b = e.currentTarget
            if (!dropdownOpen) {
              b.style.background = 'linear-gradient(180deg, rgba(241,245,249,0.08) 0%, rgba(241,245,249,0.03) 100%)'
              b.style.borderColor = 'rgba(241,245,249,0.1)'
              b.style.color = '#E2E8F0'
            }
          }}
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">
            Analytical Lens
          </span>
          <span className="text-[7px]" style={{ opacity: 0.5 }}>
            {dropdownOpen ? '▲' : '▼'}
          </span>
        </button>

        {/* ⓘ — hover tooltip via InfoButton (hidden on mobile) */}
        {!isMobile && (
          <InfoButton
            term="Population Partitioning"
            content={GLOSSARY.PopulationPartitioning}
            wrapperClassName="relative inline-flex items-center shrink-0"
          />
        )}

        {/* Separator + active pair label (hidden on mobile — redundant with toggles) */}
        {!isMobile && (
          <>
            <span className="text-[11px] shrink-0 select-none" style={{ color: '#334155' }}>·</span>
            <span className="text-[11px] font-data shrink-0" style={{ color: '#CBD5E1' }}>
              {activePair.label}
            </span>
          </>
        )}

        <div className="flex-1" />

        {/* Inline pair toggles */}
        {findActiveLens(activePair)?.pairs && (
          <div
            className={`flex items-center gap-3 shrink-0 ${isMobile ? 'mobile-scroll-fade' : ''}`}
            style={isMobile ? { overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' } : undefined}
          >
            {findActiveLens(activePair)!.pairs!.map((pair) => {
              const isActive = pair.a === activePair.a && pair.b === activePair.b
              return (
                <button
                  key={pair.label}
                  onClick={() => handleInlinePairSelect(pair)}
                  className="text-[10px] font-data transition-colors relative"
                  style={{
                    color: isActive ? '#22D3EE' : '#475569',
                    cursor: 'pointer',
                    border: 'none',
                    background: 'none',
                    padding: '2px 0',
                  }}
                >
                  {PAIR_ABBREV[pair.label] ?? pair.label}
                  {/* Active indicator — subtle bottom accent */}
                  {isActive && (
                    <div
                      className="absolute bottom-0 left-0 right-0 rounded-full"
                      style={{ height: '1px', backgroundColor: 'rgba(34,211,238,0.5)' }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        )}

      </div>

      {/* Dropdown panel */}
      {dropdownOpen && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 z-50 mx-2 rounded-b-lg overflow-y-auto"
          style={{
            top: '32px',
            maxHeight: 'calc(100vh - 120px)',
            width: isMobile ? '100%' : undefined,
            backgroundColor: '#0F1923',
            border: '1px solid rgba(30,48,68,0.6)',
            borderTop: 'none',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          }}
        >
          {/* Header */}
          <div className="px-5 pt-4 pb-3">
            <h3
              className="text-[11px] font-bold uppercase tracking-[0.14em]"
              style={{ color: '#F1F5F9' }}
            >
              Analytical Lenses
            </h3>
          </div>

          {/* Tiers */}
          {LENS_TIERS.map((tier, tierIdx) => (
            <div key={tier.name} className={tierIdx > 0 ? 'mt-1' : ''}>
              {/* Tier header */}
              <div className="px-5 pt-3 pb-1.5">
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.1em]"
                    style={{ color: '#94A3B8' }}
                  >
                    {tier.name}
                  </span>
                  <span className="text-[9px] italic" style={{ color: '#475569' }}>
                    {tier.confidence}
                  </span>
                </div>
                <div
                  className="mt-1.5 h-px"
                  style={{ backgroundColor: 'rgba(30,48,68,0.4)' }}
                />
              </div>

              {/* Lens entries */}
              {tier.lenses.map((lens) => (
                <div
                  key={lens.id}
                  className="px-5 py-2"
                  style={{ opacity: lens.available ? 1 : 0.6 }}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="text-[11px] mt-px select-none"
                      style={{ color: lens.available ? '#22D3EE' : '#475569' }}
                    >
                      {lens.available ? '●' : '○'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span
                        className="text-[12px] font-medium"
                        style={{ color: lens.available ? '#F1F5F9' : '#64748B' }}
                      >
                        {lens.label}
                        {!lens.available && <span className="text-[9px] uppercase tracking-[0.1em] font-semibold" style={{ color: '#F1F5F9', marginLeft: 12 }}>(Coming Soon)</span>}
                      </span>
                      <p
                        className="text-[11px] leading-relaxed mt-0.5"
                        style={{ color: lens.available ? '#94A3B8' : '#475569' }}
                      >
                        {lens.description}
                      </p>

                      {/* Pair buttons for available lenses */}
                      {lens.available && lens.pairs && (
                        <div className="flex gap-1.5 mt-2">
                          {lens.pairs.map((pair) => {
                            const isActive = pair.a === activePair.a && pair.b === activePair.b
                            return (
                              <button
                                key={pair.label}
                                onClick={() => handlePairSelect(pair)}
                                className="text-[10px] px-2.5 py-1 rounded-md transition-colors"
                                style={{
                                  backgroundColor: isActive
                                    ? 'rgba(34,211,238,0.15)'
                                    : 'rgba(30,41,59,0.6)',
                                  color: isActive ? '#22D3EE' : '#94A3B8',
                                  border: `1px solid ${isActive ? 'rgba(34,211,238,0.3)' : 'rgba(30,48,68,0.5)'}`,
                                  cursor: 'pointer',
                                }}
                              >
                                {pair.label}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Bottom padding */}
          <div className="h-3" />
        </div>
      )}

    </>
  )
}
