import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

type ApiErrorResponse = { error?: { message?: string } };

export const apiClient = axios.create({
	baseURL: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1`,
	timeout: 15_000,
	headers: { Accept: "application/json" },
	withCredentials: true,
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
	if (typeof document === "undefined") return config;

	const csrfToken = document.cookie
		.split("; ")
		.find((item) => item.trim().startsWith("XSRF-TOKEN="))
		?.split("=")[1];

	if (csrfToken) config.headers["X-XSRF-TOKEN"] = decodeURIComponent(csrfToken);
	return config;
});

apiClient.interceptors.response.use(
	(response) => response,
	(error: AxiosError<ApiErrorResponse>) => {
		if (error.response?.status === 401 && typeof window !== "undefined") {
			window.location.assign("/login");
		}

		return Promise.reject(new Error(
			error.response?.data?.error?.message ?? "Permintaan gagal. Coba lagi.",
		));
	},
);