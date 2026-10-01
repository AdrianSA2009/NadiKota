"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";

interface ModalProps {
  title: string;
  caption?: string;
  /** Ikon di lingkaran warna lembut pada header. */
  icon?: LucideIcon;
  onClose: () => void;
  /** Footer: biasanya Batal (secondary) + aksi utama (primary). */
  footer?: ReactNode;
  /** Lebar panel: "md" default (max-w-2xl), "lg" (max-w-3xl), "xl" (max-w-4xl). */
  size?: "md" | "lg" | "xl";
  children: ReactNode;
}

const SIZES = { md: "max-w-2xl", lg: "max-w-3xl", xl: "max-w-4xl" };

/**
 * Shell modal project: overlay blur, animasi fade+scale (motion-safe),
 * Esc menutup, fokus terkunci di dalam panel, ARIA dialog.
 */
export function Modal({ title, caption, icon: Icon, onClose, footer, size = "md", children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const lastActive = useRef<HTMLElement | null>(null);
  // Ref agar efek fokus tidak berjalan ulang tiap render (onClose inline arrow) —
  // dulu fokus lompat ke tombol X setiap ketik 1 karakter di textarea.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    lastActive.current = document.activeElement as HTMLElement | null;
    const focusables = () =>
      [...panel.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter(
        (el) => !el.hasAttribute("disabled"),
      );
    // Fokuskan ke input pertama (bukan tombol X) supaya langsung bisa mengetik.
    const target =
      focusables().find((el) => el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.tagName === "SELECT") ?? focusables()[0];
    target?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const list = focusables();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      lastActive.current?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-end justify-center bg-neutral-900/50 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        className={`flex max-h-[92vh] w-full ${SIZES[size]} flex-col overflow-hidden rounded-t-2xl bg-neutral-0 shadow-2xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-200 sm:rounded-2xl`}
      >
        <header className="flex items-center gap-3 border-b border-neutral-200 px-5 py-4">
          {Icon && (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700" aria-hidden="true">
              <Icon className="size-5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold text-neutral-900">{title}</h2>
            {caption && <p className="truncate text-xs text-neutral-500">{caption}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500">
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && <footer className="flex gap-3 border-t border-neutral-200 bg-neutral-50 px-5 py-4">{footer}</footer>}
      </div>
    </div>
  );
}
