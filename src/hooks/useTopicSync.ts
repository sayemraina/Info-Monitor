import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { TopicSummary } from '../types'

const ROTATION_INTERVAL = 18000 // 18 seconds
const UNLOCK_TIMEOUT = 60000 // 60 seconds of inactivity → unlock

export interface TopicSyncState {
  activeTopic: string
  isLocked: boolean
}

export interface TopicSyncActions {
  lockTopic: (topicId: string) => void
  unlockTopic: () => void
  isActiveTopic: (topicId: string) => boolean
  /** Pause rotation while hovering interactive elements */
  pauseRotation: () => void
  resumeRotation: () => void
}

export function useTopicSync(topics: TopicSummary[]): [TopicSyncState, TopicSyncActions] {
  // Preserve original topic order from topics.json — stable chronology
  const sortedIds = useMemo(() => topics.map(t => t.id), [topics])

  const [activeTopic, setActiveTopic] = useState<string>('')
  const [isLocked, setIsLocked] = useState(false)
  const isPaused = useRef(false)
  const rotationRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initialize with highest IFI topic
  useEffect(() => {
    if (sortedIds.length > 0 && !activeTopic) {
      setActiveTopic(sortedIds[0])
    }
  }, [topics, activeTopic])

  // Auto-rotation
  useEffect(() => {
    if (isLocked) {
      if (rotationRef.current) {
        clearInterval(rotationRef.current)
        rotationRef.current = null
      }
      return
    }

    rotationRef.current = setInterval(() => {
      if (isPaused.current) return
      setActiveTopic(prev => {
        const ids = sortedIds
        if (ids.length === 0) return prev
        const idx = ids.indexOf(prev)
        const next = (idx + 1) % ids.length
        return ids[next]
      })
    }, ROTATION_INTERVAL)

    return () => {
      if (rotationRef.current) {
        clearInterval(rotationRef.current)
        rotationRef.current = null
      }
    }
  }, [isLocked])

  // Unlock timer — after 60s of inactivity while locked
  useEffect(() => {
    if (!isLocked) {
      if (unlockTimerRef.current) {
        clearTimeout(unlockTimerRef.current)
        unlockTimerRef.current = null
      }
      return
    }

    unlockTimerRef.current = setTimeout(() => {
      setIsLocked(false)
    }, UNLOCK_TIMEOUT)

    return () => {
      if (unlockTimerRef.current) {
        clearTimeout(unlockTimerRef.current)
        unlockTimerRef.current = null
      }
    }
  }, [isLocked, activeTopic]) // reset timer when switching locked topic

  const lockTopic = useCallback((topicId: string) => {
    setActiveTopic(topicId)
    setIsLocked(true)
  }, [])

  const unlockTopic = useCallback(() => {
    setIsLocked(false)
  }, [])

  const isActiveTopic = useCallback(
    (topicId: string) => topicId === activeTopic,
    [activeTopic]
  )

  // Pause rotation when tab is hidden (Page Visibility API)
  useEffect(() => {
    const handleVisibility = () => {
      isPaused.current = document.hidden
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const pauseRotation = useCallback(() => {
    isPaused.current = true
  }, [])

  const resumeRotation = useCallback(() => {
    isPaused.current = document.hidden ? true : false
  }, [])

  return [
    { activeTopic, isLocked },
    { lockTopic, unlockTopic, isActiveTopic, pauseRotation, resumeRotation },
  ]
}
