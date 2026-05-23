import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentUser, usePlayerStats, useMyMatchHistory, useMySkillRatings, useRatingHistory } from "@sportza/api-client";
import { matchOutcome } from "./matchOutcome";
import { Trophy, Clock, Target, Zap, BarChart3, ChevronRight, Calendar, TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";

const SPORT_COLORS: Record<string, string> = {
  badminton:  "#3B82F6",
  football:   "#22C55E",
  cricket:    "#8B5CF6",
  tennis:     "#F59E0B",
  padel:      "#F59E0B",
  basketball: "#F97316",
  volleyball: "#06B6D4",
  pickleball: "#14B8A6",
};

function sportBarColor(sport: string) {
  return SPORT_COLORS[sport?.toLowerCase()] ?? "#3B82F6";
}

function RatingSparkline({ ratings, color }: { ratings: number[]; color: string }) {
  if (ratings.length < 2) {
    return <div style={{ width: "80px", height: "32px" }} />;
  }
  const w = 80;
  const h = 32;
  const min = Math.min(...ratings);
  const max = Math.max(...ratings);
  const range = max - min || 1;
  const pts = ratings.map((r, i) => {
    const x = (i / (ratings.length - 1)) * w;
    const y = h - ((r - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const isUp = ratings[ratings.length - 1] >= ratings[0];
  const lineColor = isUp ? "#22C55E" : "#EF4444";

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={lineColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
      {/* end dot */}
      {(() => {
        const lastPt = pts[pts.length - 1].split(",");
        return <circle cx={lastPt[0]} cy={lastPt[1]} r="3" fill={lineColor} />;
      })()}
    </svg>
  );
}

function ratingTierColor(rating: number) {
  if (rating >= 1400) return "#A855F7";
  if (rating >= 1200) return "#3B82F6";
  if (rating >= 1000) return "#22C55E";
  return "#F59E0B";
}
function ratingTierLabel(rating: number) {
  if (rating >= 1400) return "Elite";
  if (rating >= 1200) return "Advanced";
  if (rating >= 1000) return "Intermediate";
  return "Beginner";
}

const ACHIEVEMENTS = [
  { id: "early-bird",    icon: "🌅", title: "Early Bird",    desc: "10 morning sessions", threshold: 10,  key: "morningSessions" },
  { id: "streak-master", icon: "🔥", title: "Streak Master", desc: "5-game win streak",   threshold: 5,   key: "winStreak"       },
  { id: "social-player", icon: "🤝", title: "Social Player", desc: "Join 20 open plays",  threshold: 20,  key: "openPlaySessions"},
  { id: "century",       icon: "💯", title: "Century",       desc: "Play 100 games",      threshold: 100, key: "totalGames"      },
];

export default function StatsOverview() {
  const navigate = useNavigate();
  const { data: userRes }   = useCurrentUser();
  const { data: statsData } = usePlayerStats();
  const { data: matchesRes } = useMyMatchHistory({ limit: 50 });

  const user = (userRes as any)?.data ?? (userRes as any);
  const userId: number = (user as any)?.id ?? 0;
  const userName =
    user && typeof user === "object" && "name" in user
      ? (user as { name?: string }).name ?? "Your"
      : "Your";

  const stats: Array<Record<string, unknown>> = Array.isArray(statsData)
    ? (statsData as Array<Record<string, unknown>>)
    : ((statsData as { data?: Array<Record<string, unknown>> })?.data ?? []);

  const matches: Array<Record<string, unknown>> = Array.isArray((matchesRes as any)?.data)
    ? ((matchesRes as any).data as Array<Record<string, unknown>>)
    : Array.isArray(matchesRes)
    ? (matchesRes as Array<Record<string, unknown>>)
    : [];

  // ── Aggregate totals ──────────────────────────────────────────────────────
  const totalGames = useMemo(
    () => stats.reduce((sum, s) => sum + ((s.totalMatches as number) ?? 0), 0),
    [stats]
  );
  const totalWins = useMemo(
    () => stats.reduce((sum, s) => sum + ((s.matchesWon as number) ?? 0), 0),
    [stats]
  );
  const winRate     = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;
  const hoursPlayed = Math.round(totalGames * 1.5);

  // ── Win streak (consecutive wins from most recent match for this user) ────
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

  // ── Sports breakdown ──────────────────────────────────────────────────────
  const sportsBreakdown = useMemo(() =>
    stats
      .map((s) => ({ sport: (s.sport as string) ?? "Unknown", games: (s.totalMatches as number) ?? 0 }))
      .sort((a, b) => b.games - a.games),
    [stats]
  );
  const maxGames = Math.max(sportsBreakdown[0]?.games ?? 1, 1);

  // ── Achievement values ─────────────────────────────────────────────────────
  const morningSessions = useMemo(
    () => matches.filter((m) => new Date(m.matchDate as string).getHours() < 9).length,
    [matches]
  );
  const openPlaySessions = useMemo(
    () => matches.filter((m) => (m.matchType as string) === "OPEN_PLAY").length,
    [matches]
  );
  const achievementValues: Record<string, number> = {
    totalGames,
    winStreak,
    morningSessions,
    openPlaySessions,
  };

  // ── Recent activity ───────────────────────────────────────────────────────
  const recentActivity = useMemo(() => {
    return matches.slice(0, 5).map((m) => {
      // sport can be a plain string or a Sport object { name, displayName }
      const rawSport = m.sport;
      const sport =
        typeof rawSport === "string"
          ? rawSport
          : (rawSport as { displayName?: string; name?: string })?.displayName ??
            (rawSport as { name?: string })?.name ??
            (m.sportName as string) ??
            "";

      const teams    = (m.teams as Record<string, unknown>) ?? {};
      const scores   = (m.scores as Record<string, number | string>) ?? {};
      const teamKeys = Object.keys(teams);
      const venue    = (m.venue as { name?: string })?.name ?? (m.venueName as string) ?? "Unknown venue";
      const matchDate = m.matchDate as string | undefined;

      const outcome = matchOutcome(m, userId);
      const result: "win" | "loss" | "draw" =
        outcome === "win" ? "win" : outcome === "loss" ? "loss" : "draw";

      const scoreStr =
        teamKeys.length >= 2
          ? `${scores[teamKeys[0]] ?? "-"} – ${scores[teamKeys[1]] ?? "-"}`
          : "";

      return { id: m.id as number, sport, venue, result, scoreStr, matchDate };
    });
  }, [matches]);

  // ── Skill ratings ─────────────────────────────────────────────────────────
  const { data: ratingsData } = useMySkillRatings();
  const { data: historyData } = useRatingHistory({ limit: 30 });
  const skillRatings: any[] = (ratingsData as any)?.data ?? [];
  const allHistory: any[] = (historyData as any)?.data ?? [];

  // Group history by sportId for sparklines
  const historyBySport = useMemo(() => {
    const map: Record<number, number[]> = {};
    for (const h of [...allHistory].reverse()) {
      if (!map[h.sportId]) map[h.sportId] = [];
      map[h.sportId].push(h.newRating);
    }
    return map;
  }, [allHistory]);

  // ── Result badge helpers ───────────────────────────────────────────────────
  const resultColor  = { win: "#22C55E",  loss: "#EF4444",  draw: "#94A3B8" };
  const resultBg     = { win: "rgba(34,197,94,0.12)", loss: "rgba(239,68,68,0.12)", draw: "rgba(148,163,184,0.1)" };
  const resultLabel  = { win: "Win", loss: "Loss", draw: "Draw" };

  return (
    <div className="min-h-screen bg-[#0F172A] pb-24">

      {/* ── Header ── */}
      <div className="px-4 pt-8 pb-2">
        <h1 className="text-white" style={{ fontSize: "28px", fontWeight: "700", lineHeight: "130%" }}>
          {userName === "Your" ? "Your Stats" : `${userName}'s Stats`}
        </h1>
        <p className="text-[#94A3B8]" style={{ fontSize: "13px", marginTop: "4px" }}>
          Track your performance across all sports
        </p>
      </div>

      <div className="px-4 space-y-5 max-w-md mx-auto">

        {/* ── Sport Analytics deep-dive CTA ── */}
        <button
          onClick={() => navigate("/stats/analytics")}
          className="w-full p-5 text-left active:scale-[0.98] transition-transform duration-150 relative overflow-hidden"
          style={{ borderRadius: "18px", background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)" }}
        >
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center"
                style={{ width: "48px", height: "48px", borderRadius: "14px", backgroundColor: "rgba(255,255,255,0.18)" }}
              >
                <BarChart3 style={{ width: "24px", height: "24px", color: "#FFFFFF" }} />
              </div>
              <div>
                <h3 className="text-white" style={{ fontSize: "17px", fontWeight: "700" }}>Sport Analytics</h3>
                <p className="text-white/80" style={{ fontSize: "13px" }}>Deep-dive by sport</p>
              </div>
            </div>
            <ChevronRight style={{ width: "22px", height: "22px", color: "rgba(255,255,255,0.7)" }} />
          </div>
        </button>

        {/* ── Hero stat grid 2×2 ── */}
        <div className="grid grid-cols-2 gap-3">
          {/* Total Games — accent gradient */}
          <div
            className="flex flex-col gap-2 p-4"
            style={{ borderRadius: "18px", background: "linear-gradient(135deg,#2563EB,#3B82F6)" }}
          >
            <Trophy style={{ width: "22px", height: "22px", color: "rgba(255,255,255,0.75)" }} />
            <p className="text-white" style={{ fontSize: "34px", fontWeight: "800", lineHeight: 1 }}>{totalGames}</p>
            <p className="text-white/70" style={{ fontSize: "12px", fontWeight: "500" }}>Total Games</p>
          </div>

          {/* Hours Played */}
          <div
            className="flex flex-col gap-2 p-4"
            style={{ borderRadius: "18px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <Clock style={{ width: "22px", height: "22px", color: "#F59E0B" }} />
            <p className="text-white" style={{ fontSize: "34px", fontWeight: "800", lineHeight: 1 }}>~{hoursPlayed}h</p>
            <p className="text-[#94A3B8]" style={{ fontSize: "12px", fontWeight: "500" }}>Est. Hours Played</p>
          </div>

          {/* Win Rate */}
          <div
            className="flex flex-col gap-2 p-4"
            style={{ borderRadius: "18px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <Target style={{ width: "22px", height: "22px", color: "#8B5CF6" }} />
            <p className="text-white" style={{ fontSize: "34px", fontWeight: "800", lineHeight: 1 }}>{winRate}%</p>
            <p className="text-[#94A3B8]" style={{ fontSize: "12px", fontWeight: "500" }}>Win Rate</p>
          </div>

          {/* Win Streak */}
          <div
            className="flex flex-col gap-2 p-4"
            style={{ borderRadius: "18px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <Zap style={{ width: "22px", height: "22px", color: "#22C55E" }} />
            <p className="text-white" style={{ fontSize: "34px", fontWeight: "800", lineHeight: 1 }}>{winStreak}</p>
            <p className="text-[#94A3B8]" style={{ fontSize: "12px", fontWeight: "500" }}>Win Streak</p>
          </div>
        </div>

        {/* ── Sportza Ratings ── */}
        {skillRatings.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white" style={{ fontSize: "17px", fontWeight: "700" }}>Sportza Ratings</h2>
              <button
                onClick={() => navigate("/matchmaking")}
                className="flex items-center gap-1 text-[#3B82F6]"
                style={{ fontSize: "13px", fontWeight: "600" }}
              >
                Find Match
                <ChevronRight style={{ width: "14px", height: "14px" }} />
              </button>
            </div>
            <div className="space-y-3">
              {skillRatings.map((r: any) => {
                const color = ratingTierColor(r.rating);
                const tier = ratingTierLabel(r.rating);
                const history: number[] = historyBySport[r.sportId] ?? [];
                const lastDelta = r.recentHistory?.[0]?.delta ?? null;
                const isUp = lastDelta !== null && lastDelta > 0;
                const isDown = lastDelta !== null && lastDelta < 0;

                return (
                  <div
                    key={r.sportId}
                    className="flex items-center justify-between p-4"
                    style={{ borderRadius: "16px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>
                          {r.sport?.displayName ?? r.sport?.name}
                        </span>
                        <span
                          className="px-1.5 py-0.5"
                          style={{ borderRadius: "6px", backgroundColor: `${color}20`, fontSize: "10px", fontWeight: "700", color }}
                        >
                          {tier}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-white" style={{ fontSize: "26px", fontWeight: "800", letterSpacing: "-0.5px" }}>
                          {r.rating}
                        </span>
                        {lastDelta !== null && (
                          <span
                            className="flex items-center gap-0.5"
                            style={{ fontSize: "12px", fontWeight: "700", color: isUp ? "#22C55E" : isDown ? "#EF4444" : "#64748B" }}
                          >
                            {isUp ? <TrendingUp style={{ width: "12px", height: "12px" }} /> :
                             isDown ? <TrendingDown style={{ width: "12px", height: "12px" }} /> : null}
                            {lastDelta > 0 ? `+${lastDelta}` : lastDelta}
                          </span>
                        )}
                      </div>
                      <span className="text-[#64748B]" style={{ fontSize: "11px" }}>
                        {r.matchesPlayed} matches played
                      </span>
                    </div>
                    {history.length >= 2 && (
                      <RatingSparkline ratings={history} color={color} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Sports Breakdown ── */}
        {sportsBreakdown.length > 0 && (
          <div>
            <h2 className="text-white mb-3" style={{ fontSize: "17px", fontWeight: "700" }}>Sports Breakdown</h2>
            <div
              className="p-4 space-y-4"
              style={{ borderRadius: "18px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              {sportsBreakdown.map(({ sport, games }) => (
                <button
                  key={sport}
                  onClick={() => navigate(`/stats/sport/${sport.toLowerCase()}`)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-white capitalize" style={{ fontSize: "14px", fontWeight: "600" }}>{sport}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>{games}</span>
                      <span className="text-[#64748B]" style={{ fontSize: "12px" }}>games</span>
                      <ChevronRight style={{ width: "14px", height: "14px", color: "#475569" }} />
                    </div>
                  </div>
                  <div className="w-full overflow-hidden" style={{ height: "6px", borderRadius: "999px", backgroundColor: "#111827" }}>
                    <div
                      style={{
                        width: `${Math.round((games / maxGames) * 100)}%`,
                        height: "100%",
                        borderRadius: "999px",
                        backgroundColor: sportBarColor(sport),
                        transition: "width 0.6s ease",
                      }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Achievements ── */}
        <div>
          <h2 className="text-white mb-3" style={{ fontSize: "17px", fontWeight: "700" }}>Achievements</h2>
          <div className="grid grid-cols-2 gap-3">
            {ACHIEVEMENTS.map((a) => {
              const current  = achievementValues[a.key] ?? 0;
              const unlocked = current >= a.threshold;
              const pct      = Math.min((current / a.threshold) * 100, 100);
              return (
                <div
                  key={a.id}
                  className="p-4"
                  style={{
                    borderRadius: "18px",
                    backgroundColor: unlocked ? "#1E293B" : "#111827",
                    border: unlocked ? "1px solid rgba(59,130,246,0.25)" : "1px solid rgba(255,255,255,0.04)",
                    opacity: unlocked ? 1 : 0.5,
                  }}
                >
                  <span style={{ fontSize: "26px" }}>{a.icon}</span>
                  <p className="mt-2 text-white" style={{ fontSize: "13px", fontWeight: "700" }}>{a.title}</p>
                  <p className="text-[#64748B]" style={{ fontSize: "11px", marginTop: "2px" }}>{a.desc}</p>
                  {/* progress bar */}
                  <div className="mt-3" style={{ height: "4px", borderRadius: "999px", backgroundColor: "#0F172A", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        borderRadius: "999px",
                        backgroundColor: "#3B82F6",
                        transition: "width 0.6s ease",
                      }}
                    />
                  </div>
                  <p className="text-[#475569] mt-1" style={{ fontSize: "10px", fontWeight: "600" }}>
                    {Math.min(current, a.threshold)}/{a.threshold}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Recent Activity ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white" style={{ fontSize: "17px", fontWeight: "700" }}>Recent Activity</h2>
            <button
              onClick={() => navigate("/matches")}
              className="text-[#3B82F6]"
              style={{ fontSize: "13px", fontWeight: "600" }}
            >
              See all
            </button>
          </div>

          {recentActivity.length === 0 ? (
            <div
              className="p-10 text-center"
              style={{ borderRadius: "18px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <Calendar style={{ width: "36px", height: "36px", color: "#334155", margin: "0 auto 12px" }} />
              <p className="text-white mb-1" style={{ fontSize: "15px", fontWeight: "600" }}>No activity yet</p>
              <p className="text-[#64748B]" style={{ fontSize: "13px" }}>Play your first match to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(`/matches/${item.id}`)}
                  className="w-full p-4 text-left active:scale-[0.99] transition-transform"
                  style={{
                    borderRadius: "16px",
                    backgroundColor: "#1E293B",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white capitalize" style={{ fontSize: "15px", fontWeight: "600" }}>
                          {item.sport || "Match"}
                        </span>
                        <span
                          className="px-2 py-0.5"
                          style={{
                            borderRadius: "999px",
                            backgroundColor: resultBg[item.result],
                            fontSize: "11px",
                            fontWeight: "700",
                            color: resultColor[item.result],
                          }}
                        >
                          {resultLabel[item.result]}
                        </span>
                      </div>
                      <p className="text-[#64748B] truncate" style={{ fontSize: "12px" }}>{item.venue}</p>
                      {item.scoreStr && (
                        <p className="text-[#475569] mt-0.5" style={{ fontSize: "12px" }}>{item.scoreStr}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0 ml-3">
                      {item.matchDate && (
                        <div className="flex items-center gap-1 text-[#64748B]">
                          <Calendar style={{ width: "11px", height: "11px" }} />
                          <span style={{ fontSize: "11px" }}>{format(new Date(item.matchDate), "MMM d")}</span>
                        </div>
                      )}
                      <ChevronRight style={{ width: "15px", height: "15px", color: "#334155" }} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Leaderboard teaser ── */}
        <button
          onClick={() => navigate("/stats/leaderboard")}
          className="w-full flex items-center justify-between p-4 active:scale-[0.98] transition-transform"
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
              <p className="text-[#94A3B8]" style={{ fontSize: "12px" }}>See how you rank against others</p>
            </div>
          </div>
          <ChevronRight style={{ width: "18px", height: "18px", color: "#94A3B8" }} />
        </button>

      </div>
    </div>
  );
}
