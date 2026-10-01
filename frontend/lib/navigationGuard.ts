import { create } from "zustand";

interface NavGuardState {
  /** Ada progres laporan yang belum terkirim (foto/langkah terisi). */
  reportDirty: boolean;
  setReportDirty: (v: boolean) => void;
  /** Halaman tujuan yang ditunda sampai user mengonfirmasi. */
  pendingHref: string | null;
  /** Aksi tambahan setelah konfirmasi (mis. membuka panel Kontribusi). */
  pendingExtra: (() => void) | null;
  /**
   * Minta izin pindah halaman.
   * true  → boleh langsung navigasi.
   * false → modal konfirmasi ditampilkan; navigasi ditunda.
   */
  requestLeave: (href: string, beforeNavigate?: () => void) => boolean;
  confirmLeave: () => void;
  cancelLeave: () => void;
}

export const useNavGuard = create<NavGuardState>((set, get) => ({
  reportDirty: false,
  setReportDirty: (v) => set({ reportDirty: v }),
  pendingHref: null,
  pendingExtra: null,
  requestLeave: (href, beforeNavigate) => {
    if (!get().reportDirty) return true;
    set({ pendingHref: href, pendingExtra: beforeNavigate ?? null });
    return false;
  },
  confirmLeave: () => set({ reportDirty: false, pendingHref: null, pendingExtra: null }),
  cancelLeave: () => set({ pendingHref: null, pendingExtra: null }),
}));

// Hook debug khusus development — memudahkan pengujian mekanisme konfirmasi dari console.
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__navGuard = useNavGuard;
}
