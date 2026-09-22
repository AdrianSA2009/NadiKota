"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChartNoAxesColumn, Settings } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { apiClient } from "@/lib/apiClient";

type PriorityWeights = { severity: number; reporters: number; roadClass: number; criticalFacility: number; age: number };
interface SettingsData { priority: PriorityWeights; clusteringRadiusMeters: number; }
const settingsSchema = z.object({
  clusteringRadiusMeters: z.number().int().min(15).max(25),
  priority: z.object({ severity: z.number().min(0), reporters: z.number().min(0), roadClass: z.number().min(0), criticalFacility: z.number().min(0), age: z.number().min(0) }),
});

async function getSettings(): Promise<SettingsData> {
  const response = await apiClient.get<{ data: SettingsData }>("/settings/priority");
  return response.data.data;
}

async function saveSettings(settings: SettingsData): Promise<SettingsData> {
  const response = await apiClient.put<{ data: SettingsData }>("/settings/priority", settings);
  return response.data.data;
}

const labels: Record<keyof PriorityWeights, string> = {
  severity: "Tingkat keparahan", reporters: "Pelapor unik", roadClass: "Kelas jalan", criticalFacility: "Fasilitas kritis", age: "Umur tiket",
};

export default function SettingsPage() {
  const query = useQuery({ queryKey: ["priority-settings"], queryFn: getSettings });
  const mutation = useMutation({ mutationFn: saveSettings });
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (query.isLoading) return <main className="min-h-screen bg-neutral-50 px-4 py-6"><div className="mx-auto max-w-2xl space-y-4"><Skeleton className="h-10" /><Skeleton className="h-64" /></div></main>;
  if (query.isError) return <main className="min-h-screen bg-neutral-50 px-4 py-6"><div className="mx-auto max-w-2xl"><ErrorState message={query.error.message} onRetry={() => void query.refetch()} /></div></main>;
  const currentSettings = settings ?? query.data;
  if (!currentSettings) return null;

  const updateWeight = (key: keyof PriorityWeights, value: string) => setSettings({ ...currentSettings, priority: { ...currentSettings.priority, [key]: Number(value) } });
  function save() {
    const result = settingsSchema.safeParse(currentSettings);
    if (!result.success) { setError("Radius harus 15–25 meter dan bobot harus bernilai nol atau lebih."); return; }
    setError(null);
    mutation.mutate(result.data);
  }

  return <main className="min-h-screen bg-neutral-50 px-4 py-6 text-neutral-700"><div className="mx-auto max-w-2xl">
    <header><p className="flex items-center gap-2 text-sm font-medium text-primary-700"><Settings className="size-5" aria-hidden="true" />Super Admin</p><h1 className="mt-1 text-2xl font-bold text-neutral-900">Pengaturan prioritas</h1><p className="mt-1 text-sm text-neutral-500">Perubahan dicatat dalam audit dan memengaruhi perhitungan berikutnya.</p></header>
    <Card className="mt-6"><h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900"><ChartNoAxesColumn className="size-5" aria-hidden="true" />Bobot skor prioritas</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">{(Object.keys(labels) as (keyof PriorityWeights)[]).map((key) => <label key={key} className="text-sm font-medium text-neutral-900">{labels[key]}<input type="number" min="0" step="0.01" value={currentSettings.priority[key]} onChange={(event) => updateWeight(key, event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 bg-neutral-0 px-3 text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2" /></label>)}</div><label className="mt-6 block text-sm font-medium text-neutral-900">Radius clustering (meter)<input type="number" min="15" max="25" value={currentSettings.clusteringRadiusMeters} onChange={(event) => setSettings({ ...currentSettings, clusteringRadiusMeters: Number(event.target.value) })} className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 bg-neutral-0 px-3 text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2" /><span className="mt-1 block text-sm text-neutral-500">Nilai yang diizinkan: 15–25 meter.</span></label>{error && <p role="alert" className="mt-4 text-sm text-danger-700">{error}</p>}{mutation.isError && <p role="alert" className="mt-4 text-sm text-danger-700">{mutation.error.message}</p>}{mutation.isSuccess && <p role="status" className="mt-4 text-sm text-success-700">Pengaturan tersimpan dan keputusan tercatat.</p>}<Button type="button" className="mt-6" onClick={save} disabled={mutation.isPending}>Simpan pengaturan</Button></Card>
  </div></main>;
}
