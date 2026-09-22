import type { Metadata } from "next";
import { AppProviders } from "./providers";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NadiKota", template: "%s | NadiKota" },
  description: "Pelaporan infrastruktur Kota Batam.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body><AppProviders><OfflineBanner />{children}</AppProviders></body>
    </html>
  );
}
