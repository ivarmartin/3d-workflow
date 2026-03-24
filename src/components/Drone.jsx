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

export default function Drone({ visible, hovering, animating, showPath, positionRef }) {
  const meshRef = useRef()
  const rotorRefs = [useRef(), useRef(), useRef(), useRef()]
  const progressRef = useRef(0)
  const phaseRef = useRef('hover') // 'hover' | 'transit' | 'grid'
  const [inGrid, setInGrid] = useState(false)
  const transitRef = useRef(0) // 0→1 lerp for hover-to-grid-start
  const timeRef = useRef(0)
  const prevAnimatingRef = useRef(false)
  const prevHoveringRef = useRef(hovering)
  const transitCurveRef = useRef(null)
  const transitLengthRef = useRef(0)

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
    }
    prevHoveringRef.current = hovering

    // Detect when animating starts
    if (animating && !prevAnimatingRef.current) {
      if (phaseRef.current === 'hover') {
        // Coming from stage 0 — fly sideways first so drone stays in view,
        // then curve toward the grid start
        const startPos = meshRef.current.position.clone()
        const gridStart = waypoints[0]

        // Get camera's right direction (perpendicular to view)
        const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
        // Pick the side that's closer to the grid start so the arc looks natural
        const toGrid = new THREE.Vector3().subVectors(gridStart, startPos)
        const side = toGrid.dot(camRight) > 0 ? 1 : -1

        // First waypoint: move sideways at roughly the same height
        const lateral = startPos.clone()
          .add(camRight.clone().multiplyScalar(side * 60))
        lateral.y = startPos.y + 5 // slight climb only

        // Second waypoint: partway toward the grid, easing up to grid altitude
        const mid = new THREE.Vector3().lerpVectors(lateral, gridStart, 0.5)
        mid.y = THREE.MathUtils.lerp(startPos.y, gridStart.y, 0.6)

        transitCurveRef.current = new THREE.CatmullRomCurve3(
          [startPos, lateral, mid, gridStart],
          false, 'catmullrom', 0.5
        )
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

    // Accumulate time and spin rotors (before phase logic so it runs every frame)
    timeRef.current += delta
    const rotorSpeed = 25
    for (const ref of rotorRefs) {
      if (ref.current) ref.current.rotation.y += delta * rotorSpeed
    }
    const t = timeRef.current
    const wind = windNoise(t)

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
      const point = tc.getPointAt(Math.min(transitRef.current, 1))
      meshRef.current.position.copy(point)
      if (positionRef) positionRef.current = point
      // Face direction of travel (yaw only, stay level)
      const ahead = tc.getPointAt(Math.min(transitRef.current + 0.02, 1))
      const yaw = Math.atan2(ahead.x - point.x, ahead.z - point.z)
      meshRef.current.rotation.set(wind.pitch, yaw, wind.roll)
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

  })

  if (!visible) return null

  return (
    <group>
      {/* Flight path line — visible during stages 1-2 */}
      {showPath && inGrid && (
        <Line
          points={linePoints}
          color="#66aaff"
          lineWidth={1}
          opacity={0.4}
          transparent
        />
      )}
      {/* Drone body + rotors */}
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
      </group>
    </group>
  )
}
