import { create } from "zustand";

type Coords = [number, number][]; // [lng, lat] — hasil OSRM

interface RouteState {
  /** Titik-titik rute aktif (dari MapSearch); null = tidak sedang pakai rute. */
  coords: Coords | null;
  setCoords: (coords: Coords | null) => void;
}

/**
 * Rute aktif di peta — dibaca fitur peringatan suara (jalan berlubang di rute).
 * Dipisah dari state MapSearch supaya hook bisa memantau tanpa lifting prop.
 */
export const useRouteStore = create<RouteState>((set) => ({
  coords: null,
  setCoords: (coords) => set({ coords }),
}));
