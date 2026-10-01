/** Halaman tujuan berdasarkan role setelah login. */
export function roleHome(role: string): string {
  if (role === "admin" || role === "super_admin") return "/dashboard";
  return "/peta";
}
