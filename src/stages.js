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
    description: 'We now have a complete set of images looking down at our landscape, called nadir imagery. The cameras are placed in a grid pattern to ensure good coverage for mapping. You can click on the camera icons to see the actual photos taken at each position.',
  },
  {
    id: 3,
    name: 'Map Reveal',
    description: 'And from these nadir photos, we can create a map! This is a 2D orthomosaic (like a satellite map) stitched together from the drone images. It provides a detailed view of the landscape from above, but it is flat and lacks depth information. To get 3D structure, we need to add more camera angles.',
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
