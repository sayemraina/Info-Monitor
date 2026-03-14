import React from 'react';
import type { ReactNode } from 'react';

interface CardProps {
  title: string;
  headerRight?: ReactNode;
  children: ReactNode;
  expandable?: boolean;
  onExpand?: () => void;
  className?: string;
  isExpanded?: boolean;
}

export const Card: React.FC<CardProps> = ({ 
  title, 
  headerRight, 
  children, 
  expandable = false, 
  onExpand,
  className = '',
  isExpanded = false
}) => {
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
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <h3 className="font-sans text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          {title}
        </h3>
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
        <div className="px-3 pb-2 pt-1 text-right mt-auto">
          <button
            className="text-[11px] text-slate-500 hover:text-red-500 transition-colors inline-block"
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
