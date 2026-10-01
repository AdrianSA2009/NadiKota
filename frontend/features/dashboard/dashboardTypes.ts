export type TicketStatus = "reported" | "verified" | "queued" | "in_progress" | "completed" | "rejected" | "cancelled" | "needs_review";

export type DangerLevel = "bahaya" | "hati-hati";

export interface Ticket {
  id: number;
  ticketNumber: string;
  category: "pothole" | "street_light" | "other";
  status: TicketStatus;
  /** Status verifikasi: pending | approved | rejected | submitted (bukti dikirim tim) | proof_rejected (ditolak admin). */
  reviewStatus?: "pending" | "approved" | "rejected" | "submitted" | "proof_rejected";
  priorityLabel: "urgent" | "waiting" | "done";
  priorityScore: number;
  /** Tingkat bahaya hasil AI, bisa diubah admin saat review. */
  dangerLevel?: DangerLevel | null;
  /** Foto laporan & analisis AI — hanya untuk endpoint yang eager load (kartu review). */
  photoUrl?: string | null;
  /** Foto bukti hasil perbaikan dari tim (untuk verifikasi admin). */
  afterPhotoUrl?: string | null;
  /** Alasan admin saat menolak bukti (untuk kirim ulang oleh tim). */
  proofNote?: string | null;
  aiAnalysis?: {
    decision?: string | null;
    severity?: string | null;
    confidence?: number | null;
    reason?: string | null;
    model?: string | null;
  } | null;
  uniqueReporterCount: number;
  /** Nama tim yang ditugaskan mengerjakan tiket (saat eager load). */
  assignedTeamName?: string | null;
  /** Nama-nama pelapor laporan pada tiket ini (bukan sekadar jumlah). */
  reporterNames?: string[];
  /** Nama PJ pelaksana (snapshot saat dispatch/mulai) — tidak berubah walau PJ tim diganti. */
  assigneeName?: string | null;
  latitude: number;
  longitude: number;
  district: string;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  createdAt: string;
}

export interface TicketListResponse {
  data: Ticket[];
  meta: { currentPage: number; lastPage: number; total: number };
}

export interface TicketQueryParams {
  status?: TicketStatus;
  category?: Ticket["category"];
  district?: string;
  page?: number;
}

export interface ReviewTicket extends Ticket {
  reviewStatus?: "pending" | "approved" | "rejected";
  reviewReason?: string | null;
}

export interface ReviewTicketListResponse {
  data: ReviewTicket[];
  meta: TicketListResponse["meta"];
}

export interface TeamLeader { id: number; name: string; username?: string | null; email?: string | null; phone?: string | null; }

export type TeamStatus = "tersedia" | "bertugas" | "selesai" | "nonaktif";

export interface Team {
  id: number;
  name: string;
  district: string | null;
  type: string | null;
  description: string | null;
  isActive: boolean;
  userId: number | null;
  leader: TeamLeader | null;
  activeTicketCount: number;
  /** Jumlah tiket berstatus in_progress — > 0 mengunci aksi ganti PJ. */
  inProgressTicketCount?: number;
  totalTicketCount: number;
  status: TeamStatus;
  createdAt?: string;
}

export interface ListMeta { currentPage: number; lastPage: number; total: number; }

/** Ringkasan KPI dashboard admin (GET /analytics/summary). */
export interface AnalyticsSummary {
  tickets_by_status: Record<string, number>;
  response_time: number | null;
  completion_time: number | null;
  consolidation_rate: number;
  team_performance: { team_name: string; completed_count: number; avg_completion_hours: number | null }[];
  total_tickets: number;
  total_users: number;
  unique_reporters: number;
  sla_escalated: number;
  chart: { date: string; count: number }[];
  generated_at: string;
}

export interface TeamDetailResponse { team: Team; tickets: DispatchTicket[]; meta: ListMeta; }
export interface DispatchTicket extends Ticket { assignedTeamId?: number | null; }
