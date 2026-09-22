import { apiClient } from "@/lib/apiClient";
import type { User } from "./authStore";

interface AuthResponse {
  user: User;
}

export async function loginWithGoogle(accessToken: string): Promise<AuthResponse> {
  const res = await apiClient.post<AuthResponse>("/auth/google", { access_token: accessToken });
  return res.data;
}

export async function requestOtp(phone: string): Promise<void> {
  await apiClient.post("/auth/otp/request", { phone });
}

export async function verifyOtp(phone: string, code: string): Promise<AuthResponse> {
  const res = await apiClient.post<AuthResponse>("/auth/otp/verify", { phone, code });
  return res.data;
}
