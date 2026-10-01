"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { TicketListResponse } from "@/features/dashboard/dashboardTypes";
import { useAuthStore } from "@/features/auth/authStore";
import { useRouter } from "next/navigation";
import { useKontribusiPanel } from "@/lib/kontribusiPanelStore";
import { useTukarPoinPanel } from "@/lib/tukarPoinPanelStore";

async function fetchPoints(): Promise<{ balance: number }> {
  const res = await apiClient.get<{ data: { balance: number } }>("/me/points");
  return res.data.data;
}

/** Kartu profil + poin di bawah topbar panel. */
const PoinCard = ({ name, username, avatarUrl }: { name: string; username?: string; avatarUrl?: string | null }) => {
  const openTukar = useTukarPoinPanel((s) => s.openPanel);
  const closeKontribusi = useKontribusiPanel((s) => s.closePanel);
  const pointsQuery = useQuery({ queryKey: ["me-points"], queryFn: fetchPoints, staleTime: 30_000 });
  return (
    <div className="rounded-b-xl bg-neural-0 border-b border-neutral-200 px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-50 text-base font-bold text-primary-800" aria-hidden="true">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="size-11 object-cover" />
          ) : (
            name.charAt(0).toUpperCase()
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-900">{name}</p>
          {username && <p className="truncate text-xs text-neutral-500">@{username}</p>}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-primary-50 px-4 py-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">Poin</p>
          <p className="text-xl font-bold text-primary-800">{pointsQuery.isLoading ? "…" : pointsQuery.data?.balance ?? 0}</p>
        </div>
        <Button className="px-4 py-2 text-xs" onClick={() => { closeKontribusi(); openTukar(); }}>
          Tukar Poin
        </Button>
      </div>

    </div>
  );
};

function GuestGate({ onLogin }: { onLogin: () => void }) {
  return (
    <section className="flex min-h-[40vh] flex-col items-center justify-center text-center">
      <div className="mb-5 flex size-36 items-center justify-center rounded-full bg-primary-50" aria-hidden="true">
        <svg viewBox="0 0 200 160" className="size-28 text-primary-700" fill="none">
          <path d="M35 126h130M58 126V76h84v50M72 76V48h56v28M86 48V28h28v20" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="48" cy="116" r="12" fill="currentColor" opacity=".2" />
          <circle cx="152" cy="116" r="12" fill="currentColor" opacity=".2" />
        </svg>
      </div>
      <h3 className="max-w-xs text-xl font-bold text-neutral-900">Raih Poin Kontribusi Anda</h3>
      <p className="mt-2 max-w-xs text-sm leading-6 text-neutral-500">
        Masuk untuk melaporkan jalanan berlubang, lampu mati, dan yang lainnya
      </p>
      <Button className="mt-5 px-6" onClick={onLogin}>Masuk untuk Berkontribusi</Button>
    </section>
  );
}

function EmptyReportState() {
  return (
    <section className="flex flex-col items-center justify-center py-8 text-center">
      <div className="mb-4 flex size-32 items-center justify-center rounded-full bg-primary-50" aria-hidden="true">
        <svg viewBox="0 0 200 160" className="size-24 text-primary-700" fill="none">
          <path d="M35 126h130M58 126V76h84v50M72 76V48h56v28M86 48V28h28v20" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="48" cy="116" r="12" fill="currentColor" opacity=".2" />
          <circle cx="152" cy="116" r="12" fill="currentColor" opacity=".2" />
        </svg>
      </div>
      <h3 className="max-w-xs text-lg font-bold text-neutral-900">Laporkan Kerusakan</h3>
      <p className="mt-1 max-w-xs text-sm text-neutral-500">Dapatkan poin untuk ditukarkan</p>
      <Link href="/report">
        <Button className="mt-4 px-6"><Camera className="mr-2 inline size-4" />Lapor Sekarang</Button>
      </Link>
    </section>
  );
}

export function KontribusiPanel() {
  const user = useAuthStore((state) => state.user);
  const initialized = useAuthStore((state) => state.initialized);
  const router = useRouter();
  const openLogin = () => router.push("/login");
  const close = useKontribusiPanel((s) => s.closePanel);
  const panelOpen = useKontribusiPanel((s) => s.open);
  const half = useKontribusiPanel((s) => s.half);
  const setHalf = useKontribusiPanel((s) => s.setHalf);
  // Menu Kontribusi disembunyikan untuk role ini (lihat SidebarNav.hideRoles) — panel juga harus hilang.
  const isStaffRole = !!user && ["admin", "super_admin", "field_team"].includes(user.role);
  const canViewTickets = user?.role === "admin" || user?.role === "super_admin";
  const { data } = useQuery({
    queryKey: ["my-reports"],
    queryFn: async () => {
      const res = await apiClient.get<TicketListResponse>("/tickets", {
        params: { per_page: 50, sort: "created_at", direction: "desc" },
      });
      return res.data;
    },
    // Endpoint /tickets hanya untuk admin/super_admin — citizen tidak memanggil (hindari 403)
    enabled: canViewTickets,
  });

  const tickets = data?.data ?? [];

  /* ── mobile: drag handle → full ⇄ half ⇄ tutup ── */
  const touchStartY = useRef(0);
  const touchDeltaY = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const swipingRef = useRef(false);
  const [swiping, setSwiping] = useState(false);

  const halfOffsetPx = () => Math.round(window.innerHeight * 0.4); // sisakan ±45vh terlihat

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // Hanya mulai drag dari zona header (handle + topbar), biar scroll konten tetap normal.
    if (!(e.target as HTMLElement).closest("[data-drag-zone]")) {
      swipingRef.current = false;
      return;
    }
    touchStartY.current = e.touches[0].clientY;
    touchDeltaY.current = 0;
    swipingRef.current = true;
    setSwiping(true);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipingRef.current) return;
    const base = half ? halfOffsetPx() : 0;
    const next = Math.max(0, base + (e.touches[0].clientY - touchStartY.current));
    touchDeltaY.current = e.touches[0].clientY - touchStartY.current;
    panelRef.current?.style.setProperty("transition", "none");
    panelRef.current?.style.setProperty("transform", `translateY(${next}px)`);
  }, [half]);

  const onTouchEnd = useCallback(() => {
    if (!swipingRef.current) return;
    swipingRef.current = false;
    setSwiping(false);
    panelRef.current?.style.removeProperty("transition");
    panelRef.current?.style.removeProperty("transform");

    const delta = touchDeltaY.current;
    if (half) {
      if (delta > 100) close(); // dari half → tarik turun = tutup
      else if (delta < -100) setHalf(false); // dari half → tarik naik = full
    } else if (delta > 150) {
      setHalf(true); // dari full → tarik turun setengah = peek
    }
  }, [half, close, setHalf]);

  // Tutup panel otomatis saat user berubah jadi admin/super_admin/field_team (mis. baru login).
  useEffect(() => {
    if (isStaffRole && panelOpen) close();
  }, [isStaffRole, panelOpen, close]);

  // Selama hydration /me belum selesai → jangan render apa pun (hindari kedipan guest → user).
  if (!initialized || isStaffRole) return null;

  return (
    <>
      {/* ── Desktop: slide dari kiri, muncul setelah sidebar ── */}
      <div
        className="hidden md:block fixed inset-y-0 left-0 z-[1000] w-96 border-r border-neutral-200 bg-neutral-0 shadow-2xl transition-transform duration-300 ease-out"
        style={{ transform: panelOpen ? "translateX(240px)" : "translateX(-100%)" }}
      >
        <div className="flex h-full flex-col">
          {/* Topbar */}
          <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Kontribusi</h2>
              <p className="text-xs text-neutral-500">Laporan dan aktivitas Anda</p>
            </div>
            <div className="relative z-10 flex items-center gap-2">
              {user && (
                <Button className="px-3 py-2 text-xs" onClick={() => { close(); router.push("/report"); }}>
                  <Camera className="mr-1.5 inline size-3.5" />
                  Lapor
                </Button>
              )}
              <button type="button" onClick={close} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100" aria-label="Tutup">
                <X className="size-5" />
              </button>
            </div>
          </div>

          {user && <PoinCard name={user.name} username={user.username} avatarUrl={user.avatarUrl} />}

          {/* Konten */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {!user ? (
              <GuestGate onLogin={openLogin} />
            ) : (
              <section>
                {tickets.length > 0 ? (
                  <ul className="space-y-2">
                    {tickets.map((t) => (
                      <li key={t.id}>
                        <Link href={`/tickets/${t.id}`} onClick={close} className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-0 p-3 transition hover:border-primary-200 hover:shadow-sm">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-neutral-500">{t.ticketNumber}</p>
                            <p className="mt-0.5 truncate text-sm font-semibold text-neutral-900">
                              {t.category === "pothole" ? "Jalan berlubang" : t.category === "street_light" ? "PJU mati" : "Lainnya"}
                            </p>
                          </div>
                          <Badge variant={t.priorityLabel === "urgent" ? "urgent" : t.priorityLabel === "waiting" ? "waiting" : "done"} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyReportState />
                )}
              </section>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile: sheet flush ke layar, rounded atas, full ⇄ peek setengah ⇄ tutup ── */}
      <div
        ref={panelRef}
        className="md:hidden fixed inset-x-0 bottom-0 z-[1000] flex h-[85vh] flex-col rounded-t-3xl bg-neutral-0 shadow-2xl transition-transform duration-300 ease-out"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: !panelOpen
            ? "translateY(100%)"
            : half
              ? "translateY(40vh)" // peek setengah — sisakan ±45vh terlihat
              : "translateY(0)",
          touchAction: swiping ? "none" : "auto",
        }}
      >
        {/* Drag zone: handle + topbar */}
        <div data-drag-zone className="shrink-0">
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full bg-neutral-300" />
          </div>
          <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Kontribusi</h2>
              <p className="text-xs text-neutral-500">Laporan dan aktivitas Anda</p>
            </div>
            {user && (
              <Button className="px-3 py-2 text-xs" onClick={() => { close(); router.push("/report"); }}>
                <Camera className="mr-1.5 inline size-3.5" />
                Lapor
              </Button>
            )}
          </div>
        </div>

        {user && <PoinCard name={user.name} username={user.username} avatarUrl={user.avatarUrl} />}

        {/* Konten — scroll di dalam sheet */}
        <div className="flex-1 overflow-y-auto px-4 pb-24">
          {!user ? (
            <GuestGate onLogin={openLogin} />
          ) : (
            <section>
              {tickets.length > 0 ? (
                <ul className="space-y-2">
                  {tickets.map((t) => (
                    <li key={t.id}>
                      <Link href={`/tickets/${t.id}`} onClick={close} className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-0 p-3 transition hover:border-primary-200 hover:shadow-sm">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-neutral-500">{t.ticketNumber}</p>
                          <p className="mt-0.5 truncate text-sm font-semibold text-neutral-900">
                            {t.category === "pothole" ? "Jalan berlubang" : t.category === "street_light" ? "PJU mati" : "Lainnya"}
                          </p>
                        </div>
                        <Badge variant={t.priorityLabel === "urgent" ? "urgent" : t.priorityLabel === "waiting" ? "waiting" : "done"} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyReportState />
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
