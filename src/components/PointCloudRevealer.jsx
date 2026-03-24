import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const REVEAL_DURATION = 10 // seconds for all points to appear
const WHITE_DURATION = 2   // seconds each point stays white before fading to color
const POINT_SIZE = 2.5     // slightly larger than default

export default function PointCloudRevealer({ url, state }) {
  const { scene } = useGLTF(url)
  const groupRef = useRef()
  const progressRef = useRef(0)
  const materialRef = useRef()

  // Extract geometry and build custom shader material
  const { geometry, shaderMaterial } = useMemo(() => {
    let geo = null
    scene.traverse((child) => {
      if (child.isPoints && child.geometry) {
        geo = child.geometry.clone()
      }
    })
    // Fallback: also check for mesh (some loaders convert points to mesh)
    if (!geo) {
      scene.traverse((child) => {
        if (child.isMesh && child.geometry) {
          geo = child.geometry.clone()
        }
      })
    }
    if (!geo) return { geometry: null, shaderMaterial: null }

    const count = geo.attributes.position.count

    // Per-vertex random reveal time [0, 1]
    const revealTimes = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      revealTimes[i] = Math.random()
    }
    geo.setAttribute('aRevealTime', new THREE.BufferAttribute(revealTimes, 1))

    // Normalize COLOR_0 if it's unsigned short (componentType 5123 = Uint16)
    // Three.js may already normalize, but let's ensure we have usable color data
    const colorAttr = geo.attributes.color
    let hasVertexColors = false
    if (colorAttr) {
      hasVertexColors = true
    }

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uProgress: { value: 0 },       // 0-1 over REVEAL_DURATION
        uWhiteDuration: { value: WHITE_DURATION / REVEAL_DURATION }, // as fraction of total
        uPointSize: { value: POINT_SIZE },
        uGlobalOpacity: { value: 0 },  // for fade-in/out of entire cloud
      },
      vertexShader: /* glsl */ `
        attribute float aRevealTime;
        ${hasVertexColors ? 'attribute vec4 color;' : ''}
        uniform float uProgress;
        uniform float uWhiteDuration;
        uniform float uPointSize;

        varying float vWhiteMix;
        ${hasVertexColors ? 'varying vec3 vColor;' : ''}
        varying float vVisible;

        void main() {
          // Point not yet revealed
          if (aRevealTime > uProgress) {
            vVisible = 0.0;
            gl_Position = vec4(0.0, 0.0, -2.0, 1.0); // clip away
            gl_PointSize = 0.0;
            return;
          }

          vVisible = 1.0;

          // How long ago this point appeared (as fraction of total duration)
          float timeSinceReveal = uProgress - aRevealTime;
          // Fade from white (1.0) to vertex color (0.0) over uWhiteDuration
          vWhiteMix = 1.0 - clamp(timeSinceReveal / uWhiteDuration, 0.0, 1.0);

          ${hasVertexColors ? 'vColor = color.rgb;' : ''}

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = uPointSize * (300.0 / -mvPosition.z);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uGlobalOpacity;
        varying float vWhiteMix;
        ${hasVertexColors ? 'varying vec3 vColor;' : ''}
        varying float vVisible;

        void main() {
          if (vVisible < 0.5) discard;

          ${hasVertexColors
            ? 'vec3 finalColor = mix(vColor, vec3(1.0), vWhiteMix);'
            : 'vec3 finalColor = vec3(1.0);'
          }

          gl_FragColor = vec4(finalColor, uGlobalOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
    })

    return { geometry: geo, shaderMaterial: mat }
  }, [scene])

  // Store material ref for useFrame access
  useEffect(() => {
    materialRef.current = shaderMaterial
  }, [shaderMaterial])

  // Reset on state change
  useEffect(() => {
    if (state === 'fadeIn') {
      progressRef.current = 0
      if (materialRef.current) {
        materialRef.current.uniforms.uProgress.value = 0
        materialRef.current.uniforms.uGlobalOpacity.value = 0 // start fully transparent
      }
      // visible=true is safe because opacity is 0 — useFrame will ramp it up
      if (groupRef.current) groupRef.current.visible = true
    } else if (state === 'visible') {
      progressRef.current = 1
      if (materialRef.current) {
        materialRef.current.uniforms.uProgress.value = 1
        materialRef.current.uniforms.uGlobalOpacity.value = 1
      }
      if (groupRef.current) groupRef.current.visible = true
    } else if (state === 'fadeOut') {
      // Keep current progress, just fade opacity
    } else {
      if (groupRef.current) groupRef.current.visible = false
      if (materialRef.current) {
        materialRef.current.uniforms.uGlobalOpacity.value = 0
        materialRef.current.uniforms.uProgress.value = 0
      }
    }
  }, [state])

  useFrame((_, delta) => {
    if (!state || !materialRef.current) return
    const mat = materialRef.current

    if (state === 'fadeIn') {
      // Ramp progress 0→1 over REVEAL_DURATION
      if (progressRef.current < 1) {
        progressRef.current = Math.min(1, progressRef.current + delta / REVEAL_DURATION)
        mat.uniforms.uProgress.value = progressRef.current
      }
      // Ramp opacity 0→1 over first 1 second so there's no flash
      if (mat.uniforms.uGlobalOpacity.value < 1) {
        mat.uniforms.uGlobalOpacity.value = Math.min(1, mat.uniforms.uGlobalOpacity.value + delta)
      }
    } else if (state === 'fadeOut') {
      const opacity = mat.uniforms.uGlobalOpacity.value
      if (opacity > 0) {
        mat.uniforms.uGlobalOpacity.value = Math.max(0, opacity - delta * 1.33)
      } else if (groupRef.current) {
        groupRef.current.visible = false
      }
    }
  })

  if (!state || !geometry || !shaderMaterial) return null

  return (
    <group ref={groupRef} visible={false}>
      <points geometry={geometry} material={shaderMaterial} />
    </group>
  )
}
