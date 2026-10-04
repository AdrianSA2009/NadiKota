import { BadgeCheck, CircleCheck, CircleX, Construction, Hourglass, Lightbulb, ListOrdered, Send, ShieldQuestion, TriangleAlert, Wrench, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Variant = "urgent" | "waiting" | "done" | "cancelled" | "assessing" | "reported" | "verified" | "queued" | "in_progress" | "needs_review" | "citizen_review" | "rejected" | "pothole" | "street_light" | "other";

const variants: Record<Variant, { label: string; icon: LucideIcon; className: string }> = {
  urgent: { label: "Mendesak", icon: TriangleAlert, className: "border-danger-600 bg-danger-50 text-danger-700" },
  waiting: { label: "Menunggu", icon: Clock, className: "border-warning-600 bg-warning-50 text-warning-800" },
  done: { label: "Selesai", icon: CircleCheck, className: "border-success-600 bg-success-50 text-success-700" },
  cancelled: { label: "Dibatalkan", icon: CircleX, className: "border-neutral-300 bg-neutral-100 text-neutral-600" },
  assessing: { label: "Dalam Penilaian", icon: Hourglass, className: "border-info-600 bg-info-50 text-info-800" },
  reported: { label: "Dilaporkan", icon: Send, className: "border-info-600 bg-info-50 text-info-800" },
  verified: { label: "Diverifikasi", icon: BadgeCheck, className: "border-info-600 bg-info-50 text-info-800" },
  queued: { label: "Dalam Antrean", icon: ListOrdered, className: "border-warning-600 bg-warning-50 text-warning-800" },
  in_progress: { label: "Dalam Perbaikan", icon: Wrench, className: "border-primary-200 bg-primary-50 text-primary-800" },
  needs_review: { label: "Perlu Tinjauan", icon: ShieldQuestion, className: "border-info-600 bg-info-50 text-info-800" },
  // Varian warga: istilah "Perlu Tinjauan" terlalu internal untuk pengguna akhir.
  citizen_review: { label: "Dalam Tinjauan", icon: ShieldQuestion, className: "border-info-600 bg-info-50 text-info-800" },
  rejected: { label: "Ditolak", icon: CircleX, className: "border-neutral-300 bg-neutral-100 text-neutral-700" },
  pothole: { label: "Jalan berlubang", icon: Construction, className: "border-neutral-200 bg-neutral-100 text-neutral-700" },
  street_light: { label: "PJU mati", icon: Lightbulb, className: "border-neutral-200 bg-neutral-100 text-neutral-700" },
  other: { label: "Kerusakan lainnya", icon: TriangleAlert, className: "border-warning-600 bg-warning-50 text-warning-800" },
};

interface BadgeProps {
  variant: Variant;
}

export function Badge({ variant }: BadgeProps) {
  const { label, icon: Icon, className } = variants[variant];

  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>
      <Icon className="size-4" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
