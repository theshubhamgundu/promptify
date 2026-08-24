import { create } from 'zustand';

interface AdminEvent {
  id: string;
  name: string;
  status: string;
}

interface AdminState {
  activeEvent: AdminEvent | null;
  setActiveEvent: (event: AdminEvent | null) => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  activeEvent: null,
  setActiveEvent: (event) => set({ activeEvent: event }),
}));
