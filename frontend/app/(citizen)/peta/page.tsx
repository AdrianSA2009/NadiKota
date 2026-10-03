"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, ChevronUp, Gift, LogIn, LogOut, Menu, Settings, Users, X } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { useAuthStore } from "@/features/auth/authStore";
import { useKontribusiPanel } from "@/lib/kontribusiPanelStore";
import { useTukarPoinPanel } from "@/lib/tukarPoinPanelStore";
import type { TicketListResponse } from "@/features/dashboard/dashboardTypes";
import { KontribusiPanel } from "@/components/map/KontribusiPanel";
import { TukarPoinPanel } from "@/components/map/TukarPoinPanel";

const LocationMap = dynamic(() => import("@/components/map/LocationMap"), { ssr: false });

const STAFF = ["admin", "super_admin", "field_team"] as const;
const ADMIN = ["admin", "super_admin"] as const;
/** Batas request peta — sama dengan batas server (limit: 200). */
const MAP_LIMIT = 200;

/** Drawer menu admin (mobile) — hanya admin/super_admin; tombolnya di dalam search bar (navAction LocationMap). */
function AdminQuickMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const closeKontribusi = useKontribusiPanel((s) => s.closePanel);
  const closeTukar = useTukarPoinPanel((s) => s.closePanel);

  const isStaff = Boolean(user && (ADMIN as readonly string[]).includes(user.role));
  if (!initialized || !user || !isStaff || !open) return null;

  const items = [
    { href: "/rewards", label: "Hadiah", icon: Gift, roles: ADMIN as readonly string[] },
    { href: "/teams", label: "Manajemen Tim", icon: Users, roles: STAFF as readonly string[] },
    { href: "/settings", label: "Pengaturan", icon: Settings, roles: STAFF as readonly string[] },
  ].filter((item) => item.roles.includes(user.role));

  return (
    <div
      className="fixed inset-0 z-[1100] flex bg-neutral-900/50 backdrop-blur-sm md:hidden"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <nav className="h-full w-64 bg-neutral-0 p-4 shadow-2xl" aria-label="Menu admin">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-bold text-neutral-900">Menu Admin</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup menu"
            className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <ul className="space-y-1">
          {items.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={() => { closeKontribusi(); closeTukar(); onClose(); }}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-primary-50 hover:text-primary-800"
              >
                <Icon className="size-5 text-neutral-400" aria-hidden="true" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/** placement="bar" → di dalam search bar (mobile); "floating" → pojok kanan atas (desktop). */
function ProfileMenu({ onLogin, placement = "floating" }: { onLogin: () => void; placement?: "bar" | "floating" }) {
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();
  const closePanel = useKontribusiPanel((s) => s.closePanel);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!initialized) return null;

  const wrapClass =
    placement === "bar"
      ? "relative"
      : "absolute right-3 top-3 z-[900] hidden md:right-4 md:top-4 md:block";

  if (!user) {
    if (placement === "bar") return null; // mobile: tombol Masuk dari searchAction PetaPage
    return (
      <div className={wrapClass}>
        <button
          type="button"
          onClick={onLogin}
          className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-0/90 px-3.5 py-2 text-xs font-semibold text-primary-800 shadow-sm backdrop-blur-sm transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
        >
          <LogIn className="size-4" aria-hidden="true" />
          Masuk
        </button>
      </div>
    );
  }

  async function handleLogout() {
    setOpen(false);
    try { await apiClient.post("/auth/logout"); } catch { /* session mungkin sudah habis */ }
    queryClient.removeQueries({ queryKey: ["me"] });
    logout();
    closePanel();
    router.push("/peta");
  }

  function toggle() {
    if (placement === "bar" && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    setOpen((v) => !v);
  }

  return (
    <div ref={ref} className={wrapClass}>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu profil"
        className={
          placement === "bar"
            ? "flex size-8 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-100"
            : "flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-0/90 px-2 py-1.5 shadow-sm backdrop-blur-sm transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
        }
      >
        <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-50 text-xs font-bold text-primary-800" aria-hidden="true">
          {user.avatarUrl
            // Avatar dari API Laravel (URL dinamis) — next/image butuh remotePatterns; <img> cukup & konsisten dgn halaman lain.
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={user.avatarUrl} alt="" className="size-7 object-cover" />
            : user.name.charAt(0).toUpperCase()}
        </span>
        {placement !== "bar" && <ChevronUp className={`size-3.5 shrink-0 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />}
      </button>
      {open && (
        <div
          role="menu"
          style={placement === "bar" && menuPos ? { position: "fixed", top: menuPos.top, right: menuPos.right, zIndex: 1200 } : undefined}
          className={
            placement === "bar"
              ? "w-44 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-0 py-1 shadow-lg"
              : "absolute right-0 mt-2.5 w-44 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-0 py-1 shadow-lg"
          }
        >
          <div className="border-b border-neutral-100 px-3 py-2">
            <p className="truncate text-sm font-semibold text-neutral-900">{user.name}</p>
            <p className="truncate text-xs text-neutral-500">@{user.username}</p>
          </div>
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100"
          >
            <Settings className="size-4 text-neutral-400" aria-hidden="true" />
            Pengaturan
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-danger-700 transition-colors hover:bg-danger-50"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Keluar
          </button>
        </div>
      )}
    </div>
  );
}

export default function PetaPage() {
  const router = useRouter();
  const openLogin = () => router.push("/login");
  const user = useAuthStore((s) => s.user);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  // Real-time: polling ringan tiap 20 detik — laporan/dispatch baru langsung muncul di peta,
  // tanpa perlu refresh. Berhenti saat tab tidak terlihat agar tidak boros.
  const { data, isError } = useQuery({
    queryKey: ["tickets-map"],
    queryFn: async () => {
      const res = await apiClient.get<TicketListResponse>("/tickets/map", {
        params: { limit: MAP_LIMIT },
      });
      return res.data;
    },
    staleTime: 15_000,
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const tickets = data?.data ?? [];
  // true = server mungkin masih punya tiket lain di luar batas.
  const isStaff = Boolean(user && (ADMIN as readonly string[]).includes(user.role));

  return (
    <div className="absolute inset-0">
      <LocationMap
        tickets={tickets}
        zoom={13}
        navAction={
          isStaff ? (
            <button
              type="button"
              onClick={() => setQuickMenuOpen(true)}
              aria-label="Menu admin"
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-100 md:hidden"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
          ) : undefined
        }
        searchAction={
          user ? (
            <span className="md:hidden">
              <ProfileMenu placement="bar" onLogin={openLogin} />
            </span>
          ) : (
            <button
              type="button"
              onClick={openLogin}
              className="flex shrink-0 items-center gap-1 rounded-full bg-primary-800 px-3 py-1.5 text-xs font-semibold text-neutral-0 transition-colors hover:bg-primary-700 md:hidden"
            >
              <LogIn className="size-3.5" aria-hidden="true" />
              Masuk
            </button>
          )
        }
      />
      <ProfileMenu onLogin={openLogin} />

      {/* Lapor kerusakan — di bawah search bar sisi KIRI: kanan atas dipakai avatar + dropdown profil,
          kiri bawah ada kontrol zoom/locate & bottom nav — kolom kiri-atas bebas (satu tombol utk mobile & desktop).
          Disembunyikan utk admin & tim lapangan (mereka tak melapor). */}
      {!(user && (STAFF as readonly string[]).includes(user.role)) && (
        <button
          type="button"
          onClick={() => (user ? router.push("/report") : openLogin())}
          aria-label="Lapor kerusakan"
          className="absolute left-3 top-16 z-[925] flex items-center gap-2 rounded-full bg-primary-800 px-4 py-2.5 text-sm font-semibold text-neutral-0 shadow-lg transition hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 md:left-4"
        >
          <Camera className="size-4" aria-hidden="true" />
          Lapor Kerusakan
        </button>
      )}
      <AdminQuickMenu open={quickMenuOpen} onClose={() => setQuickMenuOpen(false)} />

      {/* Error banner — top center, doesn't block map */}
      {isError && (
        <div className="absolute left-1/2 top-3 z-[900] -translate-x-1/2 rounded-full border border-danger-600 bg-danger-50/90 px-4 py-1.5 text-xs font-medium text-danger-700 shadow-sm backdrop-blur-sm">
          Gagal memuat data tiket
        </div>
      )}

      {/* Panel kontribusi + tukar poin — tampil di atas peta */}
      <KontribusiPanel />
      <TukarPoinPanel />
    </div>
  );
}
