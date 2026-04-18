// ============================================================================
// Landscape Force Configuration
// Single source of truth for D3 force simulation parameters.
// Tune these values to control cluster spreading and simulation behavior.
// ============================================================================

import type * as d3 from 'd3'

// --- Force Parameters (tuned for visual spreading) ---

export const FORCE_CHARGE_STRENGTH = -18
export const FORCE_CHARGE_DISTANCE_MAX = 200

export const FORCE_COLLIDE_STRENGTH = 0.8
export const FORCE_COLLIDE_ITERATIONS = 2
export const FORCE_COLLIDE_PADDING = 1.5 // added to node radius

export const FORCE_CENTER_STRENGTH = 0.005

export const FORCE_CLUSTER_X_STRENGTH = 0.25
export const FORCE_CLUSTER_Y_STRENGTH = 0.25

export const FORCE_ALPHA_DECAY = 0.012
export const FORCE_VELOCITY_DECAY = 0.45

export const FORCE_RESTART_ALPHA = 0.001  // D3 alphaMin — fires 'end' immediately, zero visible post-paint movement
export const FORCE_PRE_TICKS = 300        // Near-convergence: 1.0 × (1−0.012)^300 ≈ 0.027, good enough for layout

export const FORCE_BOUNDARY_MARGIN = 14

/** How often (in ticks) to run the expensive geometry update path */
export const GEOMETRY_UPDATE_INTERVAL = 5

// --- Centroid Spread Padding ---

export const CENTROID_SPREAD_PAD_MOBILE = 40
export const CENTROID_SPREAD_PAD_DESKTOP = 70

// --- Inter-Concept Repulsion Force ---

interface NodeWithConcept {
  x?: number
  y?: number
  vx?: number
  vy?: number
  claim: { concept_id: string; cluster_id: string }
}

/**
 * Custom D3 force that pushes concept groups apart.
 * Computes live centroids per concept each tick and applies repulsive nudges
 * when two concept centroids are closer than a minimum threshold.
 *
 * Key properties:
 * - Capped at maxDisplacement per node per tick to prevent oscillation
 * - Threshold based on viewport size: min(width, height) * minDistanceFraction
 * - Force strength decreases with distance (inverse proportional)
 */
export function createConceptRepulsionForce<N extends NodeWithConcept>(
  conceptGroupMap: Map<string, N[]>,
  width: number,
  height: number,
): d3.Force<N, undefined> {
  const minDist = Math.min(width, height) * 0.25
  const maxDisplacement = 2 // px per node per tick — prevent oscillation

  const force: d3.Force<N, undefined> = () => {
    // Compute live centroids for each concept
    const centroids = new Map<string, { x: number; y: number; nodes: N[] }>()
    conceptGroupMap.forEach((nodes, conceptId) => {
      if (!nodes.length) return
      let sx = 0, sy = 0
      for (const n of nodes) {
        sx += n.x ?? 0
        sy += n.y ?? 0
      }
      centroids.set(conceptId, {
        x: sx / nodes.length,
        y: sy / nodes.length,
        nodes,
      })
    })

    // For each pair of concepts, apply repulsion if too close
    const entries = Array.from(centroids.entries())
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [, a] = entries[i]
        const [, b] = entries[j]

        const dx = a.x - b.x
        const dy = a.y - b.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < minDist && dist > 0.1) {
          // Repulsive force inversely proportional to distance
          const overlap = minDist - dist
          const strength = Math.min(overlap / dist, 1) // normalized 0-1
          const pushX = (dx / dist) * strength * maxDisplacement
          const pushY = (dy / dist) * strength * maxDisplacement

          // Push all nodes in concept A away from concept B
          for (const n of a.nodes) {
            n.vx = (n.vx ?? 0) + pushX
            n.vy = (n.vy ?? 0) + pushY
          }
          // Push all nodes in concept B away from concept A
          for (const n of b.nodes) {
            n.vx = (n.vx ?? 0) - pushX
            n.vy = (n.vy ?? 0) - pushY
          }
        }
      }
    }
  }

  return force
}
