import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'

const FADE_DURATION = 0.75

export default function GroundPlane({ state, darkMode }) {
  const meshRef = useRef()
  const opacityRef = useRef(state === 'visible' || state === 'fadeIn' ? 1 : 0)

  useEffect(() => {
    if (state === 'visible' && meshRef.current) {
      opacityRef.current = 1
      meshRef.current.material.opacity = 1
      meshRef.current.visible = true
    }
  }, [state])

  useFrame((_, delta) => {
    if (!meshRef.current || !state) return

    const speed = 1 / FADE_DURATION
    if (state === 'fadeOut') {
      opacityRef.current = Math.max(0, opacityRef.current - delta * speed)
      meshRef.current.material.opacity = opacityRef.current
      if (opacityRef.current <= 0) meshRef.current.visible = false
    } else if (state === 'fadeIn') {
      opacityRef.current = Math.min(1, opacityRef.current + delta * speed)
      meshRef.current.material.opacity = opacityRef.current
      meshRef.current.visible = true
    }
  })

  if (!state) return null

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[-30, 0, -22]}
    >
      <planeGeometry args={[1000, 1000]} />
      <meshStandardMaterial
        color={darkMode ? '#444466' : '#b0b0c0'}
        transparent
        opacity={opacityRef.current}
      />
    </mesh>
  )
}
