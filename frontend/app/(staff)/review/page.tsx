"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, ChevronDown, CircleX, ShieldQuestion } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useIsMobile } from "@/hooks/useIsMobile";
import { getReviewTickets, reviewTicket } from "@/features/dashboard/dashboardApi";
import type { DangerLevel, ReviewTicket } from "@/features/dashboard/dashboardTypes";
import { dangerLevelLabel } from "@/lib/formatters";

const reasonSchema = z.string().trim().min(10, "Alasan wajib diisi minimal 10 karakter.");
const CATEGORY_LABEL: Record<ReviewTicket["category"], string> = { pothole: "Jalan berlubang", street_light: "PJU mati", other: "Lainnya" };

export default function ReviewPage() {
  const [page, setPage] = useState(1);
  // Desktop: tiket yang form keputusannya terbuka di modal.
  const [modalId, setModalId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const query = useQuery({ queryKey: ["review-tickets", page], queryFn: () => getReviewTickets(page) });

  if (query.isLoading) {
    return (
      <main className="absolute inset-0 overflow-y-auto bg-neutral-50 px-4 py-6 pb-24 text-neutral-700 md:pb-6 sm:px-6 xl:px-8">
        <div className="mx-auto w-full max-w-[1720px] space-y-4">
          <Skeleton className="h-8 w-64" />
          {/* Mobile — skeleton kartu */}
          <div className="space-y-3 md:hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-0 p-4 shadow-sm">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3 w-24" /><Skeleton className="h-5 w-40" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" /><Skeleton className="size-5 rounded" />
              </div>
            ))}
          </div>
          {/* Desktop — skeleton tabel */}
          <div className="hidden overflow-hidden rounded-xl border border-neutral-200 bg-neutral-0 shadow-sm md:block">
            <div className="flex gap-4 border-b border-neutral-200 bg-neutral-50 px-4 py-3">
              <Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-40" /><Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-24" /><Skeleton className="ml-auto h-4 w-20" />
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b border-neutral-100 px-4 py-3 last:border-b-0">
                <Skeleton className="size-9 shrink-0 rounded-lg" /><Skeleton className="h-4 w-44" />
                <Skeleton className="h-4 w-32" /><Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-4 w-28" /><Skeleton className="ml-auto h-8 w-24" />
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }
  if (query.isError) return <main className="absolute inset-0 overflow-y-auto bg-neutral-50 px-4 py-6 sm:px-6 xl:px-8"><div className="mx-auto w-full max-w-[1720px]"><ErrorState message={query.error.message} onRetry={() => void query.refetch()} /></div></main>;
  if (!query.data || query.data.data.length === 0) return <main className="absolute inset-0 overflow-y-auto bg-neutral-50 px-4 py-6 sm:px-6 xl:px-8"><div className="mx-auto w-full max-w-[1720px]"><EmptyState title="Tidak ada tiket untuk ditinjau" description="Tiket yang memerlukan tinjauan akan tampil di sini." /></div></main>;
  const reviewData = query.data;
  const onDone = () => {
    void queryClient.invalidateQueries({ queryKey: ["review-tickets"] });
    // Status tiket berubah → peta & list tiket ikut segar.
    void queryClient.invalidateQueries({ queryKey: ["tickets-map"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
  };
  const modalTicket = !isMobile ? (reviewData.data.find((t) => t.id === modalId) ?? null) : null;
  const header = <header><p className="flex items-center gap-2 text-sm font-medium text-info-800"><ShieldQuestion className="size-5" aria-hidden="true" />Tinjauan tiket</p><h1 className="mt-1 text-2xl font-bold text-neutral-900">Tiket perlu tinjauan</h1><p className="mt-1 text-sm text-neutral-500">Setiap keputusan wajib memiliki alasan dan dicatat sebagai audit.</p></header>;
  const pager = reviewData.meta.lastPage > 1 && <nav className="mt-6 flex items-center justify-between" aria-label="Pagination tinjauan"><Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Sebelumnya</Button><span className="text-sm text-neutral-500">Halaman {page} dari {reviewData.meta.lastPage}</span><Button type="button" variant="secondary" disabled={page >= reviewData.meta.lastPage} onClick={() => setPage((value) => value + 1)}>Berikutnya</Button></nav>;

  return <main className="absolute inset-0 overflow-y-auto bg-neutral-50 px-4 py-6 pb-24 text-neutral-700 md:pb-6 sm:px-6 xl:px-8">
    <div className="mx-auto w-full max-w-[1720px]">
      {header}

      {/* Mobile — kartu akordeon */}
      <div className="mt-6 space-y-4 md:hidden">
        {reviewData.data.map((ticket) => <ReviewCard key={ticket.id} ticket={ticket} onDone={onDone} />)}
      </div>

      {/* Desktop — tabel; baris Detail membuka modal */}
      <div className="mt-6 hidden overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-0 shadow-sm md:block">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <th scope="col" className="px-4 py-3">Tiket</th>
              <th scope="col" className="px-4 py-3">Analisis AI</th>
              <th scope="col" className="px-4 py-3">Tingkat bahaya</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Dibuat</th>
              <th scope="col" className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {reviewData.data.map((ticket) => {
              const ai = ticket.aiAnalysis;
              const aiLabel = ai ? ({ accepted: "Diterima AI", rejected: "Ditolak AI", suspicious: "Perlu perhatian" }[ai.decision ?? ""] ?? ai.decision) : "—";
              const danger = ticket.dangerLevel ?? "hati-hati";
              return (
                <tr key={ticket.id} className="transition-colors hover:bg-neutral-50/70">
                  <td className="px-4 py-3">
                    <span className="block truncate text-sm font-semibold text-neutral-900">{ticket.ticketNumber}</span>
                    <span className="block truncate text-xs text-neutral-500">{CATEGORY_LABEL[ticket.category]}</span>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{aiLabel}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${danger === "bahaya" ? "border-danger-600 bg-danger-50 text-danger-700" : "border-warning-600 bg-warning-50 text-warning-800"}`}>{dangerLevelLabel(danger)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-info-600 bg-info-50 px-2.5 py-1 text-xs font-semibold text-info-800">
                      <ShieldQuestion className="size-3.5" aria-hidden="true" />Perlu Tinjauan
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-neutral-500">{new Date(ticket.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</td>
                  <td className="px-4 py-3 text-right">
                    <Button type="button" variant="outline" size="sm" aria-haspopup="dialog" onClick={() => setModalId(ticket.id)}>Detail</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pager}
    </div>

    {/* Desktop — form keputusan dalam modal */}
    {modalTicket && (
      <Modal
        title={CATEGORY_LABEL[modalTicket.category]}
        caption={`${modalTicket.ticketNumber} · Perlu Tinjauan`}
        icon={ShieldQuestion}
        size="lg"
        onClose={() => setModalId(null)}
        footer={<Button type="button" variant="secondary" className="flex-1" onClick={() => setModalId(null)}>Tutup</Button>}
      >
        <ReviewDecisionForm ticket={modalTicket} onDone={onDone} />
      </Modal>
    )}
  </main>;
}

/** Kartu MOBILE — header ringkas (akordeon) + form keputusan. */
function ReviewCard({ ticket, onDone }: { ticket: ReviewTicket; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const danger = ticket.dangerLevel ?? "hati-hati";
  const formRef = useRef<HTMLDivElement>(null);
  function toggle() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }
  return <Card>
    <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-center justify-between gap-3 text-left">
      <span className="min-w-0"><span className="block truncate text-xs font-medium text-neutral-500">{ticket.ticketNumber}</span><span className="block truncate text-lg font-semibold text-neutral-900">{CATEGORY_LABEL[ticket.category]}</span></span>
      <span className="flex shrink-0 items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${danger === "bahaya" ? "border-danger-600 bg-danger-50 text-danger-700" : "border-warning-600 bg-warning-50 text-warning-800"}`}>{dangerLevelLabel(danger)}</span><ChevronDown className={`size-5 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" /></span>
    </button>
    {open && <div ref={formRef} className="mt-3"><ReviewDecisionForm ticket={ticket} onDone={onDone} /></div>}
  </Card>;
}

/**
 * Isi form keputusan (foto, analisis AI, tingkat bahaya, alasan, tombol setujui/tolak).
 * Satu sumber untuk kartu mobile & modal desktop.
 */
function ReviewDecisionForm({ ticket, onDone }: { ticket: ReviewTicket; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [danger, setDanger] = useState<DangerLevel>(ticket.dangerLevel ?? "hati-hati");
  const [validationError, setValidationError] = useState<string | null>(null);
  const mutation = useMutation({ mutationFn: (decision: "approved" | "rejected") => reviewTicket(ticket.id, decision, reason, danger), onSuccess: onDone });
  const ai = ticket.aiAnalysis;
  const aiDecision = ai ? ({ accepted: "Diterima AI", rejected: "Ditolak AI", suspicious: "Perlu perhatian" }[ai.decision ?? ""] ?? ai.decision) : null;
  const aiSeverity = ai?.severity ? ({ low: "Ringan", moderate: "Sedang", high: "Tinggi", critical: "Kritis" }[ai.severity] ?? ai.severity) : null;
  function decide(decision: "approved" | "rejected") { const result = reasonSchema.safeParse(reason); if (!result.success) { setValidationError(result.error.issues[0]?.message ?? "Alasan wajib diisi."); return; } setValidationError(null); mutation.mutate(decision); }
  return <>
    <div className="flex items-start justify-between gap-3"><div><p className="text-sm text-neutral-500">Tingkat bahaya: <span className={danger === "bahaya" ? "font-semibold text-danger-700" : "font-semibold text-warning-800"}>{dangerLevelLabel(danger)}</span></p></div><span className="inline-flex items-center gap-1.5 rounded-full border border-info-600 bg-info-50 px-2.5 py-1 text-xs font-semibold text-info-800"><ShieldQuestion className="size-4" aria-hidden="true" />Perlu Tinjauan</span></div>
    {ticket.photoUrl
      ? <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200"><Image src={ticket.photoUrl} alt={`Foto laporan ${ticket.ticketNumber}`} width={640} height={480} unoptimized className="max-h-64 w-full object-cover" /></div>
      : <p className="mt-3 text-sm text-neutral-500">Foto tidak tersedia.</p>}
    <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm"><p className="font-semibold text-neutral-900">Analisis AI</p>{ai
      ? <div className="mt-1 space-y-0.5 text-neutral-600"><p>Keputusan: {aiDecision ?? "—"}</p><p>Keparahan: {aiSeverity ?? "—"}</p>{ai.confidence != null && <p>Keyakinan: {Math.round(ai.confidence * 100)}%</p>}{ai.reason && <p>Alasan: {ai.reason}</p>}</div>
      : <p className="mt-1 text-neutral-500">Belum ada analisis AI.</p>}</div>
    <fieldset className="mt-4"><legend className="text-sm font-medium text-neutral-900">Tingkat bahaya (bisa diubah)</legend><div className="mt-2 grid grid-cols-2 gap-2"><Button type="button" variant={danger === "bahaya" ? "primary" : "secondary"} aria-pressed={danger === "bahaya"} onClick={() => setDanger("bahaya")}>Bahaya</Button><Button type="button" variant={danger === "hati-hati" ? "primary" : "secondary"} aria-pressed={danger === "hati-hati"} onClick={() => setDanger("hati-hati")}>Hati-hati</Button></div></fieldset>
    <label htmlFor={`reason-${ticket.id}`} className="mt-4 block text-sm font-medium text-neutral-900">Alasan keputusan<textarea id={`reason-${ticket.id}`} value={reason} onChange={(event) => setReason(event.target.value)} aria-invalid={Boolean(validationError)} aria-describedby={`reason-error-${ticket.id}`} rows={3} className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-0 p-3 text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2" placeholder="Jelaskan dasar keputusan." /></label>{validationError && <p id={`reason-error-${ticket.id}`} className="mt-1 text-sm text-danger-700">{validationError}</p>}<div className="mt-4 flex flex-col gap-3 sm:flex-row"><Button type="button" onClick={() => decide("approved")} disabled={mutation.isPending}><BadgeCheck className="mr-2 inline size-5" aria-hidden="true" />Setujui</Button><Button type="button" variant="danger" onClick={() => decide("rejected")} disabled={mutation.isPending}><CircleX className="mr-2 inline size-5" aria-hidden="true" />Tolak</Button></div>{mutation.isError && <p role="alert" className="mt-3 text-sm text-danger-700">{mutation.error.message}</p>}
  </>;
}
