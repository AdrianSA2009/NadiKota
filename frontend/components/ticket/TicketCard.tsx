import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { Ticket } from "@/features/dashboard/dashboardTypes";

const priorityVariant: Record<Ticket["priorityLabel"], "urgent" | "waiting" | "done"> = {
  urgent: "urgent",
  waiting: "waiting",
  done: "done",
};

const categoryLabel: Record<Ticket["category"], string> = {
  pothole: "Jalan berlubang",
  street_light: "PJU mati",
  other: "Lainnya",
};

interface TicketCardProps {
  ticket: Ticket;
}

export function TicketCard({ ticket }: TicketCardProps) {
  return (
    <Link href={`/tickets/${ticket.id}`} className="block rounded-xl border border-neutral-200 bg-neutral-0 p-4 shadow-sm transition hover:border-primary-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-neutral-500">{ticket.ticketNumber}</p>
          <h3 className="mt-1 font-semibold text-neutral-900">{categoryLabel[ticket.category]}</h3>
        </div>
        <Badge variant={priorityVariant[ticket.priorityLabel]} />
      </div>
    </Link>
  );
}
