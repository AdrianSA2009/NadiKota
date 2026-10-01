import { create } from "zustand";

export interface ToastItem {
  id: number;
  message: string;
  type: "success" | "info";
}

interface ToastState {
  toasts: ToastItem[];
  /** Tampilkan toast di kanan atas; otomatis hilang setelah 4 detik. */
  show: (message: string, type?: ToastItem["type"]) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (message, type = "success") => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

// Hook debug khusus development — pengujian toast dari console.
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__toast = useToastStore;
}
