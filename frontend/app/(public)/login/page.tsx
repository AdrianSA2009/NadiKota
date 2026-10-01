"use client";

import { useRouter } from "next/navigation";
import { LoginModal } from "@/components/auth/LoginModal";
import { RoleRedirect } from "@/components/auth/RoleRedirect";

/** Halaman login/daftar — kontennya komponen LoginModal, tanpa overlay modal. */
export default function LoginPage() {
  const router = useRouter();
  return (
    <main className="min-h-screen bg-neutral-50">
      <RoleRedirect />
      <LoginModal open onClose={() => router.replace("/peta")} />
    </main>
  );
}
