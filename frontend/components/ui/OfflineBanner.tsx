"use client";

import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div role="status" className="flex items-center gap-2 border-b border-warning-600 bg-warning-50 px-4 py-3 text-sm text-warning-800">
      <WifiOff className="size-5 shrink-0" aria-hidden="true" />
      Koneksi offline. Data yang ditulis akan disimpan di antrean lokal dan dikirim saat tersambung.
    </div>
  );
}
