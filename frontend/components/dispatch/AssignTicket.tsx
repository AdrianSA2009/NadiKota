"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { TeamStatusPill } from "@/components/team/TeamStatusPill";
import { assignTicket } from "@/features/dashboard/dashboardApi";
import type { DispatchTicket, Team } from "@/features/dashboard/dashboardTypes";
import { formatCategory } from "@/lib/formatters";

/** Cache reverse geocoding (Photon) per tiket — untuk rekomendasi tim berdasar lokasi. */
const locationCache = new globalThis.Map<number, string>();

/** Logika pemilihan tim — dipakai modal desktop maupun halaman mobile. */
export function useAssignForm({ ticket, teams, onDone, onError }: { ticket: DispatchTicket; teams: Team[]; onDone: (message: string) => void; onError: (message: string) => void }) {
  const queryClient = useQueryClient();
  const isReassign = Boolean(ticket.assignedTeamId);
  const [chosen, setChosen] = useState<number | null>(ticket.assignedTeamId ?? null);
  const [search, setSearch] = useState("");
  const [haystack, setHaystack] = useState<string>(() => locationCache.get(ticket.id) ?? "");

  // Lokasi tiket → teks wilayah (Photon) untuk mencocokkan lokasi tim.
  useEffect(() => {
    if (haystack || !Number.isFinite(ticket.latitude) || !Number.isFinite(ticket.longitude)) return;
    let alive = true;
    // Photon reverse sudah mati (404) — Nominatim (OSM) untuk teks wilayah pencocokan tim.
    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${ticket.latitude}&lon=${ticket.longitude}&zoom=14`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { display_name?: string; address?: Record<string, string | undefined> } | null) => {
        const hay = [data?.display_name ?? "", ...Object.values(data?.address ?? {})].filter(Boolean).join(" ").toLowerCase();
        if (!hay) return;
        locationCache.set(ticket.id, hay);
        if (alive) setHaystack(hay);
      })
      .catch(() => { /* tanpa rekomendasi — daftar tetap tampil */ });
    return () => { alive = false; };
  }, [haystack, ticket.id, ticket.latitude, ticket.longitude]);

  const typeMatch = (team: Team) => {
    const type = (team.type ?? "").toLowerCase();
    if (ticket.category === "pothole") return type.includes("jalan");
    if (ticket.category === "street_light") return type.includes("pju");
    return false;
  };
  const recommended = (team: Team) =>
    team.isActive && ((team.district ? haystack.includes(team.district.toLowerCase()) : false) || typeMatch(team));

  const q = search.trim().toLowerCase();
  const sortedTeams = teams
    .filter((t) => !q || `${t.name} ${t.district ?? ""}`.toLowerCase().includes(q))
    .sort((a, b) => {
      const r = Number(recommended(b)) - Number(recommended(a));
      if (r !== 0) return r;
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
      void queryClient.invalidateQueries({ queryKey: ["teams"] });
      void queryClient.invalidateQueries({ queryKey: ["field-teams"] });
      void queryClient.invalidateQueries({ queryKey: ["team"] });
      const name = teams.find((t) => t.id === chosen)?.name ?? "tim";
      onDone(isReassign ? "Tiket dipindahkan ke tim baru." : `Tiket ditugaskan ke ${name}.`);
    },
    onError: (e) => onError(e instanceof Error ? e.message : "Gagal menugaskan tiket."),
  });

  return { chosen, setChosen, search, setSearch, teams: sortedTeams, recommended, assign, isReassign };
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
        <Badge variant={ticket.priorityLabel === "urgent" ? "urgent" : "waiting"} />
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

/** Pencarian + daftar tim card radio (rekomendasi, peringatan, state terpilih). */
export function TeamPicker({ chosen, onChoose, search, onSearch, teams, recommended }: {
  chosen: number | null;
  onChoose: (id: number) => void;
  search: string;
  onSearch: (v: string) => void;
  teams: Team[];
  recommended: (t: Team) => boolean;
}) {
  return (
    <div>
      <label className="relative block">
        <span className="sr-only">Cari tim</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
        <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Cari tim (nama / lokasi)" className="min-h-11 w-full rounded-xl border border-neutral-300 bg-neutral-0 pl-9 pr-3 text-base text-neutral-900 placeholder:text-neutral-400 focus-visible:border-accent-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/25" />
      </label>

      <div className="mt-3 space-y-2">
        {teams.length === 0 && <p className="py-6 text-center text-sm text-neutral-500">Belum ada tim yang cocok. Buat tim dulu di menu Tim.</p>}
        {teams.map((team) => {
          const isRecommended = recommended(team);
          const selected = chosen === team.id;
          return (
            <button
              key={team.id}
              type="button"
              disabled={!team.isActive}
              aria-pressed={selected}
              onClick={() => onChoose(team.id)}
              className={`flex w-full items-start justify-between gap-3 rounded-xl border p-3 text-left transition ${selected ? "border-accent-600 bg-accent-50" : "border-neutral-200 bg-neutral-0 hover:border-primary-300"} ${!team.isActive ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <div className="flex min-w-0 gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary-800" aria-hidden="true">
                  {team.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-neutral-900">{team.name}</p>
                    {isRecommended && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-accent-600 bg-accent-50 px-2 py-0.5 text-[11px] font-semibold text-accent-700">
                        <Sparkles className="size-3" aria-hidden="true" />Rekomendasi
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500">
                    <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{team.district ?? "Tanpa lokasi"} · PJ: {team.leader?.name ?? "belum diatur"}</span>
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <TeamStatusPill status={team.status} />
                    {!team.isActive && <span className="text-[11px] font-medium text-danger-700">Tim nonaktif — tidak dapat dipilih</span>}
                    {team.isActive && team.status === "bertugas" && <span className="text-[11px] font-medium text-warning-800">Sedang bertugas ({team.activeTicketCount} tiket)</span>}
                  </div>
                </div>
              </div>
              <span className={`mt-1 size-4 shrink-0 rounded-full border-2 ${selected ? "border-accent-600 bg-accent-600" : "border-neutral-300"}`} aria-hidden="true" />
            </button>
          );
        })}
      </div>
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
