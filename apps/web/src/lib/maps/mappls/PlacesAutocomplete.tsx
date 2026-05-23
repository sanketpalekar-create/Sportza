import { useState, useRef, useCallback, useEffect } from "react";
import { MapPin, Loader2, AlertCircle } from "lucide-react";
import type { PlaceDetails, PlacesAutocompleteProps } from "../types";

interface Suggestion {
  eLoc: string;
  placeName: string;
  placeAddress: string;
  latitude: string;
  longitude: string;
  addressTokens?: {
    state?: string;
    city?: string;
    district?: string;
    pincode?: string;
    subLocality?: string;
    locality?: string;
    poi?: string;
  };
}

function useDebouncedCallback<T extends (...args: any[]) => any>(fn: T, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback(
    (...args: Parameters<T>) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => fn(...args), delay);
    },
    [fn, delay]
  );
}

export default function PlacesAutocomplete({
  onSelect,
  placeholder = "Search for a place…",
  className = "",
}: PlacesAutocompleteProps) {
  const [query,      setQuery]      = useState("");
  const [suggestions,setSuggestions]= useState<Suggestion[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [open,       setOpen]       = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    setFetchError(null);
    try {
      // Call backend proxy — avoids CORS issues with direct Mappls fetch
      const res = await fetch(`/api/places/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        setFetchError(`Search unavailable (${res.status})`);
        setSuggestions([]);
        return;
      }
      const json = await res.json();
      const results: Suggestion[] = json?.data ?? [];
      setSuggestions(results);
      if (results.length > 0) setOpen(true);
    } catch {
      setFetchError("Search failed. Check network.");
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedFetch = useDebouncedCallback(fetchSuggestions, 350);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    setFetchError(null);
    if (v.length >= 2) {
      debouncedFetch(v);
    } else {
      setSuggestions([]);
      setOpen(false);
    }
  }

  function handleSelect(s: Suggestion) {
    const tokens = s.addressTokens ?? {};
    const state = tokens.state ?? "";
    const city =
      tokens.city ||
      tokens.district ||
      tokens.locality ||
      tokens.subLocality ||
      "";
    const pincode = tokens.pincode;
    const address = [tokens.poi, s.placeAddress].filter(Boolean).join(", ") || s.placeAddress;
    const lat = s.latitude ? parseFloat(s.latitude) : undefined;
    const lng = s.longitude ? parseFloat(s.longitude) : undefined;

    const details: PlaceDetails = {
      state,
      city,
      pincode: pincode || undefined,
      address: address || undefined,
      lat: lat && !isNaN(lat) ? lat : undefined,
      lng: lng && !isNaN(lng) ? lng : undefined,
    };

    onSelect(details);
    setQuery(s.placeName);
    setSuggestions([]);
    setOpen(false);
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const inputClass =
    "w-full rounded-lg border border-white/10 bg-[#1e293b] text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-[#475569]";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className={inputClass}
          autoComplete="off"
        />
        {loading && (
          <Loader2
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#475569]"
            style={{ width: "14px", height: "14px" }}
          />
        )}
      </div>

      {fetchError && (
        <div className="flex items-center gap-1.5 mt-1.5 px-1">
          <AlertCircle style={{ width: "12px", height: "12px", color: "#F87171", flexShrink: 0 }} />
          <p style={{ fontSize: "11px", color: "#F87171" }}>{fetchError}</p>
        </div>
      )}

      {open && suggestions.length > 0 && (
        <ul
          className="absolute z-50 w-full mt-1 overflow-hidden"
          style={{
            borderRadius: "10px",
            backgroundColor: "#1e293b",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
            maxHeight: "260px",
            overflowY: "auto",
          }}
        >
          {suggestions.map((s, i) => (
            <li key={s.eLoc ?? i}>
              <button
                type="button"
                onClick={() => handleSelect(s)}
                className="w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-white/5 transition-colors"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
              >
                <MapPin
                  className="shrink-0 mt-0.5 text-[#3B82F6]"
                  style={{ width: "13px", height: "13px" }}
                />
                <div>
                  <p className="text-white" style={{ fontSize: "13px", fontWeight: "600" }}>
                    {s.placeName}
                  </p>
                  {s.placeAddress && (
                    <p className="text-[#64748B]" style={{ fontSize: "11px" }}>
                      {s.placeAddress}
                    </p>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type { PlaceDetails };
