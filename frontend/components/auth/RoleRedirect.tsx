"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/features/auth/authStore";
import { roleHome } from "@/lib/roleHome";

/**
 * Jika user sudah login (session masih tersimpan) dan membuka halaman
 * guest (/ atau /login), arahkan ke halaman sesuai role-nya.
 */
export function RoleRedirect() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);

  useEffect(() => {
    if (initialized && user) router.replace(roleHome(user.role));
  }, [initialized, user, router]);

  return null;
}
