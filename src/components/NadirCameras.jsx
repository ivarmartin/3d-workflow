import { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import CameraCard3D from './CameraCard3D'

const REVEAL_RADIUS = 5
const FADE_IN_SPEED = 4   // opacity units per second (fast fade-in once revealed)
const FADE_OUT_SPEED = 0.5 // opacity units per second (2-second fade-out)
const DEFAULT_CAMERA = 'DJI_20260321084211_0145_V'
const COLOR_DEFAULT = 0x999999
const COLOR_SELECTED = 0xffcc00
const HIT_SPHERE_SCALE = 3  // hit area multiplier relative to frustum bounding radius

export default function NadirCameras({ url, state, droneAnimating, droneHovering, dronePositionRef, currentStage, darkMode }) {
  const { scene } = useGLTF(url)
  const groupRef = useRef()
  const prevHoveringRef = useRef(droneHovering)
  const prevAnimatingRef = useRef(droneAnimating)

  const [selectedMesh, setSelectedMesh] = useState(null)

  // Clone scene and collect meshes with their world positions
  const { clonedScene, meshes, hitRadius } = useMemo(() => {
    const clone = scene.clone(true)
    clone.updateMatrixWorld(true)
    const meshList = []
    let radius = 2 // fallback
    clone.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: 0x999999,
          transparent: true,
          depthWrite: false,
          opacity: 0,
        })
        child.visible = false
        const pos = new THREE.Vector3()
        child.getWorldPosition(pos)
        // Compute bounding sphere from first mesh (all frustums share same geometry)
        if (meshList.length === 0) {
          child.geometry.computeBoundingSphere()
          radius = child.geometry.boundingSphere.radius * HIT_SPHERE_SCALE
        }
        meshList.push({ mesh: child, revealed: false, opacity: 0, position: [pos.x, pos.y, pos.z] })
      }
    })
    return { clonedScene: clone, meshes: meshList, hitRadius: radius }
  }, [scene])

  const hitSphereGeo = useMemo(() => new THREE.SphereGeometry(hitRadius, 8, 6), [hitRadius])
  const hitSphereMat = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), [])

  // Auto-select default camera on stage 3 entry, clear on exit
  useEffect(() => {
    if (currentStage === 3) {
      const entry = meshes.find(e => e.mesh.name.startsWith(DEFAULT_CAMERA))
      if (entry) setSelectedMesh(entry.mesh.name)
    } else {
      setSelectedMesh(null)
    }
  }, [currentStage, meshes])

  // Highlight selected frustum yellow, reset others to gray
  useEffect(() => {
    for (const entry of meshes) {
      entry.mesh.material.color.setHex(
        entry.mesh.name === selectedMesh ? COLOR_SELECTED : COLOR_DEFAULT
      )
    }
  }, [selectedMesh, meshes])

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

  const handleHitClick = (e, name) => {
    if (currentStage !== 3) return
    e.stopPropagation()
    setSelectedMesh(name)
  }

  const handlePointerOver = () => {
    if (currentStage === 3) document.body.style.cursor = 'pointer'
  }

  const handlePointerOut = () => {
    document.body.style.cursor = 'auto'
  }

  const selectedEntry = selectedMesh
    ? meshes.find(e => e.mesh.name === selectedMesh)
    : null

  return (
    <group ref={groupRef} visible={!!(state || droneAnimating)}>
      <primitive object={clonedScene} />
      {currentStage === 3 && meshes.map((entry) => (
        <mesh
          key={entry.mesh.name}
          geometry={hitSphereGeo}
          material={hitSphereMat}
          position={entry.position}
          onClick={(e) => handleHitClick(e, entry.mesh.name)}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
      ))}
      {selectedEntry && currentStage === 3 && (
        <CameraCard3D
          position={selectedEntry.position}
          meshName={selectedEntry.mesh.name}
          darkMode={darkMode}
        />
      )}
    </group>
  )
}
