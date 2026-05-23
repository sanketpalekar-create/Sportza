/**
 * Sport Dashboard — Per-Sport Performance Deep Dive
 *
 * Key insight: "Per-sport identity builds engagement"
 */
import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft, Trophy, Target, TrendingUp,
  Calendar, MapPin, Clock, ChevronRight,
} from "lucide-react";
import { usePlayerStats, useMyMatchHistory, useCurrentUser } from "@sportza/api-client";
import { matchOutcome } from "./matchOutcome";
import { format } from "date-fns";

type SportStat = {
  sport?: string;
  totalMatches?: number;
  matchesWon?: number;
  matchesLost?: number;
  winPercentage?: number;
};

const SPORT_EMOJI: Record<string, string> = {
  badminton: "🏸", tennis: "🎾", padel: "🎾", football: "⚽", cricket: "🏏",
  basketball: "🏀", squash: "🎾", volleyball: "🏐", pickleball: "🏓",
};

function Ring({ pct, color, size = 90 }: { pct: number; color: string; size?: number }) {
  const r    = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const fill = circ - (circ * Math.min(pct, 100)) / 100;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#111827" strokeWidth="9" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
        strokeWidth="9" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={fill}
        style={{ transition: "stroke-dashoffset 0.8s ease" }} />
    </svg>
  );
}

function resolveTeamName(val: unknown, fallback: string): string {
  if (!val) return fallback;
  if (typeof val === "string") return val;
  return (val as { name?: string }).name ?? fallback;
}

function MatchRow({ match, sport, userId }: { match: Record<string, any>; sport: string; userId: number }) {
  const navigate  = useNavigate();
  const teamKeys  = match.teams ? Object.keys(match.teams as Record<string, unknown>) : [];
  const raw       = match.teams as Record<string, unknown> ?? {};
  const names     = { [teamKeys[0]]: resolveTeamName(raw[teamKeys[0]], "Team A"), [teamKeys[1]]: resolveTeamName(raw[teamKeys[1]], "Team B") };
  const scores    = match.scores as Record<string, number> ?? {};
  const outcome   = matchOutcome(match, userId);
  const isWin     = outcome === "win";
  const isDraw    = outcome === "draw" || outcome === "unknown";
  const scoreStr  = teamKeys.length >= 2
    ? `${scores[teamKeys[0]] ?? "-"} – ${scores[teamKeys[1]] ?? "-"}`
    : "—";
  const venue     = (match.venue as any)?.name ?? (match.venueName as string) ?? "";
  const dateStr   = match.matchDate ?? match.bookingDate;
  const date      = dateStr ? (() => { try { return new Date(dateStr); } catch { return null; } })() : null;

  return (
    <button
      onClick={() => navigate(`/stats/match/${match.id}`)}
      className="w-full text-left flex items-center gap-3 py-3.5 transition-colors"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
    >
      {/* Result dot */}
      <div
        className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full"
        style={{
          backgroundColor: isDraw
            ? "rgba(148,163,184,0.1)"
            : isWin ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
        }}
      >
        <span style={{ fontSize: "14px", fontWeight: "800",
          color: isDraw ? "#94A3B8" : isWin ? "#22C55E" : "#EF4444" }}>
          {isDraw ? "D" : isWin ? "W" : "L"}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white" style={{ fontSize: "14px", fontWeight: "600" }}>
          {teamKeys.length >= 2 ? `${names[teamKeys[0]] ?? "Team A"} vs ${names[teamKeys[1]] ?? "Team B"}` : "Match"}
        </p>
        <div className="flex items-center gap-2 mt-0.5 text-[#64748B]">
          {venue && <><MapPin style={{ width: "11px", height: "11px" }} /><span style={{ fontSize: "12px" }}>{venue}</span></>}
          {date && <><span style={{ fontSize: "12px" }}>·</span><span style={{ fontSize: "12px" }}>{format(date, "MMM d")}</span></>}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[#94A3B8]" style={{ fontSize: "14px", fontWeight: "700" }}>{scoreStr}</p>
        <ChevronRight style={{ width: "14px", height: "14px", color: "#475569", margin: "0 auto" }} />
      </div>
    </button>
  );
}

export default function SportDashboard() {
  const { sport } = useParams<{ sport: string }>();
  const navigate  = useNavigate();
  const sportName = sport ?? "";
  const emoji     = SPORT_EMOJI[sportName.toLowerCase()] ?? "🏅";

  const { data: userRes }    = useCurrentUser();
  const { data: statsData }  = usePlayerStats();
  const { data: matchesRes } = useMyMatchHistory({ limit: 100, sportName: sportName || undefined });

  const user    = (userRes as any)?.data ?? (userRes as any);
  const userId: number = (user as any)?.id ?? 0;

  const allStats  = (Array.isArray(statsData) ? statsData : (statsData as any)?.data ?? []) as SportStat[];
  // Matches are already filtered to this sport + this user by the API
  const matches = (Array.isArray((matchesRes as any)?.data) ? (matchesRes as any).data : Array.isArray(matchesRes) ? matchesRes : []) as Array<Record<string, any>>;

  const stat    = allStats.find((s) => s.sport?.toLowerCase() === sportName.toLowerCase());

  const total  = stat?.totalMatches ?? matches.length;
  const wins   = stat?.matchesWon   ?? 0;
  const losses = stat?.matchesLost  ?? 0;
  const draws  = Math.max(0, total - wins - losses);
  const wr     = total > 0 ? Math.round((wins / total) * 100) : 0;
  const hours  = Math.round(total * 1.5);

  // Monthly freq: group matches by month
  const monthFreq = useMemo(() => {
    const map: Record<string, number> = {};
    matches.forEach((m) => {
      const d = m.matchDate ?? m.bookingDate;
      if (!d) return;
      try {
        const key = format(new Date(d), "MMM");
        map[key] = (map[key] ?? 0) + 1;
      } catch { /* ignore */ }
    });
    return Object.entries(map).slice(-6);
  }, [matches]);
  const maxFreq = Math.max(...monthFreq.map(([, v]) => v), 1);

  return (
    <div className="min-h-screen bg-[#0F172A] pb-24">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4" style={{ height: "64px" }}>
        <button onClick={() => navigate(-1)} className="p-2 -ml-2">
          <ChevronLeft style={{ width: "22px", height: "22px", color: "#FFFFFF" }} />
        </button>
        <span style={{ fontSize: "24px" }}>{emoji}</span>
        <div>
          <h1 className="text-white" style={{ fontSize: "20px", fontWeight: "800", textTransform: "capitalize" }}>
            {sportName}
          </h1>
          <p className="text-[#64748B]" style={{ fontSize: "12px" }}>Your performance</p>
        </div>
      </div>

      <div className="px-4 space-y-4 max-w-md mx-auto">
        {/* ── Win rate hero ── */}
        <div className="flex items-center gap-5 p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
          <div className="relative shrink-0">
            <Ring pct={wr} color={wr >= 50 ? "#22C55E" : "#EF4444"} size={96} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-white" style={{ fontSize: "22px", fontWeight: "800" }}>{wr}%</span>
              <span className="text-[#64748B]" style={{ fontSize: "10px" }}>WIN</span>
            </div>
          </div>
          <div>
            <div className="grid grid-cols-3 gap-4 mb-3">
              {[
                { label: "Played", value: total, color: "#FFFFFF" },
                { label: "Won",    value: wins,  color: "#22C55E" },
                { label: "Lost",   value: losses, color: "#EF4444" },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <p style={{ fontSize: "24px", fontWeight: "800", color: s.color }}>{s.value}</p>
                  <p className="text-[#64748B]" style={{ fontSize: "11px" }}>{s.label}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 text-[#94A3B8]">
              <Clock style={{ width: "14px", height: "14px" }} />
              <span style={{ fontSize: "13px" }}>~{hours} hours played (est.)</span>
            </div>
          </div>
        </div>

        {/* ── Stats grid ── */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Win Rate", value: `${wr}%`, icon: <Target style={{ width: "16px", height: "16px" }} />, color: wr >= 50 ? "#22C55E" : "#EF4444" },
            { label: "Draws",    value: draws,    icon: <TrendingUp style={{ width: "16px", height: "16px" }} />, color: "#94A3B8" },
            { label: "Est. Hours", value: `~${hours}`, icon: <Clock style={{ width: "16px", height: "16px" }} />, color: "#F59E0B" },
            { label: "Matches",  value: total,    icon: <Trophy style={{ width: "16px", height: "16px" }} />, color: "#3B82F6" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3 p-4"
              style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
              <div className="w-9 h-9 flex items-center justify-center shrink-0"
                style={{ borderRadius: "10px", backgroundColor: "#111827", color: s.color }}>
                {s.icon}
              </div>
              <div>
                <p className="text-white" style={{ fontSize: "20px", fontWeight: "800" }}>{s.value}</p>
                <p className="text-[#64748B]" style={{ fontSize: "11px" }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Monthly frequency chart ── */}
        {monthFreq.length > 0 && (
          <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp style={{ width: "17px", height: "17px", color: "#94A3B8" }} />
              <h3 className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Play Frequency</h3>
            </div>
            <div className="flex items-end gap-2" style={{ height: "80px" }}>
              {monthFreq.map(([month, count]) => (
                <div key={month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full overflow-hidden" style={{ height: "60px", display: "flex", alignItems: "flex-end" }}>
                    <div
                      className="w-full"
                      style={{
                        height: `${(count / maxFreq) * 100}%`,
                        minHeight: "4px",
                        borderRadius: "4px 4px 0 0",
                        background: "linear-gradient(180deg,#3B82F6,#6366F1)",
                        transition: "height 0.6s ease",
                      }}
                    />
                  </div>
                  <span className="text-[#64748B]" style={{ fontSize: "10px", fontWeight: "600" }}>{month}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Match history ── */}
        <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
          <div className="flex items-center gap-2 mb-2">
            <Calendar style={{ width: "17px", height: "17px", color: "#94A3B8" }} />
            <h3 className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Match History</h3>
          </div>
          {matches.length === 0 ? (
            <p className="text-[#64748B] text-center py-8" style={{ fontSize: "14px" }}>
              No {sportName} matches recorded yet
            </p>
          ) : (
            <div>
              {matches.slice(0, 10).map((m) => (
                <MatchRow key={m.id as number} match={m} sport={sportName} userId={userId} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
