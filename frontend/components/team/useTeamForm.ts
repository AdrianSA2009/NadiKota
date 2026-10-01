"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToastStore } from "@/lib/toastStore";
import { createTeam, updateTeam, changeTeamLeader, type TeamInput } from "@/features/dashboard/dashboardApi";
import { BATAM_AREAS } from "@/lib/batamAreas";
import type { Team } from "@/features/dashboard/dashboardTypes";
import { buildLeaderInput, emptyLeaderForm, type LeaderForm } from "./LeaderFields";

export type TeamFormValues = { name: string; district: string; type: string; description: string };

/**
 * Sumber tunggal logika form tim (validasi + submit) — dipakai modal desktop
 * maupun halaman mobile (Buat Tim / Edit Tim).
 */
export function useTeamForm({ team, onSuccess }: { team: Team | null; onSuccess: () => void }) {
  const isEdit = team !== null;
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  const [form, setForm] = useState<TeamFormValues>({
    name: team?.name ?? "",
    district: team?.district ?? "",
    type: team?.type ?? "",
    description: team?.description ?? "",
  });
  const [leader, setLeader] = useState<LeaderForm>(
    isEdit
      ? { ...emptyLeaderForm, pjMode: "existing", userId: team?.leader?.id ?? null, userName: team?.leader?.name ?? "" }
      : emptyLeaderForm,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  /** PJ ikut disimpan saat submit — buat baru (create) atau ganti (edit, bila berubah). */
  const leaderChanged = (() => {
    if (!isEdit) return true;
    if (leader.pjMode === "new") {
      return Boolean(leader.pjName.trim() || leader.pjUsername.trim() || leader.pjPassword);
    }
    return leader.userId !== (team?.leader?.id ?? null);
  })();

  /** Cari nama wilayah baku dari input (case-insensitive). */
  function canonicalDistrict(value: string): string | undefined {
    return BATAM_AREAS.find((a) => a.toLowerCase() === value.trim().toLowerCase());
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload: TeamInput = {
        name: form.name.trim(),
        district: canonicalDistrict(form.district) ?? form.district.trim(),
        type: form.type.trim() || null,
        description: form.description.trim() || null,
      };
      if (isEdit) {
        const updated = await updateTeam(team.id, payload);
        // Ganti PJ lewat endpoint khusus (bukan bagian update tim).
        if (leaderChanged) return changeTeamLeader(team.id, buildLeaderInput(leader));
        return updated;
      }
      return createTeam({ ...payload, ...buildLeaderInput(leader) });
    },
    onSuccess: () => {
      showToast(isEdit ? "Tim diperbarui." : "Tim berhasil dibuat.", "success");
      void queryClient.invalidateQueries({ queryKey: ["teams"] });
      if (isEdit) void queryClient.invalidateQueries({ queryKey: ["team", team.id] });
      onSuccess();
    },
    onError: (e) => {
      const fields = (e as Error & { fields?: Record<string, string[]> }).fields;
      if (fields) {
        setErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v[0] ?? "Tidak valid."])));
        showToast("Periksa kembali isian form.", "info");
        return;
      }
      showToast(e instanceof Error ? e.message : "Gagal menyimpan tim.", "info");
    },
  });

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (form.name.trim().length < 3) errs.name = "Nama tim minimal 3 karakter.";
    if (form.district.trim().length < 2) {
      errs.district = "Lokasi/wilayah wajib diisi.";
    } else if (!canonicalDistrict(form.district)) {
      // Wajib memilih dari daftar dropdown — isian bebas tidak diterima.
      errs.district = "Pilih lokasi/wilayah dari daftar.";
    }
    if (leaderChanged) {
      if (leader.pjMode === "new") {
        if (!leader.pjName.trim()) errs.pj_name = "Nama PJ wajib diisi.";
        if (leader.pjUsername.trim().length < 3) errs.pj_username = "Username minimal 3 karakter.";
        if (leader.pjPassword.length < 8) errs.pj_password = "Password minimal 8 karakter.";
      } else if (!leader.userId) {
        errs.user_id = "Pilih warga yang akan menjadi PJ.";
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (validate()) save.mutate();
  }

  const isDirty =
    form.name !== (team?.name ?? "") ||
    form.district !== (team?.district ?? "") ||
    form.type !== (team?.type ?? "") ||
    form.description !== (team?.description ?? "");

  return { isEdit, form, setForm, leader, setLeader, errors, isDirty, saving: save.isPending, submit };
}
