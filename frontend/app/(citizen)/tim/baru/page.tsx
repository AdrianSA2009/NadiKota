"use client";

import { RequireRole } from "@/components/auth/RequireRole";
import { TeamFormPage } from "@/components/team/TeamFormPage";

const ADMIN = ["admin", "super_admin"] as const;

/** Halaman Buat Tim (mobile via /tim/baru; desktop route ini tetap tampil berlebar terbatas). */
export default function NewTeamPage() {
  return (
    <RequireRole roles={ADMIN}>
      <TeamFormPage team={null} />
    </RequireRole>
  );
}
