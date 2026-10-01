"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { BATAM_AREAS } from "@/lib/batamAreas";

/**
 * Dropdown lokasi/wilayah dengan pencarian (combobox) berbasis daftar wilayah Batam.
 * - Ketik untuk menyaring (cocok sebagian), pilih dari daftar, atau ketik bebas
 *   (nilai manual tetap diterima — kompatibel dengan data tim lama).
 */
export function DistrictPicker({ id, value, onChange, invalid = false }: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sinkron bila nilai berubah dari luar (mis. form edit selesai dimuat).
  useEffect(() => setQuery(value), [value]);

  // Klik di luar → tutup daftar.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const keyword = query.trim().toLowerCase();
  const filtered = keyword ? BATAM_AREAS.filter((a) => a.toLowerCase().includes(keyword)) : BATAM_AREAS;

  const baseClass = invalid
    ? "mt-1.5 min-h-11 w-full rounded-xl border border-danger-600 bg-danger-50 pl-10 pr-3.5 text-base text-neutral-900 focus-visible:border-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-600/25"
    : "mt-1.5 min-h-11 w-full rounded-xl border border-neutral-300 bg-neutral-0 pl-10 pr-3.5 text-base text-neutral-900 placeholder:text-neutral-400 focus-visible:border-accent-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/25";

  return (
    <div ref={containerRef} className="relative">
      <MapPin className="pointer-events-none absolute left-3.5 top-1/2 mt-0.5 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-autocomplete="list"
        autoComplete="off"
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        placeholder="Cari lokasi / wilayah…"
        className={baseClass}
      />
      {open && filtered.length > 0 && (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          aria-label="Wilayah Kota Batam"
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-60 overflow-y-auto rounded-xl border border-neutral-200 bg-neutral-0 py-1 shadow-lg"
        >
          {filtered.map((area) => (
            <li key={area} role="option" aria-selected={query === area}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault() /* biar blur input tidak menutup sebelum klik */}
                onClick={() => { setQuery(area); onChange(area); setOpen(false); }}
                className={`block w-full px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-primary-50 ${query === area ? "font-semibold text-primary-800" : "text-neutral-700"}`}
              >
                {area}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 rounded-xl border border-neutral-200 bg-neutral-0 px-3.5 py-3 text-sm text-neutral-500 shadow-lg">
          Tidak ada wilayah yang cocok — nilai yang Anda ketik tetap dipakai.
        </div>
      )}
    </div>
  );
}
