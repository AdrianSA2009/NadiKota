"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { create } from "zustand";
import { ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { CameraCapture } from "@/components/report/CameraCapture";
import { LocationPicker } from "@/components/report/LocationPicker";
import { createReport, findNearbyTicket, supportTicket, type NearbyTicket } from "@/features/reports/reportApi";
import { reportSchema, type ReportFormData } from "@/features/reports/reportSchema";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { enqueueReport, readReportOutbox, removeReportFromOutbox, type OfflineReport } from "@/lib/reportOutbox";

interface WizardState { step: 1 | 2 | 3; next: () => void; back: () => void; reset: () => void; }
const useWizardStore = create<WizardState>((set) => ({
  step: 1,
  next: () => set((state) => ({ step: Math.min(3, state.step + 1) as 1 | 2 | 3 })),
  back: () => set((state) => ({ step: Math.max(1, state.step - 1) as 1 | 2 | 3 })),
  reset: () => set({ step: 1 }),
}));

function toFormData(report: OfflineReport): FormData {
  const formData = new FormData();
  formData.append("category", report.category);
  formData.append("latitude", String(report.latitude));
  formData.append("longitude", String(report.longitude));
  formData.append("photo", report.photo, "laporan.jpg");
  return formData;
}

export default function ReportPage() {
  const router = useRouter();
  const online = useOnlineStatus();
  const { step, next, back, reset } = useWizardStore();
  const [photo, setPhoto] = useState<File | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [category, setCategory] = useState<ReportFormData["category"]>("pothole");
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);
  const [nearbyTicket, setNearbyTicket] = useState<NearbyTicket | null>(null);
  const [supporting, setSupporting] = useState(false);
  const [supported, setSupported] = useState(false);

  const flushOutbox = useCallback(async () => {
    if (!navigator.onLine) return;
    for (const report of await readReportOutbox()) {
      try { await createReport(toFormData(report)); await removeReportFromOutbox(report.id); } catch { break; }
    }
  }, []);

  useEffect(() => { void flushOutbox(); window.addEventListener("online", flushOutbox); return () => window.removeEventListener("online", flushOutbox); }, [flushOutbox]);

  function validateStep(): boolean {
    setError(null);
    if (step === 1 && !photo) { setError("Ambil foto kerusakan sebelum melanjutkan."); return false; }
    if (step === 2 && !location) { setError("Lokasi GPS wajib tersedia sebelum melanjutkan."); return false; }
    return true;
  }

  async function checkNearbyTicket() {
    if (!location) return;
    setError(null);
    try {
      setNearbyTicket(await findNearbyTicket(category, location.lat, location.lng));
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : "Tiket terdekat tidak dapat diperiksa. Coba lagi.");
    }
  }

  async function supportNearbyTicket() {
    if (!nearbyTicket) return;
    setSupporting(true);
    setError(null);
    try {
      setNearbyTicket(await supportTicket(nearbyTicket.id));
      setSupported(true);
    } catch (supportError) {
      setError(supportError instanceof Error ? supportError.message : "Dukungan laporan gagal dikirim. Coba lagi.");
    } finally {
      setSupporting(false);
    }
  }

  async function submit() {
    if (!photo || !location) return;
    const report: OfflineReport = { id: crypto.randomUUID(), category, latitude: location.lat, longitude: location.lng, photo };
    if (!reportSchema.safeParse(report).success) { setError("Data laporan belum lengkap. Periksa foto, lokasi, dan kategori."); return; }
    try {
      if (!online) throw new Error("offline");
      await createReport(toFormData(report));
      router.push("/");
    } catch (submitError) {
      if (!online || submitError instanceof Error && submitError.message === "offline") {
        await enqueueReport(report); setQueued(true); reset(); return;
      }
      setError(submitError instanceof Error ? submitError.message : "Laporan gagal dikirim. Coba lagi.");
    }
  }

  return <main className="min-h-screen bg-neutral-50 px-4 py-6 text-neutral-700"><div className="mx-auto max-w-lg">
    <header><p className="text-sm font-medium text-primary-700">Langkah {step} dari 3</p><h1 className="mt-1 text-2xl font-bold text-neutral-900">Lapor kerusakan</h1></header>
    {queued && <div role="status" className="mt-4 rounded-lg border border-success-600 bg-success-50 p-3 text-sm text-success-700">Laporan tersimpan di antrean lokal.</div>}
    {error && <div className="mt-4"><ErrorState message={error} /></div>}
    <Card className="mt-6">
      {step === 1 && <section aria-labelledby="photo-title"><h2 id="photo-title" className="text-lg font-semibold text-neutral-900">Ambil foto</h2><p className="mt-1 text-sm">Gunakan kamera untuk memotret kerusakan.</p><div className="mt-4"><CameraCapture onCapture={setPhoto} /></div></section>}
      {step === 2 && <section aria-labelledby="location-title"><h2 id="location-title" className="text-lg font-semibold text-neutral-900">Lokasi dan kategori</h2><div className="mt-4"><LocationPicker onLocation={(lat, lng) => setLocation({ lat, lng })} /></div><fieldset className="mt-6"><legend className="font-medium text-neutral-900">Kategori kerusakan</legend><div className="mt-3 space-y-2">{[["pothole", "Jalan berlubang"], ["street_light", "PJU mati"], ["other", "Lainnya"]].map(([value, label]) => <Button key={value} type="button" variant={category === value ? "primary" : "secondary"} className="w-full text-left" onClick={() => setCategory(value as ReportFormData["category"])}>{label}</Button>)}</div></fieldset></section>}
      {step === 3 && <section aria-labelledby="submit-title"><h2 id="submit-title" className="text-lg font-semibold text-neutral-900">Kirim laporan</h2><p className="mt-2 text-sm">Periksa data laporan. Sistem mengirim laporan saat koneksi tersedia.</p><dl className="mt-4 space-y-2 text-sm"><div><dt className="font-medium">Foto</dt><dd>{photo ? "Siap dikirim" : "Belum tersedia"}</dd></div><div><dt className="font-medium">Lokasi</dt><dd>{location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : "Belum tersedia"}</dd></div><div><dt className="font-medium">Kategori</dt><dd>{category === "pothole" ? "Jalan berlubang" : category === "street_light" ? "PJU mati" : "Lainnya"}</dd></div></dl><Button type="button" variant="secondary" className="mt-5 w-full" onClick={checkNearbyTicket}>Periksa laporan di sekitar</Button>{nearbyTicket && <div className="mt-4 rounded-lg border border-info-600 bg-info-50 p-4 text-info-800"><p className="font-semibold">Laporan serupa ditemukan</p><p className="mt-1 text-sm">Tiket {nearbyTicket.ticketNumber} berada dalam radius cluster. Dukung laporan ini agar jumlah pelapor unik bertambah.</p><Button type="button" className="mt-3" onClick={supportNearbyTicket} disabled={supporting || supported}><ThumbsUp className="mr-2 inline size-5" aria-hidden="true" />{supported ? "Laporan didukung" : supporting ? "Mengirim dukungan" : "Dukung laporan ini"}</Button></div>}</section>}
      <div className="mt-6 flex gap-3">{step > 1 && <Button type="button" variant="secondary" onClick={back}>Kembali</Button>}{step < 3 ? <Button type="button" className="ml-auto" onClick={() => { if (validateStep()) next(); }}>Lanjut</Button> : <Button type="button" className="ml-auto" onClick={submit} disabled={supported}>Kirim laporan</Button>}</div>
    </Card>
  </div></main>;
}
