import { BadgeCheck, Ban, CheckCircle2, Wrench } from "lucide-react";
import type { TeamStatus } from "@/features/dashboard/dashboardTypes";

const STYLES: Record<TeamStatus, { label: string; className: string; icon: typeof Ban }> = {
  tersedia: { label: "Tersedia", className: "border-success-600 bg-success-50 text-success-700", icon: CheckCircle2 },
  selesai: { label: "Selesai", className: "border-success-600 bg-success-50 text-success-700", icon: BadgeCheck },
  bertugas: { label: "Bertugas", className: "border-warning-600 bg-warning-50 text-warning-800", icon: Wrench },
  nonaktif: { label: "Nonaktif", className: "border-neutral-300 bg-neutral-100 text-neutral-600", icon: Ban },
};

/** Pill status tim: hijau (tersedia/selesai), kuning (bertugas), abu (nonaktif). */
export function TeamStatusPill({ status, className = "" }: { status: TeamStatus; className?: string }) {
  const { label, className: style, icon: Icon } = STYLES[status] ?? STYLES.tersedia;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${style} ${className}`}>
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}
