export const STAGES = [
  {
    id: 0,
    name: 'Meet the Drone',
    description: 'This is our survey drone. It will fly over the landscape capturing photos from different angles. Click "Next" to see how it works.',
  },
  {
    id: 1,
    name: 'Nadir Camera',
    description: 'The drone\u2019s camera tilts to point straight down \u2014 this is called nadir. Nadir photos are ideal for creating accurate 2D maps and orthomosaics, capturing the ground directly below the drone.',
  },
  {
    id: 2,
    name: 'Drone Flight',
    description: 'Let\u00b4s have the drone take flight! It follows a lawnmower pattern to capture overlapping images  - you can see how it leaves a trail of camera positions as it flies.',
  },
  {
    id: 3,
    name: 'Camera Placement',
    description: 'We now have a complete set of images looking down at our landscape, called nadir imagery. The cameras are placed in a grid pattern to ensure good coverage for mapping. You can click on the camera icons to see the actual photos taken at each position.',
  },
  {
    id: 4,
    name: 'Map Reveal',
    description: 'And from these nadir photos, we can create a map! This is a 2D orthomosaic (like a satellite map) stitched together from the drone images. It provides a detailed view of the landscape from above, but it is flat and lacks depth information. To get 3D structure, we need to add more camera angles.',
  },
  {
    id: 5,
    name: 'Map without terrain',
    description: 'The 2D map we made from the nadir photos is a flat map. While you can sometimes calculate a bit of terrain data from nadir flights, you will never get accurate 3D terrain from these flights alone. To capture the terrain, we need a few more flights - with the drone camera at an angle.',
  },
  {
    id: 6,
    name: 'Oblique Camera',
    description: 'To capture 3D terrain, the camera tilts to a 45-degree oblique angle. These angled photos reveal the sides of buildings, cliffs and terrain slopes that straight-down nadir photos would miss \u2014 essential for building accurate 3D models.',
  },
  {
    id: 7,
    name: 'Additional Oblique Flights',
    description: 'So now our drone is flying 4 additional grid patterns: capturing 45-degree angle from four different directions. That gives us a lot more data about the terrain.',
  },
  {
    id: 8,
    name: 'Point Cloud Generation',
    description: 'The first step for most 3D-models is to generate a point cloud. This process takes all of our nadir and oblique images and calculates points in 3D space that represent our scanned landscape.',
  },
  {
    id: 9,
    name: 'Making a Mesh',
    description: 'From the point cloud we can make a solid form by combining all the points into thousands or millions of tiny triangles. This becomes what we call a Mesh.',
  },
  {
    id: 10,
    name: 'Gaussian Splat',
    description: 'Gaussian splat rendering \u2014 coming soon',
  },
]

export const TOTAL_STAGES = STAGES.length

// Which models are visible at each stage
// Values: 'visible', 'fadeIn', 'fadeOut', or undefined (hidden)
export function getVisibility(stage) {
  return {
    drone:              stage <= 2 || stage === 6,
    droneHovering:      stage === 0,
    droneAnimating:     stage === 2,
    dronePath:          stage === 2,
    droneProfileNadir:  stage === 1,
    droneProfileOblique: stage === 6,
    groundPlane:        stage <= 3 ? 'visible' : stage === 4 ? 'fadeOut' : undefined,
    // Nadir cameras fade in at stage 3, visible at stage 4 (faded out after map via Scene.jsx), hidden from stage 5+
    nadirCameras:       stage === 3 ? 'fadeIn' : stage === 4 ? 'visible' : undefined,
    map:                stage === 4 ? 'fadeIn' : (stage >= 5 && stage <= 7) ? 'visible' : stage === 8 ? 'fadeOut' : undefined,
    obliqueCameras:     stage === 7 ? 'fadeIn' : stage >= 8 ? 'visible' : undefined,
    pointCloud:         stage === 8 ? 'fadeIn' : stage === 9 ? 'fadeOut' : undefined,
    mesh:               stage === 9 ? 'fadeIn' : stage >= 10 ? 'visible' : undefined,
    splatPlaceholder:   stage === 10,
  }
}
