"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import type { Team } from "@/features/dashboard/dashboardTypes";
import { TeamFormBody } from "./TeamFormBody";
import { useTeamForm } from "./useTeamForm";

/**
 * Halaman penuh form tim (MOBILE — juga tampil wajar dibuka langsung di desktop
 * dengan lebar terbatas max-w-lg). Header sticky + tombol kembali, isi satu kolom,
 * tombol Simpan sticky di bawah (safe-area). Konfirmasi sebelum keluar bila form kotor.
 */
export function TeamFormPage({ team, extraSection, loading = false, loadError, onRetry }: {
  team: Team | null;
  /** Konten tambahan di bawah form (mis. bagian Ganti PJ pada halaman edit). */
  extraSection?: ReactNode;
  loading?: boolean;
  loadError?: string | null;
  onRetry?: () => void;
}) {
  const router = useRouter();
  const state = useTeamForm({ team, onSuccess: () => router.push("/teams") });
  const [leaveOpen, setLeaveOpen] = useState(false);

  // Browser back (popstate) → konfirmasi singkat bila ada perubahan belum disimpan.
  useEffect(() => {
    if (!state.isDirty) return;
    const onPop = () => {
      if (!window.confirm("Form belum disimpan. Tinggalkan halaman?")) {
        window.history.pushState(null, "", window.location.href);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [state.isDirty]);

  const requestBack = () => {
    if (state.isDirty) setLeaveOpen(true);
    else router.push("/teams");
  };

  const header = (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-neutral-200 bg-neutral-0/95 px-4 py-3 backdrop-blur">
      <button type="button" onClick={requestBack} aria-label="Kembali" className="-ml-1 rounded-lg p-2 text-neutral-600 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500">
        <ArrowLeft className="size-5" aria-hidden="true" />
      </button>
      <div className="min-w-0">
        <h1 className="truncate text-base font-bold text-neutral-900">{team ? "Edit Tim" : "Buat Tim"}</h1>
        <p className="truncate text-xs text-neutral-500">{team ? "Perbarui data tim dan Penanggung Jawab." : "Isi data tim lalu tentukan Penanggung Jawab."}</p>
      </div>
    </header>
  );

  if (loading) {
    return <main className="absolute inset-0 overflow-y-auto bg-neutral-50">{header}<div className="space-y-4 px-4 py-5 pb-24"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-24" /></div></main>;
  }
  if (loadError) {
    return <main className="absolute inset-0 overflow-y-auto bg-neutral-50">{header}<div className="px-4 py-5 pb-24"><ErrorState message={loadError} onRetry={onRetry} /></div></main>;
  }

  // Tombol Simpan mengalir di akhir konten (ikut scroll, tidak sticky).
  return (
    <main className="absolute inset-0 overflow-y-auto bg-neutral-50 pb-[env(safe-area-inset-bottom)]">
      {header}

      <div className="px-4 py-5 pb-24 md:pb-6">
        <form id="team-page-form" onSubmit={state.submit} noValidate className="mx-auto w-full max-w-lg">
          <TeamFormBody state={state} team={team} layout="page" />
          {extraSection && <div className="mt-8">{extraSection}</div>}
          <Button type="submit" className="mt-6 w-full justify-center" disabled={state.saving}>
            {state.saving ? "Menyimpan..." : team ? "Simpan perubahan" : "Simpan tim"}
          </Button>
        </form>
      </div>

      {leaveOpen && (
        <Modal
          title="Form belum disimpan?"
          caption="Perubahan Anda akan hilang jika keluar sekarang."
          icon={TriangleAlert}
          onClose={() => setLeaveOpen(false)}
          footer={
            <>
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setLeaveOpen(false)}>Batal</Button>
              <Button type="button" className="flex-1" onClick={() => router.push("/teams")}>Ya, tinggalkan</Button>
            </>
          }
        >
          <p className="text-sm text-neutral-600">Simpan dulu perubahan Anda, atau tinggalkan halaman tanpa menyimpan.</p>
        </Modal>
      )}
    </main>
  );
}
