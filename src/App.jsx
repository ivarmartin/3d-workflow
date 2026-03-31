import { useState, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import Scene from './components/Scene'
import StageUI from './components/StageUI'
import SplashScreen from './components/SplashScreen'
import LoadingRings from './components/LoadingRings'
import InfoModal from './components/InfoModal'
import { useStageManager } from './hooks/useStageManager'
import { useGpuWarmup } from './hooks/useGpuWarmup'

export default function App() {
  const [darkMode, setDarkMode] = useState(true)
  const [splashVisible, setSplashVisible] = useState(true)
  const [infoOpen, setInfoOpen] = useState(false)

  const {
    currentStage,
    transitioning,
    visibility,
    goNext,
    goBack,
    isFirst,
    isLast,
  } = useStageManager()

  const downloadProgress = useProgress((s) => s.progress)
  const downloadActive = useProgress((s) => s.active)
  const allWarmed = useGpuWarmup((s) => Object.values(s.warmupStatus).every(Boolean))
  const loadingComplete = downloadProgress >= 100 && !downloadActive && allWarmed

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
        <Scene visibility={visibility} darkMode={darkMode} currentStage={currentStage} />
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

      {/* Splash screen */}
      {splashVisible && (
        <SplashScreen darkMode={darkMode} onStart={() => setSplashVisible(false)} />
      )}

      {/* UI overlays */}
      {!splashVisible && (
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
      )}

      {/* In-app loading indicator (visible if user dismissed splash before loading finished) */}
      {!splashVisible && !loadingComplete && (
        <div style={{ position: 'absolute', top: 76, left: 28, zIndex: 10 }}>
          <LoadingRings size={48} darkMode={darkMode} />
        </div>
      )}

      <InfoModal
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        infoOpen={infoOpen}
        setInfoOpen={setInfoOpen}
      />

    </div>
  )
}
