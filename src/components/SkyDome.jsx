import { useMemo, useEffect } from 'react'
import * as THREE from 'three'

const vertexShader = `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform float exponent;
  varying vec3 vWorldPosition;

  float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    float h = normalize(vWorldPosition).y;
    float t = max(pow(max(h, 0.0), exponent), 0.0);
    vec3 color = mix(horizonColor, topColor, t);
    color += (rand(gl_FragCoord.xy) - 0.5) / 128.0;
    gl_FragColor = vec4(color, 1.0);
  }
`

export default function SkyDome({ darkMode }) {
  const uniforms = useMemo(() => ({
    topColor: { value: new THREE.Color() },
    horizonColor: { value: new THREE.Color() },
    exponent: { value: 0.8 },
  }), [])

  useEffect(() => {
    uniforms.topColor.value.set(darkMode ? '#020206' : '#87CEEB')
    uniforms.horizonColor.value.set(darkMode ? '#303060' : '#e8eaef')
  }, [darkMode, uniforms])

  return (
    <mesh renderOrder={-1}>
      <sphereGeometry args={[4000, 32, 15]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  )
}
