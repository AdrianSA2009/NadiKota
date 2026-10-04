import { Construction, Lightbulb, TriangleAlert, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type CategoryMeta = { label: string; icon: LucideIcon; chip: string };

/** Kategorikerusakan — satu sumber untuk warga, admin, dan tim (label + ikon + warna chip). */
export const CATEGORY_META: Record<string, CategoryMeta> = {
  pothole: { label: "Jalan berlubang", icon: Construction, chip: "bg-neutral-100 text-neutral-700" },
  street_light: { label: "PJU mati", icon: Lightbulb, chip: "bg-neutral-100 text-neutral-700" },
  // Ikon rusak/danger — bukan tanda tanya.
  other: { label: "Kerusakan lainnya", icon: TriangleAlert, chip: "bg-warning-50 text-warning-800" },
};

export const CATEGORY_FALLBACK: CategoryMeta = {
  label: "Lainnya",
  icon: Wrench,
  chip: "bg-neutral-100 text-neutral-700",
};

export function categoryMeta(category: string): CategoryMeta {
  return CATEGORY_META[category] ?? CATEGORY_FALLBACK;
}