import { create } from 'zustand'

export const WARMUP_FRAME_THRESHOLD = 3

export const useGpuWarmup = create((set) => ({
  warmupStatus: { map: false, mesh: false, scaleBar: false },
  markWarmed: (id) =>
    set((state) => ({
      warmupStatus: { ...state.warmupStatus, [id]: true },
    })),
}))
