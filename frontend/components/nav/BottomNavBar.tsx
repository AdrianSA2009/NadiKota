"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ClipboardCheck, Gift, HandHeart, LayoutDashboard, List, Map, Settings, Truck, Users } from "lucide-react";
import { useKontribusiPanel } from "@/lib/kontribusiPanelStore";
import { useTukarPoinPanel } from "@/lib/tukarPoinPanelStore";
import { useNavGuard } from "@/lib/navigationGuard";
import { useAuthStore } from "@/features/auth/authStore";
import { useUnreadBadges } from "@/features/notifications/useUnreadBadges";

const STAFF = ["admin", "super_admin", "field_team"] as const;
const ADMIN = ["admin", "super_admin"] as const;

const menus: { href: string; label: string; icon: typeof Map; action: "navigate" | "panel" | "tukarpoin"; roles?: readonly string[]; hideRoles?: readonly string[] }[] = [
  { href: "/peta", label: "Peta", icon: Map, action: "navigate" },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, action: "navigate", roles: ADMIN },
  { href: "/review", label: "Review", icon: ClipboardCheck, action: "navigate", roles: ADMIN },
  { href: "/dispatch", label: "Dispatch", icon: Truck, action: "navigate", roles: ADMIN },
  { href: "/tickets", label: "Tiket", icon: List, action: "navigate", roles: ADMIN },
  // Role Tim: semua menunya tampil langsung di bottom bar (tanpa hamburger).
  { href: "/teams", label: "Tiket", icon: Users, action: "navigate", roles: ["field_team"] },
  { href: "/settings", label: "Pengaturan", icon: Settings, action: "navigate", roles: ["field_team"] },
  { href: "/kontribusi", label: "Kontribusi", icon: HandHeart, action: "panel", hideRoles: STAFF },
  { href: "/tukar-poin", label: "Poin", icon: Gift, action: "tukarpoin", hideRoles: STAFF },
];

export type NavMenu = (typeof menus)[number];
export const NAV_MENUS: NavMenu[] = menus;

interface BottomNavBarProps {
  activePath: string;
  /** True = pengunjung publik → tanpa skeleton, langsung menu tamu. */
  publicVisitor?: boolean;
}

export function BottomNavBar({ activePath, publicVisitor = false }: BottomNavBarProps) {
  const router = useRouter();
  const togglePanel = useKontribusiPanel((s) => s.togglePanel);
  const openPanel = useKontribusiPanel((s) => s.openPanel);
  const closePanel = useKontribusiPanel((s) => s.closePanel);
  const panelOpen = useKontribusiPanel((s) => s.open);
  const toggleTukar = useTukarPoinPanel((s) => s.togglePanel);
  const openTukar = useTukarPoinPanel((s) => s.openPanel);
  const tukarOpen = useTukarPoinPanel((s) => s.open);
  const closeTukar = useTukarPoinPanel((s) => s.closePanel);
  const requestLeave = useNavGuard((s) => s.requestLeave);
  const initialized = useAuthStore((s) => s.initialized);
  const showSkeleton = !initialized && !publicVisitor;
  const user = useAuthStore((s) => s.user);
  // Badge merah per tab — jumlah notifikasi belum dibaca.
  const { badgeFor, markPathRead } = useUnreadBadges();
  const visibleMenus = menus.filter((m) => {
    if (m.roles) return Boolean(user && m.roles.includes(user.role));
    if (m.hideRoles && user && m.hideRoles.includes(user.role)) return false;
    return true;
  });

  // Role staff tidak boleh menyisakan panel kontribusi/tukar poin terbuka (mis. flag sessionStorage lama)
  useEffect(() => {
    if (user && STAFF.includes(user.role as (typeof STAFF)[number])) {
      closePanel();
      closeTukar();
    }
  }, [user, closePanel, closeTukar]);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[1000] flex items-stretch border-t border-neutral-200 bg-neutral-0 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Navigasi utama"
    >
      {/* Belum selesai cek auth (kemungkinan login) → skeleton; pengunjung publik langsung menu tamu */}
      {showSkeleton ? (
        <div className="flex w-full items-center justify-center gap-3 px-4 py-3" aria-hidden="true">
          <div className="h-8 w-16 animate-pulse rounded-lg bg-neutral-100" />
          <div className="h-8 w-16 animate-pulse rounded-lg bg-neutral-100" />
        </div>
      ) : (
      visibleMenus.map(({ href, label, icon: Icon, action }) => {
        const active = action === "panel" ? panelOpen : action === "tukarpoin" ? tukarOpen : (action === "navigate" && !panelOpen && !tukarOpen && (activePath === href || activePath.startsWith(href + "/")));

        if (action === "panel") {
          return (
            <button
              key={href}
              type="button"
              onClick={() => {
                closeTukar();
                if (activePath !== "/peta") {
                  if (!requestLeave("/peta", openPanel)) return;
                  openPanel();
                  router.push("/peta");
                  return;
                }
                togglePanel();
              }}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
                active ? "text-primary-800" : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              <Icon className={`size-6 ${active ? "text-primary-800" : "text-neutral-400"}`} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
              <span>{label}</span>
              {active && <span className="mt-0.5 h-0.5 w-5 rounded-full bg-primary-800" aria-hidden="true" />}
            </button>
          );
        }

        if (action === "tukarpoin") {
          return (
            <button
              key={href}
              type="button"
              onClick={() => {
                closePanel();
                if (activePath !== "/peta") {
                  if (!requestLeave("/peta", openTukar)) return;
                  openTukar();
                  router.push("/peta");
                  return;
                }
                toggleTukar();
              }}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${active ? "text-primary-800" : "text-neutral-500 hover:text-neutral-700"}`}
            >
              <Icon className={`size-6 ${active ? "text-primary-800" : "text-neutral-400"}`} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
              <span>{label}</span>
              {active && <span className="mt-0.5 h-0.5 w-5 rounded-full bg-primary-800" aria-hidden="true" />}
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
              // Buka tab → notifikasi tipe tsb ditandai sudah dibaca (badge hilang).
              markPathRead(href);
            }}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${active ? "text-primary-800" : "text-neutral-500 hover:text-neutral-700"}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="relative">
              <Icon className={`size-6 ${active ? "text-primary-800" : "text-neutral-400"}`} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
              {badgeFor(href) > 0 && (
                <span className="absolute -right-1.5 -top-1 flex min-w-4 items-center justify-center rounded-full bg-danger-600 px-1 text-[10px] font-bold leading-4 text-neutral-0" aria-label={`${badgeFor(href)} notifikasi belum dibaca`}>
                  {badgeFor(href) > 99 ? "99+" : badgeFor(href)}
                </span>
              )}
            </span>
            <span>{label}</span>
            {active && <span className="mt-0.5 h-0.5 w-5 rounded-full bg-primary-800" aria-hidden="true" />}
          </Link>
        );
        })
      )}
    </nav>
  );
}
