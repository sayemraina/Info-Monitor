/**
 * Client-side metric computation — Phase B of the architecture.
 * Pure functions on structured JSON. No API calls. No secrets.
 *
 * Currently implements: JSD divergence + typology for instant slice switching.
 */

import type {
  Claim,
  Cluster,
  CompareData,
  Divergence,
  DivergenceTypology,
  LandscapeData,
  PerClusterComparison,
  Slice,
} from '../types'

// --- Jensen-Shannon Divergence ---

/** KL divergence: D_KL(p || q). Assumes p and q are normalized. */
function klDivergence(p: number[], q: number[]): number {
  let sum = 0
  for (let i = 0; i < p.length; i++) {
    if (p[i] > 0 && q[i] > 0) {
      sum += p[i] * Math.log2(p[i] / q[i])
    }
  }
  return sum
}

/** Jensen-Shannon Divergence between two distributions. Returns value in [0, 1]. */
export function computeJSD(p: number[], q: number[]): number {
  const m = p.map((pi, i) => (pi + q[i]) / 2)
  return (klDivergence(p, m) + klDivergence(q, m)) / 2
}

// --- Typology Scores ---

/** Spearman rank correlation between two arrays. Returns value in [-1, 1]. */
function spearmanRank(a: number[], b: number[]): number {
  const n = a.length
  if (n < 2) return 0

  const rank = (arr: number[]): number[] => {
    const sorted = arr.map((v, i) => ({ v, i })).sort((x, y) => y.v - x.v)
    const ranks = new Array(n)
    sorted.forEach((item, r) => { ranks[item.i] = r + 1 })
    return ranks
  }

  const ra = rank(a)
  const rb = rank(b)
  let dSquaredSum = 0
  for (let i = 0; i < n; i++) {
    const d = ra[i] - rb[i]
    dSquaredSum += d * d
  }
  return 1 - (6 * dSquaredSum) / (n * (n * n - 1))
}

/**
 * Compute divergence typology scores from two per-cluster salience distributions.
 * - Information Asymmetry: max salience ratio between the two slices (0-1)
 * - Interpretive: 1 - Spearman rank correlation (0-2, clamped to 0-1)
 * - Paradigmatic: 1 - overlap coefficient (0-1)
 */
export function computeTypology(distA: number[], distB: number[]): DivergenceTypology {
  // Information asymmetry: max ratio of salience difference to total
  let maxRatio = 0
  for (let i = 0; i < distA.length; i++) {
    const total = distA[i] + distB[i]
    if (total > 0) {
      const ratio = Math.abs(distA[i] - distB[i]) / total
      maxRatio = Math.max(maxRatio, ratio)
    }
  }
  const information_asymmetry = Math.min(maxRatio, 1)

  // Interpretive: 1 - Spearman rank correlation (0 = identical ranking, 1 = opposite)
  const rho = spearmanRank(distA, distB)
  const interpretive = Math.max(0, Math.min(1, (1 - rho) / 2))

  // Paradigmatic: 1 - overlap coefficient
  const sumA = distA.reduce((s, v) => s + v, 0)
  const sumB = distB.reduce((s, v) => s + v, 0)
  let overlap = 0
  if (sumA > 0 && sumB > 0) {
    const normA = distA.map(v => v / sumA)
    const normB = distB.map(v => v / sumB)
    overlap = normA.reduce((s, v, i) => s + Math.min(v, normB[i]), 0)
  }
  const paradigmatic = Math.max(0, 1 - overlap)

  // Dominant mode
  const scores = { information_asymmetry, interpretive, paradigmatic }
  const dominant_mode = Object.entries(scores).reduce((a, b) => a[1] > b[1] ? a : b)[0]
  const modeLabels: Record<string, string> = {
    information_asymmetry: 'Information Asymmetry',
    interpretive: 'Interpretive',
    paradigmatic: 'Paradigmatic',
  }

  return {
    information_asymmetry,
    interpretive,
    paradigmatic,
    dominant_mode: modeLabels[dominant_mode] ?? dominant_mode,
    paradigmatic_caveat: false,
  }
}

// --- Slice Distribution Building ---

/**
 * Build per-cluster salience distribution for a given platform slice.
 * Salience = sum of platform_presence[sliceKey] for claims in cluster / total across all clusters.
 */
export function buildSliceDistribution(
  claims: Claim[],
  clusters: Cluster[],
  sliceKey: string,
): number[] {
  const clusterIds = clusters.map(c => c.id)
  const raw = new Array(clusterIds.length).fill(0)

  for (const claim of claims) {
    const presence = claim.platform_presence?.[sliceKey] ?? 0
    const idx = clusterIds.indexOf(claim.cluster_id)
    if (idx >= 0) {
      raw[idx] += presence
    }
  }

  // Normalize to distributional shares
  const total = raw.reduce((s, v) => s + v, 0)
  if (total === 0) return raw.map(() => 1 / Math.max(clusterIds.length, 1))
  return raw.map(v => v / total)
}

// --- Full Compare Computation ---

/** Derive slice label from slice key. */
function sliceLabel(key: string): string {
  const labels: Record<string, string> = {
    x_platform: 'X Platform',
    reddit_platform: 'Reddit Platform',
    youtube_influencer: 'YouTube Influencer',
  }
  return labels[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Compute full CompareData from landscape data and two slice keys.
 * This is the main entry point for client-side divergence computation.
 */
export function computeCompareData(
  landscape: LandscapeData,
  sliceAKey: string,
  sliceBKey: string,
): CompareData {
  const { claims, clusters } = landscape

  const distA = buildSliceDistribution(claims, clusters, sliceAKey)
  const distB = buildSliceDistribution(claims, clusters, sliceBKey)

  // JSD
  const jsd = computeJSD(distA, distB)
  const jsd_sqrt = Math.sqrt(jsd)

  // Typology
  const typology = computeTypology(distA, distB)

  // Per-cluster comparison
  const per_cluster: PerClusterComparison[] = clusters.map((cluster, i) => {
    // Arousal per slice: average arousal of claims in this cluster weighted by platform presence
    const clusterClaims = claims.filter(c => c.cluster_id === cluster.id)
    const arousalNum = (key: string) => {
      let weightedSum = 0
      let totalWeight = 0
      for (const c of clusterClaims) {
        const w = c.platform_presence?.[key] ?? 0
        const arousalVal = c.arousal === 'high' ? 0.8 : c.arousal === 'medium' ? 0.5 : 0.2
        weightedSum += arousalVal * w
        totalWeight += w
      }
      return totalWeight > 0 ? weightedSum / totalWeight : 0.5
    }

    return {
      cluster_id: cluster.id,
      label: cluster.label,
      salience_a: distA[i],
      salience_b: distB[i],
      arousal_a: parseFloat(arousalNum(sliceAKey).toFixed(2)),
      arousal_b: parseFloat(arousalNum(sliceBKey).toFixed(2)),
      mutation_a: cluster.mutation_direction,
      mutation_b: cluster.mutation_direction,
    }
  })

  // Arousal comparison: weighted average across all claims per slice
  const arousalAvg = (key: string): number => {
    let weightedSum = 0
    let totalWeight = 0
    for (const c of claims) {
      const w = c.platform_presence?.[key] ?? 0
      const arousalVal = c.arousal === 'high' ? 0.8 : c.arousal === 'medium' ? 0.5 : 0.2
      weightedSum += arousalVal * w
      totalWeight += w
    }
    return totalWeight > 0 ? parseFloat((weightedSum / totalWeight).toFixed(2)) : 0.5
  }

  // Count active volume per slice
  const volumeA = claims.reduce((s, c) => s + (c.platform_presence?.[sliceAKey] ?? 0), 0)
  const volumeB = claims.reduce((s, c) => s + (c.platform_presence?.[sliceBKey] ?? 0), 0)
  const totalVol = volumeA + volumeB

  const makeSlice = (key: string, vol: number): Slice => ({
    id: key,
    type: 'platform',
    label: sliceLabel(key),
    active_volume: Math.round(vol),
    meets_minimum_threshold: vol > 10,
    base_rate_weight: totalVol > 0 ? parseFloat((vol / totalVol).toFixed(2)) : 0.5,
    is_influencer_framing: key === 'youtube_influencer',
  })

  const divergence: Divergence = {
    jsd,
    jsd_sqrt,
    trend: [jsd_sqrt], // Single point — no history available client-side
    typology,
  }

  // Exposure proxy: volume share × average confidence per slice
  const exposureProxy = (key: string): number => {
    let weightedConf = 0
    let totalWeight = 0
    for (const c of claims) {
      const w = c.platform_presence?.[key] ?? 0
      weightedConf += c.confidence * w
      totalWeight += w
    }
    const avgConf = totalWeight > 0 ? weightedConf / totalWeight : 0.5
    const volShare = totalVol > 0 ? (key === sliceAKey ? volumeA : volumeB) / totalVol : 0.5
    return parseFloat(Math.min(1, volShare * avgConf * 2).toFixed(4))
  }

  const makeExposureMetric = (val: number) => ({
    value: val,
    confidence_interval: [Math.max(0, val - 0.15), Math.min(1, val + 0.15)] as [number, number],
    baseline: 'global' as const,
    time_window: '24h' as const,
    sparkline: [val],
    source_distribution: 'estimated_exposure' as const,
  })

  return {
    slice_a: makeSlice(sliceAKey, volumeA),
    slice_b: makeSlice(sliceBKey, volumeB),
    divergence,
    per_cluster,
    arousal_comparison: {
      slice_a_avg: arousalAvg(sliceAKey),
      slice_b_avg: arousalAvg(sliceBKey),
    },
    exposure_comparison: {
      slice_a: makeExposureMetric(exposureProxy(sliceAKey)),
      slice_b: makeExposureMetric(exposureProxy(sliceBKey)),
    },
  }
}
