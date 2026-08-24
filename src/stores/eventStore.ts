import { create } from 'zustand'
import type { Database } from '../lib/types'

type Event = Database['public']['Tables']['events']['Row']
type Round = Database['public']['Tables']['rounds']['Row']

export interface EventState {
  currentEvent: Event | null
  rounds: Round[]
  setCurrentEvent: (event: Event | null) => void
  setRounds: (rounds: Round[]) => void
}

export const useEventStore = create<EventState>((set) => ({
  currentEvent: null,
  rounds: [],
  setCurrentEvent: (currentEvent) => set({ currentEvent }),
  setRounds: (rounds) => set({ rounds }),
}))
