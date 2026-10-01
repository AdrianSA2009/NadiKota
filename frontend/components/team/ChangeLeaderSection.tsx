"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserCog } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { changeTeamLeader } from "@/features/dashboard/dashboardApi";
import type { Team } from "@/features/dashboard/dashboardTypes";
import { useToastStore } from "@/lib/toastStore";
import { LeaderFields, buildLeaderInput, emptyLeaderForm, type LeaderForm } from "./LeaderFields";

/**
 * Bagian Ganti PJ — komponen bersama: dipakai halaman edit mobile (extraSection)
 * dan modal Ganti PJ di halaman detail desktop.
 */
export function ChangeLeaderSection({ team, onDone, compact = false }: { team: Team; onDone?: () => void; compact?: boolean }) {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  const [leader, setLeader] = useState<LeaderForm>(emptyLeaderForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: () => changeTeamLeader(team.id, buildLeaderInput(leader)),
    onSuccess: () => {
      showToast("Penanggung Jawab tim diganti.", "success");
      void queryClient.invalidateQueries({ queryKey: ["teams"] });
      void queryClient.invalidateQueries({ queryKey: ["team", team.id] });
      setLeader(emptyLeaderForm);
      onDone?.();
    },
    onError: (e) => {
      const fields = (e as Error & { fields?: Record<string, string[]> }).fields;
      if (fields) setErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v[0] ?? "Tidak valid."])));
      showToast(e instanceof Error ? e.message : "Gagal mengganti PJ.", "info");
    },
  });

  function submit() {
    const errs: Record<string, string> = {};
    if (leader.pjMode === "new") {
      if (!leader.pjName.trim()) errs.pj_name = "Nama PJ wajib diisi.";
      if (leader.pjUsername.trim().length < 3) errs.pj_username = "Username minimal 3 karakter.";
      if (leader.pjPassword.length < 8) errs.pj_password = "Password minimal 8 karakter.";
    } else if (!leader.userId) {
      errs.user_id = "Pilih warga yang akan menjadi PJ.";
    }
    setErrors(errs);
    if (Object.keys(errs).length === 0) mutation.mutate();
  }

  return (
    <section className={compact ? "" : "rounded-xl border border-neutral-200 bg-neutral-0 p-4"}>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
        <UserCog className="size-4 text-primary-700" aria-hidden="true" />
        Ganti Penanggung Jawab
      </h3>
      <p className="mt-1 text-xs text-neutral-500">PJ lama dikembalikan menjadi warga — riwayat laporannya tetap tersimpan.</p>
      {team.activeTicketCount > 0 && (
        <p className="mt-2 rounded-lg border border-warning-600 bg-warning-50 px-3 py-2 text-xs text-warning-800">
          Tim sedang memegang {team.activeTicketCount} tiket aktif — penugasan tetap melekat pada tim, bukan PJ.
        </p>
      )}
      <div className="mt-3">
        <LeaderFields value={leader} onChange={setLeader} errors={errors} />
      </div>
      <Button type="button" className="mt-3 w-full justify-center sm:w-auto" disabled={mutation.isPending} onClick={submit}>
        {mutation.isPending ? "Menyimpan..." : "Simpan PJ"}
      </Button>
    </section>
  );
}
