"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Gift, Ticket } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { RewardIcon } from "@/lib/rewardIcons";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

type ClaimTx = {
  id: number;
  points: number;
  type: string;
  description: string;
  reward: { id: number; name: string; icon?: string | null } | null;
  createdAt: string;
};

/** Kode klaim yang di-encode ke QR — ditunjukkan petugas saat penukaran. */
const claimCode = (txId: number) => `NADIKOTA-${txId}`;

function HadiahContent() {
  const searchParams = useSearchParams();
  const newId = Number(searchParams.get("new")) || null;

  const query = useQuery({
    queryKey: ["me-points"],
    queryFn: async () => (await apiClient.get<{ data: { transactions: ClaimTx[] } }>("/me/points")).data.data,
    staleTime: 10_000,
  });

  if (query.isLoading) {
    return (
      <main className="min-h-screen bg-neutral-50 px-4 pb-28 pt-6 text-neutral-700 md:pb-8">
        <div className="mx-auto max-w-lg space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </main>
    );
  }

  const claims = (query.data?.transactions ?? []).filter((t) => t.type === "redeem" && t.reward);

  return (
    <main className="min-h-screen bg-neutral-50 px-4 pb-28 pt-6 text-neutral-700 md:pb-8">
      <div className="mx-auto max-w-lg space-y-4">
        <header>
          <Link href="/peta" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:text-primary-800">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Kembali ke Peta
          </Link>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-neutral-900">
            <Ticket className="size-7 text-primary-800" aria-hidden="true" />
            Hadiah Saya
          </h1>
          <p className="mt-1 text-sm text-neutral-500">Tunjukkan QR di bawah ke petugas untuk menukar hadiah.</p>
        </header>

        {claims.length === 0 ? (
          <EmptyState
            title="Belum ada hadiah"
            description="Tukarkan poin dari laporan Anda di menu Tukar Poin — hadiah yang sudah diklaim tampil di sini beserta QR-nya."
          />
        ) : (
          <ul className="space-y-4">
            {claims.map((t) => (
              <li
                key={t.id}
                id={`claim-${t.id}`}
                className={`rounded-2xl border bg-neutral-0 p-4 shadow-sm ${newId === t.id ? "border-accent-500 ring-2 ring-accent-500/30" : "border-neutral-200"}`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-800 to-primary-600 text-neutral-0" aria-hidden="true">
                    <RewardIcon name={t.reward?.icon} className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">{t.reward?.name}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      Diklaim {new Date(t.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-warning-50 px-2.5 py-1 text-xs font-semibold text-warning-800">{t.points} poin</span>
                </div>

                <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-5">
                  <div className="rounded-xl bg-neutral-0 p-3 shadow-sm ring-1 ring-neutral-200">
                    <QRCodeSVG value={claimCode(t.id)} size={168} bgColor="#ffffff" fgColor="#0E2747" level="M" />
                  </div>
                  <p className="mt-1 font-mono text-sm font-bold tracking-[0.15em] text-neutral-900">{claimCode(t.id)}</p>
                  <p className="text-center text-xs text-neutral-500">Berlaku selama stok hadiah tersedia — tunjukkan ke petugas NadiKota.</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="flex items-center justify-center gap-1.5 pt-2 text-xs text-neutral-400">
          <Gift className="size-3.5" aria-hidden="true" />
          1 laporan diterima = 10 poin
        </p>
      </div>
    </main>
  );
}

export default function HadiahPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-neutral-50 px-4 py-6"><div className="mx-auto max-w-lg"><Skeleton className="h-64 w-full" /></div></main>}>
      <HadiahContent />
    </Suspense>
  );
}
