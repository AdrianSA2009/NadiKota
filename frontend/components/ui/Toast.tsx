"use client";

import { CircleCheck, Info, X } from "lucide-react";
import { useToastStore } from "@/lib/toastStore";

/** Toast kanan atas — dipanggil dari mana saja lewat useToastStore.getState().show(...) */
export function Toast() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed right-4 top-4 z-[1500] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex items-start gap-2.5 rounded-xl border border-neutral-200 bg-neutral-0 p-3 shadow-lg animate-in slide-in-from-right fade-in duration-300"
        >
          {toast.type === "success" ? (
            <CircleCheck className="mt-0.5 size-5 shrink-0 text-success-600" aria-hidden="true" />
          ) : (
            <Info className="mt-0.5 size-5 shrink-0 text-info-600" aria-hidden="true" />
          )}
          <p className="min-w-0 flex-1 text-sm leading-5 text-neutral-800">{toast.message}</p>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
            aria-label="Tutup notifikasi"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
