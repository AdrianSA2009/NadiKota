import { cookies } from "next/headers";

/**
 * True bila browser tidak punya cookie petunjuk login `nk_auth` → pengunjung publik.
 * Cookie berisi role (diset saat login, dihapus saat logout — lihat authStore).
 */
export type AuthHint = { publicVisitor: boolean; roleHint: string | null };

export async function getAuthHint(): Promise<AuthHint> {
  const raw = (await cookies()).get("nk_auth")?.value;
  if (!raw) return { publicVisitor: true, roleHint: null };
  // Nilai "1" = format lama (role tak diketahui) → hanya bisa pasrah ke cek /me.
  return { publicVisitor: false, roleHint: raw === "1" ? null : decodeURIComponent(raw) };
}

export async function isPublicVisitor(): Promise<boolean> {
  return (await getAuthHint()).publicVisitor;
}
