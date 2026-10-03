"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CircleHelp, Construction, Lightbulb, MapPin, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusTimeline } from "@/components/ticket/StatusTimeline";
import { getTicket, type TicketDetail } from "@/features/reports/reportApi";

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const ticketId = Number(params.id);
  const query = useQuery({ queryKey: ["ticket", ticketId], queryFn: () => getTicket(ticketId), enabled: Number.isInteger(ticketId) });
  // Lightbox foto bukti — state & effect sebelum early return (rules of hooks).
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPreview(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  if (query.isLoading) return <main className="min-h-screen bg-neutral-50 px-4 py-6"><div className="mx-auto max-w-lg space-y-4"><Skeleton className="h-8" /><Skeleton className="h-48" /><Skeleton className="h-40" /></div></main>;
  if (query.isError) return <main className="min-h-screen bg-neutral-50 px-4 py-6"><div className="mx-auto max-w-lg"><ErrorState message={query.error.message} onRetry={() => void query.refetch()} /></div></main>;
  if (!query.data) return <main className="min-h-screen bg-neutral-50 px-4 py-6"><div className="mx-auto max-w-lg"><EmptyState title="Tiket tidak ditemukan" description="Tiket yang diminta tidak tersedia atau sudah tidak dapat diakses." /></div></main>;

  const ticket = query.data;
  const before = ticket.photos.find((photo) => photo.type === "before" && photo.photoUrl);
  const after = ticket.photos.find((photo) => photo.type === "after" && photo.photoUrl);
  const categoryLabel: Record<TicketDetail["category"], string> = { pothole: "Jalan berlubang", street_light: "PJU mati", other: "Lainnya" };
  // Tiket batal/ditolak/needs_review tak punya langkah sendiri di timeline → stage merah = stage terakhir yang terjadi.
  const terminal = ticket.status === "cancelled" || ticket.status === "rejected";
  // Waktu tiap langkah dari riwayat transisi status; fallback field tiket utk langkah awal & verifikasi.
  const times: Partial<Record<string, string>> = {};
  for (const h of ticket.statusHistories ?? []) {
    if (h.created_at) times[h.to_status] = h.created_at;
  }
  times.reported ??= ticket.createdAt;
  times.verified ??= ticket.verifiedAt ?? undefined;
  const STEP_ORDER = ["reported", "verified", "queued", "in_progress", "completed"] as const;
  const current: (typeof STEP_ORDER)[number] =
    ticket.status === "reported" || ticket.status === "verified" || ticket.status === "queued" || ticket.status === "in_progress" || ticket.status === "completed"
      ? ticket.status
      // Batal/ditolak/needs_review → stage terakhir yang punya waktu (titik berhentinya tiket).
      : ([...STEP_ORDER].reverse().find((s) => times[s]) ?? "reported");

  const CATEGORY_ICON = { pothole: Construction, street_light: Lightbulb, other: CircleHelp } as const;
  const CategoryIcon = CATEGORY_ICON[ticket.category];
  const statusVariant = (s: TicketDetail["status"]): "done" | "urgent" | "reported" | "verified" | "queued" | "in_progress" | "cancelled" | "needs_review" =>
    s === "completed" ? "done" : s === "rejected" ? "urgent" : s === "verified" ? "verified" : s;
  const photoPill = "mt-2 inline-block rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600";

  return <main className="min-h-screen bg-neutral-50 px-4 pb-28 pt-6 text-neutral-700 md:pb-6">
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Hero: gradasi navy + status */}
      <header className="rounded-2xl bg-gradient-to-br from-primary-800 to-primary-700 px-5 py-6 text-neutral-0 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-100/90">Tiket {ticket.ticketNumber}</p>
            <h1 className="mt-1.5 flex items-center gap-2.5 text-2xl font-bold"><CategoryIcon className="size-7 shrink-0" aria-hidden="true" />{categoryLabel[ticket.category]}</h1>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-primary-100/90"><MapPin className="size-4 shrink-0" aria-hidden="true" />{ticket.latitude.toFixed(6)}, {ticket.longitude.toFixed(6)}</p>
          </div>
          <Badge variant={statusVariant(ticket.status)} />
        </div>
      </header>
      <Card><h2 className="text-lg font-semibold text-neutral-900">Perjalanan tiket</h2><div className="mt-4"><StatusTimeline current={current} times={times} danger={terminal} /></div></Card>
      {terminal && <Card className="border-danger-200 bg-danger-50"><h2 className="text-lg font-semibold text-danger-800">{ticket.status === "cancelled" ? "Tiket dibatalkan" : "Tiket ditolak"}</h2><p className="mt-2 text-sm leading-6 text-danger-700">{ticket.cancelReason || "Tidak ada alasan yang dicatat."}</p></Card>}
      {ticket.status === "completed" && <Card><h2 className="text-lg font-semibold text-neutral-900">Bukti perbaikan</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">{before?.photoUrl && <figure><button type="button" onClick={() => setPreview(before.photoUrl ?? null)} className="block w-full cursor-zoom-in overflow-hidden rounded-xl" aria-label="Perbesar foto sebelum perbaikan"><img src={before.photoUrl} alt="Foto sebelum perbaikan" width={640} height={480} className="aspect-[4/3] w-full object-cover shadow-sm transition hover:scale-[1.02]" /></button><figcaption className={photoPill}>Sebelum</figcaption></figure>}{after?.photoUrl && <figure><button type="button" onClick={() => setPreview(after.photoUrl ?? null)} className="block w-full cursor-zoom-in overflow-hidden rounded-xl" aria-label="Perbesar foto sesudah perbaikan"><img src={after.photoUrl} alt="Foto sesudah perbaikan" width={640} height={480} className="aspect-[4/3] w-full object-cover shadow-sm transition hover:scale-[1.02]" /></button></figure>}</div>{!before && !after && <EmptyState title="Foto belum tersedia" description="Bukti foto perbaikan belum tersedia untuk tiket ini." />}</Card>}
    </div>
    {/* Lightbox: klik foto → lihat lebih jelas; klik backdrop / X / Esc untuk tutup */}
    {preview && (
      <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-neutral-900/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Pratinjau foto" onClick={() => setPreview(null)}>
        <button type="button" onClick={() => setPreview(null)} className="absolute right-4 top-4 rounded-full bg-neutral-0/10 p-2 text-neutral-0 transition hover:bg-neutral-0/25" aria-label="Tutup">
          <X className="size-6" />
        </button>
        <img src={preview} alt="Foto bukti perbaikan" className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
      </div>
    )}
  </main>;
}
