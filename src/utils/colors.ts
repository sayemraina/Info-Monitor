/**
 * Color system matching end-state §4.1.
 * All functions return valid CSS color strings.
 */

// Momentum: 5-stop gradient
// < -0.5: #3B82F6 (blue, rapid deceleration)
// -0.5 to -0.1: #14B8A6 (teal, moderate deceleration)
// -0.1 to 0.1: #94A3B8 (silver, stable)
// 0.1 to 0.5: #F59E0B (amber, moderate acceleration)
// > 0.5: #EF4444 (red, rapid acceleration)
export function getMomentumColor(momentum: number): string {
  if (momentum < -0.5) return '#3B82F6'
  if (momentum < -0.1) return '#14B8A6'
  if (momentum < 0.1) return '#94A3B8'
  if (momentum < 0.5) return '#F59E0B'
  return '#EF4444'
}

// Arousal glow: intensity maps to glow radius
export function getArousalGlow(arousal: number): { boxShadow: string; opacity: number } {
  const radius = Math.round(arousal * 15)
  const alpha = 0.3 + arousal * 0.5
  return {
    boxShadow: radius > 0
      ? `0 0 ${radius}px rgba(245, 158, 11, ${alpha})`
      : 'none',
    opacity: 0.6 + arousal * 0.4,
  }
}

// For SVG filter glow
export function getArousalGlowFilter(arousal: number, color: string): string {
  const radius = Math.round(arousal * 8)
  if (radius <= 0) return 'none'
  return `drop-shadow(0 0 ${radius}px ${color})`
}

// Mutation direction arrows
export function getMutationColor(direction: string): string {
  switch (direction) {
    case 'mainstreaming': return '#22C55E'
    case 'radicalizing': return '#EF4444'
    case 'fragmenting': return '#F59E0B'
    case 'stable': return '#94A3B8'
    default: return '#94A3B8'
  }
}

// Event severity
export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'high': return '#EF4444'
    case 'medium': return '#F59E0B'
    case 'low': return '#64748B'
    default: return '#64748B'
  }
}

// Source diversity: organic (green) vs concentrated (red)
export function getSourceDiversityColor(score: number): string {
  if (score > 0.6) return '#22C55E'
  if (score < 0.3) return '#EF4444'
  // Interpolate between red and green
  const t = (score - 0.3) / 0.3
  return interpolateColor('#EF4444', '#22C55E', t)
}

// Divergence heatmap: dark → amber → crimson
export function getDivergenceHeatmapColor(value: number): string {
  if (value < 0.5) {
    return interpolateColor('#0A0E17', '#F59E0B', value * 2)
  }
  return interpolateColor('#F59E0B', '#DC2626', (value - 0.5) * 2)
}

// Contestation level badge
export function getContestationColor(level: string): string {
  switch (level) {
    case 'high': return '#EF4444'
    case 'medium': return '#F59E0B'
    case 'low': return '#22C55E'
    default: return '#94A3B8'
  }
}

// Divergence trend arrow
export function getTrendColor(trend: string): string {
  switch (trend) {
    case 'increasing': return '#EF4444'
    case 'decreasing': return '#22C55E'
    case 'stable': return '#94A3B8'
    default: return '#94A3B8'
  }
}

// Adversarial pair momentum correlation strength
export function getCorrelationColor(correlation: number): string {
  if (correlation < -0.6) return '#EF4444'   // red: strong inverse
  if (correlation < -0.3) return '#F59E0B'   // amber: moderate inverse
  return '#94A3B8'                            // grey: weak signal
}

// Helper: simple hex color interpolation
function interpolateColor(hex1: string, hex2: string, t: number): string {
  const r1 = parseInt(hex1.slice(1, 3), 16)
  const g1 = parseInt(hex1.slice(3, 5), 16)
  const b1 = parseInt(hex1.slice(5, 7), 16)
  const r2 = parseInt(hex2.slice(1, 3), 16)
  const g2 = parseInt(hex2.slice(3, 5), 16)
  const b2 = parseInt(hex2.slice(5, 7), 16)

  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
