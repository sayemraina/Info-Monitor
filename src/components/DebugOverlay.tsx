// Debug overlay — mounted only when `?debug=1` is in the URL.
// Renders a fixed-position panel with recent perf marks, TTFT, and fetch sizes.
// Safe to leave shipped: zero DOM output unless debug flag is set.

import { useEffect, useState } from 'react'
import { getMarks } from '../utils/perf'
import type { PerfMark } from '../utils/perf'

function formatBytes(n: unknown): string {
  if (typeof n !== 'number' || !isFinite(n)) return '–'
  if (n > 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  if (n > 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${n} B`
}

export function DebugOverlay() {
  const [, tick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => tick(t => t + 1), 500)
    return () => clearInterval(id)
  }, [])

  const marks: PerfMark[] = getMarks()
  const boot = marks.find(m => m.name === 'boot_start')?.t ?? 0
  const topics = marks.find(m => m.name === 'topics_loaded')
  const topicsFetchEnd = marks.find(m => m.name === 'topics_fetch_end')

  // Last few landscape fetches (show newest 5)
  const landscapes = marks
    .filter(m => m.name.startsWith('landscape_fetch_end:'))
    .slice(-5)

  // Force sim runs
  const forceRuns = marks
    .filter(m => m.name === 'force_sim_end')
    .slice(-3)

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 8,
        right: 8,
        background: '#111827',
        color: '#F1F5F9',
        padding: 12,
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 11,
        lineHeight: 1.5,
        border: '1px solid #1F2937',
        borderRadius: 4,
        maxWidth: 380,
        maxHeight: 420,
        overflow: 'auto',
        zIndex: 9999,
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ color: '#06B6D4', marginBottom: 6, fontWeight: 600 }}>
        PERF (ms since boot)
      </div>

      {topicsFetchEnd && (
        <div>
          topics fetch: {(topicsFetchEnd.t - boot).toFixed(0)}ms (
          {String(topicsFetchEnd.meta?.count ?? '?')} topics)
        </div>
      )}
      {topics && (
        <div>TTFT (topics rendered): {(topics.t - boot).toFixed(0)}ms</div>
      )}

      {landscapes.length > 0 && (
        <>
          <div style={{ color: '#94A3B8', marginTop: 8 }}>landscape fetches</div>
          {landscapes.map((m, i) => {
            const key = m.name.replace('landscape_fetch_end:', '')
            const startMark = marks.find(
              s => s.name === `landscape_fetch_start:${key}`
            )
            const dur = startMark ? (m.t - startMark.t).toFixed(0) : '?'
            return (
              <div key={`${key}-${i}`}>
                {key}: {dur}ms, {formatBytes(m.meta?.bytes)}
              </div>
            )
          })}
        </>
      )}

      {forceRuns.length > 0 && (
        <>
          <div style={{ color: '#94A3B8', marginTop: 8 }}>force simulation</div>
          {forceRuns.map((m, i) => {
            const start = marks
              .slice(0, marks.indexOf(m))
              .reverse()
              .find(s => s.name === 'force_sim_start')
            const dur = start ? (m.t - start.t).toFixed(0) : '?'
            const preTicks = start?.meta?.preTicks
            const nodes = start?.meta?.nodes
            return (
              <div key={i}>
                run {i + 1}: {dur}ms, {String(preTicks ?? '?')} ticks,{' '}
                {String(nodes ?? '?')} nodes
              </div>
            )
          })}
        </>
      )}

      <details style={{ marginTop: 10 }}>
        <summary style={{ cursor: 'pointer', color: '#94A3B8' }}>
          all marks ({marks.length})
        </summary>
        <div style={{ maxHeight: 200, overflow: 'auto', marginTop: 4 }}>
          {marks.map((m, i) => (
            <div key={i} style={{ color: '#64748B' }}>
              {m.t.toFixed(0)}ms — {m.name}
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
