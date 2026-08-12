import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { usePeerSuggestions } from "@sportza/api-client";
import { ArrowLeft, MapPin, Loader2, ChevronDown, Target } from "lucide-react";
import { useUserLocation } from "../../context/LocationContext";
import LocationSheet from "../../components/LocationSheet";

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function LocationPill({ onOpen }: { onOpen: () => void }) {
  const userLoc = useUserLocation();
  const label = userLoc.city ?? userLoc.state ?? "Set location";
  const muted = !userLoc.city && !userLoc.state;

  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-1 active:opacity-70 transition-opacity"
    >
      <MapPin style={{ width: "12px", height: "12px", color: "#3B82F6", flexShrink: 0 }} />
      <span
        className="truncate"
        style={{
          fontSize: "13px",
          fontWeight: "600",
          color: muted ? "#475569" : "#E2E8F0",
        }}
      >
        {label}
      </span>
      {userLoc.isResolving ? (
        <Loader2
          style={{ width: "11px", height: "11px", color: "#475569" }}
          className="animate-spin flex-shrink-0"
        />
      ) : (
        <ChevronDown style={{ width: "11px", height: "11px", color: "#475569", flexShrink: 0 }} />
      )}
    </button>
  );
}

export default function FindPeers() {
  const navigate = useNavigate();
  const userLoc = useUserLocation();
  const [showLocSheet, setShowLocSheet] = useState(false);

  const hasLocation = !!(userLoc.city || userLoc.state);
  const { data: peersRes, isLoading } = usePeerSuggestions(
    hasLocation
      ? {
          city: userLoc.city ?? undefined,
          state: userLoc.state ?? undefined,
          limit: 30,
        }
      : undefined
  );

  const peers: Array<Record<string, any>> = Array.isArray((peersRes as any)?.data)
    ? (peersRes as any).data
    : [];

  const locationLabel = userLoc.city
    ? userLoc.state
      ? `${userLoc.city}, ${userLoc.state}`
      : userLoc.city
    : userLoc.state ?? null;

  return (
    <div className="pb-32 px-4 pt-8 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "12px",
            backgroundColor: "#1E293B",
          }}
        >
          <ArrowLeft style={{ width: "18px", height: "18px", color: "#94A3B8" }} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-white" style={{ fontSize: "22px", fontWeight: "800" }}>
            Players Near You
          </h1>
          {locationLabel && (
            <p className="text-[#64748B]" style={{ fontSize: "13px" }}>
              In {locationLabel}
            </p>
          )}
        </div>
      </div>

      <div className="mb-6">
        <LocationPill onOpen={() => setShowLocSheet(true)} />
      </div>

      {!hasLocation && (
        <div
          className="p-5 text-center mb-4"
          style={{
            borderRadius: "16px",
            backgroundColor: "#1E293B",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <p className="text-white mb-2" style={{ fontSize: "15px", fontWeight: "700" }}>
            Set your location
          </p>
          <p className="text-[#64748B] mb-4" style={{ fontSize: "13px" }}>
            We need your city to show nearby players.
          </p>
          <button
            onClick={() => setShowLocSheet(true)}
            className="px-4 py-2"
            style={{
              borderRadius: "10px",
              backgroundColor: "#3B82F6",
              color: "#fff",
              fontSize: "13px",
              fontWeight: "600",
            }}
          >
            Choose location
          </button>
        </div>
      )}

      {hasLocation && isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin" style={{ width: "28px", height: "28px", color: "#3B82F6" }} />
        </div>
      )}

      {hasLocation && !isLoading && peers.length === 0 && (
        <div
          className="p-5 text-center"
          style={{
            borderRadius: "16px",
            backgroundColor: "#1E293B",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <p className="text-white mb-2" style={{ fontSize: "15px", fontWeight: "700" }}>
            No players found nearby
          </p>
          <p className="text-[#64748B]" style={{ fontSize: "13px" }}>
            Try a different location or use matchmaking to find players by sport.
          </p>
        </div>
      )}

      {hasLocation && !isLoading && peers.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {peers.map((p) => {
            const initials = getInitials(p.name);
            return (
              <Link
                key={p.id}
                to={`/players/${p.id}`}
                className="flex flex-col items-center gap-2 p-3 active:scale-95 transition-transform"
                style={{
                  borderRadius: "16px",
                  backgroundColor: "#1E293B",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {p.avatar ? (
                  <img
                    src={p.avatar}
                    alt={p.name}
                    className="rounded-full object-cover"
                    style={{ width: "48px", height: "48px" }}
                  />
                ) : (
                  <div
                    className="rounded-full flex items-center justify-center"
                    style={{
                      width: "48px",
                      height: "48px",
                      background: "linear-gradient(135deg,#3B82F6,#8B5CF6)",
                      fontSize: "16px",
                      fontWeight: "700",
                      color: "#fff",
                    }}
                  >
                    {initials}
                  </div>
                )}
                <p
                  className="text-white text-center truncate w-full"
                  style={{ fontSize: "11px", fontWeight: "600" }}
                >
                  {p.name ?? "Player"}
                </p>
                <p className="text-[#64748B] text-center truncate w-full" style={{ fontSize: "10px" }}>
                  {p.location?.city ?? ""}
                </p>
              </Link>
            );
          })}
        </div>
      )}

      <button
        onClick={() => navigate("/matchmaking")}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        style={{
          borderRadius: "14px",
          backgroundColor: "rgba(59,130,246,0.08)",
          border: "1px solid rgba(59,130,246,0.2)",
        }}
      >
        <Target style={{ width: "18px", height: "18px", color: "#3B82F6", flexShrink: 0 }} />
        <div className="flex-1 min-w-0">
          <p className="text-white" style={{ fontSize: "14px", fontWeight: "700" }}>
            Find My Match
          </p>
          <p className="text-[#64748B]" style={{ fontSize: "12px" }}>
            Discover players by sport and skill rating
          </p>
        </div>
      </button>

      <LocationSheet open={showLocSheet} onClose={() => setShowLocSheet(false)} />
    </div>
  );
}
