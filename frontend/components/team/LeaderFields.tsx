"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { searchTeamLeaders, type LeaderInput } from "@/features/dashboard/dashboardApi";

export type LeaderForm = {
  pjMode: "new" | "existing";
  pjName: string;
  pjUsername: string;
  pjEmail: string;
  pjPhone: string;
  pjPassword: string;
  userId: number | null;
  userName: string;
};

export const emptyLeaderForm: LeaderForm = {
  pjMode: "new",
  pjName: "",
  pjUsername: "",
  pjEmail: "",
  pjPhone: "",
  pjPassword: "",
  userId: null,
  userName: "",
};

/** Susun payload backend dari state form PJ. */
export function buildLeaderInput(form: LeaderForm): LeaderInput {
  if (form.pjMode === "existing") return { pj_mode: "existing", user_id: form.userId ?? undefined };
  return {
    pj_mode: "new",
    pj_name: form.pjName.trim(),
    pj_username: form.pjUsername.trim(),
    pj_email: form.pjEmail.trim() || undefined,
    pj_phone: form.pjPhone.trim() || undefined,
    pj_password: form.pjPassword,
  };
}

const input = "mt-1.5 min-h-11 w-full rounded-xl border border-neutral-300 bg-neutral-0 px-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:border-accent-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/25";
const inputError = "mt-1.5 min-h-11 w-full rounded-xl border border-danger-600 bg-danger-50 px-3.5 text-sm text-neutral-900 focus-visible:border-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-600/25";
const fieldError = "mt-1 text-xs leading-snug text-danger-700";

/** Bagian form Penanggung Jawab: buat akun baru atau pilih warga yang sudah ada (diubah jadi Tim). */
export function LeaderFields({
  value,
  onChange,
  errors = {},
}: {
  value: LeaderForm;
  onChange: (v: LeaderForm) => void;
  errors?: Record<string, string>;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: number; name: string; username?: string | null }[] | null>(null);
  const timerRef = useRef<number | null>(null);
  const search = useMutation({
    mutationFn: () => searchTeamLeaders(q.trim()),
    onSuccess: (data) => setResults(data),
    onError: () => setResults([]),
  });

  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

  /** Pencarian REAL-TIME: ketik → debounce 350ms → langsung hasil (min 2 huruf). */
  function onQueryChange(value: string) {
    setQ(value);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    const t = value.trim();
    if (t.length < 2) { setResults(null); return; }
    timerRef.current = window.setTimeout(() => search.mutate(), 350);
  }

  const modeBtn = (mode: "new" | "existing", label: string) => (
    <button
      key={mode}
      type="button"
      aria-pressed={value.pjMode === mode}
      onClick={() => onChange({ ...value, pjMode: mode })}
      className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${value.pjMode === mode ? "bg-primary-800 text-neutral-0" : "border border-neutral-200 bg-neutral-0 text-neutral-600 hover:border-primary-300"}`}
    >
      {label}
    </button>
  );

  return (
    <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <h3 className="text-sm font-semibold text-neutral-900">Penanggung Jawab (PJ) <span className="font-normal text-neutral-500">— wajib</span></h3>
      <div className="mt-2 flex gap-2">
        {modeBtn("new", "Buat akun baru")}
        {modeBtn("existing", "Pilih warga")}
      </div>

      {value.pjMode === "new" ? (
        <div className="mt-3 space-y-2">
          <div>
            <label htmlFor="pj-name" className="text-xs font-medium text-neutral-700">Nama PJ</label>
            <input id="pj-name" value={value.pjName} onChange={(e) => onChange({ ...value, pjName: e.target.value })} placeholder="Nama lengkap" className={errors.pj_name ? inputError : input} />
            {errors.pj_name && <p className={fieldError}>{errors.pj_name}</p>}
          </div>
          <div>
            <label htmlFor="pj-username" className="text-xs font-medium text-neutral-700">Username</label>
            <input id="pj-username" value={value.pjUsername} onChange={(e) => onChange({ ...value, pjUsername: e.target.value })} placeholder="mis. pj_batamcenter" className={errors.pj_username ? inputError : input} />
            {errors.pj_username && <p className={fieldError}>{errors.pj_username}</p>}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label htmlFor="pj-email" className="text-xs font-medium text-neutral-700">Email (opsional)</label>
              <input id="pj-email" type="email" value={value.pjEmail} onChange={(e) => onChange({ ...value, pjEmail: e.target.value })} placeholder="nama@email.com" className={errors.pj_email ? inputError : input} />
              {errors.pj_email && <p className={fieldError}>{errors.pj_email}</p>}
            </div>
            <div>
              <label htmlFor="pj-phone" className="text-xs font-medium text-neutral-700">Telepon (opsional)</label>
              <input id="pj-phone" value={value.pjPhone} onChange={(e) => onChange({ ...value, pjPhone: e.target.value })} placeholder="08xxxxxxxxxx" className={errors.pj_phone ? inputError : input} />
              {errors.pj_phone && <p className={fieldError}>{errors.pj_phone}</p>}
            </div>
          </div>
          <div>
            <label htmlFor="pj-password" className="text-xs font-medium text-neutral-700">Password awal</label>
            <input id="pj-password" type="password" value={value.pjPassword} onChange={(e) => onChange({ ...value, pjPassword: e.target.value })} placeholder="Minimal 8 karakter" className={errors.pj_password ? inputError : input} />
            {errors.pj_password && <p className={fieldError}>{errors.pj_password}</p>}
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {value.userId ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-accent-500 bg-accent-50 px-3 py-2 text-sm">
              <span className="truncate font-medium text-neutral-900">{value.userName}</span>
              <button type="button" className="shrink-0 text-xs font-semibold text-accent-700 hover:text-accent-800" onClick={() => onChange({ ...value, userId: null, userName: "" })}>Ganti</button>
            </div>
          ) : (
            <>
              <label className="relative block">
                <span className="sr-only">Cari warga (nama / username / email)</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
                <input value={q} onChange={(e) => onQueryChange(e.target.value)} placeholder="Ketik untuk cari warga…" className={input} style={{ paddingLeft: "2.25rem" }} />
              </label>
              {search.isPending && <p className="text-xs text-neutral-500">Mencari…</p>}
              {results && results.length === 0 && <p className="text-xs text-neutral-500">Warga tidak ditemukan.</p>}
              {results?.map((u) => (
                <button key={u.id} type="button" onClick={() => onChange({ ...value, userId: u.id, userName: `${u.name} (@${u.username})` })} className="flex w-full items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-neutral-0 px-3 py-2 text-left text-sm transition hover:border-primary-300">
                  <span className="truncate font-medium text-neutral-900">{u.name}</span>
                  <span className="shrink-0 text-xs text-neutral-500">@{u.username}</span>
                </button>
              ))}
            </>
          )}
          {errors.user_id && <p className={fieldError}>{errors.user_id}</p>}
        </div>
      )}
      {errors.pj_mode && <p className={fieldError}>{errors.pj_mode}</p>}
    </section>
  );
}
