"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, ChartNoAxesColumn, LockKeyhole, Save, Settings, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { apiClient } from "@/lib/apiClient";
import { useAuthStore } from "@/features/auth/authStore";
import { updatePassword, updateProfile, uploadAvatar, checkUsernameAvailable } from "@/features/auth/authApi";

type Weights = { severity: number; reporters: number; roadClass: number; criticalFacility: number; age: number };
type Config = { priority: Weights; clusteringRadiusMeters: number };
type Feedback = { type: "ok" | "err"; text: string } | null;

const labels: Record<keyof Weights, string> = {
  severity: "Tingkat keparahan", reporters: "Pelapor unik", roadClass: "Kelas jalan", criticalFacility: "Fasilitas kritis", age: "Umur tiket",
};
const input = "mt-1.5 min-h-11 w-full rounded-xl border border-neutral-300 bg-neutral-0 px-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:border-accent-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/25";
const inputError = "mt-1.5 min-h-11 w-full rounded-xl border border-danger-600 bg-danger-50 px-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:border-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-600/25";

const profileSchema = z.object({
  username: z.string().min(1, "Username belum diisi").min(3, "Username minimal 3 karakter").max(40, "Username maksimal 40 karakter").regex(/^[a-zA-Z0-9_-]+$/, "Hanya huruf, angka, dan tanda hubung."),
  name: z.string().min(1, "Nama belum diisi").min(2, "Nama minimal 2 karakter"),
});
const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Password saat ini wajib diisi"),
  password: z.string().min(1, "Password baru belum diisi").min(8, "Password minimal 8 karakter"),
  confirmPassword: z.string().min(1, "Konfirmasi password belum diisi"),
}).refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Password tidak sama." });
type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

function showFieldError(message?: string) {
  return message ? <p className="text-xs leading-snug text-danger-700">{message}</p> : null;
}

function FeedbackBanner({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return <div role={feedback.type === "err" ? "alert" : "status"} className={`mt-5 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${feedback.type === "ok" ? "border-success-600 bg-success-50 text-success-700" : "border-danger-600 bg-danger-50 text-danger-700"}`}>
    <span aria-hidden="true" className="font-bold">{feedback.type === "ok" ? "✓" : "!"}</span><span>{feedback.text}</span>
  </div>;
}

async function getConfig(): Promise<Config> {
  const r = await apiClient.get<{ data: { weights?: Record<string, number>; clustering_radius_meters?: number } | null }>("/admin/configuration");
  const c = r.data.data;
  return { priority: { severity: c?.weights?.severity ?? 30, reporters: c?.weights?.reporters ?? 20, roadClass: c?.weights?.road_class ?? 20, criticalFacility: c?.weights?.proximity ?? 15, age: c?.weights?.age ?? 15 }, clusteringRadiusMeters: c?.clustering_radius_meters ?? 20 };
}

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const profileForm = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), mode: "onChange", defaultValues: { username: user?.username ?? "", name: user?.name ?? "" } });
  const passwordForm = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema), mode: "onChange" });
  const watchedUsername = profileForm.watch("username");
  useEffect(() => {
    const trimmed = watchedUsername.trim();
    if (!/^[a-zA-Z0-9_-]{3,40}$/.test(trimmed) || trimmed === user?.username) {
      if (profileForm.formState.errors.username?.type === "taken") profileForm.clearErrors("username");
      return;
    }
    const t = setTimeout(() => {
      void checkUsernameAvailable(trimmed).then((available) => {
        if (available) profileForm.clearErrors("username");
        else profileForm.setError("username", { type: "taken", message: "Username sudah digunakan." });
      });
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedUsername]);

  const configQuery = useQuery({ queryKey: ["priority-settings"], queryFn: getConfig, enabled: isAdmin });
  const profile = useMutation({
    mutationFn: (values: ProfileValues) => updateProfile(values.username, values.name),
    onSuccess: (r) => { setAuth(r.user); setFeedback({ type: "ok", text: "Profil berhasil diperbarui." }); void queryClient.invalidateQueries({ queryKey: ["me"] }); },
    onError: (e) => setFeedback({ type: "err", text: e instanceof Error ? e.message : "Gagal menyimpan profil." }),
  });
  const pwd = useMutation({
    mutationFn: (values: PasswordValues) => updatePassword(values.currentPassword, values.password, values.confirmPassword),
    onSuccess: () => { passwordForm.reset(); setFeedback({ type: "ok", text: "Password berhasil diubah." }); },
    onError: (e) => setFeedback({ type: "err", text: e instanceof Error ? e.message : "Gagal mengubah password." }),
  });
  const avatar = useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
    onSuccess: (r) => { setAuth(r.user); setAvatarFile(null); setAvatarPreview(null); if (fileRef.current) fileRef.current.value = ""; setFeedback({ type: "ok", text: "Foto profil berhasil diperbarui." }); void queryClient.invalidateQueries({ queryKey: ["me"] }); },
    onError: (e) => setFeedback({ type: "err", text: e instanceof Error ? e.message : "Gagal mengunggah foto." }),
  });
  const saveConfig = useMutation({
    mutationFn: (value: Config) => apiClient.put("/admin/configuration", { weights: { severity: value.priority.severity, reporters: value.priority.reporters, road_class: value.priority.roadClass, proximity: value.priority.criticalFacility, age: value.priority.age }, clustering_radius_meters: value.clusteringRadiusMeters }).then(() => undefined),
    onSuccess: () => { setFeedback({ type: "ok", text: "Pengaturan prioritas berhasil disimpan." }); void queryClient.invalidateQueries({ queryKey: ["priority-settings"] }); },
    onError: (e) => setFeedback({ type: "err", text: e instanceof Error ? e.message : "Gagal menyimpan pengaturan." }),
  });
  const current = config ?? configQuery.data;

  function chooseAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    if (!file.type.startsWith("image/")) { setFeedback({ type: "err", text: "File foto harus berupa gambar." }); return; }
    if (file.size > 2_097_152) { setFeedback({ type: "err", text: "Ukuran foto maksimal 2 MB." }); return; }
    setFeedback(null); setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file));
  }
  function submitProfile(values: ProfileValues) {
    setFeedback(null);
    profile.mutate(values);
  }
  function submitPassword(values: PasswordValues) {
    setFeedback(null);
    pwd.mutate(values);
  }

  return <main className="absolute inset-0 overflow-y-auto bg-neutral-50 px-3 py-6 pb-24 text-neutral-700 sm:px-4 md:pb-6 lg:px-5"><div className="w-full">
    <header className="relative overflow-hidden rounded-2xl bg-primary-800 px-6 py-7 text-neutral-0 sm:px-8">
      <div className="absolute -right-8 -top-8 size-32 rounded-full bg-primary-700/60" aria-hidden="true" />
      <div className="absolute -bottom-10 right-16 size-24 rounded-full bg-accent-600/30" aria-hidden="true" />
      <div className="relative"><p className="flex items-center gap-2 text-sm font-medium text-primary-100"><Settings className="size-4" /> Pengaturan</p><h1 className="mt-1.5 text-2xl font-bold tracking-tight">Kelola akun Anda</h1><p className="mt-1 text-sm text-primary-100/80">Perbarui foto, profil, dan password dari satu tempat.</p></div>
    </header>
    <FeedbackBanner feedback={feedback} />

    <section className="mt-5 space-y-5" aria-label="Pengaturan akun">
      <Card className="p-6">
        <h2 className="flex items-center gap-2 text-base font-bold text-neutral-900"><Camera className="size-5 text-primary-800" />Foto profil</h2>
        <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row">
          <div className="relative flex shrink-0">
            <span className="flex size-24 items-center justify-center overflow-hidden rounded-full border-4 border-primary-100 bg-primary-50 text-2xl font-bold text-primary-800 shadow-sm ring-4 ring-accent-500/20">
              {avatarPreview ? <img src={avatarPreview} alt="" className="size-24 object-cover" /> : user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="size-24 object-cover" /> : user?.name.charAt(0).toUpperCase() ?? "?"}
            </span>
            <button type="button" onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 flex size-9 items-center justify-center rounded-full border-2 border-neutral-0 bg-primary-800 text-neutral-0 shadow-md transition-colors hover:bg-primary-700" aria-label="Ganti foto profil"><Camera className="size-4" /></button>
          </div>
          <div className="w-full text-center sm:text-left">
            <p className="text-sm font-semibold text-neutral-900">{user?.name}</p>
            <p className="mt-0.5 text-xs text-neutral-500">@{user?.username}</p>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={chooseAvatar} />
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>{avatarFile ? "Ganti foto" : "Pilih foto"}</Button>
              <Button type="button" disabled={!avatarFile || avatar.isPending} onClick={() => avatarFile && avatar.mutate(avatarFile)}>{avatar.isPending ? "Mengunggah..." : "Simpan foto"}</Button>
            </div>
            {avatarFile && <p className="mt-2 text-xs text-neutral-500">File dipilih: {avatarFile.name}</p>}
            <p className="mt-1.5 text-xs text-neutral-500">JPG/PNG/WEBP, maksimal 2 MB.</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-6">
        <h2 className="flex items-center gap-2 text-base font-bold text-neutral-900"><UserRound className="size-5 text-primary-800" />Profil</h2>
        <form className="mt-5 space-y-4" onSubmit={profileForm.handleSubmit(submitProfile)} noValidate>
          <div><label htmlFor="settings-username" className="text-sm font-medium text-neutral-900">Username</label><input id="settings-username" placeholder="Masukkan username, mis. johndoe" className={profileForm.formState.errors.username ? inputError : input} aria-invalid={!!profileForm.formState.errors.username} aria-describedby={profileForm.formState.errors.username ? "settings-username-error" : undefined} {...profileForm.register("username")} />{showFieldError(profileForm.formState.errors.username?.message)}<p className="mt-1.5 text-xs text-neutral-500">Minimal 3 karakter, hanya huruf, angka, dan tanda hubung.</p></div>
          <div><label htmlFor="settings-name" className="text-sm font-medium text-neutral-900">Nama lengkap</label><input id="settings-name" placeholder="Masukkan nama lengkap" className={profileForm.formState.errors.name ? inputError : input} aria-invalid={!!profileForm.formState.errors.name} aria-describedby={profileForm.formState.errors.name ? "settings-name-error" : undefined} {...profileForm.register("name")} />{showFieldError(profileForm.formState.errors.name?.message)}<p className="mt-1.5 text-xs text-neutral-500">Nama ini ditampilkan pada profil dan riwayat laporan.</p></div>
          <Button type="submit" disabled={profile.isPending}>{profile.isPending ? "Menyimpan..." : "Simpan profil"}</Button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="flex items-center gap-2 text-base font-bold text-neutral-900"><LockKeyhole className="size-5 text-primary-800" />Ubah password</h2>
        <form className="mt-5 space-y-4" onSubmit={passwordForm.handleSubmit(submitPassword)} noValidate>
          <div><label htmlFor="settings-current-password" className="text-sm font-medium text-neutral-900">Password saat ini</label><input id="settings-current-password" type="password" placeholder="Masukkan password saat ini" className={passwordForm.formState.errors.currentPassword ? inputError : input} aria-invalid={!!passwordForm.formState.errors.currentPassword} aria-describedby={passwordForm.formState.errors.currentPassword ? "settings-current-password-error" : undefined} {...passwordForm.register("currentPassword")} />{showFieldError(passwordForm.formState.errors.currentPassword?.message)}</div>
          <div><label htmlFor="settings-new-password" className="text-sm font-medium text-neutral-900">Password baru</label><input id="settings-new-password" type="password" placeholder="Minimal 8 karakter" className={passwordForm.formState.errors.password ? inputError : input} aria-invalid={!!passwordForm.formState.errors.password} aria-describedby={passwordForm.formState.errors.password ? "settings-new-password-error" : undefined} {...passwordForm.register("password")} />{showFieldError(passwordForm.formState.errors.password?.message)}</div>
          <div><label htmlFor="settings-confirm-password" className="text-sm font-medium text-neutral-900">Konfirmasi password baru</label><input id="settings-confirm-password" type="password" placeholder="Ulangi password baru" className={passwordForm.formState.errors.confirmPassword ? inputError : input} aria-invalid={!!passwordForm.formState.errors.confirmPassword} aria-describedby={passwordForm.formState.errors.confirmPassword ? "settings-confirm-password-error" : undefined} {...passwordForm.register("confirmPassword")} />{showFieldError(passwordForm.formState.errors.confirmPassword?.message)}</div>
          <Button type="submit" disabled={pwd.isPending}>{pwd.isPending ? "Menyimpan..." : "Ubah password"}</Button>
        </form>
      </Card>
      </div>
    </section>

    {isAdmin && <section className="mt-5" aria-label="Pengaturan prioritas">
      {configQuery.isLoading && <Card className="p-6"><Skeleton className="h-6 w-56" /><Skeleton className="mt-4 h-56" /></Card>}
      {configQuery.isError && <Card className="p-6"><ErrorState message={configQuery.error.message} onRetry={() => void configQuery.refetch()} /></Card>}
      {current && <Card className="p-6"><h2 className="flex items-center gap-2 text-base font-bold text-neutral-900"><ChartNoAxesColumn className="size-5 text-primary-800" />Bobot skor prioritas</h2><p className="mt-1 text-sm text-neutral-500">Menentukan urutan tiket di dashboard. Perubahan dicatat dalam audit.</p><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{(Object.keys(labels) as (keyof Weights)[]).map((key) => <div key={key}><label htmlFor={`settings-weight-${key}`} className="text-sm font-medium text-neutral-900">{labels[key]}</label><input id={`settings-weight-${key}`} type="number" min="0" max="100" placeholder="0" value={current.priority[key]} onChange={(e) => setConfig({ ...current, priority: { ...current.priority, [key]: Number(e.target.value) } })} className={input} /></div>)}</div><div className="mt-5 rounded-xl border border-accent-500/40 bg-accent-50 p-4"><label htmlFor="settings-radius" className="text-sm font-medium text-neutral-900">Radius clustering (meter)</label><input id="settings-radius" type="number" min="15" max="25" placeholder="20" value={current.clusteringRadiusMeters} onChange={(e) => setConfig({ ...current, clusteringRadiusMeters: Number(e.target.value) })} className={input} /><p className="mt-1.5 text-sm text-neutral-600">Rentang yang diizinkan: 15–25 meter. Laporan dalam radius ini digabungkan ke tiket yang sama.</p></div><Button type="button" className="mt-5" disabled={saveConfig.isPending} onClick={() => current.clusteringRadiusMeters < 15 || current.clusteringRadiusMeters > 25 ? setFeedback({ type: "err", text: "Radius harus 15–25 meter." }) : saveConfig.mutate(current)}>{saveConfig.isPending ? "Menyimpan..." : "Simpan pengaturan"}</Button></Card>}
    </section>}
  </div></main>;
}
