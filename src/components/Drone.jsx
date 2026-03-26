import { useRef, useMemo, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'

// How far in front of the camera the drone hovers
const HOVER_DISTANCE = 80
const HOVER_DROP = 0 // vertical offset from camera (0 = centered in view)

// Wind noise — layered sine waves for realistic pitch/roll turbulence
const WIND_PITCH_AMP = 3 * (Math.PI / 180)
const WIND_ROLL_AMP = 2.5 * (Math.PI / 180)
const WIND_FREQ_1 = 1.7
const WIND_FREQ_2 = 3.1

function windNoise(t) {
  const pitch = Math.sin(t * WIND_FREQ_1) * WIND_PITCH_AMP + Math.sin(t * WIND_FREQ_2 + 1.3) * WIND_PITCH_AMP * 0.5
  const roll = Math.sin(t * WIND_FREQ_1 * 0.8 + 2.1) * WIND_ROLL_AMP + Math.sin(t * WIND_FREQ_2 * 1.2 + 0.7) * WIND_ROLL_AMP * 0.4
  return { pitch, roll }
}

// Camera look-around noise for idle/hover — medium organic feel
const LOOK_YAW_AMP = 15 * (Math.PI / 180)
const LOOK_PITCH_AMP = 10 * (Math.PI / 180)
const LOOK_FREQ_1 = 0.4
const LOOK_FREQ_2 = 0.9
const LOOK_FREQ_3 = 0.17 // very slow attention-shift envelope

function cameraLookNoise(t) {
  // Slow modulation creates natural "attention dwell" pauses
  const attentionMod = 0.5 + 0.5 * Math.sin(t * LOOK_FREQ_3)
  const yaw = (Math.sin(t * LOOK_FREQ_1) * LOOK_YAW_AMP
    + Math.sin(t * LOOK_FREQ_2 + 2.1) * LOOK_YAW_AMP * 0.3) * attentionMod
  const pitch = (Math.sin(t * LOOK_FREQ_1 * 0.7 + 1.4) * LOOK_PITCH_AMP
    + Math.sin(t * LOOK_FREQ_2 * 0.6 + 3.2) * LOOK_PITCH_AMP * 0.25) * attentionMod
  return { yaw, pitch }
}

// Camera pitch targets
const PITCH_FORWARD = 0
const PITCH_NADIR = -Math.PI / 2
const PITCH_OBLIQUE = -Math.PI / 4

// Profile hover position (above scene center)
const PROFILE_POS = new THREE.Vector3(-30, 100, -22)

// Generate a lawnmower grid path rotated to align with the nadir camera strips
// Camera strips run ~50° from vertical (upper-left to lower-right)
function generateLawnmowerPath() {
  const y = 97
  const spacing = 38.2 // meters between passes
  const angle = 136 * (Math.PI / 180) // rotation in radians (180 - 43°)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)

  // Center of the camera grid
  const cx = -17
  const cz = -13

  // Grid extents in local (rotated) frame — along and across the strips
  const halfAlong = 375  // half-length along each strip
  const halfAcross = 133 // half-width spanning all strips (8 passes)
  const numPasses = Math.ceil((halfAcross * 2) / spacing)

  const waypoints = []
  let forward = true

  for (let i = 0; i <= numPasses; i++) {
    const across = -halfAcross + i * spacing

    // Two endpoints of this pass in local frame
    const localA = { u: across, v: -halfAlong }
    const localB = { u: across, v: halfAlong }

    // Rotate to world frame
    const ax = cx + localA.u * cos - localA.v * sin
    const az = cz + localA.u * sin + localA.v * cos
    const bx = cx + localB.u * cos - localB.v * sin
    const bz = cz + localB.u * sin + localB.v * cos

    if (forward) {
      waypoints.push(new THREE.Vector3(ax, y, az))
      waypoints.push(new THREE.Vector3(bx, y, bz))
    } else {
      waypoints.push(new THREE.Vector3(bx, y, bz))
      waypoints.push(new THREE.Vector3(ax, y, az))
    }
    forward = !forward
  }

  return waypoints
}

// Rotor geometry — partial disc (two 150° blades with gaps)
const ROTOR_GEO = new THREE.CylinderGeometry(2.5, 2.5, 0.3, 16, 1, false, 0, Math.PI * 0.83)
const ROTOR_MAT = new THREE.MeshStandardMaterial({ color: '#ff6644', emissive: '#ff3300', emissiveIntensity: 0.3 })

// Rotor positions relative to drone center (corners of the body)
const ROTOR_OFFSETS = [
  [4, 1.8, 6],
  [-4, 1.8, 6],
  [4, 1.8, -6],
  [-4, 1.8, -6],
]

// Shared camera geometry + materials (reused by ObliqueDrones too)
export const CAMERA_BODY_GEO = new THREE.BoxGeometry(3, 2.5, 3)
export const CAMERA_BODY_MAT = new THREE.MeshStandardMaterial({ color: '#ff6644', emissive: '#ff3300', emissiveIntensity: 0.3 })
// Torus lens ring — has real depth so it's visible from the side, no z-fighting
export const CAMERA_LENS_GEO = new THREE.TorusGeometry(1.0, 0.2, 8, 24)
export const CAMERA_LENS_MAT = new THREE.MeshStandardMaterial({ color: '#111111' })

export default function Drone({ visible, hovering, animating, showPath, positionRef, profileNadir, profileOblique }) {
  const meshRef = useRef()
  const rotorRefs = [useRef(), useRef(), useRef(), useRef()]
  const cameraGimbalRef = useRef()
  const progressRef = useRef(0)
  const phaseRef = useRef('hover') // 'hover' | 'transit' | 'grid' | 'depart'
  const [inGrid, setInGrid] = useState(false)
  const transitRef = useRef(0) // 0→1 lerp for hover-to-grid-start
  const timeRef = useRef(0)
  const prevAnimatingRef = useRef(false)
  const prevHoveringRef = useRef(hovering)
  const transitCurveRef = useRef(null)
  const transitLengthRef = useRef(0)
  const [lineOpacity, setLineOpacity] = useState(0)
  const lineOpacityRef = useRef(0)

  // Camera pitch animation state
  const cameraPitchRef = useRef(0)
  const profileAnimStartRef = useRef(0)
  const profileAnimActiveRef = useRef(false)
  const profileAnimFromRef = useRef(0)
  const profileAnimToRef = useRef(0)
  const prevProfileNadirRef = useRef(false)
  const prevProfileObliqueRef = useRef(false)

  // Departure animation state
  const departCurveRef = useRef(null)
  const departLengthRef = useRef(0)
  const departProgressRef = useRef(0)
  const departSpeed = 150

  const { camera } = useThree()

  const waypoints = useMemo(() => generateLawnmowerPath(), [])

  // Build a CatmullRom curve through waypoints for smooth interpolation
  const curve = useMemo(() => {
    return new THREE.CatmullRomCurve3(waypoints, false, 'catmullrom', 0.01)
  }, [waypoints])

  // Total path length for speed calculation
  const pathLength = useMemo(() => curve.getLength(), [curve])

  // Line points for the flight path visualization
  const linePoints = useMemo(() => {
    return curve.getPoints(500)
  }, [curve])

  const gridSpeed = 120 // meters per second
  const transitSpeed = 150

  // Detect transition from hovering to animating
  useFrame((_, delta) => {
    if (!meshRef.current || !visible) return

    // Reset to hover when returning to stage 0
    if (hovering && !prevHoveringRef.current) {
      phaseRef.current = 'hover'
      progressRef.current = 0
      transitRef.current = 0
      timeRef.current = 0
      setInGrid(false)
      lineOpacityRef.current = 0
      setLineOpacity(0)
    }
    prevHoveringRef.current = hovering

    // Detect when animating starts
    if (animating && !prevAnimatingRef.current) {
      if (phaseRef.current === 'hover') {
        // Smooth cubic Bezier arc: departs straight ahead from camera,
        // arrives smoothly at grid start with no sharp turns.
        const startPos = meshRef.current.position.clone()
        const gridStart = waypoints[0]

        // Camera forward direction (into the scene)
        const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)

        // P1: pull handle along camera forward — controls departure direction
        // Long handle = drone flies straight ahead for longer before curving
        const dist = startPos.distanceTo(gridStart)
        const handleLen = Math.max(dist * 0.45, 80)
        const p1 = startPos.clone().add(camForward.clone().multiplyScalar(handleLen))
        p1.y = THREE.MathUtils.lerp(startPos.y, gridStart.y, 0.25)

        // P2: pull handle approaching grid start from its incoming direction
        // Use direction from grid waypoint 0→1 reversed, so drone arrives aligned
        const gridDir = new THREE.Vector3().subVectors(waypoints[0], waypoints[1]).normalize()
        const p2 = gridStart.clone().add(gridDir.multiplyScalar(handleLen * 0.6))
        p2.y = THREE.MathUtils.lerp(startPos.y, gridStart.y, 0.75)

        // Sample the cubic Bezier into points for a CatmullRom (smooth arc)
        const bezier = new THREE.CubicBezierCurve3(startPos, p1, p2, gridStart)
        const samples = bezier.getPoints(20)
        transitCurveRef.current = new THREE.CatmullRomCurve3(samples, false, 'catmullrom', 0.0)
        transitLengthRef.current = transitCurveRef.current.getLength()
        phaseRef.current = 'transit'
        transitRef.current = 0
      } else {
        // Returning to stage 1 — restart grid from beginning
        phaseRef.current = 'grid'
        progressRef.current = 0
        setInGrid(true)
      }
    }
    prevAnimatingRef.current = animating

    // Detect profile stage transitions — start pitch animations
    if (profileNadir && !prevProfileNadirRef.current) {
      phaseRef.current = 'hover'
      profileAnimFromRef.current = PITCH_FORWARD
      profileAnimToRef.current = PITCH_NADIR
      cameraPitchRef.current = PITCH_FORWARD
      profileAnimStartRef.current = timeRef.current
      profileAnimActiveRef.current = true
    }
    if (profileOblique && !prevProfileObliqueRef.current) {
      phaseRef.current = 'hover'
      profileAnimFromRef.current = PITCH_NADIR
      profileAnimToRef.current = PITCH_OBLIQUE
      cameraPitchRef.current = PITCH_NADIR
      profileAnimStartRef.current = timeRef.current
      profileAnimActiveRef.current = true
    }
    prevProfileNadirRef.current = profileNadir
    prevProfileObliqueRef.current = profileOblique

    // Accumulate time and spin rotors (before phase logic so it runs every frame)
    timeRef.current += delta
    const rotorSpeed = 25
    for (const ref of rotorRefs) {
      if (ref.current) ref.current.rotation.y += delta * rotorSpeed
    }
    const t = timeRef.current
    const wind = windNoise(t)

    // Profile stages: hover at fixed world position with fixed yaw
    if (profileNadir || profileOblique) {
      const bobY = Math.sin(t * 1.5) * 3
      meshRef.current.position.set(PROFILE_POS.x, PROFILE_POS.y + bobY, PROFILE_POS.z)
      if (positionRef) positionRef.current = meshRef.current.position
      // Fixed yaw=0: drone faces -Z, so its right side faces +X (where viewer camera is)
      meshRef.current.rotation.set(wind.pitch, 0, wind.roll)

      // Camera pitch animation
      if (profileAnimActiveRef.current && cameraGimbalRef.current) {
        const elapsed = t - profileAnimStartRef.current
        const duration = 2.0
        const p = Math.min(elapsed / duration, 1)
        // Cubic ease-in-out
        const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
        cameraPitchRef.current = profileAnimFromRef.current + (profileAnimToRef.current - profileAnimFromRef.current) * ease
        if (p >= 1) profileAnimActiveRef.current = false
      }
      if (cameraGimbalRef.current) {
        cameraGimbalRef.current.rotation.set(cameraPitchRef.current, 0, 0)
      }
      return
    }

    if (phaseRef.current === 'hover') {
      // Position drone in front of the camera
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
      const hoverPos = camera.position.clone()
        .add(dir.multiplyScalar(HOVER_DISTANCE))
      hoverPos.y -= HOVER_DROP
      // Gentle bob
      const bobY = Math.sin(timeRef.current * 1.5) * 3
      hoverPos.y += bobY
      meshRef.current.position.copy(hoverPos)
      if (positionRef) positionRef.current = meshRef.current.position
      // Face the camera (yaw only, stay level)
      const camDir = camera.position.clone().sub(meshRef.current.position)
      const yaw = Math.atan2(camDir.x, camDir.z)
      meshRef.current.rotation.set(wind.pitch, yaw, wind.roll)

      // Idle camera look-around
      if (cameraGimbalRef.current) {
        const look = cameraLookNoise(t)
        cameraGimbalRef.current.rotation.set(look.pitch, look.yaw, 0)
        cameraPitchRef.current = look.pitch
      }
      return
    }

    if (phaseRef.current === 'transit') {
      const tc = transitCurveRef.current
      if (!tc) return
      transitRef.current += (delta * transitSpeed) / transitLengthRef.current
      if (transitRef.current >= 1) {
        transitRef.current = 1
        phaseRef.current = 'grid'
        progressRef.current = 0
        setInGrid(true)
      }
      // Fade in the grid line during transit
      if (lineOpacityRef.current < 0.4) {
        lineOpacityRef.current = Math.min(0.4, lineOpacityRef.current + delta * 0.25)
        setLineOpacity(lineOpacityRef.current)
      }
      const point = tc.getPointAt(Math.min(transitRef.current, 1))
      meshRef.current.position.copy(point)
      if (positionRef) positionRef.current = point
      // Face direction of travel (yaw only, stay level)
      const ahead = tc.getPointAt(Math.min(transitRef.current + 0.02, 1))
      const yaw = Math.atan2(ahead.x - point.x, ahead.z - point.z)
      meshRef.current.rotation.set(wind.pitch, yaw, wind.roll)

      // Camera at nadir during flight
      if (cameraGimbalRef.current) {
        cameraGimbalRef.current.rotation.set(PITCH_NADIR, 0, 0)
        cameraPitchRef.current = PITCH_NADIR
      }
      return
    }

    if (phaseRef.current === 'depart') {
      const dc = departCurveRef.current
      if (!dc) return
      departProgressRef.current += (delta * departSpeed) / departLengthRef.current
      if (departProgressRef.current >= 1) {
        departProgressRef.current = 1
        phaseRef.current = 'hover'
      }
      const point = dc.getPointAt(Math.min(departProgressRef.current, 1))
      meshRef.current.position.copy(point)
      if (positionRef) positionRef.current = point
      const ahead = dc.getPointAt(Math.min(departProgressRef.current + 0.02, 1))
      const yaw = Math.atan2(ahead.x - point.x, ahead.z - point.z)
      meshRef.current.rotation.set(wind.pitch, yaw, wind.roll)
      if (cameraGimbalRef.current) {
        cameraGimbalRef.current.rotation.set(PITCH_NADIR, 0, 0)
      }
      return
    }

    // Grid phase
    if (animating) {
      progressRef.current += (delta * gridSpeed) / pathLength
      progressRef.current = Math.min(progressRef.current, 1)
    }

    const point = curve.getPointAt(progressRef.current)
    meshRef.current.position.copy(point)
    if (positionRef) positionRef.current = point

    // Face direction of travel (yaw only, stay level)
    if (progressRef.current < 0.999) {
      const ahead = curve.getPointAt(Math.min(progressRef.current + 0.002, 1))
      const yaw = Math.atan2(ahead.x - point.x, ahead.z - point.z)
      meshRef.current.rotation.set(wind.pitch, yaw, wind.roll)
    }

    // Camera at nadir during grid flight
    if (cameraGimbalRef.current) {
      cameraGimbalRef.current.rotation.set(PITCH_NADIR, 0, 0)
      cameraPitchRef.current = PITCH_NADIR
    }

  })

  if (!visible) return null

  return (
    <group>
      {/* Flight path line — fades in during transit, visible during grid */}
      {showPath && (inGrid || lineOpacity > 0) && (
        <Line
          points={linePoints}
          color="#66aaff"
          lineWidth={1}
          opacity={inGrid ? 0.4 : lineOpacity}
          transparent
        />
      )}
      {/* Drone body + rotors + camera */}
      <group ref={meshRef}>
        <mesh>
          <boxGeometry args={[6, 3, 10]} />
          <meshStandardMaterial color="#ff6644" emissive="#ff3300" emissiveIntensity={0.3} />
        </mesh>
        {ROTOR_OFFSETS.map((offset, i) => (
          <mesh
            key={i}
            ref={rotorRefs[i]}
            position={offset}
            geometry={ROTOR_GEO}
            material={ROTOR_MAT}
          />
        ))}
        {/* Camera gimbal — pitches independently */}
        <group ref={cameraGimbalRef} position={[0, -1.5, -5]}>
          {/* Small cube camera body */}
          <mesh geometry={CAMERA_BODY_GEO} material={CAMERA_BODY_MAT} />
          {/* Torus lens ring — extruded outward so visible from side, no z-fighting */}
          <mesh position={[0, 0, -1.7]} geometry={CAMERA_LENS_GEO} material={CAMERA_LENS_MAT} />
        </group>
      </group>
    </group>
  )
}
