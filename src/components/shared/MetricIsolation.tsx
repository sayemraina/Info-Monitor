import React from 'react';

interface MetricIsolationProps {
  metric: {
    label: string;
    value: React.ReactNode;
    sparkline?: number[];
    confidence_interval?: [number, number];
  };
  infoContent: {
    plain: string;
    technical: string;
    methodology: string;
    caveat?: string;
  };
  onBack: () => void;
}

export const MetricIsolation: React.FC<MetricIsolationProps> = ({ metric, infoContent, onBack }) => {
  return (
    <div className="flex flex-col h-full animate-fadeIn">
      <button 
        onClick={onBack}
        className="self-start text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold mb-6 flex items-center gap-1 transition-colors"
      >
        <span>←</span> Back to all metrics
      </button>

      <div className="flex-1 flex flex-col pt-4">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-cyan-400 font-bold uppercase text-[12px] tracking-widest">{metric.label}</h3>
        </div>

        <div className="text-4xl font-mono text-white mb-2">
          {metric.value}
        </div>

        {metric.confidence_interval && (
          <div className="text-[11px] font-mono text-slate-500 mb-6">
            95% CI: [{metric.confidence_interval[0]} - {metric.confidence_interval[1]}]
          </div>
        )}

        {metric.sparkline && (
          <div className="h-12 flex items-end gap-[1.5px] mb-8 pr-4">
            {metric.sparkline.map((val, idx) => (
              <div 
                key={idx}
                className="w-full bg-cyan-900/60 rounded-t-sm"
                style={{ height: `${Math.max(10, val)}%` }}
              />
            ))}
          </div>
        )}

        <div className="mt-4 pt-6 border-t border-[#1E3044]">
          <div className="text-slate-200 text-[14px] leading-relaxed mb-4 font-medium">
            {infoContent.plain}
          </div>
          
          <div className="text-slate-400 text-[13px] italic leading-relaxed mb-6">
            {infoContent.technical}
          </div>
          
          <div className="bg-[#131F30]/50 p-4 rounded border border-[#1E3044]">
            <div className="font-mono text-[11px] text-slate-500 leading-relaxed mb-1">
              METHODOLOGY
            </div>
            <div className="font-mono text-[11px] text-slate-400 leading-relaxed break-words">
              {infoContent.methodology}
            </div>
            {infoContent.caveat && (
              <div className="font-mono text-[11px] text-amber-500/80 leading-relaxed mt-4 flex items-start gap-1 p-2 bg-amber-950/20 rounded">
                <span className="text-[10px] mt-0.5">⚠️</span>
                <span>{infoContent.caveat}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
