# WebXR Photogrammetry Pipeline — Implementation Plan

## Tech Stack (matching spatial-visualizer)
- React 19 + React Three Fiber + @react-three/drei
- Vite (dev server + build)
- Three.js 0.183.1
- Single entry point: index.html → src/main.jsx → App.jsx

## File Structure
```
├── .github/workflows/deploy.yml  # GitHub Actions → GitHub Pages
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx              # Mount App to #root
│   ├── App.jsx               # Theme state, layout, Canvas + UI
│   ├── index.css              # Global styles (dark/light theme)
│   ├── stages.js              # Stage definitions (name, description, visibility flags)
│   ├── components/
│   │   ├── Scene.jsx          # Lights, controls, models, drone
│   │   ├── Drone.jsx          # Animated cube + generated lawnmower path
│   │   ├── FadeModel.jsx      # Reusable GLB loader with opacity fade
│   │   ├── GroundPlane.jsx    # Gray plane for stages 0-1
│   │   ├── StageUI.jsx        # Next/Back buttons, stage title, progress dots
│   │   └── InfoModal.jsx      # Hamburger → info modal
│   └── hooks/
│       └── useStageManager.js # Stage state machine
├── public/
│   └── assets/
│       ├── 260321-Sanda-2D_map.glb
│       ├── 260321-Sanda-cameras_nadir.glb
│       ├── 260321-Sanda-cameras_oblique.glb
│       ├── 260321-Sanda-pointcloud.glb
│       ├── 260321-Sanda-3D_mesh.glb
│       └── waypoints.json (existing but unused for now)
```

## Implementation Steps

### Step 1: Project scaffold
- Create package.json with dependencies (react, react-dom, @react-three/fiber, @react-three/drei, three, vite)
- Create vite.config.js
- Create index.html with #root div
- Create src/main.jsx entry point
- Create src/index.css with dark/light theme styles matching spatial-visualizer

### Step 2: App.jsx + Theme
- Dark/light theme state with toggle
- Layout: full-viewport Canvas + overlay UI
- Pass theme to Scene and UI components
- Dark: bg #1a1a2e, text #e0e0e0 | Light: bg #e8eaef, text #222

### Step 3: useStageManager hook
- currentStage (0-6), goNext(), goBack()
- transitioning flag (true during 0.75s fades, disables buttons)
- Derived visibility map per stage:
  - Stage 0: drone, groundPlane
  - Stage 1: drone, groundPlane, nadirCameras (fading in)
  - Stage 2: groundPlane (fading out), map (fading in), nadirCameras
  - Stage 3: map, nadirCameras, obliqueCameras (fading in)
  - Stage 4: map, nadirCameras, obliqueCameras, pointCloud (fading in)
  - Stage 5: map, nadirCameras, obliqueCameras, pointCloud (fading out), mesh (fading in)
  - Stage 6: map, nadirCameras, obliqueCameras, mesh, placeholder text

### Step 4: FadeModel component
- Props: url, visible (boolean), fadeDuration (0.75s default), onFadeComplete
- useGLTF to load GLB
- On visible change: traverse meshes, set transparent=true, animate opacity via useFrame
- Handle vertex colors (point cloud)
- Set object3d.visible=false after full fade-out for performance

### Step 5: Drone component
- Generate lawnmower grid path programmatically:
  - Area: ~630m × 715m centered on 2D map (center ≈ -30, 97, -22)
  - X range: -345 to 315, Z range: -380 to 340
  - Altitude: y = 97
  - Spacing: ~40m between passes → ~16 passes
  - Back-and-forth pattern (odd passes reverse Z direction)
- Render as small box mesh (3m × 1.5m × 3m), distinct color
- Animate along path using useFrame at ~80 m/s
- Visible in stages 0-2, hidden from stage 3+
- Animation starts when entering stage 0, pauses at end

### Step 6: GroundPlane component
- PlaneGeometry 1000×1000m at y=0, rotated flat
- Color: #444466 (dark) / #b0b0c0 (light)
- Fades out when 2D map appears (stage 2)

### Step 7: Scene component
- Canvas with camera at (-30, 500, 600), fov 50, near 0.1, far 5000
- OrbitControls: target (-30, 4, -22), damping, minDistance 50, maxDistance 2000
- Auto-rotate at 0.3 speed (screensaver), pauses on interaction, resumes after 5s idle
- Ambient light (0.6 dark / 1.0 light) + directional light at [200, 400, 300]
- FadeModel instances for all 5 GLBs, visibility driven by stage manager
- Drone component
- GroundPlane component

### Step 8: StageUI component
- Bottom center: Back + Next pill buttons (white on dark / dark on light)
- Back hidden on stage 0, Next shows "Finish" on stage 6
- 7 progress dots between buttons
- Bottom left: stage title + one-line description
- Bottom right (desktop) / bottom left (mobile): nav hints
- Buttons disabled during transitions

### Step 9: InfoModal + theme toggle
- Top-left: theme toggle button (sun/moon SVG, 40px circle)
- Top-right: hamburger → modal with blur backdrop
- Modal: project info, same style as spatial-visualizer

### Step 10: Stage 6 placeholder
- "Gaussian Splat — Coming Soon" overlay text when stage 6 is active
- Scaffolded for future .splat/.spz integration

### Step 11: Preload all GLBs
- useGLTF.preload() calls for all 5 assets on app mount
- Loading indicator while assets load (drei's <Html> or DOM overlay)

### Step 12: GitHub Pages Deployment
- vite.config.js: set `base: '/3d-workflow/'` (repo name subdirectory for GitHub Pages)
- Create `.github/workflows/deploy.yml` — GitHub Actions workflow:
  - Trigger on push to main
  - Install deps, run `npm run build`
  - Vite outputs to `dist/` (built app + public/assets copied automatically by Vite)
  - Deploy `dist/` to GitHub Pages using `actions/deploy-pages`
- The `public/` folder is Vite's static asset directory — everything in `public/` (including GLBs) is copied to `dist/` at build time, so the built site serves all assets correctly
- All asset URLs in code use relative paths (e.g., `assets/260321-Sanda-2D_map.glb`) which Vite resolves against the base path
