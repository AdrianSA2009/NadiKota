"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { TeamStatusPill } from "@/components/team/TeamStatusPill";
import { AREA_COORDS, haversineKm } from "@/lib/batamAreas";
import { assignTicket } from "@/features/dashboard/dashboardApi";
import type { DispatchTicket, Team } from "@/features/dashboard/dashboardTypes";
import { formatCategory } from "@/lib/formatters";

/** Logika pemilihan tim — dipakai modal desktop maupun halaman mobile. */
export function useAssignForm({ ticket, teams, onDone, onError }: { ticket: DispatchTicket; teams: Team[]; onDone: (message: string) => void; onError: (message: string) => void }) {
  const queryClient = useQueryClient();
  const isReassign = Boolean(ticket.assignedTeamId);
  const [chosen, setChosen] = useState<number | null>(ticket.assignedTeamId ?? null);
  const [search, setSearch] = useState("");

  const hasLocation = Number.isFinite(ticket.latitude) && Number.isFinite(ticket.longitude);

  // Jarak tim (pusat wilayahnya) → lokasi kerusakan, dalam km. null = koordinat tidak tersedia.
  const distanceKm = (team: Team): number | null => {
    if (!hasLocation) return null;
    const coords = team.district ? AREA_COORDS[team.district] : undefined;
    if (!coords) return null;
    return haversineKm(ticket.latitude, ticket.longitude, coords[0], coords[1]);
  };

  const typeMatch = (team: Team) => {
    const type = (team.type ?? "").toLowerCase();
    if (ticket.category === "pothole") return type.includes("jalan");
    if (ticket.category === "street_light") return type.includes("pju");
    return false;
  };

  // "Terdekat" hanya untuk SATU tim — jarak terkecil dari lokasi kerusakan
  // (fallback: tim tipe cocok pertama bila tanpa koordinat). Sisanya tetap tampil tanpa chip.
  const nearestId = (() => {
    let bestId: number | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const t of teams) {
      if (!t.isActive) continue;
      const d = distanceKm(t);
      if (d !== null && d < best) {
        best = d;
        bestId = t.id;
      }
    }
    if (bestId !== null) return bestId;
    return teams.find((t) => t.isActive && typeMatch(t))?.id ?? null;
  })();
  const recommended = (team: Team) => team.isActive && team.id === nearestId;

  const q = search.trim().toLowerCase();
  const sortedTeams = teams
    .filter((t) => !q || `${t.name} ${t.district ?? ""}`.toLowerCase().includes(q))
    .sort((a, b) => {
      const r = Number(recommended(b)) - Number(recommended(a));
      if (r !== 0) return r;
      // Di dalam grup yang sama (terdekat / biasa), urutkan jarak menaik — yang terdekat di atas.
      const da = distanceKm(a) ?? Number.POSITIVE_INFINITY;
      const db = distanceKm(b) ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      const active = Number(b.isActive) - Number(a.isActive);
      if (active !== 0) return active;
      return a.name.localeCompare(b.name);
    });

  const assign = useMutation({
    mutationFn: () => assignTicket(ticket.id, chosen!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dispatch-tickets"] });
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      // Peta ikut segar: penugasan baru harus langsung terlihat di peta.
      void queryClient.invalidateQueries({ queryKey: ["tickets-map"] });
      void queryClient.invalidateQueries({ queryKey: ["teams"] });
      void queryClient.invalidateQueries({ queryKey: ["field-teams"] });
      void queryClient.invalidateQueries({ queryKey: ["team"] });
      const name = teams.find((t) => t.id === chosen)?.name ?? "tim";
      onDone(isReassign ? "Tiket dipindahkan ke tim baru." : `Tiket ditugaskan ke ${name}.`);
    },
    onError: (e) => onError(e instanceof Error ? e.message : "Gagal menugaskan tiket."),
  });

  return { chosen, setChosen, search, setSearch, teams: sortedTeams, recommended, distanceKm, assign, isReassign };
}

/** Ringkasan tiket (kiri modal / atas halaman mobile). */
export function TicketSummary({ ticket, photo = true, compact = false }: { ticket: DispatchTicket; photo?: boolean; compact?: boolean }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-0 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-neutral-500">{ticket.ticketNumber}</p>
          <h3 className="truncate font-semibold text-neutral-900">{formatCategory(ticket.category)}</h3>
        </div>
        <Badge variant={ticket.status === "in_progress" && ticket.reviewStatus === "submitted" ? "assessing" : ticket.status === "completed" ? "done" : ticket.status === "cancelled" ? "cancelled" : ticket.status === "rejected" ? "urgent" : ticket.status} />
      </div>
      <dl className={`mt-3 space-y-1.5 text-sm ${compact ? "" : ""}`}>
        <div className="flex gap-2">
          <dt className="shrink-0 text-neutral-500">Lokasi</dt>
          <dd className="flex min-w-0 items-center gap-1 font-medium text-neutral-800">
            <MapPin className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
            {Number.isFinite(ticket.latitude) && Number.isFinite(ticket.longitude)
              ? `${ticket.latitude.toFixed(5)}, ${ticket.longitude.toFixed(5)}`
              : "tidak tersedia"}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-neutral-500">Dibuat</dt>
          <dd className="font-medium text-neutral-800">{new Date(ticket.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</dd>
        </div>
        {ticket.assignedTeamId != null && (
          <div className="flex gap-2">
            <dt className="shrink-0 text-neutral-500">Status</dt>
            <dd className="font-medium text-neutral-800">Sudah ditugaskan</dd>
          </div>
        )}
      </dl>
      {photo && ticket.photoUrl && (
        <div className="mt-3 overflow-hidden rounded-lg border border-neutral-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ticket.photoUrl} alt={`Foto laporan ${ticket.ticketNumber}`} className="max-h-40 w-full object-cover" />
        </div>
      )}
    </div>
  );
}

/**
 * Search-dropdown (combobox) pilihan tim — opsi terurut: rekomendasi terdekat dulu,
 * lalu aktif, lalu nama. Ketik untuk menyaring, klik untuk memilih.
 */
export function TeamPicker({ chosen, onChoose, search, onSearch, teams, recommended, distanceKm, variant = "dropdown" }: {
  chosen: number | null;
  onChoose: (id: number) => void;
  search: string;
  onSearch: (v: string) => void;
  teams: Team[];
  recommended: (t: Team) => boolean;
  /** Jarak tim → lokasi kerusakan (km). null = tanpa koordinat. */
  distanceKm?: (t: Team) => number | null;
  /** desktop = daftar kartu inline (scroll ±3 kartu); mobile = search dropdown. */
  variant?: "list" | "dropdown";
}) {
  const [open, setOpen] = useState(false);
  // Saat fokus, input menampilkan teks pencarian (bukan nama tim terpilih) supaya bisa dihapus/diedit.
  const [editing, setEditing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const chosenTeam = teams.find((t) => t.id === chosen) ?? null;

  // Klik di luar → tutup dropdown.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Isi satu opsi tim — dipakai varian list maupun dropdown.
  const option = (team: Team) => {
    const isRecommended = recommended(team);
    const selected = chosen === team.id;
    const distance = distanceKm?.(team) ?? null;
    return (
      <>
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary-800" aria-hidden="true">
          {team.name.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-neutral-900">{team.name}</span>
            {isRecommended && (
              <span className="inline-flex items-center gap-1 rounded-full border border-accent-600 bg-accent-50 px-2 py-0.5 text-[11px] font-semibold text-accent-700">
                <Sparkles className="size-3" aria-hidden="true" />Terdekat
              </span>
            )}
            {distance !== null && (
              <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
                <MapPin className="size-3" aria-hidden="true" />
                {distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`}
              </span>
            )}
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{team.district ?? "Tanpa lokasi"} · PJ: {team.leader?.name ?? "belum diatur"}</span>
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <TeamStatusPill status={team.status} />
            {!team.isActive && <span className="text-[11px] font-medium text-danger-700">Tim nonaktif — tidak dapat dipilih</span>}
            {team.isActive && team.status === "bertugas" && <span className="text-[11px] font-medium text-warning-800">Sedang bertugas ({team.activeTicketCount} tiket)</span>}
          </span>
        </span>
        <span className={`mt-1 size-4 shrink-0 rounded-full border-2 ${selected ? "border-accent-600 bg-accent-600" : "border-neutral-300"}`} aria-hidden="true" />
      </>
    );
  };

  const optionClass = (team: Team) =>
    `flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${chosen === team.id ? "border-accent-600 bg-accent-50" : "border-neutral-200 bg-neutral-0 hover:border-primary-300"} ${!team.isActive ? "cursor-not-allowed opacity-60" : ""}`;

  const searchInput = (
    <label className="relative block">
      <span className="sr-only">Cari tim</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
      <input
        role={variant === "dropdown" ? "combobox" : undefined}
        aria-expanded={variant === "dropdown" ? open : undefined}
        aria-controls={variant === "dropdown" ? "team-listbox" : undefined}
        aria-autocomplete={variant === "dropdown" ? "list" : undefined}
        autoComplete="off"
        value={editing ? search : (chosenTeam ? chosenTeam.name : search)}
        onChange={(e) => { onSearch(e.target.value); if (variant === "dropdown") setOpen(true); }}
        onFocus={() => { setEditing(true); if (variant === "dropdown") setOpen(true); }}
        onBlur={() => {
          // Editing selesai → input menampilkan nama tim terpilih.
          // JANGAN kosongkan filter di sini: nama tim hasil autofill akan ikut tersaring
          // dan daftar tampak kosong saat pengguna mencoba menghapus/mengetik ulang.
          setEditing(false);
        }}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        placeholder="Cari tim (nama / lokasi)…"
        className="min-h-11 w-full rounded-xl border border-neutral-300 bg-neutral-0 pl-9 pr-3 text-base text-neutral-900 placeholder:text-neutral-400 focus-visible:border-accent-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/25"
      />
    </label>
  );

  // Varian desktop: daftar kartu inline — tampil ±3 kartu (≈98px + gap), sisanya scroll.
  if (variant === "list") {
    return (
      <div>
        {searchInput}
        <div className="mt-3 max-h-[312px] space-y-2 overflow-y-auto overscroll-contain pr-1">
          {teams.length === 0 && <p className="py-6 text-center text-sm text-neutral-500">Belum ada tim yang cocok. Buat tim dulu di menu Tim.</p>}
          {teams.map((team) => (
            <button key={team.id} type="button" disabled={!team.isActive} aria-pressed={chosen === team.id} onClick={() => { onChoose(team.id); onSearch(team.name); }} className={optionClass(team)}>
              {option(team)}
            </button>
          ))}
        </div>
        {chosenTeam && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-neutral-600">
            <Sparkles className="size-3.5 text-accent-600" aria-hidden="true" />
            Dipilih: <span className="font-semibold text-neutral-900">{chosenTeam.name}</span>
          </p>
        )}
      </div>
    );
  }

  // Varian mobile: search dropdown.
  return (
    <div ref={containerRef} className="relative">
      {searchInput}

      {open && (
        <ul
          id="team-listbox"
          role="listbox"
          aria-label="Daftar tim"
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-neutral-200 bg-neutral-0 py-1 shadow-lg"
        >
          {teams.length === 0 && <li className="px-3.5 py-3 text-sm text-neutral-500">Belum ada tim yang cocok. Buat tim dulu di menu Tim.</li>}
          {teams.map((team) => (
            <li key={team.id} role="option" aria-selected={chosen === team.id}>
              <button
                type="button"
                disabled={!team.isActive}
                onMouseDown={(e) => e.preventDefault() /* biar blur input tidak menutup sebelum klik */}
                onClick={() => {
                  // Autofill search dgn nama tim — editing tetap aktif (input masih fokus),
                  // jadi hasilnya bisa langsung diedit/dihapus. Blur → tampilkan nama terpilih.
                  onChoose(team.id);
                  onSearch(team.name);
                  setOpen(false);
                }}
                className="flex w-full items-start gap-3 rounded-lg px-3.5 py-2.5 text-left transition-colors hover:bg-primary-50"
              >
                {option(team)}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!open && chosenTeam && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-neutral-600">
          <Sparkles className="size-3.5 text-accent-600" aria-hidden="true" />
          Dipilih: <span className="font-semibold text-neutral-900">{chosenTeam.name}</span>
        </p>
      )}
    </div>
  );
}

/** Urutkan tiket dispatch: belum ditugaskan dulu, lalu tanggal (terbaru/terlama). */
export function sortDispatchTickets(tickets: DispatchTicket[], sort: "newest" | "oldest"): DispatchTicket[] {
  return [...tickets].sort((a, b) => {
    const unassigned = Number(!a.assignedTeamId) - Number(!b.assignedTeamId);
    if (unassigned !== 0) return -unassigned;
    const diff = Date.parse(b.createdAt) - Date.parse(a.createdAt);
    return sort === "oldest" ? -diff : diff;
  });
}
