import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  useTournament, useTournamentStandings,
  useGenerateTournamentFixtures, useAdvanceTournamentStage, useSyncTournamentBracket,
  useUpdateTournamentStatus, useStartFixtureMatch,
  useCurrentUser, useSearchUsers,
  useTournamentRegistrations, useAcceptRegistration, useRejectRegistration,
  useAddTournamentPlayer, useRemoveTournamentPlayer, useUpdatePlayerStats,
  useTournamentTopScorers,
  useTournamentAnnouncements, usePostTournamentAnnouncement, useDeleteTournamentAnnouncement,
  useUpdateTournamentSponsors,
  useUpdateTournament,
  useClearTournamentFixtures,
  useUpdateMatchScore,
  useAddCoOrganizer, useUpdateCoOrganizerRole, useRemoveCoOrganizer,
  useSaveGroupAssignments, useClearGroupAssignments,
  useExportTournamentExcel,
} from "@sportza/api-client";
import {
  ChevronLeft, Trophy, Calendar, MapPin, Users,
  Zap, ChevronRight, CheckCircle, Play, Flag,
  Radio, Activity, Loader2, Plus, X, Megaphone,
  Star, Link2, Trash2, UserPlus, Share2, Pencil, AlertTriangle, UserCog, Shield, ChevronDown,
  Shuffle, ArrowLeftRight, FileSpreadsheet,
} from "lucide-react";
import { format } from "date-fns";
import { getPlayerStatValue, getSportPlayerStatSchema } from "../../lib/tournament-player-stats";

// ── Constants ─────────────────────────────────────────────────────────────────

const GROUP_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  registration: { color: "#3B82F6", bg: "rgba(59,130,246,0.12)"  },
  in_progress:  { color: "#F59E0B", bg: "rgba(245,158,11,0.12)"  },
  completed:    { color: "#22C55E", bg: "rgba(34,197,94,0.12)"   },
  cancelled:    { color: "#EF4444", bg: "rgba(239,68,68,0.12)"   },
  draft:        { color: "#64748B", bg: "rgba(100,116,139,0.12)" },
  bye:          { color: "#475569", bg: "rgba(71,85,105,0.12)"   },
  scheduled:    { color: "#64748B", bg: "rgba(100,116,139,0.1)"  },
};

const MATCH_STATUS_LABEL: Record<string, string> = {
  scheduled:   "UPCOMING",
  in_progress: "LIVE",
  live:        "LIVE",
  completed:   "DONE",
  bye:         "BYE",
  draft:       "PENDING",
};

/** Label a knockout round from how many fixtures it contains. */
function knockoutRoundLabel(round: number, fixturesInRound: number, maxRound: number): string {
  if (round === maxRound) return fixturesInRound > 1 ? "Finals" : "Final";
  if (fixturesInRound >= 8) return "Round of 16";
  if (fixturesInRound >= 4) return "Quarter-finals";
  if (fixturesInRound >= 2) return "Semi-finals";
  return `Round ${round}`;
}

type StageNavItem = {
  key: string;
  stageNum: number;
  round: number | null;
  name: string;
};

// Flatten scoring-engine state to a simple {a, b} for display.
// Returns null when no meaningful score exists (avoids showing "0:0" on
// matches whose DB scores field still holds the initial engine seed).
function flatScore(scores: any): { a: string; b: string } | null {
  if (!scores || typeof scores !== "object") return null;
  if (typeof scores.A === "number" && typeof scores.B === "number") {
    if (scores.A === 0 && scores.B === 0) return null;
    return { a: String(scores.A), b: String(scores.B) };
  }
  if (scores.scores) return flatScore(scores.scores);
  if (scores.setsWon && typeof scores.setsWon === "object") {
    const a = scores.setsWon.A ?? 0, b = scores.setsWon.B ?? 0;
    if (a === 0 && b === 0) return null;
    return { a: String(a), b: String(b) };
  }
  if (scores.gamesWon && typeof scores.gamesWon === "object") {
    const a = scores.gamesWon.A ?? 0, b = scores.gamesWon.B ?? 0;
    if (a === 0 && b === 0) return null;
    return { a: String(a), b: String(b) };
  }
  if (typeof scores.team1 === "number" && typeof scores.team2 === "number") {
    if (scores.team1 === 0 && scores.team2 === 0) return null;
    return { a: String(scores.team1), b: String(scores.team2) };
  }
  const nums = Object.values(scores).filter((v) => typeof v === "number") as number[];
  if (nums.length >= 2 && (nums[0] !== 0 || nums[1] !== 0))
    return { a: String(nums[0]), b: String(nums[1]) };
  return null;
}

// Derive winner from match data: prefer server winnerTeam, fall back to score comparison.
// teamSide "A"/"B" corresponds to team1Ref/team2Ref in tournament fixtures.
function deriveWinner(
  matchWinnerTeam: string | null | undefined,
  scoreA: string | null,
  scoreB: string | null,
  isDone: boolean,
): { t1Wins: boolean; t2Wins: boolean } {
  if (!isDone) return { t1Wins: false, t2Wins: false };
  if (matchWinnerTeam === "A") return { t1Wins: true,  t2Wins: false };
  if (matchWinnerTeam === "B") return { t1Wins: false, t2Wins: true  };
  if (scoreA !== null && scoreB !== null) {
    const a = parseInt(scoreA), b = parseInt(scoreB);
    return { t1Wins: a > b, t2Wins: b > a };
  }
  return { t1Wins: false, t2Wins: false };
}

function isTBD(ref: any): boolean {
  if (!ref) return true;
  if (ref.bye === true) return false;
  // Unresolved winner/loser pointer (no real team name yet)
  if ((ref.round != null || ref.stage != null) && !ref.name) return true;
  return !ref.name;
}

function gameScores(scores: any): string | null {
  const games = scores?.completedGames ?? scores?.completedSets ?? null;
  if (!Array.isArray(games) || games.length === 0) return null;
  return games.map((g: any) => `${g.A ?? 0}-${g.B ?? 0}`).join("  ·  ");
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TournamentDetail() {
  const { id }        = useParams<{ id: string }>();
  const navigate      = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tournamentId  = id ? parseInt(id, 10) : 0;

  const activeTab      = (searchParams.get("tab") as "fixtures" | "standings" | "teams" | "bracket" | "stats" | "updates") || "fixtures";
  const activeStageNum = parseInt(searchParams.get("stage") || "1", 10);
  const activeRoundParam = searchParams.get("round");
  const activeRound = activeRoundParam != null && activeRoundParam !== ""
    ? parseInt(activeRoundParam, 10)
    : null;

  const setActiveTab = useCallback((tab: string) => {
    setSearchParams(p => { p.set("tab", tab); return p; }, { replace: true });
  }, [setSearchParams]);

  const setActiveStageNum = useCallback((fn: number | ((prev: number) => number)) => {
    setSearchParams(p => {
      const next = typeof fn === "function" ? fn(parseInt(p.get("stage") || "1", 10)) : fn;
      p.set("stage", String(next));
      p.delete("round");
      return p;
    }, { replace: true });
  }, [setSearchParams]);

  const setActiveStageNav = useCallback((stageNum: number, round: number | null) => {
    setSearchParams(p => {
      p.set("stage", String(stageNum));
      if (round != null) p.set("round", String(round));
      else p.delete("round");
      return p;
    }, { replace: true });
  }, [setSearchParams]);

  const [actionError,         setActionError]         = useState("");
  const [startingFixtureId,   setStartingFixtureId]   = useState<number | null>(null);
  const [copyLinkDone,        setCopyLinkDone]         = useState(false);
  const [shareDone,           setShareDone]            = useState(false);
  // Player roster add
  const [addPlayerTeam,       setAddPlayerTeam]        = useState("");
  const [addPlayerJersey,     setAddPlayerJersey]      = useState("");
  const [playerSearch,        setPlayerSearch]         = useState("");
  const [selectedPlayerIds,   setSelectedPlayerIds]    = useState<number[]>([]);
  const [quickPickUserId,     setQuickPickUserId]      = useState<number | null>(null);
  const [playerError,         setPlayerError]          = useState("");
  // Co-organizer panel
  const [showCoOrgPanel,      setShowCoOrgPanel]       = useState(false);
  const [coOrgSearch,         setCoOrgSearch]          = useState("");
  // Announcement modal
  const [showAnnModal,        setShowAnnModal]         = useState(false);
  const [annTitle,            setAnnTitle]             = useState("");
  const [annBody,             setAnnBody]              = useState("");
  // Sponsor edit modal
  const [showSponsorModal,    setShowSponsorModal]     = useState(false);
  const [sponsorName,         setSponsorName]          = useState("");
  const [sponsorLogo,         setSponsorLogo]          = useState("");
  const [sponsorTier,         setSponsorTier]          = useState("main");
  // Correct score modal
  const [editScoreFixture,    setEditScoreFixture]     = useState<any | null>(null);
  // Group assignment panel
  const [groupEditMode,       setGroupEditMode]        = useState(false);
  const [localGroupMap,       setLocalGroupMap]        = useState<Record<string, number>>({});
  const [groupAssignError,    setGroupAssignError]     = useState("");

  const { data: userRes }                              = useCurrentUser({ enabled: true, retry: false });
  const currentUserId: number | null                   = (userRes as any)?.user?.id ?? (userRes as any)?.data?.id ?? null;

  const { data: tourRes, isLoading, isError }          = useTournament(tournamentId);
  const { data: standingsRes }                         = useTournamentStandings(tournamentId);
  const { data: topScorersRes }                        = useTournamentTopScorers(tournamentId);
  const { data: announcementsRes }                     = useTournamentAnnouncements(tournamentId);
  const { data: regsRes }                              = useTournamentRegistrations(tournamentId);

  const generateFixtures   = useGenerateTournamentFixtures(tournamentId);
  const advanceStage       = useAdvanceTournamentStage(tournamentId);
  const syncBracket        = useSyncTournamentBracket(tournamentId);
  const updateStatus       = useUpdateTournamentStatus(tournamentId);
  const startFixtureMatch  = useStartFixtureMatch(tournamentId);
  const acceptReg          = useAcceptRegistration(tournamentId);
  const rejectReg          = useRejectRegistration(tournamentId);
  const addPlayer          = useAddTournamentPlayer(tournamentId);
  const removePlayer       = useRemoveTournamentPlayer(tournamentId);
  const updateStats        = useUpdatePlayerStats(tournamentId);
  const postAnnouncement   = usePostTournamentAnnouncement(tournamentId);
  const deleteAnnouncement = useDeleteTournamentAnnouncement(tournamentId);
  const updateTournament   = useUpdateTournament(tournamentId);
  const updateMatchScore   = useUpdateMatchScore();
  const clearFixtures      = useClearTournamentFixtures(tournamentId);
  const addCoOrg           = useAddCoOrganizer(tournamentId);
  const updateCoOrgRole    = useUpdateCoOrganizerRole(tournamentId);
  const removeCoOrg        = useRemoveCoOrganizer(tournamentId);
  const saveGroupAssign    = useSaveGroupAssignments(tournamentId);
  const clearGroupAssign   = useClearGroupAssignments(tournamentId);
  const exportExcel        = useExportTournamentExcel(tournamentId);

  const tournament: any    = (tourRes as any)?.data ?? tourRes;
  const allStandings: any[]  = (standingsRes as any)?.data ?? standingsRes ?? [];
  const topScorers: any[]    = (topScorersRes as any)?.data ?? [];
  const announcements: any[] = (announcementsRes as any)?.data ?? [];
  const registrations: any[] = (regsRes as any)?.data ?? [];
  const allFixtures: any[]   = tournament?.fixtures ?? [];
  const teams: any[]         = Array.isArray(tournament?.teams) ? tournament.teams : [];
  const players: any[]       = Array.isArray(tournament?.players) ? tournament.players : [];
  const sponsors: any[]      = Array.isArray(tournament?.sponsors) ? tournament.sponsors : [];
  const stages: any[]        = Array.isArray(tournament?.stages) ? tournament.stages : [];
  const isMultiStage         = stages.length > 0 && !stages[0]?.singleFormat;
  const status: string       = tournament?.status ?? "draft";
  const ss                   = STATUS_STYLE[status] ?? STATUS_STYLE.draft;
  const coOrgs: any[]        = Array.isArray(tournament?.coOrganizers) ? tournament.coOrganizers : [];
  const myCoOrg              = coOrgs.find((c: any) => c.userId === currentUserId);
  const isCreator            = currentUserId !== null && tournament?.createdById === currentUserId;
  const isOrganizer          = isCreator || myCoOrg != null;          // any co-org role
  const isManager            = isCreator || myCoOrg?.role === "manager"; // full management access
  const isScorer             = isOrganizer;                             // all roles can score
  const statSchema           = getSportPlayerStatSchema(tournament?.sport);
  const { data: searchedUsersRes } = useSearchUsers(playerSearch);
  const searchedUsers: any[] = (searchedUsersRes as any)?.users ?? [];

  const { data: coOrgSearchRes } = useSearchUsers(coOrgSearch);
  const coOrgSearchResults: any[] = (coOrgSearchRes as any)?.users ?? [];

  // Backfill / repair QF when R16 done but slots wrong or still TBD
  const bracketSyncAttempted = useRef(false);
  const syncBracketMutate = syncBracket.mutate;
  useEffect(() => {
    if (!isManager || !tournament?.id || bracketSyncAttempted.current) return;

    const koFixtures = allFixtures.filter((f: any) => {
      const stageIdx = (f.stage ?? 1) - 1;
      return stages[stageIdx]?.format === "knockout";
    });
    if (koFixtures.length === 0) return;

    const hasCompletedKo = koFixtures.some(
      (f: any) =>
        f.status === "completed" ||
        f.match?.status === "completed"
    );
    if (!hasCompletedKo) return;

    const byRoundCount: Record<number, number> = {};
    for (const f of koFixtures) {
      const r = f.round ?? 1;
      byRoundCount[r] = (byRoundCount[r] ?? 0) + 1;
    }
    const matchOrdersBroken = koFixtures.some((f: any) => {
      const r = f.round ?? 1;
      return (f.matchOrder ?? 0) > (byRoundCount[r] ?? 0);
    });

    const hasUnresolvedDownstream = koFixtures.some((f: any) => {
      const done =
        f.status === "completed" || f.match?.status === "completed";
      if (done) return false;
      return isTBD(f.team1Ref) || isTBD(f.team2Ref);
    });

    // Also re-sync when QF already filled but slots were wrong (manager opens detail once)
    if (!hasUnresolvedDownstream && !matchOrdersBroken) return;

    bracketSyncAttempted.current = true;
    syncBracketMutate(undefined, {
      onError: () => {
        bracketSyncAttempted.current = false;
      },
    });
  }, [isManager, tournament?.id, allFixtures, stages, syncBracketMutate]);

  // ── Grouped-stage helpers ──────────────────────────────────────────────────
  // First stage with groupCount > 1 (if any)
  const groupedStage     = stages.find((s: any) => (s.groupCount ?? 0) > 1 && !s.singleFormat);
  const groupCount       = groupedStage ? (groupedStage.groupCount as number) : 0;
  const hasGroupedStage  = groupCount >= 2;
  const canEditGroups    = hasGroupedStage && isManager && (status === "draft" || status === "registration");

  /** Derive which group each team belongs to, preferring stored groupIndex then auto-slice. */
  function derivedGroupMap(): Record<string, number> {
    const map: Record<string, number> = {};
    const hasExplicit = teams.some((t: any) => t.groupIndex != null);
    if (hasExplicit) {
      const teamsPerGroup = Math.ceil(teams.length / groupCount);
      teams.forEach((t: any, i: number) => {
        map[t.name] = t.groupIndex ?? Math.floor(i / teamsPerGroup);
      });
    } else {
      const teamsPerGroup = Math.ceil(teams.length / groupCount);
      teams.forEach((t: any, i: number) => {
        map[t.name] = Math.floor(i / teamsPerGroup);
      });
    }
    return map;
  }

  // ── Derived fixture data ───────────────────────────────────────────────────

  const fixturesByStage = useMemo(() => {
    const map: Record<number, any[]> = {};
    for (const f of allFixtures) {
      const s = f.stage ?? 0;
      (map[s] ??= []).push(f);
    }
    return map;
  }, [allFixtures]);

  /** Expand knockout stages into Round of 16 / Quarters / Semis / Finals pills. */
  const stageNavItems = useMemo((): StageNavItem[] => {
    if (!isMultiStage) return [];
    const items: StageNavItem[] = [];
    for (let i = 0; i < stages.length; i++) {
      const s = stages[i];
      const stageNum = i + 1;
      const fix = fixturesByStage[stageNum] ?? [];
      const isKo = (s.format ?? "") === "knockout";
      if (isKo && fix.length > 0) {
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
  }, [isMultiStage, stages, fixturesByStage]);

  const stageKey   = isMultiStage ? activeStageNum : 0;
  const stageFixAll = fixturesByStage[stageKey] ?? [];
  // When knockout is expanded into round pills and URL has no ?round=, default to first round
  const effectiveRound = useMemo(() => {
    if (activeRound != null && !Number.isNaN(activeRound)) return activeRound;
    const koNav = stageNavItems.filter((i) => i.stageNum === activeStageNum && i.round != null);
    if (koNav.length > 0) return koNav[0].round;
    return null;
  }, [activeRound, stageNavItems, activeStageNum]);
  // Fixtures tab: optionally filter to one knockout round (e.g. Round of 16 only)
  const stageFix = effectiveRound != null
    ? stageFixAll.filter((f: any) => (f.round ?? 1) === effectiveRound)
    : stageFixAll;

  const { grouped, hasGroups } = useMemo(() => {
    const map: Record<number, any[]> = {};
    for (const f of stageFix) {
      const g = f.groupIndex ?? -1;
      (map[g] ??= []).push(f);
    }
    const hasGroups = Object.keys(map).some(k => parseInt(k) >= 0);
    return { grouped: map, hasGroups };
  }, [stageFix]);

  const maxRound = useMemo(
    () => stageFixAll.reduce((m, f) => Math.max(m, f.round ?? 1), 1),
    [stageFixAll]
  );

  /**
   * Per-group standings derived in two ways:
   *  1. Primary: fixtures carry groupIndex → use fixture map as source of truth.
   *  2. Fallback: groupCount >= 2 but fixtures have no groupIndex (e.g. generated
   *     before the group-split fix) → derive group membership from the teams array
   *     (stored groupIndex on team objects if set, otherwise auto-slice).
   * Returns null only when the stage has no group configuration at all.
   */
  const perGroupStandings = useMemo<Record<number, any[]> | null>(() => {
    const zeroRow = (name: string) => {
      const row = allStandings.find((s: any) => s.team === name);
      return row ?? { team: name, played: 0, won: 0, drawn: 0, lost: 0, points: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0 };
    };
    const sortRows = (rows: any[]) =>
      rows.sort((a: any, b: any) => b.points - a.points || b.won - a.won || (b.pointDiff ?? 0) - (a.pointDiff ?? 0));

    if (hasGroups) {
      // Primary path: fixtures carry groupIndex — use them as source of truth
      const result: Record<number, any[]> = {};
      for (const [gKey, gFix] of Object.entries(grouped)) {
        const gIdx = parseInt(gKey);
        if (gIdx < 0) continue;
        const teamNames = new Set<string>();
        for (const f of gFix as any[]) {
          if ((f.team1Ref as any)?.name) teamNames.add((f.team1Ref as any).name);
          if ((f.team2Ref as any)?.name) teamNames.add((f.team2Ref as any).name);
        }
        result[gIdx] = sortRows(Array.from(teamNames).map(zeroRow));
      }
      return result;
    }

    // Fallback path: no groupIndex on fixtures but stage is configured for groups.
    // Derive group membership from the teams array.
    if (groupCount >= 2 && teams.length >= groupCount) {
      const result: Record<number, any[]> = {};
      const hasExplicit    = teams.some((t: any) => t.groupIndex != null);
      const teamsPerGroup  = Math.ceil(teams.length / groupCount);
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
  }, [hasGroups, grouped, allStandings, groupCount, teams]);

  const stageConfig   = isMultiStage ? stages[activeStageNum - 1] : null;
  const isRoundRobin  = !stageConfig || stageConfig.format === "round_robin" || stageConfig.format === "league";
  const bestOf        = stageConfig?.bestOf as number | undefined;

  // Is it a knockout stage (for bracket tab visibility)?
  const isKnockoutStage = tournament?.format === "knockout" ||
    (stageConfig && (stageConfig.format === "knockout"));

  const scorableFixtures = stageFixAll.filter(
    (f: any) => !(f.team1Type === "winner" && f.team2Type === "winner")
  );
  const stageComplete = scorableFixtures.length > 0 &&
    scorableFixtures.every((f: any) => f.status === "completed" || f.match?.status === "completed" || f.status === "bye");

  const hasNextStage         = isMultiStage && activeStageNum < stages.length;
  const nextStageFixtures    = fixturesByStage[activeStageNum + 1] ?? [];
  const nextStageHasScored   = nextStageFixtures.some((f: any) => f.matchId != null);
  const stageAlreadyAdvanced = stageConfig?.status === "completed";

  const canGenerate = stageFixAll.length === 0 && teams.length >= 2
    && (status === "draft" || status === "registration" || status === "in_progress")
    && (!isMultiStage || activeStageNum === 1);

  // ── Action helpers ─────────────────────────────────────────────────────────

  function handleGenerate() {
    setActionError("");
    const stageArg = isMultiStage ? activeStageNum : undefined;
    generateFixtures.mutate(stageArg, {
      onError: () => setActionError("Failed to generate fixtures. Make sure teams are added."),
    });
  }

  function handleRegenerateSchedule() {
    if (!window.confirm(
      "This will delete all current fixtures for this stage and regenerate from the current team list. Are you sure?"
    )) return;
    setActionError("");
    // Multi-stage → active stage number (1-based)
    // True legacy (no stages config at all) → 0 (legacy stage)
    // Synthetic singleFormat stage → undefined (server defaults to 1)
    const stageArg =
      isMultiStage        ? activeStageNum :
      stages.length === 0 ? 0              :
      undefined;
    clearFixtures.mutate(stageArg, {
      onSuccess: () => {
        generateFixtures.mutate(stageArg, {
          onError: () => setActionError("Fixtures cleared but failed to regenerate. Try generating manually."),
        });
      },
      onError: (err: any) => {
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to clear fixtures.";
        setActionError(msg);
      },
    });
  }

  function handleAdvanceStage() {
    setActionError("");
    advanceStage.mutate(activeStageNum, {
      onSuccess: () => setActiveStageNum(s => s + 1),
      onError: (err: any) => {
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to advance stage. Ensure all matches are completed.";
        setActionError(msg);
      },
    });
  }

  function handleStatusChange(next: string) {
    setActionError("");
    updateStatus.mutate(next, {
      onError: () => setActionError("Failed to update status."),
    });
  }

  function handleScoreFixture(fixture: any) {
    if (fixture.matchId) {
      navigate(`/matches/${fixture.matchId}`);
      return;
    }
    setStartingFixtureId(fixture.id);
    setActionError("");
    startFixtureMatch.mutate(fixture.id, {
      onSuccess: (data) => {
        setStartingFixtureId(null);
        navigate(`/matches/${data.matchId}`);
      },
      onError: (err: any) => {
        setStartingFixtureId(null);
        const msg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Couldn't start this match. Please try again.";
        setActionError(msg);
      },
    });
  }

  function handleCopyRegLink() {
    const link = `${window.location.origin}/tournaments/${tournamentId}/register`;
    navigator.clipboard.writeText(link).then(() => {
      setCopyLinkDone(true);
      setTimeout(() => setCopyLinkDone(false), 2000);
    });
  }

  function handleShare() {
    const link = `${window.location.origin}/t/${tournamentId}`;
    navigator.clipboard.writeText(link).then(() => {
      setShareDone(true);
      setTimeout(() => setShareDone(false), 2000);
    });
  }

  async function handleExportExcel() {
    setActionError("");
    try {
      const blob = await exportExcel.mutateAsync();
      const slug = (tournament?.name ?? "tournament")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40);
      const date = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sportza-${slug || `tournament-${tournamentId}`}-${date}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? err?.message ?? "Export failed");
    }
  }

  function handleAddPlayer() {
    setPlayerError("");
    if (!addPlayerTeam || !quickPickUserId) {
      setPlayerError("Select team and one user to add.");
      return;
    }
    const picked = searchedUsers.find((u: any) => u.id === quickPickUserId);
    if (!picked) {
      setPlayerError("Pick a user from search results.");
      return;
    }
    (addPlayer as any).mutate({
      teamName:   addPlayerTeam,
      userId:     picked.id,
      username:   picked.email ?? picked.name ?? undefined,
      playerName: picked.name ?? picked.email ?? `User ${picked.id}`,
      jerseyNo:   addPlayerJersey ? parseInt(addPlayerJersey) : undefined,
    }, {
      onSuccess: () => {
        setAddPlayerJersey("");
        setQuickPickUserId(null);
      },
      onError:   (e: any) => setPlayerError(e?.response?.data?.error ?? "Failed to add player"),
    });
  }

  function handleBulkAssign() {
    setPlayerError("");
    if (!addPlayerTeam) {
      setPlayerError("Select a team first.");
      return;
    }
    if (selectedPlayerIds.length === 0) {
      setPlayerError("Select at least one user for bulk assign.");
      return;
    }
    const pickedUsers = searchedUsers.filter((u: any) => selectedPlayerIds.includes(u.id));
    if (pickedUsers.length === 0) {
      setPlayerError("Selected users are no longer in the current search results.");
      return;
    }
    Promise.all(
      pickedUsers.map((u: any) =>
        (addPlayer as any).mutateAsync({
          teamName: addPlayerTeam,
          userId: u.id,
          username: u.email ?? u.name ?? undefined,
          playerName: u.name ?? u.email ?? `User ${u.id}`,
        })
      )
    )
      .then(() => setSelectedPlayerIds([]))
      .catch((e: any) => setPlayerError(e?.response?.data?.error ?? "Failed to bulk assign players"));
  }

  function handlePostAnnouncement() {
    if (!annTitle.trim() || !annBody.trim()) return;
    postAnnouncement.mutate({ title: annTitle.trim(), body: annBody.trim() }, {
      onSuccess: () => { setAnnTitle(""); setAnnBody(""); setShowAnnModal(false); },
    });
  }

  // ── Status action config ───────────────────────────────────────────────────

  const statusAction = (() => {
    if (status === "draft")         return { label: "Open Registration", next: "registration", icon: Users,  color: "#3B82F6" };
    if (status === "registration")  return { label: "Start Tournament",  next: "in_progress",  icon: Play,   color: "#22C55E" };
    if (status === "in_progress" && stageComplete && !hasNextStage)
                                    return { label: "Complete Tournament",next: "completed",    icon: Flag,   color: "#F59E0B" };
    return null;
  })();

  // ── Loading / error ────────────────────────────────────────────────────────

  if (isError || (!isLoading && !tournament)) {
    return (
      <div className="min-h-screen bg-[#0F172A] px-4 pt-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-[#64748B] mb-4">
          <ChevronLeft style={{ width: "20px", height: "20px" }} /> Back
        </button>
        <div className="p-4 text-[#EF4444]" style={{ borderRadius: "12px", backgroundColor: "#1E293B" }}>
          Tournament not found.
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const TABS = [
    { key: "fixtures",  label: "Fixtures" },
    { key: "standings", label: "Standings" },
    { key: "teams",     label: "Teams" },
    { key: "bracket",   label: "Bracket" },
    { key: "stats",     label: "Stats" },
    { key: "updates",   label: "Updates" },
  ];

  return (
    <div className="min-h-screen bg-[#0F172A] pb-28">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 pt-8 pb-4">
        <button onClick={() => navigate(-1)}
          className="flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
          style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#1E293B" }}>
          <ChevronLeft style={{ width: "20px", height: "20px", color: "#94A3B8" }} />
        </button>
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="animate-pulse h-6 w-40 rounded" style={{ backgroundColor: "#1E293B" }} />
          ) : (
            <>
              <h1 className="text-white truncate" style={{ fontSize: "20px", fontWeight: "800" }}>
                {tournament?.name}
              </h1>
              <p className="text-[#64748B]" style={{ fontSize: "12px" }}>
                {tournament?.sport}
                {isMultiStage
                  ? ` · ${stages.length} stages`
                  : ` · ${(tournament?.format ?? "").replace("-", " ")}`}
              </p>
            </>
          )}
        </div>
        {!isLoading && tournament && (
          <div className="px-2 py-1 flex-shrink-0"
            style={{ borderRadius: "6px", backgroundColor: ss.bg, fontSize: "10px", fontWeight: "800", color: ss.color, letterSpacing: "0.04em" }}>
            {status.replace("_", " ").toUpperCase()}
          </div>
        )}
      </div>

      {/* ── Co-organizer identity banner ── */}
      {!isLoading && myCoOrg && (
        <div className="mx-4 mb-3 px-3 py-2 flex items-center gap-2"
          style={{ borderRadius: "10px", backgroundColor: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)" }}>
          <Shield style={{ width: "13px", height: "13px", color: "#F59E0B", flexShrink: 0 }} />
          <span style={{ fontSize: "11px", color: "#F59E0B", fontWeight: "600" }}>
            Co-organizer · {myCoOrg.role === "manager" ? "Manager" : "Scorer"}
          </span>
          <span style={{ fontSize: "10px", color: "#64748B", marginLeft: "2px" }}>
            {myCoOrg.role === "manager" ? "Full management access" : "Match scoring access"}
          </span>
        </div>
      )}

      {/* ── Meta strip ── */}
      {!isLoading && tournament && (
        <div className="mx-4 mb-4 p-4" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
          <div className="flex flex-wrap gap-3 mb-3">
            {tournament.startDate && (
              <div className="flex items-center gap-1.5 text-[#64748B]">
                <Calendar style={{ width: "14px", height: "14px" }} />
                <span style={{ fontSize: "12px" }}>
                  {format(new Date(tournament.startDate), "dd MMM")}
                  {tournament.endDate ? ` – ${format(new Date(tournament.endDate), "dd MMM yyyy")}` : ""}
                </span>
              </div>
            )}
            {tournament.venue?.name && (
              <div className="flex items-center gap-1.5 text-[#64748B]">
                <MapPin style={{ width: "14px", height: "14px" }} />
                <span style={{ fontSize: "12px" }}>{tournament.venue.name}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-[#64748B]">
              <Users style={{ width: "14px", height: "14px" }} />
              <span style={{ fontSize: "12px" }}>{teams.length} teams</span>
            </div>
            {tournament.maxTeams && (
              <div className="flex items-center gap-1.5 text-[#64748B]">
                <Trophy style={{ width: "14px", height: "14px" }} />
                <span style={{ fontSize: "12px" }}>Max {tournament.maxTeams}</span>
              </div>
            )}
          </div>

          {/* Edit Tournament — manager only, while tournament is not yet finished */}
          {isManager && status !== "completed" && status !== "cancelled" && (
            <button
              onClick={() => navigate(`/tournaments/${tournamentId}/edit`)}
              className="flex items-center gap-2 px-3 py-2 w-full active:scale-[0.98] transition-transform"
              style={{ borderRadius: "10px", backgroundColor: "rgba(100,116,139,0.1)", border: "1px solid rgba(100,116,139,0.25)" }}
            >
              <Pencil style={{ width: "14px", height: "14px", color: "#94A3B8" }} />
              <span style={{ fontSize: "12px", color: "#94A3B8", fontWeight: "600", flex: 1, textAlign: "left" }}>
                Edit tournament details
              </span>
            </button>
          )}

          {/* Share Live link — visible to everyone */}
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-3 py-2 w-full active:scale-[0.98] transition-transform"
            style={{ borderRadius: "10px", backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}
          >
            <Share2 style={{ width: "14px", height: "14px", color: "#F59E0B" }} />
            <span style={{ fontSize: "12px", color: "#F59E0B", fontWeight: "600", flex: 1, textAlign: "left" }}>
              {shareDone ? "Link copied!" : "Share live scores"}
            </span>
          </button>

          {isOrganizer && (
            <button
              onClick={handleExportExcel}
              disabled={exportExcel.isPending}
              className="flex items-center gap-2 px-3 py-2 w-full active:scale-[0.98] transition-transform disabled:opacity-50"
              style={{ borderRadius: "10px", backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}
            >
              {exportExcel.isPending ? (
                <Loader2 style={{ width: "14px", height: "14px", color: "#22C55E" }} className="animate-spin" />
              ) : (
                <FileSpreadsheet style={{ width: "14px", height: "14px", color: "#22C55E" }} />
              )}
              <span style={{ fontSize: "12px", color: "#22C55E", fontWeight: "600", flex: 1, textAlign: "left" }}>
                {exportExcel.isPending ? "Generating Excel…" : "Export Excel"}
              </span>
            </button>
          )}

          {/* Registration share link (manager, when in registration status) */}
          {isManager && status === "registration" && (
            <button
              onClick={handleCopyRegLink}
              className="flex items-center gap-2 px-3 py-2 w-full active:scale-[0.98] transition-transform"
              style={{ borderRadius: "10px", backgroundColor: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)" }}
            >
              <Link2 style={{ width: "14px", height: "14px", color: "#3B82F6" }} />
              <span style={{ fontSize: "12px", color: "#3B82F6", fontWeight: "600", flex: 1, textAlign: "left" }}>
                {copyLinkDone ? "Link copied!" : "Copy team registration link"}
              </span>
            </button>
          )}

          {/* Sponsors strip */}
          {sponsors.length > 0 && (
            <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <p style={{ fontSize: "10px", color: "#475569", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
                Sponsors
              </p>
              <div className="flex flex-wrap gap-2">
                {sponsors.map((sp: any, i: number) => (
                  <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5"
                    style={{ borderRadius: "8px", backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                    {sp.logoUrl ? (
                      <img src={sp.logoUrl} alt={sp.name} style={{ width: "16px", height: "16px", borderRadius: "3px", objectFit: "contain" }} />
                    ) : (
                      <Star style={{ width: "12px", height: "12px", color: "#F59E0B" }} />
                    )}
                    <span style={{ fontSize: "11px", color: "#F59E0B", fontWeight: "600" }}>{sp.name}</span>
                    {sp.tier && (
                      <span style={{ fontSize: "9px", color: "#64748B" }}>· {sp.tier}</span>
                    )}
                  </div>
                ))}
                {isManager && (
                  <button
                    onClick={() => setShowSponsorModal(true)}
                    className="flex items-center gap-1 px-2 py-1 active:scale-90 transition-transform"
                    style={{ borderRadius: "8px", backgroundColor: "rgba(100,116,139,0.1)", border: "1px dashed rgba(100,116,139,0.3)" }}
                  >
                    <Plus style={{ width: "12px", height: "12px", color: "#64748B" }} />
                    <span style={{ fontSize: "11px", color: "#64748B" }}>Add</span>
                  </button>
                )}
              </div>
            </div>
          )}
          {/* Add sponsors CTA when none exist (manager) */}
          {isManager && sponsors.length === 0 && (
            <button
              onClick={() => setShowSponsorModal(true)}
              className="flex items-center gap-2 mt-3 px-3 py-2 active:scale-[0.98] transition-transform"
              style={{ borderRadius: "10px", border: "1px dashed rgba(100,116,139,0.3)" }}
            >
              <Star style={{ width: "13px", height: "13px", color: "#64748B" }} />
              <span style={{ fontSize: "12px", color: "#64748B" }}>Add sponsors</span>
            </button>
          )}
        </div>
      )}

      {/* ── Status action button ── */}
      {!isLoading && statusAction && isManager && (
        <div className="mx-4 mb-4">
          <button
            onClick={() => handleStatusChange(statusAction.next)}
            disabled={updateStatus.isPending}
            className="w-full flex items-center justify-center gap-2 py-3 active:scale-[0.98] transition-transform"
            style={{
              borderRadius: "12px", fontSize: "14px", fontWeight: "700", color: "#fff",
              backgroundColor: statusAction.color,
              opacity: updateStatus.isPending ? 0.6 : 1,
            }}
          >
            <statusAction.icon style={{ width: "16px", height: "16px" }} />
            {updateStatus.isPending ? "Updating…" : statusAction.label}
          </button>
        </div>
      )}

      {/* ── Stage selector (multi-stage only) ── */}
      {isMultiStage && !isLoading && (
        <div className="flex gap-2 px-4 mb-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {stageNavItems.map((item) => {
            const isActive = item.stageNum === activeStageNum
              && (item.round == null ? effectiveRound == null : item.round === effectiveRound);
            const fixForItem = (fixturesByStage[item.stageNum] ?? []).filter((f: any) =>
              item.round == null ? true : (f.round ?? 1) === item.round
            );
            const hasFix = fixForItem.length > 0;
            const isDone = hasFix && fixForItem.every(
              (f: any) => f.status === "completed" || f.match?.status === "completed" || f.status === "bye"
            );
            return (
              <button key={item.key} onClick={() => setActiveStageNav(item.stageNum, item.round)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 active:scale-95 transition-transform"
                style={{
                  borderRadius: "10px", fontSize: "12px", fontWeight: isActive ? "700" : "500",
                  backgroundColor: isActive ? "#F59E0B" : "#1E293B",
                  color: isActive ? "#000" : "#64748B",
                  border: isActive ? "none" : "1px solid rgba(255,255,255,0.06)",
                }}>
                {isDone && <CheckCircle style={{ width: "12px", height: "12px", color: isActive ? "#000" : "#22C55E" }} />}
                {item.name}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Main tabs ── */}
      <div className="flex gap-2 px-4 pb-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className="flex-shrink-0 px-4 py-2 active:scale-95 transition-transform"
            style={{
              borderRadius: "10px", fontSize: "13px", fontWeight: activeTab === key ? "700" : "500",
              backgroundColor: activeTab === key ? "#3B82F6" : "#1E293B",
              color: activeTab === key ? "#fff" : "#64748B",
              border: activeTab === key ? "none" : "1px solid rgba(255,255,255,0.06)",
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Error banner ── */}
      {actionError && (
        <div className="mx-4 mb-3 p-3 text-center"
          style={{ borderRadius: "10px", backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <p style={{ fontSize: "13px", color: "#EF4444" }}>{actionError}</p>
        </div>
      )}

      <div className="px-4 max-w-md mx-auto space-y-3">

        {/* ═══════════════════════════════════════════════════════
            FIXTURES TAB
        ═══════════════════════════════════════════════════════ */}
        {activeTab === "fixtures" && (
          <>
            {canGenerate && isManager && (
              <div
                className="p-6 text-center"
                style={{ borderRadius: "18px", background: "linear-gradient(135deg,rgba(245,158,11,0.12),rgba(217,119,6,0.08))", border: "1px dashed rgba(245,158,11,0.35)" }}
              >
                <div className="flex items-center justify-center mb-3"
                  style={{ width: "52px", height: "52px", borderRadius: "16px", backgroundColor: "rgba(245,158,11,0.15)", margin: "0 auto 12px", fontSize: "24px" }}>
                  🗓️
                </div>
                <p className="text-white mb-1" style={{ fontSize: "16px", fontWeight: "700" }}>
                  {isMultiStage ? `Generate Stage ${activeStageNum} Schedule` : "Generate Match Schedule"}
                </p>
                <p className="text-[#64748B] mb-5" style={{ fontSize: "12px" }}>
                  {isMultiStage && stageConfig?.format === "round_robin"
                    ? `Round-robin within ${stageConfig.groupCount ?? 1} group${(stageConfig.groupCount ?? 1) > 1 ? "s" : ""}`
                    : isMultiStage && stageConfig?.format === "knockout"
                      ? `Single-elimination bracket${bestOf ? ` · Best of ${bestOf}` : ""}`
                      : tournament?.format === "knockout"
                        ? "Single-elimination knockout bracket with byes as needed"
                        : "Round-robin schedule — every team plays every other team"}
                </p>
                <button
                  onClick={handleGenerate}
                  disabled={generateFixtures.isPending}
                  className="flex items-center justify-center gap-2 mx-auto px-6 py-3 active:scale-95 transition-transform"
                  style={{
                    borderRadius: "12px", fontSize: "14px", fontWeight: "700", color: "#fff",
                    background: generateFixtures.isPending ? "#1E293B" : "linear-gradient(135deg,#F59E0B,#D97706)",
                    boxShadow: generateFixtures.isPending ? "none" : "0 4px 20px rgba(245,158,11,0.3)",
                  }}
                >
                  <Zap style={{ width: "16px", height: "16px" }} />
                  {generateFixtures.isPending ? "Generating…" : "Generate Schedule"}
                </button>
              </div>
            )}

            {stageAlreadyAdvanced && hasNextStage && nextStageFixtures.length > 0 && (
              <div
                className="p-4 flex items-center gap-3"
                style={{ borderRadius: "14px", background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)" }}
              >
                <CheckCircle style={{ width: "22px", height: "22px", color: "#22C55E", flexShrink: 0 }} />
                <p className="text-[#94A3B8]" style={{ fontSize: "13px" }}>
                  Stage {activeStageNum} already advanced.{" "}
                  <button
                    onClick={() => setActiveStageNum(activeStageNum + 1)}
                    className="text-[#22C55E] font-semibold underline"
                  >
                    Go to {stages[activeStageNum]?.name ?? `Stage ${activeStageNum + 1}`}
                  </button>
                </p>
              </div>
            )}

            {stageAlreadyAdvanced && hasNextStage && nextStageFixtures.length === 0 && isManager && (
              <div
                className="p-4 flex items-center gap-4"
                style={{ borderRadius: "14px", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)" }}
              >
                <AlertTriangle style={{ width: "24px", height: "24px", color: "#EF4444", flexShrink: 0 }} />
                <div className="flex-1">
                  <p className="text-white" style={{ fontSize: "14px", fontWeight: "700" }}>
                    {stages[activeStageNum]?.name ?? `Stage ${activeStageNum + 1}`} fixtures not generated
                  </p>
                  <p className="text-[#94A3B8]" style={{ fontSize: "11px", marginTop: "2px" }}>
                    Scores were corrected — retry to generate fixtures based on updated standings.
                  </p>
                </div>
                <button
                  onClick={handleAdvanceStage}
                  disabled={advanceStage.isPending}
                  className="flex items-center gap-1 px-3 py-2 active:scale-95 transition-transform flex-shrink-0"
                  style={{ borderRadius: "10px", backgroundColor: "#F59E0B", fontSize: "12px", fontWeight: "700", color: "#fff" }}
                >
                  {advanceStage.isPending ? "…" : (<>Retry <Zap style={{ width: "13px", height: "13px" }} /></>)}
                </button>
              </div>
            )}

            {!canGenerate && stageComplete && hasNextStage && !nextStageHasScored && !stageAlreadyAdvanced && isManager && (
              <div
                className="p-4 flex items-center gap-4"
                style={{ borderRadius: "14px", background: "linear-gradient(135deg,rgba(34,197,94,0.12),rgba(22,163,74,0.08))", border: "1px solid rgba(34,197,94,0.3)" }}
              >
                <CheckCircle style={{ width: "28px", height: "28px", color: "#22C55E", flexShrink: 0 }} />
                <div className="flex-1">
                  <p className="text-white" style={{ fontSize: "14px", fontWeight: "700" }}>Stage {activeStageNum} Complete!</p>
                  <p className="text-[#64748B]" style={{ fontSize: "11px", marginTop: "2px" }}>
                    {nextStageFixtures.length > 0
                      ? `Regenerate ${stages[activeStageNum]?.name ?? `Stage ${activeStageNum + 1}`} fixtures`
                      : `Advance to ${stages[activeStageNum]?.name ?? `Stage ${activeStageNum + 1}`}`}
                  </p>
                </div>
                <button
                  onClick={handleAdvanceStage}
                  disabled={advanceStage.isPending}
                  className="flex items-center gap-1 px-3 py-2 active:scale-95 transition-transform flex-shrink-0"
                  style={{ borderRadius: "10px", backgroundColor: "#22C55E", fontSize: "12px", fontWeight: "700", color: "#fff" }}
                >
                  {advanceStage.isPending ? "…" : (<>Next <ChevronRight style={{ width: "14px", height: "14px" }} /></>)}
                </button>
              </div>
            )}

            {isManager && stageFixAll.length > 0
              && stageFixAll.every((f: any) => f.status !== "completed" && f.match?.status !== "completed")
              && status !== "completed" && (
              <div className="flex justify-end mb-1">
                <button
                  onClick={handleRegenerateSchedule}
                  disabled={clearFixtures.isPending || generateFixtures.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 active:scale-95 transition-transform"
                  style={{
                    borderRadius: "8px", fontSize: "12px", fontWeight: "600",
                    color: "#F59E0B", border: "1px solid rgba(245,158,11,0.4)",
                    background: "rgba(245,158,11,0.07)",
                    opacity: clearFixtures.isPending || generateFixtures.isPending ? 0.6 : 1,
                  }}
                >
                  <Zap style={{ width: "13px", height: "13px" }} />
                  {clearFixtures.isPending || generateFixtures.isPending ? "Working…" : "Regenerate Schedule"}
                </button>
              </div>
            )}

            {stageFix.length > 0 && (
              hasGroups
                ? Object.entries(grouped)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .map(([gKey, gFix]) => {
                      const gIdx = parseInt(gKey);
                      if (gIdx < 0) return null;
                      const rounds = [...new Set(gFix.map((f: any) => f.round ?? 1))].sort((a, b) => a - b);
                      return (
                        <div key={gKey}>
                          <div className="flex items-center gap-2 mb-2 mt-1">
                            <div className="flex items-center justify-center"
                              style={{ width: "22px", height: "22px", borderRadius: "6px", backgroundColor: "#334155", fontSize: "11px", fontWeight: "800", color: "#94A3B8" }}>
                              {GROUP_LETTERS[gIdx] ?? gIdx}
                            </div>
                            <span className="text-[#94A3B8]" style={{ fontSize: "12px", fontWeight: "700" }}>
                              Group {GROUP_LETTERS[gIdx] ?? gIdx + 1}
                            </span>
                          </div>
                          {rounds.map(r => (
                            <div key={r} className="mb-3">
                              <p className="text-[#475569] mb-1.5 ml-1" style={{ fontSize: "10px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                Round {r}
                              </p>
                              {gFix.filter((f: any) => (f.round ?? 1) === r).map((f: any, i: number) => (
                                <FixtureCard
                                  key={f.id ?? i}
                                  fixture={f}
                                  isRoundRobin={true}
                                  maxRound={maxRound}
                                  isTournamentActive={status === "in_progress"}
                                  isStarting={startingFixtureId === f.id}
                                  tournamentId={tournamentId}
                                  onScore={() => handleScoreFixture(f)}
                                  isOrganizer={isOrganizer}
                                  onEditScore={isOrganizer && f.matchId ? () => setEditScoreFixture(f) : undefined}
                                />
                              ))}
                            </div>
                          ))}
                        </div>
                      );
                    })
                : (() => {
                    const rounds = [...new Set(stageFix.map((f: any) => f.round ?? 1))].sort((a, b) => a - b);
                    return rounds.map(r => (
                      <div key={r} className="mb-3">
                        <p className="text-[#475569] mb-1.5 ml-1" style={{ fontSize: "10px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          {isRoundRobin
                            ? `Round ${r}`
                            : knockoutRoundLabel(r, stageFix.filter((f: any) => (f.round ?? 1) === r).length, maxRound)}
                          {r === maxRound && bestOf ? ` · Best of ${bestOf}` : ""}
                        </p>
                        {stageFix
                          .filter((f: any) => (f.round ?? 1) === r)
                          .slice()
                          .sort((a: any, b: any) => (a.matchOrder ?? 0) - (b.matchOrder ?? 0))
                          .map((f: any, i: number) => (
                          <FixtureCard
                            key={f.id ?? i}
                            fixture={f}
                            isRoundRobin={isRoundRobin}
                            maxRound={maxRound}
                            bestOf={r === maxRound ? bestOf : undefined}
                            isTournamentActive={status === "in_progress"}
                            isStarting={startingFixtureId === f.id}
                            tournamentId={tournamentId}
                            onScore={() => handleScoreFixture(f)}
                            isOrganizer={isOrganizer}
                            onEditScore={isOrganizer && f.matchId ? () => setEditScoreFixture(f) : undefined}
                          />
                        ))}
                      </div>
                    ));
                  })()
            )}

            {stageFix.length === 0 && !canGenerate && (
              <div className="p-8 text-center" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
                <Trophy style={{ width: "28px", height: "28px", color: "#334155", margin: "0 auto 8px" }} />
                <p className="text-[#475569]" style={{ fontSize: "13px", fontWeight: "600" }}>No fixtures yet</p>
                <p className="text-[#334155]" style={{ fontSize: "11px", marginTop: "3px" }}>
                  {teams.length < 2 ? "Add at least 2 teams first" : "Add teams and open registration to generate a schedule"}
                </p>
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════
            STANDINGS TAB
        ═══════════════════════════════════════════════════════ */}
        {activeTab === "standings" && (() => {
          // Shared row renderer used for both single-table and per-group tables
          const renderStandingsTable = (rows: any[], showPlacement = false) => (
            <div style={{ borderRadius: "16px", backgroundColor: "#1E293B", overflow: "hidden" }}>
              <div className="flex items-center px-4 py-2.5"
                style={{ backgroundColor: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="flex-1 text-[#64748B]" style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Team</span>
                {["P", "W", "D", "L", "+/-", "Pts"].map(h => (
                  <span key={h} className="text-[#64748B]"
                    style={{ fontSize: "11px", fontWeight: "700", width: h === "+/-" ? "40px" : "32px", textAlign: "center" }}>{h}</span>
                ))}
              </div>
              {rows.map((s: any, i: number) => {
                const diff      = s.pointDiff ?? (s.pointsFor != null ? s.pointsFor - (s.pointsAgainst ?? 0) : null);
                const diffLabel = diff == null ? "-" : diff > 0 ? `+${diff}` : `${diff}`;
                const diffColor = diff == null || diff === 0 ? "#94A3B8" : diff > 0 ? "#22C55E" : "#EF4444";
                const isChampion = showPlacement && s.placement === "champion";
                const isRunnerUp = showPlacement && s.placement === "runner_up";
                const rowBg      = isChampion ? "rgba(245,158,11,0.06)" : isRunnerUp ? "rgba(148,163,184,0.04)" : "transparent";
                return (
                  <div key={s.team ?? i} className="flex items-center px-4 py-3"
                    style={{ borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", backgroundColor: rowBg }}>
                    <div className="mr-3 flex items-center justify-center" style={{ minWidth: "20px" }}>
                      {isChampion
                        ? <Trophy style={{ width: "15px", height: "15px", color: "#F59E0B" }} />
                        : isRunnerUp
                          ? <span style={{ fontSize: "13px", fontWeight: "700", color: "#94A3B8" }}>2</span>
                          : <span style={{ fontSize: "13px", fontWeight: "700", color: "#64748B" }}>{i + 1}</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="truncate block" style={{ fontSize: "14px", fontWeight: "600", color: isChampion ? "#F59E0B" : "#E2E8F0" }}>{s.team}</span>
                      {isChampion && <span style={{ fontSize: "10px", fontWeight: "700", color: "#F59E0B", letterSpacing: "0.05em", textTransform: "uppercase" }}>Champion</span>}
                      {isRunnerUp && <span style={{ fontSize: "10px", fontWeight: "600", color: "#94A3B8", letterSpacing: "0.05em", textTransform: "uppercase" }}>Runner-up</span>}
                    </div>
                    {[
                      { v: s.played,     color: "#94A3B8", w: "32px", fw: "500" },
                      { v: s.won,        color: "#22C55E", w: "32px", fw: "500" },
                      { v: s.drawn ?? 0, color: "#94A3B8", w: "32px", fw: "500" },
                      { v: s.lost,       color: "#94A3B8", w: "32px", fw: "500" },
                      { v: diffLabel,    color: diffColor,  w: "40px", fw: "700" },
                      { v: s.points,     color: "#F59E0B",  w: "32px", fw: "800" },
                    ].map(({ v, color, w, fw }, j) => (
                      <span key={j} style={{ fontSize: "13px", fontWeight: fw, width: w, textAlign: "center", color }}>
                        {v ?? 0}
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
          );

          // Per-group standings: show one table per group when fixtures are split
          if (perGroupStandings && Object.keys(perGroupStandings).length >= 2) {
            return (
              <>
                {Object.entries(perGroupStandings)
                  .sort(([a], [b]) => parseInt(a) - parseInt(b))
                  .map(([gKey, rows]) => {
                    const gIdx   = parseInt(gKey);
                    const letter = GROUP_LETTERS[gIdx] ?? String(gIdx + 1);
                    return (
                      <div key={gKey}>
                        {/* Group header */}
                        <div className="flex items-center gap-2 mb-2 mt-1">
                          <div className="flex items-center justify-center"
                            style={{ width: "22px", height: "22px", borderRadius: "6px", backgroundColor: "#334155", fontSize: "11px", fontWeight: "800", color: "#94A3B8" }}>
                            {letter}
                          </div>
                          <span style={{ fontSize: "13px", fontWeight: "700", color: "#94A3B8" }}>
                            Group {letter}
                          </span>
                        </div>
                        {renderStandingsTable(rows, false)}
                      </div>
                    );
                  })
                }
                {/* After tournament completes, show global final standings */}
                {allStandings.some((s: any) => s.placement) && (
                  <div>
                    <div className="flex items-center gap-2 mb-2 mt-3">
                      <Trophy style={{ width: "14px", height: "14px", color: "#F59E0B" }} />
                      <span style={{ fontSize: "13px", fontWeight: "700", color: "#F59E0B" }}>Final Standings</span>
                    </div>
                    {renderStandingsTable(allStandings, true)}
                  </div>
                )}
              </>
            );
          }

          // Single-table fallback (no groups, or group data not available yet)
          if (allStandings.length === 0) {
            return (
              <div className="p-8 text-center" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
                <p className="text-[#64748B]" style={{ fontSize: "13px" }}>No standings yet — matches must be completed first.</p>
              </div>
            );
          }
          return renderStandingsTable(allStandings, true);
        })()}

        {/* ═══════════════════════════════════════════════════════
            TEAMS TAB
        ═══════════════════════════════════════════════════════ */}
        {activeTab === "teams" && (
          <>
            {/* Pending registrations (manager only) */}
            {isManager && registrations.length > 0 && (
              <div style={{ borderRadius: "16px", backgroundColor: "#1E293B", overflow: "hidden" }}>
                <div className="px-4 py-3 flex items-center gap-2"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", backgroundColor: "rgba(59,130,246,0.08)" }}>
                  <UserPlus style={{ width: "14px", height: "14px", color: "#3B82F6" }} />
                  <p style={{ fontSize: "13px", fontWeight: "700", color: "#3B82F6" }}>
                    {registrations.length} Pending Registration{registrations.length !== 1 ? "s" : ""}
                  </p>
                </div>
                {registrations.map((reg: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3"
                    style={{ borderBottom: i < registrations.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-white" style={{ fontSize: "13px", fontWeight: "700" }}>{reg.teamName}</p>
                      <p className="text-[#64748B]" style={{ fontSize: "11px" }}>{reg.captainName}{reg.captainPhone ? ` · ${reg.captainPhone}` : ""}</p>
                      {reg.notes && <p className="text-[#475569]" style={{ fontSize: "10px", marginTop: "2px" }}>{reg.notes}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => acceptReg.mutate(reg.teamName)}
                        disabled={acceptReg.isPending}
                        className="px-3 py-1.5 active:scale-90 transition-transform"
                        style={{ borderRadius: "8px", backgroundColor: "rgba(34,197,94,0.15)", fontSize: "11px", fontWeight: "700", color: "#22C55E" }}
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => rejectReg.mutate(reg.teamName)}
                        disabled={rejectReg.isPending}
                        className="px-3 py-1.5 active:scale-90 transition-transform"
                        style={{ borderRadius: "8px", backgroundColor: "rgba(239,68,68,0.1)", fontSize: "11px", fontWeight: "700", color: "#EF4444" }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Group Assignment card ───────────────────────────────────── */}
            {hasGroupedStage && teams.length >= 2 && (
              <div style={{ borderRadius: "16px", backgroundColor: "#1E293B", overflow: "hidden" }}>
                {/* Header */}
                <div className="flex items-center gap-2 px-4 py-3"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", backgroundColor: "rgba(168,85,247,0.08)" }}>
                  <Shuffle style={{ width: "14px", height: "14px", color: "#A855F7" }} />
                  <p className="flex-1" style={{ fontSize: "13px", fontWeight: "700", color: "#A855F7" }}>
                    Group Assignment
                  </p>
                  {!groupEditMode && canEditGroups && (
                    <button
                      onClick={() => {
                        setLocalGroupMap(derivedGroupMap());
                        setGroupAssignError("");
                        setGroupEditMode(true);
                      }}
                      className="flex items-center gap-1 px-3 py-1 active:scale-90 transition-transform"
                      style={{ borderRadius: "8px", backgroundColor: "rgba(168,85,247,0.15)", fontSize: "11px", fontWeight: "700", color: "#A855F7" }}
                    >
                      <Pencil style={{ width: "10px", height: "10px" }} />
                      Edit Groups
                    </button>
                  )}
                  {groupEditMode && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          // Auto-assign: even slice, clear stored assignments
                          const map: Record<string, number> = {};
                          const tpg = Math.ceil(teams.length / groupCount);
                          teams.forEach((t: any, i: number) => { map[t.name] = Math.floor(i / tpg); });
                          setLocalGroupMap(map);
                          setGroupAssignError("");
                        }}
                        className="flex items-center gap-1 px-3 py-1 active:scale-90 transition-transform"
                        style={{ borderRadius: "8px", backgroundColor: "rgba(100,116,139,0.2)", fontSize: "11px", fontWeight: "700", color: "#94A3B8" }}
                      >
                        <ArrowLeftRight style={{ width: "10px", height: "10px" }} />
                        Auto
                      </button>
                      <button
                        onClick={() => { setGroupEditMode(false); setGroupAssignError(""); }}
                        className="px-3 py-1 active:scale-90 transition-transform"
                        style={{ borderRadius: "8px", backgroundColor: "rgba(239,68,68,0.1)", fontSize: "11px", fontWeight: "700", color: "#EF4444" }}
                      >
                        Cancel
                      </button>
                      <button
                        disabled={saveGroupAssign.isPending}
                        onClick={async () => {
                          setGroupAssignError("");
                          // Validate: each group has >= 2 teams
                          const buckets: Record<number, number> = {};
                          for (const gi of Object.values(localGroupMap)) {
                            buckets[gi] = (buckets[gi] ?? 0) + 1;
                          }
                          for (let g = 0; g < groupCount; g++) {
                            if ((buckets[g] ?? 0) < 2) {
                              setGroupAssignError(`Group ${GROUP_LETTERS[g]} needs at least 2 teams`);
                              return;
                            }
                          }
                          try {
                            await saveGroupAssign.mutateAsync({
                              assignments: Object.entries(localGroupMap).map(([name, gi]) => ({ name, groupIndex: gi })),
                            });
                            setGroupEditMode(false);
                          } catch (e: any) {
                            setGroupAssignError(e?.response?.data?.error ?? "Failed to save");
                          }
                        }}
                        className="px-3 py-1 active:scale-90 transition-transform"
                        style={{ borderRadius: "8px", backgroundColor: "#A855F7", fontSize: "11px", fontWeight: "700", color: "#fff" }}
                      >
                        {saveGroupAssign.isPending ? "Saving…" : "Save"}
                      </button>
                    </div>
                  )}
                </div>

                {groupAssignError && (
                  <p className="px-4 pt-2 pb-0" style={{ fontSize: "11px", color: "#EF4444" }}>{groupAssignError}</p>
                )}

                {/* Group columns */}
                <div className="p-3" style={{ overflowX: "auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${groupCount}, minmax(140px, 1fr))`, gap: "8px", minWidth: "min-content" }}>
                  {Array.from({ length: groupCount }, (_, g) => {
                    const currentMap = groupEditMode ? localGroupMap : derivedGroupMap();
                    const groupTeams = teams.filter((t: any) => currentMap[t.name] === g);
                    return (
                      <div key={g} style={{ borderRadius: "10px", backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div className="px-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                          <p style={{ fontSize: "11px", fontWeight: "800", color: "#A855F7", letterSpacing: "0.05em" }}>
                            GROUP {GROUP_LETTERS[g]}
                          </p>
                          <p style={{ fontSize: "10px", color: "#64748B" }}>{groupTeams.length} teams</p>
                        </div>
                        <div className="p-2 flex flex-col gap-1">
                          {groupTeams.length === 0 ? (
                            <p className="text-center py-2" style={{ fontSize: "10px", color: "#475569" }}>Empty</p>
                          ) : (
                            groupTeams.map((t: any) => (
                              <div key={t.name} className="flex items-center gap-2 px-2 py-1.5"
                                style={{ borderRadius: "7px", backgroundColor: "rgba(255,255,255,0.04)" }}>
                                <div className="flex items-center justify-center text-white flex-shrink-0"
                                  style={{ width: "22px", height: "22px", borderRadius: "6px", backgroundColor: "#334155", fontSize: "10px", fontWeight: "800" }}>
                                  {t.name.charAt(0).toUpperCase()}
                                </div>
                                <p className="flex-1 truncate text-white" style={{ fontSize: "11px", fontWeight: "600" }}>{t.name}</p>
                                {groupEditMode && (
                                  <div className="flex gap-1">
                                    {g > 0 && (
                                      <button
                                        onClick={() => setLocalGroupMap(m => ({ ...m, [t.name]: g - 1 }))}
                                        className="active:scale-90 transition-transform"
                                        style={{ padding: "2px 5px", borderRadius: "5px", backgroundColor: "rgba(168,85,247,0.15)", color: "#A855F7", fontSize: "10px", lineHeight: 1 }}
                                        title={`Move to Group ${GROUP_LETTERS[g - 1]}`}
                                      >←</button>
                                    )}
                                    {g < groupCount - 1 && (
                                      <button
                                        onClick={() => setLocalGroupMap(m => ({ ...m, [t.name]: g + 1 }))}
                                        className="active:scale-90 transition-transform"
                                        style={{ padding: "2px 5px", borderRadius: "5px", backgroundColor: "rgba(168,85,247,0.15)", color: "#A855F7", fontSize: "10px", lineHeight: 1 }}
                                        title={`Move to Group ${GROUP_LETTERS[g + 1]}`}
                                      >→</button>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                </div>

                {/* Reset to auto button (read-only mode, manager only) */}
                {!groupEditMode && canEditGroups && teams.some((t: any) => t.groupIndex != null) && (
                  <div className="px-4 pb-3 flex justify-end">
                    <button
                      disabled={clearGroupAssign.isPending}
                      onClick={() => clearGroupAssign.mutate()}
                      className="flex items-center gap-1 active:scale-90 transition-transform"
                      style={{ fontSize: "11px", color: "#64748B", fontWeight: "600" }}
                    >
                      <ArrowLeftRight style={{ width: "10px", height: "10px" }} />
                      {clearGroupAssign.isPending ? "Resetting…" : "Reset to Auto"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Team list with player rosters */}
            {teams.length === 0 ? (
              <div className="p-8 text-center" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
                <Users style={{ width: "28px", height: "28px", color: "#334155", margin: "0 auto 8px" }} />
                <p className="text-[#475569]" style={{ fontSize: "13px", fontWeight: "600" }}>No teams yet</p>
              </div>
            ) : (
              teams.map((t: any, i: number) => {
                const teamPlayers = players.filter((p: any) => p.teamName === t.name);
                const canDeleteTeam = isManager && (status === "draft" || status === "registration");
                return (
                  <TeamCard
                    key={i}
                    team={t}
                    players={teamPlayers}
                    statSchema={statSchema}
                    isOrganizer={isOrganizer}
                    onRemovePlayer={(playerName: string) =>
                      removePlayer.mutate({ teamName: t.name, playerName })
                    }
                    onDelete={canDeleteTeam ? () =>
                      updateTournament.mutate({
                        teams: teams.filter((_: any, j: number) => j !== i).map((tm: any) => ({ name: tm.name })),
                      })
                    : undefined}
                  />
                );
              })
            )}

            {/* Add player form (organizer) */}
            {isOrganizer && teams.length > 0 && (
              <div className="p-4" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
                <p className="text-white mb-3" style={{ fontSize: "14px", fontWeight: "700" }}>Add Players from Sportza Users</p>
                {playerError && (
                  <p style={{ fontSize: "12px", color: "#EF4444", marginBottom: "8px" }}>{playerError}</p>
                )}
                <div className="space-y-2.5">
                  <select
                    value={addPlayerTeam}
                    onChange={e => setAddPlayerTeam(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: "13px", outline: "none" }}
                  >
                    <option value="">Select team…</option>
                    {teams.map((t: any) => <option key={t.name} value={t.name}>{t.name}</option>)}
                  </select>
                  <input
                    value={playerSearch}
                    onChange={e => setPlayerSearch(e.target.value)}
                    placeholder="Search users by name / email / phone"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: "13px", outline: "none" }}
                  />

                  {playerSearch.trim().length >= 2 && (
                    <div style={{ borderRadius: "10px", backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.08)", maxHeight: "200px", overflowY: "auto" }}>
                      {searchedUsers.length === 0 ? (
                        <p className="px-3 py-2 text-[#64748B]" style={{ fontSize: "12px" }}>No users found.</p>
                      ) : searchedUsers.map((u: any) => {
                        const selected = selectedPlayerIds.includes(u.id);
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() =>
                              setSelectedPlayerIds((prev) =>
                                prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                              )
                            }
                            className="w-full flex items-center gap-2 px-3 py-2 text-left active:scale-[0.99] transition-transform"
                            style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                          >
                            <span style={{
                              width: "16px",
                              height: "16px",
                              borderRadius: "4px",
                              border: "1px solid rgba(255,255,255,0.3)",
                              backgroundColor: selected ? "#3B82F6" : "transparent",
                              display: "inline-block",
                            }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p className="text-white truncate" style={{ fontSize: "12px", fontWeight: "600" }}>
                                {u.name ?? `User ${u.id}`}
                              </p>
                              <p className="text-[#64748B] truncate" style={{ fontSize: "11px" }}>
                                {u.email ?? u.phone ?? `id:${u.id}`}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleBulkAssign}
                    disabled={addPlayer.isPending || selectedPlayerIds.length === 0}
                    className="w-full flex items-center justify-center gap-2 py-2.5 active:scale-[0.98] transition-transform"
                    style={{
                      borderRadius: "10px",
                      backgroundColor: "#2563EB",
                      fontSize: "12px",
                      fontWeight: "700",
                      color: "#fff",
                      opacity: addPlayer.isPending || selectedPlayerIds.length === 0 ? 0.6 : 1,
                    }}
                  >
                    <UserPlus style={{ width: "15px", height: "15px" }} />
                    {addPlayer.isPending ? "Assigning…" : `Assign selected (${selectedPlayerIds.length})`}
                  </button>

                  <div className="pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-[#94A3B8] mb-2" style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "0.04em" }}>
                      QUICK SINGLE ADD
                    </p>
                    <select
                      value={quickPickUserId ?? ""}
                      onChange={e => setQuickPickUserId(e.target.value ? parseInt(e.target.value, 10) : null)}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: "13px", outline: "none" }}
                    >
                      <option value="">Pick one searched user…</option>
                      {searchedUsers.map((u: any) => (
                        <option key={u.id} value={u.id}>{u.name ?? u.email ?? `User ${u.id}`}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <input
                      value={addPlayerJersey}
                      onChange={e => setAddPlayerJersey(e.target.value)}
                      placeholder="Jersey #"
                      type="number"
                      style={{ flex: 1, padding: "10px 12px", borderRadius: "10px", backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: "13px", outline: "none" }}
                    />
                    <button
                      type="button"
                      onClick={handleAddPlayer}
                      disabled={addPlayer.isPending}
                      className="px-4 py-2.5 active:scale-[0.98] transition-transform"
                      style={{ borderRadius: "10px", backgroundColor: "#3B82F6", fontSize: "12px", fontWeight: "700", color: "#fff", opacity: addPlayer.isPending ? 0.6 : 1 }}
                    >
                      {addPlayer.isPending ? "Adding…" : "Add One"}
                    </button>
                  </div>
                  <p className="text-[#64748B]" style={{ fontSize: "11px" }}>
                    Captains can submit usernames during registration. Unknown usernames are kept as placeholders.
                  </p>
                </div>
              </div>
            )}

            {/* ── Co-organizers panel (creator only) ── */}
            {isCreator && (
              <div style={{ borderRadius: "16px", backgroundColor: "#1E293B", overflow: "hidden" }}>
                {/* Header / toggle */}
                <button
                  onClick={() => setShowCoOrgPanel(v => !v)}
                  className="w-full flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: showCoOrgPanel ? "1px solid rgba(255,255,255,0.06)" : "none" }}
                >
                  <UserCog style={{ width: "15px", height: "15px", color: "#F59E0B", flexShrink: 0 }} />
                  <p className="flex-1 text-left" style={{ fontSize: "13px", fontWeight: "700", color: "#F59E0B" }}>
                    Co-organizers ({coOrgs.length})
                  </p>
                  <ChevronDown
                    style={{ width: "14px", height: "14px", color: "#64748B", transition: "transform 0.2s", transform: showCoOrgPanel ? "rotate(180deg)" : "rotate(0deg)" }}
                  />
                </button>

                {showCoOrgPanel && (
                  <div className="p-4 space-y-4">
                    {/* Current co-organizers list */}
                    {coOrgs.length === 0 ? (
                      <p className="text-[#475569] text-center" style={{ fontSize: "12px", paddingTop: "4px" }}>No co-organizers yet</p>
                    ) : (
                      <div className="space-y-2">
                        {coOrgs.map((c: any) => (
                          <div key={c.userId} className="flex items-center gap-3 p-2.5"
                            style={{ borderRadius: "10px", backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            {c.user?.avatar ? (
                              <img src={c.user.avatar} alt="" style={{ width: "30px", height: "30px", borderRadius: "50%", objectFit: "cover" }} />
                            ) : (
                              <div className="flex items-center justify-center" style={{ width: "30px", height: "30px", borderRadius: "50%", backgroundColor: "rgba(100,116,139,0.2)" }}>
                                <Users style={{ width: "14px", height: "14px", color: "#64748B" }} />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-white truncate" style={{ fontSize: "12px", fontWeight: "600" }}>
                                {c.user?.name ?? c.user?.email ?? `User ${c.userId}`}
                              </p>
                              <p className="text-[#64748B] truncate" style={{ fontSize: "10px" }}>{c.user?.email}</p>
                            </div>
                            {/* Role chip + toggle */}
                            <button
                              onClick={() => updateCoOrgRole.mutate({ userId: c.userId, role: c.role === "manager" ? "scorer" : "manager" })}
                              disabled={updateCoOrgRole.isPending}
                              className="px-2 py-1 active:scale-90 transition-transform flex-shrink-0"
                              style={{
                                borderRadius: "6px", fontSize: "10px", fontWeight: "700",
                                backgroundColor: c.role === "manager" ? "rgba(245,158,11,0.15)" : "rgba(59,130,246,0.15)",
                                color: c.role === "manager" ? "#F59E0B" : "#3B82F6",
                                border: `1px solid ${c.role === "manager" ? "rgba(245,158,11,0.3)" : "rgba(59,130,246,0.3)"}`,
                              }}
                            >
                              {c.role === "manager" ? "Manager" : "Scorer"}
                            </button>
                            {/* Remove */}
                            <button
                              onClick={() => removeCoOrg.mutate({ userId: c.userId })}
                              disabled={removeCoOrg.isPending}
                              className="active:scale-90 transition-transform flex-shrink-0"
                            >
                              <X style={{ width: "13px", height: "13px", color: "#475569" }} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add new co-organizer */}
                    <div>
                      <p className="text-[#64748B] mb-2" style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Add Co-organizer
                      </p>
                      <input
                        value={coOrgSearch}
                        onChange={e => setCoOrgSearch(e.target.value)}
                        placeholder="Search by name or email…"
                        style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: "13px", outline: "none", marginBottom: "8px" }}
                      />
                      {coOrgSearch.length >= 2 && coOrgSearchResults.length > 0 && (
                        <div className="space-y-1.5">
                          {coOrgSearchResults
                            .filter((u: any) => u.id !== currentUserId && !coOrgs.some((c: any) => c.userId === u.id))
                            .slice(0, 5)
                            .map((u: any) => (
                              <div key={u.id} className="flex items-center gap-2 p-2.5"
                                style={{ borderRadius: "10px", backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                <div className="flex-1 min-w-0">
                                  <p className="text-white truncate" style={{ fontSize: "12px", fontWeight: "600" }}>{u.name ?? u.email}</p>
                                  <p className="text-[#64748B] truncate" style={{ fontSize: "10px" }}>{u.email}</p>
                                </div>
                                <button
                                  onClick={() => addCoOrg.mutate({ userId: u.id, role: "manager" })}
                                  disabled={addCoOrg.isPending}
                                  className="px-2 py-1 active:scale-90 transition-transform flex-shrink-0"
                                  style={{ borderRadius: "6px", fontSize: "10px", fontWeight: "700", backgroundColor: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.3)" }}
                                >
                                  Manager
                                </button>
                                <button
                                  onClick={() => addCoOrg.mutate({ userId: u.id, role: "scorer" })}
                                  disabled={addCoOrg.isPending}
                                  className="px-2 py-1 active:scale-90 transition-transform flex-shrink-0"
                                  style={{ borderRadius: "6px", fontSize: "10px", fontWeight: "700", backgroundColor: "rgba(59,130,246,0.15)", color: "#3B82F6", border: "1px solid rgba(59,130,246,0.3)" }}
                                >
                                  Scorer
                                </button>
                              </div>
                            ))}
                        </div>
                      )}
                      {coOrgSearch.length >= 2 && coOrgSearchResults.filter((u: any) => u.id !== currentUserId && !coOrgs.some((c: any) => c.userId === u.id)).length === 0 && (
                        <p className="text-[#475569]" style={{ fontSize: "11px" }}>No users found</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════
            BRACKET TAB
        ═══════════════════════════════════════════════════════ */}
        {activeTab === "bracket" && (
          <>
            {isKnockoutStage ? (
              /* ── Knockout stage ── */
              stageFixAll.length === 0 ? (
                <div className="p-8 text-center" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
                  <p className="text-[#64748B]" style={{ fontSize: "13px" }}>Generate fixtures first to view the bracket.</p>
                </div>
              ) : (
                <BracketView
                  fixtures={stageFixAll}
                  maxRound={maxRound}
                  isTournamentActive={status === "in_progress"}
                  isStarting={startingFixtureId}
                  onScore={handleScoreFixture}
                />
              )
            ) : isMultiStage && hasNextStage ? (
              /* ── Round-robin group stage feeding into a knockout next stage ── */
              <TournamentPathwayView
                perGroupStandings={perGroupStandings}
                standings={allStandings}
                advanceCount={groupedStage?.advancePerGroup ?? stageConfig?.advancePerGroup ?? 2}
                nextFixtures={nextStageFixtures}
                nextStageName={stages[activeStageNum]?.name ?? `Stage ${activeStageNum + 1}`}
                isTournamentActive={status === "in_progress"}
                isStarting={startingFixtureId}
                onScore={handleScoreFixture}
              />
            ) : (
              /* ── Round-robin with no next stage: no bracket applies ── */
              <div className="p-8 text-center" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
                <Trophy style={{ width: "28px", height: "28px", color: "#334155", margin: "0 auto 8px" }} />
                <p className="text-[#475569]" style={{ fontSize: "13px", fontWeight: "600" }}>
                  Round-robin format — no elimination bracket
                </p>
                <p className="text-[#334155]" style={{ fontSize: "11px", marginTop: "3px" }}>
                  View match schedule and standings in the Fixtures and Standings tabs.
                </p>
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════
            STATS TAB — Sport-specific leaders
        ═══════════════════════════════════════════════════════ */}
        {activeTab === "stats" && (
          <>
            {topScorers.length === 0 ? (
              <div className="p-8 text-center" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
                <Activity style={{ width: "28px", height: "28px", color: "#334155", margin: "0 auto 8px" }} />
                <p className="text-[#475569]" style={{ fontSize: "13px", fontWeight: "600" }}>No player stats yet</p>
                <p className="text-[#334155]" style={{ fontSize: "11px", marginTop: "3px" }}>
                  Add players to team rosters from the Teams tab, then update their stats.
                </p>
              </div>
            ) : (
              <>
                <div style={{ borderRadius: "16px", backgroundColor: "#1E293B", overflow: "hidden" }}>
                  <div className="px-4 py-3 flex items-center gap-2"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", backgroundColor: "rgba(245,158,11,0.06)" }}>
                    <Trophy style={{ width: "14px", height: "14px", color: "#F59E0B" }} />
                    <p style={{ fontSize: "13px", fontWeight: "700", color: "#F59E0B" }}>{statSchema.sectionTitle}</p>
                  </div>
                  {/* Header row */}
                  <div className="flex items-center px-4 py-2"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                    <span style={{ width: "24px", fontSize: "10px", color: "#475569", fontWeight: "700" }}>#</span>
                    <span style={{ flex: 1, fontSize: "10px", color: "#475569", fontWeight: "700", textTransform: "uppercase" }}>Player</span>
                    {statSchema.fields.map((field) => (
                      <span key={field.key} style={{ width: "40px", fontSize: "10px", color: "#475569", fontWeight: "700", textAlign: "center" }}>
                        {field.shortLabel}
                      </span>
                    ))}
                  </div>
                  {topScorers.map((p: any, i: number) => (
                    <div key={i} className="flex items-center px-4 py-3"
                      style={{ borderBottom: i < topScorers.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                      <span className="text-[#64748B]" style={{ width: "24px", fontSize: "13px", fontWeight: "700" }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="text-white truncate" style={{ fontSize: "13px", fontWeight: "600" }}>{p.playerName}</p>
                        <p className="text-[#475569]" style={{ fontSize: "10px" }}>{p.teamName}</p>
                      </div>
                      {statSchema.fields.map((field, idxField) => {
                        const value = getPlayerStatValue(p, field.key);
                        if (isOrganizer) {
                          return (
                            <StatInput
                              key={field.key}
                              value={value}
                              onChange={(v) => (updateStats as any).mutate({
                                teamName: p.teamName,
                                playerName: p.playerName,
                                stats: { [field.key]: v },
                              })}
                            />
                          );
                        }
                        return (
                          <span
                            key={field.key}
                            style={{
                              width: "40px",
                              fontSize: idxField === 0 ? "15px" : "14px",
                              fontWeight: idxField === 0 ? "800" : "600",
                              color: idxField === 0 ? "#F59E0B" : "#94A3B8",
                              textAlign: "center",
                            }}
                          >
                            {value}
                          </span>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <p className="text-center text-[#475569]" style={{ fontSize: "10px", paddingTop: "4px" }}>
                  {statSchema.fields.map((field) => `${field.shortLabel} = ${field.fullLabel}`).join(" · ")}
                  {isOrganizer && " · Tap numbers to edit"}
                </p>
              </>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════
            UPDATES TAB — Announcements
        ═══════════════════════════════════════════════════════ */}
        {activeTab === "updates" && (
          <>
            {isManager && (
              <button
                onClick={() => setShowAnnModal(true)}
                className="w-full flex items-center justify-center gap-2 py-3 active:scale-[0.98] transition-transform"
                style={{ borderRadius: "12px", background: "linear-gradient(135deg,#3B82F6,#2563EB)", fontSize: "14px", fontWeight: "700", color: "#fff" }}
              >
                <Megaphone style={{ width: "16px", height: "16px" }} />
                Post Update
              </button>
            )}

            {announcements.length === 0 ? (
              <div className="p-8 text-center" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
                <Megaphone style={{ width: "28px", height: "28px", color: "#334155", margin: "0 auto 8px" }} />
                <p className="text-[#475569]" style={{ fontSize: "13px", fontWeight: "600" }}>No updates yet</p>
                {isManager && (
                  <p className="text-[#334155]" style={{ fontSize: "11px", marginTop: "3px" }}>Post an update to let participants know what's happening.</p>
                )}
              </div>
            ) : (
              announcements.map((ann: any) => (
                <div key={ann.id} className="p-4" style={{ borderRadius: "14px", backgroundColor: "#1E293B" }}>
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-white" style={{ fontSize: "14px", fontWeight: "700", flex: 1, paddingRight: "8px" }}>{ann.title}</p>
                    {isManager && (
                      <button
                        onClick={() => deleteAnnouncement.mutate(ann.id)}
                        className="active:scale-90 transition-transform flex-shrink-0"
                      >
                        <Trash2 style={{ width: "14px", height: "14px", color: "#475569" }} />
                      </button>
                    )}
                  </div>
                  <p className="text-[#94A3B8]" style={{ fontSize: "13px", lineHeight: "1.5" }}>{ann.body}</p>
                  <p className="text-[#475569] mt-2" style={{ fontSize: "10px" }}>
                    {format(new Date(ann.createdAt), "dd MMM yyyy · HH:mm")}
                  </p>
                </div>
              ))
            )}
          </>
        )}

      </div>

      {/* ── Announcement Modal ── */}
      {showAnnModal && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAnnModal(false); }}
        >
          <div className="w-full max-w-md mx-auto p-5 pb-24" style={{ borderRadius: "20px 20px 0 0", backgroundColor: "#1E293B", maxHeight: "90dvh", overflowY: "auto" }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Post Update</p>
              <button onClick={() => setShowAnnModal(false)} className="active:scale-90 transition-transform">
                <X style={{ width: "20px", height: "20px", color: "#64748B" }} />
              </button>
            </div>
            <div className="space-y-3">
              <input
                value={annTitle}
                onChange={e => setAnnTitle(e.target.value)}
                placeholder="Title"
                style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" }}
              />
              <textarea
                value={annBody}
                onChange={e => setAnnBody(e.target.value)}
                placeholder="Write your update…"
                rows={4}
                style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: "14px", outline: "none", resize: "none", boxSizing: "border-box" }}
              />
              <button
                onClick={handlePostAnnouncement}
                disabled={postAnnouncement.isPending || !annTitle.trim() || !annBody.trim()}
                className="w-full py-3 active:scale-[0.98] transition-transform"
                style={{
                  borderRadius: "10px", fontSize: "14px", fontWeight: "700", color: "#fff",
                  background: "linear-gradient(135deg,#3B82F6,#2563EB)",
                  opacity: (!annTitle.trim() || !annBody.trim() || postAnnouncement.isPending) ? 0.5 : 1,
                }}
              >
                {postAnnouncement.isPending ? "Posting…" : "Post Update"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sponsor Add Modal ── */}
      {showSponsorModal && (
        <SponsorModal
          tournamentId={tournamentId}
          currentSponsors={sponsors}
          sponsorName={sponsorName}
          setSponsorName={setSponsorName}
          sponsorLogo={sponsorLogo}
          setSponsorLogo={setSponsorLogo}
          sponsorTier={sponsorTier}
          setSponsorTier={setSponsorTier}
          onClose={() => setShowSponsorModal(false)}
        />
      )}

      {/* ── Correct Score modal ──────────────────────────────────── */}
      {editScoreFixture && (
        <CorrectScoreModal
          fixture={editScoreFixture}
          t1Name={editScoreFixture.team1Ref?.name ?? "Team A"}
          t2Name={editScoreFixture.team2Ref?.name ?? "Team B"}
          updateMatchScore={updateMatchScore}
          tournamentId={tournamentId}
          onClose={() => setEditScoreFixture(null)}
        />
      )}
    </div>
  );
}

// ── StatInput — inline editable number for organizer ─────────────────────────

function StatInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      min={0}
      defaultValue={value}
      key={value}
      onBlur={e => {
        const v = parseInt(e.target.value);
        if (!isNaN(v) && v !== value) onChange(v);
      }}
      style={{
        width: "40px", textAlign: "center", fontSize: "14px", fontWeight: "700", color: "#F59E0B",
        backgroundColor: "transparent", border: "none", outline: "none",
        borderBottom: "1px solid rgba(245,158,11,0.3)", padding: "2px 0",
      }}
    />
  );
}

// ── TeamCard ──────────────────────────────────────────────────────────────────

function TeamCard({ team, players, statSchema, isOrganizer, onRemovePlayer, onDelete }: {
  team: any;
  players: any[];
  statSchema: { fields: Array<{ key: string; shortLabel: string }> };
  isOrganizer: boolean;
  onRemovePlayer: (name: string) => void;
  onDelete?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ borderRadius: "12px", backgroundColor: "#1E293B", overflow: "hidden", marginBottom: "8px" }}>
      <div className="flex items-center">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex-1 flex items-center gap-3 p-3 text-left active:scale-[0.99] transition-transform min-w-0"
        >
          <div className="flex items-center justify-center flex-shrink-0"
            style={{ width: "36px", height: "36px", borderRadius: "50%", background: "linear-gradient(135deg,#1D4ED8,#3B82F6)", fontSize: "15px", fontWeight: "700", color: "#fff" }}>
            {(team.name ?? "T")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white truncate" style={{ fontSize: "14px", fontWeight: "600" }}>{team.name}</p>
            {team.captain && <p className="text-[#64748B]" style={{ fontSize: "11px" }}>Captain: {team.captain}</p>}
            {players.length > 0 && (
              <p className="text-[#475569]" style={{ fontSize: "10px" }}>{players.length} player{players.length !== 1 ? "s" : ""}</p>
            )}
          </div>
          <ChevronRight
            style={{ width: "16px", height: "16px", color: "#334155", transition: "transform 0.2s", transform: expanded ? "rotate(90deg)" : "none" }}
          />
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            className="active:scale-90 transition-transform flex-shrink-0 mr-3"
            style={{
              width: "30px", height: "30px", borderRadius: "7px",
              backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Trash2 style={{ width: "13px", height: "13px", color: "#EF4444" }} />
          </button>
        )}
      </div>

      {expanded && players.length > 0 && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          {players.map((p: any, i: number) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5"
              style={{ borderBottom: i < players.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              {p.jerseyNo != null && (
                <span style={{ width: "24px", fontSize: "11px", color: "#475569", fontWeight: "700", textAlign: "center" }}>
                  {p.jerseyNo}
                </span>
              )}
              <span className="flex-1 text-[#94A3B8]" style={{ fontSize: "13px" }}>{p.playerName}</span>
              {p.isPlaceholder && (
                <span style={{ fontSize: "10px", color: "#F59E0B", fontWeight: "700" }}>placeholder</span>
              )}
              <div className="flex items-center gap-3">
                {statSchema.fields.slice(0, 2).map((field, idx) => (
                  <span
                    key={field.key}
                    style={{ fontSize: "12px", color: idx === 0 ? "#F59E0B" : "#64748B", fontWeight: idx === 0 ? "700" : "600" }}
                  >
                    {getPlayerStatValue(p, field.key)}
                    {field.shortLabel}
                  </span>
                ))}
              </div>
              {isOrganizer && (
                <button onClick={() => onRemovePlayer(p.playerName)} className="active:scale-90 transition-transform ml-1">
                  <X style={{ width: "13px", height: "13px", color: "#475569" }} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {expanded && players.length === 0 && (
        <div className="px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="text-[#475569]" style={{ fontSize: "12px" }}>No players added yet.</p>
        </div>
      )}
    </div>
  );
}

// ── SponsorModal ──────────────────────────────────────────────────────────────

function SponsorModal({
  tournamentId, currentSponsors,
  sponsorName, setSponsorName,
  sponsorLogo, setSponsorLogo,
  sponsorTier, setSponsorTier,
  onClose,
}: {
  tournamentId: number;
  currentSponsors: any[];
  sponsorName: string; setSponsorName: (v: string) => void;
  sponsorLogo: string; setSponsorLogo: (v: string) => void;
  sponsorTier: string; setSponsorTier: (v: string) => void;
  onClose: () => void;
}) {
  const updateSponsors = useUpdateTournamentSponsors(tournamentId);

  function handleAdd() {
    if (!sponsorName.trim()) return;
    const newSponsor = { name: sponsorName.trim(), logoUrl: sponsorLogo.trim() || undefined, tier: sponsorTier || undefined };
    updateSponsors.mutate([...currentSponsors, newSponsor], {
      onSuccess: () => { setSponsorName(""); setSponsorLogo(""); onClose(); },
    });
  }

  function handleRemove(idx: number) {
    const updated = currentSponsors.filter((_: any, i: number) => i !== idx);
    updateSponsors.mutate(updated);
  }

  const inputSt: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: "10px",
    backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.08)",
    color: "#fff", fontSize: "13px", outline: "none", boxSizing: "border-box",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md mx-auto p-5 pb-24" style={{ borderRadius: "20px 20px 0 0", backgroundColor: "#1E293B", maxHeight: "90dvh", overflowY: "auto" }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Manage Sponsors</p>
          <button onClick={onClose} className="active:scale-90 transition-transform">
            <X style={{ width: "20px", height: "20px", color: "#64748B" }} />
          </button>
        </div>

        {/* Existing sponsors */}
        {currentSponsors.length > 0 && (
          <div className="mb-4 space-y-2">
            {currentSponsors.map((sp: any, i: number) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2"
                style={{ borderRadius: "10px", backgroundColor: "#0F172A" }}>
                <span className="flex-1 text-white" style={{ fontSize: "13px" }}>{sp.name}</span>
                {sp.tier && <span style={{ fontSize: "10px", color: "#64748B" }}>{sp.tier}</span>}
                <button onClick={() => handleRemove(i)} className="active:scale-90 transition-transform">
                  <Trash2 style={{ width: "14px", height: "14px", color: "#EF4444" }} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add new sponsor */}
        <div className="space-y-2.5">
          <input value={sponsorName} onChange={e => setSponsorName(e.target.value)} placeholder="Sponsor name *" style={inputSt} />
          <input value={sponsorLogo} onChange={e => setSponsorLogo(e.target.value)} placeholder="Logo URL (optional)" style={inputSt} />
          <select value={sponsorTier} onChange={e => setSponsorTier(e.target.value)} style={{ ...inputSt, appearance: "none" }}>
            <option value="main">Main Sponsor</option>
            <option value="co">Co-Sponsor</option>
            <option value="associate">Associate</option>
          </select>
          <button
            onClick={handleAdd}
            disabled={updateSponsors.isPending || !sponsorName.trim()}
            className="w-full py-3 active:scale-[0.98] transition-transform"
            style={{
              borderRadius: "10px", fontSize: "13px", fontWeight: "700", color: "#fff",
              background: "linear-gradient(135deg,#F59E0B,#D97706)",
              opacity: (!sponsorName.trim() || updateSponsors.isPending) ? 0.5 : 1,
            }}
          >
            {updateSponsors.isPending ? "Saving…" : "Add Sponsor"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── TournamentPathwayView ─────────────────────────────────────────────────────
// Shown in the Bracket tab when the active stage is round-robin and feeds
// into a subsequent knockout stage.
//
// When perGroupStandings has ≥ 2 keys (multi-group) each group is rendered as
// a separate column:  [Group A] [Group B]  ── Top N per group ──>  [Knockout]
// When perGroupStandings is null/single-group the original single column is shown.

/** Reusable pill used above each group column */
function GroupPill({ letter, color = "#64748B" }: { letter?: string; color?: string }) {
  return (
    <div style={{ height: "36px", display: "flex", alignItems: "center", justifyContent: "center", paddingBottom: "6px" }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: "5px",
        padding: "4px 12px", borderRadius: "20px",
        backgroundColor: color === "#64748B" ? "rgba(255,255,255,0.05)" : `rgba(168,85,247,0.1)`,
        border: `1px solid ${color === "#64748B" ? "rgba(255,255,255,0.08)" : "rgba(168,85,247,0.28)"}`,
      }}>
        <Users style={{ width: "10px", height: "10px", color }} />
        <span style={{ fontSize: "10px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.07em", color }}>
          {letter ? `Group ${letter}` : "Group Stage"}
        </span>
      </div>
    </div>
  );
}

/** Reusable team-row list inside a group column */
function GroupTeamList({ standings, advanceCount }: { standings: any[]; advanceCount: number }) {
  return (
    <div style={{ borderRadius: "14px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
      {standings.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <span style={{ fontSize: "12px", color: "#334155" }}>No standings yet</span>
        </div>
      ) : (
        standings.map((s: any, i: number) => {
          const isAdvancing = i < advanceCount;
          const showDivider = i === advanceCount - 1 && i < standings.length - 1;
          return (
            <div key={s.team ?? i}>
              <div className="flex items-center px-3 gap-2" style={{
                height: "44px",
                borderLeft: isAdvancing ? "3px solid #F59E0B" : "3px solid transparent",
                backgroundColor: isAdvancing ? "rgba(245,158,11,0.05)" : "transparent",
                borderBottom: showDivider ? "none" : "1px solid rgba(255,255,255,0.04)",
              }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: isAdvancing ? "#F59E0B" : "#475569", minWidth: "18px" }}>
                  {i + 1}
                </span>
                <span className="flex-1 truncate" style={{ fontSize: "13px", fontWeight: isAdvancing ? "700" : "500", color: isAdvancing ? "#E2E8F0" : "#64748B" }}>
                  {s.team}
                </span>
                {isAdvancing && (
                  <span style={{ fontSize: "9px", fontWeight: "700", color: "#F59E0B", backgroundColor: "rgba(245,158,11,0.12)", borderRadius: "4px", padding: "1px 5px", whiteSpace: "nowrap" }}>
                    ADV
                  </span>
                )}
              </div>
              {showDivider && (
                <div style={{ height: "1px", margin: "0 12px", backgroundColor: "rgba(245,158,11,0.2)" }} />
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function TournamentPathwayView({
  perGroupStandings, standings, advanceCount, nextFixtures, nextStageName,
  isTournamentActive, isStarting, onScore,
}: {
  perGroupStandings: Record<number, any[]> | null;
  standings: any[];
  advanceCount: number;
  nextFixtures: any[];
  nextStageName: string;
  isTournamentActive: boolean;
  isStarting: number | null;
  onScore: (f: any) => void;
}) {
  const maxNextRound   = nextFixtures.reduce((m: number, f: any) => Math.max(m, f.round ?? 1), 1);
  const scorable       = nextFixtures.filter((f: any) => f.status !== "bye");
  const groupEntries   = perGroupStandings
    ? Object.entries(perGroupStandings).sort(([a], [b]) => parseInt(a) - parseInt(b))
    : null;
  const isMultiGroup   = groupEntries && groupEntries.length >= 2;

  // Total advancing teams = advanceCount per group × number of groups
  const totalAdvancing = isMultiGroup ? advanceCount * groupEntries!.length : advanceCount;

  // Right column: actual next-stage content or TBD placeholders
  const rightContent = scorable.length === 1 ? (
    <GrandFinalCard
      fixture={scorable[0]}
      isTournamentActive={isTournamentActive}
      isStarting={isStarting === scorable[0].id}
      onScore={() => onScore(scorable[0])}
    />
  ) : scorable.length > 1 ? (
    <BracketView
      fixtures={nextFixtures}
      maxRound={maxNextRound}
      isTournamentActive={isTournamentActive}
      isStarting={isStarting}
      onScore={onScore}
    />
  ) : (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: "180px" }}>
      {Array.from({ length: totalAdvancing }, (_, i) => (
        <div key={i} className="flex items-center px-4 gap-2" style={{
          height: "48px", borderRadius: "12px",
          backgroundColor: "#1E293B",
          border: "1px dashed rgba(255,255,255,0.08)",
        }}>
          <span style={{ fontSize: "10px", fontWeight: "700", color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Seed {i + 1}
          </span>
          <span style={{ fontSize: "12px", fontWeight: "600", color: "#334155", marginLeft: "4px" }}>TBD</span>
        </div>
      ))}
      <p style={{ fontSize: "10px", color: "#334155", textAlign: "center", marginTop: "2px" }}>
        Advances after group stage
      </p>
    </div>
  );

  return (
    <div style={{ overflowX: "auto", paddingBottom: "4px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0", minWidth: "min-content" }}>

        {/* ── Left: Group columns ── */}
        {isMultiGroup ? (
          // Multi-group: one card per group side-by-side
          <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
            {groupEntries!.map(([gKey, rows]) => {
              const gIdx   = parseInt(gKey);
              const letter = GROUP_LETTERS[gIdx] ?? String(gIdx + 1);
              return (
                <div key={gKey} style={{ minWidth: "180px", maxWidth: "220px" }}>
                  <GroupPill letter={letter} color="#A855F7" />
                  <GroupTeamList standings={rows} advanceCount={advanceCount} />
                </div>
              );
            })}
          </div>
        ) : (
          // Single-group fallback
          <div style={{ minWidth: "200px", maxWidth: "240px", flexShrink: 0 }}>
            <GroupPill />
            <GroupTeamList standings={standings} advanceCount={advanceCount} />
          </div>
        )}

        {/* ── Centre: advance arrow ── */}
        <div className="flex flex-col items-center justify-center gap-1 flex-shrink-0" style={{ width: "72px", paddingTop: "36px", alignSelf: "stretch" }}>
          <span style={{ fontSize: "10px", fontWeight: "800", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>
            {isMultiGroup ? `Top ${advanceCount} / group` : `Top ${advanceCount}`}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
            <div style={{ width: "24px", height: "1.5px", backgroundColor: "rgba(245,158,11,0.5)" }} />
            <ChevronRight style={{ width: "16px", height: "16px", color: "#F59E0B" }} />
          </div>
          <span style={{ fontSize: "9px", color: "#334155", textAlign: "center" }}>advance</span>
        </div>

        {/* ── Right: next stage ── */}
        <div style={{ flexShrink: 0, minWidth: "200px" }}>
          <div style={{ height: "36px", display: "flex", alignItems: "center", justifyContent: "center", paddingBottom: "6px" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              padding: "4px 12px", borderRadius: "20px",
              backgroundColor: "rgba(245,158,11,0.1)",
              border: "1px solid rgba(245,158,11,0.28)",
            }}>
              <Trophy style={{ width: "10px", height: "10px", color: "#F59E0B" }} />
              <span style={{ fontSize: "10px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.07em", color: "#F59E0B" }}>
                {nextStageName}
              </span>
            </div>
          </div>
          {rightContent}
        </div>

      </div>
    </div>
  );
}

// ── GrandFinalCard — shown when bracket has exactly one match ─────────────────

function GrandFinalCard({ fixture, isTournamentActive, isStarting, onScore }: {
  fixture: any;
  isTournamentActive: boolean;
  isStarting: boolean;
  onScore: () => void;
}) {
  const t1Name = fixture.team1Ref?.name ?? "Team A";
  const t2Name = fixture.team2Ref?.name ?? "Team B";
  const matchStatus: string = fixture.match?.status ?? fixture.status ?? "scheduled";
  const isLive  = matchStatus === "live" || matchStatus === "in_progress";
  const isDone  = matchStatus === "completed";
  const score   = flatScore(fixture.match?.scores);
  const gameStr = gameScores(fixture.match?.scores);
  const scoreA  = score?.a ?? null;
  const scoreB  = score?.b ?? null;
  const { t1Wins, t2Wins } = deriveWinner(fixture.match?.winnerTeam, scoreA, scoreB, isDone);
  const canScore = isTournamentActive && !isDone && !isLive && !fixture.matchId;
  // Re-open LiveMatch for scheduled matches that already have a matchId (e.g. left mid court-setup).
  const canReopen = !!fixture.matchId && !isDone;

  const card = (
    <div style={{
      borderRadius: "18px",
      border: `1px solid ${isDone ? "rgba(245,158,11,0.4)" : isLive ? "rgba(34,197,94,0.35)" : "rgba(255,255,255,0.1)"}`,
      backgroundColor: "#1E293B",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div className="flex items-center justify-center gap-2 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", backgroundColor: "rgba(245,158,11,0.05)" }}>
        <Trophy style={{ width: "14px", height: "14px", color: "#F59E0B" }} />
        <span style={{ fontSize: "11px", fontWeight: "800", color: "#F59E0B", textTransform: "uppercase", letterSpacing: "0.08em" }}>Grand Final</span>
        {isLive && (
          <span className="flex items-center gap-1" style={{ fontSize: "9px", color: "#22C55E", fontWeight: "800" }}>
            <Radio style={{ width: "8px", height: "8px" }} className="animate-pulse" /> LIVE
          </span>
        )}
      </div>

      {/* Teams + score */}
      <div className="flex items-stretch" style={{ minHeight: "110px" }}>
        {/* Team 1 */}
        <div className="flex-1 flex flex-col items-center justify-center gap-1 py-5 px-3"
          style={{ backgroundColor: t1Wins ? "rgba(245,158,11,0.08)" : "transparent", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
          {t1Wins && <Trophy style={{ width: "18px", height: "18px", color: "#F59E0B" }} />}
          <span style={{ fontSize: "15px", fontWeight: "800", color: t1Wins ? "#F59E0B" : "#E2E8F0", textAlign: "center", lineHeight: "1.2" }}>{t1Name}</span>
          {isDone && !t1Wins && <span style={{ fontSize: "9px", color: "#64748B", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>Runner-up</span>}
          {t1Wins && <span style={{ fontSize: "9px", color: "#F59E0B", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.06em" }}>Champion</span>}
        </div>

        {/* Score / VS */}
        <div className="flex flex-col items-center justify-center px-4 gap-1" style={{ minWidth: "80px" }}>
          {gameStr ? (
            <>
              {gameStr.split("  ·  ").map((g, i) => (
                <span key={i} style={{ fontSize: "15px", fontWeight: "900", color: "#E2E8F0", lineHeight: "1.3", letterSpacing: "0.5px" }}>{g}</span>
              ))}
              {isDone && <span style={{ fontSize: "9px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "2px" }}>Final</span>}
            </>
          ) : score ? (
            <>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: "28px", fontWeight: "900", color: t1Wins ? "#F59E0B" : "#94A3B8", lineHeight: "1" }}>{scoreA}</span>
                <span style={{ fontSize: "14px", color: "#334155", fontWeight: "700" }}>:</span>
                <span style={{ fontSize: "28px", fontWeight: "900", color: t2Wins ? "#F59E0B" : "#94A3B8", lineHeight: "1" }}>{scoreB}</span>
              </div>
              {isDone && <span style={{ fontSize: "9px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>Final</span>}
            </>
          ) : isDone ? (
            <span style={{ fontSize: "9px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>Final</span>
          ) : (
            <span style={{ fontSize: "18px", fontWeight: "900", color: "#334155" }}>VS</span>
          )}
        </div>

        {/* Team 2 */}
        <div className="flex-1 flex flex-col items-center justify-center gap-1 py-5 px-3"
          style={{ backgroundColor: t2Wins ? "rgba(245,158,11,0.08)" : "transparent", borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
          {t2Wins && <Trophy style={{ width: "18px", height: "18px", color: "#F59E0B" }} />}
          <span style={{ fontSize: "15px", fontWeight: "800", color: t2Wins ? "#F59E0B" : "#E2E8F0", textAlign: "center", lineHeight: "1.2" }}>{t2Name}</span>
          {isDone && !t2Wins && <span style={{ fontSize: "9px", color: "#64748B", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>Runner-up</span>}
          {t2Wins && <span style={{ fontSize: "9px", color: "#F59E0B", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.06em" }}>Champion</span>}
        </div>
      </div>

      {/* Footer: start / continue setup / live indicator */}
      {(canScore || isStarting) && (
        <div className="flex items-center justify-center gap-1 py-2"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)", backgroundColor: "rgba(245,158,11,0.07)" }}>
          {isStarting
            ? <Loader2 style={{ width: "12px", height: "12px", color: "#F59E0B" }} className="animate-spin" />
            : <>
                <Activity style={{ width: "10px", height: "10px", color: "#F59E0B" }} />
                <span style={{ fontSize: "10px", fontWeight: "700", color: "#F59E0B" }}>Tap to start match</span>
              </>
          }
        </div>
      )}
      {canReopen && !isLive && !isDone && !isStarting && (
        <div className="flex items-center justify-center gap-1 py-2"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)", backgroundColor: "rgba(59,130,246,0.08)" }}>
          <Activity style={{ width: "10px", height: "10px", color: "#93C5FD" }} />
          <span style={{ fontSize: "10px", fontWeight: "700", color: "#93C5FD" }}>Tap to continue setup</span>
        </div>
      )}
    </div>
  );

  if (canScore || canReopen || (fixture.matchId && (isLive || isDone))) {
    return (
      <button onClick={onScore} disabled={isStarting} className="w-full active:scale-[0.98] transition-transform" style={{ textAlign: "left" }}>
        {card}
      </button>
    );
  }
  return card;
}

// ── BracketView ───────────────────────────────────────────────────────────────

function BracketView({ fixtures, maxRound, isTournamentActive, isStarting, onScore }: {
  fixtures: any[];
  maxRound: number;
  isTournamentActive: boolean;
  isStarting: number | null;
  onScore: (f: any) => void;
}) {
  const byRound: Record<number, any[]> = {};
  for (const f of fixtures) {
    const r = f.round ?? 1;
    (byRound[r] ??= []).push(f);
  }
  const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);
  if (rounds.length === 0) return null;

  // Single-match bracket (e.g. a standalone Final): use the prominent Grand Final card
  const allFixtures = Object.values(byRound).flat();
  const scorable    = allFixtures.filter(f => f.status !== "bye");
  if (scorable.length === 1) {
    const f = scorable[0];
    return (
      <GrandFinalCard
        fixture={f}
        isTournamentActive={isTournamentActive}
        isStarting={isStarting === f.id}
        onScore={() => onScore(f)}
      />
    );
  }

  const BASE   = 100;  // slot height for round 1
  const CARD_W = 180;  // match card width
  const CON_W  = 40;   // horizontal arm of the L-connector
  const HEADER = 36;   // round pill header height

  return (
    <div style={{ overflowX: "auto", overflowY: "visible", paddingBottom: "8px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 0, paddingLeft: "2px", paddingRight: "8px" }}>
        {rounds.map((r, ri) => {
          const slotH   = BASE * Math.pow(2, ri);
          const rFix    = byRound[r];
          const isLast  = ri === rounds.length - 1;
          const isFinalRound = r === maxRound;

          // A pair of fixtures is "lit" (green connectors) when both are done
          const pairCount = Math.ceil(rFix.length / 2);

          return (
            <div key={r} style={{ display: "flex", flexShrink: 0 }}>

              {/* ── Round column ────────────────────────────────── */}
              <div style={{ width: CARD_W }}>

                {/* Round header pill */}
                <div style={{ height: HEADER, display: "flex", alignItems: "center", justifyContent: "center", paddingBottom: "6px" }}>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: "5px",
                    padding: "4px 12px", borderRadius: "20px",
                    backgroundColor: isFinalRound ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${isFinalRound ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.08)"}`,
                  }}>
                    {isFinalRound && <Trophy style={{ width: "10px", height: "10px", color: "#F59E0B" }} />}
                    <span style={{
                      fontSize: "10px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.07em",
                      color: isFinalRound ? "#F59E0B" : "#64748B",
                    }}>
                      {isFinalRound ? "Final" : knockoutRoundLabel(r, rFix.length, maxRound)}
                    </span>
                  </div>
                </div>

                {/* Fixture slots */}
                {rFix.map((f: any, fi: number) => {
                  const pairIdx  = Math.floor(fi / 2);
                  const pairTop  = byRound[r][pairIdx * 2];
                  const pairBot  = byRound[r][pairIdx * 2 + 1];
                  const topDone  = (pairTop?.match?.status ?? pairTop?.status) === "completed";
                  const botDone  = (pairBot?.match?.status ?? pairBot?.status) === "completed";
                  const pairLit  = topDone && botDone;
                  const conColor = pairLit ? "rgba(34,197,94,0.45)" : "rgba(71,85,105,0.45)";

                  return (
                    <div key={f.id ?? fi} style={{
                      height: slotH,
                      display: "flex",
                      alignItems: "center",
                      position: "relative",
                    }}>
                      {/* ── Left arm: horizontal line from previous round's vertical arm ── */}
                      {ri > 0 && (
                        <div style={{
                          position: "absolute",
                          left: -CON_W, top: "50%",
                          width: CON_W, height: "1.5px",
                          backgroundColor: conColor,
                        }} />
                      )}

                      {/* ── Right arm: horizontal stub + vertical bracket arm ── */}
                      {!isLast && (() => {
                        const isTopOfPair = fi % 2 === 0;
                        // vertical arm runs from midpoint of top slot to midpoint of bottom slot
                        const vertH = slotH; // full slot height
                        return (
                          <>
                            {/* horizontal stub right of card */}
                            <div style={{
                              position: "absolute",
                              right: -CON_W, top: "50%",
                              width: CON_W / 2, height: "1.5px",
                              backgroundColor: conColor,
                            }} />
                            {/* vertical bracket arm (only drawn for top of pair) */}
                            {isTopOfPair && (
                              <div style={{
                                position: "absolute",
                                right: -(CON_W / 2),
                                top: "50%",
                                width: "1.5px",
                                height: vertH,
                                backgroundColor: conColor,
                              }} />
                            )}
                            {/* horizontal arm from vertical to next column (only for bottom of pair) */}
                            {!isTopOfPair && (
                              <div style={{
                                position: "absolute",
                                right: -CON_W, top: "50%",
                                width: CON_W / 2, height: "1.5px",
                                backgroundColor: conColor,
                                // This stub already rendered above; the join horizontal comes from CON_W/2 → CON_W
                              }} />
                            )}
                          </>
                        );
                      })()}

                      {/* Match card */}
                      <BracketMatchCard
                        fixture={f}
                        isTournamentActive={isTournamentActive}
                        isStarting={isStarting === f.id}
                        onScore={() => onScore(f)}
                        isFinal={isFinalRound}
                      />
                    </div>
                  );
                })}

                {/* Invisible spacer to account for unused pair slots */}
                {pairCount > 0 && <div style={{ height: 0 }} />}
              </div>

              {/* ── Connector gap column (holds the right half of the L) ── */}
              {!isLast && (
                <div style={{ width: CON_W, flexShrink: 0, position: "relative" }}>
                  {/* For each pair, draw the final horizontal arm from the mid-vertical to the next column */}
                  {Array.from({ length: pairCount }, (_, pi) => {
                    const topFix = rFix[pi * 2];
                    const botFix = rFix[pi * 2 + 1];
                    const topDone = (topFix?.match?.status ?? topFix?.status) === "completed";
                    const botDone = (botFix?.match?.status ?? botFix?.status) === "completed";
                    const lit = topDone && botDone;
                    const col = lit ? "rgba(34,197,94,0.45)" : "rgba(71,85,105,0.45)";
                    // vertical centre of the pair (from top of pair to midpoint between the two slots)
                    const pairTopY = HEADER + pi * slotH * 2 + slotH; // y-mid of top slot of pair
                    const midY = pairTopY + slotH / 2;                 // y-mid between the two slots
                    return (
                      <div key={pi} style={{
                        position: "absolute",
                        left: CON_W / 2, top: midY,
                        width: CON_W / 2, height: "1.5px",
                        backgroundColor: col,
                      }} />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── BracketMatchCard ──────────────────────────────────────────────────────────

function BracketMatchCard({ fixture, isTournamentActive, isStarting, onScore, isFinal }: {
  fixture: any;
  isTournamentActive: boolean;
  isStarting: boolean;
  onScore: () => void;
  isFinal?: boolean;
}) {
  const isByeCard = fixture.status === "bye" || fixture.team2Ref?.bye || fixture.team1Ref?.bye;
  const isTeamTBD = isTBD(fixture.team1Ref) || isTBD(fixture.team2Ref);

  // For a bye, show the advancing team prominently
  if (isByeCard) {
    const advancingName = fixture.team1Ref?.bye
      ? (fixture.team2Ref?.name ?? "TBD")
      : (fixture.team1Ref?.name ?? "TBD");
    return (
      <div style={{
        width: "100%", borderRadius: "12px", backgroundColor: "#1E293B",
        border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden", opacity: 0.55,
      }}>
        <div className="flex items-center px-3 gap-2" style={{ height: "42px" }}>
          <span style={{ fontSize: "12px", fontWeight: "600", color: "#64748B", flex: 1 }}>{advancingName}</span>
          <span style={{ fontSize: "9px", fontWeight: "700", color: "#475569", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: "4px", padding: "2px 5px" }}>BYE</span>
        </div>
      </div>
    );
  }

  const t1Name = fixture.team1Ref?.name ?? (isTeamTBD ? "TBD" : "Team A");
  const t2Name = fixture.team2Ref?.name ?? (isTeamTBD ? "TBD" : "Team B");

  const matchStatus: string = fixture.match?.status ?? fixture.status ?? "scheduled";
  const isLive  = matchStatus === "live" || matchStatus === "in_progress";
  const isDone  = matchStatus === "completed";
  const score   = flatScore(fixture.match?.scores);
  const gameStr = gameScores(fixture.match?.scores);

  const canScore    = isTournamentActive && !isTeamTBD && !isDone && !isLive;
  const canInteract = canScore || (fixture.matchId && (isLive || isDone));

  const scoreA = score?.a ?? null;
  const scoreB = score?.b ?? null;
  const { t1Wins, t2Wins } = deriveWinner(fixture.match?.winnerTeam, scoreA, scoreB, isDone);

  // Status pill
  const pill = isStarting
    ? <span className="flex items-center gap-1" style={{ fontSize: "9px", fontWeight: "800", color: "#F59E0B", backgroundColor: "rgba(245,158,11,0.12)", borderRadius: "6px", padding: "2px 6px" }}>
        <Loader2 style={{ width: "8px", height: "8px" }} className="animate-spin" />
      </span>
    : isLive
      ? <span className="flex items-center gap-1" style={{ fontSize: "9px", fontWeight: "800", color: "#22C55E", backgroundColor: "rgba(34,197,94,0.12)", borderRadius: "6px", padding: "2px 6px" }}>
          <Radio style={{ width: "7px", height: "7px" }} className="animate-pulse" /> LIVE
        </span>
      : isDone
        ? <span style={{ fontSize: "9px", fontWeight: "700", color: "#64748B", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: "6px", padding: "2px 6px" }}>DONE</span>
        : canScore
          ? <span className="flex items-center gap-1" style={{ fontSize: "9px", fontWeight: "700", color: "#F59E0B", backgroundColor: "rgba(245,158,11,0.1)", borderRadius: "6px", padding: "2px 6px" }}>
              <Activity style={{ width: "7px", height: "7px" }} /> START
            </span>
          : null;

  const borderColor = isFinal
    ? "rgba(245,158,11,0.45)"
    : isLive
      ? "rgba(34,197,94,0.35)"
      : isDone
        ? "rgba(59,130,246,0.25)"
        : "rgba(255,255,255,0.07)";

  const cardBg = isFinal
    ? "linear-gradient(135deg,#1E293B 80%,rgba(245,158,11,0.04) 100%)"
    : "#1E293B";

  const cardContent = (
    <div style={{
      width: "100%", borderRadius: "12px",
      background: cardBg,
      border: `1px solid ${borderColor}`,
      overflow: "hidden",
      boxShadow: isFinal ? "0 0 18px rgba(245,158,11,0.08)" : isLive ? "0 0 12px rgba(34,197,94,0.08)" : "none",
    }}>
      {/* Pill row */}
      {pill && (
        <div className="flex justify-end px-2 pt-1.5">
          {pill}
        </div>
      )}

      {/* Team 1 row */}
      <div className="flex items-center px-3 gap-2" style={{
        height: "42px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        borderLeft: t1Wins ? "3px solid #22C55E" : "3px solid transparent",
        backgroundColor: t1Wins ? "rgba(34,197,94,0.08)" : "transparent",
      }}>
        <span className="flex-1 truncate" style={{
          fontSize: "12px",
          fontWeight: t1Wins ? "700" : "500",
          color: t1Wins ? "#E2E8F0" : isTeamTBD ? "#334155" : t2Wins ? "#475569" : "#CBD5E1",
        }}>{t1Name}</span>
        {/* Per-game scores in team 1 row when only 1 game */}
        {!gameStr && score && (
          <span style={{
            fontSize: "18px", fontWeight: "900", minWidth: "22px", textAlign: "right", lineHeight: "1",
            color: t1Wins ? "#22C55E" : isLive ? "#F59E0B" : "#64748B",
          }}>{scoreA}</span>
        )}
      </div>

      {/* Team 2 row */}
      <div className="flex items-center px-3 gap-2" style={{
        height: "42px",
        borderLeft: t2Wins ? "3px solid #22C55E" : "3px solid transparent",
        backgroundColor: t2Wins ? "rgba(34,197,94,0.08)" : "transparent",
      }}>
        <span className="flex-1 truncate" style={{
          fontSize: "12px",
          fontWeight: t2Wins ? "700" : "500",
          color: t2Wins ? "#E2E8F0" : isTeamTBD ? "#334155" : t1Wins ? "#475569" : "#CBD5E1",
        }}>{t2Name}</span>
        {!gameStr && score && (
          <span style={{
            fontSize: "18px", fontWeight: "900", minWidth: "22px", textAlign: "right", lineHeight: "1",
            color: t2Wins ? "#22C55E" : isLive ? "#F59E0B" : "#64748B",
          }}>{scoreB}</span>
        )}
      </div>

      {/* Per-game breakdown — shown below when available (e.g. 11-7  ·  11-4) */}
      {gameStr && (
        <div style={{ padding: "4px 12px 6px", borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "11px", color: isDone ? "#22C55E" : "#F59E0B", fontWeight: "700", letterSpacing: "0.5px" }}>{gameStr}</span>
          {isDone && <span style={{ fontSize: "9px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>Final</span>}
        </div>
      )}
    </div>
  );

  if (canInteract) {
    return (
      <button onClick={onScore} disabled={isStarting}
        className="active:scale-[0.97] transition-transform"
        style={{ width: "100%", textAlign: "left" }}>
        {cardContent}
      </button>
    );
  }
  return <div style={{ width: "100%" }}>{cardContent}</div>;
}

// ── CorrectScoreModal ─────────────────────────────────────────────────────────

function CorrectScoreModal({
  fixture, t1Name, t2Name, updateMatchScore, tournamentId, onClose,
}: {
  fixture: any;
  t1Name: string;
  t2Name: string;
  updateMatchScore: ReturnType<typeof useUpdateMatchScore>;
  tournamentId: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  // Parse existing per-game scores from stored match data
  const rawScores = fixture.match?.scores ?? {};
  const rawGames: any[] = rawScores.completedGames ?? rawScores.completedSets ?? [];

  const [games, setGames] = useState<{ a: number; b: number }[]>(
    rawGames.length > 0
      ? rawGames.map((g: any) => ({ a: g.A ?? 0, b: g.B ?? 0 }))
      : [{ a: 0, b: 0 }]
  );
  const [winnerOverride, setWinnerOverride] = useState<"A" | "B" | null>(null);
  const [saveError, setSaveError] = useState("");

  const gA = games.filter(g => g.a > g.b).length;
  const gB = games.filter(g => g.b > g.a).length;
  const autoWinner: "A" | "B" | null = gA > gB ? "A" : gB > gA ? "B" : null;
  const winner = winnerOverride ?? autoWinner;

  function updateGame(idx: number, field: "a" | "b", val: number) {
    setGames(prev => prev.map((g, i) => i === idx ? { ...g, [field]: isNaN(val) ? 0 : val } : g));
    setWinnerOverride(null); // re-auto-calculate when scores change
  }

  function addGame() { setGames(prev => [...prev, { a: 0, b: 0 }]); }
  function removeGame(idx: number) { if (games.length > 1) setGames(prev => prev.filter((_, i) => i !== idx)); }

  function handleSave() {
    setSaveError("");
    const scores = {
      gamesWon: { A: gA, B: gB },
      completedGames: games.map(g => ({
        A: g.a, B: g.b,
        winner: g.a > g.b ? "A" : g.b > g.a ? "B" : "draw",
      })),
    };
    const winnerTeam = winner ?? undefined;
    updateMatchScore.mutate(
      { id: fixture.matchId, scores, winnerTeam } as any,
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ["tournaments", tournamentId] });
          qc.invalidateQueries({ queryKey: ["standings", tournamentId] });
          onClose();
        },
        onError: (err: any) => {
          setSaveError(err?.response?.data?.message ?? "Failed to save score.");
        },
      }
    );
  }

  const BASE_INPUT: React.CSSProperties = {
    width: "54px", padding: "8px 6px", borderRadius: "8px", textAlign: "center",
    backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.1)",
    color: "#fff", fontSize: "18px", fontWeight: "800", outline: "none",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md mx-auto p-5 pb-24"
        style={{ borderRadius: "20px 20px 0 0", backgroundColor: "#1E293B", maxHeight: "90dvh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white" style={{ fontSize: "16px", fontWeight: "800" }}>Correct Score</h3>
          <button onClick={onClose}><X style={{ width: "18px", height: "18px", color: "#64748B" }} /></button>
        </div>

        {/* Team headers */}
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-white flex-1" style={{ fontSize: "13px", fontWeight: "700" }}>{t1Name}</span>
          <span className="text-[#475569] mx-2" style={{ fontSize: "11px" }}>vs</span>
          <span className="text-white flex-1 text-right" style={{ fontSize: "13px", fontWeight: "700" }}>{t2Name}</span>
        </div>

        {/* Per-game rows */}
        <div className="space-y-2 mb-4">
          {games.map((g, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-[#475569]" style={{ fontSize: "11px", minWidth: "50px" }}>Game {idx + 1}</span>
              <input
                type="number" min={0} max={99}
                value={g.a}
                onChange={e => updateGame(idx, "a", parseInt(e.target.value))}
                style={BASE_INPUT}
              />
              <span className="text-[#334155]" style={{ fontSize: "14px", fontWeight: "700" }}>—</span>
              <input
                type="number" min={0} max={99}
                value={g.b}
                onChange={e => updateGame(idx, "b", parseInt(e.target.value))}
                style={BASE_INPUT}
              />
              {games.length > 1 && (
                <button onClick={() => removeGame(idx)} className="ml-1 active:scale-90 transition-transform">
                  <X style={{ width: "14px", height: "14px", color: "#475569" }} />
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={addGame}
          className="flex items-center gap-1 mb-5 active:scale-95 transition-transform"
          style={{ fontSize: "12px", color: "#64748B" }}
        >
          <Plus style={{ width: "13px", height: "13px" }} />
          Add game
        </button>

        {/* Games won summary */}
        <div className="flex items-center justify-center gap-4 mb-4 p-3"
          style={{ borderRadius: "10px", backgroundColor: "rgba(255,255,255,0.04)" }}>
          <div className="text-center">
            <p style={{ fontSize: "22px", fontWeight: "800", color: gA > gB ? "#22C55E" : "#94A3B8" }}>{gA}</p>
            <p style={{ fontSize: "10px", color: "#475569" }}>games won</p>
          </div>
          <span style={{ fontSize: "14px", color: "#334155" }}>:</span>
          <div className="text-center">
            <p style={{ fontSize: "22px", fontWeight: "800", color: gB > gA ? "#22C55E" : "#94A3B8" }}>{gB}</p>
            <p style={{ fontSize: "10px", color: "#475569" }}>games won</p>
          </div>
        </div>

        {/* Winner selector */}
        <div className="mb-5">
          <p className="text-[#64748B] mb-2" style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>
            Winner {winnerOverride ? "(manual)" : "(auto)"}
          </p>
          <div className="flex gap-2">
            {(["A", "B"] as const).map(side => {
              const name = side === "A" ? t1Name : t2Name;
              const active = winner === side;
              return (
                <button
                  key={side}
                  onClick={() => setWinnerOverride(winnerOverride === side ? null : side)}
                  className="flex-1 py-2 active:scale-95 transition-transform"
                  style={{
                    borderRadius: "10px", fontSize: "13px", fontWeight: "700",
                    border: active ? "1px solid #22C55E" : "1px solid rgba(255,255,255,0.08)",
                    backgroundColor: active ? "rgba(34,197,94,0.12)" : "#0F172A",
                    color: active ? "#22C55E" : "#64748B",
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>

        {saveError && (
          <p className="text-[#EF4444] mb-3" style={{ fontSize: "12px" }}>{saveError}</p>
        )}

        <button
          onClick={handleSave}
          disabled={updateMatchScore.isPending}
          className="w-full py-3 active:scale-[0.98] transition-transform"
          style={{
            borderRadius: "12px", fontSize: "15px", fontWeight: "700", color: "#fff",
            background: updateMatchScore.isPending ? "#1E293B" : "linear-gradient(135deg,#F59E0B,#D97706)",
          }}
        >
          {updateMatchScore.isPending ? "Saving…" : "Save Corrected Score"}
        </button>
      </div>
    </div>
  );
}

// ── FixtureCard ──────────────────────────────────────────────────────────────

function FixtureCard({
  fixture,
  isRoundRobin,
  maxRound,
  bestOf,
  isTournamentActive = false,
  isStarting = false,
  tournamentId,
  onScore,
  onEditScore,
  isOrganizer = false,
}: {
  fixture: any;
  isRoundRobin: boolean;
  maxRound: number;
  bestOf?: number;
  isTournamentActive?: boolean;
  isStarting?: boolean;
  tournamentId: number;
  onScore?: () => void;
  onEditScore?: () => void;
  isOrganizer?: boolean;
}) {
  const navigate  = useNavigate();
  const t1Name    = fixture.team1Ref?.name ?? (isTBD(fixture.team1Ref) ? "TBD" : "Team A");
  const t2Name    = fixture.team2Ref?.name ?? (isTBD(fixture.team2Ref) ? "TBD" : "Team B");
  const isByeCard = fixture.status === "bye" || fixture.team2Ref?.bye || fixture.team1Ref?.bye;
  const isTeamTBD = isTBD(fixture.team1Ref) || isTBD(fixture.team2Ref);

  const matchStatus: string = fixture.match?.status ?? fixture.status ?? "scheduled";
  const isLive     = matchStatus === "live" || matchStatus === "in_progress";
  const isDone     = matchStatus === "completed";
  const st         = STATUS_STYLE[isLive ? "in_progress" : matchStatus] ?? STATUS_STYLE.scheduled;
  const isFinal    = !isRoundRobin && (fixture.round ?? 1) === maxRound;
  const hasMatch   = !!fixture.matchId;

  const score   = flatScore(fixture.match?.scores);
  const gameStr = gameScores(fixture.match?.scores);
  const scoreA  = score?.a ?? null;
  const scoreB  = score?.b ?? null;
  const { t1Wins, t2Wins } = deriveWinner(fixture.match?.winnerTeam, scoreA, scoreB, isDone);

  const canScore = isTournamentActive && !isByeCard && !isTeamTBD && !isDone;

  const actionMode: "view" | "score" | "start" | null = (() => {
    if (isByeCard) return null;
    if (isLive && hasMatch) return "view";
    if (isDone  && hasMatch) return "view";
    if (canScore && hasMatch) return "view";
    if (canScore && !hasMatch) return "start";
    return null;
  })();

  const cardContent = (
    <>
      <div className="flex-1 min-w-0">
        <p className="truncate" style={{ fontSize: "13px", fontWeight: "700", color: t1Wins ? "#22C55E" : "white" }}>{t1Name}</p>
      </div>

      <div className="flex flex-col items-center mx-2 flex-shrink-0">
        {gameStr ? (
          <p style={{ fontSize: "11px", fontWeight: "800", color: isLive ? "#22C55E" : isDone ? "#94A3B8" : "#3B82F6", textAlign: "center", whiteSpace: "nowrap" }}>
            {gameStr}
          </p>
        ) : score ? (
          <p style={{ fontSize: "16px", fontWeight: "800", color: isLive ? "#22C55E" : "#3B82F6" }}>
            {score.a} : {score.b}
          </p>
        ) : (
          <p style={{ fontSize: "12px", color: "#475569", fontWeight: "500" }}>
            {isByeCard ? "BYE" : "vs"}
          </p>
        )}
        <div className="mt-0.5 px-1.5 py-0.5 flex items-center gap-1"
          style={{ borderRadius: "4px", backgroundColor: st.bg }}>
          {isLive && <Radio style={{ width: "6px", height: "6px", color: st.color }} className="animate-pulse" />}
          <span style={{ fontSize: "8px", fontWeight: "700", color: st.color, letterSpacing: "0.05em" }}>
            {MATCH_STATUS_LABEL[matchStatus] ?? matchStatus.toUpperCase()}
          </span>
        </div>
        {bestOf && isFinal && (
          <div className="mt-0.5 px-1.5 py-0.5"
            style={{ borderRadius: "4px", backgroundColor: "rgba(245,158,11,0.12)", fontSize: "8px", fontWeight: "700", color: "#F59E0B" }}>
            Bo{bestOf}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 text-right">
        <p className="truncate" style={{ fontSize: "13px", fontWeight: "700", color: t2Wins ? "#22C55E" : "white" }}>{t2Name}</p>
      </div>

      {/* Sumula link for completed matches */}
      {isDone && hasMatch && (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/tournaments/${tournamentId}/sumula/${fixture.id}`); }}
          className="ml-2 flex-shrink-0 active:scale-90 transition-transform"
          title="View match sheet"
          style={{ padding: "4px 6px", borderRadius: "6px", backgroundColor: "rgba(100,116,139,0.12)" }}
        >
          <span style={{ fontSize: "9px", color: "#64748B", fontWeight: "700" }}>SHEET</span>
        </button>
      )}

      {/* Edit score — organizer only on completed fixtures */}
      {isDone && hasMatch && isOrganizer && onEditScore && (
        <button
          onClick={(e) => { e.stopPropagation(); onEditScore(); }}
          className="ml-1 flex-shrink-0 active:scale-90 transition-transform"
          title="Correct score"
          style={{ padding: "4px 6px", borderRadius: "6px", backgroundColor: "rgba(245,158,11,0.1)" }}
        >
          <Pencil style={{ width: "10px", height: "10px", color: "#F59E0B" }} />
        </button>
      )}

      {actionMode === "start" && (
        <div className="ml-2 flex-shrink-0">
          {isStarting ? (
            <Loader2 style={{ width: "18px", height: "18px", color: "#22C55E" }} className="animate-spin" />
          ) : (
            <div
              className="flex items-center justify-center"
              style={{ width: "28px", height: "28px", borderRadius: "8px", backgroundColor: "rgba(34,197,94,0.15)" }}
            >
              <Activity style={{ width: "14px", height: "14px", color: "#22C55E" }} />
            </div>
          )}
        </div>
      )}
      {actionMode === "view" && !isDone && (
        <div className="ml-2 flex-shrink-0">
          <ChevronRight style={{ width: "16px", height: "16px", color: "#334155" }} />
        </div>
      )}
    </>
  );

  const sharedStyle: React.CSSProperties = {
    borderRadius: "12px",
    backgroundColor: "#1E293B",
    border: isFinal ? "1px solid rgba(245,158,11,0.25)" : isLive ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(255,255,255,0.04)",
    padding: "12px 14px",
    opacity: isByeCard ? 0.45 : 1,
    width: "100%",
    marginBottom: "8px",
    display: "flex",
    alignItems: "center",
  };

  if (actionMode && onScore) {
    return (
      <button
        onClick={onScore}
        disabled={isStarting}
        className="active:scale-[0.98] transition-transform text-left"
        style={sharedStyle}
      >
        {cardContent}
      </button>
    );
  }

  return <div style={sharedStyle}>{cardContent}</div>;
}

