import { BadgeCheck, CircleCheck, ListOrdered, Send, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type TimelineStatus = "reported" | "verified" | "queued" | "in_progress" | "completed";
const STATUS: Record<TimelineStatus, { label: string; icon: LucideIcon }> = {
  reported: { label: "Dilaporkan", icon: Send }, verified: { label: "Diverifikasi", icon: BadgeCheck },
  queued: { label: "Dalam Antrean", icon: ListOrdered }, in_progress: { label: "Dalam Perbaikan", icon: Wrench },
  completed: { label: "Selesai", icon: CircleCheck },
};
interface StatusTimelineProps { current: TimelineStatus; }

export function StatusTimeline({ current }: StatusTimelineProps) {
  const statuses = Object.keys(STATUS) as TimelineStatus[];
  const currentIndex = statuses.indexOf(current);
  return (
    <ol className="space-y-3">
      {statuses.map((status) => (
        <li key={status} className={`flex items-center gap-3 text-sm ${statuses.indexOf(status) <= currentIndex ? "font-semibold text-neutral-900" : "text-neutral-500"}`}>
          {(() => { const Icon = STATUS[status].icon; return <Icon className="size-5 text-primary-800" aria-hidden="true" />; })()}
          {STATUS[status].label}
        </li>
      ))}
    </ol>
  );
}
