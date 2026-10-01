"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, UserCog } from "lucide-react";
import { RequireRole } from "@/components/auth/RequireRole";
import { ChangeLeaderSection } from "@/components/team/ChangeLeaderSection";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { getTeam } from "@/features/dashboard/dashboardApi";

const ADMIN = ["admin", "super_admin"] as const;

function ChangeLeaderContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);
  const invalid = !Number.isInteger(id) || id <= 0;
  const query = useQuery({ queryKey: ["team", id], queryFn: () => getTeam(id), enabled: !invalid });

  const header = (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-neutral-200 bg-neutral-0/95 px-4 py-3 backdrop-blur">
      <button type="button" aria-label="Kembali" onClick={() => router.push(invalid ? "/teams" : `/teams/${id}`)} className="-ml-1 rounded-lg p-2 text-neutral-600 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500">
        <ArrowLeft className="size-5" aria-hidden="true" />
      </button>
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 truncate text-base font-bold text-neutral-900">
          <UserCog className="size-4 shrink-0 text-primary-700" aria-hidden="true" />
          Ganti Penanggung Jawab
        </h1>
        <p className="truncate text-xs text-neutral-500">Hanya PJ yang diganti — data tim tidak berubah.</p>
      </div>
    </header>
  );

  if (invalid) {
    return <main className="absolute inset-0 overflow-y-auto bg-neutral-50">{header}<div className="px-4 py-5 pb-24"><ErrorState message="Tim tidak ditemukan." onRetry={() => router.push("/teams")} /></div></main>;
  }
  if (query.isLoading) {
    return <main className="absolute inset-0 overflow-y-auto bg-neutral-50">{header}<div className="space-y-4 px-4 py-5 pb-24"><Skeleton className="h-12" /><Skeleton className="h-48" /></div></main>;
  }
  if (query.isError || !query.data) {
    return <main className="absolute inset-0 overflow-y-auto bg-neutral-50">{header}<div className="px-4 py-5 pb-24"><ErrorState message={query.isError ? query.error.message : "Tim tidak ditemukan."} onRetry={() => void query.refetch()} /></div></main>;
  }

  return (
    <main className="absolute inset-0 overflow-y-auto bg-neutral-50 pb-[env(safe-area-inset-bottom)]">
      {header}
      <div className="px-4 py-5 pb-24 md:pb-6">
        <div className="mx-auto w-full max-w-lg">
          <ChangeLeaderSection team={query.data.team} onDone={() => router.push(`/teams/${id}`)} />
        </div>
      </div>
    </main>
  );
}

/** Halaman MOBILE khusus Ganti PJ (tanpa mengubah data tim). */
export default function ChangeLeaderPage() {
  return (
    <RequireRole roles={ADMIN}>
      <ChangeLeaderContent />
    </RequireRole>
  );
}
