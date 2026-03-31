import { useState, useEffect } from 'react'
import LoadingRings from './LoadingRings'

export default function SplashScreen({ darkMode, onStart }) {
  const [visible, setVisible] = useState(true)
  const [fadeOut, setFadeOut] = useState(false)

  const handleStart = () => {
    setFadeOut(true)
    setTimeout(() => {
      setVisible(false)
      onStart()
    }, 600)
  }

  // Allow Enter key to start
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Enter' || e.key === ' ') handleStart()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (!visible) return null

  return (
    <div
      className="splash-screen"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        background: darkMode
          ? 'radial-gradient(ellipse at center, rgba(26,26,46,0.85) 0%, rgba(26,26,46,0.95) 100%)'
          : 'radial-gradient(ellipse at center, rgba(232,234,239,0.85) 0%, rgba(232,234,239,0.95) 100%)',
        color: darkMode ? '#e0e0e0' : '#222',
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        userSelect: 'none',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.6s ease',
        padding: '24px',
      }}
    >
      <h1
        className="splash-title"
        style={{
          fontSize: 'clamp(32px, 7vw, 64px)',
          fontWeight: 900,
          letterSpacing: '0.04em',
          lineHeight: 1.05,
          margin: 0,
          textTransform: 'uppercase',
          fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        3D-Mapping<br />Workflow
      </h1>

      <h2
        className="splash-subtitle"
        style={{
          fontSize: 'clamp(16px, 2.5vw, 24px)',
          fontWeight: 600,
          opacity: 0.85,
          margin: 0,
          marginTop: 'clamp(16px, 3vw, 32px)',
        }}
      >
        Let's make some spatial data!
      </h2>

      <p
        className="splash-body"
        style={{
          fontSize: 'clamp(13px, 1.8vw, 16px)',
          opacity: 0.65,
          maxWidth: '520px',
          lineHeight: 1.6,
          marginTop: 'clamp(16px, 3vw, 28px)',
        }}
      >
        This interactive will show you how we turn drone photos into maps,
        point clouds, 3D-models and gaussian splats.
      </p>

      <button
        onClick={handleStart}
        style={{
          marginTop: 'clamp(28px, 5vw, 48px)',
          padding: 'clamp(10px, 1.5vw, 14px) clamp(28px, 5vw, 48px)',
          border: 'none',
          borderRadius: '50px',
          fontSize: 'clamp(14px, 1.8vw, 16px)',
          fontWeight: 600,
          cursor: 'pointer',
          background: darkMode ? '#ffffff' : '#1a1a2e',
          color: darkMode ? '#1a1a2e' : '#ffffff',
          transition: 'transform 0.2s ease, opacity 0.2s ease',
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        }}
        onMouseEnter={(e) => (e.target.style.transform = 'scale(1.05)')}
        onMouseLeave={(e) => (e.target.style.transform = 'scale(1)')}
      >
        Start
      </button>

      <div style={{ marginTop: 16, height: 80, display: 'flex', justifyContent: 'center' }}>
        <LoadingRings size={80} darkMode={darkMode} />
      </div>
    </div>
  )
}
