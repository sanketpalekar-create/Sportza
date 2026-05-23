export interface PlaceDetails {
  state: string;
  city: string;
  pincode?: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export interface MapEmbedProps {
  lat?: number | null;
  lng?: number | null;
  label?: string;
  height?: string;
  className?: string;
}

export interface PlacesAutocompleteProps {
  onSelect: (details: PlaceDetails) => void;
  placeholder?: string;
  className?: string;
}
