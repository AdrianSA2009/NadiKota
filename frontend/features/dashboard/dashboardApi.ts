import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import type { DispatchTicket, FieldTeam, ReviewTicket, ReviewTicketListResponse, TicketListResponse, TicketQueryParams } from "./dashboardTypes";

export function useTickets(params: TicketQueryParams = { status: "queued" }) {
  return useQuery({
    queryKey: ["tickets", params],
    queryFn: async () => {
      const response = await apiClient.get<TicketListResponse>("/tickets", {
        params: {
          ...params,
          sort: "priority_score",
          direction: "desc",
        },
      });
      return response.data;
    },
  });
}

export function useTicketDetail(id: number) {
  return useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => {
      const response = await apiClient.get(`/tickets/${id}`);
      return response.data;
    },
    enabled: Number.isInteger(id) && id > 0,
  });
}

export async function reviewTicket(id: number, decision: "approved" | "rejected", reason: string): Promise<ReviewTicket> {
  const response = await apiClient.post<{ data: ReviewTicket }>(`/tickets/${id}/review`, { decision, reason });
  return response.data.data;
}

export async function getReviewTickets(page: number): Promise<ReviewTicketListResponse> {
  const response = await apiClient.get<ReviewTicketListResponse>("/tickets", { params: { status: "needs_review", page, sort: "created_at", direction: "asc" } });
  return response.data;
}

export async function getFieldTeams(): Promise<FieldTeam[]> {
  const response = await apiClient.get<{ data: FieldTeam[] }>("/teams");
  return response.data.data;
}

export async function getDispatchTickets(): Promise<DispatchTicket[]> {
  const response = await apiClient.get<{ data: DispatchTicket[] }>("/tickets", { params: { status: "queued" } });
  return response.data.data;
}

export async function assignTicket(ticketId: number, teamId: number): Promise<DispatchTicket> {
  const response = await apiClient.post<{ data: DispatchTicket }>(`/tickets/${ticketId}/assign`, { team_id: teamId });
  return response.data.data;
}

export async function completeTicket(ticketId: number, photo: File): Promise<DispatchTicket> {
  const formData = new FormData();
  formData.append("photo", photo, photo.name);
  const response = await apiClient.post<{ data: DispatchTicket }>(`/tickets/${ticketId}/complete`, formData, { headers: { "Content-Type": "multipart/form-data", "Idempotency-Key": crypto.randomUUID() } });
  return response.data.data;
}
