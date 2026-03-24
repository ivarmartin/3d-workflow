import { useState, useCallback, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import Scene from './components/Scene'
import StageUI from './components/StageUI'
import InfoModal from './components/InfoModal'
import { useStageManager } from './hooks/useStageManager'

const THUMB_BASE = `${import.meta.env.BASE_URL}assets/thumbs/`

export default function App() {
  const [darkMode, setDarkMode] = useState(true)
  const [infoOpen, setInfoOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)

  const {
    currentStage,
    transitioning,
    visibility,
    goNext,
    goBack,
    isFirst,
    isLast,
  } = useStageManager()

  const handleFrustumClick = useCallback((name) => {
    if (currentStage !== 2) return
    // Strip trailing 001 suffix from GLB mesh name (e.g. DJI_...V001 -> DJI_...V)
    const baseName = name.replace(/\d{3}$/, '')
    setSelectedImage(`${THUMB_BASE}${baseName}.jpg`)
  }, [currentStage])

  const bgColor = darkMode ? '#1a1a2e' : '#e8eaef'

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: bgColor }}>
      <Canvas
        camera={{
          position: [-30, 500, 600],
          fov: 50,
          near: 0.1,
          far: 5000,
        }}
        gl={{ antialias: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={[bgColor]} />
        <Suspense fallback={null}>
          <Scene visibility={visibility} darkMode={darkMode} onFrustumClick={handleFrustumClick} currentStage={currentStage} />
        </Suspense>
      </Canvas>

      {/* Loading overlay */}
      <Suspense fallback={
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: darkMode ? '#e0e0e0' : '#333',
          fontSize: 16,
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          zIndex: 50,
        }}>
          Loading assets...
        </div>
      }>
        <div />
      </Suspense>

      {/* UI overlays */}
      <StageUI
        currentStage={currentStage}
        transitioning={transitioning}
        isFirst={isFirst}
        isLast={isLast}
        goNext={goNext}
        goBack={goBack}
        darkMode={darkMode}
        splatPlaceholder={visibility.splatPlaceholder}
      />

      <InfoModal
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        infoOpen={infoOpen}
        setInfoOpen={setInfoOpen}
      />

      {/* Image popup */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)',
          }}
        >
          <div style={{ position: 'relative', maxWidth: '80%', maxHeight: '80%' }}>
            <img
              src={selectedImage}
              alt=""
              style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 8, display: 'block' }}
            />
            <button
              onClick={() => setSelectedImage(null)}
              style={{
                position: 'absolute',
                top: -12,
                right: -12,
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: 'none',
                background: '#fff',
                color: '#222',
                fontSize: 18,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              X
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
