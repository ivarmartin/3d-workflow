import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const FADE_DURATION = 0.75 // seconds

export default function FadeModel({ url, state, fadeDuration = FADE_DURATION, overrideMaterial }) {
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
      if (groupRef.current) groupRef.current.visible = false
    }
  }, [state, clonedScene])

  useFrame((_, delta) => {
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
