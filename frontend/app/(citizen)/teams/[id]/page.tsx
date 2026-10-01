"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, KeyRound, Pencil, Power, UserCog, Users, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Badge } from "@/components/ui/Badge";
import { RequireRole } from "@/components/auth/RequireRole";
import { TeamStatusPill } from "@/components/team/TeamStatusPill";
import { TeamFormModal } from "@/components/team/TeamFormModal";
import { ChangeLeaderSection } from "@/components/team/ChangeLeaderSection";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useToastStore } from "@/lib/toastStore";
import { activateTeam, deactivateTeam, getTeam, resetTeamPassword } from "@/features/dashboard/dashboardApi";
import type { TicketStatus } from "@/features/dashboard/dashboardTypes";
import { formatCategory } from "@/lib/formatters";

const ALLOWED = ["admin", "super_admin", "field_team"] as const;

type BadgeVariant = ComponentProps<typeof Badge>["variant"];
const badgeVariant = (status: TicketStatus): BadgeVariant =>
  status === "completed" ? "done" : status === "rejected" ? "urgent" : status === "cancelled" ? "cancelled" : status;

export default function TeamDetailPage() {
  return (
    <RequireRole roles={ALLOWED}>
      <TeamDetail />
    </RequireRole>
  );
}

/** Modal ringkas ala pola project (rewards/review): overlay + panel max-w. */
function Modal({ title, caption, onClose, children }: { title: string; caption?: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-neutral-900/50 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-neutral-0 sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <div>
            <h2 className="font-bold text-neutral-900">{title}</h2>
            {caption && <p className="text-xs text-neutral-500">{caption}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"><X className="size-5" aria-hidden="true" /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-neutral-900">{value}</p>
    </Card>
  );
}

const input = "mt-1.5 min-h-11 w-full rounded-xl border border-neutral-300 bg-neutral-0 px-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:border-accent-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/25";

function TeamDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const isMobile = useIsMobile();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  const [editOpen, setEditOpen] = useState(false);
  const [leaderOpen, setLeaderOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState("");

  const query = useQuery({ queryKey: ["team", id], queryFn: () => getTeam(id), enabled: Number.isInteger(id) && id > 0 });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["team", id] });
    void queryClient.invalidateQueries({ queryKey: ["teams"] });
  };
  const fail = (e: unknown, fallback: string) => showToast(e instanceof Error ? e.message : fallback, "info");

  const toggleActive = useMutation({
    mutationFn: () => (query.data?.team.isActive ? deactivateTeam(id) : activateTeam(id)),
    onSuccess: (team) => {
      showToast(team.isActive ? "Tim diaktifkan." : "Tim dinonaktifkan.", "success");
      setConfirmOpen(false);
      invalidate();
    },
    onError: (e) => { setConfirmOpen(false); fail(e, "Gagal mengubah status tim."); },
  });

  const resetPassword = useMutation({
    mutationFn: () => resetTeamPassword(id, password),
    onSuccess: () => {
      showToast("Password PJ berhasil direset.", "success");
      setResetOpen(false);
      setPassword("");
    },
    onError: (e) => fail(e, "Gagal reset password."),
  });

  if (query.isLoading) {
    return <main className="absolute inset-0 overflow-y-auto bg-neutral-50 px-4 py-6 pb-24 text-neutral-700 md:pb-6"><div className="mx-auto max-w-3xl space-y-4"><Skeleton className="h-8" /><Skeleton className="h-24" /><Skeleton className="h-32" /><Skeleton className="h-40" /></div></main>;
  }
  if (query.isError) {
    return <main className="absolute inset-0 overflow-y-auto bg-neutral-50 px-4 py-6 pb-24 text-neutral-700 md:pb-6"><div className="mx-auto max-w-3xl"><ErrorState message={query.error.message} onRetry={() => void query.refetch()} /></div></main>;
  }
  if (!query.data) return null;

  const { team, tickets, meta } = query.data;

  return (
    <main className="absolute inset-0 overflow-y-auto bg-neutral-50 px-4 py-6 pb-24 text-neutral-700 md:pb-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/teams" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:text-primary-800">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Kembali ke daftar tim
        </Link>

        <header className="mt-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-50 text-lg font-bold text-primary-800" aria-hidden="true">
              {team.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold text-neutral-900">{team.name}</h1>
              <p className="truncate text-sm text-neutral-500">
                {team.district ?? "Semua kecamatan"}{team.type ? ` · ${team.type}` : ""}
              </p>
            </div>
          </div>
          <TeamStatusPill status={team.status} />
        </header>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Tiket aktif" value={team.activeTicketCount} />
          <StatCard label="Total ditangani" value={team.totalTicketCount} />
          <div className="col-span-2 sm:col-span-1"><StatCard label="Status" value={{ tersedia: "Tersedia", bertugas: "Bertugas", selesai: "Selesai", nonaktif: "Nonaktif" }[team.status]} /></div>
        </div>

        {team.description && <Card className="mt-3 text-sm text-neutral-600">{team.description}</Card>}

        <Card className="mt-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900"><UserCog className="size-4 text-primary-700" aria-hidden="true" />Penanggung Jawab</h2>
              {team.leader ? (
                <div className="mt-2 space-y-0.5 text-sm text-neutral-700">
                  <p className="font-semibold text-neutral-900">{team.leader.name} <span className="font-normal text-neutral-500">@{team.leader.username}</span></p>
                  <p className="text-neutral-600">Telepon: {team.leader.phone ?? "—"}</p>
                  <p className="text-neutral-600">Email: {team.leader.email ?? "—"}</p>
                </div>
              ) : (
                <p className="mt-2 rounded-lg border border-warning-600 bg-warning-50 px-3 py-2 text-sm text-warning-800">PJ belum diatur — tim lama tanpa PJ tetap berfungsi, atur PJ agar akun tim dapat digunakan.</p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button type="button" variant="secondary" className="min-h-0 px-3 py-2 text-xs" onClick={() => { if (isMobile) router.push(`/tim/${team.id}/ganti-pj`); else setLeaderOpen(true); }}>
                <UserCog className="mr-1.5 inline size-4" aria-hidden="true" />Ganti PJ
              </Button>
              <Button type="button" variant="secondary" className="min-h-0 px-3 py-2 text-xs" disabled={!team.leader} onClick={() => setResetOpen(true)}>
                <KeyRound className="mr-1.5 inline size-4" aria-hidden="true" />Reset password
              </Button>
            </div>
          </div>
        </Card>

        <Card className="mt-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900"><Users className="size-4 text-primary-700" aria-hidden="true" />Data tim</h2>
              <p className="mt-1 text-sm text-neutral-500">Dibuat {team.createdAt ? new Date(team.createdAt).toLocaleDateString("id-ID", { dateStyle: "long" }) : "—"}</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="min-h-0 px-3 py-2 text-xs" onClick={() => { if (isMobile) router.push(`/tim/${team.id}/edit`); else setEditOpen(true); }}>
                <Pencil className="mr-1.5 inline size-4" aria-hidden="true" />Edit tim
              </Button>
              {team.isActive ? (
                <Button type="button" variant="danger" className="min-h-0 px-3 py-2 text-xs" onClick={() => setConfirmOpen(true)}>
                  <Power className="mr-1.5 inline size-4" aria-hidden="true" />Nonaktifkan
                </Button>
              ) : (
                <Button type="button" className="min-h-0 px-3 py-2 text-xs" disabled={toggleActive.isPending} onClick={() => toggleActive.mutate()}>
                  <Power className="mr-1.5 inline size-4" aria-hidden="true" />Aktifkan
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card className="mt-3">
          <h2 className="text-sm font-semibold text-neutral-900">Riwayat tiket ditangani</h2>
          {tickets.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">Belum ada tiket yang ditugaskan ke tim ini.</p>
          ) : (
            <ul className="mt-2 divide-y divide-neutral-100">
              {tickets.map((t) => (
                <li key={t.id}>
                  <Link href={`/tickets/${t.id}`} className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-neutral-50">
                    <div className="min-w-0">
                      <p className="truncate text-xs text-neutral-500">{t.ticketNumber}</p>
                      <p className="truncate text-sm font-medium text-neutral-900">{formatCategory(t.category)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-neutral-500">{new Date(t.createdAt).toLocaleDateString("id-ID")}</span>
                      <Badge variant={badgeVariant(t.status)} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {meta.lastPage > 1 && <p className="mt-2 text-xs text-neutral-500">Halaman {meta.currentPage} dari {meta.lastPage}</p>}
        </Card>

        {editOpen && <TeamFormModal team={team} onClose={() => setEditOpen(false)} />}

        {leaderOpen && (
          <Modal title="Ganti Penanggung Jawab" caption="Satu user hanya menjadi PJ satu tim." onClose={() => setLeaderOpen(false)}>
            <ChangeLeaderSection team={team} compact onDone={() => setLeaderOpen(false)} />
          </Modal>
        )}

        {resetOpen && (
          <Modal title="Reset password PJ" caption={`Akun: ${team.leader?.name ?? "-"}`} onClose={() => setResetOpen(false)}>
            <label htmlFor="reset-password" className="text-sm font-medium text-neutral-900">Password baru</label>
            <input id="reset-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 8 karakter" className={input} />
            <div className="mt-4 flex gap-3">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setResetOpen(false)}>Batal</Button>
              <Button type="button" className="flex-1" disabled={password.length < 8 || resetPassword.isPending} onClick={() => resetPassword.mutate()}>
                {resetPassword.isPending ? "Menyimpan..." : "Reset password"}
              </Button>
            </div>
          </Modal>
        )}

        {confirmOpen && (
          <Modal title="Nonaktifkan tim?" caption={team.name} onClose={() => setConfirmOpen(false)}>
            <p className="text-sm text-neutral-600">
              {team.activeTicketCount > 0
                ? `Tim masih memegang ${team.activeTicketCount} tiket aktif. Pindahkan (reassign) tiketnya dulu sebelum menonaktifkan.`
                : "Tim tidak akan muncul sebagai pilihan dispatch. Status ini bisa dibatalkan kapan saja."}
            </p>
            <div className="mt-4 flex gap-3">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setConfirmOpen(false)}>Batal</Button>
              <Button type="button" variant="danger" className="flex-1" disabled={toggleActive.isPending || team.activeTicketCount > 0} onClick={() => toggleActive.mutate()}>
                {toggleActive.isPending ? "Memproses..." : "Nonaktifkan"}
              </Button>
            </div>
          </Modal>
        )}
      </div>
    </main>
  );
}
