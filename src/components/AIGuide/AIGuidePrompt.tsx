import { useAIGuide } from '../../hooks/useAIGuide'

export function AIGuidePrompt() {
  const { promptVisible, dismissPrompt, acceptPrompt } = useAIGuide()

  console.log('[AIGuidePrompt] Render - promptVisible:', promptVisible)

  if (!promptVisible) return null

  return (
    <div
      className="fixed z-[998] animate-fade-in"
      style={{
        bottom: '96px', // 24px (base) + 56px (button height) + 16px (gap)
        right: '24px',
        maxWidth: '320px',
      }}
    >
      {/* Bubble container */}
      <div
        style={{
          backgroundColor: '#0F1923',
          border: '1px solid rgba(148,163,184,0.06)',
          borderRadius: '8px',
          padding: '16px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header with pulsing indicator */}
        <div className="flex items-center gap-2" style={{ marginBottom: '12px' }}>
          <div
            className="animate-pulse"
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#06B6D4',
              boxShadow: '0 0 8px rgba(6,182,212,0.6)',
            }}
          />
          <span
            className="font-mono uppercase"
            style={{
              fontSize: '9px',
              color: '#06B6D4',
              letterSpacing: '0.05em',
              fontWeight: 600,
            }}
          >
            Narrative Intelligence
          </span>
        </div>

        {/* Message */}
        <p
          style={{
            fontSize: '11px',
            color: '#CBD5E1',
            lineHeight: '1.5',
            marginBottom: '12px',
          }}
        >
          I can help you navigate this landscape. Want me to walk you through what's happening here?
        </p>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={acceptPrompt}
            className="font-mono uppercase flex-1"
            style={{
              fontSize: '9px',
              padding: '8px',
              background: '#06B6D4',
              border: 'none',
              borderRadius: '4px',
              color: '#0F1923',
              cursor: 'pointer',
              transition: 'all 200ms ease',
              letterSpacing: '0.05em',
              fontWeight: 600,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(6,182,212,0.9)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#06B6D4'
            }}
          >
            Yes, guide me
          </button>
          <button
            onClick={dismissPrompt}
            className="font-mono uppercase"
            style={{
              fontSize: '9px',
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(148,163,184,0.15)',
              borderRadius: '4px',
              color: '#94A3B8',
              cursor: 'pointer',
              transition: 'all 200ms ease',
              letterSpacing: '0.05em',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              e.currentTarget.style.color = '#CBD5E1'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
              e.currentTarget.style.color = '#94A3B8'
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
