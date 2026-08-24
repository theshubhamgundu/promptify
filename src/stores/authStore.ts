import { create } from 'zustand'

export type UserRole = 'ADMIN' | 'COORDINATOR' | 'PARTICIPANT'

export interface AuthState {
  user: { id: string; email: string; full_name: string | null; role: UserRole } | null
  session: { access_token: string; refresh_token: string } | null
  isLoading: boolean
  setUser: (user: AuthState['user']) => void
  setSession: (session: AuthState['session']) => void
  setLoading: (loading: boolean) => void
  signOut: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setLoading: (isLoading) => set({ isLoading }),
  signOut: () => set({ user: null, session: null }),
}))
