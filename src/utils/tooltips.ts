import type { TooltipContent, DivergenceTypology } from '../types'

export function salience(
  value: number,
  baseline: string,
  percentile: number,
  shrinkageApplied: boolean = false,
): TooltipContent {
  return {
    title: 'Salience',
    calculation: `Overrepresentation relative to ${baseline} baseline. Measures whether this claim is disproportionately present in this slice.`,
    reading: `This claim is at the ${percentile}th percentile — ${value.toFixed(1)}× more present than expected.${shrinkageApplied ? ' Shrinkage applied for small sample.' : ''}`,
    caveat: baseline === 'global' ? 'Baseline: global (all content across all slices).' : undefined,
  }
}

export function momentum(
  _value: number,
  percentileFrom: number,
  percentileTo: number,
  hours: number,
  sourceCount: number,
  bridgeRatio: number,
): TooltipContent {
  return {
    title: 'Momentum',
    calculation: 'Rate of change in distributional position within a slice over a time window.',
    reading: `${percentileFrom}th → ${percentileTo}th percentile in ${hours}h. Source diversity: ${sourceCount} independent accounts${bridgeRatio > 0.1 ? `. Bridge nodes: ${(bridgeRatio * 100).toFixed(0)}% of amplifiers engage across 3+ communities.` : '.'}`,
  }
}

export function friction(value: number, quadrant: string): TooltipContent {
  const quadrantLabels: Record<string, string> = {
    unopposed_advance: 'Unopposed Advance (high momentum + low friction)',
    contested_advance: 'Contested Advance (high momentum + high friction)',
    successful_suppression: 'Successful Suppression (low momentum + high friction)',
    dead: 'Dead Narrative (low momentum + low friction)',
  }

  return {
    title: 'Friction',
    calculation: 'Ratio of oppositional engagement (disagreement replies, counter-claims) to total engagement.',
    reading: `${value.toFixed(2)} = ${value > 0.6 ? 'heavily contested' : value > 0.3 ? 'moderately contested' : 'low opposition'}. Quadrant: ${quadrantLabels[quadrant] ?? quadrant}.`,
  }
}

export function persistence(windows: number, thresholdPercentile: number = 50): TooltipContent {
  const days = (windows * 6 / 24).toFixed(1)
  return {
    title: 'Persistence',
    calculation: `Consecutive time windows above the ${thresholdPercentile}th percentile threshold.`,
    reading: `${windows} consecutive 6h windows above threshold. This claim has held position for ${days} days — ${windows > 10 ? 'structurally embedded, not a flash.' : windows > 5 ? 'gaining structural permanence.' : 'still establishing.'}`,
  }
}

export function arousal(trend: string, currentValue: number, previousValue: number): TooltipContent {
  const delta = currentValue - previousValue
  return {
    title: 'Arousal Profile',
    calculation: 'Average emotional charge of this concept\'s expressions over time. High = anger/outrage/fear. Low = analytical/hedged.',
    reading: `Arousal ${trend === 'warming' ? 'rising' : trend === 'cooling' ? 'falling' : 'stable'} (${previousValue.toFixed(2)} → ${currentValue.toFixed(2)}).${delta > 0.15 ? ' Possible escalation signal — emotional charge increasing while semantic content may be stable.' : ''}`,
  }
}

export function expressibility(value: number): TooltipContent {
  return {
    title: 'Expressibility',
    calculation: 'Original-post ratio: unique original posts / total engagements. High = comfortable expressing. Low = engages but won\'t originate.',
    reading: `${value.toFixed(2)} original post ratio. For every original post expressing this claim, there are ~${(1 / value).toFixed(0)} engagements. ${value > 0.4 ? 'High comfort level.' : value > 0.2 ? 'Moderate comfort level.' : 'Low willingness to originate — people engage but don\'t want to say it publicly.'}`,
  }
}

export function divergenceTypology(typology: DivergenceTypology): TooltipContent {
  return {
    title: 'Divergence Typology',
    calculation: 'Classifies WHY two groups diverge, not just how much. Three continuous scores: info asymmetry (different facts), interpretive (different rankings), paradigmatic (different frameworks).',
    reading: `Info Asymmetry: ${typology.information_asymmetry.toFixed(2)} — ${typology.information_asymmetry > 0.5 ? 'claim clusters present in one slice are largely absent in the other' : 'moderate overlap'}. Interpretive: ${typology.interpretive.toFixed(2)} — ${typology.interpretive > 0.5 ? 'same claims present, different salience rankings' : 'similar rankings'}. Paradigmatic: ${typology.paradigmatic.toFixed(2)}.`,
    caveat: typology.paradigmatic_caveat
      ? 'Paradigmatic score may reflect extraction confidence differences across slices rather than genuine incommensurability.'
      : undefined,
  }
}

export function exposure(): TooltipContent {
  return {
    title: 'Exposure Decomposition',
    calculation: 'Three layers: Production (unique original posts), Amplification (shares/retweets/upvotes), Estimated Exposure (production × avg reach, crude proxy).',
    reading: 'Estimated exposure is a proxy with wide confidence bounds. A claim can be highly produced but not amplified, or barely produced but massively amplified.',
    caveat: 'Estimated exposure uses follower counts as a reach proxy, which is known to overestimate actual impressions.',
  }
}

export function adversarialPair(
  correlation: number,
  lagHours: number,
  lagConsistency: string,
  mutationDetected: boolean,
): TooltipContent {
  return {
    title: 'Counter-Narrative Dynamics',
    calculation: 'Adversarial pair detection uses cluster centroid cosine distance + inverse momentum correlation. Response lag measured via cross-correlation on momentum time series between opposed clusters.',
    reading: `Momentum correlation: ${correlation.toFixed(2)} (${
      correlation < -0.6 ? 'strong inverse — active structural opposition'
      : correlation < -0.3 ? 'moderate inverse — likely opposition'
      : 'weak signal'
    }). Response lag: ${lagHours}h median (${lagConsistency} consistency — ${
      lagConsistency === 'high' ? 'suggests organized rapid response capability'
      : lagConsistency === 'low' ? 'consistent with organic counter-mobilization'
      : 'ambiguous pattern'
    }).${mutationDetected
      ? ' Framing shift detected — cluster may be adapting to counter-narrative pressure.'
      : ''}`,
    caveat: 'Response lag interpretation requires baseline context. Short lags are consistent with coordination but do not prove it. Adversarial detection operates on cluster centroids, not individual claims.',
  }
}

export function coordination(signal: string, score: number, baseline: number): TooltipContent {
  const labels: Record<string, string> = {
    burstiness: 'Burstiness: production rate vs expected organic adoption curve',
    near_duplicate: 'Near-Duplicate: semantic similarity across posts from non-overlapping accounts',
    cross_platform_sync: 'Cross-Platform Sync: appearance on multiple platforms within narrow window',
    source_diversity_anomaly: 'Source Diversity: momentum driven by small number of accounts',
  }
  return {
    title: labels[signal] ?? signal,
    calculation: 'Statistical signature compared against organic baseline for this topic/platform combination.',
    reading: `Score: ${score.toFixed(2)} vs organic baseline ${baseline.toFixed(2)}. ${score > baseline * 2 ? 'Significantly above baseline — consistent with coordination.' : 'Within normal range.'}`,
    caveat: 'Coordination signals surface statistical anomalies, not intent. The analyst decides what to investigate further.',
  }
}
