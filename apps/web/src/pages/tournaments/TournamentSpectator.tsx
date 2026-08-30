import { useMemo, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@sportza/api-client";
import { Calendar, ExternalLink, MapPin, Users, Trophy } from "lucide-react";
import { format } from "date-fns";

// ── Helpers ───────────────────────────────────────────────────────────────────

const GROUP_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function knockoutRoundLabel(round: number, fixturesInRound: number, maxRound: number): string {
  if (round === maxRound) return fixturesInRound > 1 ? "Finals" : "Final";
  if (fixturesInRound >= 8) return "Round of 16";
  if (fixturesInRound >= 4) return "Quarter-finals";
  if (fixturesInRound >= 2) return "Semi-finals";
  return `Round ${round}`;
}

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  registration: { color: "#3B82F6", bg: "rgba(59,130,246,0.12)" },
  in_progress:  { color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  completed:    { color: "#22C55E", bg: "rgba(34,197,94,0.12)"  },
  cancelled:    { color: "#EF4444", bg: "rgba(239,68,68,0.12)"  },
  draft:        { color: "#64748B", bg: "rgba(100,116,139,0.12)"},
  scheduled:    { color: "#64748B", bg: "rgba(100,116,139,0.1)" },
};

const STATUS_LABEL: Record<string, string> = {
  draft:        "DRAFT",
  registration: "REGISTRATION OPEN",
  in_progress:  "LIVE",
  completed:    "COMPLETED",
  cancelled:    "CANCELLED",
};

function flatScore(scores: any): { a: string; b: string } | null {
  if (!scores || typeof scores !== "object") return null;
  if (typeof scores.A === "number" && typeof scores.B === "number")
    return { a: String(scores.A), b: String(scores.B) };
  if (scores.scores) return flatScore(scores.scores);
  if (scores.setsWon && typeof scores.setsWon === "object")
    return { a: String(scores.setsWon.A ?? 0), b: String(scores.setsWon.B ?? 0) };
  if (scores.gamesWon && typeof scores.gamesWon === "object")
    return { a: String(scores.gamesWon.A ?? 0), b: String(scores.gamesWon.B ?? 0) };
  if (typeof scores.team1 === "number" && typeof scores.team2 === "number")
    return { a: String(scores.team1), b: String(scores.team2) };
  const nums = Object.values(scores).filter((v) => typeof v === "number") as number[];
  if (nums.length >= 2) return { a: String(nums[0]), b: String(nums[1]) };
  return null;
}

function knockoutRoundLabel(round: number, maxRound: number): string {
  if (round === maxRound)     return "Final";
  if (round === maxRound - 1) return "Semi-Finals";
  if (round === maxRound - 2) return "Quarter-Finals";
  const remaining = Math.pow(2, maxRound - round + 1);
  return `Round of ${remaining}`;
}

function isTBD(ref: any): boolean {
  return !ref?.name && (ref?.bye === true || ref?.round != null);
}

function gameScores(scores: any): string | null {
  const games = scores?.completedGames ?? scores?.completedSets ?? null;
  if (!Array.isArray(games) || games.length === 0) return null;
  return games.map((g: any) => `${g.A}-${g.B}`).join(", ");
}

function fmtDate(d: string | null) {
  if (!d) return null;
  try { return format(new Date(d), "dd MMM yyyy"); } catch { return null; }
}

// ── Spectator Fixture Card ─────────────────────────────────────────────────────

function SpectatorFixtureCard({ fixture, isRoundRobin, maxRound }: {
  fixture: any;
  isRoundRobin: boolean;
  maxRound: number;
}) {
  const t1Name     = fixture.team1Ref?.name ?? (isTBD(fixture.team1Ref) ? "TBD" : "Team A");
  const t2Name     = fixture.team2Ref?.name ?? (isTBD(fixture.team2Ref) ? "TBD" : "Team B");
  const isBye      = fixture.status === "bye" || fixture.team2Ref?.bye || fixture.team1Ref?.bye;
  const matchStatus: string = fixture.match?.status ?? fixture.status ?? "scheduled";
  const isLive     = matchStatus === "live" || matchStatus === "in_progress";
  const isDone     = matchStatus === "completed";
  const score      = flatScore(fixture.match?.scores);
  const isFinal    = !isRoundRobin && (fixture.round ?? 1) === maxRound;
  const matchId: number | null = fixture.match?.id ?? fixture.matchId ?? null;
  const gameStr = gameScores(fixture.match?.scores);
  const scoreboardHref = matchId && (isLive || isDone) ? `/scoreboard/${matchId}` : null;

  if (isBye) return null;

  return (
    <div
      style={{
        borderRadius: "12px",
        backgroundColor: isLive ? "rgba(34,197,94,0.05)" : "#0F172A",
        border: `1px solid ${isLive ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.06)"}`,
        padding: "12px 14px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Live pulse bar */}
      {isLive && (
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: "3px",
          backgroundColor: "#22C55E",
        }} />
      )}

      {/* Score row */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {/* Team 1 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: "13px", fontWeight: isDone || isLive ? "700" : "600",
            color: isDone || isLive ? "#F1F5F9" : "#94A3B8",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {t1Name}
          </p>
        </div>

        {/* Score / status */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "80px" }}>
          {score ? (
            <p style={{ fontSize: "18px", fontWeight: "800", color: isLive ? "#22C55E" : "#3B82F6", letterSpacing: "2px" }}>
              {score.a} : {score.b}
            </p>
          ) : (
            <p style={{ fontSize: "11px", color: "#475569", fontWeight: "600" }}>
              VS
              <br />
              <span style={{ fontSize: "9px" }}>PENDING</span>
            </p>
          )}
          {gameStr && (
            <p style={{ fontSize: "10px", color: "#64748B", marginTop: "2px", letterSpacing: "0.3px", textAlign: "center" }}>
              {gameStr}
            </p>
          )}
          {isLive && !scoreboardHref && (
            <span style={{
              fontSize: "8px", fontWeight: "800", color: "#22C55E",
              backgroundColor: "rgba(34,197,94,0.15)", borderRadius: "4px",
              padding: "1px 5px", marginTop: "2px", letterSpacing: "0.5px",
            }}>
              LIVE
            </span>
          )}
          {isDone && !scoreboardHref && (
            <span style={{
              fontSize: "8px", fontWeight: "700", color: "#64748B",
              marginTop: "2px", letterSpacing: "0.5px",
            }}>
              FINAL
            </span>
          )}
          {isFinal && !isLive && !isDone && (
            <span style={{ fontSize: "8px", color: "#F59E0B", fontWeight: "700", marginTop: "2px" }}>
              FINAL MATCH
            </span>
          )}
        </div>

        {/* Team 2 */}
        <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
          <p style={{
            fontSize: "13px", fontWeight: isDone || isLive ? "700" : "600",
            color: isDone || isLive ? "#F1F5F9" : "#94A3B8",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {t2Name}
          </p>
        </div>

        {scoreboardHref && (
          <a
            href={scoreboardHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={isLive ? `Open live scoreboard for ${t1Name} vs ${t2Name}` : `Open scoreboard for ${t1Name} vs ${t2Name}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              flexShrink: 0,
              padding: "5px 8px",
              borderRadius: "999px",
              textDecoration: "none",
              backgroundColor: isLive ? "rgba(34,197,94,0.12)" : "rgba(59,130,246,0.1)",
              border: `1px solid ${isLive ? "rgba(34,197,94,0.35)" : "rgba(59,130,246,0.25)"}`,
            }}
          >
            {isLive && (
              <span style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "#22C55E",
                boxShadow: "0 0 6px #22C55E",
                flexShrink: 0,
              }} />
            )}
            <span style={{
              fontSize: "9px",
              fontWeight: 800,
              letterSpacing: "0.4px",
              color: isLive ? "#22C55E" : "#60A5FA",
            }}>
              {isLive ? "LIVE" : "SCORE"}
            </span>
            <ExternalLink style={{ width: "10px", height: "10px", color: isLive ? "#22C55E" : "#60A5FA" }} />
          </a>
        )}
      </div>
    </div>
  );
}

// ── Tournament Info Card ──────────────────────────────────────────────────────

function formatLabel(fmt: string): string {
  if (fmt === "round_robin") return "Round Robin";
  if (fmt === "knockout")    return "Knockout";
  if (fmt === "league")      return "League";
  return fmt.replace(/_/g, " ");
}

function InfoChip({ label, color = "#64748B", bg = "rgba(100,116,139,0.12)" }: {
  label: string; color?: string; bg?: string;
}) {
  return (
    <span style={{
      fontSize: "10px", fontWeight: "700", color,
      backgroundColor: bg, borderRadius: "5px", padding: "2px 7px",
      whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

function TournamentInfoCard({ tournament, stages, isMultiStage }: {
  tournament: any; stages: any[]; isMultiStage: boolean;
}) {
  const hasContent =
    stages.length > 0 ||
    tournament.maxTeams ||
    tournament.createdBy?.name;

  if (!hasContent) return null;

  // Build display stages: multi-stage uses the stages array;
  // single-format uses stages[0] (singleFormat flag) or top-level format.
  const displayStages: any[] = isMultiStage
    ? stages
    : stages.length > 0
      ? stages
      : [{ name: formatLabel(tournament.format ?? ""), format: tournament.format }];

  return (
    <div style={{
      borderRadius: "12px",
      backgroundColor: "#0F172A",
      border: "1px solid rgba(255,255,255,0.06)",
      padding: "14px",
      marginBottom: "14px",
    }}>

      {/* Per-stage format rows */}
      {displayStages.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "12px" }}>
          <p style={{
            fontSize: "10px", fontWeight: "700", color: "#475569",
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "2px",
          }}>
            Format
          </p>
          {displayStages.map((s: any, i: number) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              {isMultiStage && (
                <p style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8" }}>{s.name}</p>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                <InfoChip label={formatLabel(s.format ?? tournament.format ?? "")} color="#3B82F6" bg="rgba(59,130,246,0.1)" />
                {s.groupCount && s.groupCount > 1 && (
                  <InfoChip label={`${s.groupCount} groups`} />
                )}
                {s.advancePerGroup && (
                  <InfoChip label={`Top ${s.advancePerGroup} advance`} />
                )}
                {s.bestOf && (
                  <InfoChip label={`Best of ${s.bestOf}`} color="#F59E0B" bg="rgba(245,158,11,0.1)" />
                )}
                {s.scoringSystem && (
                  <InfoChip
                    label={s.scoringSystem === "rally" ? "Rally Point" : "Service Point"}
                    color="#22C55E" bg="rgba(34,197,94,0.1)"
                  />
                )}
                {s.targetScore && (
                  <InfoChip label={`Race to ${s.targetScore}`} color="#A78BFA" bg="rgba(167,139,250,0.1)" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Max teams */}
      {tournament.maxTeams && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
          <span style={{ fontSize: "11px", color: "#475569", fontWeight: "600" }}>Max teams:</span>
          <span style={{ fontSize: "11px", color: "#94A3B8", fontWeight: "700" }}>{tournament.maxTeams}</span>
        </div>
      )}

      {/* Organizer */}
      {tournament.createdBy?.name && (
        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.05)",
          paddingTop: "10px",
          display: "flex", alignItems: "center", gap: "6px",
        }}>
          <span style={{ fontSize: "10px", color: "#475569", fontWeight: "600" }}>Organised by</span>
          <span style={{ fontSize: "11px", color: "#F1F5F9", fontWeight: "700" }}>
            {tournament.createdBy.name}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Standings Table ───────────────────────────────────────────────────────────

function StandingsTable({ standings }: { standings: any[] }) {
  if (!standings.length) return (
    <p style={{ color: "#64748B", fontSize: "13px", textAlign: "center", padding: "24px 0" }}>
      No standings yet.
    </p>
  );

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {["#", "Team", "P", "W", "D", "L", "+/-", "Pts"].map(h => (
              <th key={h} style={{ padding: "6px 8px", color: "#64748B", fontWeight: "700", textAlign: h === "Team" ? "left" : "center" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {standings.map((row: any, i: number) => {
            const diff = row.pointDiff ?? (row.pointsFor != null ? row.pointsFor - (row.pointsAgainst ?? 0) : null);
            const diffLabel = diff == null ? "-" : diff > 0 ? `+${diff}` : `${diff}`;
            const diffColor = diff == null || diff === 0 ? "#94A3B8" : diff > 0 ? "#22C55E" : "#EF4444";
            const isChampion = row.placement === "champion";
            const isRunnerUp = row.placement === "runner_up";
            return (
              <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", backgroundColor: isChampion ? "rgba(245,158,11,0.06)" : "transparent" }}>
                <td style={{ padding: "8px", textAlign: "center" }}>
                  {isChampion
                    ? <Trophy style={{ width: "13px", height: "13px", color: "#F59E0B", display: "inline" }} />
                    : <span style={{ color: "#64748B" }}>{i + 1}</span>
                  }
                </td>
                <td style={{ padding: "8px" }}>
                  <span style={{ color: isChampion ? "#F59E0B" : "#F1F5F9", fontWeight: "600", display: "block" }}>{row.team}</span>
                  {isChampion && <span style={{ fontSize: "9px", color: "#F59E0B", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em" }}>Champion</span>}
                  {isRunnerUp && <span style={{ fontSize: "9px", color: "#94A3B8", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>Runner-up</span>}
                </td>
                <td style={{ padding: "8px", color: "#94A3B8", textAlign: "center" }}>{row.played ?? "-"}</td>
                <td style={{ padding: "8px", color: "#22C55E", textAlign: "center", fontWeight: "700" }}>{row.won ?? "-"}</td>
                <td style={{ padding: "8px", color: "#94A3B8", textAlign: "center" }}>{row.drawn ?? "-"}</td>
                <td style={{ padding: "8px", color: "#EF4444", textAlign: "center" }}>{row.lost ?? "-"}</td>
                <td style={{ padding: "8px", color: diffColor, textAlign: "center", fontWeight: "700" }}>{diffLabel}</td>
                <td style={{ padding: "8px", color: "#F59E0B", textAlign: "center", fontWeight: "800" }}>{row.points ?? "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function TournamentSpectator() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const tournamentId = id ? parseInt(id, 10) : 0;

  const activeTab      = searchParams.get("tab") || "fixtures";
  const activeStageNum = parseInt(searchParams.get("stage") || "1", 10);
  const activeRoundParam = searchParams.get("round");
  const activeRound = activeRoundParam != null && activeRoundParam !== ""
    ? parseInt(activeRoundParam, 10)
    : null;

  const setActiveTab = (tab: string) => {
    setSearchParams(p => { p.set("tab", tab); return p; }, { replace: true });
  };
  const setStageNav = (stageNum: number, round: number | null) => {
    setSearchParams(p => {
      p.set("stage", String(stageNum));
      if (round != null) p.set("round", String(round));
      else p.delete("round");
      return p;
    }, { replace: true });
  };

  // ── Queries (poll every 30s when live) ──────────────────────────────────────
  const [pollInterval, setPollInterval] = useState<number | false>(false);

  const { data: tourRes, isLoading, isError } = useQuery<any>({
    queryKey: ["spectator", "tournament", tournamentId],
    queryFn: () => apiClient.get(`/tournaments/${tournamentId}`).then(r => r.data),
    enabled: !!tournamentId,
    refetchInterval: pollInterval,
    staleTime: 0,
  });

  const { data: standingsRes } = useQuery<any>({
    queryKey: ["spectator", "standings", tournamentId],
    queryFn: () => apiClient.get(`/tournaments/${tournamentId}/standings`).then(r => r.data),
    enabled: !!tournamentId,
    refetchInterval: pollInterval,
    staleTime: 0,
  });

  const { data: announcementsRes } = useQuery<any>({
    queryKey: ["spectator", "announcements", tournamentId],
    queryFn: () => apiClient.get(`/tournaments/${tournamentId}/announcements`).then(r => r.data),
    enabled: !!tournamentId,
    refetchInterval: pollInterval,
    staleTime: 0,
  });

  // ── Derived data ─────────────────────────────────────────────────────────────

  const tournament   = (tourRes as any)?.data ?? (tourRes as any)?.tournament ?? tourRes;
  const status: string = tournament?.status ?? "draft";
  const ss           = STATUS_STYLE[status] ?? STATUS_STYLE.draft;
  const stages: any[] = Array.isArray(tournament?.stages) ? tournament.stages : [];
  const isMultiStage = stages.length > 0 && !stages[0]?.singleFormat;
  const allFixtures: any[] = tournament?.fixtures ?? [];
  const teams: any[]       = Array.isArray(tournament?.teams) ? tournament.teams : [];
  const standings: any[]   = Array.isArray((standingsRes as any)?.data)
    ? (standingsRes as any).data
    : Array.isArray(standingsRes) ? standingsRes : [];
  const announcements: any[] = Array.isArray((announcementsRes as any)?.data)
    ? (announcementsRes as any).data
    : [];

  // Group configuration derived from stage settings
  const groupedStage = stages.find((s: any) => (s.groupCount ?? 0) > 1 && !s.singleFormat);
  const groupCount   = groupedStage ? (groupedStage.groupCount as number) : 0;

  // Enable 30s polling when tournament is actively in progress
  useEffect(() => {
    setPollInterval(status === "in_progress" ? 5_000 : false);
  }, [status]);

  // Fixtures for the active stage (optionally one knockout round)
  const stageFixAll = useMemo(() => {
    if (!isMultiStage) return allFixtures;
    return allFixtures.filter((f: any) => (f.stage ?? 1) === activeStageNum);
  }, [allFixtures, isMultiStage, activeStageNum]);

  const stageNavItems = useMemo(() => {
    if (!isMultiStage) return [] as Array<{ key: string; stageNum: number; round: number | null; name: string }>;
    const items: Array<{ key: string; stageNum: number; round: number | null; name: string }> = [];
    for (const s of stages) {
      const stageNum = s.stageOrder as number;
      const fix = allFixtures.filter((f: any) => (f.stage ?? 1) === stageNum);
      if (s.format === "knockout" && fix.length > 0) {
        const byRound: Record<number, any[]> = {};
        for (const f of fix) {
          const r = f.round ?? 1;
          (byRound[r] ??= []).push(f);
        }
        const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);
        const maxR = rounds[rounds.length - 1] ?? 1;
        if (rounds.length > 1) {
          for (const r of rounds) {
            items.push({
              key: `${stageNum}-${r}`,
              stageNum,
              round: r,
              name: knockoutRoundLabel(r, byRound[r].length, maxR),
            });
          }
          continue;
        }
      }
      items.push({
        key: String(stageNum),
        stageNum,
        round: null,
        name: s.name ?? `Stage ${stageNum}`,
      });
    }
    return items;
  }, [isMultiStage, stages, allFixtures]);

  const effectiveRound = useMemo(() => {
    if (activeRound != null && !Number.isNaN(activeRound)) return activeRound;
    const koNav = stageNavItems.filter((i) => i.stageNum === activeStageNum && i.round != null);
    if (koNav.length > 0) return koNav[0].round;
    return null;
  }, [activeRound, stageNavItems, activeStageNum]);

  const stageFix = useMemo(() => {
    if (effectiveRound == null) return stageFixAll;
    return stageFixAll.filter((f: any) => (f.round ?? 1) === effectiveRound);
  }, [stageFixAll, effectiveRound]);

  // Group fixtures by round and group
  const activeStage = stages.find((s: any) => s.stageOrder === activeStageNum);
  const isRoundRobin = !isMultiStage
    ? false
    : (activeStage?.format === "round_robin" || activeStage?.format === "league");

  const { fixturesByGroup, hasGroups } = useMemo(() => {
    if (!isRoundRobin) return { fixturesByGroup: null, hasGroups: false };
    const map: Record<number, any[]> = {};
    for (const f of stageFix) {
      const g = f.groupIndex ?? -1;
      if (g >= 0) (map[g] ??= []).push(f);
    }
    const hasG = Object.keys(map).length > 0;
    return { fixturesByGroup: hasG ? map : null, hasGroups: hasG };
  }, [stageFix, isRoundRobin]);

  const fixturesByRound = useMemo(() => {
    if (isRoundRobin) return null;
    // Bracket-style view: show all rounds of the knockout stage
    const source = stageFixAll;
    const map: Record<number, any[]> = {};
    for (const f of source) {
      const r = f.round ?? 1;
      (map[r] ??= []).push(f);
    }
    return map;
  }, [stageFixAll, isRoundRobin]);

  const maxRound = useMemo(() => {
    if (!fixturesByRound) return 1;
    const rounds = Object.keys(fixturesByRound).map(Number);
    return rounds.length ? Math.max(...rounds) : 1;
  }, [fixturesByRound]);

  /**
   * Per-group standings for the spectator view — mirrors TournamentDetail logic.
   * Primary: use fixture groupIndex when fixtures are properly split.
   * Fallback: use teams array order / stored groupIndex when groupCount >= 2.
   */
  const perGroupStandings = useMemo<Record<number, any[]> | null>(() => {
    const zeroRow = (name: string) => {
      const row = standings.find((s: any) => s.team === name);
      return row ?? { team: name, played: 0, won: 0, drawn: 0, lost: 0, points: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0 };
    };
    const sortRows = (rows: any[]) =>
      rows.sort((a: any, b: any) => b.points - a.points || b.won - a.won || (b.pointDiff ?? 0) - (a.pointDiff ?? 0));

    if (hasGroups && fixturesByGroup) {
      const result: Record<number, any[]> = {};
      for (const [gKey, gFix] of Object.entries(fixturesByGroup)) {
        const gIdx = parseInt(gKey);
        const teamNames = new Set<string>();
        for (const f of gFix as any[]) {
          if ((f.team1Ref as any)?.name) teamNames.add((f.team1Ref as any).name);
          if ((f.team2Ref as any)?.name) teamNames.add((f.team2Ref as any).name);
        }
        result[gIdx] = sortRows(Array.from(teamNames).map(zeroRow));
      }
      return result;
    }

    if (groupCount >= 2 && teams.length >= groupCount) {
      const result: Record<number, any[]> = {};
      const hasExplicit   = teams.some((t: any) => t.groupIndex != null);
      const teamsPerGroup = Math.ceil(teams.length / groupCount);
      teams.forEach((t: any, i: number) => {
        const gIdx = hasExplicit
          ? (t.groupIndex ?? Math.floor(i / teamsPerGroup))
          : Math.floor(i / teamsPerGroup);
        (result[gIdx] ??= []).push(zeroRow(t.name));
      });
      for (const rows of Object.values(result)) sortRows(rows);
      return result;
    }

    return null;
  }, [hasGroups, fixturesByGroup, standings, groupCount, teams]);

  // ── Render helpers ────────────────────────────────────────────────────────────

  const TABS = ["Fixtures", "Standings", "Updates"] as const;

  const startD = tournament?.startDate ? fmtDate(tournament.startDate) : null;
  const endD   = tournament?.endDate   ? fmtDate(tournament.endDate)   : null;

  if (isLoading) {
    return (
      <div style={{ minHeight: "100dvh", backgroundColor: "#0A0F1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#64748B", fontSize: "14px" }}>Loading tournament…</p>
      </div>
    );
  }

  if (isError || !tournament) {
    return (
      <div style={{ minHeight: "100dvh", backgroundColor: "#0A0F1A", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "12px" }}>
        <Trophy style={{ width: 40, height: 40, color: "#334155" }} />
        <p style={{ color: "#64748B", fontSize: "14px" }}>Tournament not found.</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", backgroundColor: "#0A0F1A", maxWidth: "480px", margin: "0 auto", paddingBottom: "40px" }}>
      {/* ── Header ── */}
      <div style={{ padding: "20px 16px 0" }}>
        {/* Sportza brand strip */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
          <span style={{ fontSize: "11px", fontWeight: "800", color: "#F59E0B", letterSpacing: "2px" }}>
            SPORTZA
          </span>
          {status === "in_progress" && (
            <span style={{
              fontSize: "9px", fontWeight: "800", color: "#22C55E",
              backgroundColor: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: "999px", padding: "3px 8px", letterSpacing: "0.5px",
            }}>
              ● LIVE
            </span>
          )}
        </div>

        {/* Tournament name & status */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "10px" }}>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: "800", color: "#F1F5F9", lineHeight: 1.2 }}>
              {tournament.name}
            </h1>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "3px" }}>
              {tournament.sport}
              {isMultiStage && <span> · {stages.length} stages</span>}
            </p>
          </div>
          <span style={{
            flexShrink: 0, fontSize: "10px", fontWeight: "700",
            color: ss.color, backgroundColor: ss.bg,
            borderRadius: "6px", padding: "4px 8px", marginTop: "4px",
          }}>
            {STATUS_LABEL[status] ?? status.toUpperCase()}
          </span>
        </div>

        {/* Meta info */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
          {(startD || endD) && (
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <Calendar style={{ width: 13, height: 13, color: "#64748B" }} />
              <span style={{ fontSize: "12px", color: "#64748B" }}>
                {startD}{endD && endD !== startD ? ` – ${endD}` : ""}
              </span>
            </div>
          )}
          {tournament.venue?.name && (
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <MapPin style={{ width: 13, height: 13, color: "#64748B" }} />
              <span style={{ fontSize: "12px", color: "#64748B" }}>{tournament.venue.name}</span>
            </div>
          )}
          {tournament.teams && Array.isArray(tournament.teams) && tournament.teams.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <Users style={{ width: 13, height: 13, color: "#64748B" }} />
              <span style={{ fontSize: "12px", color: "#64748B" }}>{tournament.teams.length} teams</span>
            </div>
          )}
        </div>

        {/* Tournament Info Card */}
        <TournamentInfoCard tournament={tournament} stages={stages} isMultiStage={isMultiStage} />

        {/* Sponsors */}
        {Array.isArray(tournament.sponsors) && tournament.sponsors.length > 0 && (
          <div style={{ marginBottom: "14px" }}>
            <p style={{ fontSize: "10px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>
              Sponsors
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {tournament.sponsors.map((sp: any, i: number) => (
                <span key={i} style={{
                  fontSize: "10px", color: "#F59E0B", fontWeight: "600",
                  backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
                  borderRadius: "6px", padding: "3px 8px",
                }}>
                  {sp.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Stage selector (multi-stage) ── */}
      {isMultiStage && (
        <div style={{ display: "flex", gap: "6px", padding: "0 16px 14px", overflowX: "auto" }}>
          {stageNavItems.map((item) => {
            const active = item.stageNum === activeStageNum
              && (item.round == null ? effectiveRound == null : item.round === effectiveRound);
            return (
              <button
                key={item.key}
                onClick={() => setStageNav(item.stageNum, item.round)}
                style={{
                  flexShrink: 0, padding: "6px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: "700",
                  backgroundColor: active ? "#F59E0B" : "rgba(255,255,255,0.05)",
                  color: active ? "#000" : "#64748B",
                  border: "none", cursor: "pointer",
                }}
              >
                {item.name}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Tab bar ── */}
      <div style={{ display: "flex", gap: "4px", padding: "0 16px 14px", overflowX: "auto" }}>
        {TABS.map(tab => {
          const key = tab.toLowerCase();
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                flexShrink: 0, padding: "7px 16px", borderRadius: "999px", fontSize: "12px", fontWeight: "700",
                backgroundColor: active ? "#3B82F6" : "rgba(255,255,255,0.04)",
                color: active ? "#fff" : "#64748B",
                border: "none", cursor: "pointer",
              }}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ── */}
      <div style={{ padding: "0 16px" }}>

        {/* FIXTURES TAB */}
        {activeTab === "fixtures" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {stageFix.length === 0 && (
              <p style={{ color: "#64748B", fontSize: "13px", textAlign: "center", padding: "32px 0" }}>
                No fixtures yet.
              </p>
            )}

            {/* Round Robin — grouped by group */}
            {isRoundRobin && fixturesByGroup && Object.entries(fixturesByGroup)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([groupIdx, groupFix]) => {
                const byRound: Record<number, any[]> = {};
                for (const f of groupFix) {
                  const r = f.round ?? 1;
                  (byRound[r] ??= []).push(f);
                }
                return (
                  <div key={groupIdx}>
                    <p style={{ fontSize: "11px", fontWeight: "700", color: "#F59E0B", letterSpacing: "0.08em", marginBottom: "10px" }}>
                      <span style={{ marginRight: "6px", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "4px", backgroundColor: "rgba(245,158,11,0.15)", fontSize: "10px" }}>
                        {GROUP_LETTERS[Number(groupIdx)]}
                      </span>
                      Group {GROUP_LETTERS[Number(groupIdx)]}
                    </p>
                    {Object.entries(byRound).sort(([a], [b]) => Number(a) - Number(b)).map(([round, fixes]) => (
                      <div key={round} style={{ marginBottom: "14px" }}>
                        <p style={{ fontSize: "10px", fontWeight: "700", color: "#475569", letterSpacing: "0.1em", marginBottom: "6px" }}>
                          ROUND {round}
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          {fixes.map((f: any) => (
                            <SpectatorFixtureCard key={f.id} fixture={f} isRoundRobin maxRound={maxRound} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}

            {/* Knockout — grouped by round */}
            {!isRoundRobin && fixturesByRound && Object.entries(fixturesByRound)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([round, fixes]) => (
                <div key={round}>
                  <p style={{ fontSize: "10px", fontWeight: "700", color: "#475569", letterSpacing: "0.1em", marginBottom: "8px" }}>
                    {knockoutRoundLabel(Number(round), maxRound)}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {fixes.map((f: any) => (
                      <SpectatorFixtureCard key={f.id} fixture={f} isRoundRobin={false} maxRound={maxRound} />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* STANDINGS TAB */}
        {activeTab === "standings" && (
          perGroupStandings && Object.keys(perGroupStandings).length >= 2
            ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {Object.entries(perGroupStandings)
                  .sort(([a], [b]) => parseInt(a) - parseInt(b))
                  .map(([gKey, rows]) => {
                    const letter = GROUP_LETTERS[parseInt(gKey)] ?? String(parseInt(gKey) + 1);
                    return (
                      <div key={gKey}>
                        {/* Group header */}
                        <div className="flex items-center gap-2 mb-2">
                          <div style={{
                            width: "20px", height: "20px", borderRadius: "5px",
                            backgroundColor: "#334155", display: "flex", alignItems: "center",
                            justifyContent: "center", fontSize: "10px", fontWeight: "800", color: "#94A3B8",
                          }}>
                            {letter}
                          </div>
                          <span style={{ fontSize: "12px", fontWeight: "700", color: "#94A3B8" }}>
                            Group {letter}
                          </span>
                        </div>
                        <div style={{
                          borderRadius: "14px", backgroundColor: "#0F172A",
                          border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden",
                        }}>
                          <StandingsTable standings={rows} />
                        </div>
                      </div>
                    );
                  })
                }
                {/* Final standings after tournament completion */}
                {standings.some((s: any) => s.placement) && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy style={{ width: "13px", height: "13px", color: "#F59E0B" }} />
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "#F59E0B" }}>Final Standings</span>
                    </div>
                    <div style={{ borderRadius: "14px", backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
                      <StandingsTable standings={standings} />
                    </div>
                  </div>
                )}
              </div>
            )
            : (
              <div style={{
                borderRadius: "14px", backgroundColor: "#0F172A",
                border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden",
              }}>
                <StandingsTable standings={standings} />
              </div>
            )
        )}

        {/* UPDATES TAB */}
        {activeTab === "updates" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {announcements.length === 0 && (
              <p style={{ color: "#64748B", fontSize: "13px", textAlign: "center", padding: "32px 0" }}>
                No updates yet.
              </p>
            )}
            {announcements.map((ann: any) => (
              <div key={ann.id} style={{
                borderRadius: "12px", backgroundColor: "#0F172A",
                border: "1px solid rgba(255,255,255,0.06)", padding: "14px",
              }}>
                <p style={{ fontSize: "14px", fontWeight: "700", color: "#F1F5F9", marginBottom: "6px" }}>
                  {ann.title}
                </p>
                <p style={{ fontSize: "13px", color: "#94A3B8", lineHeight: 1.5 }}>{ann.body}</p>
                <p style={{ fontSize: "10px", color: "#475569", marginTop: "8px" }}>
                  {ann.createdAt ? fmtDate(ann.createdAt) : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{ marginTop: "48px", padding: "0 16px", textAlign: "center" }}>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "20px" }}>
          <p style={{ fontSize: "11px", color: "#334155", fontWeight: "600" }}>
            Live scores powered by{" "}
            <a href="/" style={{ color: "#F59E0B", textDecoration: "none", fontWeight: "700" }}>
              Sportza
            </a>
          </p>
          <a
            href="/register"
            style={{
              display: "inline-block", marginTop: "10px",
              fontSize: "11px", color: "#3B82F6", fontWeight: "600",
              textDecoration: "none",
            }}
          >
            Create your own tournament →
          </a>
        </div>
      </div>
    </div>
  );
}
