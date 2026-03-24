import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'

// Map geometry constants (matching Drone.jsx / Scene.jsx)
const MAP_CENTER_X = -17
const MAP_CENTER_Z = -13
const MAP_HALF_ALONG = 375
const MAP_HALF_ACROSS = 133
const MAP_ANGLE = 136 * (Math.PI / 180)

const BAR_LENGTH = 105 // 105 meters
const BAR_HEIGHT = 1.5
const BAR_THICKNESS = 0.5
const ENDCAP_HEIGHT = 4
const Y_OFFSET = 3 // slightly above ground to avoid z-fighting

const FADE_DURATION = 0.75

export default function ScaleBar3D({ state }) {
  const groupRef = useRef()
  const opacityRef = useRef(state === 'visible' ? 1 : 0)

  // Position: bottom-right corner of the map (in rotated frame)
  const cos = Math.cos(MAP_ANGLE)
  const sin = Math.sin(MAP_ANGLE)
  // Place at ~80% along and ~80% across (bottom-right when viewed top-down)
  const localU = MAP_HALF_ACROSS * 0.7
  const localV = -MAP_HALF_ALONG * 0.75
  const worldX = MAP_CENTER_X + localU * cos - localV * sin
  const worldZ = MAP_CENTER_Z + localU * sin + localV * cos

  useFrame((_, delta) => {
    if (!state || !groupRef.current) return

    const prev = opacityRef.current
    const target = (state === 'visible' || state === 'fadeIn') ? 1 : 0
    const speed = 1 / FADE_DURATION

    if (state === 'fadeIn') {
      opacityRef.current = Math.min(1, prev + delta * speed)
    } else if (state === 'fadeOut') {
      opacityRef.current = Math.max(0, prev - delta * speed)
    }

    if (opacityRef.current !== prev) {
      groupRef.current.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.opacity = opacityRef.current
        }
      })
    }

    groupRef.current.visible = opacityRef.current > 0
  })

  if (!state) return null

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
          depthWrite
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
          depthWrite
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
          depthWrite
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
        105 m
      </Text>
    </group>
  )
}
