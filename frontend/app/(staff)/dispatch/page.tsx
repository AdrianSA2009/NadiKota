"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Truck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { assignTicket, getDispatchTickets, getFieldTeams } from "@/features/dashboard/dashboardApi";

export default function DispatchPage() {
  const queryClient = useQueryClient();
  const tickets = useQuery({ queryKey: ["dispatch-tickets"], queryFn: getDispatchTickets });
  const teams = useQuery({ queryKey: ["field-teams"], queryFn: getFieldTeams });
  const [selectedTeams, setSelectedTeams] = useState<Record<number, string>>({});
  const mutation = useMutation({ mutationFn: ({ ticketId, teamId }: { ticketId: number; teamId: number }) => assignTicket(ticketId, teamId), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["dispatch-tickets"] }) });
  if (tickets.isLoading || teams.isLoading) return <main className="min-h-screen bg-neutral-50 px-4 py-6"><div className="mx-auto max-w-3xl space-y-4"><Skeleton className="h-10" /><Skeleton className="h-40" /></div></main>;
  if (tickets.isError) return <main className="min-h-screen bg-neutral-50 px-4 py-6"><div className="mx-auto max-w-3xl"><ErrorState message={tickets.error.message} onRetry={() => void tickets.refetch()} /></div></main>;
  if (teams.isError) return <main className="min-h-screen bg-neutral-50 px-4 py-6"><div className="mx-auto max-w-3xl"><ErrorState message={teams.error.message} onRetry={() => void teams.refetch()} /></div></main>;
  if (!tickets.data?.length) return <main className="min-h-screen bg-neutral-50 px-4 py-6"><div className="mx-auto max-w-3xl"><EmptyState title="Tidak ada tiket untuk dispatch" description="Tiket dalam antrean akan tampil di sini." /></div></main>;
  return <main className="min-h-screen bg-neutral-50 px-4 py-6 text-neutral-700"><div className="mx-auto max-w-3xl"><header><p className="flex items-center gap-2 text-sm font-medium text-primary-700"><Truck className="size-5" aria-hidden="true" />Dispatch tim</p><h1 className="mt-1 text-2xl font-bold text-neutral-900">Tugaskan tiket</h1></header><div className="mt-6 space-y-4">{tickets.data.map((ticket) => <Card key={ticket.id}><p className="text-xs text-neutral-500">{ticket.ticketNumber}</p><h2 className="mt-1 font-semibold text-neutral-900">{ticket.category === "pothole" ? "Jalan berlubang" : ticket.category === "street_light" ? "PJU mati" : "Lainnya"}</h2><label htmlFor={`team-${ticket.id}`} className="mt-4 block text-sm font-medium text-neutral-900">Tim lapangan<select id={`team-${ticket.id}`} value={selectedTeams[ticket.id] ?? ""} onChange={(event) => setSelectedTeams((state) => ({ ...state, [ticket.id]: event.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 bg-neutral-0 px-3 text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"><option value="">Pilih tim</option>{teams.data?.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><Button type="button" className="mt-4" disabled={!selectedTeams[ticket.id] || mutation.isPending} onClick={() => mutation.mutate({ ticketId: ticket.id, teamId: Number(selectedTeams[ticket.id]) })}>Tugaskan ke tim</Button>{mutation.isError && <p role="alert" className="mt-2 text-sm text-danger-700">{mutation.error.message}</p>}</Card>)}</div></div></main>;
}
