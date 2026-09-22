"use client";

import { useEffect, useState } from "react";

interface Location {
  latitude: number;
  longitude: number;
}

function getInitial(): { location: Location | null; error: string | null; loading: boolean } {
  if (typeof window === "undefined" || !navigator.geolocation) {
    return { location: null, error: "Geolocation tidak didukung perangkat ini.", loading: false };
  }
  return { location: null, error: null, loading: true };
}

export function useCurrentLocation() {
  const [state, setState] = useState(getInitial);

  useEffect(() => {
    if (state.loading) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setState({ location: { latitude: pos.coords.latitude, longitude: pos.coords.longitude }, error: null, loading: false }),
        (err) => setState({ location: null, error: err.message, loading: false }),
      );
    }
  }, [state.loading]);

  return state;
}
