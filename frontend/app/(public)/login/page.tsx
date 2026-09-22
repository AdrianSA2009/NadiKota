"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CircleUser, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { requestOtp, verifyOtp } from "@/features/auth/authApi";
import { useAuthStore } from "@/features/auth/authStore";

const phoneSchema = z.object({ phone: z.string().regex(/^\+?[1-9]\d{9,14}$/, "Masukkan nomor telepon yang valid.") });
const otpSchema = z.object({ code: z.string().regex(/^\d{6}$/, "Kode OTP harus terdiri dari 6 angka.") });
type PhoneForm = z.infer<typeof phoneSchema>;
type OtpForm = z.infer<typeof otpSchema>;

export default function LoginPage() {
  const [phone, setPhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const phoneForm = useForm<PhoneForm>({ resolver: zodResolver(phoneSchema) });
  const otpForm = useForm<OtpForm>({ resolver: zodResolver(otpSchema) });

  async function handlePhoneSubmit(values: PhoneForm) {
    setError(null);
    try {
      await requestOtp(values.phone);
      setPhone(values.phone);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Permintaan OTP gagal. Coba lagi.");
    }
  }

  async function handleOtpSubmit(values: OtpForm) {
    if (!phone) return;
    setError(null);
    try {
      const response = await verifyOtp(phone, values.code);
      setAuth(response.user);
      router.push("/");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Kode OTP tidak dapat diverifikasi. Coba lagi.");
    }
  }

  function handleGoogleLogin() {
    const googleUrl = process.env.NEXT_PUBLIC_GOOGLE_AUTH_URL;
    if (googleUrl) window.location.assign(googleUrl);
    else setError("Login Google belum tersedia. Gunakan nomor telepon untuk masuk.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-8 text-neutral-700">
      <section className="w-full max-w-sm rounded-xl border border-neutral-200 bg-neutral-0 p-8 shadow-sm" aria-labelledby="login-title">
        <h1 id="login-title" className="text-xl font-bold text-neutral-900">Masuk ke NadiKota</h1>
        <p className="mt-1 text-sm text-neutral-500">Pilih metode masuk untuk melanjutkan.</p>
        {error && <div className="mt-4"><ErrorState message={error} /></div>}
        <Button type="button" variant="secondary" onClick={handleGoogleLogin} className="mt-6 flex w-full items-center justify-center gap-2">
          <CircleUser className="size-5" aria-hidden="true" /> Masuk dengan Google
        </Button>
        <div className="my-6 flex items-center gap-3 text-xs text-neutral-500"><span className="h-px flex-1 bg-neutral-200" />atau<span className="h-px flex-1 bg-neutral-200" /></div>
        {!phone ? (
          <form onSubmit={phoneForm.handleSubmit(handlePhoneSubmit)} noValidate>
            <label htmlFor="phone" className="text-sm font-medium text-neutral-900">Nomor telepon</label>
            <div className="mt-2"><input id="phone" type="tel" autoComplete="tel" placeholder="+628123456789" className="min-h-11 w-full rounded-lg border border-neutral-300 bg-neutral-0 px-3 text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2" aria-invalid={Boolean(phoneForm.formState.errors.phone)} aria-describedby="phone-error" {...phoneForm.register("phone")} /></div>
            {phoneForm.formState.errors.phone && <p id="phone-error" className="mt-1 text-sm text-danger-700">{phoneForm.formState.errors.phone.message}</p>}
            <Button type="submit" className="mt-4 w-full" disabled={phoneForm.formState.isSubmitting}><Send className="mr-2 inline size-5" aria-hidden="true" />Kirim kode OTP</Button>
          </form>
        ) : (
          <form onSubmit={otpForm.handleSubmit(handleOtpSubmit)} noValidate>
            <label htmlFor="code" className="text-sm font-medium text-neutral-900">Kode OTP</label>
            <input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="mt-2 min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2" aria-invalid={Boolean(otpForm.formState.errors.code)} aria-describedby="code-error" {...otpForm.register("code")} />
            {otpForm.formState.errors.code && <p id="code-error" className="mt-1 text-sm text-danger-700">{otpForm.formState.errors.code.message}</p>}
            <Button type="submit" className="mt-4 w-full" disabled={otpForm.formState.isSubmitting}>Verifikasi kode OTP</Button>
            <button type="button" onClick={() => setPhone(null)} className="mt-3 w-full rounded-lg px-4 py-2 text-sm font-semibold text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500">Ganti nomor telepon</button>
          </form>
        )}
      </section>
    </main>
  );
}
