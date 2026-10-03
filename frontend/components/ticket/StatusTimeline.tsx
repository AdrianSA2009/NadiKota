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
    <ol className="space-y-3">
      {statuses.map((status, idx) => {
        const Icon = STATUS[status].icon;
        const time = times?.[status] ? formatStepTime(times[status] as string) : null;
        const reached = idx <= currentIndex;
        const active = idx === currentIndex;
        const done = status === "completed" && reached;
        // Stage berlangsung: bubble solid navy — hijau utk "Selesai", merah kalau batal/ditolak.
        const bubble = active
          ? danger ? "bg-danger-600" : done ? "bg-success-600" : "bg-primary-800"
          : done ? "bg-success-50"
          : reached ? "bg-primary-50" : "bg-neutral-100";
        const iconColor = active ? "text-neutral-0" : done ? "text-success-700" : reached ? "text-primary-800" : "text-neutral-400";
        const labelColor = active
          ? danger ? "text-danger-700" : done ? "text-success-700" : "text-primary-800"
          : done ? "font-semibold text-success-700" : reached ? "font-semibold text-neutral-900" : "text-neutral-500";
        // Warna stage aktif merentang: ikon → label → garis --- waktu.
        const lineColor = active
          ? danger ? "border-danger-600" : done ? "border-success-600" : "border-primary-800"
          : "border-neutral-300";
        const timeColor = active
          ? danger ? "text-danger-700" : done ? "text-success-700" : "text-primary-800"
          : "text-neutral-500";
        return (
          <li key={status} className="flex items-center gap-3 text-sm">
            <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${bubble}`} aria-hidden="true">
              <Icon className={`size-4 ${iconColor}`} />
            </span>
            <span className={`shrink-0 ${labelColor}`}>{STATUS[status].label}</span>
            {time && (
              <>
                <span className={`h-px min-w-8 flex-1 border-b border-dashed ${lineColor}`} aria-hidden="true" />
                <span className={`shrink-0 text-xs ${active ? "font-semibold" : "font-normal"} ${timeColor}`}>{time}</span>
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}
