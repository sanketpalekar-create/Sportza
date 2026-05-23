/**
 * Leaderboard — Competition & Social Motivation
 *
 * Key insight: "Drives competitive retention"
 * → Show rankings clearly, highlight user's position, create aspiration
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Trophy, Medal, Star } from "lucide-react";
import { useLeaderboard, useCurrentUser } from "@sportza/api-client";

type Entry = {
  rank?: number;
  player?: { id?: number; name?: string; avatar?: string; location?: { city?: string; state?: string } | null };
  sport?: string;
  totalMatches?: number;
  matchesWon?: number;
  winPercentage?: number;
};

type PeriodFilter = "all" | "month" | "week";

const SPORT_EMOJI: Record<string, string> = {
  badminton: "🏸", tennis: "🎾", padel: "🎾", football: "⚽", cricket: "🏏",
  basketball: "🏀", squash: "🎾", volleyball: "🏐", pickleball: "🏓",
};

const MEDAL_COLORS = ["#F59E0B", "#94A3B8", "#CD7C4A"]; // gold, silver, bronze
const MEDAL_BG     = ["rgba(245,158,11,0.15)", "rgba(148,163,184,0.1)", "rgba(205,124,74,0.1)"];

function PodiumCard({ entry, rank }: { entry: Entry; rank: 0 | 1 | 2 }) {
  const heights = ["h-24", "h-16", "h-12"];
  const sizes   = [60, 50, 46];
  const name    = entry.player?.name ?? "Player";
  const initials = name.split(" ").map((n) => n[0]?.toUpperCase()).join("").slice(0, 2);

  return (
    <div className={`flex flex-col items-center ${rank === 0 ? "order-2" : rank === 1 ? "order-1" : "order-3"}`}>
      {/* Crown for 1st */}
      {rank === 0 && <span style={{ fontSize: "24px", marginBottom: "4px" }}>👑</span>}

      {/* Avatar */}
      <div
        className="flex items-center justify-center text-white mb-2"
        style={{
          width: sizes[rank], height: sizes[rank],
          borderRadius: "50%",
          background: `linear-gradient(135deg,${MEDAL_COLORS[rank]},${MEDAL_COLORS[rank]}99)`,
          fontSize: rank === 0 ? "20px" : "16px",
          fontWeight: "700",
          border: `3px solid ${MEDAL_COLORS[rank]}`,
          boxShadow: `0 0 20px ${MEDAL_COLORS[rank]}40`,
        }}
      >
        {initials}
      </div>

      {/* Name */}
      <p className="text-white text-center" style={{ fontSize: "12px", fontWeight: "700", maxWidth: "72px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
        {name.split(" ")[0]}
      </p>

      {/* Score */}
      <p style={{ fontSize: "11px", color: MEDAL_COLORS[rank], fontWeight: "600" }}>
        {entry.matchesWon ?? 0} pts
      </p>

      {/* Podium block */}
      <div
        className={`w-16 mt-2 flex items-center justify-center ${heights[rank]}`}
        style={{
          borderRadius: "8px 8px 0 0",
          backgroundColor: MEDAL_BG[rank],
          border: `1px solid ${MEDAL_COLORS[rank]}30`,
        }}
      >
        <span className="text-white" style={{ fontSize: "18px", fontWeight: "800" }}>
          #{rank + 1}
        </span>
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const [sportFilter, setSportFilter]   = useState("");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [cityFilter,  setCityFilter]    = useState("");
  const [stateFilter, setStateFilter]   = useState("");

  const { data: userRes } = useCurrentUser();
  const user     = (userRes as any)?.data ?? (userRes as any);
  const myId     = user?.id;

  // Default city filter to current user's city on first load
  const myCity  = user?.location?.city  ?? "";
  const myState = user?.location?.state ?? "";

  const { data: lbData } = useLeaderboard({
    sport: sportFilter || undefined,
    city:  cityFilter  || undefined,
    state: stateFilter || undefined,
  });

  const rawList = (Array.isArray(lbData) ? lbData : (lbData as any)?.data ?? []) as Entry[];

  // De-dup sports from list
  const sports = Array.from(new Set(rawList.map((e) => e.sport).filter(Boolean))) as string[];

  // Derive unique cities + states from the leaderboard data
  const cities  = Array.from(new Set(rawList.map((e) => (e.player as any)?.location?.city).filter(Boolean))) as string[];
  const states  = Array.from(new Set(rawList.map((e) => (e.player as any)?.location?.state).filter(Boolean))) as string[];

  const filtered = sportFilter
    ? rawList.filter((e) => e.sport === sportFilter)
    : rawList;

  const top3    = filtered.slice(0, 3);
  const rest    = filtered.slice(3);
  const myRank  = filtered.findIndex((e) => e.player?.id === myId);

  const PERIODS: { key: PeriodFilter; label: string }[] = [
    { key: "all",   label: "All Time" },
    { key: "month", label: "This Month" },
    { key: "week",  label: "This Week" },
  ];

  return (
    <div className="min-h-screen bg-[#0F172A] pb-24">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4" style={{ height: "64px" }}>
        <button onClick={() => navigate(-1)} className="p-2 -ml-2">
          <ChevronLeft style={{ width: "22px", height: "22px", color: "#FFFFFF" }} />
        </button>
        <div>
          <h1 className="text-white" style={{ fontSize: "20px", fontWeight: "800" }}>Leaderboard</h1>
          <p className="text-[#64748B]" style={{ fontSize: "12px" }}>Top players on Sportza</p>
        </div>
      </div>

      {/* ── My rank callout ── */}
      {myRank >= 0 && (
        <div className="mx-4 mb-4 flex items-center gap-3 px-4 py-3"
          style={{ borderRadius: "16px", background: "linear-gradient(135deg,rgba(59,130,246,0.15),rgba(99,102,241,0.15))", border: "1px solid rgba(59,130,246,0.3)" }}>
          <Trophy style={{ width: "18px", height: "18px", color: "#3B82F6" }} />
          <span className="text-white" style={{ fontSize: "14px" }}>
            You're ranked <span style={{ fontWeight: "800", color: "#3B82F6" }}>#{myRank + 1}</span>
            {sportFilter ? ` in ${sportFilter}` : " overall"}
          </span>
        </div>
      )}

      <div className="px-4 max-w-md mx-auto">
        {/* ── Filters ── */}
        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide pb-1">
          {/* Period — All Time is live; month/week are not yet supported by the API */}
          {PERIODS.map((p) => {
            const isActive = periodFilter === p.key;
            const isDisabled = p.key !== "all";
            return (
              <button
                key={p.key}
                onClick={() => !isDisabled && setPeriodFilter(p.key)}
                title={isDisabled ? "Period filtering coming soon" : undefined}
                className="shrink-0 px-3 py-2 whitespace-nowrap"
                style={{
                  borderRadius: "999px", fontSize: "12px", fontWeight: "600",
                  backgroundColor: isActive ? "#3B82F6" : "#1E293B",
                  color: isActive ? "#FFFFFF" : isDisabled ? "#334155" : "#64748B",
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  opacity: isDisabled ? 0.5 : 1,
                }}
              >
                {p.label}
              </button>
            );
          })}

          <div style={{ width: "1px", backgroundColor: "rgba(255,255,255,0.08)", flexShrink: 0 }} />

          {/* Sports */}
          <button
            onClick={() => setSportFilter("")}
            className="shrink-0 px-3 py-2"
            style={{ borderRadius: "999px", fontSize: "12px", fontWeight: "600",
              backgroundColor: !sportFilter ? "#3B82F6" : "#1E293B",
              color: !sportFilter ? "#FFFFFF" : "#64748B" }}
          >
            All Sports
          </button>
          {sports.map((s) => (
            <button
              key={s}
              onClick={() => setSportFilter(s === sportFilter ? "" : s)}
              className="shrink-0 px-3 py-2 whitespace-nowrap"
              style={{ borderRadius: "999px", fontSize: "12px", fontWeight: "600",
                backgroundColor: sportFilter === s ? "#3B82F6" : "#1E293B",
                color: sportFilter === s ? "#FFFFFF" : "#64748B" }}
            >
              {SPORT_EMOJI[s.toLowerCase()] ?? "🏅"} {s}
            </button>
          ))}
        </div>

        {/* ── City filter chips ── */}
        {(myCity || cities.length > 0) && (
          <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide pb-1">
            <button
              onClick={() => { setCityFilter(""); setStateFilter(""); }}
              className="shrink-0 px-3 py-2 whitespace-nowrap"
              style={{ borderRadius: "999px", fontSize: "12px", fontWeight: "600",
                backgroundColor: !cityFilter ? "#0F172A" : "#1E293B",
                border: `1px solid ${!cityFilter ? "#3B82F6" : "rgba(255,255,255,0.08)"}`,
                color: !cityFilter ? "#3B82F6" : "#64748B" }}
            >
              All Cities
            </button>
            {myCity && (
              <button
                onClick={() => { setCityFilter(cityFilter === myCity ? "" : myCity); setStateFilter(cityFilter === myCity ? "" : myState); }}
                className="shrink-0 px-3 py-2 whitespace-nowrap"
                style={{ borderRadius: "999px", fontSize: "12px", fontWeight: "600",
                  backgroundColor: cityFilter === myCity ? "#3B82F620" : "#1E293B",
                  border: `1px solid ${cityFilter === myCity ? "#3B82F6" : "rgba(255,255,255,0.08)"}`,
                  color: cityFilter === myCity ? "#3B82F6" : "#94A3B8" }}
              >
                📍 {myCity} (me)
              </button>
            )}
            {cities.filter((c) => c !== myCity).map((c) => (
              <button
                key={c}
                onClick={() => setCityFilter(c === cityFilter ? "" : c)}
                className="shrink-0 px-3 py-2 whitespace-nowrap"
                style={{ borderRadius: "999px", fontSize: "12px", fontWeight: "600",
                  backgroundColor: cityFilter === c ? "#1E293B" : "#1E293B",
                  border: `1px solid ${cityFilter === c ? "#3B82F6" : "rgba(255,255,255,0.08)"}`,
                  color: cityFilter === c ? "#3B82F6" : "#64748B" }}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {/* ── Podium ── */}
        {top3.length >= 3 && (
          <div className="flex justify-center items-end gap-3 mb-6 pb-4"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {(top3.slice(0, 3) as Entry[]).map((entry, i) => (
              <PodiumCard key={i} entry={entry} rank={i as 0 | 1 | 2} />
            ))}
          </div>
        )}

        {/* ── Ranked list ── */}
        {filtered.length === 0 ? (
          <div className="p-12 text-center" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <Trophy style={{ width: "48px", height: "48px", color: "#64748B", margin: "0 auto 16px" }} />
            <h2 className="text-white mb-2" style={{ fontSize: "18px", fontWeight: "700" }}>No rankings yet</h2>
            <p className="text-[#94A3B8]" style={{ fontSize: "14px" }}>
              {sportFilter ? `No data for ${sportFilter}` : "Play more games to appear here!"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((entry, idx) => {
              const rank    = entry.rank ?? idx + 1;
              const isMe    = entry.player?.id === myId;
              const name    = entry.player?.name ?? "Player";
              const initials = name.split(" ").map((n) => n[0]?.toUpperCase()).join("").slice(0, 2);
              const wr      = entry.winPercentage ?? (entry.totalMatches && entry.matchesWon
                ? Math.round((entry.matchesWon / entry.totalMatches) * 100) : 0);

              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3"
                  style={{
                    borderRadius: "16px",
                    backgroundColor: isMe ? "rgba(59,130,246,0.12)" : "#1E293B",
                    border: isMe ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  {/* Rank */}
                  <div
                    className="w-8 h-8 flex items-center justify-center shrink-0"
                    style={{
                      borderRadius: "50%",
                      backgroundColor: rank <= 3 ? `${MEDAL_COLORS[rank - 1]}20` : "#111827",
                    }}
                  >
                    {rank <= 3 ? (
                      <Medal style={{ width: "16px", height: "16px", color: MEDAL_COLORS[rank - 1] }} />
                    ) : (
                      <span className="text-[#64748B]" style={{ fontSize: "13px", fontWeight: "700" }}>{rank}</span>
                    )}
                  </div>

                  {/* Avatar */}
                  <div
                    className="w-9 h-9 flex items-center justify-center text-white shrink-0"
                    style={{ borderRadius: "50%", backgroundColor: isMe ? "#3B82F6" : "#334155", fontSize: "13px", fontWeight: "700" }}
                  >
                    {initials}
                  </div>

                  {/* Name + sport */}
                  <div className="flex-1 min-w-0">
                    <p className="truncate" style={{ fontSize: "14px", fontWeight: "700", color: isMe ? "#FFFFFF" : "#E2E8F0" }}>
                      {name}{isMe ? " (You)" : ""}
                    </p>
                    <p className="text-[#64748B]" style={{ fontSize: "12px" }}>
                      {entry.totalMatches ?? 0} games · {wr}% WR
                    </p>
                  </div>

                  {/* Points */}
                  <div className="text-right shrink-0">
                    <p style={{ fontSize: "18px", fontWeight: "800", color: rank <= 3 ? MEDAL_COLORS[rank - 1] : "#FFFFFF" }}>
                      {entry.matchesWon ?? 0}
                    </p>
                    <p className="text-[#64748B]" style={{ fontSize: "10px" }}>pts</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
