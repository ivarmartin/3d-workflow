import { useState, useEffect, useRef } from 'react'
import { STAGES } from '../stages'

function useTypewriter(text, speed = 30) {
  const [displayed, setDisplayed] = useState('')
  const indexRef = useRef(0)

  useEffect(() => {
    setDisplayed('')
    indexRef.current = 0
    const id = setInterval(() => {
      indexRef.current++
      setDisplayed(text.slice(0, indexRef.current))
      if (indexRef.current >= text.length) clearInterval(id)
    }, speed)
    return () => clearInterval(id)
  }, [text, speed])

  return displayed
}

export default function StageUI({
  currentStage,
  transitioning,
  isFirst,
  isLast,
  goNext,
  goBack,
  darkMode,
  splatPlaceholder,
}) {
  const stage = STAGES[currentStage]
  const typedDescription = useTypewriter(stage.description)

  const btnStyle = {
    padding: '10px 28px',
    border: 'none',
    borderRadius: '50px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: transitioning ? 'not-allowed' : 'pointer',
    opacity: transitioning ? 0.5 : 1,
    background: darkMode ? '#ffffff' : '#1a1a2e',
    color: darkMode ? '#1a1a2e' : '#ffffff',
    transition: 'all 0.3s ease',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  }

  const dotStyle = (i) => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: i <= currentStage
      ? (darkMode ? '#ffffff' : '#1a1a2e')
      : (darkMode ? 'rgba(255,255,255,0.25)' : 'rgba(26,26,46,0.25)'),
    transition: 'background 0.3s ease',
  })

  return (
    <>
      {/* Stage info — bottom left */}
      <div className="stage-info" style={{
        position: 'absolute',
        bottom: 80,
        left: 28,
        zIndex: 10,
        userSelect: 'none',
        color: darkMode ? '#e0e0e0' : '#222',
      }}>
        <div style={{
          fontSize: 13,
          fontWeight: 400,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          opacity: 0.7,
          marginBottom: 4,
        }}>
          Stage {currentStage + 1} of {STAGES.length}
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.02em' }}>
          {stage.name}
        </div>
        <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4, maxWidth: 320, minHeight: 54 }}>
          {typedDescription}
        </div>
      </div>

      {/* Navigation — bottom center */}
      <div className="stage-nav" style={{
        position: 'absolute',
        bottom: 28,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        zIndex: 10,
      }}>
        <button
          onClick={goBack}
          disabled={isFirst || transitioning}
          style={{ ...btnStyle, opacity: isFirst ? 0.3 : (transitioning ? 0.5 : 1), cursor: isFirst || transitioning ? 'not-allowed' : 'pointer' }}
        >
          Back
        </button>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {STAGES.map((_, i) => (
            <div key={i} style={dotStyle(i)} />
          ))}
        </div>

        <button
          onClick={goNext}
          disabled={isLast || transitioning}
          style={{ ...btnStyle, opacity: isLast ? 0.3 : (transitioning ? 0.5 : 1), cursor: isLast || transitioning ? 'not-allowed' : 'pointer' }}
        >
          Next
        </button>
      </div>

      {/* Navigation hints — bottom right (desktop) */}
      <div className="nav-hints" style={{
        position: 'absolute',
        bottom: 28,
        right: 28,
        zIndex: 10,
        fontSize: 12,
        opacity: 0.5,
        color: darkMode ? '#e0e0e0' : '#333',
        textAlign: 'right',
        userSelect: 'none',
      }}>
        <span className="hints-desktop">Scroll to zoom · Drag to orbit · Right-click to pan</span>
        <span className="hints-mobile">Pinch to zoom · Drag to orbit · Two-finger to pan</span>
      </div>

      {/* Gaussian Splat placeholder */}
      {splatPlaceholder && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
          color: darkMode ? '#e0e0e0' : '#222',
          textAlign: 'center',
          userSelect: 'none',
        }}>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
            Gaussian Splat
          </div>
          <div style={{ fontSize: 14, opacity: 0.6 }}>
            Coming Soon
          </div>
        </div>
      )}
    </>
  )
}
