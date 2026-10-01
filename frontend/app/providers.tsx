"use client";

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useEffect, useState, type PropsWithChildren } from "react";
import { fetchMe } from "@/features/auth/authApi";
import { useAuthStore } from "@/features/auth/authStore";

function AuthHydrator({ children }: PropsWithChildren) {
  const setAuth = useAuthStore((s) => s.setAuth);
  const logout = useAuthStore((s) => s.logout);
  const setInitialized = useAuthStore((s) => s.setInitialized);
  const { data, isSuccess, isError } = useQuery({ queryKey: ["me"], queryFn: fetchMe, staleTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: false });
  // Hanya hasil /me (null = 401) yang boleh menghapus sesi — error jaringan tidak.
  useEffect(() => { if (isSuccess) { if (data) setAuth(data); else logout(); } }, [isSuccess, data, setAuth, logout]);
  useEffect(() => { if (isSuccess || isError) setInitialized(); }, [isSuccess, isError, setInitialized]);
  return <>{children}</>;
}

/** Cegah double/spam click pada semua tombol: klik kedua pada elemen yang sama dalam 500ms diabaikan. */
function useDoubleClickGuard() {
  useEffect(() => {
    const last = new WeakMap<Element, number>();
    const THROTTLE_MS = 500;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest?.('button, [role="button"], input[type="submit"], input[type="button"]');
      if (!btn) return;
      const now = Date.now();
      const prev = last.get(btn);
      if (prev !== undefined && now - prev < THROTTLE_MS) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      last.set(btn, now);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
}

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false }, mutations: { retry: 0 } } }));
  useDoubleClickGuard();
  return <QueryClientProvider client={queryClient}><AuthHydrator>{children}</AuthHydrator></QueryClientProvider>;
}
