export const STAGES = [
  {
    id: 0,
    name: 'Drone Flight',
    description: 'Survey drone flying a lawnmower grid pattern over the site',
  },
  {
    id: 1,
    name: 'Camera Placement',
    description: 'Nadir camera positions captured during the drone survey',
  },
  {
    id: 2,
    name: 'Map Reveal',
    description: '2D orthophoto map generated from nadir imagery',
  },
  {
    id: 3,
    name: 'Oblique Cameras',
    description: 'Additional oblique camera angles for 3D reconstruction',
  },
  {
    id: 4,
    name: 'Point Cloud',
    description: 'Dense 3D point cloud from structure-from-motion',
  },
  {
    id: 5,
    name: 'Mesh',
    description: 'Textured 3D mesh reconstructed from the point cloud',
  },
  {
    id: 6,
    name: 'Gaussian Splat',
    description: 'Gaussian splat rendering — coming soon',
  },
]

export const TOTAL_STAGES = STAGES.length

// Which models are visible at each stage
// Values: 'visible', 'fadeIn', 'fadeOut', or undefined (hidden)
export function getVisibility(stage) {
  return {
    drone:          stage <= 2,
    droneAnimating: stage === 0,
    groundPlane:    stage <= 1 ? 'visible' : stage === 2 ? 'fadeOut' : undefined,
    nadirCameras:   stage === 1 ? 'fadeIn' : stage >= 2 ? 'visible' : undefined,
    map:            stage === 2 ? 'fadeIn' : stage >= 3 ? 'visible' : undefined,
    obliqueCameras: stage === 3 ? 'fadeIn' : stage >= 4 ? 'visible' : undefined,
    pointCloud:     stage === 4 ? 'fadeIn' : stage === 5 ? 'fadeOut' : undefined,
    mesh:           stage === 5 ? 'fadeIn' : stage >= 6 ? 'visible' : undefined,
    splatPlaceholder: stage === 6,
  }
}
