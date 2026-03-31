import { useRef, useState, useCallback, useEffect, Suspense } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import FadeModel from './FadeModel'
import Drone from './Drone'
import NadirCameras from './NadirCameras'
import ObliqueDrones from './ObliqueDrones'
import PointCloudRevealer from './PointCloudRevealer'
import ScaleBar3D from './ScaleBar3D'
import SkyDome from './SkyDome'

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

const SANDY_BROWN_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xC4A882 })

// Map survey geometry (from Drone.jsx lawnmower grid)
const MAP_CENTER = [-17, 0, -13] // cx, ground level, cz
const MAP_HALF_ALONG = 375       // half-length along long axis (750m total)
const MAP_HALF_ACROSS = 133      // half-width along short axis (266m total)
const MAP_ANGLE_DEG = 136        // rotation of long axis in degrees
const MAP_ANGLE_RAD = MAP_ANGLE_DEG * (Math.PI / 180)

// Stage 8 spiral camera config — single unified animation
const SPIRAL_DURATION = 20       // total seconds
const SPIRAL_ROTATIONS = 1       // full 360° rotations
const SPIRAL_CLOSE_DIST = 300    // closest point
const SPIRAL_END_DIST = 900      // end further out
const SPIRAL_CLOSE_ELEV = 25     // degrees — low when close
const SPIRAL_END_ELEV = 40       // degrees — end higher
// Phase boundaries (fractions of total duration)
const SPIRAL_DIVE_END = 0.15     // 0→3s: fly in close
const SPIRAL_HOLD_END = 0.35     // 3→7s: hold close
// 7→20s: spiral out

// Smooth ease-in-out cubic
const easeInOut = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2

// Stage 9 flyover camera config
const FLYOVER_APPROACH = 4       // seconds to reach start position
const FLYOVER_FLIGHT = 10        // seconds to fly across
const FLYOVER_CLIMB = 3          // seconds to climb to 45°
const FLYOVER_TOTAL = FLYOVER_APPROACH + FLYOVER_FLIGHT + FLYOVER_CLIMB
const FLYOVER_HEIGHT = 70        // camera height during flyover
const FLYOVER_LOOK_AHEAD = 250   // how far ahead on ground the camera looks
const FLYOVER_END_DIST = 900     // final orbit distance at 45°
const FLYOVER_END_ELEV_DEG = 45  // final elevation in degrees
const FLYOVER_CLIMB_ARC = Math.PI * 0.6  // rotate ~108° during climb for smooth turn

// Profile view: drone hovers at this position, camera views from the side
const PROFILE_DRONE_POS = new THREE.Vector3(-30, 100, -22)
const PROFILE_SIDE_OFFSET = 60   // how far the viewer camera sits to the side

// CameraAnimator — smoothly flies camera for stage transitions
function CameraAnimator({ controlsRef, currentStage, onSpiralStart, dronePositionRef }) {
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
  const spiralStartDist = useRef(0)     // starting distance from target
  const spiralStartElev = useRef(0)     // starting elevation angle
  // Stage 9 flyover state
  const flyoverRef = useRef(false)
  const flyoverStartPosRef = useRef(new THREE.Vector3())
  const flyoverStartTargetRef = useRef(new THREE.Vector3())
  const flyoverFlightStartRef = useRef(new THREE.Vector3())
  const flyoverFlightEndRef = useRef(new THREE.Vector3())
  const flyoverFlightDirRef = useRef(new THREE.Vector3())
  const flyoverEndPosRef = useRef(new THREE.Vector3())
  const flyoverTempRef = useRef(new THREE.Vector3())
  const flyoverClimbAngleRef = useRef(0)   // horizontal angle at climb start
  const flyoverClimbHDistRef = useRef(0)   // horizontal distance at climb start

  useEffect(() => {
    if (!controlsRef.current) return
    const prev = prevStageRef.current
    prevStageRef.current = currentStage
    if (prev === currentStage) return

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

    // Stop spiral if leaving stage 8
    if (prev === 8 && spiralRef.current) {
      spiralRef.current = false
      animatingRef.current = false
      if (controlsRef.current) controlsRef.current.enabled = true
    }
    // Stop flyover if leaving stage 10
    if (prev === 10 && flyoverRef.current) {
      flyoverRef.current = false
      if (controlsRef.current) controlsRef.current.enabled = true
    }

    // Every stage has a fixed camera position — consistent regardless of direction
    if (currentStage === 0 || currentStage === 3) {
      // Default orbit view (initial camera position)
      goalPos = new THREE.Vector3(-30, 500, 600)
      goalTarget = new THREE.Vector3(SCENE_CENTER[0], SCENE_CENTER[1], SCENE_CENTER[2])
      duration = 1.5
      autoRotateAfter = true

    } else if (currentStage === 1) {
      // Nadir profile: orbit to side-view the drone where it's already hovering
      const dronePos = dronePositionRef.current
        ? dronePositionRef.current.clone()
        : camera.position.clone().add(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(80))
      // Snap orbit target to drone immediately so it stays centered during animation
      controlsRef.current.target.copy(dronePos)
      controlsRef.current.update()
      // Camera moves to +X side of the drone (right side), slightly below
      goalPos = new THREE.Vector3(
        dronePos.x + PROFILE_SIDE_OFFSET,
        dronePos.y - 50,
        dronePos.z
      )
      goalTarget = dronePos.clone()
      duration = 1.5
      autoRotateAfter = true

    } else if (currentStage === 2) {
      // Drone flight: zoom out to show lawnmower grid
      goalPos = new THREE.Vector3(-30, 500, 600)
      goalTarget = new THREE.Vector3(SCENE_CENTER[0], SCENE_CENTER[1], SCENE_CENTER[2])
      duration = 1.5
      autoRotateAfter = true

    } else if (currentStage === 4) {
      // Top-down map view
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

    } else if (currentStage === 5) {
      // Flat plane view — near side-on (~10° elevation)
      const elevAngle = 5 * (Math.PI / 180)
      const distance = 1200

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

    } else if (currentStage === 6) {
      // Oblique profile: fixed position below drone at PROFILE_DRONE_POS
      goalPos = new THREE.Vector3(
        PROFILE_DRONE_POS.x + PROFILE_SIDE_OFFSET,
        PROFILE_DRONE_POS.y - 20,
        PROFILE_DRONE_POS.z
      )
      goalTarget = PROFILE_DRONE_POS.clone()
      duration = 3.0
      autoRotateAfter = true

    } else if (currentStage === 7) {
      // Oblique cameras — 45° looking down, zoomed out
      const elevAngle = 45 * (Math.PI / 180)
      const distance = 1600

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

    } else if (currentStage === 8) {
      // Point cloud — unified spiral: fly-in while already rotating
      const dx = camera.position.x - target.x
      const dz = camera.position.z - target.z
      const currentDist = Math.sqrt(dx * dx + camera.position.y * camera.position.y + dz * dz)
      const currentElev = Math.atan2(camera.position.y, Math.sqrt(dx * dx + dz * dz))

      spiralStartAngle.current = Math.atan2(dz, dx)
      spiralStartDist.current = currentDist
      spiralStartElev.current = currentElev

      // Go straight into spiral — no fly-in phase
      spiralRef.current = true
      progressRef.current = 0
      controlsRef.current.enabled = false
      controlsRef.current.autoRotate = false
      if (onSpiralStart) onSpiralStart()
      return // skip the standard animation setup
    } else if (currentStage === 9) {
      // Mesh reveal: animate to 45° elevated orbit, then auto-rotate
      const dx = camera.position.x - target.x
      const dz = camera.position.z - target.z
      const currentAngle = Math.atan2(dz, dx)

      const endElev = FLYOVER_END_ELEV_DEG * (Math.PI / 180)
      const hDist = FLYOVER_END_DIST * Math.cos(endElev)
      const camY = FLYOVER_END_DIST * Math.sin(endElev)

      goalPos = new THREE.Vector3(
        target.x + Math.cos(currentAngle) * hDist,
        camY,
        target.z + Math.sin(currentAngle) * hDist
      )
      goalTarget = target.clone()
      duration = 2.0
      autoRotateAfter = true

    } else if (currentStage === 10) {
      // Texturing flyover: approach → fly across short axis → climb to orbit
      const shortAxisAngle = MAP_ANGLE_RAD + Math.PI / 2
      const shortDirX = Math.cos(shortAxisAngle)
      const shortDirZ = Math.sin(shortAxisAngle)
      const flyDist = MAP_HALF_ALONG * 0.6 // stay over the model
      flyoverFlightStartRef.current.set(
        MAP_CENTER[0] - shortDirX * flyDist,
        FLYOVER_HEIGHT,
        MAP_CENTER[2] - shortDirZ * flyDist
      )
      flyoverFlightEndRef.current.set(
        MAP_CENTER[0] + shortDirX * flyDist,
        FLYOVER_HEIGHT,
        MAP_CENTER[2] + shortDirZ * flyDist
      )
      flyoverFlightDirRef.current.set(shortDirX, 0, shortDirZ)

      flyoverStartPosRef.current.copy(camera.position)
      flyoverStartTargetRef.current.copy(controlsRef.current.target)

      // Compute climb arc start parameters from flight end position
      const climbDx = flyoverFlightEndRef.current.x - MAP_CENTER[0]
      const climbDz = flyoverFlightEndRef.current.z - MAP_CENTER[2]
      flyoverClimbAngleRef.current = Math.atan2(climbDz, climbDx)
      flyoverClimbHDistRef.current = Math.sqrt(climbDx * climbDx + climbDz * climbDz)

      // Final climb position: 45° from MAP_CENTER, rotated by arc amount
      const endElev = FLYOVER_END_ELEV_DEG * (Math.PI / 180)
      const endAngle = flyoverClimbAngleRef.current + FLYOVER_CLIMB_ARC
      const hDist = FLYOVER_END_DIST * Math.cos(endElev)
      const camY = FLYOVER_END_DIST * Math.sin(endElev)
      flyoverEndPosRef.current.set(
        target.x + Math.cos(endAngle) * hDist,
        camY,
        target.z + Math.sin(endAngle) * hDist
      )

      flyoverRef.current = true
      progressRef.current = 0
      controlsRef.current.enabled = false
      controlsRef.current.autoRotate = false
      return
    }
    // Stage 11: no camera animation (free exploration)

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
    if (!animatingRef.current && !spiralRef.current && !flyoverRef.current) return

    const target = new THREE.Vector3(MAP_CENTER[0], MAP_CENTER[1], MAP_CENTER[2])

    // Spiral animation (stage 8)
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
      // Linear rotation so it matches auto-rotate speed seamlessly
      const angle = spiralStartAngle.current + t * SPIRAL_ROTATIONS * Math.PI * 2

      // Three-phase distance: dive in (0→DIVE_END), hold close (DIVE_END→HOLD_END), spiral out (HOLD_END→1)
      let dist, elev
      const closeElev = SPIRAL_CLOSE_ELEV * (Math.PI / 180)
      const endElev = SPIRAL_END_ELEV * (Math.PI / 180)

      if (t < SPIRAL_DIVE_END) {
        // Dive in close
        const diveT = t / SPIRAL_DIVE_END
        const e = easeInOut(diveT)
        dist = spiralStartDist.current + (SPIRAL_CLOSE_DIST - spiralStartDist.current) * e
        elev = spiralStartElev.current + (closeElev - spiralStartElev.current) * e
      } else if (t < SPIRAL_HOLD_END) {
        // Hold close — stay at close distance/elevation
        dist = SPIRAL_CLOSE_DIST
        elev = closeElev
      } else {
        // Spiral out slowly
        const outT = (t - SPIRAL_HOLD_END) / (1 - SPIRAL_HOLD_END)
        const e = easeInOut(outT)
        dist = SPIRAL_CLOSE_DIST + (SPIRAL_END_DIST - SPIRAL_CLOSE_DIST) * e
        elev = closeElev + (endElev - closeElev) * e
      }

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

    // Flyover animation (stage 9)
    if (flyoverRef.current) {
      progressRef.current += delta / FLYOVER_TOTAL
      if (progressRef.current >= 1) {
        progressRef.current = 1
        flyoverRef.current = false
        if (controlsRef.current) {
          controlsRef.current.target.copy(target)
          controlsRef.current.enabled = true
          controlsRef.current.autoRotate = true
          controlsRef.current.update()
        }
        return
      }

      const totalTime = progressRef.current * FLYOVER_TOTAL

      if (totalTime < FLYOVER_APPROACH) {
        // Phase 1: Approach — fly from current position to flight start
        const t = easeInOut(totalTime / FLYOVER_APPROACH)
        camera.position.lerpVectors(flyoverStartPosRef.current, flyoverFlightStartRef.current, t)
        const lookTarget = flyoverTempRef.current.set(
          flyoverFlightStartRef.current.x + flyoverFlightDirRef.current.x * FLYOVER_LOOK_AHEAD,
          0,
          flyoverFlightStartRef.current.z + flyoverFlightDirRef.current.z * FLYOVER_LOOK_AHEAD
        )
        controlsRef.current.target.lerpVectors(flyoverStartTargetRef.current, lookTarget, t)
      } else if (totalTime < FLYOVER_APPROACH + FLYOVER_FLIGHT) {
        // Phase 2: Flight — linear motion along the long axis
        const t = (totalTime - FLYOVER_APPROACH) / FLYOVER_FLIGHT
        camera.position.lerpVectors(flyoverFlightStartRef.current, flyoverFlightEndRef.current, t)
        controlsRef.current.target.set(
          camera.position.x + flyoverFlightDirRef.current.x * FLYOVER_LOOK_AHEAD,
          0,
          camera.position.z + flyoverFlightDirRef.current.z * FLYOVER_LOOK_AHEAD
        )
      } else {
        // Phase 3: Arc + climb to 45° elevated view
        const t = easeInOut((totalTime - FLYOVER_APPROACH - FLYOVER_FLIGHT) / FLYOVER_CLIMB)

        // Arc around the model while climbing
        const startAngle = flyoverClimbAngleRef.current
        const angle = startAngle + FLYOVER_CLIMB_ARC * t

        const endElevRad = FLYOVER_END_ELEV_DEG * (Math.PI / 180)
        const endHDist = FLYOVER_END_DIST * Math.cos(endElevRad)
        const endCamY = FLYOVER_END_DIST * Math.sin(endElevRad)

        const hDist = flyoverClimbHDistRef.current + (endHDist - flyoverClimbHDistRef.current) * t
        const camY = FLYOVER_HEIGHT + (endCamY - FLYOVER_HEIGHT) * t

        camera.position.set(
          MAP_CENTER[0] + Math.cos(angle) * hDist,
          camY,
          MAP_CENTER[2] + Math.sin(angle) * hDist
        )

        // Target smoothly transitions to MAP_CENTER
        const flightEndTarget = flyoverTempRef.current.set(
          flyoverFlightEndRef.current.x + flyoverFlightDirRef.current.x * FLYOVER_LOOK_AHEAD,
          0,
          flyoverFlightEndRef.current.z + flyoverFlightDirRef.current.z * FLYOVER_LOOK_AHEAD
        )
        controlsRef.current.target.lerpVectors(flightEndTarget, target, t)
      }

      controlsRef.current.update()
      return
    }

    // Standard linear animation
    progressRef.current += delta / animDurationRef.current
    if (progressRef.current >= 1) {
      progressRef.current = 1
      animatingRef.current = false

      if (controlsRef.current) {
        controlsRef.current.enabled = true
        controlsRef.current.autoRotate = postAnimAutoRotateRef.current
        controlsRef.current.update()
      }
    }

    const t = progressRef.current
    const ease = easeInOut(t)

    camera.position.lerpVectors(startPosRef.current, goalPosRef.current, ease)
    if (controlsRef.current) {
      controlsRef.current.target.lerpVectors(startTargetRef.current, goalTargetRef.current, ease)
      controlsRef.current.update()
    }
  })

  return null
}

export default function Scene({ visibility, darkMode, currentStage }) {
  const controlsRef = useRef()
  const idleTimerRef = useRef(null)
  const dronePositionRef = useRef(null)
  const currentStageRef = useRef(currentStage)
  currentStageRef.current = currentStage

  // Delay map + scale bar fade-in until after camera animation completes
  const [mapReady, setMapReady] = useState(false)
  const mapTimerRef = useRef(null)
  // Fade out nadir cameras after map has fully faded in at stage 4
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

  // Reset spiral states when leaving stage 8
  useEffect(() => {
    if (currentStage !== 8) {
      setSpiralStarted(false)
      setObliqueFadeOut(false)
      if (obliqueFadeTimerRef.current) clearTimeout(obliqueFadeTimerRef.current)
    }
    return () => {
      if (obliqueFadeTimerRef.current) clearTimeout(obliqueFadeTimerRef.current)
    }
  }, [currentStage])

  useEffect(() => {
    if (currentStage === 4) {
      // Camera animation takes 1.5s; wait an extra 1s before showing the map
      setMapReady(false)
      setNadirHidden(false)
      if (mapTimerRef.current) clearTimeout(mapTimerRef.current)
      if (nadirTimerRef.current) clearTimeout(nadirTimerRef.current)
      // Single callback so React batches both state updates in one render
      mapTimerRef.current = setTimeout(() => {
        setMapReady(true)
        setNadirHidden(true)
      }, 2500)
    } else {
      if (mapTimerRef.current) clearTimeout(mapTimerRef.current)
      if (nadirTimerRef.current) clearTimeout(nadirTimerRef.current)
      // For stages > 4, show map immediately (it's already loaded)
      setMapReady(currentStage > 4)
      setNadirHidden(currentStage > 4)
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
      // Don't re-enable autorotate at stage 4 (top-down map view) or 7 (oblique)
      if (controlsRef.current && currentStageRef.current !== 4 && currentStageRef.current !== 7) {
        controlsRef.current.autoRotate = true
      }
    }, 5000)
  }, [])

  return (
    <>
      {/* Environment */}
      <SkyDome darkMode={darkMode} />

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
        minDistance={100}
        maxDistance={1000}
        autoRotate
        autoRotateSpeed={0.3}
        onStart={handleInteractionStart}
        onEnd={handleInteractionEnd}
      />

      {/* Drone (stages 0-2, 6) */}
      <Drone
        visible={visibility.drone}
        hovering={visibility.droneHovering}
        animating={visibility.droneAnimating}
        showPath={visibility.dronePath}
        positionRef={dronePositionRef}
        profileNadir={visibility.droneProfileNadir}
        profileOblique={visibility.droneProfileOblique}
      />

      {/* Nadir cameras with progressive drone-reveal */}
      <NadirCameras
        url={MODELS.nadirCameras}
        state={nadirHidden ? 'fadeOut' : visibility.nadirCameras}
        droneAnimating={visibility.droneAnimating}
        droneHovering={visibility.droneHovering}
        dronePositionRef={dronePositionRef}
        currentStage={currentStage}
        darkMode={darkMode}
      />
      <Suspense fallback={null}>
        <FadeModel url={MODELS.map} state={mapReady ? visibility.map : undefined} fadeDuration={visibility.map === 'fadeOut' ? 1 : 0.75} warmupId="map" />
      </Suspense>
      <ScaleBar3D state={mapReady ? visibility.map : undefined} />
      <CameraAnimator controlsRef={controlsRef} currentStage={currentStage} onSpiralStart={handleSpiralStart} dronePositionRef={dronePositionRef} />
      <Suspense fallback={null}>
        <ObliqueDrones url={MODELS.obliqueCameras} state={obliqueFadeOut ? 'fadeOut' : visibility.obliqueCameras} fadeDuration={2} />
      </Suspense>
      <Suspense fallback={null}>
        <PointCloudRevealer
          url={MODELS.pointCloud}
          state={
            visibility.pointCloud === 'fadeOut'
              ? 'fadeOut'
              : (spiralStarted ? visibility.pointCloud : undefined)
          }
          fadeOutDuration={10}
        />
      </Suspense>
      {/* Solid (untextured) mesh — fades in at stage 9, fades out at stage 10 */}
      <Suspense fallback={null}>
        <FadeModel
          url={MODELS.mesh}
          state={visibility.meshSolid}
          fadeDuration={visibility.meshSolid === 'fadeIn' ? 10 : 4}
          overrideMaterial={SANDY_BROWN_MATERIAL}
          warmupId="mesh"
        />
      </Suspense>
      {/* Textured mesh — fades in during stage 10 approach, done before flight */}
      <Suspense fallback={null}>
        <FadeModel
          url={MODELS.mesh}
          state={visibility.meshTextured}
          fadeDuration={4}
          warmupId="meshTextured"
        />
      </Suspense>
    </>
  )
}
