import { useState, useEffect, useRef, useCallback } from 'react'
import type { EntryHint } from '../types'

export interface CascadeState {
  vitals: Record<string, string>
  zones: Record<string, string>
}

export interface CascadeControls {
  state: CascadeState
  dismissAll: () => void
  isProtected: boolean
}

const EMPTY: CascadeState = { vitals: {}, zones: {} }

/** 3 seconds protected — cascade plays uninterrupted */
const PROTECTED_MS = 3000
/** 8 seconds hard timeout — auto-dismiss regardless */
const HARD_TIMEOUT_MS = 8000
/** Stagger delay between each target lighting up */
const STAGGER_MS = 150

interface CascadeTarget {
  type: 'vital' | 'zone'
  key: string
  className: string
  /** Custom delay in ms (overrides stagger-based timing) */
  delayMs?: number
  /** When to remove this target (sequential mode — each phase hands off to next) */
  endMs?: number
}

function getTargets(hint: EntryHint): CascadeTarget[] {
  switch (hint) {
    case 'explore':
      return [
        { type: 'vital', key: 'ifi', className: 'cascade-vital-pulse' },
        { type: 'zone', key: 'landscape', className: 'cascade-attention' },
      ]
    case 'ifi':
      return [
        { type: 'vital', key: 'ifi', className: 'cascade-vital-pulse' },
        { type: 'zone', key: 'ifiCard', className: 'cascade-attention' },
      ]
    case 'contestation':
      return [
        { type: 'vital', key: 'contestation', className: 'cascade-vital-pulse' },
        { type: 'zone', key: 'landscape', className: 'cascade-attention' },
        { type: 'zone', key: 'situations', className: 'cascade-attention' },
      ]
    case 'sparkline':
      return [
        { type: 'vital', key: 'sparkline', className: 'cascade-vital-pulse' },
        { type: 'zone', key: 'landscape', className: 'cascade-attention' },
      ]
    case 'diversity':
      return [
        { type: 'vital', key: 'diversity', className: 'cascade-dot' },
        { type: 'zone', key: 'landscape', className: 'cascade-attention' },
      ]
    case 'signal':
      return [
        { type: 'zone', key: 'signals', className: 'cascade-attention' },
      ]
    case 'situation':
      return [
        { type: 'zone', key: 'situations', className: 'cascade-attention' },
        { type: 'zone', key: 'landscape', className: 'cascade-attention' },
      ]
    case 'map_cta':
      return [
        { type: 'zone', key: 'divergence', className: 'cascade-attention' },
      ]
    case 'youtube_cta':
      return [
        { type: 'vital', key: 'shaper', className: 'cascade-vital-pulse' },
        { type: 'zone', key: 'shaping', className: 'cascade-attention' },
      ]
    case 'discourse':
      return [
        // Phase 1 (0-3s): Landscape alone — orient
        { type: 'zone', key: 'landscape', className: 'cascade-attention', delayMs: 0, endMs: 3000 },
        // Phase 2 (3-6s): Claim detail — concrete answer
        { type: 'zone', key: 'claimDetail', className: 'cascade-attention', delayMs: 3000, endMs: 6000 },
        // Phase 3 (6s+): Both together (no divergence — discourse entry isn't about divergence)
        { type: 'zone', key: 'landscape', className: 'cascade-attention', delayMs: 6000 },
        { type: 'zone', key: 'claimDetail', className: 'cascade-attention', delayMs: 6000 },
      ]
    case 'map_hotspot':
      return [
        // Phase 1 (0-3s): Landscape alone — orient
        { type: 'zone', key: 'landscape', className: 'cascade-attention', delayMs: 0, endMs: 3000 },
        // Phase 2 (3-6s): Claim detail alone — concrete answer
        { type: 'zone', key: 'claimDetail', className: 'cascade-attention', delayMs: 3000, endMs: 6000 },
        // Phase 3 (6-12s): All three together — full picture
        { type: 'zone', key: 'landscape', className: 'cascade-attention', delayMs: 6000 },
        { type: 'zone', key: 'claimDetail', className: 'cascade-attention', delayMs: 6000 },
        { type: 'zone', key: 'divergence', className: 'cascade-attention', delayMs: 6000 },
      ]
    default:
      return []
  }
}

export function useEntryCascade(
  hint: EntryHint | undefined,
  onClear: () => void
): CascadeControls {
  const [state, setState] = useState<CascadeState>(EMPTY)
  const [isProtected, setIsProtected] = useState(false)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const activeRef = useRef(false)

  const dismissAll = useCallback(() => {
    if (!activeRef.current) return
    activeRef.current = false
    for (const t of timersRef.current) clearTimeout(t)
    timersRef.current = []
    setState(EMPTY)
    setIsProtected(false)
    onClear()
  }, [onClear])

  useEffect(() => {
    if (!hint) return

    const targets = getTargets(hint)
    if (targets.length === 0) return

    activeRef.current = true
    setIsProtected(true)
    timersRef.current = []

    // Staggered entrance: each target lights up after a delay
    // Uses custom delayMs if set, otherwise stagger-based timing
    const hasCustomTiming = targets.some(t => t.delayMs !== undefined)
    targets.forEach((target, i) => {
      const delay = hasCustomTiming ? (target.delayMs ?? i * STAGGER_MS) : i * STAGGER_MS
      // Add target
      const tOn = setTimeout(() => {
        setState(prev => {
          const next = {
            vitals: { ...prev.vitals },
            zones: { ...prev.zones },
          }
          if (target.type === 'vital') {
            next.vitals[target.key] = target.className
          } else {
            next.zones[target.key] = target.className
          }
          return next
        })
      }, delay)
      timersRef.current.push(tOn)

      // Remove target at endMs (sequential handoff)
      if (target.endMs !== undefined) {
        const tOff = setTimeout(() => {
          setState(prev => {
            const next = {
              vitals: { ...prev.vitals },
              zones: { ...prev.zones },
            }
            if (target.type === 'vital') {
              delete next.vitals[target.key]
            } else {
              delete next.zones[target.key]
            }
            return next
          })
        }, target.endMs)
        timersRef.current.push(tOff)
      }
    })

    // After PROTECTED_MS, unprotect — any click can now dismiss
    const protectTimer = setTimeout(() => {
      setIsProtected(false)
    }, PROTECTED_MS)
    timersRef.current.push(protectTimer)

    // Hard timeout: auto-dismiss (longer for map_hotspot which has custom timing)
    const maxDelay = hasCustomTiming ? Math.max(...targets.map(t => t.delayMs ?? 0)) : 0
    const hardTimeout = maxDelay > 0 ? maxDelay + 6000 : HARD_TIMEOUT_MS
    const hardTimer = setTimeout(() => {
      dismissAll()
    }, hardTimeout)
    timersRef.current.push(hardTimer)

    return () => {
      for (const t of timersRef.current) clearTimeout(t)
      activeRef.current = false
    }
  }, [hint, onClear, dismissAll])

  return { state, dismissAll, isProtected }
}
