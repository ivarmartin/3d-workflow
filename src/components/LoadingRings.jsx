import { useState, useEffect } from 'react'
import { useProgress } from '@react-three/drei'
import { useGpuWarmup } from '../hooks/useGpuWarmup'

const OUTER_R = 44
const INNER_R = 34
const OUTER_CIRC = 2 * Math.PI * OUTER_R
const INNER_CIRC = 2 * Math.PI * INNER_R

export default function LoadingRings({ size = 80, darkMode }) {
  const { progress, active } = useProgress()
  const warmupStatus = useGpuWarmup((s) => s.warmupStatus)
  const [fadingOut, setFadingOut] = useState(false)
  const [hidden, setHidden] = useState(false)

  const warmedCount = Object.values(warmupStatus).filter(Boolean).length
  const totalCount = Object.values(warmupStatus).length
  const gpuProgress = (warmedCount / totalCount) * 100

  const allComplete = progress >= 100 && !active && gpuProgress >= 100

  useEffect(() => {
    if (allComplete && !fadingOut) {
      setFadingOut(true)
      const timer = setTimeout(() => setHidden(true), 600)
      return () => clearTimeout(timer)
    }
  }, [allComplete, fadingOut])

  if (hidden) return null

  const outerColor = darkMode ? '#4fc3f7' : '#0288d1'
  const innerColor = darkMode ? '#81c784' : '#388e3c'
  const trackColor = darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'
  const textColor = darkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)'

  const outerOffset = OUTER_CIRC * (1 - progress / 100)
  const innerOffset = INNER_CIRC * (1 - gpuProgress / 100)

  return (
    <div
      style={{
        width: size,
        height: size,
        opacity: fadingOut ? 0 : 1,
        transition: 'opacity 0.6s ease',
      }}
    >
      <svg width={size} height={size} viewBox="0 0 100 100">
        {/* Outer track */}
        <circle
          cx="50" cy="50" r={OUTER_R}
          fill="none" stroke={trackColor} strokeWidth="5"
        />
        {/* Outer progress (download) */}
        <circle
          cx="50" cy="50" r={OUTER_R}
          fill="none" stroke={outerColor} strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={OUTER_CIRC}
          strokeDashoffset={outerOffset}
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 0.3s ease' }}
        />
        {/* Inner track */}
        <circle
          cx="50" cy="50" r={INNER_R}
          fill="none" stroke={trackColor} strokeWidth="4"
        />
        {/* Inner progress (GPU warmup) */}
        <circle
          cx="50" cy="50" r={INNER_R}
          fill="none" stroke={innerColor} strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={INNER_CIRC}
          strokeDashoffset={innerOffset}
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
        {/* Center percentage */}
        <text
          x="50" y="50"
          textAnchor="middle" dominantBaseline="central"
          fill={textColor}
          fontSize="16" fontWeight="600"
          fontFamily="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
        >
          {Math.round(progress)}%
        </text>
      </svg>
    </div>
  )
}
