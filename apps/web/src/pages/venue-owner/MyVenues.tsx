/**
 * My Venues — List of venues owned by the current user
 */
import { useNavigate } from "react-router-dom";
import {
  Building2, MapPin, ChevronRight, Plus, Wifi, WifiOff,
} from "lucide-react";
import { useMyVenues } from "@sportza/api-client";

function VenueSkeleton() {
  return (
    <div className="animate-pulse p-4 space-y-2" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
      <div className="h-5 rounded w-2/3" style={{ backgroundColor: "#334155" }} />
      <div className="h-3 rounded w-1/2" style={{ backgroundColor: "#334155" }} />
      <div className="h-3 rounded w-1/3" style={{ backgroundColor: "#334155" }} />
    </div>
  );
}

export default function MyVenues() {
  const navigate = useNavigate();
  const { data: res, isLoading, isError } = useMyVenues();

  const venues: any[] = (res as any)?.data ?? (res as any)?.venues ?? (Array.isArray(res) ? res : []);

  return (
    <div className="min-h-screen bg-[#0F172A] pb-28">
      {/* Header */}
      <div className="px-4 pt-8 pb-5 flex items-center justify-between">
        <div>
          <h1 className="text-white" style={{ fontSize: "24px", fontWeight: "800" }}>My Venues</h1>
          <p className="text-[#64748B]" style={{ fontSize: "13px" }}>
            {venues.length} venue{venues.length !== 1 ? "s" : ""} managed
          </p>
        </div>
        <button
          onClick={() => navigate("/venue-owner/venues/create")}
          className="flex items-center gap-1.5 px-4 py-2.5"
          style={{
            borderRadius: "12px",
            background: "linear-gradient(135deg,#3B82F6,#2563EB)",
            fontSize: "13px", fontWeight: "700", color: "#fff",
          }}
        >
          <Plus style={{ width: "16px", height: "16px" }} />
          Add Venue
        </button>
      </div>

      <div className="px-4 space-y-3 max-w-md mx-auto">
        {isLoading && [1, 2, 3].map((i) => <VenueSkeleton key={i} />)}

        {isError && (
          <div className="p-10 text-center" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
            <p className="text-[#EF4444]" style={{ fontSize: "14px" }}>Failed to load venues. Please try again.</p>
          </div>
        )}

        {!isLoading && !isError && venues.length === 0 && (
          <div className="p-12 text-center" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <Building2 style={{ width: "44px", height: "44px", color: "#334155", margin: "0 auto 16px" }} />
            <p className="text-white mb-1" style={{ fontSize: "18px", fontWeight: "700" }}>No venues yet</p>
            <p className="text-[#64748B] mb-5" style={{ fontSize: "14px" }}>
              Add your first venue to start accepting bookings.
            </p>
            <button
              onClick={() => navigate("/venue-owner/venues/create")}
              className="px-6 py-3"
              style={{
                borderRadius: "12px",
                background: "linear-gradient(135deg,#3B82F6,#2563EB)",
                fontSize: "14px", fontWeight: "700", color: "#fff",
              }}
            >
              Add Your First Venue
            </button>
          </div>
        )}

        {!isLoading && !isError && venues.map((venue: any) => {
          const sports: string[] = venue.sports ?? [];
          const isActive = venue.isActive ?? venue.is_active ?? true;

          return (
            <button
              key={venue.id}
              onClick={() => navigate(`/venue-owner/venues/${venue.id}`)}
              className="w-full text-left hover:bg-white/5 transition-colors"
              style={{
                borderRadius: "16px",
                backgroundColor: "#1E293B",
                border: "1px solid rgba(255,255,255,0.06)",
                padding: "16px",
              }}
            >
              {/* Name + status */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 style={{ width: "18px", height: "18px", color: "#F59E0B", flexShrink: 0 }} />
                  <span className="text-white truncate" style={{ fontSize: "16px", fontWeight: "700" }}>
                    {venue.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isActive
                    ? <Wifi style={{ width: "13px", height: "13px", color: "#22C55E" }} />
                    : <WifiOff style={{ width: "13px", height: "13px", color: "#EF4444" }} />}
                  <span
                    style={{
                      fontSize: "11px", fontWeight: "700",
                      color: isActive ? "#22C55E" : "#EF4444",
                    }}
                  >
                    {isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>
              </div>

              {/* Location */}
              {(venue.city || venue.address) && (
                <div className="flex items-center gap-1.5 mb-2">
                  <MapPin style={{ width: "13px", height: "13px", color: "#64748B" }} />
                  <span className="text-[#64748B] truncate" style={{ fontSize: "13px" }}>
                    {[venue.address, venue.city].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}

              {/* Sports */}
              {sports.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {sports.slice(0, 4).map((s: string) => (
                    <span
                      key={s}
                      className="px-2 py-0.5"
                      style={{
                        borderRadius: "6px",
                        backgroundColor: "rgba(59,130,246,0.12)",
                        fontSize: "11px", fontWeight: "600", color: "#3B82F6",
                      }}
                    >
                      {s}
                    </span>
                  ))}
                  {sports.length > 4 && (
                    <span style={{ fontSize: "11px", color: "#64748B" }}>+{sports.length - 4} more</span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end mt-3">
                <ChevronRight style={{ width: "16px", height: "16px", color: "#475569" }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
