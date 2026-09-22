import { BadgeCheck, CircleCheck, CircleHelp, Construction, Lightbulb, ListOrdered, Send, ShieldQuestion, TriangleAlert, Wrench, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Variant = "urgent" | "waiting" | "completed" | "reported" | "verified" | "queued" | "in_progress" | "needs_review" | "pothole" | "street_light" | "other";

const variants: Record<Variant, { label: string; icon: LucideIcon; className: string }> = {
  urgent: { label: "Mendesak", icon: TriangleAlert, className: "border-danger-600 bg-danger-50 text-danger-700" },
  waiting: { label: "Menunggu", icon: Clock, className: "border-warning-600 bg-warning-50 text-warning-800" },
  completed: { label: "Selesai", icon: CircleCheck, className: "border-success-600 bg-success-50 text-success-700" },
  reported: { label: "Dilaporkan", icon: Send, className: "border-info-600 bg-info-50 text-info-800" },
  verified: { label: "Diverifikasi", icon: BadgeCheck, className: "border-info-600 bg-info-50 text-info-800" },
  queued: { label: "Dalam Antrean", icon: ListOrdered, className: "border-warning-600 bg-warning-50 text-warning-800" },
  in_progress: { label: "Dalam Perbaikan", icon: Wrench, className: "border-primary-200 bg-primary-50 text-primary-800" },
  needs_review: { label: "Perlu Tinjauan", icon: ShieldQuestion, className: "border-info-600 bg-info-50 text-info-800" },
  pothole: { label: "Jalan berlubang", icon: Construction, className: "border-neutral-200 bg-neutral-100 text-neutral-700" },
  street_light: { label: "PJU mati", icon: Lightbulb, className: "border-neutral-200 bg-neutral-100 text-neutral-700" },
  other: { label: "Lainnya", icon: CircleHelp, className: "border-neutral-200 bg-neutral-100 text-neutral-700" },
};

interface BadgeProps {
  variant: Variant;
}

export function Badge({ variant }: BadgeProps) {
  const { label, icon: Icon, className } = variants[variant];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>
      <Icon className="size-4" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
