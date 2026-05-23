/**
 * Match Analytics — Depth for Serious Players
 *
 * Key insight: "Detailed stats = serious players hook"
 */
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, MapPin, Calendar, Clock, Trophy, Target, Activity } from "lucide-react";
import { useMatch } from "@sportza/api-client";
import { format } from "date-fns";

type MatchData      = Record<string, any>;
type EventItem      = { id?: number; eventType?: string; team?: string; player?: string; time?: string; detail?: string };
type PlayerStatItem = { id?: number; playerId?: number; player?: { name?: string }; stats?: Record<string, number>; team?: string };

const SPORT_EMOJI: Record<string, string> = {
  badminton: "🏸", tennis: "🎾", padel: "🎾", football: "⚽", cricket: "🏏",
  basketball: "🏀", squash: "🎾", volleyball: "🏐", pickleball: "🏓",
};

const EVENT_ICONS: Record<string, string> = {
  goal: "⚽", point: "🎯", wicket: "🏏", ace: "🎾", foul: "🟨",
  timeout: "⏸️", substitution: "🔄", injury: "🩹",
};

function Skeleton() {
  return (
    <div className="animate-pulse px-4 pt-4 space-y-4">
      <div className="h-48 rounded-2xl bg-[#1E293B]" />
      <div className="h-32 rounded-2xl bg-[#1E293B]" />
      <div className="h-48 rounded-2xl bg-[#1E293B]" />
    </div>
  );
}

export default function MatchAnalytics() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate    = useNavigate();
  const id          = matchId ? parseInt(matchId, 10) : 0;

  const { data: res, isLoading } = useMatch(id);
  const match = ((res as any)?.data ?? (res as any)) as MatchData | undefined;

  if (isLoading || !match) {
    return (
      <div className="min-h-screen bg-[#0F172A]">
        <div className="flex items-center gap-3 px-4" style={{ height: "56px" }}>
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ChevronLeft style={{ width: "22px", height: "22px", color: "#FFFFFF" }} />
          </button>
          <span className="text-white" style={{ fontSize: "17px", fontWeight: "600" }}>Match</span>
        </div>
        <Skeleton />
      </div>
    );
  }

  const teams      = (match.teams ?? {}) as Record<string, { players?: number[]; name?: string } | unknown>;
  const teamKeys   = Object.keys(teams);
  // Resolve display name from { name, players } shape or plain string
  const resolveTeamName = (v: unknown, fallback: string): string => {
    if (!v) return fallback;
    if (typeof v === "string") return v;
    return (v as { name?: string }).name ?? fallback;
  };
  const t0Name = resolveTeamName(teams[teamKeys[0]], "Team A");
  const t1Name = resolveTeamName(teams[teamKeys[1]], "Team B");
  const scores     = (match.scores ?? {}) as Record<string, number | string>;
  const winner     = match.winnerTeam as string | null | undefined;
  const sport      = (match.sport as any)?.displayName ?? (match.sport as any)?.name ?? (match.sport as string) ?? "";
  const venue      = (match.venue as any)?.name ?? "";
  const venueCity  = (match.venue as any)?.location?.city ?? "";
  const dateRaw    = match.matchDate ?? match.bookingDate;
  const date       = dateRaw ? (() => { try { return new Date(dateRaw); } catch { return null; } })() : null;
  const events     = ((match.events ?? []) as EventItem[]).slice(0, 20);
  const playerStats = (match.playerStats ?? []) as PlayerStatItem[];
  const emoji      = SPORT_EMOJI[sport.toLowerCase()] ?? "🏅";

  const t0 = teamKeys[0];
  const t1 = teamKeys[1];
  const s0 = scores[t0] ?? 0;
  const s1 = scores[t1] ?? 0;
  // winnerTeam is "A" or "B" (set by scoring service), teamKeys are "teamA"/"teamB"
  const isWinner0 = winner === "A";
  const isWinner1 = winner === "B";

  return (
    <div className="min-h-screen bg-[#0F172A] pb-24">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4" style={{ height: "56px" }}>
        <button onClick={() => navigate(-1)} className="p-2 -ml-2">
          <ChevronLeft style={{ width: "22px", height: "22px", color: "#FFFFFF" }} />
        </button>
        <span style={{ fontSize: "20px" }}>{emoji}</span>
        <div>
          <span className="text-white" style={{ fontSize: "17px", fontWeight: "700" }}>Match Report</span>
          {date && <p className="text-[#64748B]" style={{ fontSize: "12px" }}>{format(date, "EEE, MMM d, yyyy")}</p>}
        </div>
      </div>

      <div className="px-4 space-y-4 max-w-md mx-auto">
        {/* ── Score card ── */}
        <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
          {/* Sport + status */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span style={{ fontSize: "20px" }}>{emoji}</span>
              <span className="text-[#94A3B8]" style={{ fontSize: "14px", fontWeight: "600" }}>{sport}</span>
            </div>
            <div
              className="px-3 py-1"
              style={{ borderRadius: "999px",
                backgroundColor: match.status === "completed" ? "rgba(34,197,94,0.1)" : "rgba(59,130,246,0.1)",
                border: match.status === "completed" ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(59,130,246,0.3)" }}
            >
              <span style={{ fontSize: "12px", fontWeight: "700",
                color: match.status === "completed" ? "#22C55E" : "#3B82F6", textTransform: "capitalize" }}>
                {match.status ?? "Completed"}
              </span>
            </div>
          </div>

          {/* Scoreboard */}
          <div className="flex items-center justify-between mb-5">
            {/* Team 1 */}
            <div className="flex-1 text-center">
              <p className="text-white truncate mb-1" style={{ fontSize: "15px", fontWeight: "700" }}>
                {t0Name}
              </p>
              <p style={{ fontSize: "48px", fontWeight: "900",
                color: isWinner0 ? "#22C55E" : "#FFFFFF", lineHeight: "1" }}>
                {s0}
              </p>
              {isWinner0 && (
                <div className="flex items-center justify-center gap-1 mt-2">
                  <Trophy style={{ width: "13px", height: "13px", color: "#F59E0B" }} />
                  <span className="text-[#F59E0B]" style={{ fontSize: "11px", fontWeight: "700" }}>Winner</span>
                </div>
              )}
            </div>

            {/* VS divider */}
            <div className="px-4">
              <div
                className="px-3 py-2 text-[#64748B]"
                style={{ borderRadius: "12px", backgroundColor: "#111827", fontSize: "14px", fontWeight: "700" }}
              >
                VS
              </div>
            </div>

            {/* Team 2 */}
            <div className="flex-1 text-center">
              <p className="text-white truncate mb-1" style={{ fontSize: "15px", fontWeight: "700" }}>
                {t1Name}
              </p>
              <p style={{ fontSize: "48px", fontWeight: "900",
                color: isWinner1 ? "#22C55E" : "#FFFFFF", lineHeight: "1" }}>
                {s1}
              </p>
              {isWinner1 && (
                <div className="flex items-center justify-center gap-1 mt-2">
                  <Trophy style={{ width: "13px", height: "13px", color: "#F59E0B" }} />
                  <span className="text-[#F59E0B]" style={{ fontSize: "11px", fontWeight: "700" }}>Winner</span>
                </div>
              )}
            </div>
          </div>

          {/* Venue + date strip */}
          <div
            className="flex items-center justify-center gap-4 pt-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            {venue && (
              <div className="flex items-center gap-1.5 text-[#64748B]">
                <MapPin style={{ width: "13px", height: "13px" }} />
                <span style={{ fontSize: "13px" }}>{venue}{venueCity ? `, ${venueCity}` : ""}</span>
              </div>
            )}
            {date && (
              <div className="flex items-center gap-1.5 text-[#64748B]">
                <Clock style={{ width: "13px", height: "13px" }} />
                <span style={{ fontSize: "13px" }}>{format(date, "h:mm a")}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Player stats ── */}
        {playerStats.length > 0 && (
          <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <div className="flex items-center gap-2 mb-4">
              <Activity style={{ width: "17px", height: "17px", color: "#94A3B8" }} />
              <h3 className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Player Stats</h3>
            </div>
            <div className="space-y-3">
              {playerStats.slice(0, 10).map((ps, i) => {
                const pName = ps.player?.name ?? `Player ${i + 1}`;
                const initials = pName.split(" ").map((n: string) => n[0]?.toUpperCase()).join("").slice(0, 2);
                const statEntries = ps.stats ? Object.entries(ps.stats).slice(0, 4) : [];

                return (
                  <div key={ps.id ?? i} className="flex items-start gap-3 py-3"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <div
                      className="w-9 h-9 flex items-center justify-center text-white shrink-0"
                      style={{ borderRadius: "50%", backgroundColor: "#334155", fontSize: "13px", fontWeight: "700" }}
                    >
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white mb-2" style={{ fontSize: "14px", fontWeight: "600" }}>{pName}</p>
                      {statEntries.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {statEntries.map(([key, val]) => (
                            <div key={key} className="px-2 py-1"
                              style={{ borderRadius: "8px", backgroundColor: "#111827" }}>
                              <span className="text-[#94A3B8]" style={{ fontSize: "11px" }}>
                                {key}: <span className="text-white font-semibold">{val}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Match events timeline ── */}
        {events.length > 0 && (
          <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <div className="flex items-center gap-2 mb-4">
              <Target style={{ width: "17px", height: "17px", color: "#94A3B8" }} />
              <h3 className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Match Events</h3>
            </div>
            <div className="relative">
              {/* Timeline line */}
              <div
                className="absolute left-4 top-0 bottom-0"
                style={{ width: "2px", backgroundColor: "rgba(255,255,255,0.06)" }}
              />
              <div className="space-y-4">
                {events.map((ev, i) => (
                  <div key={ev.id ?? i} className="flex items-start gap-4 relative">
                    {/* Dot */}
                    <div
                      className="w-8 h-8 flex items-center justify-center shrink-0 z-10"
                      style={{ borderRadius: "50%", backgroundColor: "#111827", border: "2px solid rgba(255,255,255,0.1)", fontSize: "14px" }}
                    >
                      {EVENT_ICONS[ev.eventType?.toLowerCase() ?? ""] ?? "•"}
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white" style={{ fontSize: "13px", fontWeight: "600", textTransform: "capitalize" }}>
                          {ev.eventType ?? "Event"}
                        </span>
                        {ev.time && (
                          <span className="text-[#64748B]" style={{ fontSize: "12px" }}>{ev.time}'</span>
                        )}
                      </div>
                      {(ev.player || ev.detail) && (
                        <p className="text-[#94A3B8]" style={{ fontSize: "12px" }}>
                          {[ev.player, ev.detail].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Summary ── */}
        {match.summary && (
          <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <h3 className="text-white mb-3" style={{ fontSize: "16px", fontWeight: "700" }}>Match Summary</h3>
            <p className="text-[#94A3B8]" style={{ fontSize: "14px", lineHeight: "1.65" }}>{match.summary as string}</p>
          </div>
        )}
      </div>
    </div>
  );
}
