"use client";

import type { Team } from "@/features/dashboard/dashboardTypes";
import { TeamStatusPill } from "./TeamStatusPill";
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

/** Preview card tim (desktop) — mengikuti input yang sedang diketik. */
function TeamPreview({ form, team }: { form: Form; team: Team | null }) {
  const name = form.form.name.trim() || "Nama tim";
  const district = form.form.district.trim() || "Lokasi / wilayah";
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-0 p-3 shadow-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Preview kartu tim</p>
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary-800" aria-hidden="true">
          {name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-900">{name}</p>
          <p className="truncate text-xs text-neutral-500">{district}</p>
        </div>
        <TeamStatusPill status={team?.status ?? "tersedia"} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-neutral-100 pt-2 text-xs text-neutral-500">
        <span>PJ: {team?.leader?.name ?? "belum diatur"}</span>
        <span>{team?.activeTicketCount ?? 0} tiket aktif</span>
      </div>
    </div>
  );
}

/**
 * Isi form tim — SATU sumber untuk modal desktop (layout="modal", dua kolom + preview)
 * dan halaman mobile (layout="page", satu kolom bersection). Tombol aksi di shell masing-masing.
 */
export function TeamFormBody({ state, team, layout }: { state: Form; team: Team | null; layout: "modal" | "page" }) {
  const { form, setForm, errors, leader, setLeader } = state;

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
      <div>
        <label htmlFor={`${layout}-team-type`} className="text-sm font-medium text-neutral-900">Jenis tim <span className="font-normal text-neutral-400">(opsional)</span></label>
        <input id={`${layout}-team-type`} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="mis. Pemeliharaan Jalan / PJU" className={input} />
      </div>
      <div>
        <label htmlFor={`${layout}-team-description`} className="text-sm font-medium text-neutral-900">Deskripsi <span className="font-normal text-neutral-400">(opsional)</span></label>
        <textarea id={`${layout}-team-description`} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Catatan singkat tentang tim." className={input} />
      </div>
    </>
  );

  if (layout === "page") {
    return (
      <div className="space-y-8">
        <section>
          <SectionTitle>Data tim</SectionTitle>
          <div className="space-y-4">{dataFields}</div>
        </section>
        {!state.isEdit && (
          <section>
            <SectionTitle>Penanggung Jawab</SectionTitle>
            <LeaderFields value={leader} onChange={setLeader} errors={errors} />
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section>
        <SectionTitle>Data tim</SectionTitle>
        <div className="space-y-4">{dataFields}</div>
      </section>
      <section className="space-y-4">
        {!state.isEdit && (
          <div>
            <SectionTitle>Penanggung Jawab</SectionTitle>
            <LeaderFields value={leader} onChange={setLeader} errors={errors} />
          </div>
        )}
        <div className="hidden md:block">
          <TeamPreview form={state} team={team} />
        </div>
      </section>
    </div>
  );
}
