import { create } from "zustand";

export interface User {
  id: number;
  name: string;
  username?: string;
  email?: string;
  avatarUrl?: string | null;
  role: string;
}

interface AuthState {
  user: User | null;
  initialized: boolean;
  setAuth: (user: User) => void;
  logout: () => void;
  setInitialized: () => void;
}

const AUTH_HINT_COOKIE = "nk_auth";

/**
 * Cookie petunjuk "login + role di browser ini" — dibaca oleh layout server
 * untuk langsung menampilkan 401 (role tak berhak) tanpa menunggu cek /me.
 * Sesi (bukan cookie ini) yang menentukan hak akses.
 */
function markLoggedIn(role: string | null) {
  if (typeof window === "undefined") return;
  document.cookie = role
    ? `${AUTH_HINT_COOKIE}=${encodeURIComponent(role)}; path=/; samesite=lax`
    : `${AUTH_HINT_COOKIE}=; path=/; samesite=lax; max-age=0`;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initialized: false,
  setAuth: (user) => {
    markLoggedIn(user.role);
    set({ user, initialized: true });
  },
  logout: () => {
    markLoggedIn(null);
    set({ user: null, initialized: true });
  },
  setInitialized: () => set({ initialized: true }),
}));
