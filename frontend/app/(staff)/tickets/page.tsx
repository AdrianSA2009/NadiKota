"use client";

import { Suspense, useEffect, useRef, useState, type ComponentProps } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, CircleHelp, CircleX, ClipboardList, Clock, Construction, Eye, ImagePlus, Lightbulb, Loader2, TriangleAlert, Truck, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { apiClient } from "@/lib/apiClient";
import { cancelTicket, finalizeTicket, rejectTicketProof } from "@/features/dashboard/dashboardApi";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { DangerLevel, Ticket, TicketListResponse, TicketStatus } from "@/features/dashboard/dashboardTypes";
import { formatCategory } from "@/lib/formatters";

const terminal: TicketStatus[] = ["completed", "rejected", "cancelled"];

const FILTERS: { value: "" | TicketStatus; label: string }[] = [
  { value: "", label: "Semua" },
  { value: "queued", label: "Antrean" },
  { value: "in_progress", label: "Perbaikan" },
  { value: "completed", label: "Selesai" },
  { value: "cancelled", label: "Dibatalkan" },
  { value: "needs_review", label: "Perlu Tinjauan" },
];

type BadgeVariant = ComponentProps<typeof Badge>["variant"];
const badgeVariant = (status: TicketStatus): BadgeVariant =>
  status === "completed" ? "done" : status === "rejected" ? "urgent" : status === "cancelled" ? "cancelled" : status;

const CATEGORY_ICON = { pothole: Construction, street_light: Lightbulb, other: CircleHelp } as const;

const DANGER_CHIP: Record<DangerLevel, string> = {
  bahaya: "border-danger-600 bg-danger-50 text-danger-700",
  "hati-hati": "border-warning-600 bg-warning-50 text-warning-800",
};

export default function TicketsPage() {
  // Suspense wajib untuk useSearchParams (prerender Next.js).
  return (
    <Suspense fallback={<main className="no-scrollbar min-h-screen bg-neutral-50 px-4 py-6"><div className="w-full space-y-3"><Skeleton className="h-16" /><Skeleton className="h-28" /></div></main>}>
      <TicketsContent />
    </Suspense>
  );
}

function TicketsContent() {
  // Datang dari Dispatch ("Lakukan Penilaian") → ?open=<id>: filter + buka akordeon tiket tsb.
  // Param dibaca saat render (bukan useState awal) — saat hydration prerender masih null,
  // state yang diinisialisasi sekali tidak pernah dapat nilainya.
  const paramRaw = useSearchParams().get("open");
  const paramId = paramRaw && Number.isInteger(Number(paramRaw)) && Number(paramRaw) > 0 ? Number(paramRaw) : null;
  const [touched, setTouched] = useState(false);
  const [statusManual, setStatusManual] = useState<"" | TicketStatus | null>(null);
  const [page, setPage] = useState(1);
  // Satu akordeon terbuka pada satu waktu — state di induk, bukan per kartu.
  const [manualOpen, setManualOpen] = useState<number | null>(null);
  // Sebelum admin menyentuh filter/akordeon → ikut ?open (buka akordeon + filter Perbaikan).
  const status: "" | TicketStatus = statusManual ?? (paramId ? "in_progress" : "");
  const openId = touched ? manualOpen : paramId;
  const setStatus = (s: "" | TicketStatus) => { setTouched(true); setStatusManual(s); };
  const setOpenId = (v: number | null) => { setTouched(true); setManualOpen(v); };
  const isMobile = useIsMobile();
  // Preload semua status sekaligus — hook dipanggil eksplisit (aman untuk rules-of-hooks),
  // tidak ada skeleton saat berpindah kategori.
  const preload = (s: "" | TicketStatus) => ({
    queryKey: ["admin-tickets", s, 1] as const,
    queryFn: async () => (await apiClient.get<TicketListResponse>("/tickets", { params: { page: 1, ...(s ? { status: s } : {}) } })).data,
    staleTime: 60_000, // Cache selama 60 detik — mencegah refresh saat berpindah kategori
  });
  const qAll = useQuery(preload(""));
  const qQueued = useQuery(preload("queued"));
  const qInProgress = useQuery(preload("in_progress"));
  const qCompleted = useQuery(preload("completed"));
  const qCancelled = useQuery(preload("cancelled"));
  const qNeedsReview = useQuery(preload("needs_review"));
  const queries: Record<string, typeof qAll> = {
    "": qAll,
    queued: qQueued,
    in_progress: qInProgress,
    completed: qCompleted,
    cancelled: qCancelled,
    needs_review: qNeedsReview,
  };
  
  // Gunakan data dari query yang sesuai dengan status aktif
  const query = queries[status];

  // Tiket hasil redirect "Lakukan Penilaian" → gulir ke kartunya (mobile) setelah data siap.
  // Desktop membuka modal, jadi scroll tidak diperlukan.
  const scrolledRef = useRef(false);
  useEffect(() => {
    if (paramId === null || isMobile || scrolledRef.current || !query.data) return;
    const el = document.getElementById(`ticket-${paramId}`);
    if (el) {
      scrolledRef.current = true;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [paramId, isMobile, query.data]);

  if (query.isLoading) {
    return (
      <main className="no-scrollbar absolute inset-0 overflow-y-auto bg-neutral-50 px-4 py-6 pb-24 text-neutral-700 md:px-6 md:pb-6">
        <div className="w-full space-y-4">
          <Skeleton className="h-16 w-64" />
          <div className="flex gap-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-24 rounded-full" />)}</div>
          {/* Mobile — skeleton kartu */}
          <div className="space-y-3 md:hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-0 p-4 shadow-sm">
                <Skeleton className="size-11 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-48" />
                  <div className="flex gap-2"><Skeleton className="h-6 w-28 rounded-full" /><Skeleton className="h-6 w-20 rounded-full" /></div>
                </div>
                <Skeleton className="size-5 shrink-0 rounded" />
              </div>
            ))}
          </div>
          {/* Desktop — skeleton tabel */}
          <div className="hidden overflow-hidden rounded-xl border border-neutral-200 bg-neutral-0 shadow-sm md:block">
            <div className="flex gap-4 border-b border-neutral-200 bg-neutral-50 px-4 py-3">
              <Skeleton className="h-4 w-40" /><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-32" /><Skeleton className="ml-auto h-4 w-24" />
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b border-neutral-100 px-4 py-3 last:border-b-0">
                <Skeleton className="size-9 shrink-0 rounded-lg" /><Skeleton className="h-4 w-44" />
                <Skeleton className="h-6 w-28 rounded-full" /><Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-28" /><Skeleton className="ml-auto h-8 w-24" />
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }
  if (query.isError) return <main className="no-scrollbar min-h-screen bg-neutral-50 px-4 py-6"><div className="w-full"><ErrorState message={query.error.message} onRetry={() => void query.refetch()} /></div></main>;
  const data = query.data;
  if (!data) return null;
  // Tiket yang sedang dibuka di modal desktop (openId juga dipakai akordeon mobile).
  const detailTicket = !isMobile ? data.data.find((t) => t.id === openId) ?? null : null;
  const badgeLabel = (t: Ticket) => (t.status === "in_progress" && t.reviewStatus === "submitted" ? "Dalam Penilaian" : FILTERS.find((f) => f.value === t.status)?.label ?? "—");

  return <main className="no-scrollbar absolute inset-0 overflow-y-auto bg-neutral-50 px-4 py-6 pb-24 text-neutral-700 md:px-6 md:pb-6"><div className="w-full">
    <header className="flex items-center gap-3">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-800 text-neutral-0"><ClipboardList className="size-6" aria-hidden="true" /></span>
      <div><p className="text-sm font-medium text-primary-700">Administrasi</p><h1 className="text-2xl font-bold text-neutral-900">List Tiket</h1></div>
    </header>
    <p className="mt-2 text-sm text-neutral-500">Lihat detail, periksa bukti perbaikan, atau batalkan tiket aktif.</p>

    <div className="scrollbar-hide mt-5 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter status tiket">
      {FILTERS.map((f) => {
        const active = status === f.value;
        return <button key={f.value || "all"} type="button" aria-pressed={active} onClick={() => { setStatus(f.value); setPage(1); }} className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${active ? "bg-primary-800 text-neutral-0" : "border border-neutral-200 bg-neutral-0 text-neutral-600 hover:border-primary-300 hover:text-primary-700"}`}>{f.label}</button>;
      })}
    </div>

    {/* Mobile — kartu akordeon */}
    <div className="mt-4 space-y-3 md:hidden">
      {data.data.length ? data.data.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} open={openId === ticket.id} onToggle={() => setOpenId(openId === ticket.id ? null : ticket.id)} />) : <EmptyState title="Tidak ada tiket" description="Belum ada tiket untuk filter ini." />}
    </div>

    {/* Desktop — tabel */}
    <div className="mt-4 hidden overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-0 shadow-sm md:block">
      {data.data.length === 0 ? (
        <div className="p-4"><EmptyState title="Tidak ada tiket" description="Belum ada tiket untuk filter ini." /></div>
      ) : (
        <table className="w-full min-w-[840px] text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <th scope="col" className="px-4 py-3">Tiket</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Tingkat bahaya</th>
              <th scope="col" className="px-4 py-3">Pelapor</th>
              <th scope="col" className="px-4 py-3">Dibuat</th>
              <th scope="col" className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {data.data.map((ticket) => {
              const CategoryIcon = CATEGORY_ICON[ticket.category] ?? CircleHelp;
              const dangerLabel = ticket.dangerLevel === "bahaya" ? "Bahaya" : ticket.dangerLevel === "hati-hati" ? "Hati-hati" : null;
              const open = openId === ticket.id;
              const reporter = (ticket.reporterNames ?? []).join(", ");
              return (
                <tr key={ticket.id} id={`ticket-${ticket.id}`} className={`transition-colors ${open ? "bg-primary-50/60" : "hover:bg-neutral-50/70"}`}>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700"><CategoryIcon className="size-5" aria-hidden="true" /></span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-neutral-900">{formatCategory(ticket.category)}</span>
                        <span className="block truncate text-xs text-neutral-500">{ticket.ticketNumber}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={ticket.status === "in_progress" && ticket.reviewStatus === "submitted" ? "assessing" : badgeVariant(ticket.status)} />
                  </td>
                  <td className="px-4 py-3">
                    {dangerLabel ? (
                      <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${DANGER_CHIP[ticket.dangerLevel as DangerLevel]}`}>{dangerLabel}</span>
                    ) : (
                      <span className="text-xs text-neutral-400">Belum dinilai</span>
                    )}
                  </td>
                  <td className="max-w-56 truncate px-4 py-3 text-neutral-700" title={reporter}>{reporter || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-neutral-500">{new Date(ticket.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</td>
                  <td className="px-4 py-3 text-right">
                    <Button type="button" variant="outline" size="sm" aria-haspopup="dialog" onClick={() => setOpenId(ticket.id)}>
                      Detail
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
    {data.meta.lastPage > 1 && <nav className="mt-6 flex items-center justify-between" aria-label="Halaman tiket"><Button type="button" variant="secondary" disabled={page === 1} onClick={() => setPage((n) => n - 1)}>Sebelumnya</Button><span className="text-sm text-neutral-500">Halaman {data.meta.currentPage} dari {data.meta.lastPage}</span><Button type="button" variant="secondary" disabled={page === data.meta.lastPage} onClick={() => setPage((n) => n + 1)}>Berikutnya</Button></nav>}
    {/* Desktop — detail di modal (mobile tetap akordeon kartu) */}
    {!isMobile && detailTicket && (
      <Modal
        title={formatCategory(detailTicket.category)}
        caption={`${detailTicket.ticketNumber} · ${badgeLabel(detailTicket)}`}
        icon={ClipboardList}
        size="lg"
        onClose={() => setOpenId(null)}
        footer={<Button type="button" variant="secondary" className="flex-1" onClick={() => setOpenId(null)}>Tutup</Button>}
      >
        <TicketDetail ticket={detailTicket} />
      </Modal>
    )}  </div></main>;
}

function TicketRow({ ticket, open, onToggle }: { ticket: Ticket; open: boolean; onToggle: () => void }) {
  const CategoryIcon = CATEGORY_ICON[ticket.category] ?? CircleHelp;
  const dangerLabel = ticket.dangerLevel === "bahaya" ? "Bahaya" : ticket.dangerLevel === "hati-hati" ? "Hati-hati" : null;

  return <div id={`ticket-${ticket.id}`} className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-0 shadow-sm transition hover:border-primary-300 hover:shadow-md">
    <button type="button" className="flex w-full items-center gap-3 p-4 text-left" aria-expanded={open} onClick={onToggle}>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700"><CategoryIcon className="size-6" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-neutral-900">{formatCategory(ticket.category)}</span>
        <span className="mt-0.5 block truncate text-xs text-neutral-500">{ticket.ticketNumber} · {new Date(ticket.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
        <span className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant={ticket.status === "in_progress" && ticket.reviewStatus === "submitted" ? "assessing" : badgeVariant(ticket.status)} />
          {dangerLabel && <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${DANGER_CHIP[ticket.dangerLevel as DangerLevel]}`}>{dangerLabel}</span>}
        </span>
      </span>
      <ChevronDown className={`size-5 shrink-0 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
    </button>

    {open && <TicketDetail ticket={ticket} />}
  </div>;
}

/** Isi detail tiket (foto + info + aksi) — dipakai kartu mobile & baris tabel desktop. */
function TicketDetail({ ticket }: { ticket: Ticket }) {
  const [proofOpen, setProofOpen] = useState(false);
  const [beforeOpen, setBeforeOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
    void queryClient.invalidateQueries({ queryKey: ["field-tickets"] });
    // Peta memakai cache terpisah — buang juga supaya tiket batal langsung hilang dari peta.
    void queryClient.invalidateQueries({ queryKey: ["tickets-map"] });
  };
  const finalize = useMutation({ mutationFn: () => finalizeTicket(ticket.id), onSuccess: refresh });
  const reject = useMutation({
    mutationFn: () => rejectTicketProof(ticket.id, rejectReason.trim()),
    onSuccess: () => { refresh(); setRejectOpen(false); setRejectReason(""); },
  });
  const cancel = useMutation({ mutationFn: () => cancelTicket(ticket.id, cancelReason), onSuccess: refresh });
  const canComplete = ticket.status === "in_progress";
  // Tiket in_progress tidak bisa dibatalkan (backend juga menolak 409).
  const canCancel = !terminal.includes(ticket.status) && ticket.status !== "in_progress";
  const dangerLabel = ticket.dangerLevel === "bahaya" ? "Bahaya" : ticket.dangerLevel === "hati-hati" ? "Hati-hati" : null;
  const isCompleted = ticket.status === "completed";
  // Foto sesudah + label (sebelum)/(sesudah) hanya tampil setelah tiket selesai.
  const showAfter = isCompleted && Boolean(ticket.afterPhotoUrl);

  return <div className="border-t border-neutral-200 bg-neutral-50/60 p-4">
      {/* Gambar tidak ditampilkan inline — hanya lewat tombol preview */}
      <div className="flex flex-wrap gap-2">
        {ticket.photoUrl && (
          <Button type="button" variant="secondary" size="sm" onClick={() => setBeforeOpen(true)}>
            <Eye className="mr-1.5 inline size-4" aria-hidden="true" />
            Lihat gambar laporan{isCompleted ? " (sebelum)" : ""}
          </Button>
        )}
        {showAfter && (
          <Button type="button" variant="secondary" size="sm" className="border-success-200 text-success-700 hover:bg-success-50" onClick={() => setProofOpen(true)}>
            <Eye className="mr-1.5 inline size-4" aria-hidden="true" />
            Lihat bukti hasil (sesudah)
          </Button>
        )}
      </div>

      {/* Kartu info berikon — supaya tidak flat */}
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        {([
          { icon: TriangleAlert, label: "Tingkat bahaya", value: dangerLabel ?? "Belum dinilai", tone: ticket.dangerLevel === "bahaya" ? "text-danger-700" : ticket.dangerLevel === "hati-hati" ? "text-warning-800" : "text-neutral-500" },
          { icon: Users, label: "Pelapor", value: (ticket.reporterNames ?? []).join(", ") || "—" },
          { icon: Truck, label: "Tim pelaksana", value: ticket.assignedTeamName || "Belum ditugaskan" },
          { icon: Clock, label: "Dibuat", value: new Date(ticket.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) },
        ]).map(({ icon: Icon, label, value, tone = "text-neutral-900" }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-0 px-3 py-2.5 shadow-sm">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700"><Icon className="size-4" aria-hidden="true" /></span>
            <div className="min-w-0">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">{label}</dt>
              <dd className={`truncate text-sm font-semibold ${tone}`} title={String(value)}>{value}</dd>
            </div>
          </div>
        ))}
        {ticket.cancelReason && (
          <div className="flex items-center gap-3 rounded-xl border border-danger-200 bg-danger-50 px-3 py-2.5 sm:col-span-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-danger-100 text-danger-700"><CircleX className="size-4" aria-hidden="true" /></span>
            <div className="min-w-0">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-danger-700">Alasan pembatalan</dt>
              <dd className="truncate text-sm font-semibold text-danger-800" title={ticket.cancelReason}>{ticket.cancelReason}</dd>
            </div>
          </div>
        )}
      </dl>

      {canComplete && <section className="mt-4 rounded-xl border border-success-200 bg-success-50 p-3">
        <h2 className="text-sm font-semibold text-neutral-900">Hasil perbaikan</h2>
        <p className="mt-0.5 text-xs text-neutral-600">
          {ticket.reviewStatus === "submitted"
            ? "Tim sudah mengirim bukti — periksa hasilnya, lalu Selesaikan atau Tolak."
            : "Menunggu tim mengirim bukti hasil perbaikan."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" className="min-h-0 px-3 py-2 text-xs" disabled={!ticket.afterPhotoUrl} onClick={() => setProofOpen(true)}>
            <Eye className="mr-1.5 inline size-4" aria-hidden="true" />Cek hasilnya
          </Button>
          <Button
            type="button"
            variant="danger"
            className="min-h-0 px-3 py-2 text-xs"
            disabled={!ticket.afterPhotoUrl || ticket.reviewStatus !== "submitted" || reject.isPending}
            onClick={() => setRejectOpen(true)}
          >
            <CircleX className="mr-1.5 inline size-4" aria-hidden="true" />Tolak
          </Button>
          <Button type="button" className="min-h-0 px-3 py-2 text-xs" disabled={!ticket.afterPhotoUrl || ticket.reviewStatus !== "submitted" || finalize.isPending} onClick={() => finalize.mutate()}>
            {finalize.isPending ? <Loader2 className="mr-1.5 inline size-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="mr-1.5 inline size-4" aria-hidden="true" />}
            Selesai
          </Button>
        </div>
        {!ticket.afterPhotoUrl && <p className="mt-2 text-xs text-neutral-500">Tombol aktif setelah tim mengirim foto bukti.</p>}
        {finalize.isError && <p role="alert" className="mt-2 text-xs text-danger-700">{finalize.error.message}</p>}
      </section>}

      {beforeOpen && ticket.photoUrl && (
        <Modal
          title="Foto laporan"
          caption={ticket.ticketNumber}
          icon={ImagePlus}
          onClose={() => setBeforeOpen(false)}
          footer={<Button type="button" variant="secondary" className="flex-1" onClick={() => setBeforeOpen(false)}>Tutup</Button>}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ticket.photoUrl} alt={`Foto laporan ${ticket.ticketNumber}`} className="w-full rounded-lg border border-neutral-200 object-contain" />
        </Modal>
      )}

      {proofOpen && ticket.afterPhotoUrl && (
        <Modal
          title="Bukti hasil perbaikan"
          caption={ticket.ticketNumber}
          icon={ImagePlus}
          onClose={() => setProofOpen(false)}
          footer={<Button type="button" variant="secondary" className="flex-1" onClick={() => setProofOpen(false)}>Tutup</Button>}
        >
          <img src={ticket.afterPhotoUrl} alt={`Bukti hasil perbaikan ${ticket.ticketNumber}`} className="w-full rounded-lg border border-neutral-200 object-contain" />
        </Modal>
      )}

      {rejectOpen && (
        <Modal
          title="Tolak bukti hasil?"
          caption={`${ticket.ticketNumber} — tim diminta mengirim foto ulang`}
          icon={CircleX}
          onClose={() => { setRejectOpen(false); setRejectReason(""); }}
          footer={
            <>
              <Button type="button" variant="secondary" className="flex-1" onClick={() => { setRejectOpen(false); setRejectReason(""); }}>Batal</Button>
              <Button
                type="button"
                variant="danger"
                className="flex-1"
                disabled={rejectReason.trim().length < 3 || reject.isPending}
                onClick={() => reject.mutate()}
              >
                {reject.isPending ? "Menyimpan..." : "Tolak bukti"}
              </Button>
            </>
          }
        >
          <label htmlFor="reject-reason" className="text-sm font-medium text-neutral-900">Alasan penolakan</label>
          <textarea
            id="reject-reason"
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="mis. Foto buram, kerusakan tidak terlihat jelas."
            className="mt-1.5 w-full rounded-xl border border-neutral-300 bg-neutral-0 p-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:border-accent-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/25"
          />
          <p className="mt-1 text-xs text-neutral-500">Alasan ditampilkan ke tim sebagai panduan foto ulang.</p>
          {reject.isError && <p role="alert" className="mt-2 text-xs text-danger-700">{reject.error.message}</p>}
        </Modal>
      )}

      {canCancel && <section className="mt-4 rounded-xl border border-danger-200 bg-danger-50 p-3">
        <h2 className="text-sm font-semibold text-neutral-900">Batalkan tiket</h2>
        <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={2} placeholder="Alasan pembatalan (minimal 3 karakter)" className="mt-2 w-full rounded-lg border border-neutral-300 bg-neutral-0 p-2 text-xs text-neutral-800" />
        <Button type="button" variant="danger" className="mt-2 min-h-0 px-3 py-2 text-xs" disabled={cancelReason.trim().length < 3 || cancel.isPending} onClick={() => cancel.mutate()}>{cancel.isPending ? <Loader2 className="mr-1.5 inline size-4 animate-spin" /> : <CircleX className="mr-1.5 inline size-4" />}Batalkan tiket</Button>
        {cancel.isError && <p role="alert" className="mt-2 text-xs text-danger-700">{cancel.error.message}</p>}
      </section>}
  </div>;
}
