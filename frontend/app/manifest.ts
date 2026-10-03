import type { MetadataRoute } from "next";
import { THEME_COLORS } from "@/lib/theme";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "NadiKota",
		short_name: "NadiKota",
		description: "Laporkan kerusakan infrastruktur di Kota Batam.",
		start_url: "/",
		display: "standalone",
		background_color: THEME_COLORS.neutral[50],
		theme_color: THEME_COLORS.primary[900],
		lang: "id-ID",
		icons: [
			{ src: "/favicon-32.png", sizes: "32x32", type: "image/png" },
			{ src: "/logo-192.png", sizes: "192x192", type: "image/png" },
			{ src: "/logo-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
			{ src: "/logo-favicon.svg", sizes: "any", type: "image/svg+xml" },
		],
	};
}