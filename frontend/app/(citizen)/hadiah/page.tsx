"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import {
  FaBan, FaCalendarXmark, FaCheck, FaCheckDouble, FaChevronLeft, FaCircleCheck,
  FaClockRotateLeft, FaExpand, FaGift, FaHourglassHalf, FaXmark,
} from "react-icons/fa6";
import type { IconType } from "react-icons";
import { apiClient } from "@/lib/apiClient";
import { RewardIcon } from "@/lib/rewardIcons";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

type ClaimStatus = "aktif" | "terpakai" | "kedaluwarsa";

type ClaimTx = {
  id: number;
  points: number;
  type: string;
  description: string;
  reward: { id: number; name: string; icon?: string | null } | null;
  createdAt: string;
  /** Opsional — kalau backend belum mengirim, dianggap "aktif". */
  status?: ClaimStatus;
  /** Opsional — batas berlaku hadiah. */
  expiresAt?: string | null;
  /** Opsional — waktu hadiah dipakai. */
  usedAt?: string | null;
};

type Filter = "all" | "aktif" | "riwayat";

const FILTERS: { id: Filter; label: string; icon?: IconType }[] = [
  { id: "all", label: "Semua" },
  { id: "aktif", label: "Aktif", icon: FaCircleCheck },
  { id: "riwayat", label: "Riwayat", icon: FaClockRotateLeft },
];

const BADGE: Record<ClaimStatus, { label: string; icon: IconType; className: string }> = {
  aktif: { label: "Aktif", icon: FaCircleCheck, className: "border-[#9fe0cf] bg-[#e6f8f4] text-[#0f7a5f]" },
  terpakai: { label: "Terpakai", icon: FaCheckDouble, className: "border-[#d3dbe4] bg-[#eef2f6] text-[#5b6877]" },
  kedaluwarsa: { label: "Kedaluwarsa", icon: FaBan, className: "border-[#f3b4ae] bg-[#fdecea] text-[#b42318]" },
};

/** Kode klaim yang di-encode ke QR — ditunjukkan petugas saat penukaran. */
const claimCode = (txId: number) => `NADIKOTA-${txId}`;

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

function PageHeader({ withSummary }: { withSummary: boolean }) {
  return (
    <header className={`relative overflow-hidden rounded-b-[32px] bg-[linear-gradient(160deg,#0a2136_0%,#123a5c_100%)] px-5 pt-5 text-neutral-0 ${withSummary ? "pb-[70px]" : "pb-8"}`}>
      <div className="absolute -right-[60px] -top-[70px] size-[200px] rounded-full bg-[#1abc9c]/[0.18]" aria-hidden="true" />
      <div className="relative mx-auto flex max-w-lg items-center gap-3.5">
        <Link href="/peta" aria-label="Kembali ke Peta" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-0/[0.14] text-[15px] text-neutral-0 transition hover:bg-neutral-0/20">
          <FaChevronLeft aria-hidden="true" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight">Hadiah Saya</h1>
          <p className="mt-0.5 text-[13px] text-neutral-0/70">Hadiah yang sudah kamu klaim</p>
        </div>
      </div>
    </header>
  );
}

function HadiahContent() {
  const searchParams = useSearchParams();
  const newId = Number(searchParams.get("new")) || null;
  const [filter, setFilter] = useState<Filter>("all");
  const [zoom, setZoom] = useState<ClaimTx | null>(null);

  const query = useQuery({
    queryKey: ["me-points"],
    queryFn: async () => (await apiClient.get<{ data: { transactions: ClaimTx[] } }>("/me/points")).data.data,
    staleTime: 10_000,
  });

  if (query.isLoading) {
    return (
      <main className="min-h-screen bg-neutral-50 pb-28 text-neutral-700 md:pb-8">
        <PageHeader withSummary={false} />
        <div className="mx-auto max-w-lg space-y-4 px-4 pt-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </main>
    );
  }

  const claims = (query.data?.transactions ?? []).filter((t) => t.type === "redeem" && t.reward);
  const statusOf = (t: ClaimTx): ClaimStatus => t.status ?? "aktif";

  const counts = {
    aktif: claims.filter((t) => statusOf(t) === "aktif").length,
    terpakai: claims.filter((t) => statusOf(t) === "terpakai").length,
    kedaluwarsa: claims.filter((t) => statusOf(t) === "kedaluwarsa").length,
  };

  const visible = claims.filter((t) => {
    if (filter === "all") return true;
    return filter === "aktif" ? statusOf(t) === "aktif" : statusOf(t) !== "aktif";
  });

  return (
    <main className="min-h-screen bg-neutral-50 pb-28 text-neutral-700 md:pb-8">
      <PageHeader withSummary={claims.length > 0} />

      <div className="mx-auto max-w-lg">
        {claims.length > 0 && (
          <>
            {/* Ringkasan — menimpa tepi bawah header */}
            <section aria-label="Ringkasan hadiah" className="relative z-10 -mt-9 px-4">
              <div className="flex rounded-[20px] bg-neutral-0 px-2 py-3.5 shadow-[0_10px_24px_rgba(10,33,54,0.12)]">
                {([
                  ["Aktif", counts.aktif, true],
                  ["Terpakai", counts.terpakai, false],
                  ["Kedaluwarsa", counts.kedaluwarsa, false],
                ] as const).map(([label, n, highlight]) => (
                  <div key={label} className="flex-1 border-l border-neutral-200 text-center first:border-l-0">
                    <b className={`block text-[22px] font-extrabold leading-none ${highlight ? "text-[#0f9a80]" : "text-[#0a2136]"}`}>{n}</b>
                    <small className="mt-1 block text-[11.5px] font-semibold text-neutral-500">{label}</small>
                  </div>
                ))}
              </div>
            </section>

            {/* Filter */}
            <div className="scrollbar-hide flex gap-2 overflow-x-auto px-4 pb-1 pt-5" role="group" aria-label="Filter hadiah">
              {FILTERS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  aria-pressed={filter === id}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 py-[9px] text-[13px] font-semibold leading-none transition ${
                    filter === id ? "border-[#0a2136] bg-[#0a2136] text-neutral-0" : "border-neutral-200 bg-neutral-0 text-neutral-500"
                  }`}
                >
                  {Icon && <Icon className="size-3.5" aria-hidden="true" />}
                  {label}
                </button>
              ))}
            </div>

            <p className="px-5 pb-2 pt-4 text-[13px] text-neutral-500"><b className="text-[#0a2136]">{visible.length}</b> hadiah</p>
          </>
        )}

        <div className={claims.length > 0 ? "px-4" : "px-4 pt-6"}>
          {claims.length === 0 ? (
            <EmptyState
              title="Belum ada hadiah"
              description="Tukarkan poin dari laporan Anda di menu Tukar Poin — hadiah yang sudah diklaim tampil di sini beserta QR-nya."
            />
          ) : visible.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-0 px-4 py-10 text-center text-sm text-neutral-500">
              Tidak ada hadiah di kategori ini.
            </p>
          ) : (
            <ul className="space-y-3.5">
              {visible.map((t) => {
                const status = statusOf(t);
                const off = status !== "aktif";
                const badge = BADGE[status];
                const BadgeIcon = badge.icon;
                const code = claimCode(t.id);

                return (
                  <li
                    key={t.id}
                    id={`claim-${t.id}`}
                    className={`rounded-[20px] bg-neutral-0 shadow-[0_4px_14px_rgba(10,33,54,0.06)] ${newId === t.id ? "ring-2 ring-[#1abc9c]/60" : ""}`}
                  >
                    {/* Atas: ikon, nama, badge */}
                    <div className="flex items-center gap-3 p-3.5">
                      <span className={`flex size-[50px] shrink-0 items-center justify-center rounded-[15px] ${off ? "bg-[#c9d2dc] text-neutral-0" : "bg-[linear-gradient(135deg,#123a5c,#0a2136)] text-[#1abc9c]"}`} aria-hidden="true">
                        <RewardIcon name={t.reward?.icon} className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className={`text-[15px] font-bold leading-snug ${off ? "text-[#5b6877]" : "text-[#0a2136]"}`}>{t.reward?.name}</h2>
                        <p className="mt-0.5 text-xs text-neutral-500">Diklaim {fmtDate(t.createdAt)} · {t.points} poin</p>
                      </div>
                      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11.5px] font-bold ${badge.className}`}>
                        <BadgeIcon aria-hidden="true" />
                        {badge.label}
                      </span>
                    </div>

                    {/* Garis sobekan */}
                    <div className="relative mx-3.5 border-t-2 border-dashed border-neutral-200" aria-hidden="true">
                      <span className="absolute -left-6 -top-[11px] size-5 rounded-full bg-neutral-50" />
                      <span className="absolute -right-6 -top-[11px] size-5 rounded-full bg-neutral-50" />
                    </div>

                    {/* Bawah: QR + info */}
                    <div className="flex items-center gap-3.5 p-3.5">
                      <div className="relative size-[116px] shrink-0 rounded-2xl border-[1.5px] border-neutral-200 bg-neutral-0 p-2">
                        <div className={off ? "opacity-[0.22] grayscale" : ""}>
                          <QRCodeSVG value={code} size={100} bgColor="#ffffff" fgColor="#0a2136" level="M" className="block h-auto w-full" />
                        </div>
                        {off && (
                          <div className={`absolute inset-0 flex items-center justify-center text-center text-xs font-extrabold leading-tight ${status === "kedaluwarsa" ? "text-[#b42318]" : "text-[#5b6877]"}`}>
                            {status === "kedaluwarsa" ? "Kedaluwarsa" : <>Sudah<br />dipakai</>}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className={`text-[13px] font-bold leading-snug ${off ? "text-[#5b6877]" : "text-[#0a2136]"}`}>
                          {status === "aktif" ? "Tunjukkan QR ini ke petugas NadiKota" : status === "terpakai" ? "Sudah digunakan" : "Masa berlaku habis"}
                        </p>
                        <p className="mt-1 break-all text-[11.5px] font-semibold tracking-wide text-neutral-500">ID: {code}</p>

                        <p className={`mt-2 flex items-start gap-1.5 text-xs font-semibold leading-snug ${status === "aktif" && t.expiresAt ? "text-[#b45f06]" : "text-neutral-500"}`}>
                          {status === "terpakai" ? <FaCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> : status === "kedaluwarsa" ? <FaCalendarXmark className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> : <FaHourglassHalf className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />}
                          <span>
                            {status === "terpakai"
                              ? (t.usedAt ? `Dipakai pada ${fmtDate(t.usedAt)}` : "Hadiah sudah dipakai")
                              : status === "kedaluwarsa"
                                ? (t.expiresAt ? `Berakhir pada ${fmtDate(t.expiresAt)}` : "Masa berlaku berakhir")
                                : (t.expiresAt ? `Berlaku sampai ${fmtDate(t.expiresAt)}` : "Berlaku selama 30 hari sejak klaim")}
                          </span>
                        </p>

                        {status === "aktif" && (
                          <button
                            type="button"
                            onClick={() => setZoom(t)}
                            className="mt-2.5 inline-flex items-center gap-1.5 rounded-[10px] bg-[#1abc9c] px-3 py-[9px] text-xs font-extrabold leading-none text-[#0a2136] transition hover:bg-[#22cfad]"
                          >
                            <FaExpand aria-hidden="true" />
                            Perbesar QR
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="flex items-center justify-center gap-1.5 pt-6 text-xs text-neutral-400">
            <FaGift className="size-3.5" aria-hidden="true" />
            1 laporan diterima = 10 poin
          </p>
        </div>
      </div>

      {/* Modal QR diperbesar */}
      {zoom && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-neutral-900/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`QR ${zoom.reward?.name ?? "hadiah"}`}
          onClick={(e) => { if (e.target === e.currentTarget) setZoom(null); }}
        >
          <section className="relative w-full max-w-xs rounded-3xl bg-neutral-0 p-6 text-center shadow-xl">
            <button type="button" onClick={() => setZoom(null)} aria-label="Tutup" className="absolute right-3 top-3 rounded-full bg-neutral-100 p-2 text-neutral-500 transition hover:bg-neutral-200">
              <FaXmark className="size-4" aria-hidden="true" />
            </button>
            <h2 className="px-8 text-base font-bold text-[#0a2136]">{zoom.reward?.name}</h2>
            <div className="mx-auto mt-4 w-fit rounded-2xl border-[1.5px] border-neutral-200 p-3">
              <QRCodeSVG value={claimCode(zoom.id)} size={232} bgColor="#ffffff" fgColor="#0a2136" level="M" />
            </div>
            <p className="mt-3 font-mono text-sm font-bold tracking-[0.15em] text-[#0a2136]">{claimCode(zoom.id)}</p>
            <p className="mt-1 text-xs text-neutral-500">Tunjukkan ke petugas.</p>
          </section>
        </div>
      )}
    </main>
  );
}

export default function HadiahPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-neutral-50"><PageHeader withSummary={false} /><div className="mx-auto max-w-lg px-4 pt-6"><Skeleton className="h-64 w-full" /></div></main>}>
      <HadiahContent />
    </Suspense>
  );
}