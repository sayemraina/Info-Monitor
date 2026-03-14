import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useInfoButtonContext } from './InfoButtonContext';

interface InfoButtonProps {
  content: {
    plain: string;
    technical: string;
    methodology: string;
    caveat?: string;
  };
  term: string;
  /** Optional className for the wrapper div (default includes ml-1.5) */
  wrapperClassName?: string;
}

export const InfoButton: React.FC<InfoButtonProps> = ({ content, term, wrapperClassName }) => {
  const { hasInteracted, markInteracted } = useInfoButtonContext();
  const [isHovered, setIsHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const isHoveredRef = useRef(false);
  const [tooltipCoords, setTooltipCoords] = useState<{ x: number, y: number, align: 'left' | 'right', vertical: 'above' | 'below' } | null>(null);

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const tooltipWidth = 296;
      const tooltipHeight = 340; // estimated max height
      const align = window.innerWidth - rect.right < tooltipWidth + 16 ? 'left' : 'right';
      const vertical = rect.top < tooltipHeight + 20 ? 'below' : 'above';
      setTooltipCoords({
        x: align === 'right'
          ? rect.left + window.scrollX
          : rect.right + window.scrollX - tooltipWidth,
        y: vertical === 'above'
          ? rect.top + window.scrollY - 10
          : rect.bottom + window.scrollY + 10,
        align,
        vertical,
      });
    }
  };

  const handleMouseEnter = () => {
    isHoveredRef.current = true;
    setIsHovered(true);
    markInteracted();
    updatePosition();
    timerRef.current = setTimeout(() => {
      if (buttonRef.current && isHoveredRef.current) {
        setShowTooltip(true);
      }
    }, 300);
  };

  const handleMouseLeave = () => {
    isHoveredRef.current = false;
    setIsHovered(false);
    setShowTooltip(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  useEffect(() => {
    let isMounted = true;
    
    const handleGlobalClick = () => {
      if (isMounted) setShowTooltip(false);
    };

    if (showTooltip) {
      window.addEventListener('scroll', updatePosition, { passive: true });
      window.addEventListener('resize', updatePosition, { passive: true });
      // Close on any global click to prevent tooltips sticking when modals/overlays appear
      window.addEventListener('mousedown', handleGlobalClick);
    }
    
    return () => {
      isMounted = false;
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('mousedown', handleGlobalClick);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [showTooltip]);

  const pulseClass = !hasInteracted ? 'animate-infoPulse' : '';

  return (
    <div className={wrapperClassName ?? 'relative inline-flex items-center ml-1.5'} onMouseLeave={handleMouseLeave}>
      <div 
        ref={buttonRef}
        className={`w-4 h-4 rounded-full border border-slate-500 flex items-center justify-center text-[10px] font-bold text-slate-400 cursor-help transition-colors select-none ${pulseClass} ${isHovered ? 'border-cyan-500 text-cyan-500' : 'hover:border-cyan-500 hover:text-cyan-500'}`}
        onMouseEnter={handleMouseEnter}
        onClick={(e) => {
          e.stopPropagation();
          markInteracted();
        }}
      >
        i
      </div>

      {showTooltip && tooltipCoords && createPortal(
        <div
          className={`absolute z-[9999] w-[296px] rounded-xl shadow-2xl${tooltipCoords.vertical === 'above' ? ' transform -translate-y-full' : ''}`}
          style={{
            left: `${tooltipCoords.x}px`,
            top: `${tooltipCoords.y}px`,
            backgroundColor: '#0B1220',
            border: '1px solid rgba(51, 65, 85, 0.8)',
            backdropFilter: 'blur(12px)',
          }}
          onMouseEnter={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
            setIsHovered(true);
            setShowTooltip(true);
          }}
          onMouseLeave={handleMouseLeave}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header bar */}
          <div className="px-4 pt-3.5 pb-3 border-b" style={{ borderColor: 'rgba(30,48,68,0.5)' }}>
            <span
              className="text-[10px] font-bold uppercase tracking-[0.12em]"
              style={{ color: '#22D3EE' }}
            >
              {term}
            </span>
          </div>

          {/* Plain language — the headline */}
          <div className="px-4 pt-5 pb-5 border-b" style={{ borderColor: 'rgba(30,48,68,0.5)' }}>
            <p className="text-[14px] font-medium leading-snug" style={{ color: '#F1F5F9' }}>
              {content.plain}
            </p>
          </div>

          {/* Technical description — subordinate */}
          <div className="px-4 pt-5 pb-5 border-b" style={{ borderColor: 'rgba(30,48,68,0.5)' }}>
            <p className="text-[12px] italic leading-relaxed" style={{ color: '#94A3B8' }}>
              {content.technical}
            </p>
          </div>

          {/* Methodology — geek-detail inset block */}
          <div className="px-4 pt-5 pb-5">
            <div
              className="rounded-lg px-3 py-3"
              style={{ backgroundColor: 'rgba(19,31,48,0.8)', border: '1px solid rgba(30,48,68,0.5)' }}
            >
              <div
                className="text-[9px] font-bold uppercase tracking-[0.1em] mb-2"
                style={{ color: '#475569' }}
              >
                Methodology
              </div>
              <p className="font-mono text-[10.5px] leading-relaxed" style={{ color: '#64748B' }}>
                {content.methodology}
              </p>
            </div>

            {content.caveat && (
              <div
                className="mt-3 flex items-start gap-2 rounded-lg px-3 py-2.5"
                style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
              >
                <span className="text-[11px] mt-px">⚠️</span>
                <p className="text-[11px] leading-snug" style={{ color: '#F59E0B' }}>
                  {content.caveat}
                </p>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
