import { useState } from "react";
import PlacesAutocomplete from "./PlacesAutocomplete";

export interface LocationValue {
  country?: string;
  state: string;
  city: string;
  pincode?: string;
  address?: string;
  lat?: number;
  lng?: number;
}

interface LocationPickerProps {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
  className?: string;
  required?: boolean;
}

export default function LocationPicker({
  value,
  onChange,
  className = "",
  required = false,
}: LocationPickerProps) {
  const [showManual, setShowManual] = useState(false);

  const inputClass =
    "w-full rounded-lg border border-white/10 bg-[#1e293b] text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Search autocomplete */}
      {!showManual && (
        <div>
          <label className="block text-xs font-medium text-[#94A3B8] mb-1">
            Search location {required && <span className="text-red-400">*</span>}
          </label>
          <PlacesAutocomplete
            placeholder="Type a city, area or address…"
            onSelect={(details) => {
              onChange({
                ...value,
                state: details.state || value.state,
                city: details.city || value.city,
                pincode: details.pincode ?? value.pincode,
                address: details.address ?? value.address,
                lat: details.lat,
                lng: details.lng,
              });
            }}
          />
          <button
            type="button"
            onClick={() => setShowManual(true)}
            className="mt-1 text-xs text-blue-400 hover:underline"
          >
            Enter manually instead
          </button>
        </div>
      )}

      {/* Manual fallback — plain text inputs, no external package required */}
      {showManual && (
        <>
          <button
            type="button"
            onClick={() => setShowManual(false)}
            className="text-xs text-blue-400 hover:underline self-start"
          >
            ← Use search
          </button>

          <div>
            <label className="block text-xs font-medium text-[#94A3B8] mb-1">
              State {required && <span className="text-red-400">*</span>}
            </label>
            <input
              type="text"
              value={value.state}
              onChange={(e) => onChange({ ...value, state: e.target.value })}
              placeholder="e.g. Maharashtra"
              required={required}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#94A3B8] mb-1">
              City / District {required && <span className="text-red-400">*</span>}
            </label>
            <input
              type="text"
              value={value.city}
              onChange={(e) => onChange({ ...value, city: e.target.value })}
              placeholder="e.g. Mumbai"
              required={required}
              className={inputClass}
            />
          </div>
        </>
      )}

      {/* Selected location confirmation */}
      {value.state && value.city && (
        <div className="flex items-center gap-1 text-xs text-[#64748B]">
          <span className="text-[#94A3B8]">Selected:</span>
          <span className="text-white">
            {value.city}, {value.state}
          </span>
          {value.lat && value.lng && (
            <span className="ml-auto text-green-500 text-xs">✓ Pinned</span>
          )}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-[#94A3B8] mb-1">Pin Code</label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={value.pincode ?? ""}
          onChange={(e) => onChange({ ...value, pincode: e.target.value })}
          placeholder="6-digit pin code"
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-[#94A3B8] mb-1">Address</label>
        <input
          type="text"
          maxLength={500}
          value={value.address ?? ""}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
          placeholder="Street address, landmark…"
          className={inputClass}
        />
      </div>
    </div>
  );
}
