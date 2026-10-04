"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { FaBullseye, FaCheck, FaCircleCheck, FaCircleInfo, FaCoins, FaGift, FaTicket } from "react-icons/fa6";
import { apiClient } from "@/lib/apiClient";
import { useAuthStore } from "@/features/auth/authStore";
import { useTukarPoinPanel } from "@/lib/tukarPoinPanelStore";
import { RewardIcon } from "@/lib/rewardIcons";

type RewardItem = { id: number; name: string; description?: string | null; pointsCost: number; icon?: string | null };

async function fetchRewards(): Promise<RewardItem[]> {
  const res = await apiClient.get<{ data: RewardItem[] }>("/rewards");
  return res.data.data;
}

async function fetchPoints(): Promise<{ balance: number }> {
  const res = await apiClient.get<{ data: { balance: number } }>("/me/points");
  return res.data.data;
}

type PointsData = { balance: number; loading: boolean; affordableCount: number; total: number; onMyGifts: () => void };

/** Header panel Tukar Poin — gradasi navy lengkung bawah, kartu saldo menimpa tepi header. Satu sumber untuk desktop & mobile. */
function TukarPoinHeader({ onClose, points }: { onClose?: () => void; points?: PointsData }) {
  return (
    <div className="relative shrink-0">
      <div className={`relative overflow-hidden rounded-b-[32px] bg-[linear-gradient(160deg,#0a2136_0%,#123a5c_100%)] px-5 pt-[22px] text-neutral-0 ${points ? "pb-[70px]" : "pb-8"}`}>
        <div className="absolute -right-[60px] -top-[70px] size-[200px] rounded-full bg-[#1abc9c]/[0.18]" aria-hidden="true" />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-3xl font-extrabold tracking-tight text-neutral-0">Tukar Poin</h2>
            <p className="mt-0.5 text-xs text-primary-100/80">Tukarkan poin jadi hadiah nyata</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {points && (
              <button
                type="button"
                onClick={points.onMyGifts}
                className="flex items-center gap-2 rounded-full bg-neutral-0/[0.14] px-3.5 py-2.5 text-[13px] font-bold leading-none text-neutral-0 transition hover:bg-neutral-0/20"
              >
                <FaTicket className="size-4 text-[#1abc9c]" aria-hidden="true" />
                Hadiah saya
              </button>
            )}
            {onClose && (
              <button type="button" onClick={onClose} className="rounded-full border border-neutral-0/20 bg-neutral-0/10 p-2 text-primary-100 transition hover:bg-neutral-0/20" aria-label="Tutup">
                <X className="size-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Kartu saldo — di luar gradasi, menimpa tepi bawah */}
      {points && (
        <section aria-label="Poin kamu" className="relative z-10 -mt-[34px] px-4">
          <div className="flex items-center justify-between gap-3 rounded-[18px] bg-neutral-0 px-4 py-3 shadow-[0_10px_24px_rgba(10,33,54,0.12)]">
            <div className="flex items-center gap-2.5">
              <span className="flex size-[38px] items-center justify-center rounded-full bg-[#e6f8f4] text-base text-[#0f9a80]" aria-hidden="true">
                <FaCoins />
              </span>
              <div>
                <b className="block text-2xl font-extrabold leading-none text-[#0a2136]">{points.loading ? "…" : points.balance}</b>
                <small className="mt-0.5 block text-[11.5px] font-semibold text-neutral-500">poin kamu</small>
              </div>
            </div>
            <p className="text-right text-xs font-bold leading-snug text-neutral-500">
              Siap ditukar
              <strong className="block text-[#0a2136]">{points.affordableCount} dari {points.total} hadiah</strong>
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

export function TukarPoinPanel() {
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const { open, closePanel } = useTukarPoinPanel();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [claimReward, setClaimReward] = useState<RewardItem | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);

  const panelOpen = open;
  const rewardsQuery = useQuery({ queryKey: ["rewards"], queryFn: fetchRewards, staleTime: 60_000, enabled: initialized });
  const pointsQuery = useQuery({ queryKey: ["me-points"], queryFn: fetchPoints, staleTime: 30_000, enabled: initialized && Boolean(user) });

  const rewards = rewardsQuery.data ?? [];
  const balance = pointsQuery.data?.balance ?? 0;
  const affordableCount = rewards.filter((r) => balance >= r.pointsCost).length;

  const redeemMutation = useMutation({
    mutationFn: async (rewardId: number) => (await apiClient.post<{ data: { balance: number; pointsCost: number; message: string; transactionId?: number } }>(`/rewards/${rewardId}/redeem`)).data.data,
    onSuccess: (result) => {
      // Tetap di sheet → tampilkan langkah "Berhasil ditukar"; pindah ke /hadiah lewat tombol "Lihat hadiah".
      setClaimError(null);
      setClaimResult({ balance: result.balance, transactionId: result.transactionId });
      void queryClient.invalidateQueries({ queryKey: ["me-points"] });
      void queryClient.invalidateQueries({ queryKey: ["rewards"] });
    },
    onError: (e) => setClaimError(e instanceof Error ? e.message : "Gagal menukar hadiah."),
  });

  function openMyGifts() {
    closePanel();
    router.push("/hadiah");
  }

  function handleRedeem(reward: RewardItem) {
    // Guest → arahkan ke halaman login, bukan modal di atas panel ini.
    if (!user) { closePanel(); router.push("/login"); return; }
    setClaimError(null);
    setClaimReward(reward);
  }

  function closeClaim() {
    setClaimReward(null);
    setClaimError(null);
    setClaimResult(null);
    redeemMutation.reset();
  }

  function viewGifts() {
    const id = claimResult?.transactionId;
    closeClaim();
    closePanel();
    router.push(id ? `/hadiah?new=${id}` : "/hadiah");
  }

  function confirmClaim() {
    if (!claimReward) return;
    if (balance < claimReward.pointsCost) {
      setClaimError("Poin Anda tidak cukup untuk menukar hadiah ini.");
      return;
    }
    redeemMutation.mutate(claimReward.id);
  }

  if (!initialized) return null;

  const points: PointsData | undefined = user
    ? { balance, loading: pointsQuery.isLoading, affordableCount, total: rewards.length, onMyGifts: openMyGifts }
    : undefined;

  return (
    <>
      {/* Desktop panel — slide dari kiri seperti KontribusiPanel */}
      <div
        className="hidden md:block fixed inset-y-0 left-0 z-[1000] w-96 border-r border-neutral-200 bg-neutral-0 shadow-2xl transition-transform duration-300 ease-out"
        style={{ transform: panelOpen ? "translateX(240px)" : "translateX(-100%)" }}
      >
        <div className="flex h-full flex-col">
          <TukarPoinHeader onClose={closePanel} points={points} />
          <div className="flex-1 overflow-y-auto bg-neutral-50 px-4 pb-6 pt-4">
            <RewardContent
              points={user ? balance : 0}
              rewards={rewards}
              isLoggedIn={Boolean(user)}
              isPending={redeemMutation.isPending}
              onRedeem={handleRedeem}
            />
          </div>
        </div>
      </div>

      {/* Mobile: tampilan full-screen (bukan bottom sheet) */}
      <div
        className="md:hidden fixed inset-0 z-[1000] flex flex-col bg-neutral-0 shadow-2xl transition-transform duration-300 ease-out"
        style={{ transform: panelOpen ? "translateY(0)" : "translateY(100%)" }}
      >
        <TukarPoinHeader points={points} />
        <div className="flex-1 overflow-y-auto bg-neutral-50 px-4 pb-28 pt-4">
          <RewardContent
            points={user ? balance : 0}
            rewards={rewards}
            isLoggedIn={Boolean(user)}
            isPending={redeemMutation.isPending}
            onRedeem={handleRedeem}
          />
        </div>
      </div>

      {/* Modal klaim: bottom sheet di mobile, dialog tengah di desktop */}
      {claimReward && (
        <ClaimModal
          reward={claimReward}
          balance={balance}
          error={claimError}
          isPending={redeemMutation.isPending}
          result={claimResult}
          onConfirm={confirmClaim}
          onClose={closeClaim}
          onViewGifts={viewGifts}
        />
      )}
    </>
  );
}

type ClaimResult = { balance: number; transactionId?: number };

/** Konfirmasi penukaran — 3 langkah: konfirmasi → memproses → berhasil. Mobile = bottom sheet, desktop = dialog tengah. */
function ClaimModal({ reward, balance, error, isPending, result, onConfirm, onClose, onViewGifts }: {
  reward: RewardItem;
  balance: number;
  error: string | null;
  isPending: boolean;
  result: ClaimResult | null;
  onConfirm: () => void;
  onClose: () => void;
  onViewGifts: () => void;
}) {
  // Drag-to-close hanya untuk versi mobile (bottom sheet)
  const dragRef = useRef({ startY: 0, dy: 0, active: false });
  const [drag, setDrag] = useState({ y: 0, dragging: false });

  const step: "confirm" | "loading" | "success" = result ? "success" : isPending ? "loading" : "confirm";
  const left = balance - reward.pointsCost;

  // Tidak boleh ditutup saat sedang memproses.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isPending) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isPending, onClose]);

  function dragStart(e: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = { startY: e.clientY, dy: 0, active: true };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ y: 0, dragging: true });
  }
  function dragMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current.active) return;
    const dy = Math.max(0, e.clientY - dragRef.current.startY);
    dragRef.current.dy = dy;
    setDrag({ y: dy, dragging: true });
  }
  function dragEnd() {
    const dy = dragRef.current.dy;
    dragRef.current.active = false;
    setDrag({ y: 0, dragging: false });
    if (dy > 100 && !isPending) onClose();
  }
  function backdropClose(e: React.MouseEvent<HTMLDivElement>) {
    if (isPending) return;
    if (e.target === e.currentTarget) onClose();
  }

  const ghostBtn = "flex flex-[0.8] items-center justify-center gap-2 rounded-[14px] bg-[#f4f7fa] py-3.5 text-sm font-extrabold leading-none text-neutral-500 transition hover:bg-neutral-100";

  const content = (
    <div className="px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-1">
      {step === "confirm" && (
        <>
          <div className="flex items-center gap-3.5">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#123a5c,#0a2136)] text-[#1abc9c]" aria-hidden="true">
              <RewardIcon name={reward.icon} className="size-6" />
            </span>
            <div className="min-w-0">
              <small className="text-xs font-semibold text-neutral-500">Konfirmasi penukaran</small>
              <h2 className="mt-0.5 text-lg font-extrabold leading-tight text-[#0a2136]">{reward.name}</h2>
            </div>
          </div>

          <dl className="mt-[18px] rounded-2xl bg-[#f4f7fa] px-4 py-1">
            <div className="flex items-center justify-between py-[11px] text-[13.5px] font-semibold text-neutral-500">
              <dt>Biaya hadiah</dt>
              <dd className="font-extrabold text-[#0a2136]">{reward.pointsCost} poin</dd>
            </div>
            <div className="flex items-center justify-between border-t border-dashed border-neutral-200 py-[11px] text-[13.5px] font-semibold text-neutral-500">
              <dt>Poin kamu sekarang</dt>
              <dd className="font-extrabold text-[#0a2136]">{balance} poin</dd>
            </div>
            <div className="flex items-center justify-between border-t border-dashed border-neutral-200 py-[11px] text-[13.5px] font-semibold text-neutral-500">
              <dt>Sisa poin</dt>
              <dd className={`text-[15px] font-extrabold ${left < 0 ? "text-[#b42318]" : "text-[#0f9a80]"}`}>{left} poin</dd>
            </div>
          </dl>

          {error && (
            <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-[#f3b4ae] bg-[#fdecea] px-3 py-2.5 text-xs font-semibold text-[#b42318]">
              <span aria-hidden="true" className="font-extrabold">!</span>{error}
            </p>
          )}

          <p className="mt-3.5 flex items-start gap-2 text-xs font-semibold leading-snug text-neutral-500">
            <FaCircleInfo className="mt-0.5 size-3.5 shrink-0 text-[#b45f06]" aria-hidden="true" />
            Poin yang sudah ditukar tidak dapat dikembalikan. Hadiah akan muncul di Hadiah Saya.
          </p>

          <div className="mt-5 flex gap-2.5">
            <button type="button" onClick={onClose} className={ghostBtn}>Batal</button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={left < 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-[14px] bg-[#1abc9c] py-3.5 text-sm font-extrabold leading-none text-[#0a2136] shadow-[0_8px_18px_rgba(26,188,156,0.3)] transition hover:bg-[#22cfad] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FaGift aria-hidden="true" />
              Ya, tukar
            </button>
          </div>
        </>
      )}

      {step === "loading" && (
        <div className="py-[18px] text-center" role="status" aria-live="polite">
          <div className="mx-auto mb-4 size-14 animate-spin rounded-full border-[5px] border-[#e6f8f4] border-t-[#1abc9c] motion-reduce:animate-none" aria-hidden="true" />
          <h2 className="text-lg font-extrabold text-[#0a2136]">Memproses penukaran…</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-500">Mohon tunggu sebentar, jangan tutup halaman ini.</p>
        </div>
      )}

      {step === "success" && result && (
        <>
          <div className="pt-[18px] text-center">
            <div className="mx-auto mb-4 flex size-[72px] items-center justify-center rounded-full bg-[#1abc9c] text-3xl text-neutral-0 shadow-[0_0_0_10px_rgba(26,188,156,0.18)]" aria-hidden="true">
              <FaCheck />
            </div>
            <h2 className="text-lg font-extrabold text-[#0a2136]">Berhasil ditukar!</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-500">
              <b className="text-[#0a2136]">{reward.name}</b> sudah masuk ke Hadiah Saya. Tunjukkan QR-nya saat ingin memakai.
            </p>
            <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-[#e6f8f4] px-3.5 py-2 text-[13px] font-extrabold text-[#0f9a80]">
              <FaCoins aria-hidden="true" />
              Sisa {result.balance} poin
            </div>
          </div>
          <div className="mt-5 flex gap-2.5">
            <button type="button" onClick={onClose} className={ghostBtn}>Tutup</button>
            <button
              type="button"
              onClick={onViewGifts}
              className="flex flex-1 items-center justify-center gap-2 rounded-[14px] bg-[#0a2136] py-3.5 text-sm font-extrabold leading-none text-neutral-0 transition hover:bg-[#123a5c]"
            >
              <FaTicket aria-hidden="true" />
              Lihat hadiah
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile: bottom sheet, tarik ke bawah untuk tutup */}
      <div className="md:hidden fixed inset-0 z-[1200] flex items-end justify-center bg-[#0a2136]/55" role="dialog" aria-modal="true" aria-label={`Tukar ${reward.name}`} onClick={backdropClose}>
        <section
          className="w-full overflow-hidden rounded-t-[28px] bg-neutral-0 shadow-[0_-12px_40px_rgba(10,33,54,0.25)]"
          style={{
            transform: `translateY(${drag.y}px)`,
            transition: drag.dragging ? "none" : "transform .2s ease-out",
            animation: "sheet-up .25s ease-out",
          }}
        >
          <div
            className="cursor-grab touch-none px-5 pb-3 pt-2.5 active:cursor-grabbing"
            onPointerDown={dragStart}
            onPointerMove={dragMove}
            onPointerUp={dragEnd}
            onPointerCancel={dragEnd}
          >
            <div className="mx-auto h-1 w-10 rounded-full bg-neutral-200" aria-hidden="true" />
          </div>
          {content}
        </section>
      </div>

      {/* Desktop: dialog tengah */}
      <div className="hidden md:flex fixed inset-0 z-[1200] items-center justify-center bg-[#0a2136]/55 p-4" role="dialog" aria-modal="true" aria-label={`Tukar ${reward.name}`} onClick={backdropClose}>
        <section className="w-full max-w-sm overflow-hidden rounded-[28px] bg-neutral-0 pt-5 shadow-[0_-12px_40px_rgba(10,33,54,0.25)]">
          {content}
        </section>
      </div>
    </>
  );
}

/** Hadiah terdekat dengan saldo (selisih terkecil). Siap ditukar → kartu navy; belum → kartu teal + progres. */
function FeaturedReward({ reward, points, onRedeem, isPending }: {
  reward: RewardItem;
  points: number;
  onRedeem: (reward: RewardItem) => void;
  isPending: boolean;
}) {
  const ready = points >= reward.pointsCost;
  const pct = reward.pointsCost > 0 ? Math.min(100, Math.round((points / reward.pointsCost) * 100)) : 100;

  return (
    <section
      aria-label="Hadiah terdekat"
      className={`relative overflow-hidden rounded-3xl p-[18px] ${
        ready ? "bg-[linear-gradient(135deg,#0a2136,#123a5c)] text-neutral-0" : "bg-[linear-gradient(135deg,#0f9a80,#1abc9c_70%,#5fe0c4)] text-[#0a2136]"
      }`}
    >
      {/* Ikon besar sebagai ornamen */}
      <span
        className={`pointer-events-none absolute -bottom-5 -right-2 ${ready ? "text-[#1abc9c]/[0.16]" : "text-[#0a2136]/[0.12]"}`}
        aria-hidden="true"
      >
        <RewardIcon name={reward.icon} className="size-28" />
      </span>

      <span className={`relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-[5px] text-[11.5px] font-bold ${ready ? "bg-[#1abc9c] text-[#0a2136]" : "bg-[#0a2136]/85 text-neutral-0"}`}>
        {ready ? <FaCircleCheck aria-hidden="true" /> : <FaBullseye aria-hidden="true" />}
        {ready ? "Siap ditukar" : "Hadiah terdekat"}
      </span>

      <h2 className="relative mt-3 text-xl font-extrabold">{reward.name}</h2>
      {reward.description && <p className="relative mt-0.5 line-clamp-2 max-w-[70%] text-[13px] opacity-85">{reward.description}</p>}

      <div className="relative mt-4 flex justify-between text-xs font-bold">
        <span>{Math.min(points, reward.pointsCost)} / {reward.pointsCost} poin</span>
        <span>{ready ? "Poin cukup" : `Kurang ${reward.pointsCost - points} poin`}</span>
      </div>
      <div
        className={`relative mt-1.5 h-2 overflow-hidden rounded-full ${ready ? "bg-neutral-0/[0.18]" : "bg-[#0a2136]/[0.18]"}`}
        role="progressbar"
        aria-valuenow={Math.min(points, reward.pointsCost)}
        aria-valuemin={0}
        aria-valuemax={reward.pointsCost}
      >
        <div className={`h-full rounded-full transition-all duration-500 ${ready ? "bg-[#1abc9c]" : "bg-[#0a2136]"}`} style={{ width: `${pct}%` }} />
      </div>

      {ready && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => onRedeem(reward)}
          className="relative mt-4 flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#1abc9c] py-[13px] text-sm font-extrabold leading-none text-[#0a2136] shadow-[0_8px_18px_rgba(26,188,156,0.35)] transition hover:-translate-y-0.5 hover:bg-[#22cfad] disabled:opacity-60"
        >
          <FaGift aria-hidden="true" />
          Tukar sekarang
        </button>
      )}
    </section>
  );
}

function RewardContent({ points, rewards, isLoggedIn, isPending, onRedeem }: {
  points: number;
  rewards: RewardItem[];
  isLoggedIn: boolean;
  isPending: boolean;
  onRedeem: (reward: RewardItem) => void;
}) {
  if (rewards.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-0 px-6 py-12 text-center">
        <span className="mb-4 flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-primary-50 to-accent-50">
          <FaGift className="size-7 text-primary-700" aria-hidden="true" />
        </span>
        <p className="text-sm font-semibold text-neutral-900">Belum ada hadiah untuk ditukarkan</p>
        <p className="mt-1 text-xs text-neutral-500">Hadiah baru akan tersedia segera. Terus kirim laporan untuk mengumpulkan poin.</p>
        <p className="mt-3 rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-700">1 laporan diterima = 10 poin</p>
      </div>
    );
  }

  // Termurah dulu — reward yang realistis dicapai lebih dahulu terlihat
  const sorted = [...rewards].sort((a, b) => a.pointsCost - b.pointsCost);

  // Hadiah terdekat = selisih poin terkecil (seri → yang lebih murah). Hanya untuk user login.
  const featured = isLoggedIn
    ? sorted.reduce((best, r) => (Math.abs(r.pointsCost - points) < Math.abs(best.pointsCost - points) ? r : best), sorted[0])
    : null;

  return (
    <div>
      {featured && <FeaturedReward reward={featured} points={points} onRedeem={onRedeem} isPending={isPending} />}

      <h2 className={`px-1 pb-2.5 text-[15px] font-extrabold text-[#0a2136] ${featured ? "pt-5" : "pt-0"}`}>Semua hadiah</h2>

      <div className="grid grid-cols-2 gap-3">
        {sorted.map((reward) => {
          // Guest tetap bisa menekan tombol (diarahkan ke login); user login hanya jika poin cukup.
          const canRedeem = !isLoggedIn || points >= reward.pointsCost;
          return (
            <article
              key={reward.id}
              className="flex flex-col rounded-[20px] bg-neutral-0 shadow-[0_4px_14px_rgba(10,33,54,0.06)]"
            >
              <div className="flex-1 px-3.5 pb-3.5 pt-4">
                <span className="flex size-12 items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,#123a5c,#0a2136)] text-xl text-[#1abc9c]" aria-hidden="true">
                  <RewardIcon name={reward.icon} className="size-5" />
                </span>
                <h3 className="mt-3 text-sm font-bold leading-snug text-[#0a2136]">{reward.name}</h3>
                {reward.description && <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-neutral-500">{reward.description}</p>}
              </div>

              {/* Garis sobekan kupon */}
              <div className="relative mx-3.5 border-t-2 border-dashed border-neutral-200" aria-hidden="true">
                <span className="absolute -left-6 -top-[11px] size-5 rounded-full bg-neutral-50" />
                <span className="absolute -right-6 -top-[11px] size-5 rounded-full bg-neutral-50" />
              </div>

              <div className="flex items-center justify-between gap-2 px-3.5 pb-3.5 pt-3">
                <span className="inline-flex items-center gap-1.5 text-[15px] font-extrabold text-[#0f9a80]">
                  <FaCoins className="size-3.5" aria-hidden="true" />
                  {reward.pointsCost}
                </span>
                <button
                  type="button"
                  disabled={isPending || !canRedeem}
                  onClick={() => onRedeem(reward)}
                  className={`rounded-[10px] px-3 py-2 text-xs font-bold leading-none transition ${
                    canRedeem ? "bg-[#1abc9c] text-[#0a2136] hover:bg-[#22cfad]" : "cursor-not-allowed bg-[#e8eef4] text-neutral-500"
                  } disabled:opacity-70`}
                >
                  Tukar
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}