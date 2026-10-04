"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Camera, Gift, Check, Coins, ListOrdered, ShieldQuestion, Wrench, X } from "lucide-react";
import { FaCamera, FaCoins, FaGift, FaPaperPlane, FaMagnifyingGlassLocation } from "react-icons/fa6";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { categoryMeta } from "@/lib/categoryMeta";
import type { Ticket, TicketListResponse } from "@/features/dashboard/dashboardTypes";
import { useAuthStore } from "@/features/auth/authStore";
import { useRouter } from "next/navigation";
import { useKontribusiPanel } from "@/lib/kontribusiPanelStore";
import { useTukarPoinPanel } from "@/lib/tukarPoinPanelStore";

async function fetchPoints(): Promise<{ balance: number }> {
  const res = await apiClient.get<{ data: { balance: number } }>("/me/points");
  return res.data.data;
}

type PoinData = { balance: number; loading: boolean; onTukar: () => void };
type Profil = { name: string; username?: string; avatarUrl?: string | null };

/** Kartu profil + poin */
function ProfilCard({ profil, points, solidCard, className = "" }: {
  profil: Profil;
  points: PoinData;
  solidCard: boolean;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-4 ${solidCard ? "border border-neutral-200 bg-neutral-0 shadow-xl" : "border border-accent-500/40 bg-neutral-0/10 shadow-[0_8px_24px_rgba(0,0,0,0.25)] backdrop-blur-sm"} ${className}`}>
      {solidCard && <div className="absolute -right-6 -top-6 size-24 rounded-full bg-accent-100" aria-hidden="true" />}
      <div className="relative flex items-center gap-3">
        <span className={`flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full text-lg font-bold ${solidCard ? "bg-primary-800 text-neutral-0" : "border-2 border-accent-500/60 bg-neutral-0/15 text-neutral-0"}`} aria-hidden="true">
          {profil.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profil.avatarUrl} alt="" className="size-12 object-cover" />
          ) : (
            profil.name.charAt(0).toUpperCase()
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-base font-bold ${solidCard ? "text-neutral-900" : "text-neutral-0"}`}>{profil.name}</p>
          {profil.username && <p className={`truncate text-xs ${solidCard ? "text-neutral-500" : "text-primary-100/80"}`}>@{profil.username}</p>}
        </div>
        <p className="shrink-0 text-right">
          <span className="flex items-baseline justify-end gap-1">
            <FaCoins className={`size-5 ${solidCard ? "text-accent-600" : "text-accent-500"}`} aria-hidden="true" />
            <span className={`text-3xl font-extrabold leading-none ${solidCard ? "text-primary-700" : "text-primary-500"}`}>{points.loading ? "…" : points.balance}</span>
          </span>
          <span className={`block text-[11px] font-semibold ${solidCard ? "text-neutral-500" : "text-primary-100/80"}`}>Total Poin</span>
        </p>
      </div>
      <button
        type="button"
        onClick={points.onTukar}
        className={`relative mt-4 flex w-full items-center justify-center gap-1.5 rounded-2xl py-3 text-sm font-bold shadow-md transition hover:-translate-y-0.5 ${solidCard ? "bg-primary-800 text-neutral-0 hover:bg-primary-800" : "bg-neutral-0 text-primary-800 hover:bg-primary-50"}`}
      >
        <FaGift className="size-4 text-accent-500" fill="currentColor" aria-hidden="true" />
        Tukar poin
      </button>
    </div>
  );
}

function KontribusiHeader({ onClose, profil, points, onReport, solidCard = false }: {
  onClose?: () => void;
  profil?: Profil;
  points?: PoinData;
  onReport?: () => void;
  solidCard?: boolean;
}) {
  const hasCard = Boolean(profil && points);

  return (
    <div className="relative shrink-0">
      {/* Kotak gradasi — mobile: lengkung di BAWAH */}
      <div
        className={`relative overflow-hidden px-5 text-neutral-0 ${
          solidCard
            ? "rounded-b-[32px] bg-[linear-gradient(160deg,#0a2136_0%,#123a5c_100%)] pb-[74px] pt-[22px]"
            : "bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 py-4"
        }`}
      >
        {solidCard ? (
          <div className="absolute -right-[60px] -top-[70px] size-[200px] rounded-full bg-[#1abc9c]/[0.18]" aria-hidden="true" />
        ) : (
          <>
            <div className="absolute -right-10 -top-12 size-44 rounded-full bg-accent-600/25" aria-hidden="true" />
            <div className="absolute -right-1 top-16 size-16 rounded-full bg-accent-500/15" aria-hidden="true" />
            <div className="absolute -bottom-12 -left-8 size-32 rounded-full bg-primary-600/40 blur-lg" aria-hidden="true" />
          </>
        )}

        {/* Baris judul */}
        <div className="relative flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className={`font-extrabold tracking-tight text-neutral-0 ${solidCard ? "text-3xl" : "text-2xl"}`}>
              Kontribusi
            </h2>
            <p className="mt-0.5 text-xs text-primary-100/80">Laporan dan aktivitas Anda</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onReport && (
              <button
                type="button"
                onClick={onReport}
                className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-bold transition hover:-translate-y-0.5 ${
                  solidCard
                    ? "bg-[#1abc9c] text-[#0a2136] shadow-[0_0_24px_4px_rgba(26,188,156,0.45)] hover:bg-[#22cfad]"
                    : "bg-neutral-0/10 text-neutral-0 shadow-md hover:bg-neutral-0/20"
                }`}
              >
                <FaCamera className="size-4" aria-hidden="true" fill="currentColor" />
                Lapor
              </button>
            )}
            {onClose && (
              <button type="button" onClick={onClose} className="rounded-full border border-neutral-0/20 bg-neutral-0/10 p-2 text-primary-100 transition hover:bg-neutral-0/20" aria-label="Tutup">
                <X className="size-5" />
              </button>
            )}
          </div>
        </div>

        {/* Desktop: kartu tetap di dalam gradasi */}
        {!solidCard && hasCard && <ProfilCard profil={profil!} points={points!} solidCard={false} className="mt-4" />}
      </div>

      {/* Mobile: kartu di LUAR gradasi, menimpa tepi bawah */}
      {solidCard && hasCard && (
        <div className="relative z-10 -mt-12 px-4">
          <ProfilCard profil={profil!} points={points!} solidCard />
        </div>
      )}
    </div>
  );
}

/** Badge riwayat ikut STATUS kanonik — selalu sinkron dgn halaman detail (bukan priorityLabel). */
function reportBadge(t: Pick<Ticket, "status">): "done" | "rejected" | "cancelled" | "reported" | "verified" | "queued" | "in_progress" | "citizen_review" {
  if (t.status === "completed") return "done";
  if (t.status === "rejected") return "rejected";
  if (t.status === "cancelled") return "cancelled";
  if (t.status === "verified") return "verified";
  if (t.status === "queued") return "queued";
  if (t.status === "in_progress") return "in_progress";
  if (t.status === "needs_review") return "citizen_review";
  return "reported";
}

const LANGKAH = [
  { icon: FaCamera, label: "Foto kerusakan" },
  { icon: FaPaperPlane, label: "Kirim laporan" },
  { icon: FaMagnifyingGlassLocation, label: "Tim meninjau" },
  { icon: FaCoins, label: "Dapat poin" },
] as const;

const STATUS_FILTERS = [
  { id: "all", label: "Semua", icon: ListOrdered },
  { id: "in_progress", label: "Dalam perbaikan", icon: Wrench },
  { id: "needs_review", label: "Dalam tinjauan", icon: ShieldQuestion },
  { id: "queued", label: "Antrean", icon: ListOrdered },
  { id: "completed", label: "Selesai", icon: Check },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["id"];

/** Baris status ticket — warna per status, dengan aksi singkat di kanan. */
function statusStrip(t: Ticket): { text: string; className: string; action?: string } {
  switch (t.status) {
    case "needs_review":
      return { text: "Tim sedang menilai laporan Anda", className: "bg-info-600", action: "Detail" };
    case "rejected":
      return { text: "Laporan tidak memenuhi syarat", className: "bg-neutral-400", action: "Lihat alasan" };
    case "in_progress":
      return { text: t.reviewStatus === "submitted" ? "Bukti telah dikirim, menunggu verifikasi" : "Tim sedang memperbaiki di lokasi", className: "bg-warning-600", action: "Detail" };
    case "queued":
      return { text: "Menunggu verifikasi petugas", className: "bg-warning-600", action: "Detail" };
    case "completed":
      return { text: "Perbaikan telah selesai", className: "bg-success-600", action: "Lihat bukti" };
    case "cancelled":
      return { text: "Laporan telah dibatalkan", className: "bg-neutral-400", action: "Lihat alasan" };
    default:
      return { text: "Laporan diterima, menunggu diproses", className: "bg-info-600", action: "Detail" };
  }
}

/** Kartu riwayat laporan — ikon kategori + nomor/tanggal + badge status. */
function ReportRow({ t, onOpen }: { t: Ticket; onOpen: () => void }) {
  const meta = categoryMeta(t.category);
  const Icon = meta.icon;
  const strip = statusStrip(t);
  return (
    <Link href={`/tickets/${t.id}`} onClick={onOpen} className="group block overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-0 shadow-sm transition hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-md">
      <div className="flex items-center gap-3 p-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700 transition group-hover:bg-primary-800 group-hover:text-neutral-0" aria-hidden="true">
          <Icon className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-bold text-neutral-900">{meta.label}</span>
          <span className="mt-0.5 block truncate text-xs text-neutral-500">
            {t.ticketNumber} · {new Date(t.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </span>
        <Badge variant={reportBadge(t)} />
      </div>
      <div className={`flex items-center justify-between gap-3 px-4 py-2 text-xs font-semibold text-neutral-0 ${strip.className}`}>
        <span className="min-w-0 truncate">{strip.text}</span>
        {strip.action && <span className="shrink-0">{strip.action} ›</span>}
      </div>
    </Link>
  );
}

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
    <section className="flex flex-col items-center py-6 text-center">
      <div className="relative mb-5 flex size-28 items-center justify-center rounded-full bg-primary-50" aria-hidden="true">
        <div className="absolute inset-3 rounded-full bg-[#1abc9c]/15" />
        <FaCamera className="relative size-10 text-primary-800" />
      </div>

      <h3 className="text-lg font-extrabold text-neutral-900">Belum ada laporan</h3>
      <p className="mt-1 max-w-[16rem] text-sm leading-6 text-neutral-500">
        Temukan jalan rusak atau lampu mati? Laporkan dan kumpulkan poin untuk ditukar.
      </p>

      <Link
        href="/report"
        className="mt-5 flex items-center gap-2 rounded-full bg-primary-800 px-6 py-3 text-sm font-bold text-neutral-0 shadow-md transition hover:-translate-y-0.5 hover:bg-primary-700"
      >
        <FaCamera className="mr-2 inline size-4" aria-hidden="true" />
        Lapor Sekarang
      </Link>

      {/* Alur singkat */}
      <ol className="mt-8 grid w-full grid-cols-4 gap-2">
        {LANGKAH.map(({ icon: Icon, label }, i) => (
          <li key={label} className="flex flex-col items-center gap-2">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-neutral-0 text-primary-700 shadow-sm ring-1 ring-neutral-200">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span className="text-[11px] font-semibold leading-tight text-neutral-500">{label}</span>
          </li>
        ))}
      </ol>
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
  // Menu Kontribusi disembunyikan untuk role ini (lihat SidebarNav.hideRoles) — panel juga harus hilang.
  const isStaffRole = !!user && ["admin", "super_admin", "field_team"].includes(user.role);
  const openTukar = useTukarPoinPanel((s) => s.openPanel);
  const pointsQuery = useQuery({
    queryKey: ["me-points"],
    queryFn: fetchPoints,
    staleTime: 30_000,
    enabled: Boolean(user),
  });
  const balance = pointsQuery.data?.balance ?? 0;
  const { data } = useQuery({
    queryKey: ["my-reports"],
    queryFn: async () => {
      const res = await apiClient.get<TicketListResponse>("/me/reports", {
        params: { per_page: 50 },
      });
      return res.data;
    },
    // Riwayat laporan milik sendiri — endpoint publik utk semua role login.
    enabled: Boolean(user),
  });

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const tickets = data?.data ?? [];
  const filteredTickets = statusFilter === "all" ? tickets : tickets.filter((t) => t.status === statusFilter);

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
          <KontribusiHeader
            onClose={close}
            onReport={user ? () => { close(); router.push("/report"); } : undefined}
            profil={user ? { name: user.name, username: user.username, avatarUrl: user.avatarUrl } : undefined}
            points={user ? { balance, loading: pointsQuery.isLoading, onTukar: () => { close(); openTukar(); } } : undefined}
          />

          {/* Konten */}
          <div className="flex-1 overflow-y-auto bg-neutral-50 px-5 py-4">
            {!user ? (
              <GuestGate onLogin={openLogin} />
            ) : (
              <section>
                {tickets.length > 0 ? (
                  <ul className="space-y-2">
                    {tickets.map((t) => (
                      <li key={t.id}>
                        <ReportRow t={t} onOpen={close} />
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

      {/* ── Mobile: full-screen (sama spt Tukar Poin) — tanpa drag/peek ── */}
      <div
        className="md:hidden fixed inset-0 z-[1000] flex flex-col bg-neutral-0 shadow-2xl transition-transform duration-300 ease-out"
        style={{ transform: panelOpen ? "translateY(0)" : "translateY(100%)" }}
      >
        <KontribusiHeader
          solidCard
          onReport={user ? () => { close(); router.push("/report"); } : undefined}
          profil={user ? { name: user.name, username: user.username, avatarUrl: user.avatarUrl } : undefined}
          points={user ? { balance, loading: pointsQuery.isLoading, onTukar: () => { close(); openTukar(); } } : undefined}
        />

        {/* Konten — scroll di dalam layar penuh */}
        <div className="flex-1 overflow-y-auto bg-neutral-50 px-4 pb-28 pt-4">
          {!user ? (
            <GuestGate onLogin={openLogin} />
          ) : (
            <section>
            {tickets.length > 0 && (
              <div className="scrollbar-hide -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filter status laporan">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setStatusFilter(f.id)}
                    aria-pressed={statusFilter === f.id}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition ${statusFilter === f.id ? "bg-accent-500 text-neutral-0 shadow-sm" : "border border-neutral-200 bg-neutral-0 text-neutral-600"}`}
                  >
                    {(() => { const Icon = f.icon; return <Icon className="size-3.5" aria-hidden="true" />; })()}
                    {f.label}
                  </button>
                  ))}
              </div>
              )}
              {filteredTickets.length > 0 ? (
                <ul className="space-y-3">
                  {filteredTickets.map((t) => (
                    <li key={t.id}>
                      <ReportRow t={t} onOpen={close} />
                    </li>
                  ))}
                </ul>
              ) : tickets.length > 0 ? (
                <p className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-0 px-4 py-10 text-center text-sm text-neutral-500">
                  Tidak ada laporan dengan status ini.
                </p>
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
