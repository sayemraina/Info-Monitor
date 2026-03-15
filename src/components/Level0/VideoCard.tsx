import type { VideoMetadata } from '../../types'

function formatViews(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M views`
  if (count >= 1_000) return `${(count / 1_000).toFixed(0)}K views`
  return `${count} views`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days > 30) return `${Math.floor(days / 30)}mo`
  if (days > 0) return `${days}d`
  const hours = Math.floor(diff / 3600000)
  if (hours > 0) return `${hours}h`
  return 'now'
}

export function VideoCard({ video }: { video: VideoMetadata }) {
  const thumbUrl = `https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`

  return (
    <div
      className="flex-shrink-0 cursor-pointer rounded-md overflow-hidden"
      style={{
        width: '200px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(148,163,184,0.04)',
        transition: 'border-color 200ms ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(148,163,184,0.15)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(148,163,184,0.04)')}
    >
      {/* Thumbnail */}
      <div className="relative" style={{ width: '200px', height: '70px', overflow: 'hidden' }}>
        <img
          src={thumbUrl}
          alt={video.title}
          className="w-full h-full object-cover"
          style={{ borderRadius: '4px 4px 0 0' }}
          onError={e => {
            (e.target as HTMLImageElement).style.display = 'none'
          }}
        />
        {/* Play button overlay */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.25)' }}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: 'white', fontSize: '10px', marginLeft: '2px' }}>▶</span>
          </div>
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '6px 8px' }}>
        <p
          className="line-clamp-2"
          style={{
            fontSize: '10px',
            color: 'rgba(241,245,249,0.8)',
            lineHeight: '1.3',
            marginBottom: '3px',
          }}
        >
          {video.title}
        </p>
        <p className="font-data" style={{ fontSize: '8px', color: 'rgba(148,163,184,0.5)' }}>
          {video.channel_name} · {formatViews(video.view_count)} · {timeAgo(video.published_at)}
        </p>
      </div>
    </div>
  )
}
