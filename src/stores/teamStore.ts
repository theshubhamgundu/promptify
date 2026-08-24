import { create } from 'zustand'
import type { Database } from '../lib/types'

type Team = Database['public']['Tables']['teams']['Row']
type Participant = Database['public']['Tables']['participants']['Row']

export interface TeamState {
  currentTeam: Team | null
  members: Participant[]
  sessionState: 'CREATED' | 'LOGIN_PENDING' | 'VERIFICATION_PENDING' | 'VERIFIED' | 'ACTIVE' | 'COMPLETED' | 'SUSPENDED'
  setCurrentTeam: (team: Team | null) => void
  setMembers: (members: Participant[]) => void
  setSessionState: (state: TeamState['sessionState']) => void
}

export const useTeamStore = create<TeamState>((set) => ({
  currentTeam: null,
  members: [],
  sessionState: 'CREATED',
  setCurrentTeam: (currentTeam) => set({ currentTeam }),
  setMembers: (members) => set({ members }),
  setSessionState: (sessionState) => set({ sessionState }),
}))
