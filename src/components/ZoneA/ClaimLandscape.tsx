import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import * as d3 from 'd3'
import type { LandscapeData, Claim, Cluster, ClaimPosition, AdversarialPair } from '../../types'
import { getMomentumColor, getArousalGlowFilter, getMutationColor } from '../../utils/colors'
import { ClaimTooltip } from './ClaimTooltip'
import { Legend } from './Legend'

interface ClaimLandscapeProps {
  landscape: LandscapeData
  selectedClaimId: string | null
  onSelectClaim: (claimId: string) => void
  onDeselectClaim: () => void
  /** Per-cluster salience override for compare mode. Scales node radius. */
  compareSalience?: Map<string, number>
  /** Label shown in corner during compare mode */
  compareLabel?: string
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string
  claim: Claim
  cluster: Cluster | undefined
  position: ClaimPosition
  radius: number
  momentum: number
  arousalValue: number
  color: string
}

// Map arousal level to numeric value
function arousalToNumber(arousal: 'high' | 'medium' | 'low'): number {
  switch (arousal) {
    case 'high': return 1.0
    case 'medium': return 0.5
    case 'low': return 0.0
  }
}

export function ClaimLandscape({
  landscape,
  selectedClaimId,
  onSelectClaim,
  onDeselectClaim,
  compareSalience,
  compareLabel,
}: ClaimLandscapeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 })
  const [tooltip, setTooltip] = useState<{ claim: Claim; cluster: Cluster | undefined; momentum: number; x: number; y: number } | null>(null)
  const simulationRef = useRef<d3.Simulation<SimNode, undefined> | null>(null)
  const hoverTimeoutRef = useRef<number | null>(null)

  // Observe container size
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) setDimensions({ width, height })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Build cluster centroids lookup
  const clusterCentroids = useMemo(() => {
    const centroids = new Map<string, { x: number; y: number; count: number }>()
    for (const pos of landscape.positions) {
      const claim = landscape.claims.find(c => c.id === pos.claim_id)
      if (!claim) continue
      const key = claim.cluster_id
      const existing = centroids.get(key)
      if (existing) {
        existing.x += pos.x
        existing.y += pos.y
        existing.count++
      } else {
        centroids.set(key, { x: pos.x, y: pos.y, count: 1 })
      }
    }
    // Compute averages
    const result = new Map<string, { x: number; y: number }>()
    centroids.forEach((v, k) => {
      result.set(k, { x: v.x / v.count, y: v.y / v.count })
    })
    return result
  }, [landscape])

  // Compute momentum per claim — read directly from pipeline-emitted pos.momentum
  const momentumMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const pos of landscape.positions) {
      map.set(pos.claim_id, pos.momentum ?? 0)
    }
    if (landscape.topic_metrics.top_accelerating) {
      map.set(landscape.topic_metrics.top_accelerating.claim_id, 0.8)
    }
    return map
  }, [landscape])

  // Dedup claims by ID (synthetic data may have duplicates)
  const dedupedClaims = useMemo(() => {
    const seen = new Set<string>()
    return landscape.claims.filter(c => {
      if (seen.has(c.id)) return false
      seen.add(c.id)
      return true
    })
  }, [landscape.claims])

  // Build simulation nodes
  const nodes = useMemo<SimNode[]>(() => {
    const { width, height } = dimensions
    // Scale positions from data range to viewport
    const xs = landscape.positions.map(p => p.x)
    const ys = landscape.positions.map(p => p.y)
    const xMin = Math.min(...xs), xMax = Math.max(...xs)
    const yMin = Math.min(...ys), yMax = Math.max(...ys)
    const xRange = xMax - xMin || 1
    const yRange = yMax - yMin || 1
    const pad = 40

    return dedupedClaims.map(claim => {
      const pos = landscape.positions.find(p => p.claim_id === claim.id)!
      const cluster = landscape.clusters.find(c => c.id === claim.cluster_id)
      const momentum = momentumMap.get(claim.id) ?? 0
      const arousalVal = arousalToNumber(claim.arousal)
      const confidence = claim.confidence

      // Salience used directly for radius mapping
      const salience = pos.salience ?? confidence
      const baseRadius = 2 + salience * 4
      const salienceScale = compareSalience ? (compareSalience.get(claim.cluster_id) ?? 0.15) : 1
      const radius = baseRadius * Math.max(0.2, salienceScale)

      // Scale to viewport
      const scaledX = pad + ((pos.x - xMin) / xRange) * (width - pad * 2)
      const scaledY = pad + ((pos.y - yMin) / yRange) * (height - pad * 2)

      return {
        id: claim.id,
        claim,
        cluster,
        position: pos,
        x: scaledX,
        y: scaledY,
        radius,
        momentum,
        arousalValue: arousalVal,
        color: getMomentumColor(momentum),
      }
    })
  }, [dedupedClaims, landscape.positions, landscape.clusters, dimensions, momentumMap, compareSalience])

  // Build cluster hull data
  const clusterHulls = useMemo(() => {
    const groups = new Map<string, { points: [number, number][]; cluster: Cluster | undefined }>()
    for (const node of nodes) {
      const key = node.claim.cluster_id
      if (!groups.has(key)) {
        groups.set(key, { points: [], cluster: node.cluster })
      }
      groups.get(key)!.points.push([node.x!, node.y!])
    }

    const hulls: Array<{ path: string; cluster: Cluster | undefined; clusterId: string }> = []
    groups.forEach((data, clusterId) => {
      if (data.points.length < 3) return
      const hull = d3.polygonHull(data.points)
      if (!hull) return

      // Expand hull slightly for padding
      const centroid = d3.polygonCentroid(hull)
      const expanded = hull.map(([px, py]) => {
        const dx = px - centroid[0]
        const dy = py - centroid[1]
        const dist = Math.sqrt(dx * dx + dy * dy)
        const scale = (dist + 20) / dist
        return [centroid[0] + dx * scale, centroid[1] + dy * scale] as [number, number]
      })

      const line = d3.line().curve(d3.curveCatmullRomClosed.alpha(0.5))
      const path = line(expanded)
      if (path) hulls.push({ path, cluster: data.cluster, clusterId })
    })
    return hulls
  }, [nodes])

  // Adversarial links between opposed cluster centroids
  const adversarialLinks = useMemo(() => {
    const pairs: AdversarialPair[] = landscape.adversarial_pairs ?? []
    return pairs.map(pair => {
      // Find centroids from node positions (more accurate than clusterCentroids since they use scaled positions)
      const nodesA = nodes.filter(n => n.claim.cluster_id === pair.cluster_id_a)
      const nodesB = nodes.filter(n => n.claim.cluster_id === pair.cluster_id_b)
      if (nodesA.length === 0 || nodesB.length === 0) return null
      const cx1 = nodesA.reduce((s, n) => s + (n.x ?? 0), 0) / nodesA.length
      const cy1 = nodesA.reduce((s, n) => s + (n.y ?? 0), 0) / nodesA.length
      const cx2 = nodesB.reduce((s, n) => s + (n.x ?? 0), 0) / nodesB.length
      const cy2 = nodesB.reduce((s, n) => s + (n.y ?? 0), 0) / nodesB.length
      return { pair, x1: cx1, y1: cy1, x2: cx2, y2: cy2 }
    }).filter((l): l is NonNullable<typeof l> => l !== null)
  }, [landscape.adversarial_pairs, nodes])

  // D3 force simulation
  useEffect(() => {
    if (!nodes.length) return

    // Stop any existing simulation
    simulationRef.current?.stop()

    const { width, height } = dimensions

    // Scaled cluster centroids for forces
    const xs = landscape.positions.map(p => p.x)
    const ys = landscape.positions.map(p => p.y)
    const xMin = Math.min(...xs), xMax = Math.max(...xs)
    const yMin = Math.min(...ys), yMax = Math.max(...ys)
    const xRange = xMax - xMin || 1
    const yRange = yMax - yMin || 1

    const simPad = 40
    const scaledCentroids = new Map<string, { x: number; y: number }>()
    clusterCentroids.forEach((c, k) => {
      scaledCentroids.set(k, {
        x: simPad + ((c.x - xMin) / xRange) * (width - simPad * 2),
        y: simPad + ((c.y - yMin) / yRange) * (height - simPad * 2),
      })
    })

    const sim = d3.forceSimulation<SimNode>(nodes)
      .force('charge', d3.forceManyBody<SimNode>().strength(-20).distanceMax(240))
      .force('collide', d3.forceCollide<SimNode>().radius(d => d.radius + 1).strength(0.95).iterations(3))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.01))
      // Attract nodes toward their cluster centroid
      .force('clusterX', d3.forceX<SimNode>(d => {
        const c = scaledCentroids.get(d.claim.cluster_id)
        return c?.x ?? width / 2
      }).strength(0.10))
      .force('clusterY', d3.forceY<SimNode>(d => {
        const c = scaledCentroids.get(d.claim.cluster_id)
        return c?.y ?? height / 2
      }).strength(0.10))
      .alphaDecay(0.012)
      .velocityDecay(0.4)
      .on('tick', () => {
        // Clamp nodes within canvas bounds and zero velocity at walls
        const margin = 14
        for (const node of nodes) {
          const minX = margin + node.radius, maxX = width - margin - node.radius
          const minY = margin + node.radius, maxY = height - margin - node.radius
          if (node.x! < minX) { node.x = minX; if ((node.vx ?? 0) < 0) node.vx = 0 }
          if (node.x! > maxX) { node.x = maxX; if ((node.vx ?? 0) > 0) node.vx = 0 }
          if (node.y! < minY) { node.y = minY; if ((node.vy ?? 0) < 0) node.vy = 0 }
          if (node.y! > maxY) { node.y = maxY; if ((node.vy ?? 0) > 0) node.vy = 0 }
        }

        // Force React re-render by updating SVG directly for performance
        const svg = d3.select(svgRef.current)
        svg.selectAll<SVGCircleElement, SimNode>('.claim-node')
          .attr('cx', d => d.x!)
          .attr('cy', d => d.y!)

        // Build per-cluster node groups and node map
        const groups = new Map<string, [number, number][]>()
        const clusterNodeMap = new Map<string, SimNode[]>()
        const nodeMap = new Map<string, SimNode>()
        for (const node of nodes) {
          const key = node.claim.cluster_id
          if (!groups.has(key)) { groups.set(key, []); clusterNodeMap.set(key, []) }
          groups.get(key)!.push([node.x!, node.y!])
          clusterNodeMap.get(key)!.push(node)
          nodeMap.set(node.id, node)
        }

        // Update hulls
        svg.selectAll<SVGPathElement, string>('.cluster-hull')
          .attr('d', function() {
            const clusterId = this.getAttribute('data-cluster-id')
            if (!clusterId) return ''
            const pts = groups.get(clusterId)
            if (!pts || pts.length < 3) return ''
            const hull = d3.polygonHull(pts)
            if (!hull) return ''
            const centroid = d3.polygonCentroid(hull)
            const expanded = hull.map(([px, py]) => {
              const dx = px - centroid[0]
              const dy = py - centroid[1]
              const dist = Math.sqrt(dx * dx + dy * dy)
              const scale = (dist + 20) / dist
              return [centroid[0] + dx * scale, centroid[1] + dy * scale] as [number, number]
            })
            return d3.line().curve(d3.curveCatmullRomClosed.alpha(0.5))(expanded) ?? ''
          })

        // (cluster labels are now React-computed — no D3 positioning needed)

        // Update adversarial link positions
        const advPairs = landscape.adversarial_pairs ?? []
        svg.selectAll<SVGGElement, unknown>('.adversarial-link').each(function() {
          const idx = parseInt(this.getAttribute('data-pair-idx') ?? '-1', 10)
          if (idx < 0 || idx >= advPairs.length) return
          const pair = advPairs[idx]
          const na = clusterNodeMap.get(pair.cluster_id_a)
          const nb = clusterNodeMap.get(pair.cluster_id_b)
          if (!na?.length || !nb?.length) return
          const x1 = na.reduce((s, n) => s + (n.x ?? 0), 0) / na.length
          const y1 = na.reduce((s, n) => s + (n.y ?? 0), 0) / na.length
          const x2 = nb.reduce((s, n) => s + (n.x ?? 0), 0) / nb.length
          const y2 = nb.reduce((s, n) => s + (n.y ?? 0), 0) / nb.length
          const g = d3.select(this)
          g.select('line').attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2)
          g.select('text').attr('x', (x1 + x2) / 2).attr('y', (y1 + y2) / 2 - 4)
        })
      })

    simulationRef.current = sim

    // Pre-tick to settle before first render
    for (let i = 0; i < 350; i++) sim.tick()
    sim.alpha(0.15).restart()

    return () => { sim.stop() }
  }, [nodes.length, dimensions.width, dimensions.height]) // eslint-disable-line react-hooks/exhaustive-deps

  // D3 Zoom Behavior
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return
    const svg = d3.select(svgRef.current)
    const g = d3.select(gRef.current)

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })

    // Remove zoom double click to prevent accidental annoying bounces, but keep scroll/drag
    svg.call(zoom).on('dblclick.zoom', null)
  }, [])

  // Mutation arrows for cluster centroids
  const mutationArrows = useMemo(() => {
    const arrows: Array<{ x: number; y: number; direction: string; label: string }> = []
    for (const cluster of landscape.clusters) {
      if (cluster.mutation_direction === 'stable') continue
      // Find average position of cluster nodes
      const clusterNodes = nodes.filter(n => n.claim.cluster_id === cluster.id)
      if (clusterNodes.length === 0) continue
      const cx = clusterNodes.reduce((s, n) => s + (n.x ?? 0), 0) / clusterNodes.length
      const cy = clusterNodes.reduce((s, n) => s + (n.y ?? 0), 0) / clusterNodes.length
      arrows.push({ x: cx, y: cy, direction: cluster.mutation_direction, label: cluster.label })
    }
    return arrows
  }, [landscape.clusters, nodes])

  // Cluster label positions — sorted by cluster_id for stable numbering (must match DivergenceHeatmap order)
  const clusterLabels = useMemo(() => {
    const sorted = [...landscape.clusters].sort((a, b) => a.id.localeCompare(b.id))
    return sorted.flatMap((cluster, i) => {
      const cn = nodes.filter(n => n.claim.cluster_id === cluster.id)
      if (cn.length === 0) return []
      const cx = cn.reduce((s, n) => s + (n.x ?? 0), 0) / cn.length
      const cy = Math.max(...cn.map(n => (n.y ?? 0) + (n.radius ?? 8))) + 16
      return [{ cluster, cx, cy, index: i + 1 }]
    })
  }, [landscape.clusters, nodes])

  const handleNodeClick = useCallback((claimId: string) => {
    onSelectClaim(claimId)
  }, [onSelectClaim])

  const handleBackgroundClick = useCallback(() => {
    onDeselectClaim()
    setTooltip(null)
  }, [onDeselectClaim])

  const handleNodeHover = useCallback((node: SimNode | null, event?: React.MouseEvent) => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }

    if (node && event) {
      setTooltip({ claim: node.claim, cluster: node.cluster, momentum: node.momentum, x: event.clientX, y: event.clientY })
    } else {
      hoverTimeoutRef.current = window.setTimeout(() => {
        setTooltip(null)
      }, 300)
    }
  }, [])

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onClick={handleBackgroundClick}
      >
        <g ref={gRef}>
          {/* Cluster hulls */}
          {clusterHulls.map(hull => (
          <path
            key={hull.clusterId}
            className="cluster-hull"
            data-cluster-id={hull.clusterId}
            d={hull.path}
            fill={getMutationColor(hull.cluster?.mutation_direction ?? 'stable')}
            fillOpacity={0.04}
            stroke={getMutationColor(hull.cluster?.mutation_direction ?? 'stable')}
            strokeOpacity={0.12}
            strokeWidth={1}
          />
        ))}

        {/* Adversarial links between opposed clusters */}
        {adversarialLinks.map((link, i) => {
          // Brighten link if selected claim is in one of the adversarial clusters
          const selectedNode = selectedClaimId ? nodes.find(n => n.id === selectedClaimId) : null
          const isActive = selectedNode && (
            selectedNode.claim.cluster_id === link.pair.cluster_id_a ||
            selectedNode.claim.cluster_id === link.pair.cluster_id_b
          )
          return (
            <g key={`adv-${i}`} className="adversarial-link" data-pair-idx={i}>
              <line
                x1={link.x1} y1={link.y1}
                x2={link.x2} y2={link.y2}
                stroke="#EF4444"
                strokeOpacity={isActive ? 0.55 : 0.25}
                strokeWidth={isActive ? 2 : 1.5}
                strokeDasharray="4 3"
                style={{ transition: 'stroke-opacity 200ms ease' }}
              />
              <text
                x={(link.x1 + link.x2) / 2}
                y={(link.y1 + link.y2) / 2 - 4}
                textAnchor="middle"
                fill="#EF4444"
                fontSize={7}
                fontFamily="var(--font-data)"
                opacity={isActive ? 0.7 : 0.4}
                pointerEvents="none"
              >
                vs
              </text>
            </g>
          )
        })}

        {/* Mutation direction arrows at cluster centroids */}
        {mutationArrows.map((arrow, i) => {
          const color = getMutationColor(arrow.direction)
          const angle = arrow.direction === 'mainstreaming' ? -45
            : arrow.direction === 'radicalizing' ? 45
            : arrow.direction === 'fragmenting' ? 0 : 0
          return (
            <g key={i} transform={`translate(${arrow.x}, ${arrow.y})`}>
              <text
                x={0}
                y={-8}
                textAnchor="middle"
                fill={color}
                fontSize={10}
                fontFamily="var(--font-data)"
                opacity={0.7}
                transform={`rotate(${angle})`}
              >
                {arrow.direction === 'mainstreaming' ? '↙' :
                  arrow.direction === 'radicalizing' ? '↗' :
                  arrow.direction === 'fragmenting' ? '⤢' : ''}
              </text>
            </g>
          )
        })}

        {/* Claim nodes */}
        {nodes.map(node => {
          const isSelected = node.id === selectedClaimId
          const isOtherSelected = selectedClaimId && !isSelected
          const glowFilter = getArousalGlowFilter(node.arousalValue, node.color)

          return (
            <circle
              key={node.id}
              className="claim-node"
              cx={node.x}
              cy={node.y}
              r={isSelected ? node.radius + 2 : node.radius}
              fill={node.color}
              fillOpacity={
                node.claim.confidence < 0.5 ? 0.4
                : isOtherSelected ? 0.35
                : 0.85
              }
              stroke={isSelected ? '#F1F5F9' : 'transparent'}
              strokeWidth={isSelected ? 2 : 0}
              style={{
                filter: glowFilter !== 'none' ? glowFilter : undefined,
                cursor: 'pointer',
                transition: 'fill-opacity 200ms ease, r 200ms ease, cx 200ms ease, cy 200ms ease',
              }}
              onClick={e => {
                e.stopPropagation()
                handleNodeClick(node.id)
              }}
              onMouseEnter={e => handleNodeHover(node, e)}
              onMouseLeave={() => handleNodeHover(null)}
            />
          )
        })}

        {/* Cluster labels — numbered short badges, full name available on hover tooltip */}
        {clusterLabels.map(({ cluster, cx, cy, index }) => {
          const shortLabel = `Cluster ${index}`
          const badgeW = 58
          return (
            <g key={`clbl-${cluster.id}`} pointerEvents="none">
              <rect
                x={cx - badgeW / 2}
                y={cy - 2}
                width={badgeW}
                height={16}
                rx={4}
                fill="rgba(19,31,48,0.85)"
                stroke="rgba(71,85,105,0.6)"
                strokeWidth={0.8}
              />
              <text
                x={cx}
                y={cy + 9}
                textAnchor="middle"
                fill="#94A3B8"
                fontSize={9}
                fontWeight={600}
                fontFamily="var(--font-sans, Inter, sans-serif)"
                letterSpacing="0.4"
              >
                {shortLabel}
              </text>
            </g>
          )
        })}
        </g>
      </svg>

      {/* Compare mode label */}
      {compareLabel && (
        <div
          className="absolute top-3 left-3 px-2 py-1 rounded text-[10px] font-medium pointer-events-none"
          style={{
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: '#94A3B8',
            border: '1px solid #1E3044',
          }}
        >
          {compareLabel}
        </div>
      )}

      {/* Topology Legend */}
      <Legend />

      {/* Tooltip overlay */}
      {tooltip && (
        <ClaimTooltip
          claim={tooltip.claim}
          cluster={tooltip.cluster}
          momentum={tooltip.momentum}
          x={tooltip.x}
          y={tooltip.y}
          onMouseEnter={() => {
            if (hoverTimeoutRef.current) {
              window.clearTimeout(hoverTimeoutRef.current)
              hoverTimeoutRef.current = null
            }
          }}
          onMouseLeave={() => {
            hoverTimeoutRef.current = window.setTimeout(() => {
              setTooltip(null)
            }, 300)
          }}
          onClick={(e) => {
            e.stopPropagation()
            onSelectClaim(tooltip.claim.id)
            setTooltip(null)
          }}
        />
      )}
    </div>
  )
}
