"use client";

import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useNavGuard } from "@/lib/navigationGuard";

/** Modal konfirmasi sebelum meninggalkan wizard laporan yang belum terkirim. */
export function LeaveReportConfirm() {
  const router = useRouter();
  const pendingHref = useNavGuard((s) => s.pendingHref);

  if (!pendingHref) return null;

  function handleConfirm() {
    if (!pendingHref) return;
    const state = useNavGuard.getState();
    state.confirmLeave();
    state.pendingExtra?.();
    router.push(pendingHref);
  }

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-center justify-center bg-neutral-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-title"
    >
      <section className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-neutral-0 p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning-50" aria-hidden="true">
            <TriangleAlert className="size-5 text-warning-800" />
          </span>
          <div>
            <h2 id="leave-title" className="text-base font-bold text-neutral-900">Tinggalkan laporan?</h2>
            <p className="mt-1 text-sm leading-6 text-neutral-500">
              Laporan Anda belum terkirim. Jika keluar sekarang, foto dan isian yang sudah dimasukkan akan hilang.
            </p>
          </div>
        </div>
        <div className="mt-5 flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => useNavGuard.getState().cancelLeave()}>
            Batal
          </Button>
          <Button type="button" className="flex-1" onClick={handleConfirm}>
            Ya, tinggalkan
          </Button>
        </div>
      </section>
    </div>
  );
}
