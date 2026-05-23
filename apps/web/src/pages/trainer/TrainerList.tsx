/**
 * TrainerList — Player-facing trainer discovery
 *
 * BRD: "Trainer List — Search, sport/city filters; trainer cards
 *       (name, sports — can be multiple, city, rating, review count)"
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Star, MapPin, ChevronRight, Dumbbell, X } from "lucide-react";
import { useTrainers, useSports } from "@sportza/api-client";

// ─── Types ────────────────────────────────────────────────────────────────────
type TrainerProfile = {
  id: number;
  bio?: string | null;
  yearsExperience?: number;
  sports?: string[] | null;
  rating?: number;
  reviewCount?: number;
  user?: {
    id: number;
    name?: string | null;
    avatar?: string | null;
    location?: { city?: string | null } | null;
  };
};

const SPORT_EMOJI: Record<string, string> = {
  badminton: "🏸", tennis: "🎾", padel: "🎾", football: "⚽", cricket: "🏏",
  basketball: "🏀", squash: "🎾", volleyball: "🏐", swimming: "🏊",
  pickleball: "🏓",
};
const sportEmoji = (n: string) => SPORT_EMOJI[n?.toLowerCase()] ?? "🏋️";

// ─── Card ─────────────────────────────────────────────────────────────────────
function TrainerCard({ profile }: { profile: TrainerProfile }) {
  const navigate = useNavigate();
  const sports: string[] = Array.isArray(profile.sports) ? profile.sports : [];

  return (
    <button
      onClick={() => navigate(`/trainers/${profile.user?.id ?? profile.id}`)}
      className="w-full text-left transition-all duration-200 active:scale-[0.98] p-4"
      style={{
        borderRadius: "20px",
        backgroundColor: "#1E293B",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div
          className="shrink-0 flex items-center justify-center"
          style={{
            width: "56px", height: "56px", borderRadius: "50%",
            backgroundColor: "#0F172A",
            fontSize: "24px",
            overflow: "hidden",
          }}
        >
          {profile.user?.avatar ? (
            <img
              src={profile.user.avatar}
              alt={profile.user.name ?? "Trainer"}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <Dumbbell style={{ width: "24px", height: "24px", color: "#3B82F6" }} />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-white truncate" style={{ fontSize: "16px", fontWeight: "700" }}>
            {profile.user?.name ?? "Coach"}
          </h3>
          <div className="flex items-center gap-3 mt-0.5">
            {profile.rating != null && profile.rating > 0 ? (
              <div className="flex items-center gap-1">
                <Star style={{ width: "12px", height: "12px", color: "#F59E0B", fill: "#F59E0B" }} />
                <span className="text-[#94A3B8]" style={{ fontSize: "13px" }}>
                  {profile.rating.toFixed(1)}
                  {profile.reviewCount ? ` (${profile.reviewCount})` : ""}
                </span>
              </div>
            ) : (
              <span className="text-[#64748B]" style={{ fontSize: "13px" }}>New coach</span>
            )}
            {profile.user?.location?.city && (
              <div className="flex items-center gap-1">
                <MapPin style={{ width: "12px", height: "12px", color: "#64748B" }} />
                <span className="text-[#64748B]" style={{ fontSize: "13px" }}>
                  {profile.user.location.city}
                </span>
              </div>
            )}
          </div>

          {/* Sports chips */}
          {sports.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {sports.slice(0, 4).map((s) => (
                <span
                  key={s}
                  className="px-2 py-0.5"
                  style={{
                    borderRadius: "999px",
                    backgroundColor: "rgba(59,130,246,0.12)",
                    border: "1px solid rgba(59,130,246,0.25)",
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "#60A5FA",
                  }}
                >
                  {sportEmoji(s)} {s.charAt(0).toUpperCase() + s.slice(1)}
                </span>
              ))}
              {sports.length > 4 && (
                <span className="text-[#64748B]" style={{ fontSize: "11px", paddingTop: "2px" }}>
                  +{sports.length - 4} more
                </span>
              )}
            </div>
          )}
        </div>

        <ChevronRight style={{ width: "16px", height: "16px", color: "#475569", flexShrink: 0 }} />
      </div>

      {/* Bio snippet */}
      {profile.bio && (
        <p
          className="text-[#64748B] mt-3 line-clamp-2"
          style={{ fontSize: "13px", lineHeight: "1.5" }}
        >
          {profile.bio}
        </p>
      )}
    </button>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function TrainerSkeleton() {
  return (
    <div
      className="p-4 animate-pulse"
      style={{ borderRadius: "20px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div className="flex items-center gap-4">
        <div style={{ width: "56px", height: "56px", borderRadius: "50%", backgroundColor: "#0F172A" }} />
        <div className="flex-1 space-y-2">
          <div style={{ height: "16px", borderRadius: "8px", backgroundColor: "#0F172A", width: "60%" }} />
          <div style={{ height: "13px", borderRadius: "8px", backgroundColor: "#0F172A", width: "40%" }} />
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function TrainerList() {
  const navigate = useNavigate();
  const [sportFilter, setSportFilter] = useState("");
  const [searchText, setSearchText] = useState("");

  const { data: sportsRes } = useSports();
  const sports = ((sportsRes as any)?.data ?? sportsRes ?? []) as Array<{ name: string; displayName: string }>;

  const { data: trainersRes, isLoading, isError } = useTrainers({
    sport: sportFilter || undefined,
  });
  const allTrainers: TrainerProfile[] = (trainersRes as any)?.data ?? trainersRes ?? [];

  const filtered = searchText.trim()
    ? allTrainers.filter((t) => {
        const q = searchText.toLowerCase();
        return (
          (t.user?.name ?? "").toLowerCase().includes(q) ||
          (t.user?.location?.city ?? "").toLowerCase().includes(q) ||
          (t.sports ?? []).some((s) => s.toLowerCase().includes(q))
        );
      })
    : allTrainers;

  return (
    <div className="min-h-screen bg-[#0F172A] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0F172A]">
        <div className="flex items-center gap-3 px-4 pt-6 pb-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center shrink-0"
            style={{
              width: "40px", height: "40px", borderRadius: "12px",
              backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <ChevronRight
              style={{ width: "18px", height: "18px", color: "#94A3B8", transform: "rotate(180deg)" }}
            />
          </button>
          <div>
            <h1 className="text-white" style={{ fontSize: "24px", fontWeight: "700" }}>Coaches</h1>
            <p className="text-[#64748B]" style={{ fontSize: "13px" }}>
              {allTrainers.length > 0 ? `${allTrainers.length} coaches available` : "Find your trainer"}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div
            className="flex items-center gap-3 px-4"
            style={{
              height: "48px", borderRadius: "14px",
              backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <Search style={{ width: "16px", height: "16px", color: "#64748B", flexShrink: 0 }} />
            <input
              className="flex-1 bg-transparent text-white outline-none"
              style={{ fontSize: "14px" }}
              placeholder="Search coaches, city, sport…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            {searchText && (
              <button onClick={() => setSearchText("")}>
                <X style={{ width: "16px", height: "16px", color: "#64748B" }} />
              </button>
            )}
          </div>
        </div>

        {/* Sport filter chips */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
          {["", ...sports.map((s) => s.name)].map((s) => (
            <button
              key={s || "all"}
              onClick={() => setSportFilter(s)}
              className="shrink-0 px-3 py-1.5"
              style={{
                borderRadius: "999px", fontSize: "12px", fontWeight: "600",
                backgroundColor: sportFilter === s ? "#3B82F6" : "#1E293B",
                color: sportFilter === s ? "#FFFFFF" : "#94A3B8",
                border: "1px solid",
                borderColor: sportFilter === s ? "#3B82F6" : "rgba(255,255,255,0.06)",
              }}
            >
              {s ? `${sportEmoji(s)} ${s.charAt(0).toUpperCase() + s.slice(1)}` : "All Sports"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-2 space-y-3">
        {isLoading && Array.from({ length: 5 }).map((_, i) => <TrainerSkeleton key={i} />)}

        {isError && (
          <div className="p-10 text-center" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
            <p className="text-[#94A3B8] mb-4" style={{ fontSize: "14px" }}>Failed to load coaches</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 text-white"
              style={{ borderRadius: "12px", backgroundColor: "#3B82F6", fontSize: "14px", fontWeight: "600" }}
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="p-12 text-center" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
            <span className="text-5xl block mb-3">🔍</span>
            <h2 className="text-white mb-2" style={{ fontSize: "18px", fontWeight: "600" }}>No coaches found</h2>
            <p className="text-[#94A3B8]" style={{ fontSize: "14px" }}>
              {searchText || sportFilter ? "Try adjusting your search." : "No coaches available yet."}
            </p>
          </div>
        )}

        {!isLoading && !isError && filtered.map((t) => (
          <TrainerCard key={t.id} profile={t} />
        ))}
      </div>
    </div>
  );
}
