"use client";

import { AlertTriangle, CircleAlert, Clock3 } from "lucide-react";
import { Map, MapMarker, MarkerContent } from "@/components/ui/map";
import type { Ticket } from "@/features/dashboard/dashboardTypes";

/** Mini mapcn street map centered on task location, using same tile style as main map. */
export function TaskLocationMap({ ticket }: { ticket: Ticket }) {
  const pending = ticket.status === "reported" || ticket.status === "needs_review";
  const danger = ticket.dangerLevel === "bahaya";
  const markerClass = pending ? "bg-primary-700" : danger ? "bg-danger-700" : "bg-warning-600";
  const MarkerIcon = pending ? Clock3 : danger ? AlertTriangle : CircleAlert;
  return (
    <Map
      className="absolute inset-0"
      theme="light"
      viewport={{ center: [ticket.longitude, ticket.latitude], zoom: 13, bearing: 0, pitch: 0 }}
      attributionControl={false}
      dragPan={false}
      scrollZoom={false}
      doubleClickZoom={false}
      touchZoomRotate={false}
      keyboard={false}
    >
      <MapMarker longitude={ticket.longitude} latitude={ticket.latitude}>
        <MarkerContent>
          <span className={`flex size-6 items-center justify-center rounded-full border-2 border-white text-white shadow-lg ${markerClass}`}>
            <MarkerIcon className="size-3.5" aria-hidden="true" />
          </span>
        </MarkerContent>
      </MapMarker>
    </Map>
  );
}
