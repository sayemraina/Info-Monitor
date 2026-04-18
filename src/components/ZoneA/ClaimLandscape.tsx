import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import * as d3 from 'd3'
import type { LandscapeData, Claim, Cluster, AdversarialPair } from '../../types'
import { getMomentumColor, getArousalGlowFilter, getMutationColor } from '../../utils/colors'
import { ClaimTooltip } from './ClaimTooltip'
import { Legend } from './Legend'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useForceSimulation } from '../../hooks/useForceSimulation'
import type { SimNode } from '../../hooks/useForceSimulation'
import {
  computeCentroid,
  expandHull,
  CONTOUR_PADS,
  CONTOUR_OPACITIES,
  CONTOUR_STROKE_OPACITIES,
} from '../../utils/landscapeGeometry'

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
  const isMobile = useIsMobile()
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 })
  const [tooltip, setTooltip] = useState<{ claim: Claim; cluster: Cluster | undefined; momentum: number; friction: number; persistence: number; x: number; y: number } | null>(null)
  const hoverTimeoutRef = useRef<number | null>(null)
  // Incremented when D3 simulation settles — forces useMemo recomputation
  // with D3-mutated node positions so React renders correct hull paths
  const [simVersion, setSimVersion] = useState(0)

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

  // Dedup claims by ID (modeled data may have duplicates)
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
    const pad = isMobile ? 20 : 40

    // Aspect-ratio-aware scaling: uniform scale + centering
    const dataAspect = xRange / yRange
    const viewW = width - pad * 2
    const viewH = height - pad * 2
    const viewAspect = viewW / viewH

    let effectiveW: number, effectiveH: number, offsetX: number, offsetY: number
    if (viewAspect > dataAspect) {
      // Viewport wider than data — fit height, center horizontally
      effectiveH = viewH
      effectiveW = effectiveH * dataAspect
      offsetX = pad + (viewW - effectiveW) / 2
      offsetY = pad
    } else {
      // Viewport taller than data — fit width, center vertically
      effectiveW = viewW
      effectiveH = effectiveW / dataAspect
      offsetX = pad
      offsetY = pad + (viewH - effectiveH) / 2
    }

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

      // Scale to viewport with uniform aspect ratio
      const scaledX = offsetX + ((pos.x - xMin) / xRange) * effectiveW
      const scaledY = offsetY + ((pos.y - yMin) / yRange) * effectiveH

      return {
        id: claim.id,
        claim,
        cluster,
        position: pos,
        x: scaledX,
        y: scaledY,
        radius,
        momentum,
        friction: pos.friction ?? 0,
        persistence: pos.persistence ?? 0,
        arousalValue: arousalVal,
        color: getMomentumColor(momentum),
      }
    })
  }, [dedupedClaims, landscape.positions, landscape.clusters, dimensions, momentumMap, compareSalience])

  // Cache concept→nodes grouping (stable across ticks — only positions change, not assignments)
  // Group by concept_id for visual rendering (hulls, labels, forces)
  const conceptGroupMap = useMemo(() => {
    const map = new Map<string, SimNode[]>()
    for (const node of nodes) {
      const key = node.claim.concept_id || node.claim.cluster_id
      const arr = map.get(key)
      if (arr) arr.push(node)
      else map.set(key, [node])
    }
    return map
  }, [nodes])

  // Also keep cluster-level grouping for adversarial links (which reference cluster_ids)
  const clusterGroupMap = useMemo(() => {
    const map = new Map<string, SimNode[]>()
    for (const node of nodes) {
      const key = node.claim.cluster_id
      const arr = map.get(key)
      if (arr) arr.push(node)
      else map.set(key, [node])
    }
    return map
  }, [nodes])

  // Build concept hull data (initial — will be updated by D3 tick handler via refs)
  const conceptHulls = useMemo(() => {
    const concepts = landscape.concepts ?? []
    const hulls: Array<{ paths: string[]; conceptId: string; mutation_direction: string; cx: number; cy: number }> = []
    conceptGroupMap.forEach((conceptNodes, conceptId) => {
      const points: [number, number][] = conceptNodes.map(n => [n.x!, n.y!])
      if (points.length < 3) return
      const hull = d3.polygonHull(points)
      if (!hull) return

      const centroid = d3.polygonCentroid(hull)
      const line = d3.line().curve(d3.curveCatmullRomClosed.alpha(0.5))

      const paths = CONTOUR_PADS.map(pad => {
        const expanded = expandHull(hull, centroid, pad)
        return line(expanded) ?? ''
      })

      const concept = concepts.find(c => c.id === conceptId)
      const mutation = concept?.mutation_direction ?? conceptNodes[0]?.cluster?.mutation_direction ?? 'stable'
      hulls.push({ paths, conceptId, mutation_direction: mutation, cx: centroid[0], cy: centroid[1] })
    })
    return hulls
  }, [conceptGroupMap, landscape.concepts, simVersion])

  // Adversarial links between opposed cluster centroids
  const adversarialLinks = useMemo(() => {
    const pairs: AdversarialPair[] = landscape.adversarial_pairs ?? []
    return pairs.map(pair => {
      const nodesA = clusterGroupMap.get(pair.cluster_id_a)
      const nodesB = clusterGroupMap.get(pair.cluster_id_b)
      if (!nodesA?.length || !nodesB?.length) return null
      const [cx1, cy1] = computeCentroid(nodesA)
      const [cx2, cy2] = computeCentroid(nodesB)
      return { pair, x1: cx1, y1: cy1, x2: cx2, y2: cy2 }
    }).filter((l): l is NonNullable<typeof l> => l !== null)
  }, [landscape.adversarial_pairs, clusterGroupMap, simVersion])

  // D3 force simulation — extracted to dedicated hook
  useForceSimulation({
    svgRef,
    nodes,
    dimensions,
    conceptGroupMap,
    clusterGroupMap,
    adversarialPairs: landscape.adversarial_pairs ?? [],
    isMobile,
    onSettled: () => setSimVersion(v => v + 1),
  })

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

  // Mutation arrows for concept centroids
  const mutationArrows = useMemo(() => {
    const concepts = landscape.concepts ?? []
    const arrows: Array<{ x: number; y: number; direction: string; label: string }> = []
    for (const concept of concepts) {
      if (concept.mutation_direction === 'stable') continue
      const conceptNodes = conceptGroupMap.get(concept.id)
      if (!conceptNodes?.length) continue
      const [cx, cy] = computeCentroid(conceptNodes)
      arrows.push({ x: cx, y: cy, direction: concept.mutation_direction, label: concept.label })
    }
    return arrows
  }, [landscape.concepts, conceptGroupMap, simVersion])

  // Concept label positions
  const MAX_VISIBLE_LABELS = 8

  const conceptLabels = useMemo(() => {
    const concepts = landscape.concepts ?? []
    // Sort by member_count descending — show all concept labels
    const sorted = [...concepts].sort((a, b) => b.member_count - a.member_count)
    return sorted.flatMap((concept) => {
      const cn = conceptGroupMap.get(concept.id)
      if (!cn?.length) return []
      const [centX] = computeCentroid(cn)
      const cy = Math.max(...cn.map(n => (n.y ?? 0) + (n.radius ?? 8))) + 16
      return [{ concept, cx: centX, cy, visible: true }]
    }).slice(0, MAX_VISIBLE_LABELS)
  }, [landscape.concepts, conceptGroupMap, simVersion])

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
      const x = event.clientX, y = event.clientY
      hoverTimeoutRef.current = window.setTimeout(() => {
        setTooltip({ claim: node.claim, cluster: node.cluster, momentum: node.momentum, friction: node.friction, persistence: node.persistence, x, y })
      }, 300)
    } else {
      hoverTimeoutRef.current = window.setTimeout(() => {
        setTooltip(null)
      }, 200)
    }
  }, [])

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        style={{ touchAction: isMobile ? 'none' : undefined }}
        onClick={handleBackgroundClick}
      >
        <g ref={gRef}>
          {/* Density glow — radial gradient per concept */}
          {conceptHulls.map(hull => {
            const color = getMutationColor(hull.mutation_direction as 'mainstreaming' | 'radicalizing' | 'fragmenting' | 'stable')
            const cNodes = conceptGroupMap.get(hull.conceptId)
            const glowR = cNodes ? Math.max(40, cNodes.length * 3 + 30) : 60
            return (
              <circle
                key={`glow-${hull.conceptId}`}
                className="density-glow"
                data-concept-id={hull.conceptId}
                cx={hull.cx}
                cy={hull.cy}
                r={glowR}
                fill={color}
                fillOpacity={0.04}
                style={{ filter: `blur(${Math.round(glowR * 0.6)}px)` }}
                pointerEvents="none"
              />
            )
          })}

          {/* Contour rings — multiple concentric hulls per concept */}
          {conceptHulls.map(hull => {
            const color = getMutationColor(hull.mutation_direction as 'mainstreaming' | 'radicalizing' | 'fragmenting' | 'stable')
            return hull.paths.map((path, ringIdx) => (
              <path
                key={`${hull.conceptId}-ring-${ringIdx}`}
                className="cluster-hull"
                data-concept-id={hull.conceptId}
                data-ring-idx={ringIdx}
                d={path}
                fill={ringIdx === 0 ? color : 'none'}
                fillOpacity={CONTOUR_OPACITIES[ringIdx]}
                stroke={color}
                strokeOpacity={CONTOUR_STROKE_OPACITIES[ringIdx]}
                strokeWidth={ringIdx === 0 ? 1 : 0.5}
                pointerEvents="none"
              />
            ))
          })}

          {/* Inter-node connection lines within clusters */}
          {Array.from(conceptGroupMap.entries()).map(([conceptId, cNodes]) => {
            if (cNodes.length < 2) return null
            // For performance: nearest pairs only (max 5 connections per node)
            const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
            const maxConns = cNodes.length > 20 ? 3 : 5
            for (let i = 0; i < cNodes.length; i++) {
              const dists = cNodes.map((n, j) => ({
                j,
                d: j === i ? Infinity : Math.hypot((n.x ?? 0) - (cNodes[i].x ?? 0), (n.y ?? 0) - (cNodes[i].y ?? 0)),
              })).sort((a, b) => a.d - b.d)
              for (let k = 0; k < Math.min(maxConns, dists.length); k++) {
                const j = dists[k].j
                if (j > i) { // avoid duplicate lines
                  lines.push({
                    x1: cNodes[i].x ?? 0, y1: cNodes[i].y ?? 0,
                    x2: cNodes[j].x ?? 0, y2: cNodes[j].y ?? 0,
                  })
                }
              }
            }
            return (
              <g key={`conn-${conceptId}`} className="cluster-connections" data-concept-id={conceptId}>
                {lines.map((l, i) => (
                  <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                    stroke="rgba(148,163,184,0.04)" strokeWidth={0.5} pointerEvents="none" />
                ))}
              </g>
            )
          })}

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
                transition: 'fill-opacity 200ms ease, r 200ms ease',
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

        {/* Concept labels */}
        {conceptLabels.filter(l => l.visible).map(({ concept, cx, cy }) => {
          const rawLabel = concept.label
          const label = rawLabel.length > 28 ? rawLabel.slice(0, 28).trimEnd() + '...' : rawLabel
          const badgeW = Math.max(60, Math.min(220, label.length * 7 + 16))
          return (
            <g
              key={`clbl-${concept.id}`}
              className="concept-label-g"
              data-concept-id={concept.id}
              style={{ cursor: 'default' }}
            >
              <rect
                x={cx - badgeW / 2}
                y={cy - 2}
                width={badgeW}
                height={16}
                rx={4}
                fill="rgba(19,31,48,0.85)"
                stroke="rgba(71,85,105,0.6)"
                strokeWidth={0.8}
                style={{ transition: 'x 150ms ease, y 150ms ease' }}
              />
              <text
                x={cx}
                y={cy + 9}
                textAnchor="middle"
                fill="rgba(148,163,184,0.5)"
                fontSize={9}
                fontWeight={600}
                fontFamily="var(--font-data, JetBrains Mono, monospace)"
                letterSpacing="0.4"
                style={{ transition: 'x 150ms ease, y 150ms ease' }}
              >
                {label}
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

      {/* Persistent spatial annotation — always visible, low opacity */}
      <div
        className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none"
        style={{ opacity: 0.22 }}
      >
        <span
          style={{
            fontSize: '9px',
            color: '#94A3B8',
            fontFamily: 'var(--font-data, "JetBrains Mono", monospace)',
            letterSpacing: '0.6px',
          }}
        >
          · proximity = semantic similarity ·
        </span>
      </div>

      {/* Topology Legend */}
      <Legend />

      {/* Tooltip overlay */}
      {tooltip && (
        <ClaimTooltip
          claim={tooltip.claim}
          cluster={tooltip.cluster}
          momentum={tooltip.momentum}
          friction={tooltip.friction}
          persistence={tooltip.persistence}
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
