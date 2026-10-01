"use client";

import { type PropsWithChildren } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/features/auth/authStore";

/** Layar 404 — meniru tampilan "not found" Next.js. */
export function NotFoundScreen() {
  return (
    <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-neutral-50 px-4 text-center">
      <p className="text-7xl font-black text-neutral-200" aria-hidden="true">401</p>
      <h1 className="mt-2 text-xl font-bold text-neutral-900">Akses Ditolak</h1>
      <p className="mt-2 max-w-sm text-sm text-neutral-500">
        Halaman ini tidak dapat dibuka, Anda tidak memiliki akses untuk membukanya.
      </p>
      <Link
        href="/peta"
        className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-primary-800 px-5 py-2.5 text-sm font-semibold text-neutral-0 hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
      >
        Kembali ke Peta
      </Link>
    </div>
  );
}

interface RequireRoleProps {
  roles: readonly string[];
  /** Dari layout server: true = cookie login absen → pengunjung publik, 401 boleh langsung. Default false = tunggu cek auth. */
  publicVisitor?: boolean;
}

/**
 * Guard role berbasis client state.
 * - Public (dari server) → 401 langsung, bahkan sebelum hasil cek /me keluar
 * - Belum selesai cek auth tapi kemungkinan login → render null (masih loading)
 * - Belum login / role tidak diizinkan → tampilkan 404
 */
export function RequireRole({ roles, publicVisitor = false, children }: PropsWithChildren<RequireRoleProps>) {
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);

  if (!initialized) return publicVisitor ? <NotFoundScreen /> : null;
  if (!user || !roles.includes(user.role)) return <NotFoundScreen />;
  return <>{children}</>;
}

/** Aturan akses halaman staff per jalur URL. Jika role tidak cocok → tampil 404 (bukan 403). */
const ROUTE_ROLES: Array<{ match: RegExp; roles: readonly string[] }> = [
  { match: /^\/dashboard/, roles: ["admin", "super_admin"] },
  { match: /^\/dispatch/, roles: ["admin", "super_admin"] },
  { match: /^\/review/, roles: ["admin", "super_admin"] },
  { match: /^\/settings/, roles: ["citizen", "admin", "super_admin", "field_team"] },
  { match: /^\/teams\//, roles: ["field_team"] },
];

const DEFAULT_ROLES: readonly string[] = ["admin", "super_admin"];

/** Guard per jalur URL — client component, dibungkus layout server pembaca cookie. */
export function StaffRouteGuard({ publicVisitor, roleHint, children }: PropsWithChildren<{ publicVisitor: boolean; roleHint?: string | null }>) {
  const pathname = usePathname();
  const rule = ROUTE_ROLES.find((r) => r.match.test(pathname));
  const roles = rule?.roles ?? DEFAULT_ROLES;

  // Role dari cookie tidak berhak di jalur ini → 401 langsung, tanpa menunggu cek /me.
  if (roleHint && !roles.includes(roleHint)) return <NotFoundScreen />;

  return <RequireRole roles={roles} publicVisitor={publicVisitor}>{children}</RequireRole>;
}
