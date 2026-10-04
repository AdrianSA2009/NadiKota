"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, MapPin, Send, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { CameraCapture } from "@/components/report/CameraCapture";
import { LocationPicker } from "@/components/report/LocationPicker";
import { createReport, getPhotoScreening, screenPhoto, screeningFailure, type PhotoScreening } from "@/features/reports/reportApi";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { enqueueReport, readReportOutbox, removeReportFromOutbox, type OfflineReport } from "@/lib/reportOutbox";
import { useAuthStore } from "@/features/auth/authStore";
import { useNavGuard } from "@/lib/navigationGuard";
import { useToastStore } from "@/lib/toastStore";

const categoryLabel: Record<string, string> = { pothole: "Jalan berlubang", street_light: "PJU mati", other: "Kerusakan lainnya" };
const severityLabel: Record<string, string> = { low: "Ringan", moderate: "Sedang", high: "Parah", critical: "Kritis" };

export default function ReportPage() {
  const router = useRouter();
  const online = useOnlineStatus();
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const setDirty = useNavGuard((s) => s.setReportDirty);
  const showToast = useToastStore((s) => s.show);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [photo, setPhoto] = useState<File | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [category, setCategory] = useState<"pothole" | "street_light" | "other">("pothole");
  const [otherDescription, setOtherDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [screening, setScreening] = useState<PhotoScreening | null>(null);
  const [screeningLoading, setScreeningLoading] = useState(false);
  const [captureReset, setCaptureReset] = useState(0);
  // Foto sudah disensor backend → jangan jalankan screening AI lagi atas foto yang sama.
  const redactionRef = useRef(false);
  const touchStart = useRef(0);
  const [dragY, setDragY] = useState(0);

  useEffect(() => { if (initialized && !user) router.push("/peta"); }, [initialized, user, router]);
  useEffect(() => { setDirty(Boolean(photo) || step > 1); return () => setDirty(false); }, [photo, step, setDirty]);

  // Refresh / tutup tab saat ada progres laporan → konfirmasi dulu (progress hilang).
  const hasProgress = Boolean(photo) || step > 1;
  useEffect(() => {
    if (!hasProgress) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Browser menampilkan pesan default; set returnValue wajib untuk Chrome.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasProgress]);

  // Screening AI: deteksi jenis kerusakan + keparahan sebelum laporan dikirim.
  useEffect(() => {
    // Tanpa foto tidak ada yang perlu disaring (screening tetap dibersihkan di clearPhoto).
    if (!photo) return;
    if (redactionRef.current) {
      // Foto tersensor sudah discreening backend — jangan jalankan ulang.
      redactionRef.current = false;
      return;
    }
    let cancelled = false;
    setScreeningLoading(true);
    setScreening(null);
    (async () => {
      try {
        const checkId = await screenPhoto(photo);
        for (let i = 0; i < 30 && !cancelled; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          const result = await getPhotoScreening(checkId);
          if (cancelled) return;
          if (result.status !== "pending") {
            if (result.status === "done" && result.ok && result.category) setCategory(result.category);
            // Foto tersensor (wajah/plat) menggantikan file asli sebelum dikirim.
            if (result.status === "done" && result.redactedUrl) {
              const res = await fetch(result.redactedUrl);
              const blob = await res.blob();
              redactionRef.current = true; // cegah efek screening berjalan ulang atas foto tersensor
              setPhoto(new File([blob], "laporan.jpg", { type: "image/jpeg" }));
            }
            setScreening(result); setScreeningLoading(false); return;
          }
        }
        if (!cancelled) { setScreening({ status: "unavailable" }); setScreeningLoading(false); }
      } catch {
        if (!cancelled) { setScreening({ status: "unavailable" }); setScreeningLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [photo]);

  // Foto dihapus (ambil ulang / reset) → bersihkan hasil screening lama.
  const clearPhoto = () => {
    setPhoto(null);
    setScreening(null);
    setScreeningLoading(false);
    redactionRef.current = false;
    setCaptureReset((n) => n + 1);
    setError(null);
  };

  const flushOutbox = useCallback(async () => {
    if (!navigator.onLine) return;
    for (const report of await readReportOutbox()) {
      try { const res = await createReport(toFormData(report), report.idempotencyKey); if (res.status < 400) await removeReportFromOutbox(report.id); } catch { break; }
    }
  }, []);
  useEffect(() => { void flushOutbox(); window.addEventListener("online", flushOutbox); return () => window.removeEventListener("online", flushOutbox); }, [flushOutbox]);

  if (!initialized || !user) return null;

  const screenFail = screening?.status === "done" && !screening.ok ? screeningFailure(screening) : null;
  // Lanjut hanya aktif bila syarat langkah terpenuhi:
  // langkah 1 = foto ada, AI selesai memeriksa (lolos, atau tak tersedia), gagal = wajib ambil ulang.
  // langkah 2 = lokasi GPS sudah didapat (kategori selalu punya nilai default).
  const canNext =
    step === 1
      ? Boolean(photo) && !screeningLoading && screening !== null &&
        ((screening.status === "done" && screening.ok) || screening.status === "unavailable")
      : step === 2
        ? Boolean(location) && (category !== "other" || otherDescription.trim().length > 0)
        : true;
  const steps = [
    { id: 1, label: "Foto", icon: Sparkles },
    { id: 2, label: "Lokasi", icon: MapPin },
    { id: 3, label: "Kirim", icon: Send },
  ] as const;

  function toFormData(report: OfflineReport) {
    const form = new FormData();
    form.append("category", report.category);
    if (report.otherDescription) form.append("other_description", report.otherDescription);
    form.append("latitude", String(report.latitude)); form.append("longitude", String(report.longitude)); form.append("photo", report.photo, "laporan.jpg");
    return form;
  }

  async function submit() {
    if (!photo || !location) { setError("Foto dan lokasi wajib diisi."); return; }
    const report: OfflineReport = { id: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), category, otherDescription: category === "other" ? otherDescription.trim() : null, latitude: location.lat, longitude: location.lng, photo };
    try {
      if (!online) throw new Error("offline");
      const res = await createReport(toFormData(report), report.idempotencyKey);
      setDirty(false); showToast(res.status === 202 ? "Laporan berhasil dikirim — sedang divalidasi AI." : "Laporan berhasil dikirim.", "success"); router.push("/kontribusi");
    } catch (e) {
      if (!online || e instanceof Error && e.message === "offline") { await enqueueReport(report); setDirty(false); showToast("Laporan tersimpan di antrean offline.", "info"); router.push("/kontribusi"); return; }
      setError(e instanceof Error ? e.message : "Laporan gagal dikirim.");
    }
  }

  return <main className="absolute inset-0 overflow-y-auto bg-gradient-to-b from-primary-50/70 via-neutral-50 to-neutral-50 px-4 py-6 pb-24 text-neutral-700 md:pb-6"><div className="mx-auto max-w-lg" style={{ transform: dragY ? `translateY(${dragY}px)` : undefined }}>
    <header className="mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-primary-800 via-primary-800 to-primary-700 px-5 py-5 text-neutral-0 shadow-lg">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-accent-500"><ShieldCheck className="size-4" aria-hidden="true" /> Laporan warga</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Lapor kerusakan</h1>
      <p className="mt-1 text-sm text-primary-100">Bantu petugas memperbaiki fasilitas kota.</p>
      <div className="mt-5">
        <ol className="flex items-center gap-1" aria-label={`Langkah ${step} dari 3`}>
          {steps.map(({ id, label, icon: Icon }) => {
            const done = id < step;
            const active = id === step;
            return (
              <Fragment key={id}>
                <li className={`flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-xl px-1.5 py-2 text-[11px] font-semibold sm:flex-row sm:gap-2 sm:text-xs ${active ? "bg-neutral-0 text-primary-800 shadow-sm" : done ? "bg-accent-500/20 text-accent-500" : "bg-neutral-0/10 text-primary-100/70"}`} aria-current={active ? "step" : undefined}>
                  <span className={`grid size-6 shrink-0 place-items-center rounded-full ${active ? "bg-primary-50" : done ? "bg-accent-500/20" : "bg-neutral-0/10"}`}>
                    {done ? <Check className="size-3.5" aria-hidden="true" /> : <Icon className="size-3.5" aria-hidden="true" />}
                  </span>
                  <span className="truncate">{label}</span>
                  <span className="sr-only">{done ? "Selesai" : active ? "Sedang dikerjakan" : "Belum dimulai"}</span>
                </li>
                {id < 3 && <li aria-hidden="true" className={`shrink-0 ${id < step ? "text-accent-500" : "text-primary-100/50"}`}><ArrowRight className="size-3.5 sm:size-4" /></li>}
              </Fragment>
            );
          })}
        </ol>
      </div>
    </header>
    {error && <div className="mt-4"><ErrorState message={error} /></div>}
    <Card className="mt-0 border-neutral-200/80 shadow-md">
      <div className="-mx-4 -mt-4 mb-3 flex justify-center rounded-t-xl pt-3 pb-1 md:hidden" role="button" aria-label="Geser ke bawah untuk menutup" onTouchStart={(e) => { touchStart.current = e.touches[0].clientY; }} onTouchMove={(e) => { const d = e.touches[0].clientY - touchStart.current; if (d > 0) setDragY(d); }} onTouchEnd={() => { if (dragY > 100) router.push("/peta"); setDragY(0); }} style={{ touchAction: "none" }}><span className="h-1 w-10 rounded-full bg-neutral-300" /></div>
      {step === 1 && <section><p className="text-xs font-semibold uppercase tracking-wider text-primary-700">Tahap 1 · Dokumentasi</p><h2 className="mt-1 text-xl font-bold text-neutral-900">Ambil foto kerusakan</h2><p className="mt-1 text-sm text-neutral-500">Pastikan kerusakan terlihat jelas. Foto akan diperiksa otomatis sebelum dikirim.</p><div className="mt-4"><CameraCapture key={captureReset} photo={photo} onCapture={setPhoto} onClear={() => setPhoto(null)} busy={screeningLoading} /></div>
        {screeningLoading && <p role="status" className="mt-3 text-sm text-primary-700">AI sedang memeriksa foto…</p>}
        {screening?.status === "unavailable" && <p role="status" className="mt-3 text-sm text-warning-800">Pemeriksaan AI tidak tersedia — foto tetap bisa dikirim dan akan divalidasi setelah laporan masuk.</p>}
        {screenFail && <div role="alert" className="mt-3 rounded-lg border border-danger-600 bg-danger-50 px-3 py-2.5 text-sm text-danger-700"><p className="font-semibold">{screenFail.title}</p><p className="mt-1">{screenFail.body}</p><Button type="button" variant="danger" className="mt-2" disabled={screeningLoading} onClick={clearPhoto}>Ambil foto ulang</Button></div>}
        {screening?.status === "done" && screening.ok && <div role="status" className="mt-3 rounded-lg border border-success-600 bg-success-50 px-3 py-2.5 text-sm text-success-700"><p className="font-semibold">Terdeteksi: {categoryLabel[screening.category ?? "other"]}{screening.category === "pothole" && screening.severity ? ` — tingkat keparahan ${severityLabel[screening.severity] ?? screening.severity}` : ""}</p></div>}
        {(screening?.redacted_faces ?? 0) + (screening?.redacted_plates ?? 0) > 0 && <p role="status" className="mt-3 rounded-lg border border-info-600 bg-info-50 px-3 py-2.5 text-sm text-info-800">Wajah dan/atau plat nomor kendaraan pada foto telah disensor otomatis demi privasi.</p>}
      </section>}
      {step === 2 && <section><p className="text-xs font-semibold uppercase tracking-wider text-primary-700">Tahap 2 · Penentuan lokasi</p><h2 className="mt-1 text-xl font-bold text-neutral-900">Di mana kerusakannya?</h2><p className="mt-1 text-sm text-neutral-500">Tandai titik di peta dan pilih kategori yang paling sesuai.</p><div className="mt-4 overflow-hidden rounded-xl border border-neutral-200"><LocationPicker onLocation={(lat, lng) => setLocation({ lat, lng })} /></div><fieldset className="mt-6"><legend className="font-semibold text-neutral-900">Kategori kerusakan</legend><p className="mt-1 text-xs text-neutral-500">Pilih jenis masalah yang Anda temukan.</p><div className="mt-3 grid gap-2">{([["pothole", "Jalan berlubang"], ["street_light", "PJU mati"], ["other", "Kerusakan lainnya"]] as const).map(([value, label]) => <Button key={value} type="button" variant={category === value ? "primary" : "secondary"} onClick={() => setCategory(value)}>{label}</Button>)}</div></fieldset>{category === "other" && <div className="mt-5"><label htmlFor="other-description" className="text-sm font-semibold text-neutral-900">Apa kerusakan yang Anda temukan?</label><p className="mt-1 text-xs text-neutral-500">Tulis singkat agar petugas lebih cepat memahami masalahnya.</p><textarea id="other-description" rows={3} maxLength={500} value={otherDescription} onChange={(e) => { setOtherDescription(e.target.value); if (error) setError(null); }} placeholder="Contoh: Saluran air mampet causing air menggenang di depan pasar." className="mt-2 w-full rounded-xl border border-neutral-300 bg-neutral-0 p-3 text-sm text-neutral-900 focus-visible:border-accent-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/25" /><p className="mt-1 text-right text-xs text-neutral-400">{otherDescription.length}/500</p></div>}</section>}
      {step === 3 && <section><p className="text-xs font-semibold uppercase tracking-wider text-primary-700">Tahap 3 · Konfirmasi</p><h2 className="mt-1 text-xl font-bold text-neutral-900">Periksa laporan Anda</h2><p className="mt-1 text-sm text-neutral-500">Pastikan foto, kategori, dan lokasi sudah benar sebelum mengirim.</p><dl className="mt-4 divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-neutral-50 px-4"><div className="flex justify-between gap-3 py-3 text-sm"><dt className="text-neutral-500">Foto</dt><dd className="font-semibold text-neutral-900">{photo ? "Siap dikirim" : "Belum tersedia"}</dd></div><div className="flex justify-between gap-3 py-3 text-sm"><dt className="text-neutral-500">Kategori</dt><dd className="font-semibold text-neutral-900">{categoryLabel[category]}</dd></div><div className="flex justify-between gap-3 py-3 text-sm"><dt className="text-neutral-500">Lokasi</dt><dd className="text-right font-semibold text-neutral-900">{location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : "Belum tersedia"}</dd></div></dl></section>}
      <div className="mt-6 flex gap-3">{step > 1 && <Button type="button" variant="secondary" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>Kembali</Button>}{step < 3 ? <Button type="button" className="ml-auto" disabled={!canNext} onClick={() => {
        if (step === 1) {
          if (!photo) { setError("Foto wajib diisi."); return; }
          if (screeningLoading) { setError("Tunggu AI selesai memeriksa foto."); return; }
          if (screening?.status === "done" && !screening.ok) { setError(screeningFailure(screening).short); return; }
          setError(null);
        }
        if (step === 2 && screening?.status === "done" && screening.ok && screening.category && screening.category !== category) {
          setError(`Foto terdeteksi "${categoryLabel[screening.category]}", bukan "${categoryLabel[category]}". Pilih kategori yang sesuai atau ambil foto ulang.`);
          return;
        }
        if (step === 2) setError(null);
        if (category === "other" && otherDescription.trim().length === 0) { setError("Jelaskan kerusakan yang Anda temukan."); return; }
        setStep((s) => (s + 1) as 1 | 2 | 3);
      }}>Lanjut</Button> : <Button type="button" className="ml-auto" onClick={submit}>Kirim laporan</Button>}</div>
    </Card>
  </div></main>;
}
