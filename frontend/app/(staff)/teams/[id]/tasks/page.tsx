"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, HardHat } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { CameraCapture } from "@/components/report/CameraCapture";
import { completeTicket } from "@/features/dashboard/dashboardApi";
import { apiClient } from "@/lib/apiClient";
import type { DispatchTicket } from "@/features/dashboard/dashboardTypes";

async function getTeamTasks(teamId: number): Promise<DispatchTicket[]> { const response = await apiClient.get<{ data: DispatchTicket[] }>(`/teams/${teamId}/tasks`); return response.data.data; }
export default function TeamTasksPage() {
  const teamId = Number(useParams<{ id: string }>().id); const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["team-tasks", teamId], queryFn: () => getTeamTasks(teamId), enabled: Number.isInteger(teamId) && teamId > 0 });
  const [photos, setPhotos] = useState<Record<number, File>>({});
  const mutation = useMutation({ mutationFn: ({ ticketId, photo }: { ticketId: number; photo: File }) => completeTicket(ticketId, photo), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["team-tasks", teamId] }) });
  if (query.isLoading) return <main className="min-h-screen bg-neutral-50 px-4 py-6"><div className="mx-auto max-w-3xl space-y-4"><Skeleton className="h-10" /><Skeleton className="h-48" /></div></main>;
  if (query.isError) return <main className="min-h-screen bg-neutral-50 px-4 py-6"><div className="mx-auto max-w-3xl"><ErrorState message={query.error.message} onRetry={() => void query.refetch()} /></div></main>;
  if (!query.data?.length) return <main className="min-h-screen bg-neutral-50 px-4 py-6"><div className="mx-auto max-w-3xl"><EmptyState title="Tidak ada tugas aktif" description="Tugas tim akan tampil setelah tiket ditugaskan." /></div></main>;
  return <main className="absolute inset-0 overflow-y-auto bg-neutral-50 px-4 py-6 pb-24 text-neutral-700 md:pb-6"><div className="mx-auto max-w-3xl"><header><p className="flex items-center gap-2 text-sm font-medium text-primary-700"><HardHat className="size-5" aria-hidden="true" />Tim lapangan</p><h1 className="mt-1 text-2xl font-bold text-neutral-900">Tugas aktif</h1></header><div className="mt-6 space-y-4">{query.data.map((ticket) => <Card key={ticket.id}><p className="text-xs text-neutral-500">{ticket.ticketNumber}</p><h2 className="mt-1 font-semibold text-neutral-900">{ticket.category === "pothole" ? "Jalan berlubang" : ticket.category === "street_light" ? "PJU mati" : "Lainnya"}</h2><div className="mt-4"><CameraCapture onCapture={(photo) => setPhotos((state) => ({ ...state, [ticket.id]: photo }))} /></div><Button type="button" className="mt-4" disabled={!photos[ticket.id] || mutation.isPending} onClick={() => { const photo = photos[ticket.id]; if (photo) mutation.mutate({ ticketId: ticket.id, photo }); }}><CircleCheck className="mr-2 inline size-5" aria-hidden="true" />Selesai</Button>{mutation.isError && <p role="alert" className="mt-2 text-sm text-danger-700">{mutation.error.message}</p>}</Card>)}</div></div></main>;
}
