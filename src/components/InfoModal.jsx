const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
)

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
)

export default function InfoModal({ darkMode, setDarkMode, infoOpen, setInfoOpen }) {
  return (
    <>
      {/* Theme toggle — top left */}
      <button
        onClick={() => setDarkMode(!darkMode)}
        style={{
          position: 'absolute',
          top: 28,
          left: 28,
          zIndex: 10,
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: 'none',
          background: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
          color: darkMode ? '#e0e0e0' : '#333',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          transition: 'all 0.3s ease',
        }}
      >
        {darkMode ? <SunIcon /> : <MoonIcon />}
      </button>

      {/* Menu button — top right */}
      <button
        onClick={() => setInfoOpen(true)}
        style={{
          position: 'absolute',
          top: 28,
          right: 28,
          zIndex: 10,
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: 'none',
          background: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
          color: darkMode ? '#e0e0e0' : '#333',
          cursor: 'pointer',
          fontSize: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          transition: 'all 0.3s ease',
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        }}
      >
        &#9776;
      </button>

      {/* Modal overlay */}
      {infoOpen && (
        <div
          onClick={() => setInfoOpen(false)}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: darkMode ? '#1e1e3a' : '#f5f5f5',
              color: darkMode ? '#e0e0e0' : '#222',
              borderRadius: 16,
              padding: 32,
              maxWidth: 520,
              width: '90%',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
              position: 'relative',
              fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            }}
          >
            <button
              onClick={() => setInfoOpen(false)}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                background: 'none',
                border: 'none',
                color: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
                fontSize: 20,
                cursor: 'pointer',
              }}
            >
              &#10005;
            </button>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
              Photogrammetry Pipeline
            </h2>
            <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
              This interactive visualization walks through the stages of a photogrammetry
              workflow — from drone flight planning to 3D reconstruction. Each stage reveals
              a new layer of the pipeline.
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
              Use the <strong>Next</strong> and <strong>Back</strong> buttons to progress
              through the 7 stages. Orbit, zoom, and pan to explore the scene from any angle.
            </p>
            <p style={{ fontSize: 13, opacity: 0.6, lineHeight: 1.6 }}>
              Data: Sanda survey, March 2026
            </p>
          </div>
        </div>
      )}
    </>
  )
}
