import type { NextConfig } from "next";
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // ponytail: origin tunnel quick berubah tiap restart cloudflared — tambah manual
  allowedDevOrigins: ["blond-ann-most-receives.trycloudflare.com"],
  turbopack: {},
  async rewrites() {
    return [
      { source: "/api/:path*", destination: "http://localhost:8000/api/:path*" },
      { source: "/sanctum/:path*", destination: "http://localhost:8000/sanctum/:path*" },
    ];
  },
};

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
})(nextConfig);
