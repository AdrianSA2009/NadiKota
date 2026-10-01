import type { Ticket } from "@/features/dashboard/dashboardTypes";
import { dangerLevelLabel } from "@/lib/formatters";

interface TicketMarkerProps {
  ticket: Ticket;
  onClick?: (ticket: Ticket) => void;
}

export default function TicketMarker({ ticket, onClick }: TicketMarkerProps) {
  return (
    <button
      type="button"
      className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-0 px-3 py-2 text-left text-sm hover:border-primary-500 hover:shadow-sm"
      onClick={() => onClick?.(ticket)}
      aria-label={`Tiket ${ticket.ticketNumber}`}
    >
      <span className="flex size-3 shrink-0 rounded-full" style={{ backgroundColor: ticket.priorityLabel === "urgent" ? "#B91C1C" : ticket.priorityLabel === "waiting" ? "#D97706" : "#047857" }} aria-hidden="true" />
      <span className="font-medium text-neutral-900">{ticket.ticketNumber}</span>
      {dangerLevelLabel(ticket.dangerLevel) && <span className="text-neutral-500">{dangerLevelLabel(ticket.dangerLevel)}</span>}
    </button>
  );
}
