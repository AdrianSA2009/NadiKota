export interface Report {
  id: number;
  ticketId: number | null;
  category: "pothole" | "street_light" | "other";
  status: "submitted" | "validated" | "needs_review" | "rejected";
  latitude: number;
  longitude: number;
  createdAt: string;
}

export interface ReportDetail extends Report {
  photos: { type: "before" | "after"; url: string }[];
  aiDecision?: string;
}
