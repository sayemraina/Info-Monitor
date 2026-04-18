// Lightweight frontend perf instrumentation.
//
// Every call is cheap: performance.mark is a browser primitive and essentially
// free when no consumer reads the entries. Console logging is gated behind
// `?debug` in the URL, so production traces stay silent.

const DEBUG: boolean =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('debug')

export interface PerfMark {
  name: string
  t: number // ms since navigationStart
  meta?: Record<string, unknown>
}

const marks: PerfMark[] = []

export function mark(name: string, meta?: Record<string, unknown>): void {
  try {
    performance.mark(name)
  } catch {
    // invalid name chars — ignore
  }
  const entry: PerfMark = { name, t: performance.now(), meta }
  marks.push(entry)
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log(`[perf] ${name}`, `${entry.t.toFixed(0)}ms`, meta ?? '')
  }
}

export function measure(label: string, start: string, end: string): number | null {
  try {
    performance.measure(label, start, end)
    const entries = performance.getEntriesByName(label)
    const last = entries[entries.length - 1]
    const d = last?.duration ?? null
    if (DEBUG && d != null) {
      // eslint-disable-next-line no-console
      console.log(`[perf] ${label}: ${d.toFixed(0)}ms`)
    }
    return d
  } catch {
    return null
  }
}

export function getMarks(): PerfMark[] {
  return [...marks]
}

export function isDebug(): boolean {
  return DEBUG
}
