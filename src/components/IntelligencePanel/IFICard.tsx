import React, { useEffect, useRef, useState } from 'react';
import type { InformationFluxIndex } from '../../types';
import { Card } from '../shared/Card';
import { InfoButton } from '../shared/InfoButton';
import { HoverTip } from '../shared/HoverTip';

interface IFICardProps {
  ifi: InformationFluxIndex;
  onOpenRadar?: () => void;
  radarValues?: { salienceShift: number; mutation: number; arousal: number; friction: number };
}

/** Radar sweep that fills its container — dormant by default, activates on hover */
function SweepCanvas({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const sizeRef = useRef({ w: 0, h: 0 })
  const angleRef = useRef(270)
  const sweepAlphaRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return
    const ctx = canvas.getContext('2d')!
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1

    function resize() {
      if (!canvas || !parent) return
      const rect = parent.getBoundingClientRect()
      sizeRef.current = { w: rect.width, h: rect.height }
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(parent)

    function toRad(deg: number) { return (deg * Math.PI) / 180 }

    function draw() {
      const { w, h } = sizeRef.current
      if (w === 0 || h === 0) { animRef.current = requestAnimationFrame(draw); return }

      const target = active ? 1 : 0
      sweepAlphaRef.current += (target - sweepAlphaRef.current) * 0.08

      ctx.clearRect(0, 0, w, h)

      const cx = w / 2
      const cy = h / 2 - 6  // nudge radar center up just enough to clear CTA
      const r = Math.min(w, h) / 2 - 12

      // Grid rings
      for (const frac of [0.45, 0.7, 1.0]) {
        ctx.beginPath()
        ctx.arc(cx, cy, r * frac, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(148,163,184,0.12)'
        ctx.lineWidth = 0.5
        ctx.stroke()
      }

      // Axis lines
      ctx.strokeStyle = 'rgba(148,163,184,0.10)'
      ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke()

      // Center dot
      ctx.beginPath()
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(148,163,184,0.2)'
      ctx.fill()

      // Sweep — only when active
      const alpha = sweepAlphaRef.current
      if (alpha > 0.01) {
        const sweepRad = toRad(angleRef.current)

        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(sweepRad) * r, cy + Math.sin(sweepRad) * r)
        ctx.strokeStyle = `rgba(34,197,94,${0.55 * alpha})`
        ctx.lineWidth = 1.5
        ctx.stroke()

        const trailLen = 45 * Math.PI / 180
        try {
          const grad = ctx.createConicGradient(sweepRad - trailLen, cx, cy)
          grad.addColorStop(0, 'rgba(34,197,94,0)')
          grad.addColorStop(1, `rgba(34,197,94,${0.06 * alpha})`)
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.arc(cx, cy, r, sweepRad - trailLen, sweepRad)
          ctx.closePath()
          ctx.fillStyle = grad
          ctx.fill()
        } catch {
          // fallback
        }

        angleRef.current = (angleRef.current + 1.5) % 360
      }

      // Only continue loop if active or still visibly fading out
      if (active || alpha > 0.005) {
        animRef.current = requestAnimationFrame(draw)
      } else {
        sweepAlphaRef.current = 0
      }
    }

    animRef.current = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(animRef.current)
      ro.disconnect()
    }
  }, [active])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
    />
  )
}

export const IFICard: React.FC<IFICardProps> = ({ ifi, onOpenRadar }) => {
  const [hovered, setHovered] = useState(false)

  const ifiInfo = {
    what: "Rate of structural change in this topic's narrative landscape.",
    soWhat: "High → topic is restructuring rapidly. Low → stable topology.",
    how: "√JSD between cluster-salience distributions. 0 = no change, 100 = complete restructuring.",
  };


  return (
    <Card
      title="Information Flux (IFI)"
      className="h-full overflow-hidden"
      titleInfo={<span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center' }}><InfoButton term="Information Flux Index" content={ifiInfo} wrapperClassName="relative inline-flex items-center [&>div]:w-3.5 [&>div]:h-3.5 [&>div]:text-[9px]" /></span>}
    >
      <div
        className="relative flex flex-col h-full cursor-pointer group"
        onClick={() => onOpenRadar?.()}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Sweep canvas — absolute, fills entire card body */}
        <div className="absolute inset-0">
          <SweepCanvas active={hovered} />
        </div>

        {/* Overlay content */}
        <div className="relative z-10 flex flex-col h-full">
          {/* IFI number top-left */}
          <div className="flex-shrink-0">
            <HoverTip text={`TREND: ${ifi.trend}\n${ifi.trend === 'increasing' ? "Narrative landscape is restructuring faster" : ifi.trend === 'decreasing' ? "Narrative landscape is settling down" : "Narrative landscape isn't changing much right now"}\n\nDIRECTION: ${ifi.flux_character}\n${ifi.flux_character === 'diversifying' ? 'New narrative threads emerging. More voices in the conversation.' : ifi.flux_character === 'consolidating' ? 'One narrative taking over. Fewer perspectives getting through.' : 'Dominant narratives are rotating but the overall landscape shape is stable.'}`}>
              <span className="text-3xl font-mono text-white group-hover:text-[#E94560] transition-colors cursor-help ml-1">
                {ifi.value.toFixed(1)}
              </span>
            </HoverTip>
          </div>

          {/* Spacer — but leave room for CTA */}
          <div className="flex-1" />

          {/* CTA at bottom */}
          <div className="flex-shrink-0 text-center pb-1">
            <span className="text-[9px] font-mono tracking-wider text-slate-600 group-hover:text-[#E94560] transition-colors">
              click to decompose →
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};
