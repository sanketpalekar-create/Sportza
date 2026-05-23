import { useEffect, useRef } from "react";
import { MapPin } from "lucide-react";
import { useMappls } from "./context";
import type { MapEmbedProps } from "../types";

export default function MapEmbed({
  lat,
  lng,
  label,
  height = "200px",
  className = "",
}: MapEmbedProps) {
  const { isLoaded } = useMappls();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!isLoaded || !lat || !lng || !containerRef.current) return;

    const mappls = (window as any).mappls;
    if (!mappls) return;

    // Destroy previous instance if re-rendering with new coords
    if (mapRef.current) {
      try { mapRef.current.remove?.(); } catch { /* ignore */ }
      mapRef.current = null;
    }

    const map = new mappls.Map(containerRef.current, {
      center: { lat, lng },
      zoom: 15,
      zoomControl: true,
      location: false,
    });

    new mappls.Marker({
      map,
      position: { lat, lng },
      ...(label ? { popupHtml: `<span style="color:#0f172a;font-weight:600">${label}</span>` } : {}),
    });

    mapRef.current = map;

    return () => {
      try { map.remove?.(); } catch { /* ignore */ }
    };
  }, [isLoaded, lat, lng, label]);

  if (!lat || !lng) return null;

  const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  if (!isLoaded) {
    return (
      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-2 text-blue-400 hover:underline text-sm ${className}`}
      >
        <MapPin className="w-4 h-4 shrink-0" />
        View on Google Maps
      </a>
    );
  }

  return (
    <div className={className}>
      <div
        ref={containerRef}
        style={{ width: "100%", height, borderRadius: "12px", overflow: "hidden" }}
      />
      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-blue-400 hover:underline mt-2"
        style={{ fontSize: "13px" }}
      >
        <MapPin className="w-3.5 h-3.5 shrink-0" />
        Open in Google Maps
      </a>
    </div>
  );
}
