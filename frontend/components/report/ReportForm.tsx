"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CameraCapture } from "./CameraCapture";
import { LocationPicker } from "./LocationPicker";
import { reportSchema, type ReportFormData } from "@/features/reports/reportSchema";

interface ReportFormProps {
  onSubmit: (data: ReportFormData) => void | Promise<void>;
}

export function ReportForm({ onSubmit }: ReportFormProps) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const form = useForm<ReportFormData>({ resolver: zodResolver(reportSchema), defaultValues: { category: "pothole" } });
  const selectedCategory = form.watch("category");
  const submit = form.handleSubmit((data) => onSubmit({ ...data, photo: photo!, latitude: location!.lat, longitude: location!.lng }));
  return (
    <form onSubmit={submit} noValidate><Card>
      <h1 className="text-lg font-bold text-neutral-900">Buat laporan kerusakan</h1>
      <div className="mt-4"><CameraCapture onCapture={setPhoto} /></div>
      <div className="mt-4"><LocationPicker onLocation={(lat, lng) => setLocation({ lat, lng })} /></div>
      <h2 className="mt-6 text-lg font-bold text-neutral-900">Kategori kerusakan</h2>
      <div className="mt-4 space-y-3">
        {([
          ["pothole", "Jalan berlubang"],
          ["street_light", "Lampu PJU mati"],
          ["other", "Lainnya"],
        ] as const).map(([value, label]) => (
          <Button key={value} type="button" variant={selectedCategory === value ? "primary" : "secondary"} className="w-full text-left" onClick={() => form.setValue("category", value, { shouldValidate: true })}>
            {label}
          </Button>
        ))}
      </div>
      {form.formState.errors.category && <p className="mt-2 text-sm text-danger-700">{form.formState.errors.category.message}</p>}
      <Button type="submit" className="mt-6 w-full" disabled={form.formState.isSubmitting}>Kirim laporan</Button>
    </Card></form>
  );
}
