import { apiClient } from "@/lib/apiClient";

export interface NearbyTicket {
  id: number;
  ticketNumber: string;
  category: "pothole" | "street_light" | "other";
  uniqueReporterCount: number;
}

export interface TicketDetail extends NearbyTicket {
  status: "reported" | "verified" | "queued" | "in_progress" | "completed" | "needs_review";
  priorityLabel: "urgent" | "waiting" | "completed";
  latitude: number;
  longitude: number;
  createdAt: string;
  photos: { type: "before" | "after"; url: string }[];
}

export async function createReport(formData: FormData) {
  const res = await apiClient.post("/reports", formData, {
    headers: { "Content-Type": "multipart/form-data", "Idempotency-Key": crypto.randomUUID() },
  });
  return res.data;
}

export async function getReport(id: number) {
  const res = await apiClient.get(`/reports/${id}`);
  return res.data;
}

export async function getTicket(id: number): Promise<TicketDetail> {
  const response = await apiClient.get<{ data: TicketDetail }>(`/tickets/${id}`);
  return response.data.data;
}

export async function submitTicketFeedback(id: number, feedback: "fixed" | "not_fixed"): Promise<void> {
  await apiClient.post(`/tickets/${id}/feedback`, { feedback });
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
