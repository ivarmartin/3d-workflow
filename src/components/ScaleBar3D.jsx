import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { useGpuWarmup, WARMUP_FRAME_THRESHOLD } from '../hooks/useGpuWarmup'

// Map geometry constants (matching Drone.jsx / Scene.jsx)
const MAP_CENTER_X = -17
const MAP_CENTER_Z = -13
const MAP_HALF_ALONG = 375
const MAP_HALF_ACROSS = 133
const MAP_ANGLE = 136 * (Math.PI / 180)

const BAR_LENGTH = 100 // 100 meters
const BAR_HEIGHT = 1.5
const BAR_THICKNESS = 0.5
const ENDCAP_HEIGHT = 4
const Y_OFFSET = 5 // raised above map to stay visible at low camera angles

const FADE_DURATION = 0.75

export default function ScaleBar3D({ state }) {
  const groupRef = useRef()
  const opacityRef = useRef(state === 'visible' ? 1 : 0)

  // Position: bottom-right corner of the map (in rotated frame)
  const cos = Math.cos(MAP_ANGLE)
  const sin = Math.sin(MAP_ANGLE)
  // Place at ~80% along and ~80% across (bottom-right when viewed top-down)
  const localU = MAP_HALF_ACROSS * 0.85
  const localV = -MAP_HALF_ALONG * 0.95
  const worldX = MAP_CENTER_X + localU * cos - localV * sin
  const worldZ = MAP_CENTER_Z + localU * sin + localV * cos

  const warmupFrameRef = useRef(0)
  const warmupDoneRef = useRef(false)

  useFrame((_, delta) => {
    if (!groupRef.current) return

    // GPU warmup tracking — keep visible at opacity 0 for first few frames
    if (!warmupDoneRef.current) {
      warmupFrameRef.current++
      if (warmupFrameRef.current < WARMUP_FRAME_THRESHOLD) {
        // Keep visible during warmup so GPU compiles shaders
        if (!groupRef.current.visible) groupRef.current.visible = true
        return
      }
      useGpuWarmup.getState().markWarmed('scaleBar')
      warmupDoneRef.current = true
    }

    if (!state) {
      // Keep mounted for pre-warming but ensure hidden
      if (groupRef.current.visible) {
        opacityRef.current = 0
        groupRef.current.traverse((child) => {
          if (child.isMesh && child.material) {
            child.material.opacity = 0
            child.material.depthWrite = false
          }
        })
        groupRef.current.visible = false
      }
      return
    }

    const prev = opacityRef.current
    const speed = 1 / FADE_DURATION

    if (state === 'fadeIn') {
      opacityRef.current = Math.min(1, prev + delta * speed)
    } else if (state === 'fadeOut') {
      opacityRef.current = Math.max(0, prev - delta * speed)
    } else if (state === 'visible') {
      opacityRef.current = 1
    }

    if (opacityRef.current !== prev) {
      groupRef.current.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.opacity = opacityRef.current
          child.material.depthWrite = opacityRef.current > 0.99
        }
      })
    }

    groupRef.current.visible = opacityRef.current > 0
  })

  return (
    <group
      ref={groupRef}
      position={[worldX, Y_OFFSET, worldZ]}
      rotation={[0, -MAP_ANGLE, 0]}
    >
      {/* Main bar */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[BAR_LENGTH, BAR_THICKNESS, BAR_HEIGHT]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.3}
          transparent
          depthWrite={false}
          opacity={0}
        />
      </mesh>

      {/* Left endcap */}
      <mesh position={[-BAR_LENGTH / 2, 0, 0]}>
        <boxGeometry args={[BAR_THICKNESS, BAR_THICKNESS, ENDCAP_HEIGHT]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.3}
          transparent
          depthWrite={false}
          opacity={0}
        />
      </mesh>

      {/* Right endcap */}
      <mesh position={[BAR_LENGTH / 2, 0, 0]}>
        <boxGeometry args={[BAR_THICKNESS, BAR_THICKNESS, ENDCAP_HEIGHT]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.3}
          transparent
          depthWrite={false}
          opacity={0}
        />
      </mesh>

      {/* Label */}
      <Text
        position={[0, 0, -ENDCAP_HEIGHT]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={8}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        material-transparent
        material-depthWrite={false}
      >
        100 m
      </Text>
    </group>
  )
}
