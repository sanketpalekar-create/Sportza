/**
 * LocationSheet — Bottom-sheet that lets the user change their active location.
 *
 * Two options:
 *   1. "Use current location" — re-triggers GPS via LocationContext.refresh()
 *   2. Mappls Autosuggest search — calls LocationContext.setManual() on selection
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Navigation, X, Loader2 } from "lucide-react";
import { useUserLocation } from "../context/LocationContext";
import PlacesAutocomplete from "./PlacesAutocomplete";
import type { PlaceDetails } from "./PlacesAutocomplete";
import { reverseGeocode } from "../lib/reverseGeocode";

interface LocationSheetProps {
  open: boolean;
  onClose: () => void;
}

export default function LocationSheet({ open, onClose }: LocationSheetProps) {
  const userLoc = useUserLocation();
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError,   setGpsError]   = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setGpsError(null);
      setGpsLoading(false);
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Close on overlay click
  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleUseGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError("GPS is not supported by your browser.");
      return;
    }
    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const gpsLat = pos.coords.latitude;
        const gpsLng = pos.coords.longitude;
        // Reverse-geocode to get the real city name for these coords
        const { city, state } = await reverseGeocode(gpsLat, gpsLng);
        userLoc.setManual(
          city ?? userLoc.city,
          state ?? userLoc.state,
          gpsLat,
          gpsLng
        );
        setGpsLoading(false);
        onClose();
      },
      () => {
        setGpsError("Location access denied. Please enable it in browser settings.");
        setGpsLoading(false);
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  }, [userLoc, onClose]);

  const handlePlaceSelect = useCallback(
    (details: PlaceDetails) => {
      userLoc.setManual(
        details.city ?? null,
        details.state ?? null,
        details.lat ?? null,
        details.lng ?? null
      );
      onClose();
    },
    [userLoc, onClose]
  );

  if (!open) return null;

  return (
    /* Overlay */
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-end"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }}
    >
      {/* Sheet */}
      <div
        className="w-full max-w-md mx-auto"
        style={{
          borderRadius: "24px 24px 0 0",
          backgroundColor: "#0F172A",
          border: "1px solid rgba(255,255,255,0.08)",
          borderBottom: "none",
          padding: "0 0 env(safe-area-inset-bottom, 24px)",
          maxHeight: "80vh",
          overflowY: "auto",
          animation: "slideUp 0.22s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div style={{ width: "36px", height: "4px", borderRadius: "99px", backgroundColor: "rgba(255,255,255,0.15)" }} />
        </div>

        {/* Header row */}
        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="text-white" style={{ fontSize: "17px", fontWeight: "700" }}>
            Choose Location
          </h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center"
            style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.07)" }}
          >
            <X style={{ width: "16px", height: "16px", color: "#94A3B8" }} />
          </button>
        </div>

        <div className="px-5 pb-6 space-y-4">
          {/* Current location row */}
          {(userLoc.city || userLoc.state) && (
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderRadius: "14px", backgroundColor: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.18)" }}
            >
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "rgba(59,130,246,0.15)" }}
              >
                <span style={{ fontSize: "16px" }}>📍</span>
              </div>
              <div className="min-w-0">
                <p className="text-white truncate" style={{ fontSize: "14px", fontWeight: "600" }}>
                  {userLoc.city ?? userLoc.state}
                </p>
                <p className="text-[#64748B]" style={{ fontSize: "11px" }}>
                  {userLoc.source === "gps"
                    ? "Detected via GPS"
                    : userLoc.source === "manual"
                    ? "Manually set"
                    : "From your profile"}
                </p>
              </div>
            </div>
          )}

          {/* Use GPS button */}
          <button
            onClick={handleUseGPS}
            disabled={gpsLoading}
            className="w-full flex items-center gap-3 px-4 py-3 transition-colors active:scale-[0.98]"
            style={{
              borderRadius: "14px",
              backgroundColor: "#1E293B",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "rgba(34,197,94,0.12)" }}
            >
              {gpsLoading
                ? <Loader2 style={{ width: "18px", height: "18px", color: "#22C55E" }} className="animate-spin" />
                : <Navigation style={{ width: "18px", height: "18px", color: "#22C55E" }} />
              }
            </div>
            <div className="text-left">
              <p className="text-white" style={{ fontSize: "14px", fontWeight: "600" }}>
                Use current location
              </p>
              <p className="text-[#64748B]" style={{ fontSize: "11px" }}>Detect via GPS</p>
            </div>
          </button>

          {gpsError && (
            <p className="text-red-400" style={{ fontSize: "12px", paddingLeft: "4px" }}>
              {gpsError}
            </p>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(255,255,255,0.07)" }} />
            <span className="text-[#475569]" style={{ fontSize: "11px", fontWeight: "600" }}>OR SEARCH</span>
            <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(255,255,255,0.07)" }} />
          </div>

          {/* Place search */}
          <PlacesAutocomplete
            onSelect={handlePlaceSelect}
            placeholder="Search city, area or landmark…"
          />
        </div>
      </div>

      {/* Slide-up keyframe */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
