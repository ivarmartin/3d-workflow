import { useRef, useCallback, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import FadeModel from './FadeModel'
import Drone from './Drone'
import NadirCameras from './NadirCameras'
import ObliqueDrones from './ObliqueDrones'
import GroundPlane from './GroundPlane'
import ScaleBar3D from './ScaleBar3D'

const ASSET_BASE = `${import.meta.env.BASE_URL}assets/`

const MODELS = {
  nadirCameras: `${ASSET_BASE}260321-Sanda-cameras_nadir_2m.glb`,
  map: `${ASSET_BASE}260321-Sanda-2D_map.glb`,
  obliqueCameras: `${ASSET_BASE}260321-Sanda-cameras_oblique_2m.glb`,
  pointCloud: `${ASSET_BASE}260321-Sanda-pointcloud.glb`,
  mesh: `${ASSET_BASE}260321-Sanda-3D_mesh.glb`,
}

// Preload all GLBs
Object.values(MODELS).forEach((url) => useGLTF.preload(url))

// Scene center (2D map center)
const SCENE_CENTER = [-30, 4, -22]

const GRAY_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x999999 })

// Map survey geometry (from Drone.jsx lawnmower grid)
const MAP_CENTER = [-17, 0, -13] // cx, ground level, cz
const MAP_HALF_ALONG = 375       // half-length along long axis (750m total)
const MAP_HALF_ACROSS = 133      // half-width along short axis (266m total)
const MAP_ANGLE_DEG = 136        // rotation of long axis in degrees
const MAP_ANGLE_RAD = MAP_ANGLE_DEG * (Math.PI / 180)

// CameraAnimator — smoothly flies camera to top-down when entering stage 3
function CameraAnimator({ controlsRef, currentStage }) {
  const { camera, size } = useThree()
  const animatingRef = useRef(false)
  const progressRef = useRef(0)
  const prevStageRef = useRef(currentStage)
  const startPosRef = useRef(new THREE.Vector3())
  const startTargetRef = useRef(new THREE.Vector3())
  const goalPosRef = useRef(new THREE.Vector3())
  const goalTargetRef = useRef(new THREE.Vector3())

  const ANIM_DURATION = 1.5 // seconds

  useEffect(() => {
    // Trigger animation when entering stage 3
    if (currentStage === 3 && prevStageRef.current !== 3 && controlsRef.current) {
      const aspect = size.width / size.height
      const isPortrait = aspect < 1

      // Target: look at map center at ground level
      const target = new THREE.Vector3(MAP_CENTER[0], MAP_CENTER[1], MAP_CENTER[2])

      // Compute camera height to fit the map
      const fovRad = camera.fov * (Math.PI / 180)

      // In portrait: long axis (750m) must fit vertically
      // In landscape: long axis (750m) must fit horizontally
      let fitDimension
      if (isPortrait) {
        // Vertical FOV covers the long axis; horizontal covers short axis
        const verticalFit = (MAP_HALF_ALONG * 2 * 1.15) / (2 * Math.tan(fovRad / 2))
        const horizontalFit = (MAP_HALF_ACROSS * 2 * 1.15) / (2 * Math.tan(fovRad / 2) * aspect)
        fitDimension = Math.max(verticalFit, horizontalFit)
      } else {
        // Horizontal FOV covers the long axis; vertical covers short axis
        const horizontalFit = (MAP_HALF_ALONG * 2 * 1.15) / (2 * Math.tan(fovRad / 2) * aspect)
        const verticalFit = (MAP_HALF_ACROSS * 2 * 1.15) / (2 * Math.tan(fovRad / 2))
        fitDimension = Math.max(horizontalFit, verticalFit)
      }

      // Camera goes directly above map center, with a tiny XZ offset
      // so OrbitControls doesn't gimbal-lock at the pole
      // The offset direction determines which way is "up" on screen:
      // we use the map's long-axis direction so it aligns with screen
      const cos = Math.cos(MAP_ANGLE_RAD)
      const sin = Math.sin(MAP_ANGLE_RAD)

      let offsetX, offsetZ
      if (isPortrait) {
        // Long axis should be vertical on screen → offset camera along short axis
        // Short axis is perpendicular to long axis (MAP_ANGLE + 90°)
        offsetX = Math.cos(MAP_ANGLE_RAD + Math.PI / 2) * 0.5
        offsetZ = Math.sin(MAP_ANGLE_RAD + Math.PI / 2) * 0.5
      } else {
        // Long axis should be horizontal on screen → offset camera along long axis
        offsetX = cos * 0.5
        offsetZ = sin * 0.5
      }

      const goalPos = new THREE.Vector3(
        target.x + offsetX,
        fitDimension,
        target.z + offsetZ
      )

      // Save start state
      startPosRef.current.copy(camera.position)
      startTargetRef.current.copy(controlsRef.current.target)
      goalPosRef.current.copy(goalPos)
      goalTargetRef.current.copy(target)

      // Start animation
      progressRef.current = 0
      animatingRef.current = true
      controlsRef.current.enabled = false
      controlsRef.current.autoRotate = false
    }
    prevStageRef.current = currentStage
  }, [currentStage, camera, size, controlsRef])

  useFrame((_, delta) => {
    if (!animatingRef.current) return

    progressRef.current += delta / ANIM_DURATION
    if (progressRef.current >= 1) {
      progressRef.current = 1
      animatingRef.current = false
      if (controlsRef.current) {
        controlsRef.current.enabled = true
        controlsRef.current.autoRotate = true
        controlsRef.current.update()
      }
    }

    // Smooth ease-in-out
    const t = progressRef.current
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

    camera.position.lerpVectors(startPosRef.current, goalPosRef.current, ease)
    if (controlsRef.current) {
      controlsRef.current.target.lerpVectors(startTargetRef.current, goalTargetRef.current, ease)
      controlsRef.current.update()
    }
  })

  return null
}

export default function Scene({ visibility, darkMode, onFrustumClick, currentStage }) {
  const controlsRef = useRef()
  const idleTimerRef = useRef(null)
  const dronePositionRef = useRef(null)

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
      <Drone visible={visibility.drone} hovering={visibility.droneHovering} animating={visibility.droneAnimating} showPath={visibility.dronePath} positionRef={dronePositionRef} />

      {/* Nadir cameras with progressive drone-reveal */}
      <NadirCameras
        url={MODELS.nadirCameras}
        state={visibility.nadirCameras}
        droneAnimating={visibility.droneAnimating}
        droneHovering={visibility.droneHovering}
        dronePositionRef={dronePositionRef}
        onFrustumClick={onFrustumClick}
      />
      <FadeModel url={MODELS.map} state={visibility.map} />
      <ScaleBar3D state={visibility.map} />
      <CameraAnimator controlsRef={controlsRef} currentStage={currentStage} />
      <ObliqueDrones url={MODELS.obliqueCameras} state={visibility.obliqueCameras} />
      <FadeModel url={MODELS.pointCloud} state={visibility.pointCloud} />
      <FadeModel url={MODELS.mesh} state={visibility.mesh} />
    </>
  )
}
