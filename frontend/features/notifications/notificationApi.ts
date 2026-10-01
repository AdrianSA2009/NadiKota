import { apiClient } from "@/lib/apiClient";

/** Jumlah notifikasi belum dibaca — total + per tipe (untuk badge tab menu). */
export async function getUnreadCount(): Promise<{ count: number; byType: Record<string, number> }> {
  const data = (await apiClient.get<{ count: number; by_type: Record<string, number> }>("/me/notifications/unread-count")).data;
  return { count: data.count, byType: data.by_type ?? {} };
}

/** Tandai semua notifikasi sudah dibaca — opsional spesifik satu tipe. */
export async function markAllNotificationsRead(type?: string): Promise<void> {
  await apiClient.put("/me/notifications/read-all", type ? { type } : {});
}
