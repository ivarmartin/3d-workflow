import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const REVEAL_RADIUS = 5
const FADE_SPEED = 4 // opacity units per second (fast fade-in once revealed)

export default function NadirCameras({ url, state, droneAnimating, dronePositionRef }) {
  const { scene } = useGLTF(url)
  const groupRef = useRef()

  // Clone scene and collect meshes with their world positions
  const { clonedScene, meshes } = useMemo(() => {
    const clone = scene.clone(true)
    const meshList = []
    clone.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone()
        child.material.transparent = true
        child.material.depthWrite = false
        child.material.opacity = 0
        child.visible = false
        meshList.push({ mesh: child, revealed: false, opacity: 0 })
      }
    })
    return { clonedScene: clone, meshes: meshList }
  }, [scene])

  // Scratch vector for position calculations
  const _pos = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, delta) => {
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
