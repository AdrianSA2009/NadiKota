"use client";

import { useEffect } from "react";
import PetaPage from "../peta/page";
import { useKontribusiPanel } from "@/lib/kontribusiPanelStore";

/**
 * /kontribusi = halaman peta dengan panel Kontribusi terbuka.
 * Refresh di sini tetap menampilkan Kontribusi (bukan redirect yang membuang state).
 */
export default function KontribusiPage() {
  const openPanel = useKontribusiPanel((s) => s.openPanel);

  useEffect(() => {
    openPanel();
  }, [openPanel]);

  return <PetaPage />;
}
