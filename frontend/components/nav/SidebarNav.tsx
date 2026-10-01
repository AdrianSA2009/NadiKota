"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Gift, HandHeart, Landmark, LogOut, Map, Settings, ChevronUp, LayoutDashboard, ClipboardCheck, Truck, Users, ClipboardList, type LucideIcon } from "lucide-react";
import { useKontribusiPanel } from "@/lib/kontribusiPanelStore";
import { useTukarPoinPanel } from "@/lib/tukarPoinPanelStore";
import { useNavGuard } from "@/lib/navigationGuard";
import { useAuthStore } from "@/features/auth/authStore";
import { apiClient } from "@/lib/apiClient";

interface MenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
  action?: "navigate" | "panel" | "tukarpoin";
  roles?: readonly string[];
  /** Sembunyikan menu untuk role-role ini (tetap tampil untuk guest/citizen). */
  hideRoles?: readonly string[];
}

const ADMIN = ["admin", "super_admin"] as const;
const ALL_AUTHED = ["citizen", "admin", "super_admin", "field_team"] as const;

/** Urutan menu sidebar: Dashboard → Peta → Kontribusi → Review → Dispatch → Tiket → Hadiah → Manajemen Tim → Pengaturan */
const allMenus: MenuItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ADMIN },
  { href: "/peta", label: "Peta", icon: Map, action: "navigate" },
  { href: "/kontribusi", label: "Kontribusi", icon: HandHeart, action: "panel", hideRoles: ["admin", "super_admin", "field_team"] as const },
  { href: "/tukar-poin", label: "Tukar Poin", icon: Gift, action: "tukarpoin", hideRoles: ["admin", "super_admin", "field_team"] as const },
  { href: "/review", label: "Review", icon: ClipboardCheck, roles: ADMIN },
  { href: "/dispatch", label: "Dispatch", icon: Truck, roles: ADMIN },
  { href: "/tickets", label: "Tiket", icon: ClipboardList, roles: ADMIN },
  { href: "/rewards", label: "Hadiah", icon: Gift, roles: ADMIN },
  { href: "/teams", label: "Tim", icon: Users, roles: ["admin", "super_admin", "field_team"] },
  { href: "/settings", label: "Pengaturan", icon: Settings, roles: ALL_AUTHED },
];

interface SidebarNavProps {
  activePath: string;
  /** True = pengunjung publik → tanpa skeleton, langsung menu tamu. */
  publicVisitor?: boolean;
}

export function SidebarNav({ activePath, publicVisitor = false }: SidebarNavProps) {
  const togglePanel = useKontribusiPanel((s) => s.togglePanel);
  const openPanel = useKontribusiPanel((s) => s.openPanel);
  const closePanel = useKontribusiPanel((s) => s.closePanel);
  const panelOpen = useKontribusiPanel((s) => s.open);
  const toggleTukar = useTukarPoinPanel((s) => s.togglePanel);
  const openTukar = useTukarPoinPanel((s) => s.openPanel);
  const closeTukar = useTukarPoinPanel((s) => s.closePanel);
  const tukarOpen = useTukarPoinPanel((s) => s.open);
  const requestLeave = useNavGuard((s) => s.requestLeave);
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const logout = useAuthStore((s) => s.logout);
  const showSkeleton = !initialized && !publicVisitor;
  const queryClient = useQueryClient();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  async function handleLogout() {
    setMenuOpen(false);
    try { await apiClient.post("/auth/logout"); } catch { /* session mungkin sudah habis */ }
    queryClient.removeQueries({ queryKey: ["me"] });
    logout();
    closePanel();
    router.push("/peta");
  }

  return (
    <aside className="relative z-[1010] hidden flex-col border-r border-neutral-200 bg-neutral-0 md:flex md:w-60 md:shrink-0" aria-label="Navigasi utama">
      <div className="flex items-center gap-2 px-5 py-4">
        <Landmark className="size-6 text-primary-800" aria-hidden="true" />
        <span className="text-lg font-bold text-neutral-900">NadiKota</span>
      </div>

      <nav className="flex-1 px-3 py-2">
        {/* Belum selesai cek auth (kemungkinan login) → skeleton; pengunjung publik langsung menu tamu */}
        {showSkeleton ? (
          <div className="space-y-2" aria-hidden="true">
            <div className="h-10 animate-pulse rounded-lg bg-neutral-100" />
            <div className="h-10 animate-pulse rounded-lg bg-neutral-100" />
            <div className="h-10 animate-pulse rounded-lg bg-neutral-100" />
          </div>
        ) : (
          allMenus
          .filter((m) => {
            if (m.roles && (!user || !m.roles.includes(user.role))) return false;
            if (m.hideRoles && user && m.hideRoles.includes(user.role)) return false;
            return true;
          })
          .map(({ href, label, icon: Icon, action }) => {
            const isPanel = action === "panel";
            const isTukar = action === "tukarpoin";
            const active = isPanel ? panelOpen : isTukar ? tukarOpen : (!panelOpen && !tukarOpen && (activePath === href || activePath.startsWith(href + "/")));
            // Sesuaikan nama menu dengan isi halaman: admin = manajemen tim, tim lapangan = tugas saya.
            const menuLabel = href === "/teams" ? (user?.role === "field_team" ? "Tugas Saya" : "Manajemen Tim") : label;

          if (isPanel || isTukar) {
            return (
              <button
                key={href}
                type="button"
                onClick={() => {
                  if (isTukar) { closePanel(); } else { closeTukar(); }
                  if (activePath !== "/peta") {
                    if (!requestLeave("/peta", isTukar ? openTukar : openPanel)) return;
                    isTukar ? openTukar() : openPanel();
                    router.push("/peta");
                    return;
                  }
                  isTukar ? toggleTukar() : togglePanel();
                }}
                className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? "bg-primary-50 text-primary-800" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                <Icon className={`size-5 ${active ? "text-primary-800" : "text-neutral-400"}`} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
                {menuLabel}
              </button>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              onClick={(e) => {
                if (!requestLeave(href)) {
                  e.preventDefault();
                  return;
                }
                closePanel();
                closeTukar();
                setMenuOpen(false);
              }}
              className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? "bg-primary-50 text-primary-800" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon className={`size-5 ${active ? "text-primary-800" : "text-neutral-400"}`} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
              {menuLabel}
            </Link>
          );
          })
        )}
      </nav>

      {/* Footer: user profile + dropdown — hanya tampil setelah login */}
      {user && (
      <div ref={menuRef} className="relative border-t border-neutral-200 p-3">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
        >
          <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-50 text-sm font-bold text-primary-800" aria-hidden="true">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="size-9 object-cover" />
            ) : (
              user.name.charAt(0).toUpperCase()
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-neutral-900">{user.name}</span>
          </span>
          <ChevronUp className={`size-4 shrink-0 text-neutral-400 transition-transform ${menuOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>

        {menuOpen && (
          <div role="menu" className="absolute bottom-full left-3 mb-1 w-[calc(100%-1.5rem)] overflow-hidden rounded-lg border border-neutral-200 bg-neutral-0 py-1 shadow-lg">
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
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
      )}
    </aside>
  );
}
