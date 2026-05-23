/**
 * Reverse-geocode a lat/lng coordinate to a city + state.
 * Calls the Sportza backend proxy (/api/places/reverse) which in turn calls
 * the Mappls REST API server-side — avoids CORS restrictions in the browser.
 * Returns { city: null, state: null } on any error so callers can fall back gracefully.
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<{ city: string | null; state: string | null }> {
  try {
    const res = await fetch(`/api/places/reverse?lat=${lat}&lng=${lng}`);
    if (!res.ok) return { city: null, state: null };
    const json = await res.json();
    return {
      city:  json?.city  ?? null,
      state: json?.state ?? null,
    };
  } catch {
    return { city: null, state: null };
  }
}
