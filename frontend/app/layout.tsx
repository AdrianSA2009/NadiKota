import type { Metadata } from "next";
import { AppProviders } from "./providers";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: "NadiKota",
  description: "Pelaporan infrastruktur Kota Batam.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48 32x32 16x16" },
      { url: "/logo-favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/logo-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body><AppProviders><OfflineBanner />{children}</AppProviders></body>
    </html>
  );
}
