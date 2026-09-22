"use client";

import { useState } from "react";
import { HardHat, ListOrdered, Map, RefreshCw, Search, TriangleAlert, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import LocationMap from "@/components/map/LocationMapClient";
import { TicketCard } from "@/components/ticket/TicketCard";
import { useTickets } from "@/features/dashboard/dashboardApi";
import type { Ticket, TicketQueryParams } from "@/features/dashboard/dashboardTypes";

function isSlaEscalated(ticket: Ticket) {
  return ticket.status !== "completed" && Date.now() - Date.parse(ticket.createdAt) > 3 * 24 * 60 * 60 * 1000;
}

const categories: { value: Ticket["category"] | ""; label: string }[] = [
  { value: "", label: "Semua kategori" }, { value: "pothole", label: "Jalan berlubang" },
  { value: "street_light", label: "PJU mati" }, { value: "other", label: "Lainnya" },
];

export function DashboardView() {
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<TicketQueryParams["category"] | "">("");
  const [district, setDistrict] = useState("");
  const params: TicketQueryParams = { status: "queued", page, ...(category && { category }), ...(district && { district }) };
  const query = useTickets(params);
  const tickets = query.data?.data ?? [];

  function applyFilters() { setPage(1); }

  return <main className="min-h-screen bg-neutral-50 px-4 py-6 text-neutral-700 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl">
    <header className="mb-6"><p className="text-sm font-medium text-primary-700">NadiKota · Admin Dinas</p><h1 className="mt-1 text-2xl font-bold text-neutral-900 sm:text-3xl">Antrean perbaikan</h1><p className="mt-1 text-sm text-neutral-500">Tiket tervalidasi berdasarkan prioritas transparan.</p></header>
    <section aria-label="Ringkasan KPI" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5"><KpiCard icon={ListOrdered} label="Tiket halaman ini" value={query.data?.meta.total ?? "—"} /><KpiCard icon={Search} label="Perlu tinjauan" value="—" /><KpiCard icon={HardHat} label="Dalam perbaikan" value="—" /><KpiCard icon={Users} label="Pelapor unik" value={tickets.reduce((total, ticket) => total + ticket.uniqueReporterCount, 0)} /><KpiCard icon={TriangleAlert} label="Eskalasi SLA" value={tickets.filter(isSlaEscalated).length} danger /></section>
    <Card className="mb-6"><div className="flex flex-col gap-3 md:flex-row md:items-end"><label className="flex-1 text-sm font-medium text-neutral-900">Kategori<select value={category} onChange={(event) => { setCategory(event.target.value as TicketQueryParams["category"] | ""); applyFilters(); }} className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 bg-neutral-0 px-3 font-normal text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2">{categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="flex-1 text-sm font-medium text-neutral-900">Kecamatan<input value={district} onChange={(event) => setDistrict(event.target.value)} placeholder="Cari kecamatan" className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 px-3 font-normal text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2" /></label><Button type="button" variant="secondary" onClick={applyFilters}><RefreshCw className="mr-2 inline size-5" aria-hidden="true" />Terapkan filter</Button></div></Card>
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]"><div><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold text-neutral-900">Tiket prioritas</h2><span className="text-sm text-neutral-500">{query.data?.meta.total ?? 0} tiket</span></div>{query.isLoading && <div className="space-y-3"><Skeleton className="h-36" /><Skeleton className="h-36" /><Skeleton className="h-36" /></div>}{query.isError && <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />}{!query.isLoading && !query.isError && tickets.length === 0 && <EmptyState title="Belum ada tiket dalam antrean" description="Tiket tervalidasi akan tampil di sini setelah tersedia." />}{!query.isLoading && !query.isError && tickets.length > 0 && <div className="space-y-3">{tickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)}</div>}{query.data && query.data.meta.lastPage > 1 && <nav className="mt-5 flex items-center justify-between" aria-label="Pagination tiket"><Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Sebelumnya</Button><span className="text-sm text-neutral-500">Halaman {page} dari {query.data.meta.lastPage}</span><Button type="button" variant="secondary" disabled={page >= query.data.meta.lastPage} onClick={() => setPage((value) => value + 1)}>Berikutnya</Button></nav>}</div><aside className="min-h-80 rounded-xl border border-neutral-200 bg-neutral-100 p-2" aria-label="Peta tiket"><div className="mb-2 flex items-center gap-2 px-2 text-sm font-semibold text-neutral-900"><Map className="size-5" aria-hidden="true" />Peta tiket</div><div className="h-[calc(100%-2rem)] min-h-72"><LocationMap tickets={tickets} /></div></aside></section>
  </div></main>;
}

function KpiCard({ icon: Icon, label, value, danger = false }: { icon: typeof ListOrdered; label: string; value: number | string; danger?: boolean }) {
  return <Card><div className={`flex items-center gap-2 text-sm ${danger ? "text-danger-700" : "text-neutral-500"}`}><Icon className="size-5" aria-hidden="true" />{label}</div><p className="mt-2 text-2xl font-bold text-neutral-900">{value}</p></Card>;
}