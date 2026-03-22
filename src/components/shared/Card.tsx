import React from 'react';
import type { ReactNode } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';

interface CardProps {
  title: string;
  titleInfo?: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
  expandable?: boolean;
  onExpand?: () => void;
  className?: string;
  isExpanded?: boolean;
}

export const Card: React.FC<CardProps> = ({
  title,
  titleInfo,
  headerRight,
  children,
  expandable = false,
  onExpand,
  className = '',
  isExpanded = false
}) => {
  const isMobile = useIsMobile()
  return (
    <div
      className={`rounded-lg flex flex-col transition-all duration-200 ${expandable && !isExpanded ? 'cursor-pointer' : ''} ${className}`}
      style={{
        backgroundColor: 'var(--color-bg-panel)',
        border: `1px solid ${isExpanded ? 'rgba(239,68,68,0.5)' : 'var(--color-border)'}`,
        ...(expandable && !isExpanded ? {} : {}),
      }}
      onClick={expandable && !isExpanded ? onExpand : undefined}
    >
      <div className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-center">
          <h3
            className="font-sans text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: '#CBD5E1', borderLeft: '2.5px solid #06B6D4', paddingLeft: '8px' }}
          >
            {title}
          </h3>
          {titleInfo}
        </div>
        {headerRight && (
          <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
            {headerRight}
          </div>
        )}
      </div>
      
      <div className="p-3 flex-1 flex flex-col" onClick={(e) => isExpanded ? e.stopPropagation() : undefined}>
        {children}
      </div>

      {expandable && !isExpanded && (
        <div className="px-3 pb-1.5 pt-0 text-right">
          <button
            className={`${isMobile ? 'text-[12px] py-2 px-3' : 'text-[10px]'} text-slate-500 hover:text-cyan-400 transition-colors inline-block`}
            onClick={(e) => {
              e.stopPropagation();
              onExpand?.();
            }}
          >
            View details ›
          </button>
        </div>
      )}
    </div>
  );
};
