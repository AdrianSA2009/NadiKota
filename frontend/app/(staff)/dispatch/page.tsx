"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, CircleHelp, ClipboardCheck, Clock, Construction, Hourglass, Lightbulb, ListFilter, Search, Truck, Users, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { useToastStore } from "@/lib/toastStore";
import { useIsMobile } from "@/hooks/useIsMobile";
import { getDispatchTickets, getFieldTeams } from "@/features/dashboard/dashboardApi";
import type { DispatchTicket, Team } from "@/features/dashboard/dashboardTypes";
import { formatCategory } from "@/lib/formatters";
import { TicketSummary, TeamPicker, sortDispatchTickets, useAssignForm } from "@/components/dispatch/AssignTicket";

type AssignFilter = "all" | "unassigned" | "assigned";
type DangerFilter = "all" | "bahaya" | "hati-hati";
type SortMode = "newest" | "oldest";

const CATEGORY_ICON = { pothole: Construction, street_light: Lightbulb, other: CircleHelp } as const;

export default function DispatchPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const showToast = useToastStore((s) => s.show);
  const tickets = useQuery({ queryKey: ["dispatch-tickets"], queryFn: getDispatchTickets });
  const teams = useQuery({ queryKey: ["field-teams"], queryFn: getFieldTeams });
  const [assignTarget, setAssignTarget] = useState<DispatchTicket | null>(null);
  const [assignFilter, setAssignFilter] = useState<AssignFilter>("all");
  const [danger, setDanger] = useState<DangerFilter>("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  // Mobile saja: satu kartu detail terbuka pada satu waktu.
  const [openId, setOpenId] = useState<number | null>(null);

  const list = useMemo(() => {
    const all = (tickets.data ?? []).filter((t) => t.status === "queued" || t.status === "in_progress");
    const q = search.trim().toLowerCase();
    const filtered = all.filter((t) => {
      if (assignFilter === "unassigned" && t.assignedTeamId) return false;
      if (assignFilter === "assigned" && !t.assignedTeamId) return false;
      if (danger !== "all" && t.dangerLevel !== danger) return false;
      if (q && !(`${t.ticketNumber} ${formatCategory(t.category)} ${t.assigneeName ?? ""}`.toLowerCase().includes(q))) return false;
      return true;
    });
    return sortDispatchTickets(filtered, sort);
  }, [tickets.data, assignFilter, danger, sort, search]);

  // Mobile → halaman terpisah; desktop → modal dua kolom.
  const handleAssign = (ticket: DispatchTicket) => {
    if (isMobile) router.push(`/dispatch/${ticket.id}/tugaskan`);
    else setAssignTarget(ticket);
  };

  // Bukti hasil sudah dikirim tim → status "Dalam Penilaian", aksi = buka tiket untuk dinilai.
  const submitted = (t: DispatchTicket) => t.status === "in_progress" && t.reviewStatus === "submitted";
  const goAssess = (t: DispatchTicket) => router.push(`/tickets?open=${t.id}`);

  if (tickets.isLoading || teams.isLoading) {
    return (
      <main className="absolute inset-0 overflow-y-auto bg-neutral-50 px-4 py-6 pb-24 text-neutral-700 md:pb-6 sm:px-6 xl:px-8">
        <div className="mx-auto w-full max-w-[1720px] space-y-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-11 w-full" />
          {/* Mobile — meniru kartu List Tiket */}
          <div className="space-y-3 md:hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-0 p-4 shadow-sm">
                <Skeleton className="size-11 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-48" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-32 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                </div>
                <Skeleton className="size-5 shrink-0 rounded" />
              </div>
            ))}
          </div>
          {/* Desktop — meniru tabel */}
          <div className="hidden overflow-hidden rounded-xl border border-neutral-200 bg-neutral-0 shadow-sm md:block">
            <div className="flex gap-4 border-b border-neutral-200 bg-neutral-50 px-4 py-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="ml-auto h-4 w-20" />
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b border-neutral-100 px-4 py-3 last:border-b-0">
                <Skeleton className="size-9 shrink-0 rounded-lg" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-6 w-28 rounded-full" />
                <Skeleton className="ml-auto h-8 w-24" />
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }
  if (tickets.isError) {
    return <main className="absolute inset-0 overflow-y-auto bg-neutral-50 px-4 py-6 sm:px-6 xl:px-8"><div className="mx-auto w-full max-w-[1720px]"><ErrorState message={tickets.error.message} onRetry={() => void tickets.refetch()} /></div></main>;
  }
  if (teams.isError) {
    return <main className="absolute inset-0 overflow-y-auto bg-neutral-50 px-4 py-6 sm:px-6 xl:px-8"><div className="mx-auto w-full max-w-[1720px]"><ErrorState message={teams.error.message} onRetry={() => void teams.refetch()} /></div></main>;
  }

  return (
    <main className="absolute inset-0 overflow-y-auto bg-neutral-50 px-4 py-6 pb-24 text-neutral-700 md:pb-6 sm:px-6 xl:px-8">
      {/* Lebar penuh di samping sidebar (konsisten dgn halaman Tim); batas longgar hanya utk ultra-wide */}
      <div className="mx-auto w-full max-w-[1720px]">
        <header>
          <p className="flex items-center gap-2 text-sm font-medium text-primary-700"><Truck className="size-5" aria-hidden="true" />Dispatch tim</p>
          <h1 className="mt-1 text-2xl font-bold text-neutral-900">Tugaskan tiket</h1>
          <p className="mt-1 text-sm text-neutral-500">Tiket belum ditugaskan tampil di paling atas.</p>
        </header>

        {/* Filter: collapsible di mobile, selalu tampil di desktop */}
        <div className="mt-5">
          <Button type="button" variant="secondary" className="w-full justify-center md:hidden" aria-expanded={filterOpen} onClick={() => setFilterOpen((v) => !v)}>
            <ListFilter className="mr-2 inline size-4" aria-hidden="true" />
            Filter & urutan
          </Button>
          <Card className={`${filterOpen ? "block" : "hidden"} mt-3 md:mt-0 md:block`}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className="flex-1 text-sm font-medium text-neutral-900">
                Cari
                <div className="relative mt-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nomor tiket / kategori / nama PJ" className="min-h-11 w-full rounded-lg border border-neutral-300 bg-neutral-0 pl-9 pr-3 text-base font-normal text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2" />
                </div>
              </label>
              <label className="text-sm font-medium text-neutral-900">Penugasan
                <select value={assignFilter} onChange={(e) => setAssignFilter(e.target.value as AssignFilter)} className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 bg-neutral-0 px-3 text-base font-normal text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2">
                  <option value="all">Semua</option>
                  <option value="unassigned">Belum ditugaskan</option>
                  <option value="assigned">Sudah ditugaskan</option>
                </select>
              </label>
              <label className="text-sm font-medium text-neutral-900">Tingkat bahaya
                <select value={danger} onChange={(e) => setDanger(e.target.value as DangerFilter)} className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 bg-neutral-0 px-3 text-base font-normal text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2">
                  <option value="all">Semua</option>
                  <option value="bahaya">Bahaya</option>
                  <option value="hati-hati">Hati-hati</option>
                </select>
              </label>
              <label className="text-sm font-medium text-neutral-900">Urutkan
                <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 bg-neutral-0 px-3 text-base font-normal text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2">
                  <option value="newest">Terbaru</option>
                  <option value="oldest">Terlama</option>
                </select>
              </label>
            </div>
          </Card>
        </div>

        {list.length === 0 ? (
          <div className="mt-6">
            <EmptyState title="Tidak ada tiket untuk di-dispatch" description="Tiket aktif (antrean / dalam perbaikan) akan tampil di sini." />
          </div>
        ) : (
          <>
            {/* Mobile — kartu ringkas seperti List Tiket */}
            <div className="mt-4 space-y-3 md:hidden">
              {list.map((ticket) => {
                const team = teams.data?.find((t) => t.id === ticket.assignedTeamId);
                const CategoryIcon = CATEGORY_ICON[ticket.category] ?? CircleHelp;
                const open = openId === ticket.id;
                return (
                  <div key={ticket.id} className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-0 shadow-sm transition hover:border-primary-300 hover:shadow-md">
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 p-4 text-left"
                      aria-expanded={open}
                      onClick={() => setOpenId((v) => (v === ticket.id ? null : ticket.id))}
                    >
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                        <CategoryIcon className="size-6" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-neutral-900">{formatCategory(ticket.category)}</span>
                        <span className="mt-0.5 block truncate text-xs text-neutral-500">{ticket.ticketNumber} · {new Date(ticket.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                        {ticket.assigneeName && (
                          <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs font-medium text-neutral-700">
                            <Users className="size-3.5 shrink-0" aria-hidden="true" />
                            <span className="truncate">PJ: {ticket.assigneeName}</span>
                          </span>
                        )}
                        <span className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Badge variant={submitted(ticket) ? "assessing" : ticket.status === "in_progress" ? "in_progress" : "queued"} />
                          {ticket.dangerLevel && (
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${ticket.dangerLevel === "bahaya" ? "border-danger-600 bg-danger-50 text-danger-700" : "border-warning-600 bg-warning-50 text-warning-800"}`}>
                              {ticket.dangerLevel === "bahaya" ? "Bahaya" : "Hati-hati"}
                            </span>
                          )}
                        </span>
                      </span>
                      <ChevronDown className={`size-5 shrink-0 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                    </button>

                    {open && (
                      <div className="space-y-3 border-t border-neutral-200 bg-neutral-50/60 p-4">
                        <dl className="space-y-1.5 text-sm">
                          <div className="flex justify-between gap-2">
                            <dt className="text-neutral-500">Tim</dt>
                            <dd className={`font-medium ${team ? "text-neutral-900" : "text-neutral-400"}`}>{team ? team.name : "Belum ditugaskan"}</dd>
                          </div>
                          {ticket.assigneeName && (
                            <div className="flex justify-between gap-2">
                              <dt className="text-neutral-500">PJ pelaksana</dt>
                              <dd className="font-medium text-neutral-900">{ticket.assigneeName}</dd>
                            </div>
                          )}
                          <div className="flex justify-between gap-2">
                            <dt className="text-neutral-500">Lokasi</dt>
                            <dd className="font-medium text-neutral-900">
                              {Number.isFinite(ticket.latitude) && Number.isFinite(ticket.longitude)
                                ? `${ticket.latitude.toFixed(5)}, ${ticket.longitude.toFixed(5)}`
                                : "tidak tersedia"}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-neutral-500">Dibuat</dt>
                            <dd className="font-medium text-neutral-900">{new Date(ticket.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</dd>
                          </div>
                        </dl>
                        <div className="border-t border-neutral-200 pt-3">
                          {!team ? (
                            <Button type="button" className="inline-flex w-full items-center justify-center gap-2 py-3 text-sm" onClick={() => handleAssign(ticket)}>
                              <Truck className="size-4 shrink-0" aria-hidden="true" />
                              Tugaskan tim
                            </Button>
                          ) : ticket.status === "queued" ? (
                            <Button type="button" variant="outline" className="inline-flex w-full items-center justify-center gap-2 py-3 text-sm" onClick={() => handleAssign(ticket)}>
                              <Users className="size-4 shrink-0" aria-hidden="true" />
                              Ubah tim
                            </Button>
                          ) : submitted(ticket) ? (
                            <Button type="button" className="inline-flex w-full items-center justify-center gap-2 py-3 text-sm" onClick={() => goAssess(ticket)}>
                              <ClipboardCheck className="size-4 shrink-0" aria-hidden="true" />
                              Lakukan Penilaian
                            </Button>
                          ) : (
                            <p className="py-1 text-center text-xs text-neutral-500">Sedang dikerjakan tim — menunggu bukti hasil perbaikan.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop — tabel */}
            <div className="mt-4 hidden overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-0 shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <th scope="col" className="px-4 py-3">Tiket</th>
                  <th scope="col" className="px-4 py-3">Tim</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="hidden px-4 py-3 lg:table-cell">Lokasi</th>
                  <th scope="col" className="hidden px-4 py-3 md:table-cell">Dibuat</th>
                  <th scope="col" className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {list.map((ticket) => {
                  const team = teams.data?.find((t) => t.id === ticket.assignedTeamId);
                  const CategoryIcon = CATEGORY_ICON[ticket.category] ?? CircleHelp;
                  return (
                    <tr key={ticket.id} className="align-middle transition-colors hover:bg-neutral-50/70">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                            <CategoryIcon className="size-5" aria-hidden="true" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-neutral-900">{formatCategory(ticket.category)}</span>
                            <span className="block truncate text-xs text-neutral-500">{ticket.ticketNumber}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`block whitespace-nowrap ${team ? "font-medium text-neutral-800" : "text-neutral-400"}`}>{team ? team.name : "Belum ditugaskan"}</span>
                        {ticket.assigneeName && (
                          <span className="mt-0.5 flex items-center gap-1 whitespace-nowrap text-xs text-neutral-500">
                            <Users className="size-3 shrink-0" aria-hidden="true" />
                            PJ: {ticket.assigneeName}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {submitted(ticket) ? (
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-info-600 bg-info-50 px-2.5 py-1 text-xs font-semibold text-info-800">
                            <Hourglass className="size-3.5" aria-hidden="true" />
                            Dalam Penilaian
                          </span>
                        ) : ticket.status === "in_progress" ? (
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-primary-800 px-2.5 py-1 text-xs font-semibold text-neutral-0">
                            <Wrench className="size-3.5" aria-hidden="true" />
                            Dalam Perbaikan
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-warning-600 bg-warning-50 px-2.5 py-1 text-xs font-semibold text-warning-800">
                            <Clock className="size-3.5" aria-hidden="true" />
                            Menunggu
                          </span>
                        )}
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-xs text-neutral-500 lg:table-cell">
                        {Number.isFinite(ticket.latitude) && Number.isFinite(ticket.longitude)
                          ? `${ticket.latitude.toFixed(5)}, ${ticket.longitude.toFixed(5)}`
                          : "tidak tersedia"}
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-xs text-neutral-500 md:table-cell">
                        {new Date(ticket.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!team ? (
                          <Button type="button" className="min-h-9 px-3 py-1.5 text-xs" onClick={() => handleAssign(ticket)}>
                            Tugaskan
                          </Button>
                        ) : ticket.status === "queued" ? (
                          <Button type="button" variant="secondary" className="min-h-9 px-3 py-1.5 text-xs" onClick={() => handleAssign(ticket)}>
                            Ubah Tim
                          </Button>
                        ) : submitted(ticket) ? (
                          <Button type="button" className="min-h-9 px-3 py-1.5 text-xs" onClick={() => goAssess(ticket)}>
                            Lakukan Penilaian
                          </Button>
                        ) : (
                          <span className="text-xs text-neutral-400">Menunggu bukti hasil</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}

        {assignTarget && (
          <AssignModal
            ticket={assignTarget}
            teams={teams.data ?? []}
            onClose={() => setAssignTarget(null)}
            onDone={(message) => { showToast(message, "success"); setAssignTarget(null); }}
            onError={(message) => showToast(message, "info")}
          />
        )}
      </div>
    </main>
  );
}

/** Modal DESKTOP dua kolom: ringkasan tiket (kiri) + pencarian & pilihan tim (kanan). */
function AssignModal({ ticket, teams, onClose, onDone, onError }: {
  ticket: DispatchTicket;
  teams: Team[];
  onClose: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const form = useAssignForm({ ticket, teams, onDone, onError });
  return (
    <Modal
      title={form.isReassign ? "Ubah Tim" : "Tugaskan tiket"}
      caption={`${ticket.ticketNumber} · ${formatCategory(ticket.category)}`}
      icon={Truck}
      size="xl"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Batal</Button>
          <Button type="button" className="flex-1" disabled={!form.chosen || form.assign.isPending} onClick={() => form.assign.mutate()}>
            {form.assign.isPending ? "Menyimpan..." : form.isReassign ? "Simpan perubahan" : "Konfirmasi tugaskan"}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h3 className="mb-3 border-b border-neutral-100 pb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Data tiket</h3>
          <TicketSummary ticket={ticket} />
        </section>
        <section>
          <h3 className="mb-3 border-b border-neutral-100 pb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Pilih tim</h3>
          <TeamPicker chosen={form.chosen} onChoose={form.setChosen} search={form.search} onSearch={form.setSearch} teams={form.teams} recommended={form.recommended} distanceKm={form.distanceKm} variant="list" />
        </section>
      </div>
    </Modal>
  );
}
