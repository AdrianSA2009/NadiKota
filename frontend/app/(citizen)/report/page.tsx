"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

const categoryLabel: Record<string, string> = { pothole: "Jalan berlubang", street_light: "PJU mati", other: "Kerusakan lain" };
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
  const [error, setError] = useState<string | null>(null);
  const [screening, setScreening] = useState<PhotoScreening | null>(null);
  const [screeningLoading, setScreeningLoading] = useState(false);
  const [captureReset, setCaptureReset] = useState(0);
  const touchStart = useRef(0);
  const [dragY, setDragY] = useState(0);

  useEffect(() => { if (initialized && !user) router.push("/peta"); }, [initialized, user, router]);
  useEffect(() => { setDirty(Boolean(photo) || step > 1); return () => setDirty(false); }, [photo, step, setDirty]);

  // Screening AI: deteksi jenis kerusakan + keparahan sebelum laporan dikirim.
  useEffect(() => {
    if (!photo) { setScreening(null); return; }
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
        ? Boolean(location)
        : true;

  function toFormData(report: OfflineReport) {
    const form = new FormData();
    form.append("category", report.category); form.append("latitude", String(report.latitude)); form.append("longitude", String(report.longitude)); form.append("photo", report.photo, "laporan.jpg");
    return form;
  }

  async function submit() {
    if (!photo || !location) { setError("Foto dan lokasi wajib diisi."); return; }
    const report: OfflineReport = { id: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), category, latitude: location.lat, longitude: location.lng, photo };
    try {
      if (!online) throw new Error("offline");
      const res = await createReport(toFormData(report), report.idempotencyKey);
      setDirty(false); showToast(res.status === 202 ? "Laporan berhasil dikirim — sedang divalidasi AI." : "Laporan berhasil dikirim.", "success"); router.push("/kontribusi");
    } catch (e) {
      if (!online || e instanceof Error && e.message === "offline") { await enqueueReport(report); setDirty(false); showToast("Laporan tersimpan di antrean offline.", "info"); router.push("/kontribusi"); return; }
      setError(e instanceof Error ? e.message : "Laporan gagal dikirim.");
    }
  }

  return <main className="absolute inset-0 overflow-y-auto bg-neutral-50 px-4 py-6 pb-24 text-neutral-700 md:pb-6"><div className="mx-auto max-w-lg" style={{ transform: dragY ? `translateY(${dragY}px)` : undefined }}>
    <header><p className="text-sm font-medium text-primary-700">Langkah {step} dari 3</p><h1 className="mt-1 text-2xl font-bold text-neutral-900">Lapor kerusakan</h1></header>
    {error && <div className="mt-4"><ErrorState message={error} /></div>}
    <Card className="mt-6">
      <div className="-mx-4 -mt-4 mb-3 flex justify-center rounded-t-xl pt-3 pb-1 md:hidden" role="button" aria-label="Geser ke bawah untuk menutup" onTouchStart={(e) => { touchStart.current = e.touches[0].clientY; }} onTouchMove={(e) => { const d = e.touches[0].clientY - touchStart.current; if (d > 0) setDragY(d); }} onTouchEnd={() => { if (dragY > 100) router.push("/peta"); setDragY(0); }} style={{ touchAction: "none" }}><span className="h-1 w-10 rounded-full bg-neutral-300" /></div>
      {step === 1 && <section><h2 className="text-lg font-semibold text-neutral-900">Ambil foto</h2><p className="mt-1 text-sm">Gunakan kamera untuk memotret kerusakan.</p><div className="mt-4"><CameraCapture key={captureReset} onCapture={setPhoto} /></div>
        {screeningLoading && <p role="status" className="mt-3 text-sm text-primary-700">AI sedang memeriksa foto…</p>}
        {screening?.status === "unavailable" && <p role="status" className="mt-3 text-sm text-warning-800">Pemeriksaan AI tidak tersedia — foto tetap bisa dikirim dan akan divalidasi setelah laporan masuk.</p>}
        {screenFail && <div role="alert" className="mt-3 rounded-lg border border-danger-600 bg-danger-50 px-3 py-2.5 text-sm text-danger-700"><p className="font-semibold">{screenFail.title}</p><p className="mt-1">{screenFail.body}</p><Button type="button" variant="danger" className="mt-2" onClick={() => { setPhoto(null); setScreening(null); setCaptureReset((n) => n + 1); setError(null); }}>Ambil foto ulang</Button></div>}
        {screening?.status === "done" && screening.ok && <div role="status" className="mt-3 rounded-lg border border-success-600 bg-success-50 px-3 py-2.5 text-sm text-success-700"><p className="font-semibold">Terdeteksi: {categoryLabel[screening.category ?? "other"]}{screening.category === "pothole" && screening.severity ? ` — tingkat keparahan ${severityLabel[screening.severity] ?? screening.severity}` : ""}</p></div>}
      </section>}
      {step === 2 && <section><h2 className="text-lg font-semibold text-neutral-900">Lokasi dan kategori</h2><div className="mt-4"><LocationPicker onLocation={(lat, lng) => setLocation({ lat, lng })} /></div><fieldset className="mt-6"><legend className="font-medium text-neutral-900">Kategori kerusakan</legend><div className="mt-3 grid gap-2">{([["pothole", "Jalan berlubang"], ["street_light", "PJU mati"], ["other", "Lainnya"]] as const).map(([value, label]) => <Button key={value} type="button" variant={category === value ? "primary" : "secondary"} onClick={() => setCategory(value)}>{label}</Button>)}</div></fieldset></section>}
      {step === 3 && <section><h2 className="text-lg font-semibold text-neutral-900">Kirim laporan</h2><p className="mt-2 text-sm">Periksa data laporan sebelum dikirim.</p><dl className="mt-4 space-y-2 text-sm"><div><dt className="font-medium">Foto</dt><dd>{photo ? "Siap dikirim" : "Belum tersedia"}</dd></div><div><dt className="font-medium">Lokasi</dt><dd>{location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : "Belum tersedia"}</dd></div></dl></section>}
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
        setStep((s) => (s + 1) as 1 | 2 | 3);
      }}>Lanjut</Button> : <Button type="button" className="ml-auto" onClick={submit}>Kirim laporan</Button>}</div>
    </Card>
  </div></main>;
}
