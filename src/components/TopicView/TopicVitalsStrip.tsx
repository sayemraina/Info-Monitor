import type { TopicSummary, LandscapeData, EntryHint } from '../../types'
import { MiniSparkline } from '../Level0/MiniSparkline'
import { getContestationColor } from '../../utils/colors'
import { HoverTip } from '../shared/HoverTip'
import { useIsMobile } from '../../hooks/useIsMobile'

interface TopicVitalsStripProps {
  topic: TopicSummary
  landscape?: LandscapeData | null
  cascadeClasses?: Record<string, string>
  onTagClick?: (hint: EntryHint) => void
}

interface TagDef {
  label: string
  color: string
  hint: EntryHint
}

function buildTags(topic: TopicSummary, landscape?: LandscapeData | null): TagDef[] {
  const tags: TagDef[] = []

  if (topic.contestation_level === 'high') {
    tags.push({ label: 'CONTESTED', color: '#EF4444', hint: 'contestation' })
  }

  if (topic.headline_divergence.trend === 'increasing') {
    tags.push({ label: '↑ DIVERGING', color: '#F59E0B', hint: 'ifi' })
  }

  const advCount = landscape?.adversarial_pairs?.length ?? 0
  if (advCount > 0) {
    tags.push({ label: `${advCount} ADVERSARIAL`, color: '#06B6D4', hint: 'contestation' })
  }

  // Coordination check: look for coordination flags in situations
  const hasCoordination = landscape?.topic_metrics.situations.some(
    s => s.metric_basis.includes('coordination') || s.metric_basis.includes('sync')
  )
  if (hasCoordination) {
    tags.push({ label: 'COORDINATION ⚠', color: '#EF4444', hint: 'situation' })
  }

  // Arousal check
  const hasArousal = landscape?.topic_metrics.situations.some(
    s => s.metric_basis.includes('arousal')
  )
  if (hasArousal) {
    tags.push({ label: '↑ AROUSAL', color: '#F59E0B', hint: 'situation' })
  }

  // Influencer shaping
  const impact = topic.influencer_impact ?? landscape?.topic_metrics.influencer_impact
  if (impact && impact.seeded_cluster_count > 0) {
    tags.push({ label: '▶ SHAPER-DRIVEN', color: '#14B8A6', hint: 'youtube_cta' })
  }

  return tags
}

export function TopicVitalsStrip({ topic, landscape, cascadeClasses, onTagClick }: TopicVitalsStripProps) {
  const isMobile = useIsMobile()
  const ifiValue = topic.ifi?.value ?? 0
  const ifiColor = ifiValue > 30 ? '#EF4444' : ifiValue > 15 ? '#F59E0B' : '#22C55E'
  const ifiTrend = topic.ifi?.trend === 'increasing' ? '↑' : topic.ifi?.trend === 'decreasing' ? '↓' : '→'
  const contestColor = getContestationColor(topic.contestation_level)
  const diversityOrganic = (topic.top_accelerating_claim?.source_diversity ?? 0) > 0.5

  const tags = buildTags(topic, landscape)

  return (
    <div style={{
      backgroundColor: 'var(--color-surface-1)',
      borderBottom: '1px solid var(--color-border)',
    }}>
      {/* Mobile: topic name on its own full-width row */}
      {isMobile && (
        <div className="px-3 pt-1" style={{ lineHeight: '20px' }}>
          <span
            className="font-data"
            style={{ fontSize: '9px', color: 'var(--color-text-muted)', letterSpacing: '0.5px' }}
          >
            {topic.name.toUpperCase()}
          </span>
        </div>
      )}

      {/* Vitals row */}
      <div
        className="flex items-center gap-4 px-3"
        style={{ height: isMobile ? undefined : '28px', minHeight: '28px', flexWrap: isMobile ? 'wrap' : undefined }}
      >
        {/* IFI */}
        {topic.ifi && (
          <HoverTip text={`IFI ${ifiValue.toFixed(1)} — information flooding intensity. Higher = more narrative disruption.`}>
            <span
              data-vitals="ifi"
              className={`font-data font-bold ${cascadeClasses?.ifi ?? ''}`}
              style={{ fontSize: '13px', color: ifiColor }}
            >
              {ifiValue.toFixed(1)}<span style={{ fontSize: '10px', marginLeft: '2px' }}>{ifiTrend}</span>
            </span>
          </HoverTip>
        )}

        {/* Source diversity dot */}
        <HoverTip text={diversityOrganic
          ? 'Source diversity: organic — spread across many voices'
          : 'Source diversity: concentrated — few dominant sources'}>
          <span
            data-vitals="diversity"
            className={cascadeClasses?.diversity ?? ''}
            style={{
              width: '10px', height: '10px', borderRadius: '50%',
              backgroundColor: diversityOrganic ? '#22C55E' : '#EF4444',
              padding: '0', margin: '0',
              /* Invisible hover padding via outline + cursor */
              cursor: 'help',
              outline: '4px solid transparent',
            }}
          />
        </HoverTip>

        {/* Contestation */}
        <HoverTip text={`Contestation: ${topic.contestation_level} — how actively claims are being disputed across populations`}>
          <span
            data-vitals="contestation"
            className={`font-data uppercase ${cascadeClasses?.contestation ?? ''}`}
            style={{ fontSize: '7.5px', letterSpacing: '1px', color: contestColor, opacity: 0.9 }}
          >
            {topic.contestation_level}
          </span>
        </HoverTip>

        {/* Activity sparkline */}
        <HoverTip text="Activity trend — claim volume over recent analysis windows">
          <span
            data-vitals="sparkline"
            className={cascadeClasses?.sparkline ?? ''}
          >
            <MiniSparkline data={topic.activity_sparkline} width={60} height={16} />
          </span>
        </HoverTip>

        {/* Topic name — right side (desktop only) */}
        {!isMobile && (
          <span
            className="ml-auto font-data"
            style={{ fontSize: '9px', color: 'var(--color-text-muted)', letterSpacing: '0.5px' }}
          >
            {topic.name.toUpperCase()}
          </span>
        )}
      </div>

      {/* Narrative tags row */}
      {tags.length > 0 && (
        <div
          className={`flex items-center gap-2 px-3 ${isMobile ? 'mobile-scroll-fade' : ''}`}
          style={{
            height: isMobile ? '28px' : '24px',
            paddingBottom: '4px',
            ...(isMobile ? { overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}),
          }}
        >
          {tags.map(tag => (
            <button
              key={tag.label}
              data-vitals={tag.hint === 'youtube_cta' ? 'shaper' : undefined}
              className={`font-data cursor-pointer ${cascadeClasses?.[tag.hint === 'youtube_cta' ? 'shaper' : ''] ?? ''}`}
              onClick={() => onTagClick?.(tag.hint)}
              style={{
                fontSize: isMobile ? '9px' : '8px',
                letterSpacing: '0.8px',
                color: tag.color,
                background: `${tag.color}10`,
                border: `1px solid ${tag.color}30`,
                borderRadius: '3px',
                padding: isMobile ? '3px 8px' : '1px 6px',
                whiteSpace: 'nowrap',
                transition: 'all 150ms ease',
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                (e.target as HTMLElement).style.background = `${tag.color}20`
              }}
              onMouseLeave={e => {
                (e.target as HTMLElement).style.background = `${tag.color}10`
              }}
            >
              {tag.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
