"use client";

import { MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface LocationPickerProps {
  onLocation: (lat: number, lng: number) => void;
}

export function LocationPicker({ onLocation }: LocationPickerProps) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        onLocation(latitude, longitude);
      },
      () => setCoords(null),
    );
  }, [onLocation]);

  useEffect(() => {
    if (!coords || !mapRef.current) return;
    let map: import("leaflet").Map | undefined;
    let marker: import("leaflet").Marker | undefined;
    import("leaflet").then((L) => {
      if (!mapRef.current) return;
      map = L.map(mapRef.current).setView([coords.lat, coords.lng], 16);
      L.tileLayer(process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
      marker = L.marker([coords.lat, coords.lng], { draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const position = marker?.getLatLng();
        if (!position) return;
        setCoords(position);
        onLocation(position.lat, position.lng);
      });
    });
    return () => {
      map?.remove();
    };
  }, [coords?.lat, coords?.lng, onLocation]);

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-0 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-neutral-900"><MapPin className="size-5" aria-hidden="true" />Lokasi</p>
      {coords ? (
        <><p className="mt-1 text-sm text-neutral-500">{coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}</p><div ref={mapRef} className="mt-3 min-h-64 rounded-lg" aria-label="Peta lokasi laporan" /></>
      ) : (
        <p className="mt-1 text-sm text-neutral-500" role="status">Mendapatkan lokasi GPS.</p>
      )}
    </div>
  );
}
