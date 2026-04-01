import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useGpuWarmup, WARMUP_FRAME_THRESHOLD } from '../hooks/useGpuWarmup'
import { isIOS } from '../utils/platform'

const FADE_DURATION = 0.75 // seconds

export default function FadeModel({ url, state, fadeDuration = FADE_DURATION, overrideMaterial, warmupId }) {
  // state: 'visible', 'fadeIn', 'fadeOut', or undefined (hidden)
  const { scene } = useGLTF(url)
  const groupRef = useRef()
  const opacityRef = useRef(state === 'visible' ? 1 : 0)
  const targetOpacity = (state === 'visible' || state === 'fadeIn') ? 1 : 0

  // Clone the scene so each instance gets its own materials
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((child) => {
      if (child.isMesh) {
        child.material = overrideMaterial
          ? overrideMaterial.clone()
          : child.material.clone()
        child.material.transparent = true
        child.material.depthWrite = opacityRef.current > 0.99
        child.material.opacity = opacityRef.current
        child.frustumCulled = false
      }
    })
    return clone
  }, [scene])

  // When state changes, snap opacity for non-animated states
  useEffect(() => {
    if (state === 'visible') {
      opacityRef.current = 1
      if (groupRef.current) groupRef.current.visible = true
      clonedScene.traverse((child) => {
        if (child.isMesh) {
          child.material.opacity = 1
          child.material.depthWrite = true
        }
      })
    } else if (!state) {
      opacityRef.current = 0
      if (isIOS) {
        // On iOS, hide fully to avoid loading textures into constrained VRAM
        if (groupRef.current) groupRef.current.visible = false
        // Auto-mark warmup as done since we're skipping it
        if (warmupId && !warmupDoneRef.current) {
          useGpuWarmup.getState().markWarmed(warmupId)
          warmupDoneRef.current = true
        }
      } else {
        // Keep group visible at opacity 0 so GPU compiles shaders and uploads
        // textures on mount — avoids a frame stall on first real fade-in
        if (groupRef.current) groupRef.current.visible = true
      }
      clonedScene.traverse((child) => {
        if (child.isMesh) {
          child.material.opacity = 0
          child.material.depthWrite = false
        }
      })
    }
  }, [state, clonedScene])

  // Dispose cloned materials and geometries on unmount to free VRAM
  useEffect(() => {
    return () => {
      clonedScene.traverse((child) => {
        if (child.isMesh) {
          child.material.dispose()
          child.geometry.dispose()
        }
      })
    }
  }, [clonedScene])

  const warmupFrameRef = useRef(0)
  const warmupDoneRef = useRef(false)

  useFrame((_, delta) => {
    // GPU warmup tracking — count frames while visible at opacity 0
    if (warmupId && !warmupDoneRef.current && groupRef.current?.visible) {
      warmupFrameRef.current++
      if (warmupFrameRef.current >= WARMUP_FRAME_THRESHOLD) {
        useGpuWarmup.getState().markWarmed(warmupId)
        warmupDoneRef.current = true
      }
    }

    if (!state) return

    const speed = 1 / fadeDuration
    const prev = opacityRef.current

    if (state === 'fadeIn') {
      opacityRef.current = Math.min(1, prev + delta * speed)
      if (groupRef.current) groupRef.current.visible = true
    } else if (state === 'fadeOut') {
      opacityRef.current = Math.max(0, prev - delta * speed)
    }

    if (opacityRef.current !== prev) {
      clonedScene.traverse((child) => {
        if (child.isMesh) {
          child.material.opacity = opacityRef.current
          child.material.depthWrite = opacityRef.current > 0.99
        }
      })
    }

    // Hide completely when faded out
    if (state === 'fadeOut' && opacityRef.current <= 0 && groupRef.current) {
      groupRef.current.visible = false
    }
  })

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} />
    </group>
  )
}
