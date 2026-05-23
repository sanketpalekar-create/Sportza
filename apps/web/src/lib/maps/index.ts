/**
 * Map Provider Abstraction
 *
 * Active provider: Mappls (MapMyIndia)
 *
 * To switch to Google Maps:
 *   1. Set VITE_MAP_PROVIDER=google in apps/web/.env
 *   2. Change the three import paths below from "./mappls/..." to "./google/..."
 *   3. Add VITE_GOOGLE_MAPS_API_KEY to apps/web/.env
 *
 * Both implementations are fully preserved in their respective subfolders.
 * No other files in the app need to change — all pages import from this file.
 */

// ─── Change these 3 lines to switch providers ─────────────────────────────────
export { MapsProvider } from "./mappls/provider";
export { default as MapEmbed } from "./mappls/MapEmbed";
export { default as PlacesAutocomplete } from "./mappls/PlacesAutocomplete";
// ─────────────────────────────────────────────────────────────────────────────

export type { PlaceDetails, MapEmbedProps, PlacesAutocompleteProps } from "./types";

export const activeMapProvider = (import.meta.env.VITE_MAP_PROVIDER as string | undefined) ?? "mappls";
