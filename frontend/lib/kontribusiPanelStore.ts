import { create } from "zustand";

// State panel persist lintas refresh (sessionStorage — hilang saat tab ditutup).
const readFlag = (key: string) => typeof window !== "undefined" && sessionStorage.getItem(key) === "1";

interface PanelState {
  /** Panel terbuka (full atau half). */
  open: boolean;
  /** Kondisi mobile: panel ditarik setengah (peek). */
  half: boolean;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  setHalf: (half: boolean) => void;
  /** Restore flag dari sessionStorage — panggil setelah hydration (client only). */
  restoreFlags: () => void;
}

// Default false di server & render pertama client — sessionStorage dibaca belakangan
// supaya tidak beda dengan HTML SSR (hydration mismatch).
export const useKontribusiPanel = create<PanelState>((set) => ({
  open: false,
  half: false,
  openPanel: () => set({ open: true, half: false }),
  closePanel: () => set({ open: false, half: false }),
  togglePanel: () => set((state) => (state.open ? { open: false, half: false } : { open: true, half: false })),
  setHalf: (half: boolean) => set({ half }),
  restoreFlags: () => set({ open: readFlag("kontri-open"), half: readFlag("kontri-half") }),
}));

// Simpan setiap perubahan state agar refresh tidak kehilangan posisi panel.
useKontribusiPanel.subscribe((state) => {
  if (typeof window === "undefined") return;
  sessionStorage.setItem("kontri-open", state.open ? "1" : "0");
  sessionStorage.setItem("kontri-half", state.half ? "1" : "0");
});

// Hook debug khusus development untuk pengujian dari console.
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__kontri = useKontribusiPanel;
}
