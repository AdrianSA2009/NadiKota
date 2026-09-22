import type { Ticket } from "@/features/dashboard/dashboardTypes";

interface TicketMarkerProps {
  ticket: Ticket;
}

export default function TicketMarker({ ticket }: TicketMarkerProps) {
  // Renders a single marker on an existing Leaflet map instance.
  // Use within a <LocationMap> context.
  return (
    <div className="hidden" data-ticket-id={ticket.id} data-lat={ticket.latitude} data-lng={ticket.longitude} />
  );
}
