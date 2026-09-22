export type TicketStatus = "reported" | "verified" | "queued" | "in_progress" | "completed" | "needs_review";

export interface Ticket {
  id: number;
  ticketNumber: string;
  category: "pothole" | "street_light" | "other";
  status: TicketStatus;
  priorityLabel: "urgent" | "waiting" | "completed";
  priorityScore: number;
  uniqueReporterCount: number;
  latitude: number;
  longitude: number;
  district: string;
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

export interface FieldTeam { id: number; name: string; district?: string; }
export interface DispatchTicket extends Ticket { assignedTeamId?: number | null; }
