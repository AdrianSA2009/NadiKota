"use client";

import { useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  FaCheck, FaChevronDown, FaClipboardCheck, FaPlay, FaPlus, FaRegCalendar, FaRegCircleCheck, FaRegClock,
  FaRegCopy, FaRegImage, FaCircleInfo, FaHourglassHalf, FaLocationArrow, FaLocationDot,
  FaRotateRight, FaUserGroup, FaWrench,
} from "react-icons/fa6";
import type { IconType } from "react-icons";
import { apiClient } from "@/lib/apiClient";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { useToastStore } from "@/lib/toastStore";
import { completeTicket, startTicket } from "@/features/dashboard/dashboardApi";
import { formatCategory } from "@/lib/formatters";
import { categoryMeta } from "@/lib/categoryMeta";
import { TaskLocationMap } from "@/components/team/TaskLocationMap";
import type { Ticket, TicketListResponse } from "@/features/dashboard/dashboardTypes";

type BadgeVariant = ComponentProps<typeof Badge>["variant"];
/** Fallback untuk status di luar tiga tahap tugas tim (mis. selesai/dibatalkan). */
const statusBadge = (s: string, reviewStatus?: string | null): BadgeVariant =>
  s === "in_progress" && reviewStatus === "submitted"
    ? "assessing"
    : s === "queued"
      ? "waiting"
      : s === "completed"
        ? "done"
        : s === "rejected"
          ? "urgent"
          : s === "cancelled"
            ? "cancelled"
            : (s as BadgeVariant);

/** Tiga tahap tugas tim: Menunggu → Dalam Perbaikan → Dalam Penilaian (bukti terkirim). */
type TaskState = "wait" | "repair" | "review" | "other";

const stateOf = (t: Pick<Ticket, "status" | "reviewStatus">): TaskState => {
  if (t.status === "queued") return "wait";
  if (t.status === "in_progress") return t.reviewStatus === "submitted" ? "review" : "repair";
  return "other";
};

const STATE_META: Record<Exclude<TaskState, "other">, { label: string; chip: string; icon: IconType; badge: string; count: string; level: number }> = {
  wait: { label: "Menunggu", chip: "Menunggu", icon: FaRegClock, badge: "border-[#f2c27a] bg-[#fff4e0] text-[#b45f06]", count: "text-[#b45f06]", level: 0 },
  repair: { label: "Dalam Perbaikan", chip: "Perbaikan", icon: FaWrench, badge: "border-[#b3cde4] bg-[#e8f1f9] text-[#1f5a8a]", count: "text-[#1f5a8a]", level: 1 },
  review: { label: "Dalam Penilaian", chip: "Penilaian", icon: FaHourglassHalf, badge: "border-[#a9c0ff] bg-[#e8efff] text-[#1d4ed8]", count: "text-[#1d4ed8]", level: 2 },
};

type Filter = "all" | "wait" | "repair" | "review";

const STEPS: { label: string; icon: IconType }[] = [
  { label: "Ditugaskan", icon: FaCheck },
  { label: "Perbaikan", icon: FaWrench },
  { label: "Penilaian", icon: FaHourglassHalf },
];

const primaryBtn = "flex w-full items-center justify-center gap-2 rounded-[14px] py-3.5 text-sm font-extrabold leading-none transition disabled:cursor-not-allowed";
const routeBtn = `${primaryBtn} border-[1.5px] border-neutral-200 bg-neutral-0 text-[#0a2136] hover:bg-neutral-50 disabled:opacity-50`;
const hintBase = "flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs font-medium leading-relaxed xl:px-3.5 xl:py-3 xl:text-[13px]";

/** Progres tiga langkah — langkah yang sudah dicapai terisi teal. */
function Progress({ level }: { level: number }) {
  return (
    <div className="mb-3.5 flex items-center" aria-label="Progres tugas">
      {STEPS.map(({ label, icon: Icon }, i) => (
        <div key={label} className="contents">
          {i > 0 && <div className={`mb-5 h-0.5 flex-1 ${i <= level ? "bg-[#1abc9c]" : "bg-neutral-200"}`} />}
          <div className={`flex w-[74px] shrink-0 flex-col items-center gap-1.5 text-center text-[11px] xl:w-24 xl:text-xs ${i === level ? "font-extrabold text-[#0a2136]" : "font-semibold text-neutral-500"}`}>
            <span className={`flex size-7 items-center justify-center rounded-full border-[1.5px] text-[11px] xl:size-8 xl:text-xs ${i <= level ? "border-[#1abc9c] bg-[#1abc9c] text-[#0a2136]" : "border-neutral-200 bg-[#f4f7fa]"}`}>
              <Icon aria-hidden="true" />
            </span>
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Tampilan saat belum ada tugas — ilustrasi, penjelasan alur, dan tombol muat ulang. */
function EmptyTasks({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  return (
    <section className="mx-auto flex w-full max-w-lg flex-col items-center rounded-[20px] bg-neutral-0 px-6 py-10 text-center shadow-[0_4px_14px_rgba(10,33,54,0.06)]">
      <div className="relative mb-5 flex size-28 items-center justify-center rounded-full bg-[#e6f8f4]" aria-hidden="true">
        <div className="absolute inset-3 rounded-full bg-[#1abc9c]/15" />
        <FaClipboardCheck className="relative size-10 text-[#0a2136]" />
      </div>

      <h2 className="text-lg font-extrabold text-[#0a2136]">Belum ada tugas</h2>
      <p className="mt-1 max-w-[17rem] text-sm leading-6 text-neutral-500">
        Tiket yang ditugaskan admin ke tim Anda akan muncul di sini.
      </p>

      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="mt-5 flex items-center gap-2 rounded-full bg-[#0a2136] px-6 py-3 text-sm font-bold text-neutral-0 shadow-[0_8px_18px_rgba(10,33,54,0.22)] transition hover:-translate-y-0.5 hover:bg-[#123a5c] disabled:opacity-60"
      >
        <FaRotateRight className={`size-3.5 text-[#1abc9c] ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
        {refreshing ? "Memuat…" : "Muat ulang"}
      </button>

      {/* Alur singkat */}
      <p className="mt-8 text-[11.5px] font-bold uppercase tracking-[0.14em] text-neutral-400">Alur tugas</p>
      <ol className="mt-3 grid w-full grid-cols-3 gap-2">
        {STEPS.map(({ label, icon: Icon }) => (
          <li key={label} className="flex flex-col items-center gap-2">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-[#f4f7fa] text-[#123a5c] ring-1 ring-neutral-200">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span className="text-[11px] font-semibold leading-tight text-neutral-500">{label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Sisi TIM LAPANGAN — daftar tugas, mulai pengerjaan, kirim bukti hasil perbaikan. */
export function FieldTasksView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  // Akordeon tugas + kirim bukti hasil perbaikan.
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
  // Pratinjau foto bukti — object URL dibuat saat memilih file (tanpa setState di effect).
  const [proof, setProof] = useState<{ file: File; url: string } | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  function pickProof(file: File | null) {
    if (proof) URL.revokeObjectURL(proof.url);
    setProof(file ? { file, url: URL.createObjectURL(file) } : null);
  }

  const submitProof = useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => completeTicket(id, file),
    onSuccess: () => {
      showToast("Bukti terkirim — menunggu verifikasi admin.", "success");
      pickProof(null);
      setOpenTaskId(null);
      void queryClient.invalidateQueries({ queryKey: ["field-tickets"] });
      void queryClient.invalidateQueries({ queryKey: ["tickets-map"] });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : "Gagal mengirim bukti.", "info"),
  });

  const startTask = useMutation({
    mutationFn: (id: number) => startTicket(id),
    onSuccess: (d) => {
      showToast(d.message, "success");
      void queryClient.invalidateQueries({ queryKey: ["field-tickets"] });
      // Peta: status tiket berubah (dalam perbaikan) — segarkan.
      void queryClient.invalidateQueries({ queryKey: ["tickets-map"] });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : "Gagal memulai tiket.", "info"),
  });

  const tasksQuery = useQuery({
    queryKey: ["field-tickets"],
    queryFn: async () => (await apiClient.get<TicketListResponse>("/field/tickets")).data,
  });

  const tasks = tasksQuery.data?.data ?? [];
  const counts = {
    wait: tasks.filter((t) => stateOf(t) === "wait").length,
    repair: tasks.filter((t) => stateOf(t) === "repair").length,
    review: tasks.filter((t) => stateOf(t) === "review").length,
  };
  const visible = filter === "all" ? tasks : tasks.filter((t) => stateOf(t) === filter);
  const hasTasks = tasks.length > 0;

  async function copyCoords(t: Ticket) {
    try {
      await navigator.clipboard.writeText(`${t.latitude}, ${t.longitude}`);
      showToast("Koordinat disalin.", "success");
    } catch {
      showToast("Gagal menyalin koordinat.", "info");
    }
  }

  function openRoute(t: Ticket) {
    router.push(`/peta?route=${t.latitude},${t.longitude}&label=${encodeURIComponent(`${formatCategory(t.category)} · ${t.ticketNumber}`)}`);
  }

  return (
    <div className="min-w-0 flex-1 overflow-y-auto bg-neutral-50 pb-24 md:pb-8 xl:px-10 xl:py-7">
      {/* Header */}
      <header className={`relative overflow-hidden rounded-b-[32px] bg-[linear-gradient(160deg,#0a2136_0%,#123a5c_100%)] px-5 pt-[22px] text-neutral-0 xl:mx-auto xl:max-w-[1120px] xl:rounded-[28px] xl:px-8 xl:py-7 ${hasTasks ? "pb-[70px]" : "pb-8"}`}>
        <div className="absolute -right-[60px] -top-[70px] size-[200px] rounded-full bg-[#1abc9c]/[0.18] xl:-right-[50px] xl:-top-[90px] xl:size-[280px]" aria-hidden="true" />
        <div className="relative mx-auto max-w-2xl xl:flex xl:max-w-none xl:items-center xl:justify-between xl:gap-6">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#1abc9c]">
              <FaUserGroup aria-hidden="true" />
              Tim Lapangan
            </span>
            <h1 className="mt-1.5 text-[26px] font-extrabold tracking-tight xl:mt-2 xl:text-[32px]">Tugas saya</h1>
            <p className="mt-0.5 text-[13px] text-neutral-0/70 xl:mt-1 xl:text-sm">Tiket yang sedang ditugaskan kepada tim Anda</p>
          </div>

          {/* Ringkasan di dalam banner — hanya desktop */}
          {hasTasks && (
            <div className="hidden gap-3 xl:flex" aria-label="Ringkasan tugas">
              {([
                ["wait", "Menunggu", "text-[#ffc977]"],
                ["repair", "Dalam perbaikan", "text-[#8fd0ff]"],
                ["review", "Dalam penilaian", "text-[#1abc9c]"],
              ] as const).map(([k, label, color]) => (
                <div key={k} className="min-w-[132px] rounded-[18px] border border-neutral-0/[0.14] bg-neutral-0/10 px-[18px] py-3.5">
                  <b className={`block text-[28px] font-extrabold leading-none ${color}`}>{counts[k]}</b>
                  <small className="mt-1.5 block text-xs font-semibold text-neutral-0/70">{label}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-2xl xl:max-w-[1120px]">
        {/* Ringkasan (mobile/tablet) — menimpa tepi bawah header */}
        {hasTasks && (
          <section aria-label="Ringkasan tugas" className="relative z-10 -mt-9 px-4 xl:hidden">
            <div className="flex rounded-[20px] bg-neutral-0 px-2 py-3.5 shadow-[0_10px_24px_rgba(10,33,54,0.12)]">
              {(["wait", "repair", "review"] as const).map((k) => (
                <div key={k} className="flex-1 border-l border-neutral-200 text-center first:border-l-0">
                  <b className={`block text-[22px] font-extrabold leading-none ${STATE_META[k].count}`}>{counts[k]}</b>
                  <small className="mt-1 block text-[11.5px] font-semibold text-neutral-500">{STATE_META[k].chip}</small>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Toolbar: filter + jumlah (satu baris di desktop) */}
        {hasTasks && (
          <div className="xl:mb-3.5 xl:mt-6 xl:flex xl:items-center xl:justify-between xl:gap-4">
            <div className="scrollbar-hide flex gap-2 overflow-x-auto px-4 pb-1 pt-5 xl:flex-wrap xl:overflow-visible xl:p-0" role="group" aria-label="Filter tugas">
              {([
                { id: "all", label: "Semua", icon: undefined },
                { id: "wait", label: "Menunggu", icon: FaRegClock },
                { id: "repair", label: "Perbaikan", icon: FaWrench },
                { id: "review", label: "Penilaian", icon: FaHourglassHalf },
              ] as { id: Filter; label: string; icon?: IconType }[]).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  aria-pressed={filter === id}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 py-[9px] text-[13px] font-semibold leading-none transition xl:px-4 xl:py-2.5 ${
                    filter === id ? "border-[#0a2136] bg-[#0a2136] text-neutral-0" : "border-neutral-200 bg-neutral-0 text-neutral-500 xl:hover:border-neutral-300"
                  }`}
                >
                  {Icon && <Icon className="size-3.5" aria-hidden="true" />}
                  {label}
                </button>
              ))}
            </div>
            <p className="px-5 pb-2 pt-4 text-[13px] text-neutral-500 xl:shrink-0 xl:p-0"><b className="text-[#0a2136]">{visible.length}</b> tugas aktif</p>
          </div>
        )}

        <div className={`px-4 xl:px-0 ${hasTasks ? "" : "pt-6"}`}>
          {tasksQuery.isLoading && <div className="space-y-3 pt-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>}
          {tasksQuery.isError && <Card className="border-danger-600 bg-danger-50 text-sm text-danger-700">Gagal memuat tugas.</Card>}
          {tasksQuery.data && !hasTasks && (
            <EmptyTasks onRefresh={() => void tasksQuery.refetch()} refreshing={tasksQuery.isFetching} />
          )}
          {hasTasks && visible.length === 0 && (
            <p className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-0 px-4 py-10 text-center text-sm text-neutral-500">
              Tidak ada tugas di kategori ini.
            </p>
          )}

          {visible.length > 0 && (
            <ul className="space-y-3.5 xl:space-y-4">
              {visible.map((t) => {
                const state = stateOf(t);
                const meta = state === "other" ? null : STATE_META[state];
                const open = openTaskId === t.id;
                const cat = categoryMeta(t.category);
                const CatIcon = cat.icon;
                const hasCoords = Number.isFinite(t.latitude) && Number.isFinite(t.longitude);
                const BadgeIcon = meta?.icon;

                const routeButton = (label: string, extra = "") => (
                  <button type="button" disabled={!hasCoords} onClick={() => openRoute(t)} className={`${routeBtn} ${extra}`}>
                    <FaLocationArrow className="text-[#0f9a80]" aria-hidden="true" />
                    {label}
                  </button>
                );

                // Catatan per status — di desktop tampil di kolom kiri.
                const hint =
                  state === "wait" ? (
                    <p className={`${hintBase} bg-[#eef4fa] text-neutral-500`}>
                      <FaCircleInfo className="mt-0.5 shrink-0 text-[#123a5c]" aria-hidden="true" />
                      <span>Sudah ditugaskan ke tim Anda. Tekan <b className="text-[#0a2136]">Mulai tugas</b> untuk menandai sedang dikerjakan.</span>
                    </p>
                  ) : state === "repair" && !proof ? (
                    <p className={`${hintBase} bg-[#eef4fa] text-neutral-500`}>
                      <FaCircleInfo className="mt-0.5 shrink-0 text-[#123a5c]" aria-hidden="true" />
                      <span>Pilih foto bukti dulu, baru tombol <b className="text-[#0a2136]">Selesai</b> bisa ditekan.</span>
                    </p>
                  ) : state === "review" ? (
                    <p className={`${hintBase} border border-[#a9c0ff] bg-[#e8efff] text-[#2a43a3]`}>
                      <FaHourglassHalf className="mt-0.5 shrink-0 text-[#1d4ed8]" aria-hidden="true" />
                      <span>Bukti sudah dikirim — status <b className="text-[#1d4ed8]">Dalam Penilaian</b>, menunggu hasil penilaian admin.</span>
                    </p>
                  ) : null;

                // Tombol aksi per status — di desktop tampil di kolom kanan.
                const actions =
                  state === "wait" ? (
                    <div className="flex gap-2.5">
                      {routeButton("Rute", "flex-1")}
                      <button
                        type="button"
                        disabled={startTask.isPending}
                        onClick={() => startTask.mutate(t.id)}
                        className={`${primaryBtn} flex-[1.4] bg-[#0a2136] text-neutral-0 shadow-[0_8px_18px_rgba(10,33,54,0.22)] hover:bg-[#123a5c] disabled:opacity-60`}
                      >
                        {startTask.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FaPlay className="text-[#1abc9c]" aria-hidden="true" />}
                        Mulai tugas
                      </button>
                    </div>
                  ) : state === "repair" ? (
                    <div className="flex flex-col gap-2.5">
                      {routeButton("Buka rute ke lokasi")}

                      <label className={`relative flex cursor-pointer items-center gap-3 rounded-[14px] border-[1.5px] p-3 text-[#0a2136] ${proof ? "border-solid border-[#1abc9c] bg-[#f0fbf8]" : "border-dashed border-[#b3cde4] bg-[#f5f9fd] hover:bg-[#eef5fb]"}`}>
                        <input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 size-full cursor-pointer opacity-0"
                          onChange={(e) => pickProof(e.target.files?.[0] ?? null)}
                        />
                        {proof ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={proof.url} alt="Pratinjau foto bukti" className="size-[52px] shrink-0 rounded-xl border border-[#b3cde4] object-cover" />
                        ) : (
                          <span className="flex size-[52px] shrink-0 items-center justify-center rounded-xl border border-[#b3cde4] bg-neutral-0 text-xl text-[#1f5a8a]" aria-hidden="true">
                            <FaRegImage />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <b className={`block text-sm font-extrabold ${proof ? "text-[#0f9a80]" : ""}`}>{proof ? "Foto bukti dipilih" : "Pilih foto bukti"}</b>
                          <span className="mt-0.5 block truncate text-xs font-medium text-neutral-500">
                            {proof ? `${proof.file.name} · klik untuk ganti` : "Foto jalan setelah diperbaiki"}
                          </span>
                        </span>
                        <FaPlus className="shrink-0 text-[#1f5a8a]" aria-hidden="true" />
                      </label>

                      <button
                        type="button"
                        disabled={!proof || submitProof.isPending}
                        onClick={() => { if (proof) submitProof.mutate({ id: t.id, file: proof.file }); }}
                        className={`${primaryBtn} bg-[#1abc9c] text-[#0a2136] shadow-[0_8px_18px_rgba(26,188,156,0.35)] hover:-translate-y-0.5 hover:bg-[#22cfad] disabled:translate-y-0 disabled:bg-[#8093a8] disabled:text-neutral-0 disabled:shadow-none`}
                      >
                        {submitProof.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FaRegCircleCheck aria-hidden="true" />}
                        Selesai
                      </button>
                    </div>
                  ) : state === "review" ? (
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center gap-3 rounded-[14px] bg-[#f4f7fa] p-2.5">
                        <span className="flex size-[52px] shrink-0 items-center justify-center rounded-xl bg-[#e6f8f4] text-xl text-[#0f9a80]" aria-hidden="true"><FaRegCircleCheck /></span>
                        <div>
                          <b className="block text-[13px] font-extrabold text-[#0a2136]">Foto bukti terkirim</b>
                          <span className="mt-0.5 block text-xs text-neutral-500">Dikirim ke admin untuk dinilai</span>
                        </div>
                      </div>
                      {routeButton("Buka rute ke lokasi")}
                    </div>
                  ) : (
                    routeButton("Buka rute ke lokasi")
                  );

                return (
                  <li key={t.id} className="overflow-hidden rounded-[20px] bg-neutral-0 shadow-[0_4px_14px_rgba(10,33,54,0.06)] xl:rounded-[22px] xl:border xl:border-neutral-200">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => { setOpenTaskId((v) => (v === t.id ? null : t.id)); pickProof(null); }}
                      className="flex w-full items-center gap-3 p-3.5 text-left xl:gap-4 xl:px-[22px] xl:py-[18px] xl:hover:bg-neutral-50"
                    >
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-[15px] bg-[linear-gradient(135deg,#123a5c,#0a2136)] text-[#1abc9c] xl:size-[52px] xl:rounded-2xl" aria-hidden="true">
                        <CatIcon className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11.5px] font-bold tracking-wide text-neutral-500 xl:text-xs">{t.ticketNumber}</span>
                        <span className="mt-0.5 block truncate text-[15px] font-extrabold text-[#0a2136] xl:text-lg">{formatCategory(t.category)}</span>
                      </span>
                      {meta && BadgeIcon ? (
                        <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1.5 text-[11.5px] font-bold xl:px-3.5 xl:py-2 xl:text-[12.5px] ${meta.badge}`}>
                          <BadgeIcon aria-hidden="true" />
                          {meta.label}
                        </span>
                      ) : (
                        <Badge variant={statusBadge(t.status, t.reviewStatus)} />
                      )}
                      <FaChevronDown className={`size-3 shrink-0 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                    </button>

                    {open && (
                      // Mobile: satu kolom (urutan lewat `order-*`). Desktop: dua kolom — kiri fleksibel, kanan 360px.
                      <div className="flex flex-col px-3.5 pb-3.5 xl:grid xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-7 xl:border-t xl:border-neutral-200 xl:p-[22px]">

                        {/* KIRI: progres, info, catatan */}
                        <div className="contents xl:block xl:min-w-0">
                          {meta && <div className="order-1"><Progress level={meta.level} /></div>}

                          <div className="order-3 mt-3 xl:mt-2 xl:rounded-2xl xl:border xl:border-neutral-200 xl:px-4 xl:py-1">
                            <div className="flex items-center gap-3 py-[9px] xl:py-3">
                              <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#eaf1f8] text-sm text-[#0a2136] xl:size-[38px] xl:rounded-[11px]" aria-hidden="true"><FaLocationDot /></span>
                              <div className="min-w-0 flex-1">
                                <div className="text-[11.5px] font-semibold text-neutral-500 xl:text-xs">Lokasi</div>
                                <div className="mt-px text-sm font-bold text-[#0a2136] xl:text-[15px]">
                                  {hasCoords ? `${t.latitude.toFixed(5)}, ${t.longitude.toFixed(5)}` : "tidak tersedia"}
                                </div>
                              </div>
                              {hasCoords && (
                                <button type="button" onClick={() => void copyCoords(t)} aria-label="Salin koordinat" className="shrink-0 rounded-[10px] bg-[#f4f7fa] px-2.5 py-2 text-[13px] text-neutral-500 transition hover:bg-neutral-100 xl:px-3 xl:py-2.5">
                                  <FaRegCopy aria-hidden="true" />
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-3 border-t border-dashed border-neutral-200 py-[9px] xl:py-3">
                              <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#eaf1f8] text-sm text-[#0a2136] xl:size-[38px] xl:rounded-[11px]" aria-hidden="true"><FaRegCalendar /></span>
                              <div className="min-w-0 flex-1">
                                <div className="text-[11.5px] font-semibold text-neutral-500 xl:text-xs">Dibuat</div>
                                <div className="mt-px text-sm font-bold text-[#0a2136] xl:text-[15px]">{new Date(t.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</div>
                              </div>
                            </div>
                          </div>

                          {t.reviewStatus === "proof_rejected" && t.proofNote && (
                            <p className="order-4 mt-3 rounded-xl border border-[#f3b4ae] bg-[#fdecea] px-3 py-2.5 text-xs text-[#b42318] xl:mt-4">
                              <span className="font-bold">Ditolak admin:</span> {t.proofNote} — kirim foto ulang.
                            </p>
                          )}

                          {hint && <div className="order-6 mt-3 xl:mt-4">{hint}</div>}
                        </div>

                        {/* KANAN: peta + tombol */}
                        <div className="contents xl:flex xl:flex-col xl:gap-3.5">
                          <div className="relative order-2 h-[92px] overflow-hidden rounded-[14px] bg-[#dce7ef] xl:h-[190px] xl:rounded-[18px]">
                            {hasCoords && <TaskLocationMap ticket={t} />}
                            {!hasCoords && (
                              <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-neutral-500">
                                Lokasi tidak tersedia
                              </div>
                            )}
                            <button
                              type="button"
                              disabled={!hasCoords}
                              onClick={() => openRoute(t)}
                              aria-label="Buka lokasi di peta"
                              className={`absolute inset-0 z-[2] ${hasCoords ? "cursor-pointer" : "cursor-not-allowed"}`}
                            />
                            {hasCoords && (
                              <span className="pointer-events-none absolute bottom-3 left-3 z-[3] hidden items-center gap-1.5 rounded-full bg-neutral-0/90 px-2.5 py-1.5 text-[11.5px] font-bold text-[#0a2136] xl:inline-flex">
                                <FaLocationDot aria-hidden="true" />
                                {t.latitude.toFixed(5)}, {t.longitude.toFixed(5)}
                              </span>
                            )}
                          </div>

                          <div className="order-5 mt-3 xl:mt-0">
                            {actions}
                            {submitProof.isError && (
                              <p role="alert" className="mt-3 text-xs text-[#b42318]">{submitProof.error.message}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}