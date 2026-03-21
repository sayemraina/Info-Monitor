import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useInfoButtonContext } from './InfoButtonContext';

interface InfoButtonProps {
  content: {
    what: string;
    soWhat: string;
    how: string;
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
      const tooltipWidth = 272;
      const tooltipHeight = 200;
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
        className={`w-4 h-4 rounded-full border border-slate-500 flex items-center justify-center text-[10px] font-bold text-slate-400 cursor-help transition-colors select-none normal-case tracking-normal ${pulseClass} ${isHovered ? 'border-cyan-500 text-cyan-500' : 'hover:border-cyan-500 hover:text-cyan-500'}`}
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
          className={`absolute z-[9999] w-[272px] rounded-xl animate-fadeIn${tooltipCoords.vertical === 'above' ? ' transform -translate-y-full' : ''}`}
          style={{
            left: `${tooltipCoords.x}px`,
            top: `${tooltipCoords.y}px`,
            backgroundColor: 'rgba(10,18,32,0.97)',
            border: '1px solid rgba(148,163,184,0.12)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          }}
          onMouseEnter={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
            setIsHovered(true);
            setShowTooltip(true);
          }}
          onMouseLeave={handleMouseLeave}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-3.5 py-2.5" style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
            <span
              className="text-[10px] font-bold uppercase tracking-[0.12em]"
              style={{ color: '#22D3EE' }}
            >
              ◈ {term}
            </span>
          </div>

          {/* What — definition */}
          <div className="px-3.5 py-2.5" style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
            <p className="text-[11px] font-medium leading-relaxed" style={{ color: '#F1F5F9' }}>
              {content.what}
            </p>
          </div>

          {/* So-what — interpretation */}
          <div className="px-3.5 py-2.5" style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
            <p className="text-[11px] leading-relaxed" style={{ color: '#94A3B8' }}>
              {content.soWhat}
            </p>
          </div>

          {/* How — computation */}
          <div className="px-3.5 py-2.5">
            <p className="text-[11px] leading-relaxed" style={{ color: '#64748B' }}>
              {content.how}
            </p>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
