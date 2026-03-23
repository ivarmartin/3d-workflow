import { useState, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import Scene from './components/Scene'
import StageUI from './components/StageUI'
import InfoModal from './components/InfoModal'
import { useStageManager } from './hooks/useStageManager'

export default function App() {
  const [darkMode, setDarkMode] = useState(true)
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
          <Scene visibility={visibility} darkMode={darkMode} />
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
    </div>
  )
}
