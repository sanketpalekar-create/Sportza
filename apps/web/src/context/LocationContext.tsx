/**
 * LocationContext — User's resolved location for personalised recommendations.
 *
 * Resolution order (Option 1 — silent GPS):
 *   1. Try GPS on first login (silent, no prompt banner)
 *   2. Reverse-geocode the GPS coords → real city/state (Mappls rev_geocode)
 *   3. If GPS is denied / unavailable → fall back to profile lat/lng + city
 *   4. Result is cached in sessionStorage so we don't re-request mid-session
 *
 * Cache busting:
 *   If the restored cache has source="gps" and valid lat/lng, we silently
 *   re-run reverse-geocode in the background to correct any stale city label.
 *
 * Manual override:
 *   Call setManual(city, state, lat, lng) to let the user pick a different city.
 *   The override is persisted in sessionStorage with source: "manual".
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useCurrentUser } from "@sportza/api-client";
import { reverseGeocode } from "../lib/reverseGeocode";

// ─── Types ──────────────────────────────────────────────────────────────────────

export type LocationSource = "gps" | "profile" | "manual" | "none";

export interface UserLocation {
  lat: number | null;
  lng: number | null;
  city: string | null;
  state: string | null;
  /** How the location was resolved */
  source: LocationSource;
  /** True while the GPS request is in-flight */
  isResolving: boolean;
  /** Manually refresh (re-request GPS) */
  refresh: () => void;
  /** Override with a user-chosen location */
  setManual: (city: string | null, state: string | null, lat?: number | null, lng?: number | null) => void;
}

// ─── Context ────────────────────────────────────────────────────────────────────

const LocationContext = createContext<UserLocation | null>(null);

const SESSION_KEY = "sportza_resolved_location";

// ─── Provider ───────────────────────────────────────────────────────────────────

export function LocationProvider({ children }: { children: ReactNode }) {
  const { data: userData, isLoading: userLoading } = useCurrentUser({ retry: false });

  const user: any = (userData as any)?.user ?? (userData as any) ?? null;
  const isLoggedIn = !!user?.id;

  const [lat,         setLat]         = useState<number | null>(null);
  const [lng,         setLng]         = useState<number | null>(null);
  const [city,        setCity]        = useState<string | null>(null);
  const [stateVal,    setStateVal]    = useState<string | null>(null);
  const [source,      setSource]      = useState<LocationSource>("none");
  const [isResolving, setIsResolving] = useState(false);
  const [attempted,   setAttempted]   = useState(false);

  const persistToSession = useCallback(
    (data: { lat: number | null; lng: number | null; city: string | null; state: string | null; source: LocationSource }) => {
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch { /* ignore */ }
    },
    []
  );

  // Restore a cached result from this session.
  // If the cached source is "gps" and coords are present, silently re-reverse-geocode
  // to correct any stale city label (e.g. profile city stored from a previous session).
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(SESSION_KEY);
      if (!cached) return;

      const parsed = JSON.parse(cached);
      const cachedLat: number | null = parsed.lat ?? null;
      const cachedLng: number | null = parsed.lng ?? null;

      setLat(cachedLat);
      setLng(cachedLng);
      setCity(parsed.city ?? null);
      setStateVal(parsed.state ?? null);
      setSource(parsed.source ?? "none");
      setAttempted(true);

      // If the cached entry has GPS coords, re-geocode in the background
      // to fix a stale city label without blocking the initial render.
      if (parsed.source === "gps" && cachedLat != null && cachedLng != null) {
        reverseGeocode(cachedLat, cachedLng).then(({ city: gc, state: gs }) => {
          if (gc) {
            setCity(gc);
            if (gs) setStateVal(gs);
            persistToSession({ lat: cachedLat, lng: cachedLng, city: gc, state: gs ?? parsed.state ?? null, source: "gps" });
          }
        });
      }
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resolveFromProfile = useCallback((u: any) => {
    const profileLat   = u?.location?.lat   ?? null;
    const profileLng   = u?.location?.lng   ?? null;
    const profileCity  = u?.location?.city  ?? null;
    const profileState = u?.location?.state ?? null;

    const src: LocationSource = profileLat != null ? "profile" : profileCity ? "profile" : "none";
    setLat(profileLat);
    setLng(profileLng);
    setCity(profileCity);
    setStateVal(profileState);
    setSource(src);
    setIsResolving(false);
    setAttempted(true);
    persistToSession({ lat: profileLat, lng: profileLng, city: profileCity, state: profileState, source: src });
  }, [persistToSession]);

  const requestGPS = useCallback((u: any) => {
    if (!navigator.geolocation) {
      resolveFromProfile(u);
      return;
    }

    setIsResolving(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const gpsLat = pos.coords.latitude;
        const gpsLng = pos.coords.longitude;

        // Reverse-geocode to get the real city/state from GPS coords.
        // Falls back to profile city only if the API call fails.
        const { city: gc, state: gs } = await reverseGeocode(gpsLat, gpsLng);
        const resolvedCity  = gc ?? u?.location?.city  ?? null;
        const resolvedState = gs ?? u?.location?.state ?? null;

        const data = { lat: gpsLat, lng: gpsLng, city: resolvedCity, state: resolvedState, source: "gps" as LocationSource };
        setLat(gpsLat);
        setLng(gpsLng);
        setCity(resolvedCity);
        setStateVal(resolvedState);
        setSource("gps");
        setIsResolving(false);
        setAttempted(true);
        persistToSession(data);
      },
      () => {
        // GPS denied — silently fall back to profile location
        resolveFromProfile(u);
      },
      { timeout: 8000, maximumAge: 5 * 60 * 1000, enableHighAccuracy: false }
    );
  }, [resolveFromProfile, persistToSession]);

  // Trigger once when the user object first becomes available
  useEffect(() => {
    if (userLoading || !isLoggedIn || attempted) return;
    setAttempted(true);
    requestGPS(user);
  }, [isLoggedIn, userLoading, attempted, user, requestGPS]);

  // Manual refresh — clears session cache so GPS + reverse-geocode is re-triggered
  const refresh = useCallback(() => {
    setAttempted(false);
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  }, []);

  // Manual override — user explicitly chose a location from search or GPS sheet
  const setManual = useCallback(
    (newCity: string | null, newState: string | null, newLat?: number | null, newLng?: number | null) => {
      const data = {
        lat: newLat ?? null,
        lng: newLng ?? null,
        city: newCity,
        state: newState,
        source: "manual" as LocationSource,
      };
      setLat(data.lat);
      setLng(data.lng);
      setCity(data.city);
      setStateVal(data.state);
      setSource("manual");
      persistToSession(data);
    },
    [persistToSession]
  );

  const value: UserLocation = {
    lat, lng, city, state: stateVal, source, isResolving,
    refresh, setManual,
  };

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────────

export function useUserLocation(): UserLocation {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useUserLocation must be used inside <LocationProvider>");
  return ctx;
}
