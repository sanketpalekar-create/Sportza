import { GoogleMap, Marker } from "@react-google-maps/api";
import { MapPin } from "lucide-react";
import type { MapEmbedProps } from "../types";

const mapsLoaded = () => typeof google !== "undefined" && !!google.maps;

const defaultContainerStyle = { width: "100%", borderRadius: "12px" };

export default function MapEmbed({
  lat,
  lng,
  label,
  height = "200px",
  className = "",
}: MapEmbedProps) {
  if (!lat || !lng || !mapsLoaded()) {
    if (!lat || !lng) return null;
    const query = encodeURIComponent(label ?? `${lat},${lng}`);
    return (
      <a
        href={`https://maps.google.com/?q=${query}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-2 text-blue-400 hover:underline text-sm ${className}`}
      >
        <MapPin className="w-4 h-4 shrink-0" />
        View on Google Maps
      </a>
    );
  }

  const center = { lat, lng };

  return (
    <div className={className}>
      <GoogleMap
        mapContainerStyle={{ ...defaultContainerStyle, height }}
        center={center}
        zoom={15}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          styles: [
            { elementType: "geometry", stylers: [{ color: "#1e293b" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#334155" }] },
            { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1e293b" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
            { featureType: "poi", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
          ],
        }}
      >
        <Marker position={center} title={label} />
      </GoogleMap>
    </div>
  );
}
