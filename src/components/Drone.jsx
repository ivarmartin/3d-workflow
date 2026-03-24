import { useRef, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line, Text } from '@react-three/drei'
import * as THREE from 'three'

// Hover position — near the default camera so the drone is prominent on load
const HOVER_POS = new THREE.Vector3(-30, 200, 250)

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
  const hoverTimeRef = useRef(0)
  const prevAnimatingRef = useRef(false)
  const prevHoveringRef = useRef(hovering)

  const waypoints = useMemo(() => generateLawnmowerPath(), [])

  // Build a CatmullRom curve through waypoints for smooth interpolation
  const curve = useMemo(() => {
    return new THREE.CatmullRomCurve3(waypoints, false, 'catmullrom', 0.01)
  }, [waypoints])

  // Total path length for speed calculation
  const pathLength = useMemo(() => curve.getLength(), [curve])

  // Smooth curve from hover position to grid start
  const transitCurve = useMemo(() => {
    const gridStart = waypoints[0]
    const mid = new THREE.Vector3().lerpVectors(HOVER_POS, gridStart, 0.5)
    mid.y = Math.max(HOVER_POS.y, gridStart.y) + 30 // arc upward slightly
    return new THREE.CatmullRomCurve3([HOVER_POS, mid, gridStart], false, 'catmullrom', 0.5)
  }, [waypoints])

  const transitLength = useMemo(() => transitCurve.getLength(), [transitCurve])

  // Line points for the flight path visualization
  const linePoints = useMemo(() => {
    return curve.getPoints(500)
  }, [curve])

  // Label position: midpoint of first pass, offset outward along the "across" axis
  const labelData = useMemo(() => {
    const p0 = waypoints[0]
    const p1 = waypoints[1]
    // Midpoint of first pass
    const mid = new THREE.Vector3().lerpVectors(p0, p1, 0.5)
    // Direction along the first pass (strip direction)
    const dir = new THREE.Vector3().subVectors(p1, p0).normalize()
    // Outward direction (perpendicular, pointing away from grid center)
    const outward = new THREE.Vector3(-dir.z, 0, dir.x)
    // Offset label outside the grid edge
    const pos = mid.clone().add(outward.multiplyScalar(-45))
    // Rotation: text lies flat (rotated -90° on X), yaw to align with strip direction
    const yaw = Math.atan2(dir.x, dir.z)
    return { pos, yaw }
  }, [waypoints])

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
      hoverTimeRef.current = 0
      setInGrid(false)
    }
    prevHoveringRef.current = hovering

    // Detect when animating starts
    if (animating && !prevAnimatingRef.current) {
      if (phaseRef.current === 'hover') {
        // Coming from stage 0 — fly from hover to grid start
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

    // Spin rotors (before phase logic so it runs every frame)
    const rotorSpeed = 25
    for (const ref of rotorRefs) {
      if (ref.current) ref.current.rotation.y += delta * rotorSpeed
    }

    if (phaseRef.current === 'hover') {
      // Gentle bob at hover position
      hoverTimeRef.current += delta
      const bobY = Math.sin(hoverTimeRef.current * 1.5) * 3
      meshRef.current.position.set(HOVER_POS.x, HOVER_POS.y + bobY, HOVER_POS.z)
      if (positionRef) positionRef.current = meshRef.current.position
      // Face toward the scene center (yaw only, stay level)
      meshRef.current.rotation.set(0, Math.atan2(-(-30 - HOVER_POS.x), -(-22 - HOVER_POS.z)), 0)
      return
    }

    if (phaseRef.current === 'transit') {
      transitRef.current += (delta * transitSpeed) / transitLength
      if (transitRef.current >= 1) {
        transitRef.current = 1
        phaseRef.current = 'grid'
        progressRef.current = 0
        setInGrid(true)
      }
      const point = transitCurve.getPointAt(Math.min(transitRef.current, 1))
      meshRef.current.position.copy(point)
      if (positionRef) positionRef.current = point
      // Look toward direction of travel
      const ahead = transitCurve.getPointAt(Math.min(transitRef.current + 0.02, 1))
      meshRef.current.lookAt(ahead)
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

    // Look in direction of travel
    if (progressRef.current < 0.999) {
      const ahead = curve.getPointAt(Math.min(progressRef.current + 0.002, 1))
      meshRef.current.lookAt(ahead)
    }

  })

  if (!visible) return null

  return (
    <group>
      {/* Flight path line — visible during stages 1-2 */}
      {showPath && inGrid && (
        <>
          <Line
            points={linePoints}
            color="#66aaff"
            lineWidth={1}
            opacity={0.4}
            transparent
          />
          <Text
            position={[labelData.pos.x, labelData.pos.y, labelData.pos.z]}
            rotation={[-Math.PI / 2, 0, -labelData.yaw]}
            fontSize={18}
            color="#66aaff"
            anchorX="center"
            anchorY="middle"
            fillOpacity={0.7}
          >
            2D Mapping Grid
          </Text>
        </>
      )}
      {/* Drone body + rotors */}
      <group ref={meshRef} position={HOVER_POS}>
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
