import { useState, useEffect, useCallback, useRef } from 'react'
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
  // Sort topics by IFI descending — highest flux first
  const sortedIds = useRef<string[]>([])
  if (topics.length > 0 && sortedIds.current.length !== topics.length) {
    sortedIds.current = [...topics]
      .sort((a, b) => (b.ifi?.value ?? 0) - (a.ifi?.value ?? 0))
      .map(t => t.id)
  }

  const [activeTopic, setActiveTopic] = useState<string>('')
  const [isLocked, setIsLocked] = useState(false)
  const isPaused = useRef(false)
  const rotationRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initialize with highest IFI topic
  useEffect(() => {
    if (sortedIds.current.length > 0 && !activeTopic) {
      setActiveTopic(sortedIds.current[0])
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
        const ids = sortedIds.current
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

  const pauseRotation = useCallback(() => {
    isPaused.current = true
  }, [])

  const resumeRotation = useCallback(() => {
    isPaused.current = false
  }, [])

  return [
    { activeTopic, isLocked },
    { lockTopic, unlockTopic, isActiveTopic, pauseRotation, resumeRotation },
  ]
}
