import { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { TopicSummary, GeoCluster, EntryHint } from '../../types'
import { useGeoData } from '../../hooks/useGeoData'
import { useIsMobile } from '../../hooks/useIsMobile'
import { getMomentumColor } from '../../utils/colors'
import { MapSearchPanel } from './MapSearchPanel'

// Describe momentum in plain language
function momentumLabel(m: number): string {
  if (m >= 0.5) return 'rapidly accelerating'
  if (m >= 0.1) return 'accelerating'
  if (m > -0.1) return 'stable'
  if (m > -0.5) return 'decelerating'
  return 'rapidly decelerating'
}

// Geographic labels to overlay on the dark ocean/country voids
const GEO_LABELS: { lngLat: [number, number]; text: string }[] = [
  { lngLat: [-138, 35], text: 'PACIFIC OCEAN' },
  { lngLat: [-64, 36],  text: 'ATLANTIC OCEAN' },
  { lngLat: [-95, 60],  text: 'CANADA' },
  { lngLat: [-102, 23], text: 'MEXICO' },
]

interface NarrativeMapProps {
  activeTopic: string
  topics: TopicSummary[]
  onSelectTopic: (topicId: string, hint?: EntryHint, clusterId?: string) => void
  onLockTopic: (topicId: string) => void
  searchQuery: string
}

// Inline dark style with US state boundaries — no external tile CDN needed
const DARK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'us-states': {
      type: 'geojson',
      data: '/data/geo/us-states.json',
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#0A1220' },
    },
    {
      id: 'state-fills',
      type: 'fill',
      source: 'us-states',
      paint: {
        'fill-color': '#111D2B',
        'fill-opacity': 0.7,
      },
    },
    {
      id: 'state-borders',
      type: 'line',
      source: 'us-states',
      paint: {
        'line-color': 'rgba(148,163,184,0.18)',
        'line-width': 0.8,
      },
    },
  ],
}

// Build GeoJSON from geo clusters — balanced selection for spread, color variety, and coverage
function clustersToGeoJSON(clusters: GeoCluster[]) {
  const TARGET_DOTS = 25
  const MIN_DISTANCE = 1.0 // degrees (~60mi) — prevents dots from stacking on same city

  type Entry = { cluster: GeoCluster; region: GeoCluster['regions'][0]; colorBucket: string }
  const allRegions: Entry[] = []
  for (const cluster of clusters) {
    for (const region of cluster.regions) {
      const m = region.momentum
      const colorBucket = m >= 0.5 ? 'red' : m >= 0.1 ? 'amber' : m > -0.1 ? 'silver' : m > -0.5 ? 'teal' : 'blue'
      allRegions.push({ cluster, region, colorBucket })
    }
  }

  const selected: Entry[] = []
  const isTooClose = (r: GeoCluster['regions'][0]) =>
    selected.some(s => {
      const dLat = s.region.lat - r.lat
      const dLng = s.region.lng - r.lng
      return dLat * dLat + dLng * dLng < MIN_DISTANCE * MIN_DISTANCE
    })

  // Pass 1: One dot per cluster (highest salience), enforcing spacing
  const usedClusters = new Set<string>()
  const bySalience = [...allRegions].sort((a, b) => b.region.salience - a.region.salience)
  for (const entry of bySalience) {
    if (!usedClusters.has(entry.cluster.cluster_id) && !isTooClose(entry.region)) {
      selected.push(entry)
      usedClusters.add(entry.cluster.cluster_id)
    }
  }
  // Ensure every cluster represented even if spacing conflict
  for (const entry of bySalience) {
    if (!usedClusters.has(entry.cluster.cluster_id)) {
      selected.push(entry)
      usedClusters.add(entry.cluster.cluster_id)
    }
  }

  // Pass 2: Ensure color variety — add at least one of each available color
  const colorsPresent = new Set(selected.map(e => e.colorBucket))
  const availableColors = new Set(allRegions.map(e => e.colorBucket))
  for (const color of availableColors) {
    if (colorsPresent.has(color) || selected.length >= TARGET_DOTS) continue
    // Find best candidate of this color that isn't too close
    const candidates = bySalience.filter(e => e.colorBucket === color && !selected.includes(e))
    for (const c of candidates) {
      if (!isTooClose(c.region)) {
        selected.push(c)
        colorsPresent.add(color)
        break
      }
    }
  }

  // Pass 3: Fill remaining slots with geographic spread, round-robin by cluster for balance
  const remaining = bySalience.filter(e => !selected.includes(e))
  // Group remaining by cluster
  const byCluster = new Map<string, Entry[]>()
  for (const e of remaining) {
    const cid = e.cluster.cluster_id
    if (!byCluster.has(cid)) byCluster.set(cid, [])
    byCluster.get(cid)!.push(e)
  }
  // Round-robin: take one from each cluster in turn
  let added = true
  while (selected.length < TARGET_DOTS && added) {
    added = false
    for (const [, entries] of byCluster) {
      if (selected.length >= TARGET_DOTS) break
      for (let i = 0; i < entries.length; i++) {
        if (!selected.includes(entries[i]) && !isTooClose(entries[i].region)) {
          selected.push(entries[i])
          entries.splice(i, 1)
          added = true
          break
        }
      }
    }
  }

  const features: GeoJSON.Feature[] = selected.map(({ cluster, region }) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [region.lng, region.lat] },
    properties: {
      cluster_label: cluster.cluster_label,
      cluster_id: cluster.cluster_id,
      salience: region.salience,
      momentum: region.momentum,
      color: getMomentumColor(region.momentum),
      radius: 6 + region.salience * 18,
      isPulsing: region.salience > 0.7 ? 1 : 0,
    },
  }))
  return { type: 'FeatureCollection' as const, features }
}

export function NarrativeMap({ activeTopic, topics, onSelectTopic, onLockTopic, searchQuery }: NarrativeMapProps) {
  const isMobile = useIsMobile()
  const { geoData } = useGeoData(activeTopic)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const mapInitialized = useRef(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const tooltipHideTimer = useRef<number>(0)
  const [mapReady, setMapReady] = useState(false)
  const [geoLabelPositions, setGeoLabelPositions] = useState<{ x: number; y: number; text: string }[]>([])
  const [hotspotLabels, setHotspotLabels] = useState<{ x: number; y: number; label: string; color: string }[]>([])
  const [ctaHovered, setCtaHovered] = useState(false)
  const activeTopicRef = useRef(activeTopic)
  activeTopicRef.current = activeTopic
  // Store raw lng/lat for hotspot labels so we can reproject on map drag
  const hotspotRawRef = useRef<{ lng: number; lat: number; label: string; color: string }[]>([])


  // Get active topic name for CTA button
  const activeTopicName = topics.find(t => t.id === activeTopic)?.name ?? activeTopic

  // Initialize map once — guard with mapInitialized ref to survive React StrictMode
  // double-invocation (map.remove() + re-create on same container breaks MapLibre load event)
  useEffect(() => {
    if (!containerRef.current || mapInitialized.current) return
    mapInitialized.current = true

    // Use fitBounds with left padding to auto-center the continental US
    // in the visible area (accounting for the search panel overlay).
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DARK_STYLE,
      center: [-96, 38],
      zoom: 3.3,
      minZoom: 2.5,
      maxZoom: 7,
      maxBounds: [[-170, 10], [-30, 60]],
      bearing: 0,
      pitch: 0,
      maxPitch: 0,
      attributionControl: false,
      scrollZoom: true,
      dragRotate: false,
      pitchWithRotate: false,
      touchZoomRotate: true,
    })

    // Fit the continental US bounds with padding for the left sidebar.
    // This auto-centers regardless of viewport size.
    map.fitBounds(
      [[-125, 24], [-66, 50]], // SW corner (SoCal/Texas) to NE corner (Maine)
      { padding: { left: isMobile ? 16 : 230, top: 10, right: 10, bottom: 10 }, duration: 0 }
    )

    map.on('load', () => {
      // Add empty GeoJSON source for heat zones
      map.addSource('heat-zones', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      // Outer glow — warm diffuse halo
      map.addLayer({
        id: 'heat-glow',
        type: 'circle',
        source: 'heat-zones',
        paint: {
          'circle-radius': ['*', ['get', 'radius'], 2.2],
          'circle-color': ['get', 'color'],
          'circle-opacity': ['+', 0.06, ['*', ['get', 'salience'], 0.10]],
          'circle-blur': 1,
        },
      })

      // Core circle — saturated center
      map.addLayer({
        id: 'heat-core',
        type: 'circle',
        source: 'heat-zones',
        paint: {
          'circle-radius': ['get', 'radius'],
          'circle-color': ['get', 'color'],
          'circle-opacity': ['+', 0.25, ['*', ['get', 'salience'], 0.35]],
          'circle-blur': 0.4,
        },
      })

      // Center dot — bright point
      map.addLayer({
        id: 'heat-dot',
        type: 'circle',
        source: 'heat-zones',
        paint: {
          'circle-radius': 3,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.9,
        },
      })

      // Pulsing glow layer (for high-salience zones)
      map.addLayer({
        id: 'heat-pulse',
        type: 'circle',
        source: 'heat-zones',
        filter: ['==', ['get', 'isPulsing'], 1],
        paint: {
          'circle-radius': ['*', ['get', 'radius'], 2.8],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.06,
          'circle-blur': 1.2,
        },
      })

      // Compute geographic label pixel positions
      const projectGeoLabels = () => {
        const positions = GEO_LABELS.map(({ lngLat, text }) => {
          const pt = map.project(lngLat)
          return { x: pt.x, y: pt.y, text }
        })
        setGeoLabelPositions(positions)
      }

      // Reproject hotspot labels from stored lng/lat
      const projectHotspotLabels = () => {
        const raw = hotspotRawRef.current
        if (raw.length === 0) return
        const labels = raw.map(r => {
          const pt = map.project([r.lng, r.lat])
          return { x: pt.x, y: pt.y - 20, label: r.label, color: r.color }
        })
        setHotspotLabels(labels)
      }

      projectGeoLabels()

      // Reproject all overlay labels on every map move (drag/zoom)
      map.on('move', () => {
        projectGeoLabels()
        projectHotspotLabels()
      })

      mapRef.current = map
      setMapReady(true)
    })

    // Hover tooltip — rich narrative explanation
    map.on('mouseenter', 'heat-core', (e) => {
      map.getCanvas().style.cursor = 'pointer'
      if (tooltipHideTimer.current) clearTimeout(tooltipHideTimer.current)
      if (!e.features?.[0] || !tooltipRef.current) return
      const props = e.features[0].properties!
      const salience = typeof props.salience === 'number' ? props.salience : parseFloat(props.salience)
      const momentum = typeof props.momentum === 'number' ? props.momentum : parseFloat(props.momentum)
      const color = props.color as string
      const mLabel = momentumLabel(momentum)
      const salienceStr = salience >= 0.7 ? 'dominant' : salience >= 0.4 ? 'notable' : 'emerging'

      tooltipRef.current.innerHTML = `
        <div style="font-weight:600;margin-bottom:4px;font-size:11px">${props.cluster_label}</div>
        <div style="color:rgba(203,213,225,0.85);margin-bottom:6px;line-height:1.5;white-space:normal">
          The <strong style="color:#F1F5F9">"${props.cluster_label}"</strong> narrative is
          <strong style="color:#F1F5F9">${salienceStr}</strong> in this region and
          <strong style="color:${color}">${mLabel}</strong>.
        </div>
        <div style="display:flex;gap:12px;padding-top:5px;border-top:1px solid rgba(148,163,184,0.12)">
          <span style="color:rgba(148,163,184,0.6)">Salience <span style="color:#F1F5F9;font-weight:600">${(salience * 100).toFixed(0)}%</span></span>
          <span style="color:rgba(148,163,184,0.6)">Momentum <span style="color:${color};font-weight:600">${momentum > 0 ? '+' : ''}${(momentum * 100).toFixed(0)}%</span></span>
        </div>
        <div style="margin-top:6px;padding-top:5px;border-top:1px solid rgba(148,163,184,0.08);text-align:center;font-size:9px;color:#06B6D4;letter-spacing:0.5px;cursor:pointer">
          Click to explore full topology →
        </div>
      `
      tooltipRef.current.style.display = 'block'
      const tooltipW = 280
      const vw = window.innerWidth
      const clampedX = Math.max(8, Math.min(vw - tooltipW - 8, e.point.x + 16))
      tooltipRef.current.style.left = `${clampedX}px`
      tooltipRef.current.style.top = `${e.point.y - 50}px`
    })

    map.on('mouseleave', 'heat-core', () => {
      map.getCanvas().style.cursor = ''
      // Delay hide so user can move mouse into tooltip to click
      tooltipHideTimer.current = window.setTimeout(() => {
        if (tooltipRef.current) tooltipRef.current.style.display = 'none'
      }, 300)
    })

    map.on('mousemove', 'heat-core', (e) => {
      if (tooltipRef.current) {
        const tw = 280
        const vw2 = window.innerWidth
        const cx = Math.max(8, Math.min(vw2 - tw - 8, e.point.x + 16))
        tooltipRef.current.style.left = `${cx}px`
        tooltipRef.current.style.top = `${e.point.y - 40}px`
      }
    })

    // Click heat zone → Level 1 with cluster context
    map.on('click', 'heat-core', (e) => {
      const clusterId = e.features?.[0]?.properties?.cluster_id as string | undefined
      onSelectTopic(activeTopicRef.current, 'map_hotspot', clusterId)
    })

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Animate pulsing layer
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    let frame: number
    let t = 0

    const animate = () => {
      t += 0.03
      const pulse = 0.03 + Math.sin(t) * 0.03
      try {
        map.setPaintProperty('heat-pulse', 'circle-opacity', pulse)
      } catch { /* map may be removed */ }
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [mapReady])

  // Update GeoJSON data when topic / geoData changes + compute hotspot labels
  const updateSource = useCallback(() => {
    if (!mapRef.current || !mapReady) return
    const map = mapRef.current
    const source = map.getSource('heat-zones') as maplibregl.GeoJSONSource | undefined
    if (!source) return

    const geojson = geoData?.geo_clusters
      ? clustersToGeoJSON(geoData.geo_clusters)
      : { type: 'FeatureCollection' as const, features: [] }

    source.setData(geojson)

    // Compute persistent labels for top 3 highest-salience hotspots
    if (geoData?.geo_clusters) {
      const allRegions: { label: string; lat: number; lng: number; salience: number; momentum: number }[] = []
      for (const c of geoData.geo_clusters) {
        for (const r of c.regions) {
          allRegions.push({ label: c.cluster_label, lat: r.lat, lng: r.lng, salience: r.salience, momentum: r.momentum })
        }
      }
      // Dedupe by label — keep highest salience per cluster
      const byLabel = new Map<string, typeof allRegions[0]>()
      for (const r of allRegions) {
        const existing = byLabel.get(r.label)
        if (!existing || r.salience > existing.salience) byLabel.set(r.label, r)
      }
      const top3 = [...byLabel.values()].sort((a, b) => b.salience - a.salience).slice(0, 3)
      // Store raw coordinates so the map 'move' handler can reproject
      const raw = top3.map(r => ({ lng: r.lng, lat: r.lat, label: r.label, color: getMomentumColor(r.momentum) }))
      hotspotRawRef.current = raw
      const labels = raw.map(r => {
        const pt = map.project([r.lng, r.lat])
        return { x: pt.x, y: pt.y - 20, label: r.label, color: r.color }
      })
      setHotspotLabels(labels)
    } else {
      hotspotRawRef.current = []
      setHotspotLabels([])
    }
  }, [geoData, mapReady])

  useEffect(() => {
    updateSource()
  }, [updateSource])

  return (
    <div className="w-full h-full relative" style={{ overflow: 'hidden' }} onWheel={e => e.stopPropagation()}>
      {/* MapLibre GL container */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Geographic label overlays — ghost text for ocean/country voids */}
      {geoLabelPositions.map(({ x, y, text }) => (
        <div
          key={text}
          className="absolute pointer-events-none select-none"
          style={{
            left: x,
            top: y,
            transform: 'translate(-50%, -50%)',
            fontSize: '9px',
            color: 'rgba(148,163,184,0.18)',
            letterSpacing: '2.5px',
            fontFamily: 'Inter, sans-serif',
            whiteSpace: 'nowrap',
            zIndex: 2,
          }}
        >
          {text}
        </div>
      ))}

      {/* Tooltip — interactive so user can click "explore topology" */}
      <div
        ref={tooltipRef}
        className="absolute font-data"
        onMouseEnter={() => { if (tooltipHideTimer.current) clearTimeout(tooltipHideTimer.current) }}
        onMouseLeave={() => { if (tooltipRef.current) tooltipRef.current.style.display = 'none' }}
        onClick={() => onSelectTopic(activeTopicRef.current)}
        style={{
          display: 'none',
          background: 'rgba(15,25,35,0.95)',
          border: '1px solid rgba(148,163,184,0.2)',
          borderRadius: '6px',
          padding: '8px 12px',
          fontSize: '10px',
          color: '#F1F5F9',
          maxWidth: isMobile ? 'calc(100vw - 32px)' : '280px',
          zIndex: 50,
          whiteSpace: 'normal',
          cursor: 'pointer',
        }}
      />

      {/* Persistent hotspot labels — top 3 clusters by salience */}
      {hotspotLabels.map(({ x, y, label, color }) => (
        <div
          key={label}
          className="absolute pointer-events-none select-none font-data"
          style={{
            left: x,
            top: y,
            transform: 'translate(-50%, -100%)',
            fontSize: '8px',
            fontWeight: 600,
            color,
            textShadow: '0 1px 4px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.9)',
            whiteSpace: 'nowrap',
            zIndex: 4,
            letterSpacing: '0.3px',
          }}
        >
          {label}
        </div>
      ))}

      {/* Legend — bottom-right, explains what the hotspots mean (hidden on mobile) */}
      {mapReady && !isMobile && (
        <div
          className="font-data"
          style={{
            position: 'absolute',
            bottom: '16px',
            right: '16px',
            zIndex: 10,
            background: 'rgba(3,5,8,0.82)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(148,163,184,0.12)',
            borderRadius: '4px',
            padding: '8px 10px',
            fontSize: '7.5px',
            lineHeight: '1.6',
            color: 'rgba(148,163,184,0.6)',
            width: '150px',
          }}
        >
          <div style={{ fontSize: '8px', fontWeight: 600, color: '#94A3B8', marginBottom: '5px', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
            Narrative Hotspots
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
            <span>Accelerating</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
            <span>Gaining traction</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#94A3B8', flexShrink: 0 }} />
            <span>Stable</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#14B8A6', flexShrink: 0 }} />
            <span>Decelerating</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6', flexShrink: 0 }} />
            <span>Fading</span>
          </div>
          <div style={{ borderTop: '1px solid rgba(148,163,184,0.1)', paddingTop: '4px', fontSize: '7px', color: 'rgba(241,245,249,0.75)' }}>
            Size = regional salience<br />
            Pulse = high activity<br />
            Hover hotspot for details
          </div>
        </div>
      )}

      {/* CTA button — bottom-left under search panel, navigates to Level 1 */}
      {mapReady && (
        <button
          onClick={() => onSelectTopic(activeTopicRef.current, 'explore')}
          onMouseEnter={() => setCtaHovered(true)}
          onMouseLeave={() => setCtaHovered(false)}
          className="cursor-pointer font-data"
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '16px',
            width: '210px',
            maxWidth: isMobile ? 'calc(100vw - 32px)' : undefined,
            zIndex: 10,
            background: ctaHovered ? 'rgba(6,182,212,0.08)' : 'rgba(3,5,8,0.78)',
            backdropFilter: 'blur(8px)',
            border: `1px solid ${ctaHovered ? 'rgba(6,182,212,0.45)' : 'rgba(6,182,212,0.2)'}`,
            borderRadius: '4px',
            padding: '6px 10px',
            fontSize: '8.5px',
            transition: 'all 150ms ease',
            textAlign: 'center',
            lineHeight: '1.4',
          }}
        >
          <span style={{ color: '#94A3B8', fontWeight: 600 }}>View full narrative analysis / topology for</span>
          <br />
          <span style={{ color: '#F1F5F9', fontWeight: 600 }}>{activeTopicName}</span>
          <span style={{ color: '#06B6D4' }}> →</span>
        </button>
      )}

      {/* Search panel overlay — floating top-left */}
      <MapSearchPanel
        topics={topics}
        activeTopic={activeTopic}
        searchQuery={searchQuery}
        onLockTopic={onLockTopic}
        onNavigateToLevel1={onSelectTopic}
      />
    </div>
  )
}
