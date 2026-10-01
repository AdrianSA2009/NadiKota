import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

type ApiErrorResponse = { error?: { message?: string; details?: Record<string, string[]> }; errors?: Record<string, string[]> };

let csrfPromise: Promise<void> | null = null;

export function ensureCsrfCookie(): Promise<void> {
	if (typeof window === "undefined") return Promise.resolve();
	csrfPromise ??= axios.get("/sanctum/csrf-cookie", { withCredentials: true }).then(() => undefined);
	return csrfPromise;
}

export const apiClient = axios.create({
	baseURL: "/api/v1",
	timeout: 15_000,
	headers: { Accept: "application/json" },
	withCredentials: true,
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
	if (typeof document === "undefined") return config;

	const readXsrf = () =>
		document.cookie
			.split("; ")
			.find((item) => item.trim().startsWith("XSRF-TOKEN="))
			?.split("=")[1];

	let csrfToken = readXsrf();
	// cookie bisa habis di tab baru — ambil dulu sebelum POST (stateful origin wajib CSRF)
	if (!csrfToken && (config.method ?? "get").toUpperCase() !== "GET") {
		await ensureCsrfCookie();
		csrfToken = readXsrf();
	}

	if (csrfToken) config.headers["X-XSRF-TOKEN"] = decodeURIComponent(csrfToken);
	return config;
});

apiClient.interceptors.response.use(
	(response) => response,
	(error: AxiosError<ApiErrorResponse>) => {
		const err = new Error(
			error.response?.data?.error?.message ?? "Permintaan gagal. Coba lagi.",
		) as Error & { status?: number; fields?: Record<string, string[]> };
		err.status = error.response?.status;
		// Renderer backend memakai error.details (key camelCase) — normalkan ke snake_case untuk field form.
		const details = error.response?.data?.error?.details ?? error.response?.data?.errors;
		err.fields = details
			? Object.fromEntries(Object.entries(details).map(([key, value]) => [key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), value]))
			: undefined;
		return Promise.reject(err);
	},
);