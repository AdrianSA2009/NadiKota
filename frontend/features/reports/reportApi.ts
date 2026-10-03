import { apiClient } from "@/lib/apiClient";

export interface NearbyTicket {
  id: number;
  ticketNumber: string;
  category: "pothole" | "street_light" | "other";
  uniqueReporterCount: number;
}

export interface TicketDetail extends NearbyTicket {
  status: "reported" | "verified" | "queued" | "in_progress" | "completed" | "rejected" | "cancelled" | "needs_review";
  priorityLabel: "urgent" | "waiting" | "completed";
  /** Alasan admin membatalkan tiket — ditampilkan di detail saat status cancelled. */
  cancelReason?: string | null;
  latitude: number;
  longitude: number;
  createdAt: string;
  photos: { type: "before" | "after"; photoUrl?: string | null }[];
  /** Saat admin menyetujui tiket (langkah "Diverifikasi"). */
  verifiedAt?: string | null;
  /** Riwayat transisi status — dipakai timestamp "Perjalanan tiket". */
  statusHistories?: { to_status: string; created_at: string }[];
}

export async function createReport(formData: FormData, idempotencyKey = crypto.randomUUID()) {
  const res = await apiClient.post("/reports", formData, {
    headers: { "Content-Type": "multipart/form-data", "Idempotency-Key": idempotencyKey },
  });
  return res.data;
}

export type PhotoScreening = {
  status: "pending" | "done" | "unavailable";
  ok?: boolean;
  category?: "pothole" | "street_light" | "other" | null;
  severity?: "low" | "moderate" | "high" | "critical" | null;
  confidence?: number;
  reason?: string | null;
  detection?: "direct" | "rephoto" | "ai_rephoto";
  signals?: string[];
  has_camera_exif?: boolean;
  /** Foto tersensor (wajah/plat) sebagai data URL — dipakai menggantikan file asli. */
  redactedUrl?: string | null;
  redacted_faces?: number;
  redacted_plates?: number;
};

export async function screenPhoto(photo: File): Promise<string> {
  const form = new FormData();
  form.append("photo", photo, "layar.jpg");
  const res = await apiClient.post<{ data: { checkId: string } }>("/photo-screening", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.data.checkId;
}

export type ScreeningFailure = { title: string; body: string; short: string };

/** Pesan gagal berbeda: foto dari layar lain vs foto langsung yang tidak sesuai ketentuan. */
export function screeningFailure(s: PhotoScreening): ScreeningFailure {
  const fromScreen = s.detection === "rephoto" || s.detection === "ai_rephoto";
  return fromScreen
    ? {
        title: "Foto berasal dari layar lain",
        body: s.reason ?? "Terdeteksi screenshot/foto dari layar atau gambar lain. Ambil foto langsung dengan kamera di lokasi.",
        short: "Foto dari layar lain — ambil foto langsung dengan kamera di lokasi.",
      }
    : {
        title: "Foto tidak sesuai ketentuan",
        body: s.reason ?? "Foto diambil langsung tetapi belum sesuai ketentuan (buram, pencahayaan kurang, atau objek kerusakan tidak jelas). Ambil foto ulang.",
        short: "Foto tidak sesuai ketentuan — ambil foto ulang dengan objek yang jelas.",
      };
}

export async function getPhotoScreening(checkId: string): Promise<PhotoScreening> {
  const res = await apiClient.get<{ data: PhotoScreening }>(`/photo-screening/${checkId}`);
  return res.data.data;
}

export async function getReport(id: number) {
  const res = await apiClient.get(`/reports/${id}`);
  return res.data;
}

export async function getTicket(id: number): Promise<TicketDetail> {
  const response = await apiClient.get<{ data: TicketDetail }>(`/tickets/${id}`);
  return response.data.data;
}

export async function findNearbyTicket(category: NearbyTicket["category"], latitude: number, longitude: number): Promise<NearbyTicket | null> {
  const response = await apiClient.get<{ data: NearbyTicket | null }>("/tickets/nearby", {
    params: { category, latitude, longitude },
  });
  return response.data.data;
}

export async function supportTicket(ticketId: number): Promise<NearbyTicket> {
  const response = await apiClient.post<{ data: NearbyTicket }>(`/tickets/${ticketId}/support`);
  return response.data.data;
}
