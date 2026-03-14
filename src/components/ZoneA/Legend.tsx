import React, { useState, useEffect, useRef } from 'react';
import { getMomentumColor, getMutationColor } from '../../utils/colors';
import { InfoButton } from '../shared/InfoButton';
import { GLOSSARY } from '../../constants/glossary';

/** Single legend row: icon | label | ⓘ on one line, never wraps */
function Row({
  icon,
  label,
  infoTerm,
  infoContent,
}: {
  icon: React.ReactNode;
  label: string;
  infoTerm: string;
  infoContent: (typeof GLOSSARY)[keyof typeof GLOSSARY];
}) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <div className="w-4 shrink-0 flex items-center justify-center pointer-events-none">
        {icon}
      </div>
      <span className="text-[10px] text-slate-400 leading-none">{label}</span>
      <InfoButton term={infoTerm} content={infoContent} />
    </div>
  );
}

export const Legend: React.FC = () => {
  const [collapsed, setCollapsed] = useState(true);
  const hoverRef = useRef(false);
  const [hovered, setHovered] = useState(false);

  // Auto-collapse after 5s if not hovered
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hoverRef.current) setCollapsed(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="absolute bottom-4 left-4 z-10 pointer-events-auto transition-opacity duration-300"
      style={{ opacity: hovered ? 1 : 0.18 }}
      onMouseEnter={() => { hoverRef.current = true; setHovered(true) }}
      onMouseLeave={() => { hoverRef.current = false; setHovered(false) }}
    >
      {/* Collapse toggle pill — always visible to hint the legend exists */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg mb-1 text-[9px] font-semibold uppercase tracking-wider transition-colors cursor-pointer"
        style={{
          backgroundColor: 'rgba(19,31,48,0.85)',
          border: '1px solid rgba(30,48,68,0.6)',
          color: '#64748B',
        }}
      >
        <span>{collapsed ? '▸' : '▾'}</span>
        Map Guide
      </button>

      {/* Legend panel — hidden when collapsed */}
      {!collapsed && (
        <div
          className="rounded-xl backdrop-blur-md shadow-xl"
          style={{ backgroundColor: 'rgba(19,31,48,0.92)', border: '1px solid rgba(30,48,68,0.7)', padding: '10px 14px 12px' }}
        >
          <div className="flex gap-8">
            {/* NODES column */}
            <div>
              <h4 className="text-[9px] uppercase tracking-widest text-slate-500 mb-2 font-semibold">
                Nodes
              </h4>
              <div className="flex flex-col gap-2">
                <Row
                  icon={
                    <div className="flex gap-0.5 items-end h-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                    </div>
                  }
                  label="Size = Salience"
                  infoTerm="Salience"
                  infoContent={GLOSSARY.Salience}
                />
                <Row
                  icon={<div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getMomentumColor(0.8) }} />}
                  label="Color = Momentum"
                  infoTerm="Momentum"
                  infoContent={GLOSSARY.Momentum}
                />
                <Row
                  icon={
                    <div
                      className="w-2.5 h-2.5 rounded-full bg-slate-600"
                      style={{ boxShadow: '0 0 6px 1px rgba(239,68,68,0.8)' }}
                    />
                  }
                  label="Glow = Arousal"
                  infoTerm="Arousal"
                  infoContent={GLOSSARY.Arousal}
                />
                <Row
                  icon={<div className="w-2.5 h-2.5 rounded-full bg-slate-600 opacity-40" />}
                  label="Faded = Low Conf."
                  infoTerm="Confidence"
                  infoContent={GLOSSARY.Confidence}
                />
              </div>
            </div>

            {/* STRUCTURE column */}
            <div>
              <h4 className="text-[9px] uppercase tracking-widest text-slate-500 mb-2 font-semibold">
                Structure
              </h4>
              <div className="flex flex-col gap-2">
                <Row
                  icon={
                    <svg width="12" height="12">
                      <path
                        d="M1,6 Q4,1 9,3 T11,9 Q7,12 2,9 Z"
                        fill={getMutationColor('stable')}
                        fillOpacity="0.15"
                        stroke={getMutationColor('stable')}
                        strokeWidth="1"
                      />
                    </svg>
                  }
                  label="Hull = Cluster"
                  infoTerm="Topic Contestation"
                  infoContent={GLOSSARY.TopicContestation}
                />
                <Row
                  icon={
                    <span className="text-[11px] font-mono leading-none" style={{ color: getMutationColor('mainstreaming') }}>
                      ↙
                    </span>
                  }
                  label="Mainstreaming"
                  infoTerm="Mutation Direction"
                  infoContent={GLOSSARY.Mutation}
                />
                <Row
                  icon={
                    <span className="text-[11px] font-mono leading-none" style={{ color: getMutationColor('radicalizing') }}>
                      ↗
                    </span>
                  }
                  label="Radicalizing"
                  infoTerm="Mutation Direction"
                  infoContent={GLOSSARY.Mutation}
                />
                <Row
                  icon={
                    <div
                      className="w-3 border-t border-dashed opacity-80"
                      style={{ borderColor: '#EF4444' }}
                    />
                  }
                  label="Adversary Pair"
                  infoTerm="Counter-Narrative"
                  infoContent={GLOSSARY.CounterNarrative}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
