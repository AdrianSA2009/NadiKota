import { BadgeCheck, CircleCheck, ListOrdered, Send, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type TimelineStatus = "reported" | "verified" | "queued" | "in_progress" | "completed";
const STATUS: Record<TimelineStatus, { label: string; icon: LucideIcon }> = {
  reported: { label: "Dilaporkan", icon: Send }, verified: { label: "Diverifikasi", icon: BadgeCheck },
  queued: { label: "Dalam Antrean", icon: ListOrdered }, in_progress: { label: "Dalam Perbaikan", icon: Wrench },
  completed: { label: "Selesai", icon: CircleCheck },
};
interface StatusTimelineProps {
  current: TimelineStatus;
  /** Waktu terjadinya tiap langkah (ISO string) — tampil di bawah label bila ada. */
  times?: Partial<Record<TimelineStatus, string>>;
  /** Tiket batal/ditolak — stage yang sedang aktif diwarnai merah. */
  danger?: boolean;
}

/** "3 Okt 2026, 19.45" — tanggal + bulan + tahun + jam. */
function formatStepTime(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export function StatusTimeline({ current, times, danger = false }: StatusTimelineProps) {
  const statuses = Object.keys(STATUS) as TimelineStatus[];
  const currentIndex = statuses.indexOf(current);
  return (
    <ol className="space-y-0">
      {statuses.map((status, idx) => {
        const Icon = STATUS[status].icon;
        const time = times?.[status] ? formatStepTime(times[status] as string) : null;
        const reached = idx <= currentIndex;
        const done = status === "completed" && reached;
        const active = idx === currentIndex && !done;
        const passed = reached && !active && !done;
        const bubble = active
          ? danger ? "bg-danger-600" : "bg-warning-600"
          : done ? "bg-success-700"
          : passed ? "bg-success-50"
          : "bg-neutral-100";
        const iconColor = active || done ? "text-neutral-0" : passed ? "text-success-600" : "text-neutral-400";
        const labelColor = active
          ? danger ? "font-bold text-danger-700" : "font-bold text-warning-800"
          : done ? "font-bold text-success-700" : passed ? "font-semibold text-success-600" : "text-neutral-500";
        const connectorColor = done || passed ? "text-success-600" : "text-neutral-300";
        const horizontalColor = active
          ? danger ? "border-danger-600" : "border-warning-600"
          : done || passed ? "border-success-600" : "border-neutral-300";
        const timeColor = active ? danger ? "text-danger-700" : "text-warning-800" : done || passed ? "text-success-700" : "text-neutral-500";
        return (
          <li key={status} className="flex min-h-10 gap-3 text-sm">
            <span className="flex w-7 shrink-0 flex-col items-center" aria-hidden="true">
              <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${bubble}`}>
                <Icon className={`size-4 ${iconColor}`} />
              </span>
              {idx < statuses.length - 1 && <span className={`-mt-px flex-1 border-l-2 ${connectorColor}`} />}
            </span>
            <span className={`shrink-0 pt-1 ${labelColor}`}>{STATUS[status].label}</span>
            <span className={`mt-[13px] h-0 min-w-6 flex-1 border-t-2 border-dashed ${reached ? horizontalColor : "border-transparent"}`} aria-hidden="true" />
            {time && <span className={`shrink-0 pt-1 text-xs ${active ? "font-semibold" : "font-normal"} ${timeColor}`}>{time}</span>}
          </li>
        );
      })}
    </ol>
  );
}
