"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Truck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { useToastStore } from "@/lib/toastStore";
import { getDispatchTicket, getFieldTeams } from "@/features/dashboard/dashboardApi";
import type { DispatchTicket, Team } from "@/features/dashboard/dashboardTypes";
import { TicketSummary, TeamPicker, useAssignForm } from "@/components/dispatch/AssignTicket";

/**
 * Halaman MOBILE "Tugaskan Tiket" — header sticky + ringkasan tiket + daftar tim
 * radio satu kolom + tombol aksi sticky. Bisa dibuka langsung/di-refresh.
 */
export default function AssignTicketPage() {
  const params = useParams<{ ticketId: string }>();
  const router = useRouter();
  const showToast = useToastStore((s) => s.show);
  const id = Number(params.ticketId);
  const invalid = !Number.isInteger(id) || id <= 0;

  const ticketQuery = useQuery({ queryKey: ["dispatch-ticket", id], queryFn: () => getDispatchTicket(id), enabled: !invalid });
  const teamsQuery = useQuery({ queryKey: ["field-teams"], queryFn: getFieldTeams });

  const header = (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-neutral-200 bg-neutral-0/95 px-4 py-3 backdrop-blur">
      <button type="button" aria-label="Kembali" onClick={() => router.push("/dispatch")} className="-ml-1 rounded-lg p-2 text-neutral-600 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500">
        <ArrowLeft className="size-5" aria-hidden="true" />
      </button>
      <div className="min-w-0">
        <h1 className="truncate text-base font-bold text-neutral-900">Tugaskan tiket</h1>
        <p className="truncate text-xs text-neutral-500">Pilih tim penanggung jawab perbaikan.</p>
      </div>
    </header>
  );

  if (invalid) {
    return <main className="absolute inset-0 flex flex-col bg-neutral-50 pb-20 md:pb-0">{header}<div className="flex-1 overflow-y-auto px-4 py-5"><ErrorState message="Tiket tidak ditemukan." onRetry={() => router.push("/dispatch")} /></div></main>;
  }
  if (ticketQuery.isLoading || teamsQuery.isLoading) {
    return <main className="absolute inset-0 flex flex-col bg-neutral-50 pb-20 md:pb-0">{header}<div className="flex-1 space-y-4 overflow-y-auto px-4 py-5"><Skeleton className="h-32" /><Skeleton className="h-14" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div></main>;
  }
  if (ticketQuery.isError) {
    return <main className="absolute inset-0 flex flex-col bg-neutral-50 pb-20 md:pb-0">{header}<div className="flex-1 overflow-y-auto px-4 py-5"><ErrorState message={ticketQuery.error.message} onRetry={() => void ticketQuery.refetch()} /></div></main>;
  }
  if (!ticketQuery.data) {
    return <main className="absolute inset-0 flex flex-col bg-neutral-50">{header}<div className="flex-1 space-y-4 overflow-y-auto px-4 py-5"><Skeleton className="h-32" /></div></main>;
  }

  return (
    <AssignTicketForm
      header={header}
      ticket={ticketQuery.data}
      teams={teamsQuery.data ?? []}
      onDone={(message) => { showToast(message, "success"); router.push("/dispatch"); }}
      onError={(message) => showToast(message, "info")}
    />
  );
}

function AssignTicketForm({ header, ticket, teams, onDone, onError }: {
  header: React.ReactNode;
  ticket: DispatchTicket;
  teams: Team[];
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const form = useAssignForm({ ticket, teams, onDone, onError });

  // pb-20 di mobile: ruang bottom bar (fixed) supaya tombol aksi sticky tidak tertutup.
  return (
    <main className="absolute inset-0 flex flex-col bg-neutral-50 pb-20 md:pb-0">
      {header}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto w-full max-w-lg space-y-5">
          <TicketSummary ticket={ticket} />
          <section>
            <h2 className="mb-2 border-b border-neutral-100 pb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Pilih tim</h2>
            <TeamPicker chosen={form.chosen} onChoose={form.setChosen} search={form.search} onSearch={form.setSearch} teams={form.teams} recommended={form.recommended} />
          </section>
        </div>
      </div>

      <footer className="border-t border-neutral-200 bg-neutral-0 px-4 py-3" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>
        <div className="mx-auto w-full max-w-lg">
          <Button type="button" className="w-full justify-center" disabled={!form.chosen || form.assign.isPending} onClick={() => form.assign.mutate()}>
            <Truck className="mr-2 inline size-4" aria-hidden="true" />
            {form.assign.isPending ? "Menyimpan..." : form.isReassign ? "Simpan perubahan" : "Tugaskan ke tim ini"}
          </Button>
        </div>
      </footer>
    </main>
  );
}
