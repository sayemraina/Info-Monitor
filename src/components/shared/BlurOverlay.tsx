import { useEffect, useCallback } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'

interface BlurOverlayProps {
  children: React.ReactNode
  onClose: () => void
}

/**
 * Full-screen blur backdrop for centered overlays (IFI radar, etc.)
 */
export function BlurOverlay({ children, onClose }: BlurOverlayProps) {
  const isMobile = useIsMobile();
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center ${isMobile ? 'flex-col' : ''}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Blur backdrop */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: 'rgba(3,5,8,0.75)',
          backdropFilter: 'blur(12px)',
        }}
      />

      {/* Content */}
      <div className={`relative z-10 ${isMobile ? 'w-full h-full flex items-center justify-center' : ''}`}>
        {children}
      </div>

      {/* Back button */}
      <button
        onClick={onClose}
        className={`absolute top-6 left-6 z-10 font-mono cursor-pointer hover:text-slate-300 transition-colors ${isMobile ? 'text-[13px] min-h-[36px] min-w-[36px] flex items-center' : 'text-[11px]'}`}
        style={{ color: '#64748B', background: 'none', border: 'none' }}
      >
        ← back
      </button>
    </div>
  )
}
