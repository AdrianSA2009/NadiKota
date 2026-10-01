import type { PropsWithChildren } from "react";
import { NavigationShell } from "@/components/nav/NavigationShell";
import { StaffRouteGuard } from "@/components/auth/RequireRole";
import { getAuthHint } from "@/lib/publicVisitor";

/**
 * Layout staff (server) — baca cookie petunjuk login+role,
 * pengunjung publik / role tak berhak langsung dapat layar 401 di HTML pertama.
 */
export default async function StaffLayout({ children }: PropsWithChildren) {
  const { publicVisitor, roleHint } = await getAuthHint();

  return (
    <NavigationShell publicVisitor={publicVisitor}>
      <StaffRouteGuard publicVisitor={publicVisitor} roleHint={roleHint}>{children}</StaffRouteGuard>
    </NavigationShell>
  );
}
