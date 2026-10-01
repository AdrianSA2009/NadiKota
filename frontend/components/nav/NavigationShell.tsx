"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { BottomNavBar } from "./BottomNavBar";
import { SidebarNav } from "./SidebarNav";
import { LeaveReportConfirm } from "@/components/report/LeaveReportConfirm";
import { Toast } from "@/components/ui/Toast";
import { useKontribusiPanel } from "@/lib/kontribusiPanelStore";

interface NavigationShellProps {
  children: React.ReactNode;
  /** Dari layout server — true = pengunjung publik (tanpa cookie login). */
  publicVisitor?: boolean;
}

export function NavigationShell({ children, publicVisitor = false }: NavigationShellProps) {
  const pathname = usePathname();
  const closePanel = useKontribusiPanel((s) => s.closePanel);

  // Panel Kontribusi berlaku di /peta maupun /kontribusi — tutup hanya saat pindah ke halaman lain.
  // (tanpa cleanup effect: aman dari double-invoke React StrictMode saat mount)
  useEffect(() => {
    if (pathname !== "/peta" && pathname !== "/kontribusi") closePanel();
  }, [pathname, closePanel]);

  return (
    <div className="flex h-dvh flex-col bg-neutral-50 md:flex-row">
      {/* Desktop sidebar */}
      <SidebarNav activePath={pathname} publicVisitor={publicVisitor} />

      {/* Main content area — relative so absolute children (maps) can fill; min-w-0 agar konten bisa memanfaatkan lebar penuh di samping sidebar */}
      <main className="relative min-h-0 min-w-0 flex-1">
        {children}
      </main>

      {/* Mobile bottom bar */}
      <BottomNavBar activePath={pathname} publicVisitor={publicVisitor} />

      {/* Konfirmasi sebelum meninggalkan wizard laporan */}
      <LeaveReportConfirm />

      {/* Toast kanan atas (submit laporan, dll) */}
      <Toast />
    </div>
  );
}
