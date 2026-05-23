import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useOpenPlays, useSports, useCurrentUser } from "@sportza/api-client";
import { MapPin, Clock, Users, UserPlus, Dumbbell, ChevronRight, Target } from "lucide-react";
import { SportRulebook } from "../../components/SportRulebook";
import { useRole } from "../../context/RoleContext";
import { format } from "date-fns";

const LEVEL_COLORS: Record<string, { text: string; bg: string }> = {
  Beginner:     { text: "#22C55E", bg: "rgba(34, 197, 94, 0.15)" },
  beginner:     { text: "#22C55E", bg: "rgba(34, 197, 94, 0.15)" },
  Intermediate: { text: "#3B82F6", bg: "rgba(59, 130, 246, 0.15)" },
  intermediate: { text: "#3B82F6", bg: "rgba(59, 130, 246, 0.15)" },
  Advanced:     { text: "#8B5CF6", bg: "rgba(139, 92, 246, 0.15)" },
  advanced:     { text: "#8B5CF6", bg: "rgba(139, 92, 246, 0.15)" },
  default:      { text: "#94A3B8", bg: "rgba(148, 163, 184, 0.15)" },
};

function getLevelColor(level?: string) {
  return LEVEL_COLORS[level ?? ""] ?? LEVEL_COLORS.default;
}

const SPORT_COLORS: Record<string, string> = {
  badminton: "#3B82F6", football: "#22C55E", cricket: "#8B5CF6",
  tennis: "#F59E0B", padel: "#F59E0B", basketball: "#F97316", volleyball: "#06B6D4",
  pickleball: "#14B8A6",
};
function getSportColor(sport?: string): string {
  return SPORT_COLORS[(sport ?? "").toLowerCase()] ?? "#3B82F6";
}

const SPORT_FALLBACK_IMGS: Record<string, string> = {
  football:   "https://images.unsplash.com/photo-1603508434829-7c4282d74483?w=480&q=80",
  cricket:    "https://images.unsplash.com/photo-1759733841123-b8e1d75ee45c?w=480&q=80",
  basketball: "https://images.unsplash.com/photo-1710378844976-93a6538671ef?w=480&q=80",
  tennis:     "https://images.unsplash.com/photo-1761775446030-5e1fdd4166a5?w=480&q=80",
  padel:      "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=480&q=80",
  badminton:  "https://images.unsplash.com/photo-1723633236252-eb7badabb34c?w=480&q=80",
  pickleball: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=480&q=80",
};

function sportImage(sport?: string): string {
  return SPORT_FALLBACK_IMGS[(sport ?? "").toLowerCase()] ??
    "https://images.unsplash.com/photo-1483721310020-03333e577078?w=480&q=80";
}

export default function OpenPlayList() {
  const navigate = useNavigate();
  const { activeRole, availableRoles, switchRole } = useRole();
  const { data: currentUserData } = useCurrentUser({ retry: false });
  const isLoggedIn = !!(currentUserData as any)?.user || !!(currentUserData as any)?.id;
  const [sportFilter, setSportFilter] = useState<string>("");

  const { data: openPlaysRes, isLoading, isError } = useOpenPlays({
    sport: sportFilter || undefined,
  });

  const { data: sportsRes } = useSports();

  const items: Array<Record<string, unknown>> = Array.isArray(openPlaysRes?.data)
    ? (openPlaysRes.data as Array<Record<string, unknown>>)
    : Array.isArray(openPlaysRes)
    ? (openPlaysRes as Array<Record<string, unknown>>)
    : [];

  const sports: Array<{ id: number; name: string; displayName: string }> = Array.isArray(sportsRes?.data)
    ? (sportsRes.data as any[])
    : Array.isArray(sportsRes)
    ? (sportsRes as any[])
    : [];

  const filterSports = sports;

  return (
    <div className="pb-24 px-4 pt-8 max-w-md mx-auto">
      {/* ── Header ── */}
      <div className="mb-8">
        <h1 className="text-white mb-1" style={{ fontSize: "28px", fontWeight: "700", lineHeight: "130%" }}>
          Open Play
        </h1>
        <p className="text-[#94A3B8]" style={{ fontSize: "14px", fontWeight: "500" }}>
          Join pickup games in your area
        </p>
      </div>

      {/* ── Matchmaking shortcut for logged-in players ── */}
      {isLoggedIn && activeRole === "player" && (
        <button
          onClick={() => navigate("/matchmaking")}
          className="w-full mb-4 flex items-center gap-3 px-4 py-3 text-left"
          style={{
            borderRadius: "14px",
            backgroundColor: "rgba(59,130,246,0.08)",
            border: "1px solid rgba(59,130,246,0.2)",
          }}
        >
          <Target style={{ width: "18px", height: "18px", color: "#3B82F6", flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <p className="text-white" style={{ fontSize: "14px", fontWeight: "700" }}>Find My Match</p>
            <p className="text-[#64748B]" style={{ fontSize: "12px" }}>Personalised games based on your skill rating</p>
          </div>
          <ChevronRight style={{ width: "16px", height: "16px", color: "#3B82F6", flexShrink: 0 }} />
        </button>
      )}

      {/* ── Contextual Coach Prompt ── */}
      {activeRole === "player" && availableRoles.includes("coach") && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3"
          style={{ borderRadius: "14px", backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
          <Dumbbell style={{ width: "16px", height: "16px", color: "#22C55E", flexShrink: 0 }} />
          <p className="text-[#94A3B8] flex-1" style={{ fontSize: "12px" }}>
            Hosting regularly? <span style={{ color: "#22C55E", fontWeight: "700" }}>Switch to Coach mode</span> to manage sessions.
          </p>
          <button onClick={() => switchRole("coach")}
            className="flex items-center gap-0.5 flex-shrink-0"
            style={{ fontSize: "12px", fontWeight: "700", color: "#22C55E" }}>
            Switch <ChevronRight style={{ width: "12px", height: "12px" }} />
          </button>
        </div>
      )}

      {/* ── Host a Session CTA ── */}
      <div className="mb-8">
        <Link
          to="/open-plays/create"
          className="w-full bg-[#3B82F6] p-4 flex items-center justify-between transition-all duration-200 active:scale-[0.98]"
          style={{ borderRadius: "16px", display: "flex" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center bg-white/20"
              style={{ width: "40px", height: "40px", borderRadius: "12px" }}
            >
              <UserPlus style={{ width: "20px", height: "20px", color: "#FFFFFF" }} />
            </div>
            <div>
              <div className="text-white" style={{ fontSize: "18px", fontWeight: "600", lineHeight: "130%" }}>
                Host a Session
              </div>
              <div className="text-white/80" style={{ fontSize: "14px", fontWeight: "500" }}>
                Create your own game
              </div>
            </div>
          </div>
          <UserPlus style={{ width: "20px", height: "20px", color: "#FFFFFF" }} />
        </Link>
      </div>

      {/* ── Filter Pills ── */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => setSportFilter("")}
          className="px-4 py-2 whitespace-nowrap transition-colors"
          style={{
            borderRadius: "999px",
            fontSize: "14px",
            fontWeight: "600",
            backgroundColor: !sportFilter ? "#3B82F6" : "#111827",
            color: !sportFilter ? "#FFFFFF" : "#94A3B8",
            border: !sportFilter ? "none" : "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          All Sports
        </button>
        {filterSports.map((s) => (
          <div key={s.id} className="relative shrink-0 flex items-center">
            <button
              onClick={() => setSportFilter(s.name === sportFilter ? "" : s.name)}
              className="px-4 py-2 whitespace-nowrap transition-colors"
              style={{
                borderRadius: "999px",
                fontSize: "14px",
                fontWeight: "600",
                backgroundColor: sportFilter === s.name ? "#3B82F6" : "#111827",
                color: sportFilter === s.name ? "#FFFFFF" : "#94A3B8",
                border: sportFilter === s.name ? "none" : "1px solid rgba(255, 255, 255, 0.06)",
              }}
            >
              {s.displayName}
            </button>
            <span className="absolute -top-1.5 -right-1.5 z-10">
              <SportRulebook sport={s} />
            </span>
          </div>
        ))}
      </div>

      {/* ── Session Cards ── */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-72 bg-[#1E293B] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="bg-[#1E293B] p-10 text-center" style={{ borderRadius: "16px" }}>
          <span className="text-4xl block mb-3">⚠️</span>
          <p className="text-white mb-1" style={{ fontSize: "16px", fontWeight: "600" }}>Couldn't load sessions</p>
          <p className="text-[#64748B]" style={{ fontSize: "13px" }}>Check your connection and try again</p>
        </div>
      ) : items.length === 0 ? (
        <div
          className="bg-[#1E293B] p-12 text-center"
          style={{ borderRadius: "16px", border: "1px solid rgba(255, 255, 255, 0.05)" }}
        >
          <span className="text-5xl block mb-4">🏃</span>
          <h2 className="text-white mb-2" style={{ fontSize: "18px", fontWeight: "600" }}>
            No open sessions yet
          </h2>
          <p className="text-[#94A3B8]" style={{ fontSize: "14px" }}>
            Be the first to host a game!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((op) => {
            const playerCount = (op._count as { players?: number })?.players ?? (op.playerCount as number) ?? 0;
            const maxPlayers = (op.maxPlayers as number) ?? 0;
            const spotsLeft = Math.max(0, maxPlayers - playerCount);
            const isFilling = maxPlayers > 0 && spotsLeft <= 3;
            const fillPct = maxPlayers > 0 ? (playerCount / maxPlayers) * 100 : 0;
            const venue = op.venue as { name?: string; location?: { city?: string | null } | null } | undefined;
            const sport = op.sport as string | undefined;
            const level = (op.skillLevel ?? op.level) as string | undefined;
            const price = op.pricePerPlayer as number | undefined;
            const host = (op.createdBy ?? op.host) as { name?: string } | string | undefined;
            const hostName = typeof host === "string" ? host : host?.name ?? "Unknown";
            const imgSrc = sportImage(sport);
            const timeStr = op.startTime
              ? `${op.bookingDate ? format(new Date(op.bookingDate as string), "MMM d") : "Today"}, ${op.startTime as string}`
              : op.bookingDate
              ? format(new Date(op.bookingDate as string), "MMM d, h:mm a")
              : "—";
            const status = op.status as string;
            const isCancelled = status === "cancelled" || status === "completed";
            const isSessionFull = status === "full";

            return (
              <div
                key={op.id as number}
                className="bg-[#1E293B] overflow-hidden"
                style={{ borderRadius: "16px", border: "1px solid rgba(255, 255, 255, 0.05)" }}
              >
                {/* Image */}
                <div className="relative" style={{ height: "128px" }}>
                  <img
                    src={imgSrc}
                    alt={sport ?? "session"}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = sportImage(sport); }}
                  />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #1E293B, transparent)" }} />
                  {sport && (
                    <div
                      className="absolute top-3 left-3 px-3 py-1"
                      style={{
                        borderRadius: "999px",
                        backgroundColor: "rgba(59, 130, 246, 0.15)",
                        backdropFilter: "blur(8px)",
                      }}
                    >
                      <span className="text-[#3B82F6]" style={{ fontSize: "12px", fontWeight: "500" }}>
                        {sport}
                      </span>
                    </div>
                  )}
                  {isFilling && (
                    <div
                      className="absolute top-3 right-3 px-3 py-1"
                      style={{
                        borderRadius: "999px",
                        backgroundColor: "rgba(245, 158, 11, 0.15)",
                        backdropFilter: "blur(8px)",
                      }}
                    >
                      <span className="text-[#F59E0B]" style={{ fontSize: "12px", fontWeight: "500" }}>
                        {spotsLeft} spots left
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="mb-4">
                    <h3 className="text-white mb-1" style={{ fontSize: "18px", fontWeight: "600" }}>
                      {(op.title as string) || venue?.name || `${sport} Open Play`}
                    </h3>
                    {venue?.name && (
                      <div className="flex items-center gap-1 text-[#94A3B8]" style={{ fontSize: "14px" }}>
                        <MapPin style={{ width: "14px", height: "14px" }} />
                        <span>{venue.name}{venue.location?.city ? `, ${venue.location.city}` : ""}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between" style={{ fontSize: "14px", fontWeight: "500" }}>
                      <div className="flex items-center gap-2 text-white">
                        <Clock style={{ width: "16px", height: "16px", color: "#94A3B8" }} />
                        <span>{timeStr}</span>
                      </div>
                      {op.endTime != null && String(op.endTime) !== "" && (
                        <span className="text-[#94A3B8]">{op.startTime as string} – {op.endTime as string}</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between" style={{ fontSize: "14px", fontWeight: "500" }}>
                      <div className="flex items-center gap-2">
                        <Users style={{ width: "16px", height: "16px", color: "#94A3B8" }} />
                        <span className="text-white">
                          {playerCount}/{maxPlayers || "?"} players
                        </span>
                      </div>
                      {level && (
                        <div
                          className="px-2 py-1"
                          style={{ borderRadius: "999px", backgroundColor: getLevelColor(level).bg }}
                        >
                          <span style={{ fontSize: "12px", fontWeight: "500", color: getLevelColor(level).text }}>
                            {level}
                          </span>
                        </div>
                      )}
                    </div>

                    <div
                      className="flex items-center justify-between pt-3"
                      style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)", fontSize: "14px", fontWeight: "500" }}
                    >
                      <div className="text-[#94A3B8]">
                        Hosted by <span className="text-white">{hostName}</span>
                      </div>
                      <div className="text-[#3B82F6]" style={{ fontSize: "16px", fontWeight: "600" }}>
                        {price && price > 0 ? `₹${price}` : "Free"}
                      </div>
                    </div>
                  </div>

                  {/* Progress bar — sport colour gradient */}
                  {maxPlayers > 0 && (
                    <div className="mb-4">
                      <div className="flex justify-between mb-1.5" style={{ fontSize: "11px", color: "#94A3B8" }}>
                        <span>🕐 {typeof op.startTime === "string" ? op.startTime : "—"}</span>
                        <span>{playerCount}/{maxPlayers} players</span>
                      </div>
                      <div className="w-full bg-[#334155] overflow-hidden" style={{ height: "4px", borderRadius: "999px" }}>
                        <div
                          className="h-full transition-all duration-300"
                          style={{
                            width: `${fillPct}%`,
                            borderRadius: "999px",
                            background: `linear-gradient(90deg, ${getSportColor(sport)}99, ${getSportColor(sport)})`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => navigate(`/open-plays/${op.id}`)}
                    disabled={isCancelled}
                    className="w-full text-white flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
                    style={{
                      height: "48px",
                      borderRadius: "14px",
                      fontSize: "15px",
                      fontWeight: "700",
                      border: "none",
                      cursor: isCancelled ? "not-allowed" : "pointer",
                      background: isCancelled
                        ? "#334155"
                        : isSessionFull
                        ? "linear-gradient(90deg, #F59E0B, #F59E0Bcc)"
                        : `linear-gradient(90deg, ${getSportColor(sport)}, ${getSportColor(sport)}cc)`,
                      opacity: isCancelled ? 0.5 : 1,
                    }}
                  >
                    <UserPlus style={{ width: "16px", height: "16px" }} />
                    {isCancelled ? "Cancelled" : isSessionFull ? "Session Full — View" : "Join Session"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
