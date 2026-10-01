"use client";

import { useEffect } from "react";
import PetaPage from "../peta/page";
import { useTukarPoinPanel } from "@/lib/tukarPoinPanelStore";

export default function TukarPoinPage() {
  const openPanel = useTukarPoinPanel((s) => s.openPanel);

  useEffect(() => {
    openPanel();
  }, [openPanel]);

  return <PetaPage />;
}
