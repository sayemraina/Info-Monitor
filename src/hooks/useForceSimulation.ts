// ============================================================================
// Force Simulation Hook
// Encapsulates the D3 force simulation lifecycle: creation, position transfer,
// tick handling, geometry updates, and cleanup.
// ============================================================================

import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { Claim, Cluster, ClaimPosition, AdversarialPair } from '../types'
import {
  expandHull,
  computeCentroid,
  resolveLabelsWithCollisionAvoidance,
  CONTOUR_PADS,
} from '../utils/landscapeGeometry'
import type { LabelRect } from '../utils/landscapeGeometry'
import {
  FORCE_CHARGE_STRENGTH,
  FORCE_CHARGE_DISTANCE_MAX,
  FORCE_COLLIDE_STRENGTH,
  FORCE_COLLIDE_ITERATIONS,
  FORCE_COLLIDE_PADDING,
  FORCE_CENTER_STRENGTH,
  FORCE_CLUSTER_X_STRENGTH,
  FORCE_CLUSTER_Y_STRENGTH,
  FORCE_ALPHA_DECAY,
  FORCE_VELOCITY_DECAY,
  FORCE_RESTART_ALPHA,
  FORCE_PRE_TICKS,
  FORCE_BOUNDARY_MARGIN,
  GEOMETRY_UPDATE_INTERVAL,
  CENTROID_SPREAD_PAD_MOBILE,
  CENTROID_SPREAD_PAD_DESKTOP,
  createConceptRepulsionForce,
} from '../utils/landscapeForces'
import { mark, measure } from '../utils/perf'

export interface SimNode extends d3.SimulationNodeDatum {
  id: string
  claim: Claim
  cluster: Cluster | undefined
  position: ClaimPosition
  radius: number
  momentum: number
  friction: number
  persistence: number
  arousalValue: number
  color: string
}

interface UseForceSimulationParams {
  svgRef: React.RefObject<SVGSVGElement | null>
  nodes: SimNode[]
  dimensions: { width: number; height: number }
  conceptGroupMap: Map<string, SimNode[]>
  clusterGroupMap: Map<string, SimNode[]>
  adversarialPairs: AdversarialPair[]
  isMobile: boolean
  onSettled?: () => void
}

export function useForceSimulation({
  svgRef,
  nodes,
  dimensions,
  conceptGroupMap,
  clusterGroupMap,
  adversarialPairs,
  isMobile,
  onSettled,
}: UseForceSimulationParams) {
  const simulationRef = useRef<d3.Simulation<SimNode, undefined> | null>(null)

  useEffect(() => {
    if (!nodes.length) return

    // Stop any existing simulation and transfer positions from old nodes
    const oldSim = simulationRef.current
    const hadPreviousPositions = oldSim !== null
    if (oldSim) {
      const oldNodes = oldSim.nodes()
      const positionMap = new Map<string, { x: number; y: number }>()
      for (const n of oldNodes) {
        if (n.x != null && n.y != null) {
          positionMap.set((n as SimNode).id, { x: n.x, y: n.y })
        }
      }
      oldSim.stop()
      for (const node of nodes) {
        const oldPos = positionMap.get(node.id)
        if (oldPos) {
          node.x = oldPos.x
          node.y = oldPos.y
        }
      }
    }

    const { width, height } = dimensions

    // Build concept centroids from initial node positions
    const originalCentroids = new Map<string, { x: number; y: number }>()
    const scaledCentroids = new Map<string, { x: number; y: number }>()
    conceptGroupMap.forEach((conceptNodes, key) => {
      const [cx, cy] = computeCentroid(conceptNodes)
      originalCentroids.set(key, { x: cx, y: cy })
      scaledCentroids.set(key, { x: cx, y: cy })
    })

    // Rescale centroids to fill viewport AND relocate nodes to match
    if (scaledCentroids.size > 1) {
      const entries = Array.from(scaledCentroids.entries())
      const cxs = entries.map(([, c]) => c.x)
      const cys = entries.map(([, c]) => c.y)
      const cxMin = Math.min(...cxs), cxMax = Math.max(...cxs)
      const cyMin = Math.min(...cys), cyMax = Math.max(...cys)
      const cxRange = cxMax - cxMin || 1
      const cyRange = cyMax - cyMin || 1
      const spreadPad = isMobile ? CENTROID_SPREAD_PAD_MOBILE : CENTROID_SPREAD_PAD_DESKTOP

      for (const [, c] of entries) {
        c.x = spreadPad + ((c.x - cxMin) / cxRange) * (width - spreadPad * 2)
        c.y = spreadPad + ((c.y - cyMin) / cyRange) * (height - spreadPad * 2)
      }

      // CRITICAL: Relocate each node so its offset from its concept centroid
      // is preserved, but the centroid is now at the rescaled position.
      // This ensures nodes START spread across the viewport instead of
      // hoping forces will drag them there.
      conceptGroupMap.forEach((conceptNodes, key) => {
        const orig = originalCentroids.get(key)
        const scaled = scaledCentroids.get(key)
        if (!orig || !scaled) return
        const dx = scaled.x - orig.x
        const dy = scaled.y - orig.y
        for (const node of conceptNodes) {
          node.x = Math.max(FORCE_BOUNDARY_MARGIN, Math.min(width - FORCE_BOUNDARY_MARGIN, (node.x ?? 0) + dx))
          node.y = Math.max(FORCE_BOUNDARY_MARGIN, Math.min(height - FORCE_BOUNDARY_MARGIN, (node.y ?? 0) + dy))
        }
      })
    }

    let tickCount = 0

    // Build node lookup by ID for imperative DOM updates
    // (React creates the circles — D3 has no datum binding on them)
    const nodeById = new Map<string, SimNode>()
    for (const n of nodes) nodeById.set(n.id, n)

    // Geometry update — syncs hulls, glows, labels, connections, adversarial links to node positions
    const updateGeometry = () => {
      const svg = d3.select(svgRef.current)

      // Update node positions — look up by element key (React sets this as data attribute isn't available,
      // so we iterate the nodes array and match by index since React renders in order)
      svg.selectAll<SVGCircleElement, unknown>('.claim-node').each(function(_, i) {
        if (i < nodes.length) {
          this.setAttribute('cx', String(nodes[i].x ?? 0))
          this.setAttribute('cy', String(nodes[i].y ?? 0))
        }
      })

      svg.selectAll<SVGPathElement, string>('.cluster-hull')
        .attr('d', function() {
          const conceptId = this.getAttribute('data-concept-id')
          const ringIdx = parseInt(this.getAttribute('data-ring-idx') ?? '0', 10)
          if (!conceptId) return ''
          const cNodes = conceptGroupMap.get(conceptId)
          if (!cNodes || cNodes.length < 3) return ''
          const pts: [number, number][] = cNodes.map(n => [n.x!, n.y!])
          const hull = d3.polygonHull(pts)
          if (!hull) return ''
          const centroid = d3.polygonCentroid(hull)
          const pad = CONTOUR_PADS[ringIdx] ?? 20
          const expanded = expandHull(hull, centroid, pad)
          return d3.line().curve(d3.curveCatmullRomClosed.alpha(0.5))(expanded) ?? ''
        })

      svg.selectAll<SVGCircleElement, unknown>('.density-glow').each(function() {
        const conceptId = this.getAttribute('data-concept-id')
        if (!conceptId) return
        const cNodes = conceptGroupMap.get(conceptId)
        if (!cNodes?.length) return
        const [cx, cy] = computeCentroid(cNodes)
        d3.select(this).attr('cx', cx).attr('cy', cy)
      })

      svg.selectAll<SVGGElement, unknown>('.cluster-connections').each(function() {
        const conceptId = this.getAttribute('data-concept-id')
        if (!conceptId) return
        const cNodes = conceptGroupMap.get(conceptId)
        if (!cNodes || cNodes.length < 2) return
        const lineEls = d3.select(this).selectAll<SVGLineElement, unknown>('line')
        const maxConns = cNodes.length > 20 ? 3 : 5
        let lineIdx = 0
        for (let i = 0; i < cNodes.length; i++) {
          const dists = cNodes.map((n, j) => ({
            j,
            d: j === i ? Infinity : Math.hypot((n.x ?? 0) - (cNodes[i].x ?? 0), (n.y ?? 0) - (cNodes[i].y ?? 0)),
          })).sort((a, b) => a.d - b.d)
          for (let k = 0; k < Math.min(maxConns, dists.length); k++) {
            if (dists[k].j > i && lineIdx < lineEls.size()) {
              const el = lineEls.nodes()[lineIdx]
              if (el) {
                el.setAttribute('x1', String(cNodes[i].x ?? 0))
                el.setAttribute('y1', String(cNodes[i].y ?? 0))
                el.setAttribute('x2', String(cNodes[dists[k].j].x ?? 0))
                el.setAttribute('y2', String(cNodes[dists[k].j].y ?? 0))
              }
              lineIdx++
            }
          }
        }
      })

      const labelRects: LabelRect[] = []
      svg.selectAll<SVGGElement, unknown>('.concept-label-g').each(function() {
        const conceptId = this.getAttribute('data-concept-id')
        if (!conceptId) return
        const cNodes = conceptGroupMap.get(conceptId)
        if (!cNodes?.length) return
        const [centX] = computeCentroid(cNodes)
        const cy = Math.max(...cNodes.map(n => (n.y ?? 0) + ((n as SimNode).radius ?? 8))) + 16
        const rectEl = d3.select(this).select('rect')
        const bw = parseFloat(rectEl.attr('width') || '60')
        labelRects.push({ el: this, x: centX - bw / 2, y: cy - 2, w: bw, h: 18, naturalX: centX, naturalY: cy })
      })

      resolveLabelsWithCollisionAvoidance(labelRects, width, height, 5)

      for (const lr of labelRects) {
        const cx = lr.x + lr.w / 2
        const g = d3.select(lr.el)
        g.select('text').attr('x', cx).attr('y', lr.y + 11)
        g.select('rect').attr('x', lr.x).attr('y', lr.y)
        const leaderLine = g.select('.leader-line')
        const dx = cx - lr.naturalX
        const dy = (lr.y + lr.h / 2) - lr.naturalY
        const displacement = Math.sqrt(dx * dx + dy * dy)
        if (displacement > 25) {
          if (leaderLine.empty()) {
            g.insert('line', ':first-child')
              .attr('class', 'leader-line')
              .attr('stroke', '#94A3B8')
              .attr('stroke-opacity', 0.25)
              .attr('stroke-width', 0.5)
          }
          g.select('.leader-line')
            .attr('x1', lr.naturalX).attr('y1', lr.naturalY)
            .attr('x2', cx).attr('y2', lr.y + lr.h / 2)
        } else {
          if (!leaderLine.empty()) leaderLine.remove()
        }
      }

      const advPairs = adversarialPairs
      svg.selectAll<SVGGElement, unknown>('.adversarial-link').each(function() {
        const idx = parseInt(this.getAttribute('data-pair-idx') ?? '-1', 10)
        if (idx < 0 || idx >= advPairs.length) return
        const pair = advPairs[idx]
        const na = clusterGroupMap.get(pair.cluster_id_a)
        const nb = clusterGroupMap.get(pair.cluster_id_b)
        if (!na?.length || !nb?.length) return
        const x1 = na.reduce((s, n) => s + (n.x ?? 0), 0) / na.length
        const y1 = na.reduce((s, n) => s + (n.y ?? 0), 0) / na.length
        const x2 = nb.reduce((s, n) => s + (n.x ?? 0), 0) / nb.length
        const y2 = nb.reduce((s, n) => s + (n.y ?? 0), 0) / nb.length
        const g = d3.select(this)
        g.select('line').attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2)
        g.select('text').attr('x', (x1 + x2) / 2).attr('y', (y1 + y2) / 2 - 4)
      })
    }

    const sim = d3.forceSimulation<SimNode>(nodes)
      .force('charge', d3.forceManyBody<SimNode>().strength(FORCE_CHARGE_STRENGTH).distanceMax(FORCE_CHARGE_DISTANCE_MAX))
      .force('collide', d3.forceCollide<SimNode>().radius(d => d.radius + FORCE_COLLIDE_PADDING).strength(FORCE_COLLIDE_STRENGTH).iterations(FORCE_COLLIDE_ITERATIONS))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(FORCE_CENTER_STRENGTH))
      .force('clusterX', d3.forceX<SimNode>(d => {
        const c = scaledCentroids.get(d.claim.concept_id || d.claim.cluster_id)
        return c?.x ?? width / 2
      }).strength(FORCE_CLUSTER_X_STRENGTH))
      .force('clusterY', d3.forceY<SimNode>(d => {
        const c = scaledCentroids.get(d.claim.concept_id || d.claim.cluster_id)
        return c?.y ?? height / 2
      }).strength(FORCE_CLUSTER_Y_STRENGTH))
      .force('conceptRepulsion', createConceptRepulsionForce(conceptGroupMap, width, height))
      .alphaDecay(FORCE_ALPHA_DECAY)
      .velocityDecay(FORCE_VELOCITY_DECAY)
      .on('tick', () => {
        tickCount++

        const margin = FORCE_BOUNDARY_MARGIN
        for (const node of nodes) {
          const minX = margin + node.radius, maxX = width - margin - node.radius
          const minY = margin + node.radius, maxY = height - margin - node.radius
          if (node.x! < minX) { node.x = minX; if ((node.vx ?? 0) < 0) node.vx = 0 }
          if (node.x! > maxX) { node.x = maxX; if ((node.vx ?? 0) > 0) node.vx = 0 }
          if (node.y! < minY) { node.y = minY; if ((node.vy ?? 0) < 0) node.vy = 0 }
          if (node.y! > maxY) { node.y = maxY; if ((node.vy ?? 0) > 0) node.vy = 0 }
        }

        const svg = d3.select(svgRef.current)
        svg.selectAll<SVGCircleElement, unknown>('.claim-node').each(function(_, i) {
          if (i < nodes.length) {
            this.setAttribute('cx', String(nodes[i].x ?? 0))
            this.setAttribute('cy', String(nodes[i].y ?? 0))
          }
        })

        if (tickCount % GEOMETRY_UPDATE_INTERVAL === 0 || sim.alpha() < 0.05) {
          updateGeometry()
        }
      })
      .on('end', () => {
        updateGeometry()
        // Signal React to re-render with final D3-mutated positions
        // so that useMemo-computed hull paths match node positions
        onSettled?.()
      })

    simulationRef.current = sim

    const preTicks = hadPreviousPositions ? 200 : FORCE_PRE_TICKS
    mark('force_sim_start', { preTicks, nodes: nodes.length })
    for (let i = 0; i < preTicks; i++) sim.tick()
    mark('force_sim_end')
    measure('force_sim_preticks', 'force_sim_start', 'force_sim_end')
    // Run geometry once after pre-ticks to ensure DOM is correct before paint
    updateGeometry()
    sim.alpha(FORCE_RESTART_ALPHA).restart()
    // Signal React that pre-tick layout is settled — re-render useMemos
    // with D3-mutated node positions
    onSettled?.()

    return () => { sim.stop() }
  }, [nodes, dimensions.width, dimensions.height]) // eslint-disable-line react-hooks/exhaustive-deps

  return { simulationRef }
}
