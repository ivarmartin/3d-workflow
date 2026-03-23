import { useState, useCallback, useRef } from 'react'
import { TOTAL_STAGES, getVisibility } from '../stages'

export function useStageManager() {
  const [currentStage, setCurrentStage] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const fadeTimerRef = useRef(null)

  const startTransition = useCallback((nextStage) => {
    setTransitioning(true)
    setCurrentStage(nextStage)
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    fadeTimerRef.current = setTimeout(() => {
      setTransitioning(false)
    }, 800) // slightly longer than fade duration to ensure completion
  }, [])

  const goNext = useCallback(() => {
    if (transitioning) return
    if (currentStage < TOTAL_STAGES - 1) {
      startTransition(currentStage + 1)
    }
  }, [currentStage, transitioning, startTransition])

  const goBack = useCallback(() => {
    if (transitioning) return
    if (currentStage > 0) {
      startTransition(currentStage - 1)
    }
  }, [currentStage, transitioning, startTransition])

  const visibility = getVisibility(currentStage)

  return {
    currentStage,
    transitioning,
    visibility,
    goNext,
    goBack,
    isFirst: currentStage === 0,
    isLast: currentStage === TOTAL_STAGES - 1,
  }
}
