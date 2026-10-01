"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock, HardHat, ListOrdered, Percent, RefreshCw, Search, TriangleAlert, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { getAnalyticsSummary } from "@/features/dashboard/dashboardApi";

const formatNum = (n: number) => n.toLocaleString("id-ID");
const formatHours = (h: number | null | undefined) =>
  h == null ? "—" : h.toLocaleString("id-ID", { maximumFractionDigits: 1 });

export function DashboardView() {
  const kpiQuery = useQuery({ queryKey: ["analytics-summary"], queryFn: getAnalyticsSummary, staleTime: 60_000 });
  const s = kpiQuery.data;
  const byStatus = s?.tickets_by_status ?? {};

  return (
    <main className="absolute inset-0 overflow-y-auto bg-neutral-50 px-4 py-6 pb-24 text-neutral-700 md:pb-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-primary-700">NadiKota · Admin Dinas</p>
            <h1 className="mt-1 text-2xl font-bold text-neutral-900 sm:text-3xl">Dashboard</h1>
            <p className="mt-1 text-sm text-neutral-500">Ringkasan pelaporan masuk dan penanganan tiket.</p>
          </div>
          <Button type="button" variant="secondary" disabled={kpiQuery.isFetching} onClick={() => void kpiQuery.refetch()}>
            <RefreshCw className={`mr-2 inline size-5 ${kpiQuery.isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
            Muat ulang
          </Button>
        </header>

        {/* KPI — semuanya dari backend /analytics/summary */}
        <section aria-label="Ringkasan KPI" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {kpiQuery.isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : kpiQuery.isError ? (
            <div className="col-span-full"><ErrorState message={kpiQuery.error.message} onRetry={() => void kpiQuery.refetch()} /></div>
          ) : (
            <>
              <KpiCard icon={ListOrdered} label="Total tiket" value={formatNum(s?.total_tickets ?? 0)} />
              <KpiCard icon={Search} label="Perlu tinjauan" value={formatNum(byStatus.needs_review ?? 0)} />
              <KpiCard icon={HardHat} label="Dalam perbaikan" value={formatNum(byStatus.in_progress ?? 0)} />
              <KpiCard icon={Users} label="Pelapor unik" value={formatNum(s?.unique_reporters ?? 0)} />
              <KpiCard icon={TriangleAlert} label="Eskalasi SLA" value={formatNum(s?.sla_escalated ?? 0)} danger />
            </>
          )}
        </section>

        {/* Grafik pelaporan 14 hari */}
        <Card className="mb-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-neutral-900">Grafik Pelaporan</h2>
            <p className="text-sm text-neutral-500">
              Jumlah laporan masuk 14 hari terakhir{s ? ` — total ${formatNum(s.chart.reduce((total, d) => total + d.count, 0))} laporan` : ""}.
            </p>
          </div>
          {kpiQuery.isLoading && <Skeleton className="h-56 rounded-xl" />}
          {kpiQuery.isError && <ErrorState message={kpiQuery.error.message} onRetry={() => void kpiQuery.refetch()} />}
          {s && <ReportChart data={s.chart} />}
        </Card>

        {/* Statistik turunan dari backend */}
        {!kpiQuery.isLoading && !kpiQuery.isError && s && (
          <section aria-label="Statistik penanganan" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiCard icon={Clock} label="Waktu respons (jam)" value={formatHours(s.response_time)} />
            <KpiCard icon={TrendingUp} label="Penyelesaian (jam)" value={formatHours(s.completion_time)} />
            <KpiCard icon={Percent} label="Konsolidasi (%)" value={formatNum(Number(s.consolidation_rate ?? 0))} />
          </section>
        )}
      </div>
    </main>
  );
}

/** Grafik batang sederhana (tanpa library) — data pelaporan per hari. */
function ReportChart({ data }: { data: { date: string; count: number }[] }) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-neutral-500">Belum ada data pelaporan.</p>;
  }
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((t, d) => t + d.count, 0);

  return (
    <div>
      <div className="flex h-56 items-end gap-1 sm:gap-2" role="img" aria-label={`Grafik batang laporan 14 hari terakhir, total ${total} laporan`}>
        {data.map((d) => {
          const [year, month, day] = d.date.split("-");
          const pct = d.count > 0 ? Math.max(6, (d.count / max) * 100) : 2;
          return (
            <div key={d.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${Number(day)}/${Number(month)}/${year} — ${d.count} laporan`}>
              <span className="text-[10px] font-semibold text-neutral-600">{d.count > 0 ? d.count : ""}</span>
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-md bg-primary-800 transition-colors hover:bg-primary-600"
                  style={{ height: `${pct}%` }}
                  aria-hidden="true"
                />
              </div>
              <span className="text-[9px] text-neutral-400 sm:text-[10px]">{Number(day)}/{Number(month)}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3 text-xs text-neutral-500">
        <span>Sumbu horizontal: tanggal (hari/bulan)</span>
        <span>Puncak harian: {max} laporan</span>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, danger = false }: { icon: typeof ListOrdered; label: string; value: number | string; danger?: boolean }) {
  return (
    <Card>
      <div className={`flex items-center gap-2 text-sm ${danger ? "text-danger-700" : "text-neutral-500"}`}>
        <Icon className="size-5" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold text-neutral-900">{value}</p>
    </Card>
  );
}
