import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'

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

export default function Drone({ visible, animating }) {
  const meshRef = useRef()
  const progressRef = useRef(0)
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

  const speed = 120 // meters per second

  useFrame((_, delta) => {
    if (!meshRef.current || !visible) return

    if (animating) {
      progressRef.current += (delta * speed) / pathLength
      progressRef.current = Math.min(progressRef.current, 1)
    }

    const point = curve.getPointAt(progressRef.current)
    meshRef.current.position.copy(point)

    // Look in direction of travel
    if (progressRef.current < 0.999) {
      const ahead = curve.getPointAt(Math.min(progressRef.current + 0.002, 1))
      meshRef.current.lookAt(ahead)
    }
  })

  if (!visible) return null

  return (
    <group>
      {/* Flight path line */}
      <Line
        points={linePoints}
        color="#66aaff"
        lineWidth={1}
        opacity={0.4}
        transparent
      />
      {/* Drone cube */}
      <mesh ref={meshRef} position={waypoints[0]}>
        <boxGeometry args={[4, 2, 4]} />
        <meshStandardMaterial color="#ff6644" emissive="#ff3300" emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}
