"use client";

import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";

const LocationMap = dynamic(() => import("@/components/map/LocationMap"), { ssr: false });

export function LocationPicker({ onLocation }: { onLocation: (lat: number, lng: number) => void }) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => { const point = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setCoords(point); onLocation(point.lat, point.lng); },
      () => setCoords(null),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );
  }, [onLocation]);

  return <div className="rounded-xl border border-neutral-200 bg-neutral-0 p-4">
    <p className="flex items-center gap-2 text-sm font-medium text-neutral-900"><MapPin className="size-5" aria-hidden="true" />Lokasi</p>
    {coords ? <><p className="mt-1 text-sm text-neutral-500">{coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}</p><div className="mt-3 h-64 overflow-hidden rounded-lg" aria-label="Peta lokasi laporan"><LocationMap center={[coords.lng, coords.lat]} zoom={16} userLocation={coords} minimal /></div></> : <p className="mt-1 text-sm text-neutral-500" role="status">Mendapatkan lokasi GPS.</p>}
  </div>;
}
