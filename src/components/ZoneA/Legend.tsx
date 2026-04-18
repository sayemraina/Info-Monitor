import React, { useState, useRef } from 'react';
import { getMomentumColor, getMutationColor } from '../../utils/colors';
import { InfoButton } from '../shared/InfoButton';
import { GLOSSARY } from '../../constants/glossary';
import { useIsMobile } from '../../hooks/useIsMobile';

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

/** The full legend content, used in both desktop panel and mobile modal */
function LegendContent() {
  return (
    <div className="flex gap-8" style={{ flexDirection: 'column' }}>
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
            label="Faded = Low Confidence"
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
              <svg width="16" height="8">
                <circle cx="2" cy="4" r="1.5" fill="rgba(148,163,184,0.6)" />
                <line x1="4" y1="4" x2="12" y2="4" stroke="rgba(148,163,184,0.3)" strokeWidth="0.8" strokeDasharray="2,1.5" />
                <circle cx="14" cy="4" r="1.5" fill="rgba(148,163,184,0.6)" />
              </svg>
            }
            label="Position = Similarity"
            infoTerm="Semantic Layout"
            infoContent={GLOSSARY.SemanticLayout}
          />
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
              <span className="text-[8px] font-mono leading-none px-0.5 rounded" style={{ color: '#F1F5F9', backgroundColor: 'rgba(148,163,184,0.15)', border: '1px solid rgba(148,163,184,0.25)' }}>
                Aa
              </span>
            }
            label="Cluster Labels"
            infoTerm="Cluster"
            infoContent={GLOSSARY.TopicContestation}
          />
          <Row
            icon={
              <span className="flex gap-0.5 text-[10px] font-mono leading-none">
                <span style={{ color: getMutationColor('mainstreaming') }}>↙</span>
                <span style={{ color: getMutationColor('radicalizing') }}>↗</span>
                <span style={{ color: getMutationColor('fragmenting') }}>⤢</span>
              </span>
            }
            label="Mutation"
            infoTerm="Mutation Direction"
            infoContent={GLOSSARY.Mutation}
          />
        </div>
      </div>
    </div>
  );
}

export const Legend: React.FC = () => {
  const isMobile = useIsMobile();
  const hoverRef = useRef(false);
  const [hovered, setHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (isMobile) {
    return (
      <>
        {/* Floating "?" button */}
        <button
          onClick={() => setMobileOpen(true)}
          className="absolute bottom-3 left-3 z-10 pointer-events-auto flex items-center justify-center"
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            backgroundColor: 'rgba(19,31,48,0.92)',
            border: '1px solid rgba(30,48,68,0.7)',
            color: '#94A3B8',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          ?
        </button>

        {/* Modal overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            onClick={() => setMobileOpen(false)}
          >
            <div
              className="rounded-xl backdrop-blur-md shadow-xl overflow-y-auto"
              style={{
                backgroundColor: 'rgba(19,31,48,0.96)',
                border: '1px solid rgba(30,48,68,0.7)',
                padding: '16px 20px 20px',
                maxHeight: '80vh',
                maxWidth: 'calc(100vw - 32px)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold">Legend</h3>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="text-slate-500 text-lg leading-none"
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  x
                </button>
              </div>
              <LegendContent />
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div
      className="absolute bottom-4 left-4 z-10 pointer-events-auto transition-opacity duration-300"
      style={{ opacity: hovered ? 1 : 0.18 }}
      onMouseEnter={() => { hoverRef.current = true; setHovered(true) }}
      onMouseLeave={() => { hoverRef.current = false; setHovered(false) }}
    >
      {/* Legend panel — always visible, dims when not hovered */}
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
                  label="Faded = Low Confidence"
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
                    <svg width="16" height="8">
                      <circle cx="2" cy="4" r="1.5" fill="rgba(148,163,184,0.6)" />
                      <line x1="4" y1="4" x2="12" y2="4" stroke="rgba(148,163,184,0.3)" strokeWidth="0.8" strokeDasharray="2,1.5" />
                      <circle cx="14" cy="4" r="1.5" fill="rgba(148,163,184,0.6)" />
                    </svg>
                  }
                  label="Position = Similarity"
                  infoTerm="Semantic Layout"
                  infoContent={GLOSSARY.SemanticLayout}
                />
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
                    <span className="text-[8px] font-mono leading-none px-0.5 rounded" style={{ color: '#F1F5F9', backgroundColor: 'rgba(148,163,184,0.15)', border: '1px solid rgba(148,163,184,0.25)' }}>
                      Aa
                    </span>
                  }
                  label="Cluster Labels"
                  infoTerm="Cluster"
                  infoContent={GLOSSARY.TopicContestation}
                />
                <Row
                  icon={
                    <span className="flex gap-0.5 text-[10px] font-mono leading-none">
                      <span style={{ color: getMutationColor('mainstreaming') }}>↙</span>
                      <span style={{ color: getMutationColor('radicalizing') }}>↗</span>
                      <span style={{ color: getMutationColor('fragmenting') }}>⤢</span>
                    </span>
                  }
                  label="Mutation"
                  infoTerm="Mutation Direction"
                  infoContent={GLOSSARY.Mutation}
                />
              </div>
            </div>
          </div>
      </div>
    </div>
  );
};
