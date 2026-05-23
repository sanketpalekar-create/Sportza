import { useRef, useCallback } from "react";
import { Autocomplete } from "@react-google-maps/api";
import type { PlaceDetails, PlacesAutocompleteProps } from "../types";

function extractAddressComponent(
  components: google.maps.GeocoderAddressComponent[],
  type: string,
  nameType: "long_name" | "short_name" = "long_name"
): string {
  return components.find((c) => c.types.includes(type))?.[nameType] ?? "";
}

export default function PlacesAutocomplete({
  onSelect,
  placeholder = "Search for a place…",
  className = "",
}: PlacesAutocompleteProps) {
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const onLoad = useCallback((ac: google.maps.places.Autocomplete) => {
    autocompleteRef.current = ac;
  }, []);

  const onPlaceChanged = useCallback(() => {
    const ac = autocompleteRef.current;
    if (!ac) return;

    const place = ac.getPlace();
    const components = place.address_components ?? [];
    const geometry = place.geometry;

    const state =
      extractAddressComponent(components, "administrative_area_level_1") ||
      extractAddressComponent(components, "administrative_area_level_2");

    const city =
      extractAddressComponent(components, "locality") ||
      extractAddressComponent(components, "sublocality_level_1") ||
      extractAddressComponent(components, "administrative_area_level_2") ||
      extractAddressComponent(components, "administrative_area_level_3");

    const pincode = extractAddressComponent(components, "postal_code");
    const streetNumber = extractAddressComponent(components, "street_number");
    const route = extractAddressComponent(components, "route");
    const sublocality = extractAddressComponent(components, "sublocality_level_1");
    const address =
      place.formatted_address ??
      [streetNumber, route, sublocality].filter(Boolean).join(", ");

    const lat = geometry?.location?.lat();
    const lng = geometry?.location?.lng();

    onSelect({
      state,
      city,
      pincode: pincode || undefined,
      address: address || undefined,
      lat,
      lng,
    });
  }, [onSelect]);

  const inputClass =
    "w-full rounded-lg border border-white/10 bg-[#1e293b] text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-[#475569]";

  return (
    <Autocomplete
      onLoad={onLoad}
      onPlaceChanged={onPlaceChanged}
      restrictions={{ country: "in" }}
      fields={["address_components", "formatted_address", "geometry"]}
    >
      <input
        type="text"
        placeholder={placeholder}
        className={`${inputClass} ${className}`}
      />
    </Autocomplete>
  );
}

export type { PlaceDetails };
