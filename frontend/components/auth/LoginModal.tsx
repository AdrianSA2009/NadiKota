"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { roleHome } from "@/lib/roleHome";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Gift, LockKeyhole, MapPin, Radar, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { loginWithPassword, registerUser, checkUsernameAvailable } from "@/features/auth/authApi";
import { useAuthStore } from "@/features/auth/authStore";

const loginSchema = z.object({
  username: z.string().min(1, "Username belum diisi"),
  password: z.string().min(1, "Password belum diisi"),
});
const registerSchema = z.object({
  username: z.string().min(1, "Username belum diisi").min(3, "Username minimal 3 karakter").max(40, "Username maksimal 40 karakter").regex(/^[a-zA-Z0-9_-]+$/, "Hanya huruf, angka, dan tanda hubung."),
  name: z.string().min(1, "Nama belum diisi").min(2, "Nama minimal 2 karakter"),
  password: z.string().min(1, "Password belum diisi").min(8, "Password minimal 8 karakter"),
  confirmPassword: z.string().min(1, "Konfirmasi password belum diisi"),
}).refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Password tidak sama." });
type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

const fieldInput = (hasError: boolean) => `min-h-11 w-full rounded-lg border px-3 text-base md:min-h-12 md:px-4 ${hasError ? "border-danger-600 bg-danger-50 focus-visible:border-danger-600 focus-visible:ring-2 focus-visible:ring-danger-600/25" : "border-neutral-300 focus-visible:border-accent-500"}`;

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path fill="#4285F4" d="M21.35 12.27c0-.72-.06-1.42-.18-2.09H12v3.96h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.26Z" />
      <path fill="#34A853" d="M12 21.7c2.63 0 4.84-.87 6.45-2.37l-3.14-2.45c-.87.58-1.98.93-3.31.93-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 21.7Z" />
      <path fill="#FBBC05" d="M6.54 13.78a5.85 5.85 0 0 1 0-3.56V7.69H3.3a9.75 9.75 0 0 0 0 8.62l3.24-2.53Z" />
      <path fill="#EA4335" d="M12 6.19c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.83 3.29 14.63 2.3 12 2.3a9.74 9.74 0 0 0-8.7 5.39l3.24 2.53C7.31 7.91 9.46 6.19 12 6.19Z" />
    </svg>
  );
}

export function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [registerMode, setRegisterMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setAuth = useAuthStore((s) => s.setAuth);
  const loginForm = useForm<LoginValues>({ resolver: zodResolver(loginSchema), mode: "onChange" });
  const registerForm = useForm<RegisterValues>({ resolver: zodResolver(registerSchema), mode: "onChange" });
  const watchedRegUsername = registerForm.watch("username");
  useEffect(() => {
    const trimmed = watchedRegUsername?.trim() ?? "";
    if (!/^[a-zA-Z0-9_-]{3,40}$/.test(trimmed)) {
      if (registerForm.formState.errors.username?.type === "taken") registerForm.clearErrors("username");
      return;
    }
    const t = setTimeout(() => {
      void checkUsernameAvailable(trimmed).then((available) => {
        if (available) registerForm.clearErrors("username");
        else registerForm.setError("username", { type: "taken", message: "Username sudah digunakan." });
      });
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedRegUsername]);
  const submittingRef = useRef(false);
  const router = useRouter();
  if (!open) return null;

  function showFieldError(message?: string) {
    return message ? <p className="text-xs leading-snug text-danger-700">{message}</p> : null;
  }

  async function submitLogin(values: LoginValues) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    try { const res = await loginWithPassword(values.username, values.password); setAuth(res.user); router.push(roleHome(res.user.role)); }
    catch (e) { setError(e instanceof Error ? e.message : "Masuk gagal."); }
    finally { submittingRef.current = false; }
  }

  async function submitRegister(values: RegisterValues) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    try { const res = await registerUser(values.username, values.name, values.password, values.confirmPassword); setAuth(res.user); router.push(roleHome(res.user.role)); }
    catch (e) { setError(e instanceof Error ? e.message : "Registrasi gagal."); }
    finally { submittingRef.current = false; }
  }

  function googleLogin() { window.location.assign("/api/v1/auth/google/redirect"); }

  const heroPoints = [
    { icon: MapPin, text: "Titik masalah terpetakan jelas di peta" },
    { icon: Radar, text: "Laporan dilacak sampai tuntas" },
    { icon: Gift, text: "Poin kontribusi bisa ditukar hadiah" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 md:flex-row">
      {/* Hero kiri — desktop saja */}
      <aside className="hidden bg-gradient-to-br from-primary-900 via-primary-800 to-accent-700 p-10 text-neutral-0 md:flex md:w-[46%] md:max-w-2xl md:flex-col md:justify-between lg:p-14">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-neutral-0 text-sm font-black text-primary-800 shadow-md" aria-hidden="true">N</span>
          <span className="text-lg font-bold">NadiKota</span>
        </div>
        <div>
          <h1 className="text-3xl font-bold leading-snug lg:text-4xl">Kota lebih tanggap, mulai dari laporanmu.</h1>
          <p className="mt-3 max-w-md text-sm text-neutral-0/80 lg:text-base">
            Laporkan masalah kota, pantau progresnya, dan raih poin dari setiap kontribusi.
          </p>
          <ul className="mt-8 space-y-3.5 text-sm">
            {heroPoints.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-0/15">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-neutral-0/60">© NadiKota · Data peta © OpenStreetMap</p>
      </aside>

      {/* Kolom kanan: tombol kembali di pojok, kartu form dibenahi di tengah */}
      <div className="relative flex flex-1 flex-col">
        {/* Latar dekoratif: dot grid + blob lembut */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -right-28 -top-24 size-72 rounded-full bg-accent-100 blur-3xl md:size-96" />
          <div className="absolute -bottom-36 -left-20 size-80 rounded-full bg-primary-100 blur-3xl md:size-[28rem]" />
          <div className="absolute inset-0 bg-[radial-gradient(rgb(203_213_225)_1.2px,transparent_1.2px)] bg-[size:24px_24px] opacity-40" />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute left-4 top-5 z-20 flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-0 px-3.5 py-2 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-100 md:left-8 md:top-8"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Kembali
        </button>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 px-4 py-14">
        <section className="w-full max-w-sm rounded-3xl border border-neutral-200 bg-neutral-0 p-6 shadow-xl sm:p-8 md:max-w-md md:p-9">
          <div className="flex flex-col items-center text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-primary-700 to-accent-600 text-neutral-0 shadow-lg md:size-16">
              {registerMode ? <UserPlus className="size-7 md:size-8" aria-hidden="true" /> : <LockKeyhole className="size-7 md:size-8" aria-hidden="true" />}
            </span>
            <h2 className="mt-4 text-2xl font-bold text-neutral-900 md:mt-5 md:text-3xl">{registerMode ? "Buat Akun" : "Masuk ke NadiKota"}</h2>
            <p className="mt-1.5 text-sm text-neutral-500 md:mt-2 md:text-base">{registerMode ? "Mulai raih poin kontribusi Anda." : "Masuk untuk mulai berkontribusi."}</p>
          </div>
        {error && <div className="mt-4"><ErrorState message={error} /></div>}
        <div key={registerMode ? "register" : "login"} className="mt-5 animate-in slide-in-from-left duration-300 md:mt-7 md:space-y-1">
          {registerMode ? (
            <form onSubmit={registerForm.handleSubmit(submitRegister)} className="space-y-3 md:space-y-4" noValidate>
              <div className="space-y-2">
                <label htmlFor="reg-username" className="text-sm font-medium text-neutral-900">Username</label>
                <input id="reg-username" placeholder="Masukkan username" className={fieldInput(!!registerForm.formState.errors.username)} aria-invalid={!!registerForm.formState.errors.username} {...registerForm.register("username")} />
                {showFieldError(registerForm.formState.errors.username?.message)}
              </div>
              <div className="space-y-2">
                <label htmlFor="reg-name" className="text-sm font-medium text-neutral-900">Nama lengkap</label>
                <input id="reg-name" placeholder="Nama lengkap" className={fieldInput(!!registerForm.formState.errors.name)} aria-invalid={!!registerForm.formState.errors.name} {...registerForm.register("name")} />
                {showFieldError(registerForm.formState.errors.name?.message)}
              </div>
              <div className="space-y-2">
                <label htmlFor="reg-password" className="text-sm font-medium text-neutral-900">Password</label>
                <input id="reg-password" type="password" placeholder="Masukkan password" className={fieldInput(!!registerForm.formState.errors.password)} aria-invalid={!!registerForm.formState.errors.password} {...registerForm.register("password")} />
                {showFieldError(registerForm.formState.errors.password?.message)}
              </div>
              <div className="space-y-2">
                <label htmlFor="reg-confirm" className="text-sm font-medium text-neutral-900">Konfirmasi password</label>
                <input id="reg-confirm" type="password" placeholder="Ulangi password" className={fieldInput(!!registerForm.formState.errors.confirmPassword)} aria-invalid={!!registerForm.formState.errors.confirmPassword} {...registerForm.register("confirmPassword")} />
                {showFieldError(registerForm.formState.errors.confirmPassword?.message)}
              </div>
              <Button type="submit" className="w-full" disabled={registerForm.formState.isSubmitting}>{registerForm.formState.isSubmitting ? "Memproses..." : "Daftar"}</Button>
            </form>
          ) : (
            <form onSubmit={loginForm.handleSubmit(submitLogin)} className="space-y-3 md:space-y-4" noValidate>
              <div className="space-y-2">
                <label htmlFor="login-username" className="text-sm font-medium text-neutral-900">Username</label>
                <input id="login-username" placeholder="Masukkan username" autoComplete="username" className={fieldInput(!!loginForm.formState.errors.username)} aria-invalid={!!loginForm.formState.errors.username} {...loginForm.register("username")} />
                {showFieldError(loginForm.formState.errors.username?.message)}
              </div>
              <div className="space-y-2">
                <label htmlFor="login-password" className="text-sm font-medium text-neutral-900">Password</label>
                <input id="login-password" type="password" placeholder="Masukkan password" autoComplete="current-password" className={fieldInput(!!loginForm.formState.errors.password)} aria-invalid={!!loginForm.formState.errors.password} {...loginForm.register("password")} />
                {showFieldError(loginForm.formState.errors.password?.message)}
              </div>
              <Button type="submit" className="w-full" disabled={loginForm.formState.isSubmitting}><LockKeyhole className="mr-2 inline size-4" />{loginForm.formState.isSubmitting ? "Memproses..." : "Masuk"}</Button>
              <button type="button" onClick={() => { setError(null); setRegisterMode(true); }} className="w-full py-2 text-sm font-semibold text-primary-800">Belum punya akun? Daftar</button>
            </form>
          )}
        </div>
        {!registerMode && <><div className="my-4 flex items-center gap-3 text-xs text-neutral-500"><span className="h-px flex-1 bg-neutral-200" />atau<span className="h-px flex-1 bg-neutral-200" /></div><Button type="button" variant="secondary" onClick={googleLogin} className="flex w-full items-center justify-center gap-2"><GoogleIcon />Masuk dengan Google</Button></>}
        {registerMode && <button type="button" onClick={() => { setError(null); setRegisterMode(false); }} className="mt-3 flex w-full items-center justify-center gap-2 text-sm font-semibold text-primary-800"><ArrowLeft className="size-4" />Kembali ke login</button>}
      </section>
      </main>
      </div>
    </div>
  );
}
