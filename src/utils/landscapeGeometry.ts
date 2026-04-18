// ============================================================================
// Landscape Geometry Utilities
// Pure functions for hull expansion, centroid computation, connection lines,
// label collision avoidance. Extracted from ClaimLandscape.tsx for reuse.
// ============================================================================

import * as d3 from 'd3'

// --- Contour Ring Constants ---

/** Expansion paddings for concentric hulls (innermost → outermost) */
export const CONTOUR_PADS = [20, 38, 56, 74]
/** Fill opacity per ring (decreasing outward) */
export const CONTOUR_OPACITIES = [0.04, 0.025, 0.015, 0.008]
/** Stroke opacity per ring (decreasing outward) */
export const CONTOUR_STROKE_OPACITIES = [0.12, 0.06, 0.03, 0.015]

// --- Hull Expansion ---

/** Expand a convex hull outward from its centroid by `pad` pixels */
export function expandHull(
  hull: [number, number][],
  centroid: [number, number],
  pad: number,
): [number, number][] {
  return hull.map(([px, py]) => {
    const dx = px - centroid[0]
    const dy = py - centroid[1]
    const dist = Math.sqrt(dx * dx + dy * dy)
    const scale = (dist + pad) / Math.max(dist, 1)
    return [centroid[0] + dx * scale, centroid[1] + dy * scale] as [number, number]
  })
}

// --- Centroid Computation ---

/** Compute the centroid (mean x, mean y) of an array of nodes with x/y properties */
export function computeCentroid(nodes: Array<{ x?: number; y?: number }>): [number, number] {
  if (!nodes.length) return [0, 0]
  const cx = nodes.reduce((s, n) => s + (n.x ?? 0), 0) / nodes.length
  const cy = nodes.reduce((s, n) => s + (n.y ?? 0), 0) / nodes.length
  return [cx, cy]
}

// --- Hull Path Computation ---

/** Compute concentric hull paths for a set of nodes. Returns null if < 3 nodes. */
export function computeHullPaths(
  nodes: Array<{ x?: number; y?: number }>,
  pads: number[] = CONTOUR_PADS,
): string[] | null {
  const points: [number, number][] = nodes.map(n => [n.x ?? 0, n.y ?? 0])
  if (points.length < 3) return null

  const hull = d3.polygonHull(points)
  if (!hull) return null

  const centroid = d3.polygonCentroid(hull)
  const line = d3.line().curve(d3.curveCatmullRomClosed.alpha(0.5))

  return pads.map(pad => {
    const expanded = expandHull(hull, centroid, pad)
    return line(expanded) ?? ''
  })
}

// --- Connection Lines ---

interface NodeWithPosition {
  x?: number
  y?: number
}

/** Compute nearest-neighbor connection lines within a cluster of nodes */
export function computeConnectionLines(
  nodes: NodeWithPosition[],
  maxConns?: number,
): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  if (nodes.length < 2) return []
  const mc = maxConns ?? (nodes.length > 20 ? 3 : 5)
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = []

  for (let i = 0; i < nodes.length; i++) {
    const dists = nodes.map((n, j) => ({
      j,
      d: j === i ? Infinity : Math.hypot((n.x ?? 0) - (nodes[i].x ?? 0), (n.y ?? 0) - (nodes[i].y ?? 0)),
    })).sort((a, b) => a.d - b.d)

    for (let k = 0; k < Math.min(mc, dists.length); k++) {
      const j = dists[k].j
      if (j > i) {
        lines.push({
          x1: nodes[i].x ?? 0, y1: nodes[i].y ?? 0,
          x2: nodes[j].x ?? 0, y2: nodes[j].y ?? 0,
        })
      }
    }
  }
  return lines
}

// --- Label Collision Avoidance ---

export interface LabelRect {
  el: SVGGElement
  x: number
  y: number
  w: number
  h: number
  naturalX: number
  naturalY: number
}

/**
 * Iteratively nudge overlapping label rectangles apart.
 * Mutates the labelRects array in-place, then clamps to viewport.
 */
export function resolveLabelsWithCollisionAvoidance(
  labelRects: LabelRect[],
  width: number,
  height: number,
  passes: number = 5,
): void {
  for (let pass = 0; pass < passes; pass++) {
    for (let i = 0; i < labelRects.length; i++) {
      for (let j = i + 1; j < labelRects.length; j++) {
        const a = labelRects[i], b = labelRects[j]
        const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
        const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
        if (overlapX > 0 && overlapY > 0) {
          const pushY = (overlapY / 2) + 3
          if (a.y < b.y) { a.y -= pushY; b.y += pushY }
          else { a.y += pushY; b.y -= pushY }
          const pushX = Math.min(overlapX / 4, 8)
          if (a.x < b.x) { a.x -= pushX; b.x += pushX }
          else { a.x += pushX; b.x -= pushX }
        }
      }
    }
  }

  // Clamp to viewport
  for (const lr of labelRects) {
    lr.x = Math.max(4, Math.min(lr.x, width - lr.w - 4))
    lr.y = Math.max(4, Math.min(lr.y, height - lr.h - 4))
  }
}
