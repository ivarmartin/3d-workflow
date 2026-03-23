import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'

// Generate a lawnmower grid path covering the 2D map area
// Map bounds: X -427 to 368, Z -427 to 384, center roughly (-30, -22)
// We cover nadir camera extent: X -320 to 313, Z -365 to 350
function generateLawnmowerPath() {
  const xMin = -320
  const xMax = 313
  const zMin = -365
  const zMax = 350
  const y = 97
  const spacing = 40 // meters between passes

  const waypoints = []
  let forward = true

  for (let x = xMin; x <= xMax; x += spacing) {
    if (forward) {
      waypoints.push(new THREE.Vector3(x, y, zMin))
      waypoints.push(new THREE.Vector3(x, y, zMax))
    } else {
      waypoints.push(new THREE.Vector3(x, y, zMax))
      waypoints.push(new THREE.Vector3(x, y, zMin))
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
