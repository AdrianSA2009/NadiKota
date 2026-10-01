"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/authStore";
import { getUnreadCount, markAllNotificationsRead } from "./notificationApi";

/** Tipe notifikasi → path menu yang menerima badge merah. */
export const NOTIF_TYPE_PATH: Record<string, string> = {
  ticket_new: "/tickets",
  ticket_assessment: "/review",
  ticket_received: "/teams",
};

/**
 * Badge merah per tab menu — jumlah notifikasi belum dibaca per tipe,
 * polling tiap 30 detik. Klik menu → tandai tipe tsb sudah dibaca.
 */
export function useUnreadBadges() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const countQuery = useQuery({
    queryKey: ["notif-count"],
    queryFn: getUnreadCount,
    enabled: Boolean(user),
    refetchInterval: 30_000,
  });

  const readType = useMutation({
    mutationFn: (type: string) => markAllNotificationsRead(type),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notif-count"] });
    },
  });

  /** Jumlah badge untuk path menu tertentu (0 = tanpa badge). */
  const badgeFor = (path: string): number => {
    const byType = countQuery.data?.byType ?? {};
    return Object.entries(NOTIF_TYPE_PATH)
      .filter(([, p]) => p === path)
      .reduce((sum, [type]) => sum + (byType[type] ?? 0), 0);
  };

  /** Saat menu dibuka → notifikasi tipe tsb (jika ada di path ini) ditandai dibaca. */
  const markPathRead = (path: string) => {
    Object.entries(NOTIF_TYPE_PATH)
      .filter(([, p]) => p === path)
      .forEach(([type]) => {
        if ((countQuery.data?.byType?.[type] ?? 0) > 0) readType.mutate(type);
      });
  };

  return { badgeFor, markPathRead };
}
