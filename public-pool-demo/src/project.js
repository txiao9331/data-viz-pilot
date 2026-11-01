import { createGalleryScene } from './scene.js'

export function createProject() {
  return {
    id: 'public-pool-pilot',
    name: 'Public Pool · Spatial Prototype',
    defaultSceneId: 'replay',
    scenes: [
      {
        id: 'replay',
        name: 'Personal Replay',
        createScene: (context) => createGalleryScene({ ...context, mode: 'replay' }),
      },
      {
        id: 'pool',
        name: 'Public Pool · 36-Visitor Route Comparison',
        createScene: (context) => createGalleryScene({ ...context, mode: 'pool' }),
      },
      {
        id: 'tour',
        name: 'Camera Tour',
        createScene: (context) => createGalleryScene({ ...context, mode: 'tour' }),
      },
      {
        id: 'walk',
        name: 'Free Walk',
        createScene: (context) => createGalleryScene({ ...context, mode: 'walk' }),
      },
    ],
  }
}
