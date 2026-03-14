import React, { useEffect } from 'react';
import type { ReactNode } from 'react';

interface ExpandedCardOverlayProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export const ExpandedCardOverlay: React.FC<ExpandedCardOverlayProps> = ({ title, onClose, children }) => {
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[#131F30]/60 backdrop-blur-[4px]" 
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-[640px] max-h-[85vh] flex flex-col rounded-lg shadow-2xl" style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <h2 className="text-[13px] font-semibold text-slate-300 uppercase tracking-widest">
            {title}
          </h2>
          <button 
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-white rounded transition-colors"
          >
            ✕
          </button>
        </div>
        
        {/* Scrollable Body - Needs visible overflow to allow absolute tooltips to bleed out if not using portals properly, but we want scroll. 
             If we use Portal, CSS transforms on parents (like animate-expandIn) trap fixed position children. 
             We remove the transform/animation or rewrite to allow native fixed. */}
        <div className="overflow-visible p-5 custom-scrollbar flex-1 relative">
          {children}
        </div>
        
      </div>
    </div>
  );
};
