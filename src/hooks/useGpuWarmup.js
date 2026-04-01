import { create } from 'zustand'
import { isIOS } from '../utils/platform'

export const WARMUP_FRAME_THRESHOLD = 3

export const useGpuWarmup = create((set) => ({
  warmupStatus: {
    map: false,
    mesh: isIOS,           // auto-mark on iOS (deferred mount)
    meshTextured: isIOS,   // auto-mark on iOS (deferred mount)
    scaleBar: false,
  },
  markWarmed: (id) =>
    set((state) => ({
      warmupStatus: { ...state.warmupStatus, [id]: true },
    })),
}))
