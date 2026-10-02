import { useEffect, useRef } from "react";
import type { Ticket } from "@/features/dashboard/dashboardTypes";
import { haversineKm } from "@/lib/batamAreas";
import { useRouteStore } from "@/lib/routeStore";
import { speakId } from "@/lib/speak";

const WARN_M = 50;
const ACTIVE_STATUS = ["reported", "verified", "queued", "needs_review", "in_progress"];

/** Jarak titik (lng,lat) ke polyline rute — proyeksi equirectangular (cukup utk <1 km). */
function distanceToPolylineM(lng: number, lat: number, line: [number, number][]): number {
  const kx = 111320 * Math.cos((lat * Math.PI) / 180);
  const ky = 110540;
  const x = lng * kx;
  const y = lat * ky;
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = [line[i][0] * kx, line[i][1] * ky];
    const [bx, by] = [line[i + 1][0] * kx, line[i + 1][1] * ky];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const d = Math.hypot(x - cx, y - cy);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Peringatan suara jalan berlubang 50 m — HANYA saat pengguna sedang pakai rute.
 *
 * Aturan:
 * - Tiket lubang (category=pothole, status aktif) yang berada ≤50 m dari polyline rute
 *   dianggap "berada di rute".
 * - Saat posisi GPS pengguna ≤50 m dari lubang tsb → ucapkan peringatan (sekali per
 *   lubang per rute; reset saat rute berganti).
 */
export function usePotholeVoiceAlert(tickets: Ticket[], position: { lat: number; lng: number } | null) {
  const route = useRouteStore((s) => s.coords);
  const warnedRef = useRef<Set<number>>(new Set());

  // Rute baru → mulai lagi dari nol (boleh ingatkan lubang yang sama lagi nanti).
  useEffect(() => {
    warnedRef.current.clear();
  }, [route]);

  const enabled = Boolean(route && route.length > 1 && position);

  useEffect(() => {
    if (!enabled || !route || !position) return;
    // Koordinat sudah dicek finite saat render marker; filter status terminal.
    const onRoute = tickets.filter(
      (t) =>
        t.category === "pothole" &&
        ACTIVE_STATUS.includes(t.status) &&
        Number.isFinite(t.latitude) &&
        Number.isFinite(t.longitude) &&
        !warnedRef.current.has(t.id) &&
        distanceToPolylineM(t.longitude, t.latitude, route) <= WARN_M,
    );
    if (onRoute.length === 0) return;

    for (const t of onRoute) {
      const dM = haversineKm(position.lat, position.lng, t.latitude, t.longitude) * 1000;
      if (dM <= WARN_M) {
        warnedRef.current.add(t.id);
        speakId("Hati-hati, di depan ada jalan berlubang.");
        break; // satu peringatan per momen — jangan tumpuk suara
      }
    }
  }, [enabled, route, position, tickets]);
}
