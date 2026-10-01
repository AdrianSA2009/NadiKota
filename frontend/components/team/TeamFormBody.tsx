"use client";

import type { Team } from "@/features/dashboard/dashboardTypes";
import { LeaderFields } from "./LeaderFields";
import { DistrictPicker } from "./DistrictPicker";
import type { useTeamForm } from "./useTeamForm";

type Form = ReturnType<typeof useTeamForm>;

const input = "mt-1.5 min-h-11 w-full rounded-xl border border-neutral-300 bg-neutral-0 px-3.5 text-base text-neutral-900 placeholder:text-neutral-400 focus-visible:border-accent-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/25";
const inputError = "mt-1.5 min-h-11 w-full rounded-xl border border-danger-600 bg-danger-50 px-3.5 text-base text-neutral-900 focus-visible:border-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-600/25";
const fieldError = "mt-1 text-xs leading-snug text-danger-700";

function SectionTitle({ children }: { children: string }) {
  return <h3 className="mb-3 border-b border-neutral-100 pb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{children}</h3>;
}

/**
 * Isi form tim — SATU sumber untuk modal desktop (layout="modal", dua kolom)
 * dan halaman mobile (layout="page", satu kolom bersection). Tombol aksi di shell masing-masing.
 * `team` dipertahankan di tipe untuk kompatibilitas pemanggil — tidak dipakai isi form.
 */
export function TeamFormBody({ state, team, layout }: { state: Form; team: Team | null; layout: "modal" | "page" }) {
  const { form, setForm, errors, leader, setLeader } = state;
  // PJ dikunci selagi tim sedang mengerjakan tiket (in_progress) — backend ikut menolak.
  const leaderLocked = state.isEdit && (team?.inProgressTicketCount ?? 0) > 0;

  const dataFields = (
    <>
      <div>
        <label htmlFor={`${layout}-team-name`} className="text-sm font-medium text-neutral-900">Nama tim</label>
        <input id={`${layout}-team-name`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="mis. Tim PJU Batu Aji" className={errors.name ? inputError : input} />
        {errors.name && <p className={fieldError}>{errors.name}</p>}
      </div>
      <div>
        <label htmlFor={`${layout}-team-district`} className="text-sm font-medium text-neutral-900">Lokasi / wilayah</label>
        <DistrictPicker
          id={`${layout}-team-district`}
          value={form.district}
          onChange={(v) => setForm({ ...form, district: v })}
          invalid={Boolean(errors.district)}
        />
        {errors.district && <p className={fieldError}>{errors.district}</p>}
      </div>
      {/* Jenis tim & deskripsi tidak lagi ditampilkan di form — nilai lama tetap terkirim apa adanya (lihat useTeamForm). */}
    </>
  );

  if (layout === "page") {
    return (
      <div className="space-y-8">
        <section>
          <SectionTitle>Data tim</SectionTitle>
          <div className="space-y-4">{dataFields}</div>
        </section>
        <section>
          <SectionTitle>{state.isEdit ? "Ganti Penanggung Jawab" : "Penanggung Jawab"}</SectionTitle>
          {leaderLocked ? (
            <p className="rounded-lg border border-warning-600 bg-warning-50 px-3 py-2 text-xs text-warning-800">
              PJ tidak bisa diubah selagi tim sedang melaksanakan tugas. Tunggu sampai tugas selesai.
            </p>
          ) : (
            <LeaderFields value={leader} onChange={setLeader} errors={errors} />
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section>
        <SectionTitle>Data tim</SectionTitle>
        <div className="space-y-4">{dataFields}</div>
      </section>
      <section>
        <SectionTitle>{state.isEdit ? "Ganti Penanggung Jawab" : "Penanggung Jawab"}</SectionTitle>
        {leaderLocked ? (
          <p className="rounded-lg border border-warning-600 bg-warning-50 px-3 py-2 text-xs text-warning-800">
            PJ tidak bisa diubah selagi tim sedang melaksanakan tugas. Tunggu sampai tugas selesai.
          </p>
        ) : (
          <LeaderFields value={leader} onChange={setLeader} errors={errors} />
        )}
      </section>
    </div>
  );
}
