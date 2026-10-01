"use client";

import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { Team } from "@/features/dashboard/dashboardTypes";
import { TeamFormBody } from "./TeamFormBody";
import { useTeamForm } from "./useTeamForm";

/**
 * Modal DESKTOP untuk buat/edit tim: dua kolom (data tim kiri; PJ kanan),
 * header berikon, footer Batal/Simpan. Logika = useTeamForm (sama dgn halaman mobile).
 */
export function TeamFormModal({ team, onClose }: { team: Team | null; onClose: () => void }) {
  const state = useTeamForm({ team, onSuccess: onClose });

  return (
    <Modal
      title={state.isEdit ? "Edit Tim" : "Tambah Tim"}
      caption={state.isEdit ? "Perbarui data tim yang sudah ada." : "Buat tim baru beserta Penanggung Jawab."}
      icon={ClipboardList}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Batal</Button>
          <Button type="submit" form="team-modal-form" className="flex-1" disabled={state.saving}>
            {state.saving ? "Menyimpan..." : "Simpan tim"}
          </Button>
        </>
      }
    >
      <form id="team-modal-form" onSubmit={state.submit} noValidate>
        <TeamFormBody state={state} team={team} layout="modal" />
      </form>
    </Modal>
  );
}
