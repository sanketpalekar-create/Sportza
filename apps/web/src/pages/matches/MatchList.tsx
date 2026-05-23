import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMatches, useSports, useCurrentUser } from "@sportza/api-client";
import { Activity, MapPin, Calendar, ChevronRight, Radio } from "lucide-react";
import { format } from "date-fns";
import { getEngine, normaliseState } from "../../lib/scoring";

const STATUS_TABS = [
  { key: "",          label: "All"       },
  { key: "live",      label: "Live"      },
  { key: "scheduled", label: "Upcoming"  },
  { key: "completed", label: "Completed" },
] as const;

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  live:      { color: "#EF4444", bg: "rgba(239,68,68,0.12)",   label: "LIVE"      },
  scheduled: { color: "#3B82F6", bg: "rgba(59,130,246,0.12)",  label: "UPCOMING"  },
  completed: { color: "#22C55E", bg: "rgba(34,197,94,0.12)",   label: "COMPLETED" },
};

const SPORT_EMOJI: Record<string, string> = {
  football: "⚽", cricket: "🏏", badminton: "🏸", tennis: "🎾",
  padel: "🎾", basketball: "🏀", volleyball: "🏐", pickleball: "🏓",
};

function getTeamNames(teams: unknown) {
  if (!teams || typeof teams !== "object") return { teamA: "Team A", teamB: "Team B" };
  const t = teams as Record<string, unknown>;
  const keys = Object.keys(t);
  const resolve = (v: unknown, fallback: string): string => {
    if (!v) return fallback;
    if (typeof v === "string") return v;
    // team stored as { name, players } object
    return (v as { name?: string }).name ?? fallback;
  };
  return {
    teamA: resolve(t[keys[0]], "Team A"),
    teamB: resolve(t[keys[1]], "Team B"),
  };
}

function getScore(
  scores: unknown, status: string,
  sportName: string, teamNames: { A: string; B: string },
) {
  if (status !== "live" && status !== "completed") return null;
  if (!scores || typeof scores !== "object") return null;
  try {
    const state = normaliseState(scores, sportName);
    const display = getEngine(sportName).display(state as any, teamNames);
    return display.primary;
  } catch {
    return null;
  }
}

export default function MatchList() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sportFilter, setSportFilter]   = useState<string>("");

  const { data: userRes } = useCurrentUser();
  const rawUser = userRes as any;
  const user = rawUser?.user ?? rawUser?.data?.user ?? rawUser?.data ?? rawUser;
  const userId = user?.id as number | undefined;

  const { data: matchesRes, isLoading } = useMatches({
    status: statusFilter || undefined,
    sportId: sportFilter ? Number(sportFilter) : undefined,
    userId,
    page: 1, limit: 50,
  });

  const { data: sportsRes } = useSports();
  const matches: Array<Record<string, unknown>> = (matchesRes as any)?.data ?? [];
  const sports: Array<{ id: number; name: string; displayName: string }> = (sportsRes as any)?.data ?? [];

  return (
    <div className="min-h-screen bg-[#0F172A] pb-28">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0F172A]">
        <div className="px-4 pt-8 pb-3">
          <h1 className="text-white" style={{ fontSize: "22px", fontWeight: "800" }}>Matches</h1>
          <p className="text-[#64748B]" style={{ fontSize: "12px" }}>{matches.length} match{matches.length !== 1 ? "es" : ""} found</p>
        </div>

        {/* Status filter */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
          {STATUS_TABS.map((tab) => {
            const active = statusFilter === tab.key;
            return (
              <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
                className="flex-shrink-0 px-4 py-2"
                style={{ borderRadius: "10px", fontSize: "13px", fontWeight: active ? "700" : "500",
                  backgroundColor: active ? "#3B82F6" : "#1E293B",
                  color: active ? "#fff" : "#64748B",
                  border: active ? "none" : "1px solid rgba(255,255,255,0.06)" }}>
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Sport filter */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
          <button onClick={() => setSportFilter("")}
            className="flex-shrink-0 px-3 py-1.5"
            style={{ borderRadius: "8px", fontSize: "12px", fontWeight: !sportFilter ? "700" : "500",
              backgroundColor: !sportFilter ? "#1E40AF" : "#1E293B", color: !sportFilter ? "#93C5FD" : "#64748B",
              border: !sportFilter ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(255,255,255,0.06)" }}>
            All Sports
          </button>
          {sports.map((s) => (
            <button key={s.id} onClick={() => setSportFilter(String(s.id))}
              className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5"
              style={{ borderRadius: "8px", fontSize: "12px",
                fontWeight: sportFilter === String(s.id) ? "700" : "500",
                backgroundColor: sportFilter === String(s.id) ? "#1E40AF" : "#1E293B",
                color: sportFilter === String(s.id) ? "#93C5FD" : "#64748B",
                border: sportFilter === String(s.id) ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(255,255,255,0.06)" }}>
              {SPORT_EMOJI[(s.name ?? "").toLowerCase()] ?? "🎯"} {s.displayName}
            </button>
          ))}
        </div>
      </div>

      {/* Match list */}
      <div className="px-4 space-y-3 max-w-md mx-auto">
        {isLoading && [1,2,3].map((i) => (
          <div key={i} className="animate-pulse h-28 rounded-2xl" style={{ backgroundColor: "#1E293B" }} />
        ))}

        {!isLoading && matches.length === 0 && (
          <div className="p-12 text-center" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <Activity style={{ width: "40px", height: "40px", color: "#334155", margin: "0 auto 12px" }} />
            <p className="text-white mb-1" style={{ fontSize: "17px", fontWeight: "700" }}>No matches found</p>
            <p className="text-[#64748B]" style={{ fontSize: "13px" }}>Try changing your filters</p>
          </div>
        )}

        {!isLoading && matches.map((m) => {
          const status  = (m.status as string) ?? "scheduled";
          const isLive  = status === "live";
          const style   = STATUS_STYLE[status] ?? STATUS_STYLE.scheduled;
          const { teamA, teamB } = getTeamNames(m.teams);
          const sport   = m.sport as { displayName?: string; name?: string } | undefined;
          const venue   = m.venue as { name?: string; location?: { city?: string | null } | null } | undefined;
          const sportName = (sport?.name ?? sport?.displayName ?? "").toLowerCase();
          const score   = getScore(m.scores, status, sportName, { A: teamA, B: teamB });
          const emoji   = SPORT_EMOJI[sportName] ?? "🎯";

          return (
            <button key={m.id as number} onClick={() => navigate(`/matches/${m.id}`)}
              className="w-full p-4 text-left hover:bg-white/5 transition-colors"
              style={{ borderRadius: "16px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.04)" }}>

              {/* Top row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: "18px" }}>{emoji}</span>
                  <span className="text-[#94A3B8]" style={{ fontSize: "12px" }}>
                    {sport?.displayName ?? sport?.name ?? "Match"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isLive && (
                    <div className="flex items-center gap-1">
                      <Radio style={{ width: "10px", height: "10px", color: "#EF4444" }} className="animate-pulse" />
                    </div>
                  )}
                  <div className="flex items-center gap-1 px-2 py-0.5"
                    style={{ borderRadius: "6px", backgroundColor: style.bg }}>
                    <span style={{ fontSize: "10px", fontWeight: "800", color: style.color }}>{style.label}</span>
                  </div>
                </div>
              </div>

              {/* Teams & Score */}
              <div className="flex items-center gap-3 mb-3">
                <span className="flex-1 text-white truncate" style={{ fontSize: "15px", fontWeight: "700", textAlign: "left" }}>
                  {teamA}
                </span>
                {score ? (
                  <span className="flex-shrink-0 text-[#3B82F6]" style={{ fontSize: "18px", fontWeight: "800" }}>{score}</span>
                ) : (
                  <span className="flex-shrink-0 text-[#475569]" style={{ fontSize: "14px" }}>vs</span>
                )}
                <span className="flex-1 text-white truncate" style={{ fontSize: "15px", fontWeight: "700", textAlign: "right" }}>
                  {teamB}
                </span>
              </div>

              {/* Meta */}
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-3">
                  {venue?.name && (
                    <div className="flex items-center gap-1 text-[#64748B]">
                      <MapPin style={{ width: "11px", height: "11px" }} />
                      <span style={{ fontSize: "11px" }}>{venue.name}{venue.location?.city ? `, ${venue.location.city}` : ""}</span>
                    </div>
                  )}
                  {m.matchDate != null && String(m.matchDate) !== "" && (
                    <div className="flex items-center gap-1 text-[#64748B]">
                      <Calendar style={{ width: "11px", height: "11px" }} />
                      <span style={{ fontSize: "11px" }}>{format(new Date(String(m.matchDate)), "MMM d, h:mm a")}</span>
                    </div>
                  )}
                </div>
                <ChevronRight style={{ width: "16px", height: "16px", color: "#334155" }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
