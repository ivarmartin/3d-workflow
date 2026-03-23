export const STAGES = [
  {
    id: 0,
    name: "Let's make some spatial data!",
    description: 'This interactive will show you how we turn drone photos into maps, point clouds, 3D-models and gaussian splats. Click "Next" to start the journey.',
  },
  {
    id: 1,
    name: 'Drone Flight',
    description: 'Let´s have the drone take flight! It follows a lawnmower pattern to capture overlapping images  - you can see how it leaves a trail of camera positions as it flies.',
  },
  {
    id: 2,
    name: 'Camera Placement',
    description: 'Nadir camera positions captured during the drone survey',
  },
  {
    id: 3,
    name: 'Map Reveal',
    description: '2D orthophoto map generated from nadir imagery',
  },
  {
    id: 4,
    name: 'Oblique Cameras',
    description: 'Additional oblique camera angles for 3D reconstruction',
  },
  {
    id: 5,
    name: 'Point Cloud',
    description: 'Dense 3D point cloud from structure-from-motion',
  },
  {
    id: 6,
    name: 'Mesh',
    description: 'Textured 3D mesh reconstructed from the point cloud',
  },
  {
    id: 7,
    name: 'Gaussian Splat',
    description: 'Gaussian splat rendering — coming soon',
  },
]

export const TOTAL_STAGES = STAGES.length

// Which models are visible at each stage
// Values: 'visible', 'fadeIn', 'fadeOut', or undefined (hidden)
export function getVisibility(stage) {
  return {
    drone:          stage <= 1,
    droneHovering:  stage === 0,
    droneAnimating: stage === 1,
    dronePath:      stage === 1,
    groundPlane:    stage <= 2 ? 'visible' : stage === 3 ? 'fadeOut' : undefined,
    nadirCameras:   stage === 2 ? 'fadeIn' : stage >= 3 ? 'visible' : undefined,
    map:            stage === 3 ? 'fadeIn' : stage >= 4 ? 'visible' : undefined,
    obliqueCameras: stage === 4 ? 'fadeIn' : stage >= 5 ? 'visible' : undefined,
    pointCloud:     stage === 5 ? 'fadeIn' : stage === 6 ? 'fadeOut' : undefined,
    mesh:           stage === 6 ? 'fadeIn' : stage >= 7 ? 'visible' : undefined,
    splatPlaceholder: stage === 7,
  }
}
