import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const REVEAL_RADIUS = 5
const FADE_SPEED = 4 // opacity units per second (fast fade-in once revealed)

export default function NadirCameras({ url, state, droneAnimating, droneHovering, dronePositionRef }) {
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

  useFrame((_, delta) => {
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
    const revealing = droneAnimating && dronePositionRef?.current

    if (!showAll && !revealing) return
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

      // Animate opacity
      if (entry.revealed && entry.opacity < 1) {
        entry.opacity = Math.min(1, entry.opacity + delta * FADE_SPEED)
        entry.mesh.material.opacity = entry.opacity
        entry.mesh.material.depthWrite = entry.opacity > 0.5
        entry.mesh.visible = true
      }
    }
  })

  if (!state && !droneAnimating) return null

  return (
    <group ref={groupRef} visible={false}>
      <primitive object={clonedScene} />
    </group>
  )
}
