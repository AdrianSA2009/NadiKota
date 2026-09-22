"use client";

import dynamic from "next/dynamic";

const LocationMap = dynamic(() => import("./LocationMap"), {
  ssr: false,
  loading: () => (
    <div
      className="min-h-80 w-full animate-pulse rounded-xl bg-neutral-200"
      aria-label="Memuat peta"
      role="status"
    />
  ),
});

export default LocationMap;
