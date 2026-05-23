/**
 * Sport Analytics Hub — Engagement & Retention Layer
 *
 * Key insight: "Retention comes from progress visibility"
 * → Users stay when they see: improvement · consistency · competition
 */
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, Trophy, Target, Flame, Zap, BarChart3,
  Calendar, ChevronRight, TrendingUp, Award, Star, Lock,
} from "lucide-react";
import { useSports, usePlayerStats, useMyMatchHistory, useCurrentUser } from "@sportza/api-client";
import { matchOutcome } from "./matchOutcome";

// ─── Types ────────────────────────────────────────────────────────────────────
type SportStat = {
  sport?: string;
  totalMatches?: number;
  matchesWon?: number;
  matchesLost?: number;
  winPercentage?: number;
};
type SportItem = { id?: number; name?: string; displayName?: string };

// ─── Sport emoji ──────────────────────────────────────────────────────────────
const SPORT_EMOJI: Record<string, string> = {
  badminton: "🏸", tennis: "🎾", padel: "🎾", football: "⚽", cricket: "🏏",
  basketball: "🏀", squash: "🎾", volleyball: "🏐", pickleball: "🏓",
};
function sportEmoji(name: string) { return SPORT_EMOJI[name?.toLowerCase()] ?? "🏅"; }

// ─── Sport gradient for progress bars ────────────────────────────────────────
const SPORT_GRADIENTS: Record<string, string> = {
  badminton:  "linear-gradient(90deg,#3B82F6,#6366F1)",
  tennis:     "linear-gradient(90deg,#F59E0B,#EF4444)",
  padel:      "linear-gradient(90deg,#F59E0B,#D97706)",
  football:   "linear-gradient(90deg,#22C55E,#16A34A)",
  cricket:    "linear-gradient(90deg,#8B5CF6,#EC4899)",
  basketball: "linear-gradient(90deg,#F97316,#EF4444)",
  pickleball: "linear-gradient(90deg,#14B8A6,#0891B2)",
};
function sportGradient(name: string) { return SPORT_GRADIENTS[name?.toLowerCase()] ?? "linear-gradient(90deg,#3B82F6,#22C55E)"; }

// ─── Achievements ────────────────────────────────────────────────────────────
const ACHIEVEMENTS = [
  { id: "hat-trick",    icon: "🎩", title: "Hat-Trick",     desc: "Win 3 in a row",    threshold: 3,   key: "winStreak",      color: "#F59E0B" },
  { id: "early-bird",  icon: "🌅", title: "Early Bird",    desc: "10 morning sessions",threshold: 10,  key: "morningSessions",color: "#3B82F6" },
  { id: "century",     icon: "💯", title: "Century Club",  desc: "Play 100 games",    threshold: 100, key: "totalGames",     color: "#8B5CF6" },
  { id: "streak",      icon: "🔥", title: "On Fire",       desc: "5-game win streak",  threshold: 5,   key: "winStreak",      color: "#EF4444" },
  { id: "community",   icon: "🤝", title: "Community Pro", desc: "20 open play games", threshold: 20,  key: "openPlay",       color: "#22C55E" },
  { id: "elite",       icon: "⚡", title: "Elite Player",  desc: "60% win rate",       threshold: 60,  key: "winRate",        color: "#F97316" },
];

// ─── Circular progress ring ───────────────────────────────────────────────────
function Ring({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) {
  const r  = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const fill = circ - (circ * Math.min(pct, 100)) / 100;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#111827" strokeWidth="8" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={fill}
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
    </svg>
  );
}

// ─── Weekly streak dots ───────────────────────────────────────────────────────
function WeekStreak({ activeDays }: { activeDays: boolean[] }) {
  const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div className="flex gap-2 items-center">
      {DAY_LABELS.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5">
          <div
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              backgroundColor: activeDays[i] ? "#3B82F6" : "#111827",
              border: activeDays[i] ? "none" : "2px solid rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {activeDays[i] && <Flame style={{ width: "14px", height: "14px", color: "white" }} />}
          </div>
          <span className="text-[#64748B]" style={{ fontSize: "10px", fontWeight: "600" }}>{d}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SportAnalyticsHub() {
  const navigate = useNavigate();
  const [selectedSport, setSelectedSport] = useState<string | null>(null);

  const { data: userRes }   = useCurrentUser();
  const { data: sportsRes } = useSports();
  const { data: statsData } = usePlayerStats();
  const { data: matchesRes } = useMyMatchHistory({ limit: 50 });

  const user      = (userRes as any)?.data ?? (userRes as any);
  const userId: number = (user as any)?.id ?? 0;
  const userName  = (user as any)?.name ?? "Athlete";

  const sportsRaw = ((sportsRes as any)?.data ?? (sportsRes as any) ?? []) as SportItem[];
  const statsArr  = (Array.isArray(statsData) ? statsData : ((statsData as any)?.data ?? [])) as SportStat[];
  const matches   = (Array.isArray((matchesRes as any)?.data) ? (matchesRes as any).data : Array.isArray(matchesRes) ? matchesRes : []) as Array<Record<string, any>>;

  // ── Aggregate ──────────────────────────────────────────────────────────────
  const totalGames = statsArr.reduce((s, st) => s + (st.totalMatches ?? 0), 0);
  const totalWins  = statsArr.reduce((s, st) => s + (st.matchesWon   ?? 0), 0);
  const winRate    = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;
  const hoursPlayed = Math.round(totalGames * 1.5);

  // ── Win streak (consecutive wins from most recent match for this user) ─────
  const winStreak = useMemo(() => {
    if (!userId) return 0;
    let streak = 0;
    for (const m of matches) {
      const outcome = matchOutcome(m, userId);
      if (outcome === "win") streak++;
      else break;
    }
    return streak;
  }, [matches, userId]);

  // ── Sports breakdown ───────────────────────────────────────────────────────
  const sportsBreakdown = useMemo(() =>
    statsArr
      .map((s) => ({ sport: s.sport ?? "Unknown", games: s.totalMatches ?? 0, wins: s.matchesWon ?? 0 }))
      .sort((a, b) => b.games - a.games),
    [statsArr]
  );
  const maxGames = Math.max(sportsBreakdown[0]?.games ?? 1, 1);

  // ── Favorite sport ─────────────────────────────────────────────────────────
  const favSport = sportsBreakdown[0]?.sport ?? "—";

  // ── Real weekly activity: Mon–Sun of current week ─────────────────────────
  const weekStreak = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      const next = new Date(day);
      next.setDate(day.getDate() + 1);
      return matches.some((m) => {
        const d = new Date((m.matchDate ?? m.bookingDate ?? 0) as string);
        return !isNaN(d.getTime()) && d >= day && d < next;
      });
    });
  }, [matches]);

  // ── Achievement values ─────────────────────────────────────────────────────
  const morningSessions = useMemo(
    () => matches.filter((m) => new Date((m.matchDate ?? m.bookingDate ?? 0) as string).getHours() < 9).length,
    [matches]
  );
  const openPlay = useMemo(
    () => matches.filter((m) => (m.matchType as string) === "OPEN_PLAY").length,
    [matches]
  );
  const achievementValues: Record<string, number> = {
    totalGames,
    winStreak,
    winRate,
    morningSessions,
    openPlay,
  };

  // ── Display sports list ────────────────────────────────────────────────────
  const displaySports = sportsRaw.length > 0 ? sportsRaw : sportsBreakdown.map((s) => ({ name: s.sport, displayName: s.sport }));

  // ── Filter stats by selected sport ────────────────────────────────────────
  const filteredStats = selectedSport
    ? statsArr.filter((s) => s.sport?.toLowerCase() === selectedSport.toLowerCase())
    : statsArr;
  const filteredGames = filteredStats.reduce((s, st) => s + (st.totalMatches ?? 0), 0);
  const filteredWins  = filteredStats.reduce((s, st) => s + (st.matchesWon   ?? 0), 0);
  const filteredWinRate = filteredGames > 0 ? Math.round((filteredWins / filteredGames) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#0F172A] pb-24">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2" style={{ height: "64px" }}>
        <button onClick={() => navigate(-1)} className="p-2 -ml-2">
          <ChevronLeft style={{ width: "22px", height: "22px", color: "#FFFFFF" }} />
        </button>
        <div>
          <h1 className="text-white" style={{ fontSize: "20px", fontWeight: "800" }}>Sport Analytics</h1>
          <p className="text-[#64748B]" style={{ fontSize: "12px" }}>
            {userName}'s performance hub
          </p>
        </div>
      </div>

      <div className="px-4 space-y-5 max-w-md mx-auto">
        {/* ── Hero stats row ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Games",    value: totalGames,    icon: <BarChart3 style={{ width: "16px", height: "16px" }} />, color: "#3B82F6" },
            { label: "Win Rate", value: `${winRate}%`, icon: <Target     style={{ width: "16px", height: "16px" }} />, color: "#22C55E" },
            { label: "Est. Hours", value: `~${hoursPlayed}`, icon: <Calendar style={{ width: "16px", height: "16px" }} />, color: "#F59E0B" },
          ].map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center py-4"
              style={{ borderRadius: "18px", backgroundColor: "#1E293B" }}
            >
              <div className="mb-2" style={{ color: s.color }}>{s.icon}</div>
              <span className="text-white" style={{ fontSize: "22px", fontWeight: "800" }}>{s.value}</span>
              <span className="text-[#64748B]" style={{ fontSize: "11px", fontWeight: "500" }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* ── Win rate ring ── */}
        <div
          className="flex items-center gap-5 p-5"
          style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}
        >
          <div className="relative shrink-0">
            <Ring pct={winRate} color="#3B82F6" size={88} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-white" style={{ fontSize: "20px", fontWeight: "800" }}>{winRate}%</span>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-white mb-1" style={{ fontSize: "17px", fontWeight: "700" }}>Win Rate</h3>
            <p className="text-[#94A3B8] mb-3" style={{ fontSize: "13px" }}>
              {totalWins}W · {totalGames - totalWins}L across {totalGames} games
            </p>
            {winStreak > 0 && (
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1.5"
                style={{
                  borderRadius: "999px",
                  backgroundColor: "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(239,68,68,0.3)",
                }}
              >
                <Flame style={{ width: "13px", height: "13px", color: "#EF4444" }} />
                <span className="text-[#EF4444]" style={{ fontSize: "12px", fontWeight: "700" }}>
                  {winStreak}-game streak!
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Weekly streak ── */}
        <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Flame style={{ width: "17px", height: "17px", color: "#EF4444" }} />
              <h3 className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>This Week</h3>
            </div>
            <span
              className="px-3 py-1"
              style={{ borderRadius: "999px", backgroundColor: "rgba(239,68,68,0.1)", fontSize: "12px", fontWeight: "700", color: "#EF4444" }}
            >
              {weekStreak.filter(Boolean).length} days active
            </span>
          </div>
          <WeekStreak activeDays={weekStreak} />
        </div>

        {/* ── Sport filter pills ── */}
        <div>
          <h3 className="text-white mb-3" style={{ fontSize: "16px", fontWeight: "700" }}>By Sport</h3>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            <button
              onClick={() => setSelectedSport(null)}
              className="shrink-0 px-4 py-2 transition-all"
              style={{
                borderRadius: "999px",
                fontSize: "13px",
                fontWeight: "600",
                backgroundColor: !selectedSport ? "#3B82F6" : "#1E293B",
                color: !selectedSport ? "#FFFFFF" : "#94A3B8",
              }}
            >
              All
            </button>
            {displaySports.map((s) => {
              const name = (s as any).displayName ?? (s as any).name ?? "";
              const raw  = (s as any).name ?? name;
              const sel  = selectedSport === raw;
              return (
                <button
                  key={name}
                  onClick={() => setSelectedSport(sel ? null : raw)}
                  className="shrink-0 px-4 py-2 transition-all whitespace-nowrap"
                  style={{
                    borderRadius: "999px",
                    fontSize: "13px",
                    fontWeight: "600",
                    backgroundColor: sel ? "#3B82F6" : "#1E293B",
                    color: sel ? "#FFFFFF" : "#94A3B8",
                  }}
                >
                  {sportEmoji(raw)} {name}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Sport breakdown bars ── */}
        <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp style={{ width: "17px", height: "17px", color: "#94A3B8" }} />
            <h3 className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Performance</h3>
          </div>

          {sportsBreakdown.length === 0 ? (
            <p className="text-[#64748B] text-center py-4" style={{ fontSize: "14px" }}>
              Play some games to see your stats!
            </p>
          ) : (
            <div className="space-y-4">
              {(selectedSport
                ? sportsBreakdown.filter((s) => s.sport.toLowerCase() === selectedSport.toLowerCase())
                : sportsBreakdown
              ).map((s) => {
                const wr = s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0;
                return (
                  <button
                    key={s.sport}
                    onClick={() => navigate(`/stats/sport/${s.sport.toLowerCase()}`)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: "18px" }}>{sportEmoji(s.sport)}</span>
                        <span className="text-white" style={{ fontSize: "14px", fontWeight: "700" }}>
                          {s.sport}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[#94A3B8]" style={{ fontSize: "12px" }}>
                          {s.games} games
                        </span>
                        <span
                          className="px-2 py-0.5"
                          style={{
                            borderRadius: "999px",
                            fontSize: "11px",
                            fontWeight: "700",
                            backgroundColor: wr >= 50 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                            color: wr >= 50 ? "#22C55E" : "#EF4444",
                          }}
                        >
                          {wr}% WR
                        </span>
                        <ChevronRight style={{ width: "14px", height: "14px", color: "#475569" }} />
                      </div>
                    </div>
                    {/* Bar */}
                    <div style={{ height: "6px", borderRadius: "999px", backgroundColor: "#111827", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${(s.games / maxGames) * 100}%`,
                          borderRadius: "999px",
                          background: sportGradient(s.sport),
                          transition: "width 0.6s ease",
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Favorite sport callout ── */}
        {favSport !== "—" && (
          <div
            className="flex items-center gap-4 p-4"
            style={{
              borderRadius: "18px",
              background: "linear-gradient(135deg,rgba(59,130,246,0.15),rgba(99,102,241,0.15))",
              border: "1px solid rgba(99,102,241,0.3)",
            }}
          >
            <span style={{ fontSize: "36px" }}>{sportEmoji(favSport)}</span>
            <div>
              <p className="text-[#94A3B8]" style={{ fontSize: "12px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Favourite Sport
              </p>
              <p className="text-white mt-0.5" style={{ fontSize: "18px", fontWeight: "800" }}>
                {favSport}
              </p>
            </div>
            <div className="ml-auto">
              <Star style={{ width: "22px", height: "22px", color: "#F59E0B", fill: "#F59E0B" }} />
            </div>
          </div>
        )}

        {/* ── Achievements ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Award style={{ width: "17px", height: "17px", color: "#F59E0B" }} />
              <h3 className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Achievements</h3>
            </div>
            <span className="text-[#64748B]" style={{ fontSize: "13px" }}>
              {ACHIEVEMENTS.filter((a) => (achievementValues[a.key] ?? 0) >= a.threshold).length}/{ACHIEVEMENTS.length} earned
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {ACHIEVEMENTS.map((a) => {
              const val     = achievementValues[a.key] ?? 0;
              const pct     = Math.min((val / a.threshold) * 100, 100);
              const unlocked = pct >= 100;

              return (
                <div
                  key={a.id}
                  className="p-4"
                  style={{
                    borderRadius: "18px",
                    backgroundColor: unlocked ? "#1E293B" : "#111827",
                    border: unlocked
                      ? `1px solid ${a.color}40`
                      : "1px solid rgba(255,255,255,0.04)",
                    opacity: unlocked ? 1 : 0.55,
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <span style={{ fontSize: "28px" }}>{a.icon}</span>
                    {unlocked ? (
                      <div style={{ borderRadius: "999px", backgroundColor: `${a.color}20`, padding: "2px 8px" }}>
                        <span style={{ fontSize: "10px", fontWeight: "700", color: a.color }}>EARNED</span>
                      </div>
                    ) : (
                      <Lock style={{ width: "14px", height: "14px", color: "#475569" }} />
                    )}
                  </div>
                  <p className="text-white mb-0.5" style={{ fontSize: "13px", fontWeight: "700" }}>
                    {a.title}
                  </p>
                  <p className="text-[#64748B] mb-3" style={{ fontSize: "11px" }}>{a.desc}</p>
                  {/* Progress bar */}
                  <div style={{ height: "4px", borderRadius: "999px", backgroundColor: "#0F172A", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        borderRadius: "999px",
                        backgroundColor: a.color,
                        transition: "width 0.6s ease",
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-[#475569]" style={{ fontSize: "10px", fontWeight: "600" }}>
                    {Math.min(val, a.threshold)}/{a.threshold}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Leaderboard teaser ── */}
        <button
          onClick={() => navigate("/stats/leaderboard")}
          className="w-full flex items-center justify-between p-4 transition-colors"
          style={{
            borderRadius: "18px",
            background: "linear-gradient(135deg,rgba(139,92,246,0.15),rgba(59,130,246,0.15))",
            border: "1px solid rgba(139,92,246,0.3)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 flex items-center justify-center"
              style={{ borderRadius: "12px", backgroundColor: "rgba(139,92,246,0.2)" }}
            >
              <Trophy style={{ width: "20px", height: "20px", color: "#8B5CF6" }} />
            </div>
            <div className="text-left">
              <p className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>Leaderboard</p>
              <p className="text-[#94A3B8]" style={{ fontSize: "12px" }}>See how you rank</p>
            </div>
          </div>
          <ChevronRight style={{ width: "18px", height: "18px", color: "#94A3B8" }} />
        </button>
      </div>
    </div>
  );
}
