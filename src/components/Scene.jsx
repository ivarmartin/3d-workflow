import { useRef, useEffect, useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import FadeModel from './FadeModel'
import Drone from './Drone'
import GroundPlane from './GroundPlane'

const ASSET_BASE = `${import.meta.env.BASE_URL}assets/`

const MODELS = {
  nadirCameras: `${ASSET_BASE}260321-Sanda-cameras_nadir.glb`,
  map: `${ASSET_BASE}260321-Sanda-2D_map.glb`,
  obliqueCameras: `${ASSET_BASE}260321-Sanda-cameras_oblique.glb`,
  pointCloud: `${ASSET_BASE}260321-Sanda-pointcloud.glb`,
  mesh: `${ASSET_BASE}260321-Sanda-3D_mesh.glb`,
}

// Preload all GLBs
Object.values(MODELS).forEach((url) => useGLTF.preload(url))

// Scene center (2D map center)
const SCENE_CENTER = [-30, 4, -22]

export default function Scene({ visibility, darkMode }) {
  const controlsRef = useRef()
  const idleTimerRef = useRef(null)

  const handleInteractionStart = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = false
    }
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
  }, [])

  const handleInteractionEnd = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => {
      if (controlsRef.current) {
        controlsRef.current.autoRotate = true
      }
    }, 5000)
  }, [])

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={darkMode ? 0.6 : 1.0} />
      <directionalLight
        position={[200, 400, 300]}
        intensity={darkMode ? 0.8 : 1.0}
      />
      <hemisphereLight
        args={[darkMode ? '#334466' : '#87ceeb', darkMode ? '#222233' : '#556b2f', 0.3]}
      />

      {/* Controls */}
      <OrbitControls
        ref={controlsRef}
        target={SCENE_CENTER}
        enableDamping
        dampingFactor={0.05}
        minDistance={50}
        maxDistance={2000}
        autoRotate
        autoRotateSpeed={0.3}
        onStart={handleInteractionStart}
        onEnd={handleInteractionEnd}
      />

      {/* Ground plane (stages 0-1, fades out at stage 2) */}
      <GroundPlane state={visibility.groundPlane} darkMode={darkMode} />

      {/* Drone (stages 0-2) */}
      <Drone visible={visibility.drone} animating={visibility.droneAnimating} />

      {/* GLB models with fade transitions */}
      <FadeModel url={MODELS.nadirCameras} state={visibility.nadirCameras} />
      <FadeModel url={MODELS.map} state={visibility.map} />
      <FadeModel url={MODELS.obliqueCameras} state={visibility.obliqueCameras} />
      <FadeModel url={MODELS.pointCloud} state={visibility.pointCloud} />
      <FadeModel url={MODELS.mesh} state={visibility.mesh} />
    </>
  )
}
