import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const REVEAL_RADIUS = 5
const FADE_IN_SPEED = 4   // opacity units per second (fast fade-in once revealed)
const FADE_OUT_SPEED = 0.5 // opacity units per second (2-second fade-out)

export default function NadirCameras({ url, state, droneAnimating, droneHovering, dronePositionRef, onFrustumClick }) {
  const { scene } = useGLTF(url)
  const groupRef = useRef()
  const prevHoveringRef = useRef(droneHovering)
  const prevAnimatingRef = useRef(droneAnimating)

  // Clone scene and collect meshes with their world positions
  const { clonedScene, meshes } = useMemo(() => {
    const clone = scene.clone(true)
    const meshList = []
    clone.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: 0x999999,
          transparent: true,
          depthWrite: false,
          opacity: 0,
        })
        child.visible = false
        meshList.push({ mesh: child, revealed: false, opacity: 0 })
      }
    })
    return { clonedScene: clone, meshes: meshList }
  }, [scene])

  // Scratch vector for position calculations
  const _pos = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, rawDelta) => {
    // Clamp delta to prevent large opacity jumps from GPU stalls (e.g. first shader compile)
    const delta = Math.min(rawDelta, 0.05)
    // Reset all meshes when returning to hover (stage 0) or restarting flight (stage 1)
    const shouldReset =
      (droneHovering && !prevHoveringRef.current) ||
      (droneAnimating && !prevAnimatingRef.current)
    if (shouldReset) {
      for (const entry of meshes) {
        entry.revealed = false
        entry.opacity = 0
        entry.mesh.material.opacity = 0
        entry.mesh.material.depthWrite = false
        entry.mesh.visible = false
      }
      if (groupRef.current) groupRef.current.visible = false
    }
    prevHoveringRef.current = droneHovering
    prevAnimatingRef.current = droneAnimating

    const showAll = state === 'visible' || state === 'fadeIn'
    const fadingOut = state === 'fadeOut'
    const revealing = droneAnimating && dronePositionRef?.current

    if (!showAll && !revealing && !fadingOut) return
    if (groupRef.current) groupRef.current.visible = true

    for (const entry of meshes) {
      // Check proximity to drone
      if (!entry.revealed && revealing) {
        entry.mesh.getWorldPosition(_pos)
        if (_pos.distanceTo(dronePositionRef.current) < REVEAL_RADIUS) {
          entry.revealed = true
        }
      }

      // Show all when transitioning to stage 1+
      if (showAll && !entry.revealed) {
        entry.revealed = true
      }

      if (fadingOut) {
        // Fade out all visible cameras
        if (entry.opacity > 0) {
          entry.opacity = Math.max(0, entry.opacity - delta * FADE_OUT_SPEED)
          entry.mesh.material.opacity = entry.opacity
          entry.mesh.material.depthWrite = entry.opacity > 0.99
          entry.mesh.visible = entry.opacity > 0
        }
      } else if (entry.revealed && entry.opacity < 1) {
        // Animate opacity in
        entry.opacity = Math.min(1, entry.opacity + delta * FADE_IN_SPEED)
        entry.mesh.material.opacity = entry.opacity
        entry.mesh.material.depthWrite = entry.opacity > 0.99
        entry.mesh.visible = true
      }
    }
  })

  if (!state && !droneAnimating) return null

  const handleClick = (e) => {
    if (!onFrustumClick) return
    e.stopPropagation()
    const name = e.object?.name
    if (name && name.startsWith('DJI_')) {
      onFrustumClick(name)
    }
  }

  return (
    <group ref={groupRef} visible={!!(state || droneAnimating)} onClick={handleClick}>
      <primitive object={clonedScene} />
    </group>
  )
}
