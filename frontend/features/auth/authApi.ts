import { apiClient, ensureCsrfCookie } from "@/lib/apiClient";
import { type User } from "./authStore";

interface AuthResponse { user: User; }
type BackendAuthResponse = { data: AuthResponse };

export async function loginWithPassword(username: string, password: string): Promise<AuthResponse> {
  await ensureCsrfCookie();
  const res = await apiClient.post<BackendAuthResponse>("/auth/login", { username, password });
  return res.data.data;
}

/** Langkah 1 register — kirim OTP ke email; akun dibuat setelah verifikasi. */
export async function registerUser(username: string, name: string, email: string, password: string, passwordConfirmation: string): Promise<{ email: string }> {
  await ensureCsrfCookie();
  const res = await apiClient.post<{ message: string; email: string }>("/auth/register", { username, name, email, password, password_confirmation: passwordConfirmation });
  return { email: res.data.email };
}

/** Langkah 2 register — cocokkan OTP; sukses → sesi langsung aktif. */
export async function verifyRegisterOtp(email: string, otp: string): Promise<AuthResponse> {
  await ensureCsrfCookie();
  const res = await apiClient.post<BackendAuthResponse>("/auth/register/verify", { email, otp });
  return res.data.data;
}

export async function fetchMe(): Promise<User | null> {
  // Endpoint publik: login → user, tamu → 200 { user: null } — tanpa 401 di console,
  // dan sesi valid tetap terbaca walau cookie petunjuk nk_auth pernah terhapus.
  const res = await apiClient.get<{ data: { user: User | null } }>("/auth/session");
  return res.data.data.user;
}

export async function requestOtp(phone: string): Promise<void> {
  await ensureCsrfCookie();
  await apiClient.post("/auth/otp/request", { phone });
}

export async function verifyOtp(phone: string, otp: string): Promise<AuthResponse> {
  await ensureCsrfCookie();
  const res = await apiClient.post<BackendAuthResponse>("/auth/otp/verify", { phone, otp });
  return res.data.data;
}

export async function updateProfile(username: string, name: string, email: string): Promise<AuthResponse> {
  await ensureCsrfCookie();
  const res = await apiClient.put<BackendAuthResponse>("/me/profile", { username, name, email });
  return res.data.data;
}

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  try {
    const res = await apiClient.get<{ data: { available: boolean } }>("/auth/username-available", { params: { username } });
    return res.data.data.available;
  } catch { return true; }
}

export async function checkEmailAvailable(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  try {
    const res = await apiClient.get<{ data: { available: boolean } }>("/auth/email-available", { params: { email: normalized } });
    return res.data.data.available;
  } catch {
    // Server-side registration validation remains authoritative if the hint endpoint fails.
    return true;
  }
}

export async function updatePassword(currentPassword: string, password: string, passwordConfirmation: string): Promise<{ message: string }> {
  await ensureCsrfCookie();
  const res = await apiClient.put("/me/password", { current_password: currentPassword, password, password_confirmation: passwordConfirmation });
  return res.data as { message: string };
}

export async function uploadAvatar(file: File): Promise<AuthResponse> {
  await ensureCsrfCookie();
  const formData = new FormData();
  formData.append("photo", file);
  const res = await apiClient.post<BackendAuthResponse>("/me/avatar", formData, { headers: { "Content-Type": "multipart/form-data" } });
  return res.data.data;
}
