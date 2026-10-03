"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, Gift, Ticket, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { apiClient } from "@/lib/apiClient";
import { useToastStore } from "@/lib/toastStore";
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

/** Header panel Tukar Poin — gradasi navy → teal, judul gradient, kartu poin "frosted". */
function TukarPoinHeader({ onClose, points }: { onClose?: () => void; points?: PointsData }) {
  const pct = points && points.total > 0 ? Math.round((points.affordableCount / points.total) * 100) : 0;
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 px-5 py-5 text-neutral-0">
      {/* Ornamen teal + glow navy */}
      <div className="absolute -right-10 -top-12 size-36 rounded-full bg-accent-600/25" aria-hidden="true" />
      <div className="absolute -right-1 top-14 size-16 rounded-full bg-accent-500/15" aria-hidden="true" />
      <div className="absolute -bottom-12 -left-8 size-32 rounded-full bg-primary-600/40 blur-lg" aria-hidden="true" />

      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-accent-500">
            <Gift className="size-3.5" aria-hidden="true" />
            Hadiah Kontribusi
          </p>
          <h2 className="mt-1.5 bg-gradient-to-r from-neutral-0 via-neutral-0 to-accent-500 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent">
            Tukar Poin
          </h2>
          <p className="mt-0.5 text-xs text-primary-100/80">Tukarkan poin jadi hadiah nyata</p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="shrink-0 rounded-full border border-neutral-0/20 bg-neutral-0/10 p-2 text-primary-100 transition hover:bg-neutral-0/20" aria-label="Tutup">
            <X className="size-5" />
          </button>
        )}
      </div>

      {points && (
        <div className="relative mt-4 overflow-hidden rounded-2xl border border-accent-500/40 bg-neutral-0/10 p-4 shadow-[0_8px_24px_rgba(0,0,0,0.25)] backdrop-blur-sm">
          <div className="absolute -right-5 -top-7 size-20 rounded-full bg-accent-500/10" aria-hidden="true" />
          <div className="relative flex items-center justify-between gap-3">
            <p className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold leading-none text-accent-500">{points.loading ? "…" : points.balance}</span>
              <span className="text-xs font-semibold text-primary-100/90">poin kamu</span>
            </p>
            <button
              type="button"
              onClick={points.onMyGifts}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-neutral-0 px-4 py-2 text-xs font-extrabold text-primary-800 shadow-lg transition hover:-translate-y-0.5 hover:bg-primary-50"
            >
              <Ticket className="size-4" aria-hidden="true" />
              Hadiah Saya
            </button>
          </div>
          <div className="relative mt-3 flex items-center justify-between text-xs">
            <span className="text-primary-100/80">Hadiah siap ditukar</span>
            <span className="font-bold text-neutral-0">{points.affordableCount} dari {points.total}</span>
          </div>
          <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-neutral-0/20">
            <div className="h-full rounded-full bg-gradient-to-r from-accent-600 to-accent-500 transition-all duration-500" style={{ width: `${pct}%` }} aria-hidden="true" />
          </div>
        </div>
      )}
    </div>
  );
}

export function TukarPoinPanel() {
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const { open, closePanel } = useTukarPoinPanel();
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  const router = useRouter();
  const [claimReward, setClaimReward] = useState<RewardItem | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  const panelOpen = open;
  const rewardsQuery = useQuery({ queryKey: ["rewards"], queryFn: fetchRewards, staleTime: 60_000, enabled: initialized });
  const pointsQuery = useQuery({ queryKey: ["me-points"], queryFn: fetchPoints, staleTime: 30_000, enabled: initialized && Boolean(user) });

  const rewards = rewardsQuery.data ?? [];
  const balance = pointsQuery.data?.balance ?? 0;
  const affordableCount = rewards.filter((r) => balance >= r.pointsCost).length;

  const redeemMutation = useMutation({
    mutationFn: async (rewardId: number) => (await apiClient.post<{ data: { balance: number; pointsCost: number; message: string; transactionId?: number } }>(`/rewards/${rewardId}/redeem`)).data.data,
    onSuccess: (result) => {
      showToast("Hadiah berhasil diklaim.", "success");
      setClaimReward(null);
      setClaimError(null);
      void queryClient.invalidateQueries({ queryKey: ["me-points"] });
      void queryClient.invalidateQueries({ queryKey: ["rewards"] });
      // Langsung ke halaman QR hadiah yang baru diklaim.
      closePanel();
      router.push(result.transactionId ? `/hadiah?new=${result.transactionId}` : "/hadiah");
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

  function confirmClaim() {
    if (!claimReward) return;
    if (balance < claimReward.pointsCost) {
      setClaimError("Poin Anda tidak cukup untuk menukar hadiah ini.");
      return;
    }
    redeemMutation.mutate(claimReward.id);
  }

  if (!initialized) return null;

  return (
    <>
      {/* Desktop panel — slide dari kiri seperti KontribusiPanel */}
      <div
        className="hidden md:block fixed inset-y-0 left-0 z-[1000] w-96 border-r border-neutral-200 bg-neutral-0 shadow-2xl transition-transform duration-300 ease-out"
        style={{ transform: panelOpen ? "translateX(240px)" : "translateX(-100%)" }}
      >
        <div className="flex h-full flex-col">
          {/* Header gradient + ornamen */}
          <TukarPoinHeader
            onClose={closePanel}
            points={user ? { balance, loading: pointsQuery.isLoading, affordableCount, total: rewards.length, onMyGifts: openMyGifts } : undefined}
          />
          <div className="flex-1 overflow-y-auto bg-neutral-50 px-5 py-4">
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
        <div className="shrink-0">
          <TukarPoinHeader
            points={user ? { balance, loading: pointsQuery.isLoading, affordableCount, total: rewards.length, onMyGifts: openMyGifts } : undefined}
          />
        </div>
        <div className="flex-1 overflow-y-auto bg-neutral-50 px-4 pt-4 pb-24">
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
          onConfirm={confirmClaim}
          onClose={() => { setClaimReward(null); setClaimError(null); }}
        />
      )}
    </>
  );
}

function ClaimModal({ reward, balance, error, isPending, onConfirm, onClose }: {
  reward: RewardItem;
  balance: number;
  error: string | null;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  // Drag-to-close hanya untuk versi mobile (bottom sheet)
  const dragRef = useRef({ startY: 0, dy: 0, active: false });
  const [drag, setDrag] = useState({ y: 0, dragging: false });

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
    if (dy > 100) onClose();
  }
  function backdropClose(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  const header = (grab: boolean) => (
    <div
      className={grab ? "shrink-0 cursor-grab touch-none active:cursor-grabbing" : ""}
      onPointerDown={grab ? dragStart : undefined}
      onPointerMove={grab ? dragMove : undefined}
      onPointerUp={grab ? dragEnd : undefined}
      onPointerCancel={grab ? dragEnd : undefined}
    >
      <div className={`relative overflow-hidden bg-primary-800 px-6 pb-5 text-neutral-0 ${grab ? "pt-3" : "pt-5"}`}>
        <div className="absolute -right-6 -top-6 size-24 rounded-full bg-primary-700/60" aria-hidden="true" />
        <div className="absolute -bottom-8 right-12 size-16 rounded-full bg-accent-600/30" aria-hidden="true" />
        {grab && (
          <div className="mx-auto mb-3 flex w-fit justify-center" aria-hidden="true">
            <div className="h-1 w-10 rounded-full bg-primary-600" />
          </div>
        )}
        <div className="relative">
          <p className="text-xs font-medium text-primary-100">Konfirmasi Penukaran</p>
          <h2 className="mt-0.5 text-lg font-bold">{reward.name}</h2>
        </div>
      </div>
    </div>
  );

  const body = (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="space-y-2 rounded-xl border border-accent-500/40 bg-gradient-to-br from-accent-50 to-neutral-0 p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-500">Biaya</span>
          <span className="font-bold text-primary-800">{reward.pointsCost} poin</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-500">Saldo Anda</span>
          <span className="font-bold text-neutral-900">{balance} poin</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-500">Saldo setelah tukar</span>
          <span className="font-bold text-success-700">{balance - reward.pointsCost} poin</span>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-danger-600 bg-danger-50 px-3 py-2.5 text-xs text-danger-700">
          <span aria-hidden="true" className="font-bold">!</span>{error}
        </p>
      )}
    </div>
  );

  const footer = (
    <div className="flex shrink-0 gap-2 border-t border-neutral-200 bg-neutral-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Batal</Button>
      <Button type="button" className="flex-1" onClick={onConfirm} disabled={isPending}>
        {isPending ? "Memproses..." : "Klaim hadiah"}
      </Button>
    </div>
  );

  return (
    <>
      {/* Mobile: muncul dari bawah, tarik ke bawah untuk tutup */}
      <div className="md:hidden fixed inset-0 z-[1200] flex items-end justify-center bg-neutral-900/50 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={backdropClose}>
        <section
          className="flex max-h-[72vh] w-full flex-col overflow-hidden rounded-t-3xl bg-neutral-0 shadow-xl"
          style={{
            transform: `translateY(${drag.y}px)`,
            transition: drag.dragging ? "none" : "transform .2s ease-out",
            animation: "sheet-up .25s ease-out",
          }}
        >
          {header(true)}
          {body}
          {footer}
        </section>
      </div>

      {/* Desktop: dialog tengah biasa */}
      <div className="hidden md:flex fixed inset-0 z-[1200] items-center justify-center bg-neutral-900/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={backdropClose}>
        <section className="w-full max-w-sm overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-0 shadow-xl">
          {header(false)}
          {body}
          {footer}
        </section>
      </div>
    </>
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
          <Gift className="size-8 text-primary-700" />
        </span>
        <p className="text-sm font-semibold text-neutral-900">Belum ada hadiah untuk ditukarkan</p>
        <p className="mt-1 text-xs text-neutral-500">Hadiah baru akan tersedia segera. Terus kirim laporan untuk mengumpulkan poin.</p>
        <p className="mt-3 rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-700">1 laporan diterima = 10 poin</p>
      </div>
    );
  }

  // Termurah dulu — reward yang realistis dicapai lebih dahulu terlihat
  const sorted = [...rewards].sort((a, b) => a.pointsCost - b.pointsCost);

  return (
    <div>
      <div className="space-y-3">
        {sorted.map((reward) => {
          return (
            <article
              key={reward.id}
              className="group relative overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-0 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent-500/50 hover:shadow-md"
            >
              <div
                className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-accent-500 to-primary-700"
                aria-hidden="true"
              />
              <div className="flex items-start gap-3 pl-2.5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-800 to-primary-600 text-neutral-0 shadow-sm">
                  <RewardIcon name={reward.icon} className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900 group-hover:text-primary-800">
                    {reward.name}
                  </p>
                  {reward.description && (
                    <p className="mt-0.5 truncate text-xs text-neutral-400">{reward.description}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="primary"
                  className="flex flex-row shrink-0 items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold shadow-sm"
                  disabled={isPending}
                  onClick={() => onRedeem(reward)}
                >
                  <Coins className="size-3.5" aria-hidden="true" />
                  <span>{reward.pointsCost}</span>
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
