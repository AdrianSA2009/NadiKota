"use client";

import Image from "next/image";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CircleCheck, CircleX, MapPin } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusTimeline } from "@/components/ticket/StatusTimeline";
import { getTicket, submitTicketFeedback, type TicketDetail } from "@/features/reports/reportApi";

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const ticketId = Number(params.id);
  const [feedback, setFeedback] = useState<"fixed" | "not_fixed" | null>(null);
  const query = useQuery({ queryKey: ["ticket", ticketId], queryFn: () => getTicket(ticketId), enabled: Number.isInteger(ticketId) });
  const feedbackMutation = useMutation({ mutationFn: (value: "fixed" | "not_fixed") => submitTicketFeedback(ticketId, value), onSuccess: (_, value) => setFeedback(value) });

  if (query.isLoading) return <main className="min-h-screen bg-neutral-50 px-4 py-6"><div className="mx-auto max-w-lg space-y-4"><Skeleton className="h-8" /><Skeleton className="h-48" /><Skeleton className="h-40" /></div></main>;
  if (query.isError) return <main className="min-h-screen bg-neutral-50 px-4 py-6"><div className="mx-auto max-w-lg"><ErrorState message={query.error.message} onRetry={() => void query.refetch()} /></div></main>;
  if (!query.data) return <main className="min-h-screen bg-neutral-50 px-4 py-6"><div className="mx-auto max-w-lg"><EmptyState title="Tiket tidak ditemukan" description="Tiket yang diminta tidak tersedia atau sudah tidak dapat diakses." /></div></main>;

  const ticket = query.data;
  const before = ticket.photos.find((photo) => photo.type === "before");
  const after = ticket.photos.find((photo) => photo.type === "after");
  const categoryLabel: Record<TicketDetail["category"], string> = { pothole: "Jalan berlubang", street_light: "PJU mati", other: "Lainnya" };
  const current = ticket.status === "needs_review" ? "reported" : ticket.status;

  return <main className="min-h-screen bg-neutral-50 px-4 py-6 text-neutral-700"><div className="mx-auto max-w-lg space-y-6">
    <header><p className="text-sm font-medium text-primary-700">{ticket.ticketNumber}</p><h1 className="mt-1 text-2xl font-bold text-neutral-900">{categoryLabel[ticket.category]}</h1><p className="mt-2 flex items-center gap-2 text-sm text-neutral-500"><MapPin className="size-4" aria-hidden="true" />{ticket.latitude.toFixed(6)}, {ticket.longitude.toFixed(6)}</p></header>
    <Card><h2 className="text-lg font-semibold text-neutral-900">Perjalanan tiket</h2><div className="mt-4"><StatusTimeline current={current} /></div></Card>
    {ticket.status === "completed" && <Card><h2 className="text-lg font-semibold text-neutral-900">Bukti perbaikan</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">{before && <figure><Image src={before.url} alt="Foto sebelum perbaikan" width={640} height={480} className="aspect-[4/3] rounded-lg object-cover" /><figcaption className="mt-2 text-sm text-neutral-500">Sebelum</figcaption></figure>}{after && <figure><Image src={after.url} alt="Foto sesudah perbaikan" width={640} height={480} className="aspect-[4/3] rounded-lg object-cover" /><figcaption className="mt-2 text-sm text-neutral-500">Sesudah</figcaption></figure>}</div>{!before && !after && <EmptyState title="Foto belum tersedia" description="Bukti foto perbaikan belum tersedia untuk tiket ini." />}<div className="mt-5 flex flex-col gap-3 sm:flex-row"><Button type="button" onClick={() => feedbackMutation.mutate("fixed")} disabled={feedbackMutation.isPending || feedback !== null}><CircleCheck className="mr-2 inline size-5" aria-hidden="true" />Sudah diperbaiki</Button><Button type="button" variant="secondary" onClick={() => feedbackMutation.mutate("not_fixed")} disabled={feedbackMutation.isPending || feedback !== null}><CircleX className="mr-2 inline size-5" aria-hidden="true" />Belum sesuai</Button></div>{feedback && <p role="status" className="mt-3 text-sm text-success-700">Konfirmasi warga sudah tercatat.</p>}</Card>}
  </div></main>;
}
