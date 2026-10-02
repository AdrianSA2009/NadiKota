"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CircleAlert, Clock3, X } from "lucide-react";
import { Map, MapMarker, MarkerContent, MarkerPopup, MapControls, type MapStyleOption } from "@/components/ui/map";
import { dangerLevelLabel } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { MapSearch } from "./MapSearch";
import { usePotholeVoiceAlert } from "@/hooks/usePotholeVoiceAlert";
import type { Ticket } from "@/features/dashboard/dashboardTypes";

/** Penanda peta: menunggu konfirmasi = navy (bukan kuning), sesuai tingkat bahaya: merah / amber. */
function TicketMarkerIcon({ ticket }: { ticket: Ticket }) {
  const pending = ticket.status === "reported" || ticket.status === "needs_review";
  const danger = ticket.dangerLevel === "bahaya";
  const className = pending ? "bg-primary-700" : danger ? "bg-danger-700" : "bg-warning-600";
  const label = pending ? "Menunggu konfirmasi" : danger ? "Bahaya" : "Hati-hati";
  const Icon = pending ? Clock3 : danger ? AlertTriangle : CircleAlert;

  return (
    <span className={`flex size-6 items-center justify-center rounded-full border-2 border-white text-white shadow-lg ${className}`} aria-label={label}>
      <Icon className="size-3.5" aria-hidden="true" />
    </span>
  );
}

// Basemap dari sumber gods-eye-view (src/maps/imagery.js): OSM + Esri World Imagery.
// Raster XYZ dibungkus style MapLibre — tanpa API key.
const OSM_STYLE: MapStyleOption = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

const SATELLITE_STYLE: MapStyleOption = {
  version: 8,
  sources: {
    esri: {
      type: "raster",
      tiles: ["https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Powered by Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    },
  },
  layers: [{ id: "esri", type: "raster", source: "esri" }],
};

const BASEMAPS = {
  standard: {
    label: "Standar",
    style: undefined,
    thumb: "https://a.basemaps.cartocdn.com/light_all/13/6463/4072@2x.png",
  },
  osm: {
    label: "OSM",
    style: OSM_STYLE,
    thumb: "https://tile.openstreetmap.org/13/6463/4072.png",
  },
  satellite: {
    label: "Satelit",
    style: SATELLITE_STYLE,
    thumb: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/13/4072/6463",
  },
} as const;
type BasemapId = keyof typeof BASEMAPS;

/** true kalau viewport <768px; update saat resize. */
function useIsMobileViewport(): boolean {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = () => setMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return mobile;
}

/** Pilih basemap gaya Google Maps: kartu thumbnail tile asli + label di bawah.
 * Desktop md+: baris kartu berjajar + label.
 * Mobile: stack TIPI ala icon layers (offset 12px kanan+atas per lapis, kartu
 * terpilih di depan + label aktif tampil di bawahnya, label lain tersembunyi) —
 * tekan stack → kartu melebar berbaris ke kanan (transisi transform 200ms, semua
 * label muncul); pilih kartu → kartu terpilih berpindah ke posisi depan dulu
 * (~300ms) BARU stack menutup. Tap luar (backdrop) = batal langsung, stack tetap. */
function BasemapSwitcher({ value, onChange }: { value: BasemapId; onChange: (id: BasemapId) => void }) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobileViewport();
  const ids = Object.keys(BASEMAPS) as BasemapId[];
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  /** Fase 2: setelah kartu terpilih selesai berpindah ke depan, baru tumpukan menutup. */
  const scheduleCollapse = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      setOpen(false);
    }, 300);
  };
  const cancelCollapse = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  if (isMobile) {
    const order = [value, ...ids.filter((id) => id !== value)];
    return (
      <div className="pointer-events-none relative h-[110px] w-[216px]">
        {order.map((id, rank) => {
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              aria-label={open ? BASEMAPS[id].label : "Ganti tampilan peta"}
              aria-expanded={open ? undefined : false}
              aria-pressed={open ? selected : undefined}
              onClick={() => {
                if (!open) {
                  cancelCollapse();
                  setOpen(true);
                } else {
                  onChange(id);
                  scheduleCollapse();
                }
              }}
              style={{
                zIndex: open ? 960 - rank : 10 - rank,
                transform: open ? `translate(${rank * 72}px, 0px)` : `translate(${rank * 12}px, ${-rank * 12}px)`,
              }}
              className="pointer-events-auto absolute left-0 top-6 flex w-16 flex-col items-center gap-1 transition-transform duration-200"
            >
              {/* Tile XYZ pihak ketiga — next/image tak bisa optimasi URL eksternal tanpa remotePatterns */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={BASEMAPS[id].thumb}
                alt=""
                className={cn(
                  "size-16 rounded-xl border-2 bg-neutral-200 object-cover shadow-md transition-colors",
                  selected ? "border-primary-500" : "border-neutral-0",
                )}
              />
              <span
                className={cn(
                  "absolute top-full mt-1 w-full rounded-full px-1.5 py-0.5 text-center text-[11px] leading-tight transition-opacity duration-200",
                  open || selected ? "opacity-100" : "opacity-0",
                  selected
                    ? "bg-primary-500 font-semibold text-white"
                    : "bg-neutral-0/85 font-medium text-neutral-700",
                )}
              >
                {BASEMAPS[id].label}
              </span>
            </button>
          );
        })}
        {open && (
          <div
            className="pointer-events-auto fixed inset-0 z-[940]"
            aria-hidden="true"
            onClick={() => {
              cancelCollapse();
              setOpen(false);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2" role="group" aria-label="Ganti tampilan peta">
      {ids.map((id) => {
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={selected}
            aria-label={BASEMAPS[id].label}
            onClick={() => onChange(id)}
            className="flex w-16 flex-col items-center gap-1"
          >
            {/* Tile XYZ pihak ketiga — next/image tak bisa optimasi URL eksternal tanpa remotePatterns */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BASEMAPS[id].thumb}
              alt=""
              loading="lazy"
              className={cn(
                "size-16 rounded-xl border-2 bg-neutral-200 object-cover shadow-sm transition-colors",
                selected ? "border-primary-500" : "border-neutral-0",
              )}
            />
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-center text-[11px] leading-tight",
                selected
                  ? "bg-primary-500 font-semibold text-white"
                  : "bg-neutral-0/85 font-medium text-neutral-700",
              )}
            >
              {BASEMAPS[id].label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface GeoPoint { lat: number; lng: number }
interface LocationMapProps {
  tickets?: Ticket[];
  center?: [number, number];
  zoom?: number;
  userLocation?: GeoPoint | null;
  /** Konten tambahan di dalam search bar kanan (mis. tombol Masuk / avatar mobile). */
  searchAction?: React.ReactNode;
  /** Konten di sisi kiri search bar (mis. hamburger admin) — disembunyikan saat search aktif. */
  navAction?: React.ReactNode;
  /** Mode laporan: tanpa search bar, switcher basemap, & tombol locate (zoom tetap). */
  minimal?: boolean;
}

/**
 * Kontrol peta: tombol locate (flyTo ke lokasi sendiri) di atas zoom.
 * Posisi GPS yang sudah di-watch diteruskan agar locate terbang seketika.
 */
function MapControlsLocated({ knownLocation }: { knownLocation: { longitude: number; latitude: number } | null }) {
  return (
    <MapControls
      position="bottom-right"
      showZoom
      showLocate
      knownLocation={knownLocation}
      className="!bottom-2 max-md:!bottom-21"
    />
  );
}

/** Cache nama lokasi hasil reverse geocoding (Photon) per tiket. */
// globalThis.Map — import `Map` di file ini adalah komponen peta, bukan Map bawaan JS.
const streetCache = new globalThis.Map<number, string | null>();

/** Isi popup tiket di peta: nama jalan/lokasi terdekat, tingkat bahaya, preview foto (klik → perbesar). */
function TicketPopupContent({ ticket }: { ticket: Ticket }) {
  const [zoom, setZoom] = useState(false);
  const [street, setStreet] = useState<string | null>(() => streetCache.get(ticket.id) ?? null);

  useEffect(() => {
    if (streetCache.has(ticket.id)) return;
    if (!Number.isFinite(ticket.latitude) || !Number.isFinite(ticket.longitude)) {
      streetCache.set(ticket.id, null);
      return;
    }
    let alive = true;
    // Photon tak lagi menyediakan endpoint reverse (404) — pakai Nominatim (OSM, keyless).
    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${ticket.latitude}&lon=${ticket.longitude}&zoom=18`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { name?: string | null; address?: Record<string, string | undefined> } | null) => {
        const address = data?.address ?? {};
        const name = data?.name ?? address.road ?? address.suburb ?? address.neighbourhood ?? address.village ?? address.town ?? address.city ?? null;
        streetCache.set(ticket.id, name);
        if (alive) setStreet(name);
      })
      .catch(() => {
        streetCache.set(ticket.id, null);
        if (alive) setStreet(null);
      });
    return () => {
      alive = false;
    };
  }, [ticket.id, ticket.latitude, ticket.longitude]);

  const title = street ?? ticket.district ?? "Lokasi tanpa nama";
  return (
    <div className="min-w-44 text-sm">
      <p className="font-semibold text-neutral-900">{title}</p>
      <p className="mt-0.5 text-xs text-neutral-600">Tingkat bahaya: {dangerLevelLabel(ticket.dangerLevel) ?? "—"}</p>
      {ticket.photoUrl ? (
        <button type="button" className="mt-2 block w-full cursor-zoom-in overflow-hidden rounded-lg border border-neutral-200" onClick={() => setZoom(true)} aria-label="Perbesar foto tiket">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ticket.photoUrl} alt="" className="h-28 w-full object-cover" />
        </button>
      ) : (
        <p className="mt-2 text-xs text-neutral-500">Foto tidak tersedia.</p>
      )}
      {zoom && ticket.photoUrl && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-neutral-900/80 p-4" role="dialog" aria-modal="true" aria-label="Foto tiket" onClick={() => setZoom(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ticket.photoUrl} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
          <button type="button" className="absolute right-4 top-4 rounded-full bg-neutral-0 p-2 text-neutral-700 shadow" aria-label="Tutup" onClick={() => setZoom(false)}><X className="size-5" aria-hidden="true" /></button>
        </div>,
        document.body,
      )}
    </div>
  );
}

export default function LocationMap({ tickets = [], center = [104.0305, 1.0456], zoom = 13, userLocation, searchAction, navAction, minimal = false }: LocationMapProps) {
  const [basemap, setBasemap] = useState<BasemapId>("standard");
  const basemapStyle = BASEMAPS[basemap].style;

  // Lokasi pengguna: pakai prop bila diberikan (mis. LocationPicker), else GPS aktif
  const [geo, setGeo] = useState<GeoPoint | null>(null);

  useEffect(() => {
    if (userLocation || typeof navigator === "undefined" || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeo(null),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [userLocation]);

  const myLocation = userLocation ?? geo;

  // Peringatan suara "jalan berlubang 50 m" — hanya aktif saat pengguna pakai rute
  // (state rute ada di useRouteStore; tanpa rute → hook diam).
  usePotholeVoiceAlert(tickets, myLocation);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Map
        center={center}
        zoom={zoom}
        theme="light"
        styles={basemapStyle ? { light: basemapStyle, dark: basemapStyle } : undefined}
      >
        {!minimal && (
          <div className="absolute bottom-2 left-2 z-[920] flex gap-1 max-md:bottom-21 max-md:pointer-events-none">
            <BasemapSwitcher value={basemap} onChange={setBasemap} />
          </div>
        )}
        {!minimal && <MapSearch origin={myLocation} actions={searchAction} navAction={navAction} />}
        {minimal ? (
          <MapControls position="bottom-right" showZoom className="!bottom-2" />
        ) : (
          <MapControlsLocated knownLocation={myLocation ? { longitude: myLocation.lng, latitude: myLocation.lat } : null} />
        )}
        {tickets.filter((ticket) => Number.isFinite(ticket.latitude) && Number.isFinite(ticket.longitude)).map((ticket) => (
          <MapMarker key={ticket.id} longitude={ticket.longitude} latitude={ticket.latitude}>
            <MarkerContent>
              <TicketMarkerIcon ticket={ticket} />
            </MarkerContent>
            <MarkerPopup closeButton>
              <TicketPopupContent ticket={ticket} />
            </MarkerPopup>
          </MapMarker>
        ))}
        {/* Mark lokasi sendiri (GPS aktif) — biru berdenyut ala Google Maps */}
        {myLocation && Number.isFinite(myLocation.lat) && Number.isFinite(myLocation.lng) && (
          <MapMarker longitude={myLocation.lng} latitude={myLocation.lat}>
            <MarkerContent>
              <span className="relative flex size-5 items-center justify-center" aria-label="Lokasi saya" role="img">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary-500 opacity-40" aria-hidden="true" />
                <span className="relative inline-flex size-3.5 rounded-full border-2 border-white bg-primary-500 shadow-[0_0_6px_rgba(47,99,143,0.8)]" />
              </span>
            </MarkerContent>
          </MapMarker>
        )}
      </Map>
    </div>
  );
}
