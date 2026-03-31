import { useState, useEffect, useMemo } from 'react'
import { Html, Line } from '@react-three/drei'

const THUMB_BASE = `${import.meta.env.BASE_URL}assets/thumbs/`
const LINE_HEIGHT = 40
const CARD_OFFSET = 12  // extra height so card sits above the line endpoint

export default function CameraCard3D({ position, meshName, darkMode }) {
  const [gps, setGps] = useState(null)

  const baseName = meshName.replace(/\d{3}$/, '')
  const imagePath = `${THUMB_BASE}${baseName}.jpg`

  useEffect(() => {
    let cancelled = false
    import('exifr').then(mod => {
      const exifr = mod.default || mod
      exifr.gps(imagePath).then(coords => {
        if (!cancelled && coords) {
          setGps({ lat: coords.latitude, lon: coords.longitude })
        }
      }).catch(() => {})
    }).catch(() => {})
    return () => { cancelled = true }
  }, [imagePath])

  const cardPos = useMemo(
    () => [position[0], position[1] + LINE_HEIGHT, position[2]],
    [position]
  )

  const linePoints = useMemo(
    () => [position, cardPos],
    [position, cardPos]
  )

  return (
    <group>
      <Line
        points={linePoints}
        color="#ffcc00"
        lineWidth={1}
        dashed
        dashSize={1.5}
        gapSize={1.5}
        transparent
        opacity={0.6}
      />
      <Html
        position={[cardPos[0], cardPos[1] + CARD_OFFSET, cardPos[2]]}
        center
        distanceFactor={300}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div style={{
          background: darkMode ? 'rgba(26,26,46,0.92)' : 'rgba(255,255,255,0.92)',
          color: darkMode ? '#e0e0e0' : '#222',
          borderRadius: 8,
          padding: 8,
          border: '2px solid #ffcc00',
          boxShadow: darkMode
            ? '0 4px 20px rgba(0,0,0,0.5)'
            : '0 4px 20px rgba(0,0,0,0.15)',
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          width: 140,
        }}>
          <img
            src={imagePath}
            alt={baseName}
            style={{
              width: '100%',
              borderRadius: 4,
              display: 'block',
            }}
          />
          <div style={{
            fontSize: 10,
            marginTop: 6,
            opacity: 0.8,
            textAlign: 'center',
            letterSpacing: '0.02em',
          }}>
            {gps
              ? `${gps.lat.toFixed(6)}°, ${gps.lon.toFixed(6)}°`
              : '\u00A0'}
          </div>
        </div>
      </Html>
    </group>
  )
}
