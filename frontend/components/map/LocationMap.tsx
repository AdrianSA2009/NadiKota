"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Ticket } from "@/features/dashboard/dashboardTypes";

interface LocationMapProps {
  tickets?: Ticket[];
  center?: [number, number];
  zoom?: number;
}

export default function LocationMap({ tickets = [], center = [-1.1191, 104.0538], zoom = 13 }: LocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: ReturnType<typeof import("leaflet").map> | undefined;

    import("leaflet").then((L) => {
      if (!mapRef.current) return;
      map = L.map(mapRef.current).setView(center, zoom);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      tickets.forEach((ticket) => {
        L.circleMarker([ticket.latitude, ticket.longitude], { radius: 8 })
          .addTo(map!)
          .bindPopup(ticket.ticketNumber);
      });

      // Force re-calc after DOM settles so tiles render at correct position
      setTimeout(() => map?.invalidateSize(), 100);
    });

    return () => { map?.remove(); };
  }, [tickets, center, zoom]);

  return <div ref={mapRef} className="h-full min-h-[320px] w-full rounded-xl" />;
}
