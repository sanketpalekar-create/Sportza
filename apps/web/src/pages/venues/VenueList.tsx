/**
 * Venue List — Discovery Layer
 *
 * Key product principle: "Availability visibility drives booking intent"
 * → Every card shows next available slot + price prominently
 */
import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Star, SlidersHorizontal, X, ChevronDown, Navigation } from "lucide-react";
import { useVenues, useSports, useNearbyVenues } from "@sportza/api-client";
import { useUserLocation } from "../../context/LocationContext";
import { format, addHours, startOfHour } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────
type Venue = {
  id: number;
  name: string;
  location?: { city?: string | null; address?: string | null; lat?: number | null; lng?: number | null } | null;
  sports?: string[] | Record<string, unknown> | null;
  defaultPricePerHour?: number | null;
  pricePerHour?: number | null;
  images?: string[] | null;
  rating?: number | null;
  avgRating?: number | null;
  amenities?: string[] | null;
  distance?: number | null;
  distance_km?: number | null;
};

type SortKey = "popular" | "price_asc" | "rating" | "nearest";

const SPORT_EMOJI: Record<string, string> = {
  badminton: "🏸", tennis: "🎾", padel: "🎾", football: "⚽", cricket: "🏏",
  basketball: "🏀", squash: "🎾", volleyball: "🏐", "table tennis": "🏓",
  pickleball: "🏓",
};

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "popular",   label: "Popular" },
  { key: "rating",    label: "Top Rated" },
  { key: "price_asc", label: "Price ↑" },
  { key: "nearest",   label: "Nearest" },
];

// Next available slot — naively show the next round-hour from now
function getNextSlotLabel(): string {
  const next = startOfHour(addHours(new Date(), 1));
  return format(next, "h:mm a");
}

// ─── Skeleton card ─────────────────────────────────────────────────────────────
function VenueCardSkeleton() {
  return (
    <div
      className="overflow-hidden animate-pulse"
      style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}
    >
      <div style={{ height: "160px", backgroundColor: "#111827" }} />
      <div className="p-4 space-y-3">
        <div className="h-5 w-3/4 rounded-lg bg-[#111827]" />
        <div className="h-4 w-1/2 rounded-lg bg-[#111827]" />
        <div className="flex gap-2">
          <div className="h-6 w-20 rounded-full bg-[#111827]" />
          <div className="h-6 w-16 rounded-full bg-[#111827]" />
        </div>
        <div className="h-10 rounded-xl bg-[#111827]" />
      </div>
    </div>
  );
}

// ─── Venue card ────────────────────────────────────────────────────────────────
function VenueCard({ venue, nextSlot }: { venue: Venue; nextSlot: string }) {
  const navigate = useNavigate();
  const sports = Array.isArray(venue.sports)
    ? (venue.sports as string[])
    : venue.sports
    ? Object.keys(venue.sports as Record<string, unknown>)
    : [];
  const price = venue.defaultPricePerHour ?? venue.pricePerHour;
  const rating = venue.rating ?? venue.avgRating;
  const fallbackImg =
    "https://images.unsplash.com/photo-1483721310020-03333e577078?w=480&q=80";

  return (
    <button
      onClick={() => navigate(`/venues/${venue.id}`)}
      className="w-full text-left overflow-hidden transition-all duration-200 active:scale-[0.98]"
      style={{
        borderRadius: "16px",
        backgroundColor: "#1E293B",
        border: "1px solid rgba(255, 255, 255, 0.05)",
      }}
    >
      {/* Image */}
      <div className="relative" style={{ height: "160px" }}>
        <img
          src={venue.images?.[0] ?? fallbackImg}
          alt={venue.name}
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = fallbackImg; }}
        />
        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(30,41,59,0.8) 0%, transparent 60%)" }}
        />
        {/* Rating badge */}
        {rating && (
          <div
            className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-[#111827]"
            style={{ borderRadius: "999px" }}
          >
            <Star style={{ width: "11px", height: "11px", color: "#F59E0B", fill: "#F59E0B" }} />
            <span className="text-white" style={{ fontSize: "12px", fontWeight: "600" }}>
              {typeof rating === "number" ? rating.toFixed(1) : rating}
            </span>
          </div>
        )}
        {/* Primary sport badge */}
        {sports[0] && (
          <div
            className="absolute top-3 left-3 px-3 py-1"
            style={{
              borderRadius: "999px",
              backgroundColor: "rgba(59, 130, 246, 0.2)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(59,130,246,0.3)",
            }}
          >
            <span className="text-[#3B82F6]" style={{ fontSize: "12px", fontWeight: "600" }}>
              {SPORT_EMOJI[sports[0].toLowerCase()] ?? "🏅"} {sports[0]}
            </span>
          </div>
        )}
        {/* Next slot on image bottom */}
        <div className="absolute bottom-3 left-3">
          <div
            className="flex items-center gap-1 px-2 py-1"
            style={{
              borderRadius: "999px",
              backgroundColor: "rgba(34, 197, 94, 0.2)",
              border: "1px solid rgba(34,197,94,0.3)",
            }}
          >
            <div
              className="rounded-full bg-[#22C55E]"
              style={{ width: "6px", height: "6px" }}
            />
            <span className="text-[#22C55E]" style={{ fontSize: "11px", fontWeight: "600" }}>
              Next: {nextSlot}
            </span>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3
            className="text-white leading-tight flex-1 min-w-0 truncate"
            style={{ fontSize: "16px", fontWeight: "700" }}
          >
            {venue.name}
          </h3>
          {price && (
            <div className="shrink-0 text-right">
              <span className="text-[#3B82F6]" style={{ fontSize: "16px", fontWeight: "700" }}>
                ₹{price}
              </span>
              <span className="text-[#64748B]" style={{ fontSize: "11px" }}>/hr</span>
            </div>
          )}
        </div>

        {venue.location?.city && (
          <div className="flex items-center gap-1 mb-3 text-[#94A3B8]" style={{ fontSize: "13px" }}>
            <MapPin style={{ width: "12px", height: "12px" }} />
            <span className="truncate">{venue.location.city}</span>
            {(venue.distance_km ?? venue.distance) != null && (
              <span
                className="ml-auto shrink-0 px-1.5 py-0.5 text-green-400"
                style={{
                  fontSize: "11px",
                  fontWeight: "700",
                  borderRadius: "6px",
                  backgroundColor: "rgba(34,197,94,0.1)",
                }}
              >
                {(() => {
                  const d = venue.distance_km ?? venue.distance ?? 0;
                  return d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)} km`;
                })()}
              </span>
            )}
          </div>
        )}

        {/* Sport pills */}
        {sports.length > 1 && (
          <div className="flex gap-1.5 mb-3 overflow-hidden">
            {sports.slice(1, 4).map((s) => (
              <div
                key={s}
                className="px-2 py-1"
                style={{ borderRadius: "999px", backgroundColor: "#111827", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <span className="text-[#94A3B8]" style={{ fontSize: "11px", fontWeight: "500" }}>
                  {s}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <div
          className="flex items-center justify-center w-full text-white"
          style={{
            height: "40px",
            borderRadius: "12px",
            backgroundColor: "#3B82F6",
            fontSize: "14px",
            fontWeight: "600",
          }}
        >
          View & Book
        </div>
      </div>
    </button>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function VenueList() {
  const userLoc = useUserLocation();
  const [sportFilter, setSportFilter]     = useState<string>("");
  const [sortBy, setSortBy]               = useState<SortKey>("popular");
  const [showSort, setShowSort]           = useState(false);
  const [searchText, setSearchText]       = useState("");
  const [page, setPage]                   = useState(1);
  const [accumulated, setAccumulated]     = useState<Venue[]>([]);
  const [nearMeCoords, setNearMeCoords]   = useState<{ lat: number; lng: number } | null>(null);
  const [nearMeLoading, setNearMeLoading] = useState(false);
  const [nearMeError, setNearMeError]     = useState<string | null>(null);
  const limit = 12;

  // Auto-activate Near Me if we already have coords from any resolved source (gps/manual/profile)
  useEffect(() => {
    const hasResolvedCoords =
      userLoc.lat != null && userLoc.lng != null &&
      (userLoc.source === "gps" || userLoc.source === "manual" || userLoc.source === "profile");
    if (hasResolvedCoords && !nearMeCoords) {
      setNearMeCoords({ lat: userLoc.lat!, lng: userLoc.lng! });
      setSortBy("nearest");
    }
  }, [userLoc.source, userLoc.lat, userLoc.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: sportsRes } = useSports();
  const sports: Array<{ id: number; name: string; displayName: string }> =
    (sportsRes as any)?.data ?? (sportsRes as any) ?? [];

  const isNearMeMode = !!nearMeCoords;

  const { data: nearbyRes, isLoading: nearbyLoading, isError: nearbyIsError } = useNearbyVenues(
    nearMeCoords
      ? {
          lat: nearMeCoords.lat,
          lng: nearMeCoords.lng,
          radius: 10,
          sport: sportFilter || undefined,
          city: userLoc.city ?? undefined,
          state: userLoc.state ?? undefined,
        }
      : undefined
  );

  const handleNearMe = useCallback(() => {
    if (isNearMeMode) {
      setNearMeCoords(null);
      setNearMeError(null);
      return;
    }
    // Prefer already-resolved coords from context before requesting fresh GPS
    if (userLoc.lat != null && userLoc.lng != null) {
      setNearMeCoords({ lat: userLoc.lat, lng: userLoc.lng });
      setSortBy("nearest");
      return;
    }
    setNearMeLoading(true);
    setNearMeError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNearMeCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setNearMeLoading(false);
        setSortBy("nearest");
      },
      () => {
        setNearMeError("Location access denied. Please enable location in your browser settings.");
        setNearMeLoading(false);
      },
      { timeout: 8000 }
    );
  }, [isNearMeMode, userLoc.lat, userLoc.lng]);

  const { data: venuesRes, isLoading: venuesLoading, isError: venuesIsError } = useVenues(
    {
      page,
      limit,
      sport: sportFilter || undefined,
      city: !isNearMeMode && userLoc.city ? userLoc.city : undefined,
    },
    { enabled: !isNearMeMode }
  );

  const isLoading = isNearMeMode ? nearbyLoading : venuesLoading;
  const isError = isNearMeMode ? nearbyIsError : venuesIsError;

  // Accumulate pages — reset when filter/sport changes
  useEffect(() => {
    if (isNearMeMode) return;
    const incoming: Venue[] = (venuesRes as any)?.data ?? (venuesRes as any) ?? [];
    if (incoming.length === 0) return;
    setAccumulated((prev) => {
      if (page === 1) return incoming;
      const existing = new Set(prev.map((v) => v.id));
      return [...prev, ...incoming.filter((v) => !existing.has(v.id))];
    });
  }, [venuesRes, page, isNearMeMode]);

  // Reset accumulation when filters change
  useEffect(() => {
    setPage(1);
    setAccumulated([]);
  }, [sportFilter]);

  const nearbyVenues: Venue[] = (nearbyRes as any)?.data ?? [];
  const allVenues = isNearMeMode ? nearbyVenues : accumulated;
  const total: number = isNearMeMode
    ? nearbyVenues.length
    : ((venuesRes as any)?.total ?? allVenues.length);
  const hasMore = !isNearMeMode && allVenues.length < total;

  // Client-side search filter (by name or city)
  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return q
      ? allVenues.filter(
          (v) =>
            v.name.toLowerCase().includes(q) ||
            (v.location?.city ?? "").toLowerCase().includes(q)
        )
      : allVenues;
  }, [allVenues, searchText]);

  // Client-side sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortBy) {
      case "price_asc":
        return arr.sort(
          (a, b) =>
            (a.defaultPricePerHour ?? a.pricePerHour ?? 9999) -
            (b.defaultPricePerHour ?? b.pricePerHour ?? 9999)
        );
      case "rating":
        return arr.sort(
          (a, b) => (b.rating ?? b.avgRating ?? 0) - (a.rating ?? a.avgRating ?? 0)
        );
      case "nearest":
        return arr.sort(
          (a, b) => (a.distance_km ?? a.distance ?? 99) - (b.distance_km ?? b.distance ?? 99)
        );
      default:
        return arr;
    }
  }, [filtered, sortBy]);

  const nextSlot = getNextSlotLabel();
  const activeSort = SORT_OPTIONS.find((s) => s.key === sortBy)!;

  const clearFilters = () => {
    setSportFilter("");
    setSearchText("");
    setSortBy("popular");
    setPage(1);
    setAccumulated([]);
    setNearMeCoords(null);
    setNearMeError(null);
  };

  const hasFilters = !!sportFilter || !!searchText || sortBy !== "popular" || isNearMeMode;

  return (
    <div className="min-h-screen bg-[#0F172A] pb-24">
      {/* ── Sticky header ── */}
      <div
        className="sticky top-0 z-20 bg-[#0F172A]"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {/* Title row */}
        <div className="flex items-center justify-between px-4 pt-6 pb-3">
          <div>
            <h1 className="text-white" style={{ fontSize: "28px", fontWeight: "700" }}>
              Venues
            </h1>
            <p className="text-[#94A3B8]" style={{ fontSize: "13px" }}>
              {total > 0 ? `${total} venues nearby` : "Find courts near you"}
            </p>
          </div>
          {/* Sort button */}
          <div className="relative">
            <button
              onClick={() => setShowSort((v) => !v)}
              className="flex items-center gap-2 px-3 py-2 transition-colors"
              style={{
                borderRadius: "12px",
                backgroundColor: "#1E293B",
                border: "1px solid rgba(255,255,255,0.06)",
                fontSize: "13px",
                fontWeight: "600",
                color: "#FFFFFF",
              }}
            >
              <SlidersHorizontal style={{ width: "14px", height: "14px", color: "#94A3B8" }} />
              {activeSort.label}
              <ChevronDown style={{ width: "12px", height: "12px", color: "#64748B" }} />
            </button>
            {showSort && (
              <div
                className="absolute right-0 top-full mt-2 z-30 overflow-hidden"
                style={{
                  borderRadius: "14px",
                  backgroundColor: "#1E293B",
                  border: "1px solid rgba(255,255,255,0.08)",
                  minWidth: "160px",
                  boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
                }}
              >
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => { setSortBy(opt.key); setShowSort(false); }}
                    className="w-full text-left px-4 py-3 transition-colors hover:bg-white/5 flex items-center justify-between"
                    style={{ fontSize: "14px", fontWeight: "500", borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    <span style={{ color: sortBy === opt.key ? "#3B82F6" : "#FFFFFF" }}>
                      {opt.label}
                    </span>
                    {sortBy === opt.key && (
                      <div className="w-2 h-2 rounded-full bg-[#3B82F6]" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Search bar + Near Me */}
        <div className="px-4 mb-3 flex gap-2">
          <div
            className="flex items-center gap-3 px-4 flex-1"
            style={{
              height: "48px",
              borderRadius: "14px",
              backgroundColor: "#1E293B",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <Search style={{ width: "18px", height: "18px", color: "#64748B", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search venues, cities..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="flex-1 bg-transparent outline-none text-white placeholder-[#64748B]"
              style={{ fontSize: "15px" }}
            />
            {searchText && (
              <button onClick={() => setSearchText("")}>
                <X style={{ width: "16px", height: "16px", color: "#64748B" }} />
              </button>
            )}
          </div>
          <button
            onClick={handleNearMe}
            disabled={nearMeLoading}
            className="flex items-center justify-center shrink-0 transition-colors"
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "14px",
              backgroundColor: isNearMeMode ? "rgba(59,130,246,0.2)" : "#1E293B",
              border: isNearMeMode ? "1px solid #3B82F6" : "1px solid rgba(255,255,255,0.06)",
            }}
            title={isNearMeMode ? "Turn off Near Me" : "Find venues near me"}
          >
            {nearMeLoading ? (
              <div
                className="animate-spin rounded-full border-2 border-[#64748B] border-t-[#3B82F6]"
                style={{ width: "16px", height: "16px" }}
              />
            ) : (
              <Navigation
                style={{ width: "18px", height: "18px", color: isNearMeMode ? "#3B82F6" : "#64748B" }}
              />
            )}
          </button>
        </div>
        {nearMeError && (
          <div className="px-4 mb-2">
            <p className="text-[#F59E0B]" style={{ fontSize: "12px" }}>{nearMeError}</p>
          </div>
        )}
        {isNearMeMode && (
          <div className="px-4 mb-2">
            <p className="text-[#22C55E]" style={{ fontSize: "12px", fontWeight: "600" }}>
              Showing venues within 10 km of your location
            </p>
          </div>
        )}

        {/* Sport filter pills */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => { setSportFilter(""); setPage(1); }}
            className="shrink-0 px-4 py-2 transition-colors"
            style={{
              borderRadius: "999px",
              fontSize: "13px",
              fontWeight: "600",
              backgroundColor: !sportFilter ? "#3B82F6" : "#1E293B",
              color: !sportFilter ? "#FFFFFF" : "#94A3B8",
              border: !sportFilter ? "none" : "1px solid rgba(255,255,255,0.06)",
            }}
          >
            All
          </button>
          {sports.map((s) => (
            <button
              key={s.id}
              onClick={() => { setSportFilter(s.name === sportFilter ? "" : s.name); setPage(1); }}
              className="shrink-0 px-4 py-2 transition-colors whitespace-nowrap"
              style={{
                borderRadius: "999px",
                fontSize: "13px",
                fontWeight: "600",
                backgroundColor: sportFilter === s.name ? "#3B82F6" : "#1E293B",
                color: sportFilter === s.name ? "#FFFFFF" : "#94A3B8",
                border: sportFilter === s.name ? "none" : "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {SPORT_EMOJI[s.name.toLowerCase()] ?? "🏅"} {s.displayName}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-4">
        {/* Active filter chip */}
        {hasFilters && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[#94A3B8]" style={{ fontSize: "13px" }}>
              Filters active
            </span>
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-1"
              style={{ borderRadius: "999px", backgroundColor: "rgba(239,68,68,0.15)", fontSize: "12px", color: "#EF4444", fontWeight: "600" }}
            >
              <X style={{ width: "12px", height: "12px" }} />
              Clear
            </button>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <VenueCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error */}
        {isError && (
          <div
            className="p-10 text-center mt-4"
            style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}
          >
            <span className="text-4xl block mb-3">⚠️</span>
            <p className="text-[#94A3B8] mb-4" style={{ fontSize: "14px" }}>
              Failed to load venues
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 text-white"
              style={{ borderRadius: "12px", backgroundColor: "#3B82F6", fontSize: "14px", fontWeight: "600" }}
            >
              Retry
            </button>
          </div>
        )}

        {/* No results */}
        {!isLoading && !isError && sorted.length === 0 && (
          <div
            className="p-12 text-center mt-4"
            style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}
          >
            <span className="text-5xl block mb-3">🔍</span>
            <h2 className="text-white mb-2" style={{ fontSize: "18px", fontWeight: "600" }}>
              No venues found
            </h2>
            <p className="text-[#94A3B8] mb-6" style={{ fontSize: "14px" }}>
              {hasFilters ? "Try adjusting your filters." : "No venues available yet."}
            </p>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="px-6 py-2 text-white"
                style={{ borderRadius: "12px", backgroundColor: "#3B82F6", fontSize: "14px", fontWeight: "600" }}
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Venue list */}
        {!isLoading && !isError && sorted.length > 0 && (
          <>
            <div className="space-y-4">
              {sorted.map((venue) => (
                <VenueCard key={venue.id} venue={venue} nextSlot={nextSlot} />
              ))}
            </div>

            {/* Load more */}
            {hasMore && (
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={isLoading}
                className="w-full mt-6 py-4 text-[#3B82F6] transition-colors"
                style={{
                  borderRadius: "14px",
                  backgroundColor: "rgba(59,130,246,0.1)",
                  border: "1px solid rgba(59,130,246,0.2)",
                  fontSize: "15px",
                  fontWeight: "600",
                }}
              >
                Load More Venues
              </button>
            )}

            <p className="text-center text-[#64748B] mt-4 mb-2" style={{ fontSize: "12px" }}>
              Showing {sorted.length} of {total} venues
            </p>
          </>
        )}
      </div>

      {/* Sort backdrop */}
      {showSort && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setShowSort(false)}
        />
      )}
    </div>
  );
}
