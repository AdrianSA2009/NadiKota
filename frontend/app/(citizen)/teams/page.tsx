"use client";

import { RequireRole } from "@/components/auth/RequireRole";
import { AdminTeamsView } from "@/components/team/AdminTeamsView";
import { FieldTasksView } from "@/components/team/FieldTasksView";
import { useAuthStore } from "@/features/auth/authStore";

const ALLOWED = ["admin", "super_admin", "field_team"] as const;

/**
 * Route `/teams` tetap untuk semua role — isinya terpisah per sisi:
 * - field_team → FieldTasksView  ("Tugas saya")
 * - admin/super_admin → AdminTeamsView  ("Daftar tim")
 */
export default function TeamsPage() {
  return (
    <RequireRole roles={ALLOWED}>
      <TeamsContent />
    </RequireRole>
  );
}

function TeamsContent() {
  const role = useAuthStore((s) => s.user?.role);
  return role === "field_team" ? <FieldTasksView /> : <AdminTeamsView />;
}
