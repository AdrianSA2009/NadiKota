import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import type { AnalyticsSummary, DangerLevel, DispatchTicket, ReviewTicket, ReviewTicketListResponse, Team, TeamDetailResponse, TicketListResponse, TicketQueryParams } from "./dashboardTypes";

export function useTickets(params: TicketQueryParams = { status: "queued" }) {
  return useInfiniteQuery({
    queryKey: ["tickets", params],
    queryFn: async ({ pageParam = 1 }) => (await apiClient.get<TicketListResponse>("/tickets", { params: { ...params, page: pageParam, sort: "priority_score", direction: "desc" } })).data,
    getNextPageParam: (lastPage) => lastPage.meta.currentPage < lastPage.meta.lastPage ? lastPage.meta.currentPage + 1 : undefined,
    initialPageParam: 1,
  });
}

export function useTicketDetail(id: number) {
  return useQuery({ queryKey: ["ticket", id], queryFn: async () => (await apiClient.get(`/tickets/${id}`)).data, enabled: Number.isInteger(id) && id > 0 });
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> { return (await apiClient.get<{ data: AnalyticsSummary }>("/analytics/summary")).data.data; }
export async function reviewTicket(id: number, decision: "approved" | "rejected", reason: string, dangerLevel?: DangerLevel): Promise<ReviewTicket> { return (await apiClient.post<{ data: ReviewTicket }>(`/tickets/${id}/review`, { decision, reason, ...(dangerLevel ? { danger_level: dangerLevel } : {}) })).data.data; }
export async function getReviewTickets(page: number): Promise<ReviewTicketListResponse> { return (await apiClient.get<ReviewTicketListResponse>("/tickets", { params: { status: "needs_review", page, sort: "created_at", direction: "asc" } })).data; }
export type TeamInput = { name: string; district: string; type?: string | null; description?: string | null };
export type LeaderInput = {
  pj_mode: "new" | "existing";
  pj_name?: string;
  pj_username?: string;
  pj_email?: string;
  pj_phone?: string;
  pj_password?: string;
  user_id?: number;
};

export async function getFieldTeams(): Promise<Team[]> { return (await apiClient.get<{ data: Team[] }>("/teams")).data.data; }
export async function getTeam(id: number): Promise<TeamDetailResponse> { return (await apiClient.get<{ data: TeamDetailResponse }>(`/teams/${id}`)).data.data; }
/** Satu tiket lengkap (untuk halaman tugaskan mobile). */
export async function getDispatchTicket(id: number): Promise<DispatchTicket> { return (await apiClient.get<{ data: DispatchTicket }>(`/tickets/${id}`)).data.data; }
export async function createTeam(input: TeamInput & LeaderInput): Promise<Team> { return (await apiClient.post<{ data: Team }>("/teams", input)).data.data; }
export async function updateTeam(id: number, input: TeamInput): Promise<Team> { return (await apiClient.put<{ data: Team }>(`/teams/${id}`, input)).data.data; }
export async function changeTeamLeader(id: number, input: LeaderInput): Promise<Team> { return (await apiClient.patch<{ data: Team }>(`/teams/${id}/leader`, input)).data.data; }
export async function resetTeamPassword(id: number, password: string): Promise<void> { await apiClient.post(`/teams/${id}/reset-password`, { password }); }
export async function deactivateTeam(id: number): Promise<Team> { return (await apiClient.patch<{ data: Team }>(`/teams/${id}/deactivate`)).data.data; }
export async function activateTeam(id: number): Promise<Team> { return (await apiClient.patch<{ data: Team }>(`/teams/${id}/activate`)).data.data; }
export async function searchTeamLeaders(q: string): Promise<{ id: number; name: string; username?: string | null; email?: string | null; phone?: string | null }[]> { return (await apiClient.get<{ data: { id: number; name: string; username?: string | null; email?: string | null; phone?: string | null }[] }>("/users/search", { params: { q } })).data.data; }
/** Semua tiket aktif untuk halaman dispatch (queued + in_progress) — difilter di UI. */
export async function getDispatchTickets(): Promise<DispatchTicket[]> { return (await apiClient.get<{ data: DispatchTicket[] }>("/tickets", { params: { per_page: 100 } })).data.data; }
export async function assignTicket(ticketId: number, teamId: number): Promise<DispatchTicket> { return (await apiClient.post<{ data: DispatchTicket }>(`/tickets/${ticketId}/dispatch`, { teamId })).data.data; }

async function compressProofPhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Foto bukti tidak dapat diproses. Pilih foto lain.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.82, 0.72, 0.62, 0.52]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= 1_500_000) {
        return new File([blob], "bukti-perbaikan.jpg", { type: "image/jpeg" });
      }
    }
    throw new Error("Ukuran foto bukti terlalu besar untuk diunggah. Pilih foto yang lebih kecil.");
  } finally {
    bitmap.close();
  }
}

export async function completeTicket(ticketId: number, photo: File): Promise<DispatchTicket> {
  const uploadPhoto = await compressProofPhoto(photo);
  const formData = new FormData();
  formData.append("after_photo", uploadPhoto, uploadPhoto.name);
  return (await apiClient.post<{ data: DispatchTicket }>(`/tickets/${ticketId}/complete`, formData, { headers: { "Idempotency-Key": crypto.randomUUID() } })).data.data;
}

export async function cancelTicket(ticketId: number, reason: string): Promise<{ ticket_id: number; status: "cancelled"; message: string }> {
  return (await apiClient.post<{ data: { ticket_id: number; status: "cancelled"; message: string } }>(`/tickets/${ticketId}/cancel`, { reason })).data.data;
}

/** Admin memverifikasi bukti tim lalu menyelesaikan tiket. */
export async function finalizeTicket(ticketId: number): Promise<{ ticket_id: number; status: string; message: string }> {
  return (await apiClient.post<{ data: { ticket_id: number; status: string; message: string } }>(`/tickets/${ticketId}/finalize`)).data.data;
}

/** Admin menolak bukti hasil perbaikan (kurang valid) → tim kirim foto ulang. */
export async function rejectTicketProof(ticketId: number, reason: string): Promise<{ ticket_id: number; review_status: string; message: string }> {
  return (await apiClient.post<{ data: { ticket_id: number; review_status: string; message: string } }>(`/tickets/${ticketId}/reject-proof`, { reason })).data.data;
}

/** Tim menekan "Mulai" — menandai tiket sedang dikerjakan (queued → in_progress). */
export async function startTicket(ticketId: number): Promise<{ ticket_id: number; status: string; message: string }> {
  return (await apiClient.post<{ data: { ticket_id: number; status: string; message: string } }>(`/tickets/${ticketId}/start`)).data.data;
}
