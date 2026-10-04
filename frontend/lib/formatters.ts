import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCategory(category: string): string {
  return { pothole: "Jalan berlubang", street_light: "PJU mati", other: "Kerusakan lainnya" }[category] ?? category;
}

export function formatStatus(status: string): string {
  return {
    reported: "Dilaporkan",
    verified: "Diverifikasi",
    queued: "Dalam Antrean",
    in_progress: "Dalam Perbaikan",
    completed: "Selesai",
    needs_review: "Perlu Tinjauan",
    rejected: "Ditolak",
    cancelled: "Dibatalkan",
  }[status] ?? status;
}

/** Label tingkat bahaya tiket (hasil AI / pilihan admin). */
export function dangerLevelLabel(level?: string | null): string | null {
  return level === "bahaya" ? "Bahaya" : level === "hati-hati" ? "Hati-hati" : null;
}
