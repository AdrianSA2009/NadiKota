"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { RequireRole } from "@/components/auth/RequireRole";
import { TeamFormPage } from "@/components/team/TeamFormPage";
import { getTeam } from "@/features/dashboard/dashboardApi";

const ADMIN = ["admin", "super_admin"] as const;

function EditTeamContent() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const invalid = !Number.isInteger(id) || id <= 0;
  const query = useQuery({ queryKey: ["team", id], queryFn: () => getTeam(id), enabled: !invalid });

  // Data tim + PJ (PJ bisa diganti langsung dari form edit).
  return (
    <TeamFormPage
      key={query.data?.team.id ?? "loading"}
      team={query.data?.team ?? null}
      loading={!invalid && query.isLoading}
      loadError={invalid ? "Tim tidak ditemukan." : query.isError ? query.error.message : null}
      onRetry={() => void query.refetch()}
    />
  );
}

/** Halaman Edit Tim (mobile route /tim/[id]/edit) — data tim + ganti PJ. */
export default function EditTeamPage() {
  return (
    <RequireRole roles={ADMIN}>
      <EditTeamContent />
    </RequireRole>
  );
}
