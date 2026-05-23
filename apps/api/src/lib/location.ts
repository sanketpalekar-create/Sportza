import { Client as GoogleMapsClient } from "@googlemaps/google-maps-services-js";
import { prisma } from "./prisma";
import type { LocationInput } from "../schemas/common";

// ─── Active provider: Nominatim (OpenStreetMap) ────────────────────────────────
// Free, no API key required. Used for both forward geocoding (address → lat/lng)
// and is mirrored in apps/api/src/routes/places.ts for search + reverse geocoding.

const NOMINATIM_UA = "Sportza/1.0 (contact@sportza.in)";

async function geocodeNominatim(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(address)}&format=json&addressdetails=0&countrycodes=in&limit=1`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": NOMINATIM_UA },
    });
    if (!res.ok) return null;
    const json = await res.json() as any[];
    const first = Array.isArray(json) ? json[0] : null;
    if (!first) return null;
    const lat = parseFloat(first.lat);
    const lng = parseFloat(first.lon);
    return isNaN(lat) || isNaN(lng) ? null : { lat, lng };
  } catch {
    return null;
  }
}

// ─── Disabled providers (re-enable when API plan is upgraded) ─────────────────
//
// To switch back to Mappls + Google, replace the geocode() body with:
//   return (await geocodeMappls(address)) ?? (await geocodeGoogle(address));
// and uncomment the two functions below.
//
// const googleClient = new GoogleMapsClient({});
//
// async function geocodeGoogle(address: string): Promise<{ lat: number; lng: number } | null> {
//   const apiKey = process.env.GOOGLE_MAPS_API_KEY;
//   if (!apiKey) return null;
//   try {
//     const response = await googleClient.geocode({
//       params: { address, key: apiKey },
//       timeout: 5000,
//     });
//     const result = response.data.results?.[0];
//     if (!result) return null;
//     const { lat, lng } = result.geometry.location;
//     return { lat, lng };
//   } catch {
//     return null;
//   }
// }
//
// async function geocodeMappls(address: string): Promise<{ lat: number; lng: number } | null> {
//   const apiKey = process.env.MAPPLS_API_KEY;
//   if (!apiKey) return null;
//   try {
//     const url = `https://apis.mappls.com/advancedmaps/v1/${apiKey}/geocode?address=${encodeURIComponent(address)}&region=IND`;
//     const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
//     if (!res.ok) return null;
//     const data = await res.json() as any;
//     const result = data.copResults;
//     if (!result?.latitude || !result?.longitude) return null;
//     const lat = parseFloat(result.latitude);
//     const lng = parseFloat(result.longitude);
//     if (isNaN(lat) || isNaN(lng)) return null;
//     return { lat, lng };
//   } catch {
//     return null;
//   }
// }

/**
 * Build a human-readable address string for geocoding from LocationInput fields.
 */
function buildGeoAddress(data: LocationInput): string {
  return [data.address, data.city, data.state, data.country ?? "India"]
    .filter(Boolean)
    .join(", ");
}

/**
 * Geocode an address to lat/lng using the active provider (Nominatim).
 */
async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  return geocodeNominatim(address);
  // To switch provider, replace the line above with:
  // return (await geocodeMappls(address)) ?? (await geocodeGoogle(address));
}

/**
 * Find an existing Location row matching (state, city, pincode) or create one.
 * When lat/lng are absent, attempts to geocode the address via the configured provider.
 * Returns the Location id.
 */
export async function upsertLocation(data: LocationInput): Promise<number> {
  const existing = await prisma.location.findFirst({
    where: {
      country: data.country ?? "India",
      state: data.state,
      city: data.city,
      pincode: data.pincode ?? null,
    },
    select: { id: true, lat: true, lng: true },
  });

  if (existing) {
    const needsCoords = existing.lat === null && data.lat === undefined;
    let resolvedLat = data.lat;
    let resolvedLng = data.lng;

    if (needsCoords) {
      const coords = await geocode(buildGeoAddress(data));
      if (coords) {
        resolvedLat = coords.lat;
        resolvedLng = coords.lng;
      }
    }

    if (resolvedLat !== undefined || resolvedLng !== undefined || data.address !== undefined) {
      await prisma.location.update({
        where: { id: existing.id },
        data: {
          ...(resolvedLat !== undefined ? { lat: resolvedLat } : {}),
          ...(resolvedLng !== undefined ? { lng: resolvedLng } : {}),
          ...(data.address !== undefined ? { address: data.address } : {}),
        },
      });
    }
    return existing.id;
  }

  // New location — geocode if coordinates weren't provided
  let lat = data.lat ?? null;
  let lng = data.lng ?? null;

  if (lat === null) {
    const coords = await geocode(buildGeoAddress(data));
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
    }
  }

  const created = await prisma.location.create({
    data: {
      country: data.country ?? "India",
      state: data.state,
      city: data.city,
      pincode: data.pincode ?? null,
      address: data.address ?? null,
      lat,
      lng,
    },
    select: { id: true },
  });

  return created.id;
}
