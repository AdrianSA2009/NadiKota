"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, ChevronDown, CircleX, ShieldQuestion } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { getReviewTickets, reviewTicket } from "@/features/dashboard/dashboardApi";
import type { DangerLevel, ReviewTicket } from "@/features/dashboard/dashboardTypes";
import { dangerLevelLabel } from "@/lib/formatters";

const reasonSchema = z.string().trim().min(10, "Alasan wajib diisi minimal 10 karakter.");

export default function ReviewPage() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["review-tickets", page], queryFn: () => getReviewTickets(page) });
  if (query.isLoading) return <main className="min-h-screen bg-neutral-50 px-4 py-6"><div className="mx-auto max-w-3xl space-y-4"><Skeleton className="h-10" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div></main>;
  if (query.isError) return <main className="min-h-screen bg-neutral-50 px-4 py-6"><div className="mx-auto max-w-3xl"><ErrorState message={query.error.message} onRetry={() => void query.refetch()} /></div></main>;
  if (!query.data || query.data.data.length === 0) return <main className="min-h-screen bg-neutral-50 px-4 py-6"><div className="mx-auto max-w-3xl"><EmptyState title="Tidak ada tiket untuk ditinjau" description="Tiket yang memerlukan tinjauan akan tampil di sini." /></div></main>;
  const reviewData = query.data;
  return <main className="absolute inset-0 overflow-y-auto bg-neutral-50 px-4 py-6 pb-24 text-neutral-700 md:pb-6"><div className="mx-auto max-w-3xl"><header><p className="flex items-center gap-2 text-sm font-medium text-info-800"><ShieldQuestion className="size-5" aria-hidden="true" />Tinjauan tiket</p><h1 className="mt-1 text-2xl font-bold text-neutral-900">Tiket perlu tinjauan</h1><p className="mt-1 text-sm text-neutral-500">Setiap keputusan wajib memiliki alasan dan dicatat sebagai audit.</p></header><div className="mt-6 space-y-4">{reviewData.data.map((ticket) => <ReviewCard key={ticket.id} ticket={ticket} onDone={() => void queryClient.invalidateQueries({ queryKey: ["review-tickets"] })} />)}</div>{reviewData.meta.lastPage > 1 && <nav className="mt-6 flex items-center justify-between" aria-label="Pagination tinjauan"><Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Sebelumnya</Button><span className="text-sm text-neutral-500">Halaman {page} dari {reviewData.meta.lastPage}</span><Button type="button" variant="secondary" disabled={page >= reviewData.meta.lastPage} onClick={() => setPage((value) => value + 1)}>Berikutnya</Button></nav>}</div></main>;
}

function ReviewCard({ ticket, onDone }: { ticket: ReviewTicket; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [danger, setDanger] = useState<DangerLevel>(ticket.dangerLevel ?? "hati-hati");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const mutation = useMutation({ mutationFn: (decision: "approved" | "rejected") => reviewTicket(ticket.id, decision, reason, danger), onSuccess: onDone });
  const category = { pothole: "Jalan berlubang", street_light: "PJU mati", other: "Lainnya" }[ticket.category];
  const ai = ticket.aiAnalysis;
  const aiDecision = ai ? ({ accepted: "Diterima AI", rejected: "Ditolak AI", suspicious: "Perlu perhatian" }[ai.decision ?? ""] ?? ai.decision) : null;
  const aiSeverity = ai?.severity ? ({ low: "Ringan", moderate: "Sedang", high: "Tinggi", critical: "Kritis" }[ai.severity] ?? ai.severity) : null;
  function toggle() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }
  function decide(decision: "approved" | "rejected") { const result = reasonSchema.safeParse(reason); if (!result.success) { setValidationError(result.error.issues[0]?.message ?? "Alasan wajib diisi."); return; } setValidationError(null); mutation.mutate(decision); }
  return <Card>
    <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-center justify-between gap-3 text-left">
      <span className="min-w-0"><span className="block truncate text-xs font-medium text-neutral-500">{ticket.ticketNumber}</span><span className="block truncate text-lg font-semibold text-neutral-900">{category}</span></span>
      <span className="flex shrink-0 items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${danger === "bahaya" ? "border-danger-600 bg-danger-50 text-danger-700" : "border-warning-600 bg-warning-50 text-warning-800"}`}>{dangerLevelLabel(danger)}</span><ChevronDown className={`size-5 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" /></span>
    </button>
    <div ref={formRef} hidden={!open} className="mt-3">
    <div className="flex items-start justify-between gap-3"><div><p className="text-sm text-neutral-500">Tingkat bahaya: <span className={danger === "bahaya" ? "font-semibold text-danger-700" : "font-semibold text-warning-800"}>{dangerLevelLabel(danger)}</span></p></div><span className="inline-flex items-center gap-1.5 rounded-full border border-info-600 bg-info-50 px-2.5 py-1 text-xs font-semibold text-info-800"><ShieldQuestion className="size-4" aria-hidden="true" />Perlu Tinjauan</span></div>
    {ticket.photoUrl
      ? <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={ticket.photoUrl} alt={`Foto laporan ${ticket.ticketNumber}`} className="max-h-64 w-full object-cover" /></div>
      : <p className="mt-3 text-sm text-neutral-500">Foto tidak tersedia.</p>}
    <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm"><p className="font-semibold text-neutral-900">Analisis AI</p>{ai
      ? <div className="mt-1 space-y-0.5 text-neutral-600"><p>Keputusan: {aiDecision ?? "—"}</p><p>Keparahan: {aiSeverity ?? "—"}</p>{ai.confidence != null && <p>Keyakinan: {Math.round(ai.confidence * 100)}%</p>}{ai.reason && <p>Alasan: {ai.reason}</p>}</div>
      : <p className="mt-1 text-neutral-500">Belum ada analisis AI.</p>}</div>
    <fieldset className="mt-4"><legend className="text-sm font-medium text-neutral-900">Tingkat bahaya (bisa diubah)</legend><div className="mt-2 grid grid-cols-2 gap-2"><Button type="button" variant={danger === "bahaya" ? "primary" : "secondary"} aria-pressed={danger === "bahaya"} onClick={() => setDanger("bahaya")}>Bahaya</Button><Button type="button" variant={danger === "hati-hati" ? "primary" : "secondary"} aria-pressed={danger === "hati-hati"} onClick={() => setDanger("hati-hati")}>Hati-hati</Button></div></fieldset>
    <label htmlFor={`reason-${ticket.id}`} className="mt-4 block text-sm font-medium text-neutral-900">Alasan keputusan<textarea id={`reason-${ticket.id}`} value={reason} onChange={(event) => setReason(event.target.value)} aria-invalid={Boolean(validationError)} aria-describedby={`reason-error-${ticket.id}`} rows={3} className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-0 p-3 text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2" placeholder="Jelaskan dasar keputusan." /></label>{validationError && <p id={`reason-error-${ticket.id}`} className="mt-1 text-sm text-danger-700">{validationError}</p>}<div className="mt-4 flex flex-col gap-3 sm:flex-row"><Button type="button" onClick={() => decide("approved")} disabled={mutation.isPending}><BadgeCheck className="mr-2 inline size-5" aria-hidden="true" />Setujui</Button><Button type="button" variant="danger" onClick={() => decide("rejected")} disabled={mutation.isPending}><CircleX className="mr-2 inline size-5" aria-hidden="true" />Tolak</Button></div>{mutation.isError && <p role="alert" className="mt-3 text-sm text-danger-700">{mutation.error.message}</p>}
    </div>
  </Card>;
}
