/**
 * Score a Match — hub page.
 * Shows live / upcoming / completed matches and a CTA to start a new one.
 * Replaces the Open Play tab in the player bottom nav.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMatches, useCurrentUser } from "@sportza/api-client";
import {
  Activity, Plus, MapPin, Calendar, ChevronRight, Radio, Trophy,
} from "lucide-react";
import { format } from "date-fns";
import { getEngine, normaliseState } from "../../lib/scoring";
import { resolveMatchScoreType } from "../../lib/scoring/matchScoreType";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: "",           label: "All"       },
  { key: "live",       label: "Live"      },
  { key: "scheduled",  label: "Upcoming"  },
  { key: "completed",  label: "Completed" },
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTeamNames(teams: unknown) {
  if (!teams || typeof teams !== "object") return { teamA: "Team A", teamB: "Team B" };
  const t = teams as Record<string, unknown>;
  const keys = Object.keys(t);
  const resolve = (v: unknown, fallback: string): string => {
    if (!v) return fallback;
    if (typeof v === "string") return v;
    return (v as { name?: string }).name ?? fallback;
  };
  return {
    teamA: resolve(t[keys[0]], "Team A"),
    teamB: resolve(t[keys[1]], "Team B"),
  };
}

function getScore(
  scores: unknown,
  status: string,
  meta: { sportName: string; scoreType?: string; formatName?: string },
  teamNames: { A: string; B: string },
) {
  if (status !== "live" && status !== "completed") return null;
  if (!scores || typeof scores !== "object") return null;
  try {
    const scoreType = resolveMatchScoreType(meta);
    const state = normaliseState(scores, scoreType);
    const display = getEngine(scoreType).display(state as any, teamNames);
    return display.primary;
  } catch {
    return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScoreMatch() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sportFilter, setSportFilter]   = useState<string>("");

  const { data: userRes } = useCurrentUser();
  const rawUser = userRes as any;
  const user = rawUser?.user ?? rawUser?.data?.user ?? rawUser?.data ?? rawUser;
  const userId = user?.id as number | undefined;

  const { data: matchesRes, isLoading } = useMatches({
    status: statusFilter || undefined,
    userId,
    page: 1,
    limit: 50,
  });

  const allMatches: Array<Record<string, unknown>> = (matchesRes as any)?.data ?? [];
  const matches = sportFilter
    ? allMatches.filter((m) => {
        const sport = m.sport as { name?: string; displayName?: string } | undefined;
        const sName = (sport?.name ?? sport?.displayName ?? "").toLowerCase();
        return sName === sportFilter;
      })
    : allMatches;
  const liveCount = allMatches.filter((m) => m.status === "live").length;

  return (
    <div className="min-h-screen bg-[#0F172A] pb-28 max-w-md mx-auto">

      {/* ── Header ── */}
      <div className="px-4 pt-8 pb-4">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h1 className="text-white" style={{ fontSize: "26px", fontWeight: "800" }}>Score a Match</h1>
            <p className="text-[#64748B]" style={{ fontSize: "13px" }}>Track live scores for any sport</p>
          </div>
          {liveCount > 0 && (
            <div
              className="flex items-center gap-1.5 px-3 py-1 mt-1"
              style={{ borderRadius: "999px", backgroundColor: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}
            >
              <Radio style={{ width: "10px", height: "10px", color: "#EF4444" }} className="animate-pulse" />
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#EF4444" }}>{liveCount} Live</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Hero CTA ── */}
      <div className="px-4 mb-5">
        <button
          onClick={() => navigate("/matches/create")}
          className="w-full flex items-center gap-4 p-4 text-left active:scale-[0.98] transition-transform"
          style={{
            borderRadius: "20px",
            background: "linear-gradient(135deg, #1D1060 0%, #0f172a 50%, #1a2540 100%)",
            border: "1px solid rgba(99,102,241,0.3)",
          }}
        >
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: "52px", height: "52px", borderRadius: "16px", backgroundColor: "rgba(99,102,241,0.2)" }}
          >
            <Activity style={{ width: "26px", height: "26px", color: "#818CF8" }} />
          </div>
          <div className="flex-1">
            <p className="text-white" style={{ fontSize: "17px", fontWeight: "800" }}>Start New Match</p>
            <p className="text-[#94A3B8] mt-0.5" style={{ fontSize: "13px" }}>
              Pick sport, name teams, go live
            </p>
          </div>
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: "36px", height: "36px", borderRadius: "12px", backgroundColor: "rgba(99,102,241,0.2)" }}
          >
            <Plus style={{ width: "20px", height: "20px", color: "#818CF8" }} />
          </div>
        </button>
      </div>

      {/* ── Sport filter pills ── */}
      <div className="flex gap-2 px-4 mb-5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {[
          ["🏸", "Badminton"],
          ["🎾", "Tennis"],
          ["🎾", "Padel"],
          ["🏏", "Cricket"],
          ["⚽", "Football"],
          ["🏀", "Basketball"],
          ["🏐", "Volleyball"],
          ["🏓", "Pickleball"],
        ].map(([emoji, name]) => {
          const key = (name as string).toLowerCase();
          const active = sportFilter === key;
          return (
            <button
              key={name}
              onClick={() => setSportFilter(active ? "" : key)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 transition-colors"
              style={{
                borderRadius: "999px",
                backgroundColor: active ? "rgba(59,130,246,0.18)" : "#1E293B",
                border: active ? "1px solid rgba(59,130,246,0.55)" : "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <span style={{ fontSize: "14px" }}>{emoji}</span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: active ? "#60A5FA" : "#64748B",
                }}
              >
                {name}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Status filter ── */}
      <div className="flex gap-2 px-4 mb-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {STATUS_TABS.map(({ key, label }) => {
          const active = statusFilter === key;
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className="flex-shrink-0 px-4 py-2"
              style={{
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: active ? "700" : "500",
                backgroundColor: active ? "#3B82F6" : "#1E293B",
                color: active ? "#fff" : "#64748B",
                border: active ? "none" : "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Match list ── */}
      <div className="px-4 space-y-3">
        {isLoading && [1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse h-28 rounded-2xl" style={{ backgroundColor: "#1E293B" }} />
        ))}

        {!isLoading && matches.length === 0 && (
          <div
            className="p-10 text-center"
            style={{ borderRadius: "20px", backgroundColor: "#1E293B", border: "1px dashed rgba(255,255,255,0.08)" }}
          >
            <Trophy style={{ width: "36px", height: "36px", color: "#334155", margin: "0 auto 12px" }} />
            <p className="text-white mb-1" style={{ fontSize: "16px", fontWeight: "700" }}>No matches yet</p>
            <p className="text-[#64748B] mb-4" style={{ fontSize: "13px" }}>Start your first match and track the score live</p>
            <button
              onClick={() => navigate("/matches/create")}
              className="inline-flex items-center gap-2 px-5 py-2.5"
              style={{ borderRadius: "12px", backgroundColor: "#3B82F6", fontSize: "14px", fontWeight: "700", color: "#fff" }}
            >
              <Plus style={{ width: "16px", height: "16px" }} /> Start a Match
            </button>
          </div>
        )}

        {!isLoading && matches.map((m) => {
          const status = (m.status as string) ?? "scheduled";
          const isLive = status === "live";
          const style  = STATUS_STYLE[status] ?? STATUS_STYLE.scheduled;
          const { teamA, teamB } = getTeamNames(m.teams);
          const sport   = m.sport as { displayName?: string; name?: string } | undefined;
          const venue   = m.venue as { name?: string; location?: { city?: string | null } | null } | undefined;
          const sportName = (sport?.name ?? sport?.displayName ?? "").toLowerCase();
          const score = getScore(m.scores, status, {
            sportName,
            scoreType: (m as { scoreType?: string }).scoreType,
            formatName: (m as { formatName?: string }).formatName,
          }, { A: teamA, B: teamB });
          const emoji   = SPORT_EMOJI[sportName] ?? "🎯";

          return (
            <button
              key={m.id as number}
              onClick={() => navigate(`/matches/${m.id}`)}
              className="w-full p-4 text-left hover:bg-white/5 transition-colors"
              style={{ borderRadius: "16px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.04)" }}
            >
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
                    <Radio style={{ width: "10px", height: "10px", color: "#EF4444" }} className="animate-pulse" />
                  )}
                  <div
                    className="flex items-center gap-1 px-2 py-0.5"
                    style={{ borderRadius: "6px", backgroundColor: style.bg }}
                  >
                    <span style={{ fontSize: "10px", fontWeight: "800", color: style.color }}>{style.label}</span>
                  </div>
                </div>
              </div>

              {/* Teams & score */}
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
                  {m.matchDate != null && String(m.matchDate) !== "" ? (
                    <div className="flex items-center gap-1 text-[#64748B]">
                      <Calendar style={{ width: "11px", height: "11px" }} />
                      <span style={{ fontSize: "11px" }}>{format(new Date(String(m.matchDate)), "MMM d, h:mm a")}</span>
                    </div>
                  ) : null}
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
