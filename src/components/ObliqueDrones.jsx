import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line, Text, useGLTF } from '@react-three/drei'
import * as THREE from 'three'

// 4 oblique flight directions relative to nadir (136°)
const FLIGHT_ANGLES = [136, 316, 226, 46] // degrees
const ALTITUDE = 97
const SPEED = 120 // meters per second
const REVEAL_DISTANCE = 50 // meters — camera fades in when drone is within this radius
const CAMERA_FADE_SPEED = 3 // opacity per second
const ROTOR_SPEED = 25
const ROTOR_GEO = new THREE.CylinderGeometry(2.5, 2.5, 0.3, 16, 1, false, 0, Math.PI * 0.83)
const ROTOR_MAT = new THREE.MeshStandardMaterial({ color: '#ff6644', emissive: '#ff3300', emissiveIntensity: 0.3 })
const ROTOR_OFFSETS = [[4, 1.8, 6], [-4, 1.8, 6], [4, 1.8, -6], [-4, 1.8, -6]]
const PASS_CLUSTER_THRESHOLD = 15 // meters — max gap between cameras in same pass
const MIN_PASS_SIZE = 3 // passes with fewer cameras get merged into nearest neighbor
const PATH_PADDING = 20 // meters — extend path beyond outermost frustums

export default function ObliqueDrones({ url, state }) {
  const { scene } = useGLTF(url)
  const groupRef = useRef()
  const droneRefs = useRef([null, null, null, null])
  const rotorRefs = useRef([[null,null,null,null],[null,null,null,null],[null,null,null,null],[null,null,null,null]])
  const progressRefs = useRef([0, 0, 0, 0])

  // Clone scene, group meshes by heading, and derive flight paths from actual positions
  const { clonedScene, cameraGroups, flights } = useMemo(() => {
    const clone = scene.clone(true)
    clone.updateMatrixWorld(true)

    // Collect all meshes with their world positions and headings
    const meshData = []
    clone.traverse((child) => {
      if (!child.isMesh) return
      child.material = new THREE.MeshStandardMaterial({
        color: 0x999999,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      })

      const pos = new THREE.Vector3()
      const quat = new THREE.Quaternion()
      child.getWorldPosition(pos)
      child.getWorldQuaternion(quat)

      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(quat)
      const headingDeg = ((Math.atan2(fwd.x, fwd.z) * 180 / Math.PI) + 360) % 360

      meshData.push({ mesh: child, pos, heading: headingDeg })
    })

    // Group by nearest flight angle
    const groups = [[], [], [], []]
    meshData.forEach((d) => {
      let minDist = Infinity
      let bestIdx = 0
      FLIGHT_ANGLES.forEach((target, i) => {
        let diff = Math.abs(d.heading - target)
        if (diff > 180) diff = 360 - diff
        if (diff < minDist) {
          minDist = diff
          bestIdx = i
        }
      })
      groups[bestIdx].push(d)
    })

    // Derive flight paths from actual frustum positions
    const flightData = FLIGHT_ANGLES.map((angleDeg, groupIdx) => {
      const group = groups[groupIdx]
      const rad = angleDeg * Math.PI / 180
      const cosA = Math.cos(rad)
      const sinA = Math.sin(rad)

      // Project each frustum into along-track (u) / cross-track (v) coordinates
      const projected = group.map((d) => ({
        u: d.pos.x * sinA + d.pos.z * cosA,
        v: d.pos.x * cosA - d.pos.z * sinA,
      }))

      // Cluster by v (cross-track) to find passes
      const sorted = projected.map((p, i) => ({ ...p, i })).sort((a, b) => a.v - b.v)
      let passes = []
      let currentPass = [sorted[0]]
      for (let j = 1; j < sorted.length; j++) {
        if (sorted[j].v - currentPass[currentPass.length - 1].v > PASS_CLUSTER_THRESHOLD) {
          passes.push(currentPass)
          currentPass = [sorted[j]]
        } else {
          currentPass.push(sorted[j])
        }
      }
      passes.push(currentPass)

      // Merge small passes (< MIN_PASS_SIZE cameras) into nearest neighbor
      const merged = []
      for (const pass of passes) {
        if (pass.length >= MIN_PASS_SIZE) {
          merged.push(pass)
        } else {
          // Find nearest merged pass by average v
          const avgV = pass.reduce((s, p) => s + p.v, 0) / pass.length
          let bestIdx = -1
          let bestDist = Infinity
          for (let k = 0; k < merged.length; k++) {
            const mAvgV = merged[k].reduce((s, p) => s + p.v, 0) / merged[k].length
            const d = Math.abs(avgV - mAvgV)
            if (d < bestDist) { bestDist = d; bestIdx = k }
          }
          if (bestIdx >= 0) {
            merged[bestIdx].push(...pass)
          } else {
            merged.push(pass) // fallback: keep it if nothing to merge into
          }
        }
      }
      passes = merged

      // Compute uniform along-track extent across all passes for symmetry
      let globalUMin = Infinity
      let globalUMax = -Infinity
      for (const pass of passes) {
        for (const p of pass) {
          if (p.u < globalUMin) globalUMin = p.u
          if (p.u > globalUMax) globalUMax = p.u
        }
      }
      globalUMin -= PATH_PADDING
      globalUMax += PATH_PADDING

      // Build lawnmower waypoints with uniform pass length
      const waypoints = []
      let forward = true
      for (const pass of passes) {
        const avgV = pass.reduce((sum, p) => sum + p.v, 0) / pass.length

        // Convert (u, v) back to world (x, z)
        const x1 = globalUMin * sinA + avgV * cosA
        const z1 = globalUMin * cosA - avgV * sinA
        const x2 = globalUMax * sinA + avgV * cosA
        const z2 = globalUMax * cosA - avgV * sinA

        if (forward) {
          waypoints.push(new THREE.Vector3(x1, ALTITUDE, z1))
          waypoints.push(new THREE.Vector3(x2, ALTITUDE, z2))
        } else {
          waypoints.push(new THREE.Vector3(x2, ALTITUDE, z2))
          waypoints.push(new THREE.Vector3(x1, ALTITUDE, z1))
        }
        forward = !forward
      }

      // Use CurvePath of straight LineCurve3 segments for crisp lines
      const curvePath = new THREE.CurvePath()
      for (let k = 0; k < waypoints.length - 1; k++) {
        curvePath.add(new THREE.LineCurve3(waypoints[k], waypoints[k + 1]))
      }
      const pathLength = curvePath.getLength()
      return { waypoints, curve: curvePath, pathLength, linePoints: waypoints }
    })

    return { clonedScene: clone, cameraGroups: groups, flights: flightData }
  }, [scene])

  // Reset animation when entering fadeIn state
  useEffect(() => {
    if (state === 'fadeIn') {
      progressRefs.current = [0, 0, 0, 0]
      clonedScene.traverse((child) => {
        if (child.isMesh) {
          child.material.opacity = 0
          child.material.depthWrite = false
        }
      })
    } else if (state === 'visible') {
      clonedScene.traverse((child) => {
        if (child.isMesh) {
          child.material.opacity = 1
          child.material.depthWrite = true
        }
      })
    }
  }, [state, clonedScene])

  useFrame((_, delta) => {
    if (!state) return

    if (state === 'fadeIn') {
      // Advance each drone and reveal nearby cameras
      for (let i = 0; i < 4; i++) {
        const drone = droneRefs.current[i]
        const flight = flights[i]
        if (!drone || !flight) continue

        // Advance progress
        progressRefs.current[i] += (delta * SPEED) / flight.pathLength
        progressRefs.current[i] = Math.min(progressRefs.current[i], 1)

        const point = flight.curve.getPointAt(progressRefs.current[i])
        drone.position.copy(point)

        // Orient drone toward direction of travel
        if (progressRefs.current[i] < 0.999) {
          const ahead = flight.curve.getPointAt(
            Math.min(progressRefs.current[i] + 0.002, 1)
          )
          drone.lookAt(ahead)
        }

        // Spin rotors
        for (const r of rotorRefs.current[i]) {
          if (r) r.rotation.y += delta * ROTOR_SPEED
        }

        // Reveal cameras near drone (XZ distance only)
        const group = cameraGroups[i]
        for (let j = 0; j < group.length; j++) {
          const cam = group[j]
          if (cam.mesh.material.opacity >= 1) continue
          const dx = point.x - cam.pos.x
          const dz = point.z - cam.pos.z
          const dist = Math.sqrt(dx * dx + dz * dz)
          if (dist < REVEAL_DISTANCE) {
            cam.mesh.material.opacity = Math.min(1, cam.mesh.material.opacity + delta * CAMERA_FADE_SPEED)
            cam.mesh.material.depthWrite = cam.mesh.material.opacity > 0.5
          }
        }
      }
    }
  })

  if (!state) return null

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} />
      {state === 'fadeIn' && flights.map((flight, i) => {
        const p0 = flight.waypoints[0]
        const p1 = flight.waypoints[1]
        const mid = new THREE.Vector3().lerpVectors(p0, p1, 0.5)
        const dir = new THREE.Vector3().subVectors(p1, p0).normalize()
        const outward = new THREE.Vector3(-dir.z, 0, dir.x)
        const labelPos = mid.clone().add(outward.multiplyScalar(-45))
        const yaw = Math.atan2(dir.x, dir.z)
        return (
        <group key={i}>
          <Line
            points={flight.linePoints}
            color="#66aaff"
            lineWidth={1}
            opacity={0.4}
            transparent
          />
          <Text
            position={[labelPos.x, labelPos.y, labelPos.z]}
            rotation={[-Math.PI / 2, 0, -yaw]}
            fontSize={18}
            color="#66aaff"
            anchorX="center"
            anchorY="middle"
            fillOpacity={0.7}
          >
            {`Oblique Mapping Grid ${i + 1}`}
          </Text>
          <group ref={(el) => { droneRefs.current[i] = el }} position={flight.waypoints[0]}>
            <mesh>
              <boxGeometry args={[6, 3, 10]} />
              <meshStandardMaterial color="#ff6644" emissive="#ff3300" emissiveIntensity={0.3} />
            </mesh>
            {ROTOR_OFFSETS.map((offset, ri) => (
              <mesh
                key={ri}
                ref={(el) => { rotorRefs.current[i][ri] = el }}
                position={offset}
                geometry={ROTOR_GEO}
                material={ROTOR_MAT}
              />
            ))}
          </group>
        </group>
        )
      })}
    </group>
  )
}
