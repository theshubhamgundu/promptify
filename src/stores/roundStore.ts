import { create } from 'zustand'

export interface RoundState {
  activeRoundId: string | null
  roundProgress: Record<string, { score: number; completed: boolean }>
  setActiveRound: (id: string | null) => void
  updateProgress: (roundId: string, progress: { score: number; completed: boolean }) => void
}

export const useRoundStore = create<RoundState>((set) => ({
  activeRoundId: null,
  roundProgress: {},
  setActiveRound: (activeRoundId) => set({ activeRoundId }),
  updateProgress: (roundId, progress) => set((state) => ({
    roundProgress: {
      ...state.roundProgress,
      [roundId]: progress
    }
  })),
}))
