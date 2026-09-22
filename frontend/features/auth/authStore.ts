import { create } from "zustand";

export interface User {
  id: number;
  name: string;
  email?: string;
  role: string;
}

interface AuthState {
  user: User | null;
  setAuth: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setAuth: (user) => set({ user }),
  logout: () => set({ user: null }),
}));
