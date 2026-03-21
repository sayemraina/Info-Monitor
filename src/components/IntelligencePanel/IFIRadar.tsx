/**
 * IFI Radar — submarine-style sweep animation decomposing IFI into 4 driving forces.
 * Green sweep line rotates clockwise → detects each axis with red flash → polygon reveals.
 * HTML overlay provides InfoButton tooltips for each axis.
 */

import { useEffect, useRef, useState } from 'react'
import { InfoButton } from '../shared/InfoButton'

interface IFIRadarProps {
  salienceShift: number   // 0–1
  mutation: number        // 0–1
  arousal: number         // 0–1
  friction: number        // 0–1
  ifiValue: number        // raw IFI score for display
  trend?: 'increasing' | 'stable' | 'decreasing'
  fluxCharacter?: 'diversifying' | 'consolidating' | 'reshuffling'
}

const AXES = [
  { label: 'Salience Shift', angle: 270 },  // top
  { label: 'Mutation', angle: 0 },          // right
  { label: 'Arousal', angle: 90 },          // bottom
  { label: 'Friction', angle: 180 },        // left
]

const AXIS_INFO = [
  {
    what: "How much claims are redistributing in prominence across clusters.",
    soWhat: "High → narrative dominance is shifting rapidly. Low → stable attention distribution.",
    how: "Derived from IFI score (√JSD of cluster salience distributions). Normalized: IFI 60+ maps to 1.0.",
  },
  {
    what: "How actively narratives are evolving — mainstreaming, radicalizing, or fragmenting.",
    soWhat: "High → narratives are mutating fast, reshaping the landscape. Low → stable framing.",
    how: "Weighted average of per-cluster mutation magnitude, weighted by cluster member count.",
  },
  {
    what: "Emotional temperature across the narrative landscape — outrage, fear, urgency.",
    soWhat: "High → discourse is heating up, accelerating structural change. Low → clinical tone.",
    how: "Peak cluster arousal value, boosted 20% if any cluster trend is warming. Clamped to 1.0.",
  },
  {
    what: "How much active resistance and pushback narratives are encountering.",
    soWhat: "High → claims colliding, driving restructuring. Low → narratives advancing unopposed.",
    how: "Top-friction claim's friction score (oppositional engagement ratio). Falls back to contestation level.",
  },
]

export function IFIRadar({ salienceShift, mutation, arousal, friction, ifiValue, trend, fluxCharacter }: IFIRadarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const [complete, setComplete] = useState(false)
  const size = 300
  const cx = size / 2
  const cy = size / 2
  const maxR = 105

  const values = [salienceShift, mutation, arousal, friction]

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    let currentAngle = 270
    const sweepSpeed = 3
    const detected: boolean[] = [false, false, false, false]
    const flashFrames: number[] = [0, 0, 0, 0]
    const flashDuration = 15
    const pauseFrames: number[] = [0, 0, 0, 0]
    const pauseDuration = 8
    let allDetected = false
    let polygonAlpha = 0
    let frameCount = 0

    function normalizeAngle(a: number): number {
      return ((a % 360) + 360) % 360
    }

    function angleDiff(a: number, b: number): number {
      const d = normalizeAngle(a - b)
      return d > 180 ? 360 - d : d
    }

    function toRad(deg: number): number {
      return (deg * Math.PI) / 180
    }

    function getPointXY(i: number): { x: number; y: number } {
      const angle = toRad(AXES[i].angle)
      const r = values[i] * maxR
      return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r }
    }

    function draw() {
      ctx.clearRect(0, 0, size, size)

      // Background circle — system panel color
      ctx.beginPath()
      ctx.arc(cx, cy, maxR + 16, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(15,25,35,0.95)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(148,163,184,0.06)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Grid rings — system border color
      for (const r of [0.25, 0.5, 0.75, 1.0]) {
        ctx.beginPath()
        ctx.arc(cx, cy, maxR * r, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(148,163,184,0.06)'
        ctx.lineWidth = 0.5
        ctx.stroke()
      }

      // Axis lines — system border color
      for (let i = 0; i < 4; i++) {
        const angle = toRad(AXES[i].angle)
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(angle) * maxR, cy + Math.sin(angle) * maxR)
        ctx.strokeStyle = 'rgba(148,163,184,0.06)'
        ctx.lineWidth = 0.5
        ctx.stroke()
      }

      // Sweep line
      const anyFlashing = flashFrames.some(f => f > 0)
      const anyPausing = pauseFrames.some(f => f > 0)

      if (!allDetected || anyFlashing) {
        const sweepRad = toRad(currentAngle)
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(sweepRad) * maxR, cy + Math.sin(sweepRad) * maxR)

        if (anyFlashing) {
          const flashIdx = flashFrames.findIndex(f => f > 0)
          const intensity = flashIdx >= 0 ? flashFrames[flashIdx] / flashDuration : 0
          ctx.strokeStyle = `rgba(233,69,96,${0.3 + 0.5 * intensity})`
          ctx.lineWidth = 3
        } else {
          ctx.strokeStyle = 'rgba(34,197,94,0.5)'
          ctx.lineWidth = 1.5
        }
        ctx.stroke()

        // Sweep trail
        if (!anyFlashing && !anyPausing) {
          const trailLen = 30 * Math.PI / 180
          try {
            const grad = ctx.createConicGradient(sweepRad - trailLen, cx, cy)
            grad.addColorStop(0, 'rgba(34,197,94,0)')
            grad.addColorStop(1, 'rgba(34,197,94,0.06)')
            ctx.beginPath()
            ctx.moveTo(cx, cy)
            ctx.arc(cx, cy, maxR, sweepRad - trailLen, sweepRad)
            ctx.closePath()
            ctx.fillStyle = grad
            ctx.fill()
          } catch {
            // createConicGradient fallback
          }
        }
      }

      // Data points
      for (let i = 0; i < 4; i++) {
        const pt = getPointXY(i)

        if (detected[i]) {
          // Glow
          const glow = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 18)
          glow.addColorStop(0, 'rgba(233,69,96,0.3)')
          glow.addColorStop(1, 'rgba(233,69,96,0)')
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, 18, 0, Math.PI * 2)
          ctx.fillStyle = glow
          ctx.fill()

          // Point
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2)
          ctx.fillStyle = '#E94560'
          ctx.fill()
          ctx.strokeStyle = 'rgba(233,69,96,0.5)'
          ctx.lineWidth = 1.5
          ctx.stroke()

          // Value label
          ctx.fillStyle = '#F1F5F9'
          ctx.font = '10px "JetBrains Mono", monospace'
          const angle = AXES[i].angle
          if (angle === 270) {
            ctx.textAlign = 'center'
            ctx.fillText(values[i].toFixed(2), pt.x, pt.y - 10)
          } else if (angle === 90) {
            ctx.textAlign = 'center'
            ctx.fillText(values[i].toFixed(2), pt.x, pt.y + 16)
          } else if (angle === 0) {
            ctx.textAlign = 'left'
            ctx.fillText(values[i].toFixed(2), pt.x + 10, pt.y + 4)
          } else {
            ctx.textAlign = 'right'
            ctx.fillText(values[i].toFixed(2), pt.x - 10, pt.y + 4)
          }
        } else {
          // Dim waiting point
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(148,163,184,0.1)'
          ctx.fill()
        }
      }

      // Data polygon
      if (allDetected) {
        polygonAlpha = Math.min(1, polygonAlpha + 0.03)
        const pts = [0, 1, 2, 3].map(i => getPointXY(i))
        ctx.beginPath()
        ctx.moveTo(pts[0].x, pts[0].y)
        for (let j = 1; j < 4; j++) ctx.lineTo(pts[j].x, pts[j].y)
        ctx.closePath()
        ctx.fillStyle = `rgba(233,69,96,${0.1 * polygonAlpha})`
        ctx.fill()
        ctx.strokeStyle = `rgba(233,69,96,${polygonAlpha * 0.7})`
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // Center label
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = allDetected ? 'rgba(71,85,105,0.5)' : 'rgba(71,85,105,0.2)'
      ctx.font = '9px "JetBrains Mono", monospace'
      ctx.fillText('IFI', cx, cy)

      ctx.beginPath()
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(148,163,184,0.2)'
      ctx.fill()

      // Advance state
      for (let i = 0; i < 4; i++) {
        if (flashFrames[i] > 0) flashFrames[i]--
        if (pauseFrames[i] > 0) pauseFrames[i]--
      }

      const stillFlashing = flashFrames.some(f => f > 0)
      const stillPausing = pauseFrames.some(f => f > 0)
      if (!allDetected && !stillFlashing && !stillPausing) {
        currentAngle = normalizeAngle(currentAngle + sweepSpeed)

        for (let i = 0; i < 4; i++) {
          if (!detected[i] && angleDiff(currentAngle, AXES[i].angle) < 10) {
            detected[i] = true
            flashFrames[i] = flashDuration
            pauseFrames[i] = pauseDuration + flashDuration

            if (detected.every(d => d)) {
              allDetected = true
              setComplete(true)
            }
          }
        }
      }

      if (!allDetected || stillFlashing || stillPausing || polygonAlpha < 1) {
        frameCount++
        if (frameCount < 600) {
          animRef.current = requestAnimationFrame(draw)
        }
      }
    }

    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [salienceShift, mutation, arousal, friction])

  // Wrapper is larger than canvas to hold labels outside the circle
  const wrapperSize = size + 80 // 40px padding each side for labels
  const canvasOffset = 40 // canvas starts 40px from wrapper edge

  return (
    <div className="flex flex-col items-center gap-1">
      {/* IFI value header — system typography */}
      <div className="text-center">
        <div className="text-[11px] font-sans tracking-[0.15em] uppercase mb-1" style={{ color: '#94A3B8' }}>
          IFI Decomposition
        </div>
        <div
          className="font-mono font-bold"
          style={{
            fontSize: 42,
            lineHeight: 1,
            color: '#E94560',
            textShadow: '0 0 30px rgba(233,69,96,0.25), 0 0 60px rgba(233,69,96,0.08)',
          }}
        >
          {ifiValue.toFixed(1)}
        </div>
        {/* Plain-english summary combining trend + flux character */}
        {(trend || fluxCharacter) && (() => {
          const trendPart = trend === 'increasing' ? 'Restructuring faster'
            : trend === 'decreasing' ? 'Settling down'
            : 'Holding steady';
          const fluxPart = fluxCharacter === 'diversifying' ? 'new narrative threads emerging'
            : fluxCharacter === 'consolidating' ? 'fewer perspectives getting through'
            : 'dominant narratives rotating';
          const color = trend === 'increasing' ? '#F59E0B'
            : trend === 'decreasing' ? '#06B6D4'
            : '#94A3B8';
          return (
            <div className="mt-3 text-center">
              <span className="text-[11px] font-mono tracking-wide" style={{ color }}>
                {trendPart} — {fluxPart}
              </span>
            </div>
          );
        })()}
      </div>

      {/* Radar canvas with labels positioned outside circle */}
      <div className="relative" style={{ width: wrapperSize, height: wrapperSize }}>
        <canvas
          ref={canvasRef}
          style={{
            width: size,
            height: size,
            position: 'absolute',
            top: canvasOffset,
            left: canvasOffset,
          }}
        />

        {/* TOP: Salience Shift — centered above circle */}
        <div
          className="absolute flex items-center gap-1"
          style={{
            top: canvasOffset - 24,
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'auto',
          }}
        >
          <span
            className="text-[9px] font-mono tracking-wider uppercase"
            style={{ color: complete ? '#CBD5E1' : 'rgba(148,163,184,0.4)' }}
          >
            {AXES[0].label}
          </span>
          <InfoButton term={AXES[0].label} content={AXIS_INFO[0]} wrapperClassName="relative inline-flex items-center [&>div]:w-3 [&>div]:h-3 [&>div]:text-[8px]" />
        </div>

        {/* RIGHT: Mutation — vertically centered, right of circle */}
        <div
          className="absolute flex items-center gap-1"
          style={{
            top: '50%',
            left: canvasOffset + size + 12,
            transform: 'translateY(-50%)',
            pointerEvents: 'auto',
          }}
        >
          <span
            className="text-[9px] font-mono tracking-wider uppercase"
            style={{ color: complete ? '#CBD5E1' : 'rgba(148,163,184,0.4)' }}
          >
            {AXES[1].label}
          </span>
          <InfoButton term={AXES[1].label} content={AXIS_INFO[1]} wrapperClassName="relative inline-flex items-center [&>div]:w-3 [&>div]:h-3 [&>div]:text-[8px]" />
        </div>

        {/* BOTTOM: Arousal — centered below circle */}
        <div
          className="absolute flex items-center gap-1"
          style={{
            bottom: canvasOffset - 24,
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'auto',
          }}
        >
          <span
            className="text-[9px] font-mono tracking-wider uppercase"
            style={{ color: complete ? '#CBD5E1' : 'rgba(148,163,184,0.4)' }}
          >
            {AXES[2].label}
          </span>
          <InfoButton term={AXES[2].label} content={AXIS_INFO[2]} wrapperClassName="relative inline-flex items-center [&>div]:w-3 [&>div]:h-3 [&>div]:text-[8px]" />
        </div>

        {/* LEFT: Friction — vertically centered, left of circle, right-aligned */}
        <div
          className="absolute flex items-center gap-1"
          style={{
            top: '50%',
            right: wrapperSize - canvasOffset + 12,
            transform: 'translateY(-50%)',
            pointerEvents: 'auto',
          }}
        >
          <InfoButton term={AXES[3].label} content={AXIS_INFO[3]} wrapperClassName="relative inline-flex items-center [&>div]:w-3 [&>div]:h-3 [&>div]:text-[8px]" />
          <span
            className="text-[9px] font-mono tracking-wider uppercase"
            style={{ color: complete ? '#CBD5E1' : 'rgba(148,163,184,0.4)' }}
          >
            {AXES[3].label}
          </span>
        </div>
      </div>

      {/* Completion message */}
      {complete && (
        <div
          className="text-[9px] font-mono tracking-widest uppercase animate-fadeIn"
          style={{ color: 'rgba(233,69,96,0.5)' }}
        >
          decomposition complete
        </div>
      )}
    </div>
  )
}
