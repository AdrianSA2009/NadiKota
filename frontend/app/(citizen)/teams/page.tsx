"use client";

import { useMemo, useRef, useState, type ComponentProps } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, ImagePlus, ListFilter, Loader2, MapPin, MoreVertical, Navigation, Play, Plus, Search, Ticket, TriangleAlert, Users } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { RequireRole } from "@/components/auth/RequireRole";
import { useAuthStore } from "@/features/auth/authStore";
import { Badge } from "@/components/ui/Badge";
import { TeamStatusPill } from "@/components/team/TeamStatusPill";
import { TeamFormModal } from "@/components/team/TeamFormModal";
import { useToastStore } from "@/lib/toastStore";
import { useIsMobile } from "@/hooks/useIsMobile";
import { activateTeam, completeTicket, deactivateTeam, startTicket } from "@/features/dashboard/dashboardApi";
import { formatCategory } from "@/lib/formatters";
import type { Team, TicketListResponse } from "@/features/dashboard/dashboardTypes";

const ALLOWED = ["admin", "super_admin", "field_team"] as const;

type BadgeVariant = ComponentProps<typeof Badge>["variant"];
/** Badge tugas tim memakai STATUS — bukti terkirim (review submitted) dibaca "Dalam Penilaian". */
const statusBadge = (s: string, reviewStatus?: string | null): BadgeVariant =>
  s === "in_progress" && reviewStatus === "submitted"
    ? "assessing"
    : s === "queued"
      ? "waiting"
      : s === "completed"
        ? "done"
        : s === "rejected"
          ? "urgent"
          : s === "cancelled"
            ? "cancelled"
            : (s as BadgeVariant);

export default function TeamsPage() {
  return (
    <RequireRole roles={ALLOWED}>
      <TeamsContent />
    </RequireRole>
  );
}

function TeamsContent() {
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === "admin" || role === "super_admin";
  const router = useRouter();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  const [formTeam, setFormTeam] = useState<"create" | Team | null>(null);
  const [detailTeam, setDetailTeam] = useState<Team | null>(null);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [confirmTeam, setConfirmTeam] = useState<Team | null>(null);
  // Tugas tim (role field_team): akordeon + kirim bukti hasil perbaikan.
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
  const [taskPhoto, setTaskPhoto] = useState<File | null>(null);
  const taskFileRef = useRef<HTMLInputElement>(null);

  const toggleActive = useMutation({
    mutationFn: (t: Team) => (t.isActive ? deactivateTeam(t.id) : activateTeam(t.id)),
    onSuccess: (t) => {
      showToast(t.isActive ? "Tim diaktifkan." : "Tim dinonaktifkan.", "success");
      setConfirmTeam(null);
      void queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
    onError: (e) => {
      setConfirmTeam(null);
      showToast(e instanceof Error ? e.message : "Gagal mengubah status tim.", "info");
    },
  });

  const submitProof = useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => completeTicket(id, file),
    onSuccess: () => {
      showToast("Bukti terkirim — menunggu verifikasi admin.", "success");
      setTaskPhoto(null);
      setOpenTaskId(null);
      void queryClient.invalidateQueries({ queryKey: ["field-tickets"] });
      void queryClient.invalidateQueries({ queryKey: ["tickets-map"] });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : "Gagal mengirim bukti.", "info"),
  });

  const startTask = useMutation({
    mutationFn: (id: number) => startTicket(id),
    onSuccess: (d) => {
      showToast(d.message, "success");
      void queryClient.invalidateQueries({ queryKey: ["field-tickets"] });
      // Peta: status tiket berubah (dalam perbaikan) — segarkan.
      void queryClient.invalidateQueries({ queryKey: ["tickets-map"] });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : "Gagal memulai tiket.", "info"),
  });

  const openCreate = () => {
    if (isMobile) router.push("/tim/baru");
    else setFormTeam("create");
  };
  const openEdit = (team: Team) => {
    setMenuId(null);
    if (isMobile) router.push(`/tim/${team.id}/edit`);
    else setFormTeam(team);
  };

  // Admin/Super Admin → daftar tim
  const teamsQuery = useQuery({
    queryKey: ["teams"],
    queryFn: async () => (await apiClient.get<{ data: Team[] }>("/teams")).data.data,
    enabled: isAdmin,
  });

  // Toolbar desktop (filter dikerjakan di klien karena data tim sudah lengkap).
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "tersedia" | "bertugas" | "nonaktif">("all");
  const [sort, setSort] = useState<"name" | "active" | "newest">("name");
  // Mobile: filter & urutan disembunyikan di balik tombol (konsisten dgn halaman Dispatch).
  const [filterOpen, setFilterOpen] = useState(false);

  const resetFilters = () => {
    setQ("");
    setStatusFilter("all");
  };

  const teams = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = teamsQuery.data ?? [];
    if (needle) {
      list = list.filter((t) =>
        [t.name, t.district ?? "", t.leader?.name ?? "", t.leader?.username ?? ""].join(" ").toLowerCase().includes(needle),
      );
    }
    if (statusFilter !== "all") list = list.filter((t) => t.status === statusFilter);
    const sorted = [...list];
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "active") sorted.sort((a, b) => b.activeTicketCount - a.activeTicketCount);
    if (sort === "newest") sorted.sort((a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""));
    return sorted;
  }, [teamsQuery.data, q, statusFilter, sort]);

  // Field team → tugas saya
  const tasksQuery = useQuery({
    queryKey: ["field-tickets"],
    queryFn: async () => (await apiClient.get<TicketListResponse>("/field/tickets")).data,
    enabled: role === "field_team",
  });

  const isField = role === "field_team";

  return (
    <div className="flex-1 min-w-0 overflow-y-auto pb-24 md:pb-6">
      {/* Lebar penuh di samping sidebar; max longgar hanya untuk layar ultra-wide */}
      <div className="mx-auto w-full max-w-[1720px] px-4 py-6 sm:px-6 xl:px-8">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium text-primary-700">
              <Users className="size-5" aria-hidden="true" />
              Tim Lapangan
            </p>
            <h1 className="mt-1 text-2xl font-bold text-neutral-900">
              {isField ? "Tugas saya" : "Daftar tim"}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {isField ? "Tiket yang sedang ditugaskan kepada tim Anda." : "Kelola tim, penanggung jawab, dan status penugasan."}
            </p>
          </div>

          {isAdmin && (
            <>
              {/* Toolbar desktop — gaya konsisten dgn filter halaman Dispatch */}
              <div className="hidden flex-wrap items-center gap-2 md:flex">
                <label className="relative">
                  <span className="sr-only">Cari tim</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Cari nama / lokasi / PJ…"
                    className="min-h-11 w-52 rounded-lg border border-neutral-300 bg-neutral-0 pl-9 pr-3 text-base font-normal text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 lg:w-64"
                  />
                </label>
                <select
                  aria-label="Filter status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                  className="min-h-11 rounded-lg border border-neutral-300 bg-neutral-0 px-3 text-base font-normal text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                >
                  <option value="all">Semua status</option>
                  <option value="tersedia">Tersedia</option>
                  <option value="bertugas">Bertugas</option>
                  <option value="nonaktif">Nonaktif</option>
                </select>
                <select
                  aria-label="Urutkan"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as typeof sort)}
                  className="min-h-11 rounded-lg border border-neutral-300 bg-neutral-0 px-3 text-base font-normal text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                >
                  <option value="name">Nama (A–Z)</option>
                  <option value="active">Tiket aktif terbanyak</option>
                  <option value="newest">Terbaru</option>
                </select>
                <Button type="button" onClick={openCreate}>
                  <Plus className="mr-1.5 inline size-4" aria-hidden="true" />
                  Tambah Tim
                </Button>
              </div>
              {/* Tombol tambah versi mobile — tampilan mobile tidak diubah */}
              <Button type="button" className="w-full justify-center md:hidden" onClick={openCreate}>
                <Plus className="mr-1.5 inline size-4" aria-hidden="true" />
                Tambah Tim
              </Button>
            </>
          )}
        </header>

        {/* Mobile admin — filter & urutan di balik tombol (konsisten dgn halaman Dispatch) */}
        {isAdmin && (
          <div className="mt-5 md:hidden">
            <Button type="button" variant="secondary" className="w-full justify-center" aria-expanded={filterOpen} onClick={() => setFilterOpen((v) => !v)}>
              <ListFilter className="mr-2 inline size-4" aria-hidden="true" />
              Filter & urutan
            </Button>
            <Card className={`${filterOpen ? "block" : "hidden"} mt-3`}>
              <div className="grid gap-3">
                <label className="text-sm font-medium text-neutral-900">
                  Cari
                  <div className="relative mt-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Cari nama / lokasi / PJ…"
                      className="min-h-11 w-full rounded-lg border border-neutral-300 bg-neutral-0 pl-9 pr-3 text-base font-normal text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                    />
                  </div>
                </label>
                <label className="text-sm font-medium text-neutral-900">
                  Status
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                    className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 bg-neutral-0 px-3 text-base font-normal text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                  >
                    <option value="all">Semua status</option>
                    <option value="tersedia">Tersedia</option>
                    <option value="bertugas">Bertugas</option>
                    <option value="nonaktif">Nonaktif</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-neutral-900">
                  Urutkan
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as typeof sort)}
                    className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 bg-neutral-0 px-3 text-base font-normal text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                  >
                    <option value="name">Nama (A–Z)</option>
                    <option value="active">Tiket aktif terbanyak</option>
                    <option value="newest">Terbaru</option>
                  </select>
                </label>
              </div>
            </Card>
          </div>
        )}

        {isField ? (
          <>
            {tasksQuery.isLoading && <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>}
            {tasksQuery.isError && <Card className="border-danger-600 bg-danger-50 text-sm text-danger-700">Gagal memuat tugas.</Card>}
            {tasksQuery.data && tasksQuery.data.data.length === 0 && (
              <EmptyState title="Belum ada tugas" description="Tiket yang ditugaskan ke tim Anda akan tampil di sini." />
            )}
            {tasksQuery.data && tasksQuery.data.data.length > 0 && (
              <ul className="space-y-2">
                {tasksQuery.data.data.map((t) => (
                  <li key={t.id} className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-0">
                    <button
                      type="button"
                      aria-expanded={openTaskId === t.id}
                      onClick={() => { setOpenTaskId((v) => (v === t.id ? null : t.id)); setTaskPhoto(null); }}
                      className="flex w-full items-center gap-3 p-3 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-neutral-500">{t.ticketNumber}</p>
                        <p className="mt-0.5 truncate text-sm font-semibold text-neutral-900">{formatCategory(t.category)}</p>
                      </div>
                      <Badge variant={statusBadge(t.status, t.reviewStatus)} />
                      <ChevronDown className={`size-5 shrink-0 text-neutral-400 transition-transform ${openTaskId === t.id ? "rotate-180" : ""}`} aria-hidden="true" />
                    </button>

                    {openTaskId === t.id && (
                      <div className="space-y-3 border-t border-neutral-100 p-3">
                        <dl className="space-y-1 text-sm">
                          <div className="flex justify-between gap-2">
                            <dt className="text-neutral-500">Lokasi</dt>
                            <dd className="font-medium text-neutral-900">
                              {Number.isFinite(t.latitude) && Number.isFinite(t.longitude)
                                ? `${t.latitude.toFixed(5)}, ${t.longitude.toFixed(5)}`
                                : "tidak tersedia"}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-neutral-500">Dibuat</dt>
                            <dd className="font-medium text-neutral-900">{new Date(t.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</dd>
                          </div>
                        </dl>

                        {t.reviewStatus === "proof_rejected" && t.proofNote && (
                          <p className="rounded-lg border border-danger-600 bg-danger-50 px-3 py-2 text-xs text-danger-700">
                            <span className="font-semibold">Ditolak admin:</span> {t.proofNote} — kirim foto ulang.
                          </p>
                        )}

                        {/* Mobile: tombol tersusun rapi satu kolom penuh; desktop: sebaris */}
                        <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
                          <Button
                            type="button"
                            variant="secondary"
                            className="w-full justify-center sm:w-auto"
                            disabled={!Number.isFinite(t.latitude) || !Number.isFinite(t.longitude)}
                            onClick={() => router.push(`/peta?route=${t.latitude},${t.longitude}&label=${encodeURIComponent(`${formatCategory(t.category)} · ${t.ticketNumber}`)}`)}
                          >
                            <Navigation className="mr-1.5 inline size-4" aria-hidden="true" />
                            Buka rute ke lokasi
                          </Button>

                          {/* Tiket ditugaskan, belum dikerjakan → tombol Mulai */}
                          {t.status === "queued" && (
                            <Button
                              type="button"
                              className="w-full justify-center sm:w-auto"
                              disabled={startTask.isPending}
                              onClick={() => startTask.mutate(t.id)}
                            >
                              {startTask.isPending
                                ? <Loader2 className="mr-1.5 inline size-4 animate-spin" aria-hidden="true" />
                                : <Play className="mr-1.5 inline size-4" aria-hidden="true" />}
                              Mulai
                            </Button>
                          )}

                          {/* Sudah mulai, belum dinilai → kirim bukti */}
                          {t.status === "in_progress" && t.reviewStatus !== "submitted" && (
                            <>
                              <input ref={taskFileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => setTaskPhoto(e.target.files?.[0] ?? null)} />
                              <Button type="button" variant="secondary" className="w-full justify-center sm:w-auto" onClick={() => taskFileRef.current?.click()}>
                                <ImagePlus className="mr-1.5 inline size-4" aria-hidden="true" />
                                {taskPhoto ? (taskPhoto.name.length > 18 ? `${taskPhoto.name.slice(0, 16)}…` : taskPhoto.name) : "Pilih foto bukti"}
                              </Button>
                              <Button
                                type="button"
                                className="w-full justify-center sm:w-auto"
                                disabled={!taskPhoto || submitProof.isPending}
                                onClick={() => submitProof.mutate({ id: t.id, file: taskPhoto! })}
                              >
                                {submitProof.isPending
                                  ? <Loader2 className="mr-1.5 inline size-4 animate-spin" aria-hidden="true" />
                                  : <CheckCircle2 className="mr-1.5 inline size-4" aria-hidden="true" />}
                                Selesai
                              </Button>
                            </>
                          )}
                        </div>
                        {t.status === "queued" ? (
                          <p className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-xs text-primary-800">
                            Sudah ditugaskan ke tim Anda — tekan <strong className="font-semibold">Mulai</strong> untuk menandai sedang dikerjakan.
                          </p>
                        ) : t.reviewStatus === "submitted" ? (
                          <p className="rounded-lg border border-info-600 bg-info-50 px-3 py-2 text-xs text-info-800">
                            Bukti sudah dikirim — status <strong className="font-semibold">Dalam Penilaian</strong>, menunggu hasil penilaian admin.
                          </p>
                        ) : (
                          <p className="text-xs text-neutral-500">
                            {taskPhoto
                              ? "Foto siap — tekan Selesai untuk mengirim bukti ke admin."
                              : "Pilih foto bukti dulu, baru tombol Selesai bisa ditekan."}
                          </p>
                        )}
                        {submitProof.isError && (
                          <p role="alert" className="text-xs text-danger-700">{submitProof.error.message}</p>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            {teamsQuery.isLoading && (
              <>
                {/* Mobile — skeleton kartu */}
                <div className="mt-6 grid grid-cols-1 gap-4 md:hidden">
                  <Skeleton className="h-56 rounded-xl" />
                  <Skeleton className="h-56 rounded-xl" />
                  <Skeleton className="h-56 rounded-xl" />
                </div>
                {/* Desktop — skeleton tabel (mengikuti kolom tabel asli) */}
                <div className="mt-6 hidden overflow-hidden rounded-xl border border-neutral-200 bg-neutral-0 md:block">
                  <div className="flex gap-4 border-b border-neutral-200 bg-neutral-50 px-4 py-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="ml-auto h-4 w-24" />
                  </div>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 border-b border-neutral-100 px-4 py-3 last:border-b-0">
                      <Skeleton className="size-8 shrink-0 rounded-full" />
                      <Skeleton className="h-4 w-44" />
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-6 w-24 rounded-full" />
                      <Skeleton className="ml-auto h-8 w-44" />
                    </div>
                  ))}
                </div>
              </>
            )}
            {teamsQuery.isError && <Card className="mt-6 border-danger-600 bg-danger-50 text-sm text-danger-700">Gagal memuat tim.</Card>}

            {teamsQuery.data && teamsQuery.data.length === 0 && (
              <div className="mt-6">
                <EmptyState
                  title="Belum ada tim"
                  description="Buat tim pertama lewat tombol Tambah Tim."
                  action={<Button type="button" onClick={openCreate}><Plus className="mr-1.5 inline size-4" aria-hidden="true" />Tambah Tim</Button>}
                />
              </div>
            )}

            {teamsQuery.data && teamsQuery.data.length > 0 && teams.length === 0 && (
              <div className="mt-6">
                <EmptyState
                  title="Tidak ada tim yang cocok"
                  description="Ubah kata kunci atau filter status untuk melihat tim lainnya."
                  action={<Button type="button" variant="secondary" onClick={resetFilters}>Reset filter</Button>}
                />
              </div>
            )}

            {/* Kartu — hanya mobile; desktop selalu tabel */}
            {teams.length > 0 && (
              <div className="mt-6 grid grid-cols-1 gap-4 md:hidden">
                {teams.map((team) => (
                  <li key={team.id} className="relative min-w-0 list-none">
                    <div className={`relative h-full rounded-xl border border-neutral-200 bg-neutral-0 p-4 transition duration-200 motion-safe:hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-md ${team.status === "bertugas" ? "border-l-4 border-l-warning-600" : ""}`}>
                      {/* Seluruh kartu klikable; tombol di atasnya (z-10) tidak memicu klik ganda */}
                      <Link href={`/teams/${team.id}`} onClick={() => setMenuId(null)} aria-label={`Detail tim ${team.name}`} className="absolute inset-0 z-0" />

                      {/* Baris atas: avatar, nama + lokasi, badge + menu titik tiga */}
                      <div className="flex items-start gap-3">
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-50 text-base font-bold text-primary-800" aria-hidden="true">
                          {team.name.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p title={team.name} className="line-clamp-2 text-sm font-semibold leading-snug text-neutral-900">{team.name}</p>
                          <p className="mt-1 flex items-center gap-1 text-xs text-neutral-500">
                            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                            <span className="truncate">{team.district ?? "Semua kecamatan"}</span>
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <TeamStatusPill status={team.status} />
                          <button
                            type="button"
                            aria-label={`Aksi ${team.name}`}
                            aria-haspopup="menu"
                            aria-expanded={menuId === team.id}
                            onClick={() => setMenuId((v) => (v === team.id ? null : team.id))}
                            className="relative z-10 -my-2 -mr-2 flex size-11 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
                          >
                            <MoreVertical className="size-5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      <div className="my-3 border-t border-neutral-100" />

                      {/* Info berlabel 2 kolom */}
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                        <div className="col-span-2 min-w-0">
                          <dt className="text-xs text-neutral-500">Penanggung Jawab</dt>
                          <dd className="mt-1 flex min-w-0 items-center gap-1.5">
                            {team.leader ? (
                              <>
                                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[10px] font-bold text-primary-800" aria-hidden="true">
                                  {team.leader.name.charAt(0).toUpperCase()}
                                </span>
                                <span title={team.leader.name} className="truncate text-sm font-medium text-neutral-900">{team.leader.name}</span>
                              </>
                            ) : (
                              <>
                                <span className="inline-flex shrink-0 items-center rounded-full border border-warning-600 bg-warning-50 px-2 py-0.5 text-xs font-semibold text-warning-800">Belum diatur</span>
                                <button
                                  type="button"
                                  className="relative z-10 text-xs font-semibold text-primary-700 underline-offset-2 hover:underline"
                                  onClick={() => { setMenuId(null); router.push(`/tim/${team.id}/ganti-pj`); }}
                                >
                                  Atur PJ
                                </button>
                              </>
                            )}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-xs text-neutral-500">Tiket aktif</dt>
                          <dd className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
                            <Ticket className="size-4 text-primary-600" aria-hidden="true" />
                            {team.activeTicketCount}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-xs text-neutral-500">{team.leader?.phone ? "Telepon PJ" : "Jenis tim"}</dt>
                          <dd className="mt-1 truncate text-sm font-medium text-neutral-900">
                            {team.leader?.phone ?? team.type ?? "—"}
                          </dd>
                        </div>
                      </dl>

                      {/* Menu titik tiga (Detail, Edit, Ganti PJ, Nonaktifkan) */}
                      {menuId === team.id && (
                        <>
                          <div className="fixed inset-0 z-20" aria-hidden="true" onClick={() => setMenuId(null)} />
                          <div role="menu" className="absolute right-2 top-14 z-30 w-44 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-0 py-1 shadow-lg">
                            <button type="button" role="menuitem" className="block w-full px-3 py-2.5 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-100" onClick={() => { setMenuId(null); router.push(`/teams/${team.id}`); }}>Detail</button>
                            <button type="button" role="menuitem" className="block w-full px-3 py-2.5 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-100" onClick={() => openEdit(team)}>Edit</button>
                            <button type="button" role="menuitem" className="block w-full px-3 py-2.5 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-100" onClick={() => { setMenuId(null); router.push(`/tim/${team.id}/ganti-pj`); }}>Ganti PJ</button>
                            {team.isActive ? (
                              <button type="button" role="menuitem" className="block w-full px-3 py-2.5 text-left text-sm text-danger-700 transition-colors hover:bg-danger-50" onClick={() => { setMenuId(null); setConfirmTeam(team); }}>Nonaktifkan</button>
                            ) : (
                              <button type="button" role="menuitem" className="block w-full px-3 py-2.5 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-100" onClick={() => { setMenuId(null); toggleActive.mutate(team); }}>Aktifkan</button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </li>
                ))}

                {/* Kartu terakhir: tambah tim baru */}
                <button
                  type="button"
                  onClick={openCreate}
                  className="flex min-h-56 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-0 text-neutral-500 transition hover:border-primary-400 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
                >
                  <Plus className="size-6" aria-hidden="true" />
                  <span className="text-sm font-semibold">Tambah tim baru</span>
                </button>
              </div>
            )}

            {/* Tabel — tampilan desktop */}
            {teams.length > 0 && (
              <div className="mt-6 hidden overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-0 md:block">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">Tim</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Lokasi</th>
                      <th scope="col" className="px-4 py-3 font-semibold">PJ</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Tiket aktif</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {teams.map((team) => (
                      <tr key={team.id} className="transition-colors hover:bg-neutral-50">
                        <td className="px-4 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-800" aria-hidden="true">{team.name.charAt(0).toUpperCase()}</span>
                            <span title={team.name} className="min-w-0 truncate font-medium text-neutral-900">{team.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-neutral-600">{team.district ?? "—"}</td>
                        <td className="px-4 py-3">
                          {team.leader ? (
                            <span className="block max-w-40 truncate text-neutral-800">{team.leader.name}</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-warning-600 bg-warning-50 px-2 py-0.5 text-xs font-semibold text-warning-800">Belum diatur</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-neutral-900">{team.activeTicketCount}</td>
                        <td className="px-4 py-3"><TeamStatusPill status={team.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button type="button" variant="ghost" size="sm" onClick={() => { setMenuId(null); setDetailTeam(team); }}>Detail</Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(team)}>Edit</Button>
                            {team.isActive ? (
                              <Button type="button" variant="danger" size="sm" onClick={() => setConfirmTeam(team)}>Nonaktifkan</Button>
                            ) : (
                              <Button type="button" variant="ghost" size="sm" onClick={() => toggleActive.mutate(team)}>Aktifkan</Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {formTeam !== null && (
          <TeamFormModal team={formTeam === "create" ? null : formTeam} onClose={() => setFormTeam(null)} />
        )}

        {detailTeam && (
          <Modal
            title={detailTeam.name}
            caption={detailTeam.district ?? "Semua kecamatan"}
            icon={Users}
            onClose={() => setDetailTeam(null)}
            footer={
              <>
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setDetailTeam(null)}>Tutup</Button>
                <Button type="button" className="flex-1" onClick={() => { const t = detailTeam; setDetailTeam(null); setFormTeam(t); }}>Edit</Button>
              </>
            }
          >
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-neutral-500">Status</dt>
                <dd><TeamStatusPill status={detailTeam.status} /></dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-neutral-500">Penanggung Jawab</dt>
                <dd className="min-w-0 text-right font-medium text-neutral-900">
                  {detailTeam.leader ? (
                    <>
                      <span className="block truncate">{detailTeam.leader.name}</span>
                      <span className="block text-xs font-normal text-neutral-500">@{detailTeam.leader.username ?? "—"}</span>
                      {detailTeam.leader.phone && <span className="block text-xs font-normal text-neutral-500">{detailTeam.leader.phone}</span>}
                    </>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-warning-600 bg-warning-50 px-2 py-0.5 text-xs font-semibold text-warning-800">Belum diatur</span>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-neutral-500">Jenis tim</dt>
                <dd className="font-medium text-neutral-900">{detailTeam.type ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-neutral-500">Tiket aktif</dt>
                <dd className="font-medium text-neutral-900">{detailTeam.activeTicketCount}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-neutral-500">Total tiket ditangani</dt>
                <dd className="font-medium text-neutral-900">{detailTeam.totalTicketCount}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-neutral-500">Dibuat</dt>
                <dd className="font-medium text-neutral-900">
                  {detailTeam.createdAt ? new Date(detailTeam.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                </dd>
              </div>
              {detailTeam.description && (
                <div className="border-t border-neutral-100 pt-3">
                  <dt className="text-neutral-500">Deskripsi</dt>
                  <dd className="mt-1 text-neutral-800">{detailTeam.description}</dd>
                </div>
              )}
            </dl>
          </Modal>
        )}

        {confirmTeam && (
          <Modal
            title="Nonaktifkan tim?"
            caption={confirmTeam.name}
            icon={TriangleAlert}
            onClose={() => setConfirmTeam(null)}
            footer={
              <>
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setConfirmTeam(null)}>Batal</Button>
                <Button
                  type="button"
                  variant="danger"
                  className="flex-1"
                  disabled={confirmTeam.activeTicketCount > 0 || toggleActive.isPending}
                  onClick={() => toggleActive.mutate(confirmTeam)}
                >
                  {toggleActive.isPending ? "Memproses..." : "Nonaktifkan"}
                </Button>
              </>
            }
          >
            <p className="text-sm text-neutral-600">
              {confirmTeam.activeTicketCount > 0
                ? `Tim masih memegang ${confirmTeam.activeTicketCount} tiket aktif. Pindahkan (reassign) tiketnya dulu sebelum menonaktifkan.`
                : "Tim tidak akan muncul sebagai pilihan dispatch. Status ini bisa dibatalkan kapan saja."}
            </p>
          </Modal>
        )}
      </div>
    </div>
  );
}
