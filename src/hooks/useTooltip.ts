import { useState, useRef, useCallback } from 'react'

/**
 * Shared hover-tooltip pattern (matches MetricRow's 300ms delay).
 * Usage:
 *   const { ref, rect, handlers } = useTooltip<HTMLDivElement>()
 *   <div ref={ref} {...handlers}>…</div>
 *   {rect && <MethodologyTooltip content={…} rect={rect} />}
 */
export function useTooltip<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onMouseEnter = useCallback(() => {
    timerRef.current = setTimeout(() => {
      if (ref.current) setRect(ref.current.getBoundingClientRect())
    }, 300)
  }, [])

  const onMouseLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setRect(null)
  }, [])

  return { ref, rect, handlers: { onMouseEnter, onMouseLeave } }
}
