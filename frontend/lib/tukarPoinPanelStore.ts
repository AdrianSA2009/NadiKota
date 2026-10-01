import { create } from "zustand";

const readFlag = (key: string) => typeof window !== "undefined" && sessionStorage.getItem(key) === "1";

interface PanelState {
  open: boolean;
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
export const useTukarPoinPanel = create<PanelState>((set) => ({
  open: false,
  half: false,
  openPanel: () => set({ open: true, half: false }),
  closePanel: () => set({ open: false, half: false }),
  togglePanel: () => set((state) => (state.open ? { open: false, half: false } : { open: true, half: false })),
  setHalf: (half: boolean) => set({ half }),
  restoreFlags: () => set({ open: readFlag("tukarpoin-open"), half: readFlag("tukarpoin-half") }),
}));

useTukarPoinPanel.subscribe((state) => {
  if (typeof window === "undefined") return;
  sessionStorage.setItem("tukarpoin-open", state.open ? "1" : "0");
  sessionStorage.setItem("tukarpoin-half", state.half ? "1" : "0");
});
