import { useRef, useState, useCallback, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import FadeModel from './FadeModel'
import Drone from './Drone'
import NadirCameras from './NadirCameras'
import ObliqueDrones from './ObliqueDrones'
import PointCloudRevealer from './PointCloudRevealer'
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

// Stage 6 spiral camera config
const SPIRAL_DURATION = 13       // seconds
const SPIRAL_ROTATIONS = 1       // full 360° rotations
const SPIRAL_START_DIST = 300    // start close
const SPIRAL_END_DIST = 900      // end further out
const SPIRAL_START_ELEV = 25     // degrees — start low, looking inward
const SPIRAL_END_ELEV = 40       // degrees — end higher

// CameraAnimator — smoothly flies camera for stage transitions
function CameraAnimator({ controlsRef, currentStage, onSpiralStart }) {
  const { camera, size } = useThree()
  const animatingRef = useRef(false)
  const progressRef = useRef(0)
  const prevStageRef = useRef(currentStage)
  const startPosRef = useRef(new THREE.Vector3())
  const startTargetRef = useRef(new THREE.Vector3())
  const goalPosRef = useRef(new THREE.Vector3())
  const goalTargetRef = useRef(new THREE.Vector3())
  const animDurationRef = useRef(1.5)
  const postAnimAutoRotateRef = useRef(false)
  const spiralRef = useRef(false)       // true when doing spiral anim
  const spiralStartAngle = useRef(0)    // starting horizontal angle

  useEffect(() => {
    if (!controlsRef.current) return
    const prev = prevStageRef.current
    prevStageRef.current = currentStage

    const target = new THREE.Vector3(MAP_CENTER[0], MAP_CENTER[1], MAP_CENTER[2])
    const aspect = size.width / size.height
    const isPortrait = aspect < 1
    const fovRad = camera.fov * (Math.PI / 180)
    const cos = Math.cos(MAP_ANGLE_RAD)
    const sin = Math.sin(MAP_ANGLE_RAD)

    let goalPos = null
    let goalTarget = null
    let duration = 1.5
    let autoRotateAfter = false

    // Stop spiral if leaving stage 6
    if (prev === 6 && currentStage !== 6 && spiralRef.current) {
      spiralRef.current = false
      animatingRef.current = false
      if (controlsRef.current) controlsRef.current.enabled = true
    }

    if (currentStage === 3 && prev !== 3) {
      // Stage 3: top-down map view
      let fitDimension
      if (isPortrait) {
        const verticalFit = (MAP_HALF_ALONG * 2 * 1.15) / (2 * Math.tan(fovRad / 2))
        const horizontalFit = (MAP_HALF_ACROSS * 2 * 1.15) / (2 * Math.tan(fovRad / 2) * aspect)
        fitDimension = Math.max(verticalFit, horizontalFit)
      } else {
        const horizontalFit = (MAP_HALF_ALONG * 2 * 1.15) / (2 * Math.tan(fovRad / 2) * aspect)
        const verticalFit = (MAP_HALF_ACROSS * 2 * 1.15) / (2 * Math.tan(fovRad / 2))
        fitDimension = Math.max(horizontalFit, verticalFit)
      }

      let offsetX, offsetZ
      if (isPortrait) {
        offsetX = Math.cos(MAP_ANGLE_RAD + Math.PI / 2) * 0.5
        offsetZ = Math.sin(MAP_ANGLE_RAD + Math.PI / 2) * 0.5
      } else {
        offsetX = cos * 0.5
        offsetZ = sin * 0.5
      }

      goalPos = new THREE.Vector3(target.x + offsetX, fitDimension, target.z + offsetZ)
      goalTarget = target.clone()
      autoRotateAfter = false

    } else if (currentStage === 4 && prev !== 4) {
      // Stage 4: flat plane view — near side-on (~10° elevation) to show map is flat
      // Camera positioned at low elevation angle along the map's short axis
      const elevAngle = 10 * (Math.PI / 180) // 10 degrees above horizontal
      const distance = 1200 // far enough to see the full map as a flat plane

      // Position camera along the short axis (perpendicular to long axis)
      const shortAxisAngle = MAP_ANGLE_RAD + Math.PI / 2
      const horizontalDist = distance * Math.cos(elevAngle)
      const camY = distance * Math.sin(elevAngle)

      goalPos = new THREE.Vector3(
        target.x + Math.cos(shortAxisAngle) * horizontalDist,
        camY,
        target.z + Math.sin(shortAxisAngle) * horizontalDist
      )
      goalTarget = target.clone()
      duration = 2.0
      autoRotateAfter = true

    } else if (currentStage === 5 && prev !== 5) {
      // Stage 5: oblique cameras — 45° looking down, zoomed out to see full grids
      const elevAngle = 45 * (Math.PI / 180)
      const distance = 1600 // further out to see oblique grids

      // Approach from a direction along the map's short axis
      const shortAxisAngle = MAP_ANGLE_RAD + Math.PI / 2
      const horizontalDist = distance * Math.cos(elevAngle)
      const camY = distance * Math.sin(elevAngle)

      goalPos = new THREE.Vector3(
        target.x + Math.cos(shortAxisAngle) * horizontalDist,
        camY,
        target.z + Math.sin(shortAxisAngle) * horizontalDist
      )
      goalTarget = target.clone()
      duration = 2.0
      autoRotateAfter = false

    } else if (currentStage === 6 && prev !== 6) {
      // Stage 6: point cloud — spiral camera outward while points reveal
      // First, smoothly fly to starting position of spiral, then switch to spiral mode
      const startElev = SPIRAL_START_ELEV * (Math.PI / 180)
      const hDist = SPIRAL_START_DIST * Math.cos(startElev)
      const camY = SPIRAL_START_DIST * Math.sin(startElev)

      // Compute starting angle from current camera position
      const dx = camera.position.x - target.x
      const dz = camera.position.z - target.z
      const currentAngle = Math.atan2(dz, dx)
      spiralStartAngle.current = currentAngle

      goalPos = new THREE.Vector3(
        target.x + Math.cos(currentAngle) * hDist,
        camY,
        target.z + Math.sin(currentAngle) * hDist
      )
      goalTarget = target.clone()
      duration = 1.5 // fly-in duration before spiral starts
      autoRotateAfter = false
    }

    if (goalPos) {
      startPosRef.current.copy(camera.position)
      startTargetRef.current.copy(controlsRef.current.target)
      goalPosRef.current.copy(goalPos)
      goalTargetRef.current.copy(goalTarget)
      animDurationRef.current = duration
      postAnimAutoRotateRef.current = autoRotateAfter

      progressRef.current = 0
      animatingRef.current = true
      controlsRef.current.enabled = false
      controlsRef.current.autoRotate = false
    }
  }, [currentStage, camera, size, controlsRef])

  useFrame((_, delta) => {
    if (!animatingRef.current && !spiralRef.current) return

    const target = new THREE.Vector3(MAP_CENTER[0], MAP_CENTER[1], MAP_CENTER[2])

    // Spiral animation (stage 6)
    if (spiralRef.current) {
      progressRef.current += delta / SPIRAL_DURATION
      if (progressRef.current >= 1) {
        progressRef.current = 1
        spiralRef.current = false
        if (controlsRef.current) {
          controlsRef.current.enabled = true
          controlsRef.current.autoRotate = true
          controlsRef.current.update()
        }
        return
      }

      const t = progressRef.current
      // Ease out for smooth deceleration
      const ease = 1 - Math.pow(1 - t, 2)

      const angle = spiralStartAngle.current + ease * SPIRAL_ROTATIONS * Math.PI * 2
      const dist = SPIRAL_START_DIST + (SPIRAL_END_DIST - SPIRAL_START_DIST) * ease
      const elevDeg = SPIRAL_START_ELEV + (SPIRAL_END_ELEV - SPIRAL_START_ELEV) * ease
      const elev = elevDeg * (Math.PI / 180)

      const hDist = dist * Math.cos(elev)
      const camY = dist * Math.sin(elev)

      camera.position.set(
        target.x + Math.cos(angle) * hDist,
        camY,
        target.z + Math.sin(angle) * hDist
      )
      if (controlsRef.current) {
        controlsRef.current.target.copy(target)
        controlsRef.current.update()
      }
      return
    }

    // Standard linear animation
    progressRef.current += delta / animDurationRef.current
    if (progressRef.current >= 1) {
      progressRef.current = 1
      animatingRef.current = false

      // If stage 6 fly-in just finished, start the spiral
      if (prevStageRef.current === 6) {
        spiralRef.current = true
        progressRef.current = 0
        if (onSpiralStart) onSpiralStart()
        return
      }

      if (controlsRef.current) {
        controlsRef.current.enabled = true
        controlsRef.current.autoRotate = postAnimAutoRotateRef.current
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
  const currentStageRef = useRef(currentStage)
  currentStageRef.current = currentStage

  // Delay map + scale bar fade-in until after camera animation completes
  const [mapReady, setMapReady] = useState(false)
  const mapTimerRef = useRef(null)
  // Fade out nadir cameras after map has fully faded in at stage 3
  const [nadirHidden, setNadirHidden] = useState(false)
  const nadirTimerRef = useRef(null)
  // Spiral-dependent states: point cloud waits for spiral, oblique cameras fade 5s in
  const [spiralStarted, setSpiralStarted] = useState(false)
  const [obliqueFadeOut, setObliqueFadeOut] = useState(false)
  const obliqueFadeTimerRef = useRef(null)

  const handleSpiralStart = useCallback(() => {
    setSpiralStarted(true)
    // 5 seconds into spiral, fade out oblique cameras
    if (obliqueFadeTimerRef.current) clearTimeout(obliqueFadeTimerRef.current)
    obliqueFadeTimerRef.current = setTimeout(() => setObliqueFadeOut(true), 5000)
  }, [])

  // Reset spiral states when leaving stage 6
  useEffect(() => {
    if (currentStage !== 6) {
      setSpiralStarted(false)
      setObliqueFadeOut(false)
      if (obliqueFadeTimerRef.current) clearTimeout(obliqueFadeTimerRef.current)
    }
    return () => {
      if (obliqueFadeTimerRef.current) clearTimeout(obliqueFadeTimerRef.current)
    }
  }, [currentStage])

  useEffect(() => {
    if (currentStage === 3) {
      // Camera animation takes 1.5s; wait an extra 1s before showing the map
      setMapReady(false)
      setNadirHidden(false)
      if (mapTimerRef.current) clearTimeout(mapTimerRef.current)
      if (nadirTimerRef.current) clearTimeout(nadirTimerRef.current)
      mapTimerRef.current = setTimeout(() => setMapReady(true), 2500)
      // Nadir fadeout starts after map fade-in completes (2500ms + 750ms fade duration)
      nadirTimerRef.current = setTimeout(() => setNadirHidden(true), 3250)
    } else {
      if (mapTimerRef.current) clearTimeout(mapTimerRef.current)
      if (nadirTimerRef.current) clearTimeout(nadirTimerRef.current)
      // For stages > 3, show map immediately (it's already loaded)
      setMapReady(currentStage > 3)
      setNadirHidden(currentStage > 3)
    }
    return () => {
      if (mapTimerRef.current) clearTimeout(mapTimerRef.current)
      if (nadirTimerRef.current) clearTimeout(nadirTimerRef.current)
    }
  }, [currentStage])

  const handleInteractionStart = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = false
    }
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
  }, [])

  const handleInteractionEnd = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => {
      // Don't re-enable autorotate at stage 3 (top-down map view) or 5 (oblique)
      if (controlsRef.current && currentStageRef.current !== 3 && currentStageRef.current !== 5) {
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
        state={nadirHidden ? 'fadeOut' : visibility.nadirCameras}
        droneAnimating={visibility.droneAnimating}
        droneHovering={visibility.droneHovering}
        dronePositionRef={dronePositionRef}
        onFrustumClick={onFrustumClick}
      />
      <FadeModel url={MODELS.map} state={mapReady ? visibility.map : undefined} fadeDuration={visibility.map === 'fadeOut' ? 2 : 0.75} />
      <ScaleBar3D state={mapReady ? visibility.map : undefined} />
      <CameraAnimator controlsRef={controlsRef} currentStage={currentStage} onSpiralStart={handleSpiralStart} />
      <ObliqueDrones url={MODELS.obliqueCameras} state={obliqueFadeOut ? 'fadeOut' : visibility.obliqueCameras} fadeDuration={2} />
      <PointCloudRevealer url={MODELS.pointCloud} state={spiralStarted ? visibility.pointCloud : (visibility.pointCloud === 'fadeOut' ? 'fadeOut' : undefined)} />
      <FadeModel url={MODELS.mesh} state={visibility.mesh} />
    </>
  )
}
