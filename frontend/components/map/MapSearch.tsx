"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, MapPin, Navigation, Search, Share2, X } from "lucide-react";
import { MapMarker, MapRoute, MarkerContent, useMap } from "@/components/ui/map";
import { useKontribusiPanel } from "@/lib/kontribusiPanelStore";
import { useRouteStore } from "@/lib/routeStore";

/** Photon (komoot) — geocoding OSM gratis tanpa key, di-bias ke tengah peta. */
const PHOTON_URL = "https://photon.komoot.io/api/";

type Place = { id: string; name: string; detail: string; lng: number; lat: number };

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, string | undefined>;
};

function labelOf(props: Record<string, string | undefined>): { name: string; detail: string } {
  const name = props.name || props.street || props.city || props.country || "Tanpa nama";
  const detail = [props.street && props.street !== name ? props.street : null, props.locality, props.district, props.city, props.state]
    .filter(Boolean)
    .join(", ");
  return { name, detail };
}

const MIN_QUERY = 3;
const DEBOUNCE_MS = 300;
const LIMIT = 6;

/** OSRM publik — rute jalan tanpa key. */
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving/";

/** Tombol cari + panel hasil di atas peta; hasil dipilih → flyTo + pin.
 *  `origin` = posisi GPS yang sudah dipantau peta (pakai ini biar rute cepat).
 *  `navAction` = kontrol kiri di dalam bar (mis. hamburger mobile) — disembunyikan saat search aktif. */
export function MapSearch({ origin, actions, navAction }: { origin?: { lat: number; lng: number } | null; actions?: React.ReactNode; navAction?: React.ReactNode }) {
  const { map } = useMap();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const routeHandledRef = useRef(false);
  const kontriOpen = useKontribusiPanel((s) => s.open);
  const setKontriHalf = useKontribusiPanel((s) => s.setHalf);
  const closeKontribusi = useKontribusiPanel((s) => s.closePanel);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [q, setQ] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "empty" | "error">("idle");
  const [picked, setPicked] = useState<Place | null>(null);
  const [route, setRoute] = useState<[number, number][]>([]);
  const [routeInfo, setRouteInfo] = useState<string | null>(null);
  // Sinkronkan rute aktif ke store global → dipakai peringatan suara jalan berlubang.
  const setRouteCoords = useRouteStore((s) => s.setCoords);
  useEffect(() => {
    setRouteCoords(route.length > 1 ? route : null);
  }, [route, setRouteCoords]);
  const [routing, setRouting] = useState(false);
  const [routeErr, setRouteErr] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Search "aktif" = panel terbuka / input fokus / ada ketikan — hamburger disembunyikan saat itu.
  const searching = open || focused || q.trim().length > 0;

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const setQuery = (value: string) => {
    setQ(value);
    if (value.trim().length < MIN_QUERY) {
      abortRef.current?.abort();
      setPlaces([]);
      setStatus("idle");
    }
  };

  useEffect(() => {
    const query = q.trim();
    if (query.length < MIN_QUERY) return;
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setStatus("loading");
      try {
        const center = map?.getCenter();
        const url =
          `${PHOTON_URL}?q=${encodeURIComponent(query)}&limit=${LIMIT}` +
          (center ? `&lat=${center.lat}&lon=${center.lng}` : "");
        const res = await fetch(url, { signal: ac.signal });
        if (!res.ok) throw new Error(String(res.status));
        const json: { features?: PhotonFeature[] } = await res.json();
        const next: Place[] = (json.features ?? [])
          .filter((f) => Array.isArray(f.geometry?.coordinates))
          .map((f, i) => {
            const coords = f.geometry!.coordinates!;
            const { name, detail } = labelOf(f.properties ?? {});
            return { id: `${coords[0]},${coords[1]}-${i}`, name, detail, lng: coords[0], lat: coords[1] };
          });
        setPlaces(next);
        setStatus(next.length ? "idle" : "empty");
      } catch (err) {
        if ((err as Error).name !== "AbortError") setStatus("error");
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q, map]);

  const select = (p: Place) => {
    setRoute([]);
    setRouteInfo(null);
    setRouteErr(null);
    setOpen(false);
    // Panel kontribusi full → tutup dulu biar rute kelihatan
    closeKontribusi();
    if (!map) {
      setPicked(p);
      return;
    }
    // Loading di bar sampai animasi peta selesai, baru card rute muncul.
    setSelecting(true);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      map.off("moveend", finish);
      setSelecting(false);
      setPicked(p);
    };
    map.on("moveend", finish);
    setTimeout(finish, 1200); // safety kalau peta tidak bergerak
    map.flyTo({ center: [p.lng, p.lat], zoom: 16 });
  };

  const clearRoute = () => {
    setRoute([]);
    setRouteInfo(null);
    setRouteErr(null);
  };

  /** Rute dari lokasi pengguna ke tempat terpilih, digambar di peta. */
  const drawRoute = async (target: Place) => {
    setRouting(true);
    setRouteErr(null);
    try {
      const from: [number, number] = origin
        ? [origin.lng, origin.lat]
        : await new Promise<GeolocationPosition>((resolve, reject) =>
            // enableHighAccuracy=false → pakai cache jaringan/GPS terakhir, fix cepat
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, maximumAge: 60_000, timeout: 5_000 }),
          ).then((pos) => [pos.coords.longitude, pos.coords.latitude] as [number, number]);
      const url = `${OSRM_URL}${from[0]},${from[1]};${target.lng},${target.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const json: { routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] } = await res.json();
      const best = json.routes?.[0];
      if (!best) throw new Error("no-route");
      setRoute(best.geometry.coordinates);
      setRouteInfo(`${(best.distance / 1000).toFixed(1)} km · ${Math.max(1, Math.round(best.duration / 60))} mnt`);
      const bounds = best.geometry.coordinates.reduce<[[number, number], [number, number]]>(
        (acc, [lng, lat]) => [
          [Math.min(acc[0][0], lng), Math.min(acc[0][1], lat)],
          [Math.max(acc[1][0], lng), Math.max(acc[1][1], lat)],
        ],
        [[Infinity, Infinity], [-Infinity, -Infinity]],
      );
      map?.fitBounds(bounds, { padding: 70, duration: 800 });
    } catch {
      setRouteErr("Rute gagal diambil (izin lokasi / layanan). ");
    } finally {
      setRouting(false);
    }
  };

  /**
   * Rute dari halaman lain (mis. tombol tiket tim): /peta?route=lat,lng&label=...
   * → gambar rute langsung di peta web (OSRM), bukan Google Maps.
   */
  useEffect(() => {
    if (routeHandledRef.current) return;
    const raw = searchParams.get("route");
    if (!raw) return;
    const [latRaw, lngRaw] = raw.split(",");
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    routeHandledRef.current = true;
    const place: Place = {
      id: `route-${lat}-${lng}`,
      name: searchParams.get("label") ?? "Lokasi tujuan",
      detail: "Rute dari lokasi Anda",
      lng,
      lat,
    };
    // Efek sekali-jalan saat URL berisi ?route= — setPicked di sini aman (bukan sinkronisasi state biasa).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPicked(place);
    void drawRoute(place);
    router.replace(pathname); // bersihkan URL agar tidak menggambar ulang saat refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <>
      <div
        className="absolute left-2 right-2 top-2 z-[930] md:left-2 md:right-auto md:w-[min(22rem,calc(100%-1rem))] md:top-2"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) { setOpen(false); setFocused(false); }
        }}
      >
        <div className="flex h-10 items-center gap-2 rounded-full bg-neutral-0 px-3 shadow-lg ring-1 ring-neutral-200/70 sm:px-4">
          {navAction && !searching && <span className="-ml-1 shrink-0">{navAction}</span>}
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              setFocused(true);
              setOpen(true);
              // Panel kontribusi lagi full → turunkan ke setengah saat search ditekan
              if (kontriOpen) setKontriHalf(true);
            }}
            onMouseDown={() => {
              // Toggle hanya kalau sudah fokus — klik pertama biarkan focus yang buka panel,
              // jangan langsung ditutup lagi oleh click handler.
              if (document.activeElement === inputRef.current && !q.trim()) setOpen((v) => !v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "Enter" && places[0]) select(places[0]);
            }}
            placeholder="Cari tempat, jalan, gedung…"
            aria-label="Cari tempat"
            style={{ outline: "none" }}
            className="min-w-0 flex-1 bg-transparent text-sm text-neutral-900 outline-none focus:outline-none focus-visible:outline-none placeholder:text-neutral-500"
          />
          {selecting || status === "loading" ? (
            <Loader2 className="size-5 shrink-0 animate-spin text-neutral-500" aria-hidden="true" />
          ) : picked ? (
            <button
              type="button"
              aria-label="Tutup kartu rute"
              onClick={() => {
                setPicked(null);
                clearRoute();
                setQuery("");
                // Lepas fokus input juga — kalau tidak, "searching" tetap true dan hamburger tak muncul lagi.
                setFocused(false);
                inputRef.current?.blur();
              }}
              className="shrink-0 rounded-full p-1 text-neutral-600 transition-colors hover:bg-neutral-100"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          ) : (
            <Search className="size-5 shrink-0 text-neutral-600" aria-hidden="true" />
          )}
          {/* Profil / Masuk tetap sampai card muncul; saat card → menyusut halus ke kanan,
              X bergeser ke tepi. Tekan X → membalik, ikon jadi search lagi. */}
          <span
            className={`flex shrink-0 items-center overflow-hidden transition-all duration-300 ease-out ${
              picked ? "max-w-0 opacity-0" : "max-w-56 opacity-100"
            }`}
          >
            {actions}
          </span>
        </div>

        {open && (
          <div className="mt-2 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-0/95 shadow-lg backdrop-blur-sm">
          {places.length > 0 && (
            <ul className="max-h-64 overflow-y-auto">
              {places.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => select(p)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-neutral-100"
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary-600" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-neutral-900">{p.name}</span>
                      {p.detail && <span className="block truncate text-xs text-neutral-500">{p.detail}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {status === "idle" && q.trim().length < MIN_QUERY && (
            <p className="px-3 py-2 text-xs text-neutral-500">Ketik minimal {MIN_QUERY} huruf untuk mencari…</p>
          )}
          {status === "empty" && <p className="px-3 py-2 text-xs text-neutral-500">Tempat tidak ditemukan.</p>}
          {status === "error" && <p className="px-3 py-2 text-xs text-danger-600">Gagal menghubungi layanan pencarian.</p>}

          <p className="border-t border-neutral-200 px-3 py-1 text-[10px] text-neutral-400">Data © OpenStreetMap · Photon</p>
          </div>
        )}
      </div>

      {/* Bottom sheet: slide dari bawah, menutupi bottom bar (mobile); desktop tetap kartu kanan-bawah */}
      <div
        className={`absolute inset-x-0 bottom-0 z-[1001] overflow-hidden rounded-t-2xl border border-neutral-200 bg-neutral-0 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(15,23,42,0.18)] transition-transform duration-300 ease-out md:inset-x-auto md:bottom-4 md:right-4 md:w-96 md:rounded-2xl md:pb-0 ${
          picked ? "translate-y-0" : "pointer-events-none translate-y-full md:hidden"
        }`}
      >
        {picked && (
          <>
          <div className="flex items-start justify-between gap-2 px-4 pt-3.5">
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-neutral-900">{picked.name}</h2>
              {picked.detail && <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{picked.detail}</p>}
            </div>
            <button
              type="button"
              aria-label="Tutup detail tempat"
              onClick={() => { setPicked(null); clearRoute(); setQuery(""); }}
              className="shrink-0 rounded-full p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100"
            >
              <X className="size-4.5" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-3 flex gap-5 border-t border-neutral-100 px-4 py-3">
            <button
              type="button"
              disabled={routing}
              onClick={() => (route.length ? clearRoute() : void drawRoute(picked))}
              className="flex w-14 flex-col items-center gap-1 text-xs font-medium text-neutral-700"
            >
              <span
                className={`grid size-11 place-items-center rounded-full ${
                  route.length ? "bg-accent-600 text-neutral-0" : "bg-accent-100 text-accent-700"
                }`}
              >
                {routing ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                ) : (
                  <Navigation className="size-5" aria-hidden="true" />
                )}
              </span>
              {route.length ? "Hapus" : "Rute"}
            </button>
            <button
              type="button"
              className="flex w-14 flex-col items-center gap-1 text-xs font-medium text-neutral-700"
              onClick={async () => {
                const url = `https://www.google.com/maps/search/?api=1&query=${picked.lat},${picked.lng}`;
                try {
                  if (navigator.share) await navigator.share({ title: picked.name, url });
                  else await navigator.clipboard.writeText(url);
                } catch /* user batal share */ {}
              }}
            >
              <span className="grid size-11 place-items-center rounded-full bg-accent-100 text-accent-700">
                <Share2 className="size-5" aria-hidden="true" />
              </span>
              Bagikan
            </button>
          </div>

          {routeInfo && <p className="px-4 pb-1 text-xs font-medium text-accent-700">Jarak {routeInfo}</p>}
          {routeErr && <p className="px-4 pb-1 text-xs text-danger-600">{routeErr}</p>}
          <p className="border-t border-neutral-100 px-4 py-2 text-[11px] text-neutral-400">
            {picked.lat.toFixed(6)}, {picked.lng.toFixed(6)} · Data © OpenStreetMap
          </p>
          </>
        )}
      </div>

      {route.length > 0 && <MapRoute coordinates={route} color="#087F70" width={5} />}

      {picked && (
        <MapMarker longitude={picked.lng} latitude={picked.lat}>
          <MarkerContent>
            <span className="block size-5 rounded-full border-2 border-white bg-neutral-900 shadow-lg" aria-label={picked.name} />
          </MarkerContent>
        </MapMarker>
      )}
    </>
  );
}
