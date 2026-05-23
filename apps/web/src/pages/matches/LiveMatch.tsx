/**
 * LiveMatch — On-field scoring screen
 *
 * Design principles (from scoring spec):
 *  • 1–2 taps max per action
 *  • Big buttons — usable with sweaty hands on-field
 *  • Undo always available
 *  • Primary score (goal/point/run) one tap per team
 *  • Secondary events (cards, extras) in a separate row
 *  • Auto winner indicator
 *  • Match summary on completion
 */

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  useMatch, useUpdateMatchScore, useAddMatchEvent,
  useUpdateMatchStatus, useCurrentUser,
} from "@sportza/api-client";
import {
  ChevronLeft, Tv2, Radio, Undo2, Trophy,
  MapPin, Calendar, Activity, Plus, RotateCcw,
} from "lucide-react";
import { format } from "date-fns";
import {
  useMatchSocket, MatchScorePayload, MatchEventPayload, MatchStatusPayload,
} from "../../hooks/useMatchSocket";
import { getEngine, normaliseState } from "../../lib/scoring";
import type { ScoringAction } from "../../lib/scoring";
import { resolveMatchScoreType } from "../../lib/scoring/matchScoreType";
import {
  formatPickleballServeLine,
  type PickleballServiceState,
} from "../../lib/scoring/engines/pickleball-service";
import {
  type PickleballRallyState,
  formatPickleballRallyServeLine,
} from "../../lib/scoring/engines/pickleball-rally";

function teamKeyToAB(teamKeys: string[], teamKey: string): "A" | "B" {
  if (teamKeys.length >= 2 && teamKey === teamKeys[1]) return "B";
  return "A";
}

// ─── Event icons for the log ──────────────────────────────────────────────────

const EVENT_ICONS: Record<string, string> = {
  goal: "⚽", run: "🏏", "1": "1️⃣", "2": "2️⃣", "4": "🔵", four: "🔵",
  "6": "💫", six: "💫", wicket: "❌", dot: "◦", point: "●",
  basket: "🏀", "2pt": "🏀", "3pt": "🎯", three_pointer: "🎯",
  free_throw: "🎯", yellow_card: "🟡", red_card: "🔴",
  ace: "⚡", fault: "❌", double_fault: "✖", wide: "⚡", no_ball: "🔁",
  smash: "🏸", shuttle: "🏸", block: "🤜", timeout: "⏱",
  let: "🔄", stroke: "🎯", penalty: "🚫", own_goal: "↩️",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const selectSt: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: "10px",
  backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.08)",
  color: "#fff", fontSize: "14px", outline: "none", appearance: "none",
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function LiveMatch() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const matchId    = id ? parseInt(id, 10) : 0;

  const { data: res, isLoading, refetch } = useMatch(matchId);
  const { data: userRes }  = useCurrentUser();
  const updateScore  = useUpdateMatchScore();
  const addEvent     = useAddMatchEvent();
  const updateStatus = useUpdateMatchStatus();

  // ── Debounced score persistence ────────────────────────────────────────────
  // Rapid taps generate concurrent PUT requests that arrive out-of-order at the
  // API. The socket then broadcasts whichever completed last — potentially a
  // stale intermediate state. Debouncing collapses all taps within 400 ms into
  // a single request carrying the final accumulated state.
  const pendingScoreRef  = useRef<unknown>(null);
  const scoreDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flush any pending debounced write and clear timer on unmount
  useEffect(() => () => {
    if (scoreDebounceRef.current) clearTimeout(scoreDebounceRef.current);
  }, []);

  function persistScore(state: unknown) {
    pendingScoreRef.current = state;
    if (scoreDebounceRef.current) clearTimeout(scoreDebounceRef.current);
    scoreDebounceRef.current = setTimeout(() => {
      if (pendingScoreRef.current !== null) {
        updateScore.mutate({ id: matchId, scores: pendingScoreRef.current as any });
        pendingScoreRef.current = null;
      }
    }, 50);
  }

  // ── Local UI state ─────────────────────────────────────────────────────────
  const [undoStack, setUndoStack]         = useState<unknown[]>([]);
  const [activeSecTeam, setActiveSecTeam] = useState<string | null>(null);
  const [showScoreModal, setShowScoreModal]   = useState(false);
  const [showEventModal, setShowEventModal]   = useState(false);
  const [showEndModal, setShowEndModal]       = useState(false);
  const [resultType, setResultType]           = useState<"winner" | "draw" | null>(null);
  const [scoreInputs, setScoreInputs]     = useState<Record<string, string>>({});
  const [eventTeam, setEventTeam]         = useState("");
  const [eventType, setEventType]         = useState("point");

  // ── Socket state ───────────────────────────────────────────────────────────
  const [liveScores, setLiveScores] = useState<Record<string, unknown> | null>(null);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [liveEvents, setLiveEvents] = useState<Array<{
    id?: number; team: string; eventType: string; eventValue: number;
    playerName?: string | null; eventTimestamp: string;
  }>>([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const [flashTeam, setFlashTeam]   = useState<string | null>(null);

  const flash = (team: string) => {
    setFlashTeam(team);
    setTimeout(() => setFlashTeam(null), 500);
  };

  const onScore  = useCallback((p: MatchScorePayload)  => { setLiveScores(p.scores); setLiveStatus(p.status); setSocketConnected(true); }, []);
  const onEvent  = useCallback((p: MatchEventPayload)  => {
    const ev = p.event;
    setLiveEvents((prev) => [{
      id: ev.id, team: ev.team, eventType: ev.eventType,
      eventValue: ev.eventValue, playerName: ev.playerName, eventTimestamp: ev.eventTimestamp,
    }, ...prev]);
    flash(ev.team);
    setSocketConnected(true);
  }, []);
  const onStatus = useCallback((p: MatchStatusPayload) => {
    setLiveStatus(p.status); setSocketConnected(true);
    if (p.status === "completed") refetch();
  }, [refetch]);

  const { emitScorePreview } = useMatchSocket({ matchId: matchId || null, onScore, onEvent, onStatus });

  // ── Derived data ───────────────────────────────────────────────────────────
  const match   = (res as any)?.data as Record<string, unknown> | undefined;
  const rawUser = userRes as any;
  const user    = (rawUser?.user ?? rawUser?.data?.user ?? rawUser?.data ?? rawUser) as { id?: number } | undefined;
  const isCreator = !!match?.createdById && !!user?.id && user.id === match.createdById;

  const teamKeys: string[] = (match?.teams && typeof match.teams === "object")
    ? Object.keys(match.teams as object) : ["A", "B"];

  const teamNames: Record<string, string> = {};
  const teamPlayerNames: Record<string, string[]> = {};
  if (match?.teams && typeof match.teams === "object") {
    const t = match.teams as Record<string, unknown>;
    teamKeys.forEach((k) => {
      const val = t[k];
      teamNames[k] = typeof val === "string" ? val : (val as { name?: string })?.name ?? k;
      const pNames = (val as { playerNames?: string[] })?.playerNames ?? [];
      teamPlayerNames[k] = pNames;
    });
  } else { teamNames.A = "Team A"; teamNames.B = "Team B"; }

  const status   = liveStatus ?? ((match?.status as string) ?? "scheduled");
  const isLive   = status === "live";
  const isDone   = status === "completed";

  const sport      = match?.sport as { displayName?: string; name?: string } | undefined;
  const sportKey   = (match?.sportName as string ?? sport?.name ?? "").toLowerCase();
  const venue      = match?.venue as { name?: string; location?: { city?: string | null } | null } | undefined;

  // ── Scoring engine ────────────────────────────────────────────────────────
  // Prefer explicit scoreType (pickleball_service / pickleball_rally); else sport name.
  const scoreType = useMemo(
    () => resolveMatchScoreType(match as Parameters<typeof resolveMatchScoreType>[0]) || sportKey || "simple",
    [match, sportKey],
  );
  const engine     = useMemo(() => getEngine(scoreType), [scoreType]);
  const rawScores  = liveScores ?? match?.scores ?? null;
  const engineState = useMemo(() => normaliseState(rawScores, scoreType), [rawScores, scoreType]);
  const engineDisplay = useMemo(
    () => engine.display(engineState, { A: teamNames[teamKeys[0]] ?? "A", B: teamNames[teamKeys[1]] ?? "B" }),
    [engine, engineState, teamNames, teamKeys]
  );
  const displayForUi = useMemo(() => {
    if (scoreType === "pickleball_service") {
      const st = engineState as PickleballServiceState;
      if (st?.config?.sport !== "pickleball_service" || st.winner) return engineDisplay;
      const pA = teamPlayerNames[teamKeys[0]] ?? [];
      const pB = teamPlayerNames[teamKeys[1]] ?? [];
      return {
        ...engineDisplay,
        secondary: formatPickleballServeLine(st, {
          A: teamNames[teamKeys[0]] ?? "A",
          B: teamNames[teamKeys[1]] ?? "B",
        }, pA, pB),
      };
    }
    if (scoreType === "pickleball_rally") {
      const st = engineState as PickleballRallyState;
      if (st?.config?.sport !== "pickleball_rally" || st.winner || !st.config.doubles || !st.setupComplete) {
        return engineDisplay;
      }
      const pA = teamPlayerNames[teamKeys[0]] ?? [];
      const pB = teamPlayerNames[teamKeys[1]] ?? [];
      return {
        ...engineDisplay,
        secondary: formatPickleballRallyServeLine(st, {
          A: teamNames[teamKeys[0]] ?? "A",
          B: teamNames[teamKeys[1]] ?? "B",
        }, pA, pB),
      };
    }
    return engineDisplay;
  }, [scoreType, engineState, engineDisplay, teamNames, teamKeys, teamPlayerNames]);

  const pbState = engineState as Partial<PickleballServiceState | PickleballRallyState>;
  const pbSetupGate =
    (scoreType === "pickleball_service" && (pbState as Partial<PickleballServiceState>)?.config?.doubles !== false && !pbState?.setupComplete)
    || (scoreType === "pickleball_rally" && (pbState as Partial<PickleballRallyState>)?.config?.doubles !== false && !pbState?.setupComplete);

  const primaryActions: ScoringAction[] = useMemo(() => engine.getActions(engineState), [engine, engineState]);
  const secondaryActions = useMemo(() => engine.getSecondaryActions(engineState), [engine, engineState]);

  /** Pickleball service: after setup, primary rally outcome is serve-relative (two explicit buttons). */
  const pbServeCentricPrimary = useMemo(() => {
    if (scoreType !== "pickleball_service" || pbSetupGate) return false;
    const st = engineState as PickleballServiceState;
    if (st?.winner != null || !primaryActions[0]) return false;
    return true;
  }, [scoreType, pbSetupGate, engineState, primaryActions]);

  const { serveTeamKey, recvTeamKey } = useMemo(() => {
    if (!pbServeCentricPrimary || teamKeys.length < 2) {
      return { serveTeamKey: null as string | null, recvTeamKey: null as string | null };
    }
    const srv = (engineState as PickleballServiceState).serving ?? "A";
    if (srv === "B") {
      return { serveTeamKey: teamKeys[1]!, recvTeamKey: teamKeys[0]! };
    }
    return { serveTeamKey: teamKeys[0]!, recvTeamKey: teamKeys[1]! };
  }, [pbServeCentricPrimary, engineState, teamKeys]);

  /** Extra Events actions that apply without picking Team A/B first */
  const secondaryAnyNoTeamNeeded = useMemo(() => {
    const pbSvc = scoreType === "pickleball_service";
    const pbRallyLike = scoreType === "pickleball_rally" || scoreType === "pickleball";
    return secondaryActions.some((action) => (
      (pbSvc && (action.eventType === "fault" || action.eventType === "kitchen_fault" || action.eventType === "switch_serve"))
      || (pbRallyLike && action.eventType === "switch_serve")
    ));
  }, [secondaryActions, scoreType]);

  // ── Split primary display for individual panels ───────────────────────────
  const [panelA, panelB] = useMemo(() => {
    const p = displayForUi.primary;
    if (p.includes(" – ")) {
      const parts = p.split(" – ");
      return [parts[0] ?? "0", parts[1] ?? "0"];
    }
    if (p === "Deuce") return ["D", "D"];
    if (p === "Adv A") return ["ADV", "–"];
    if (p === "Adv B") return ["–", "ADV"];
    return [p, ""];
  }, [displayForUi.primary]);

  const panelValues = [panelA, panelB];

  const dbEvents: any[]  = (match?.events ?? []) as any[];
  const allEvents: any[] = liveEvents.length > 0 ? liveEvents : dbEvents;

  // ── Leading / winner detection ─────────────────────────────────────────────
  // Extract flat totals for visual leading indicator
  const flatA = useMemo(() => {
    const s = engineState as any;
    const sportCfg = s?.config?.sport as string | undefined;
    if (s?.currentGame && (
      sportCfg === "pickleball" ||
      sportCfg === "pickleball_service" ||
      sportCfg === "pickleball_rally"
    )) {
      return Number(s.currentGame.A ?? 0);
    }
    if (s?.setsWon) return Number(s.setsWon.A ?? 0);
    if (s?.gamesWon) return Number(s.gamesWon.A ?? 0);
    if (s?.scores) return Number(s.scores.A ?? 0);
    return Number((rawScores as any)?.[teamKeys[0]] ?? 0);
  }, [engineState, rawScores, teamKeys]);

  const flatB = useMemo(() => {
    const s = engineState as any;
    const sportCfg = s?.config?.sport as string | undefined;
    if (s?.currentGame && (
      sportCfg === "pickleball" ||
      sportCfg === "pickleball_service" ||
      sportCfg === "pickleball_rally"
    )) {
      return Number(s.currentGame.B ?? 0);
    }
    if (s?.setsWon) return Number(s.setsWon.B ?? 0);
    if (s?.gamesWon) return Number(s.gamesWon.B ?? 0);
    if (s?.scores) return Number(s.scores.B ?? 0);
    return Number((rawScores as any)?.[teamKeys[1]] ?? 0);
  }, [engineState, rawScores, teamKeys]);

  const scoreA = flatA;
  const scoreB = flatB;

  const leadingKey = isLive
    ? flatA > flatB ? teamKeys[0] : flatB > flatA ? teamKeys[1] : null
    : null;

  const winnerKey = isDone ? (match?.winnerTeam as string | undefined) : null;

  // ── Scoring actions ────────────────────────────────────────────────────────
  function scoreTeam(teamKey: string, action: ScoringAction) {
    if (!isLive || !isCreator) return;

    const ab = teamKeyToAB(teamKeys, teamKey);
    // Apply event via engine to get new state
    const newState = engine.applyEvent(engineState, ab, action.eventType);

    // Optimistic update — show score change immediately, don't wait for socket
    setLiveScores(newState as Record<string, unknown>);

    // Instant scoreboard sync — emit directly via socket so Scoreboard
    // updates on every tap without waiting for the debounced HTTP write.
    emitScorePreview(newState as Record<string, unknown>);

    // Save snapshot for undo (save the state BEFORE this action)
    setUndoStack((prev) => [...prev.slice(-19), engineState]);

    const rLog = (newState as PickleballServiceState).rallyLog;
    const feedEventType = scoreType === "pickleball_service" && rLog?.length
      ? rLog[rLog.length - 1]!.eventType
      : action.eventType;
    addEvent.mutate({ id: matchId, team: teamKey, eventType: feedEventType, eventValue: action.value });

    // Auto-complete: if the engine now has a winner, end the match automatically
    // rather than requiring a manual "End Match" tap.
    if (engine.isComplete(newState)) {
      // Cancel any pending debounced write — handleEndMatch will persist scores
      if (scoreDebounceRef.current) clearTimeout(scoreDebounceRef.current);
      pendingScoreRef.current = null;

      const winAb = (newState as any).winner as "A" | "B" | undefined;
      const winKey = winAb === "B" ? teamKeys[1] : teamKeys[0];
      handleEndMatch(winKey, newState);
      return;
    }

    // Debounced persist — collapses rapid taps into one DB write
    persistScore(newState);
    flash(teamKey);
  }

  function handleUndo() {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    // Optimistic revert
    setLiveScores(prev as Record<string, unknown>);
    emitScorePreview(prev as Record<string, unknown>);
    persistScore(prev);
  }

  function handleUpdateScore() {
    const aVal = parseInt(scoreInputs[teamKeys[0]] ?? "0", 10);
    const bVal = parseInt(scoreInputs[teamKeys[1]] ?? "0", 10);
    if (!isNaN(aVal) && !isNaN(bVal)) {
      const patched = structuredClone(engineState) as any;

      // Patch A/B into whichever score bucket the engine uses
      if (patched?.scores) {
        patched.scores.A = aVal; patched.scores.B = bVal;
      } else if (patched?.currentGame) {
        patched.currentGame.A = aVal; patched.currentGame.B = bVal;
      } else if (patched?.currentSet) {
        patched.currentSet.A = aVal; patched.currentSet.B = bVal;
      }

      // ── Pickleball: reset derived fields that are now inconsistent ──────
      if (scoreType === "pickleball_rally" || scoreType === "pickleball_service") {
        const { pointsToWin = 11, winBy = 2 } = patched.config ?? {};

        // Re-evaluate winner based on new scores
        if (aVal >= pointsToWin && aVal - bVal >= winBy) patched.winner = "A";
        else if (bVal >= pointsToWin && bVal - aVal >= winBy) patched.winner = "B";
        else patched.winner = null;

        // Reset servingScoreIndex parity to match new score parity
        // (even score → right, odd → left — we can't know history so use score as proxy)
        if (scoreType === "pickleball_rally" && patched.servingScoreIndex !== undefined) {
          patched.servingScoreIndex = {
            A: aVal % 2 === 0 ? 0 : 1,
            B: bVal % 2 === 0 ? 0 : 1,
          };
        }

        // Recalculate currentServerPlayerIndex from new serving-team score
        if (patched.starterRightPlayerIndex && patched.serving != null) {
          const srv: "A" | "B" = patched.serving;
          const newScore = srv === "A" ? aVal : bVal;
          const starterRight: 0 | 1 = patched.starterRightPlayerIndex[srv] ?? 0;
          const rightPlayer: 0 | 1 = newScore % 2 === 0 ? starterRight : ((1 - starterRight) as 0 | 1);
          patched.currentServerPlayerIndex = newScore % 2 === 0 ? rightPlayer : ((1 - rightPlayer) as 0 | 1);
        }

        // Service engine: reset server number + clear stale rally log
        if (scoreType === "pickleball_service") {
          patched.serverNumber = 1;
          if (Array.isArray(patched.rallyLog)) patched.rallyLog = [];
          if (typeof patched.nextSeq === "number") patched.nextSeq = 1;
        }
      }
      // ────────────────────────────────────────────────────────────────────

      // Optimistic update so the panel reflects the edit immediately;
      // also clear undo stack — undo against a manually edited score is confusing.
      setLiveScores(patched);
      emitScorePreview(patched);
      setUndoStack([]);

      updateScore.mutate({ id: matchId, scores: patched }, {
        onSuccess: () => setShowScoreModal(false),
      });
    }
  }

  function handleAddEvent() {
    if (!eventTeam) return;
    addEvent.mutate({ id: matchId, team: eventTeam, eventType, eventValue: 1 }, {
      onSuccess: () => setShowEventModal(false),
    });
  }

  function handleEndMatch(winnerTeamKey?: string, scoresOverride?: unknown) {
    // scoresOverride lets auto-complete pass the freshly computed newState,
    // because engineState (memoised) is stale at the point of the call.
    const scoresToSave = scoresOverride ?? engineState;

    // Complete the match status (called after winner is saved, or immediately for a draw)
    const completeMatch = () => {
      updateStatus.mutate(
        { id: matchId, status: "completed" },
        {
          onSuccess: () => {
            setShowEndModal(false);
            refetch();
          },
        }
      );
    };

    if (winnerTeamKey) {
      // Save winner FIRST so the DB has winnerTeam set before the status event
      // fires and the Scoreboard re-fetches — eliminating the DRAW flash.
      updateScore.mutate(
        { id: matchId, scores: scoresToSave as any, winnerTeam: winnerTeamKey } as any,
        { onSuccess: completeMatch }
      );
    } else {
      completeMatch();
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading || !match) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-2 border-[#3B82F6] border-t-transparent rounded-full" />
      </div>
    );
  }

  const engineDone = engine.isComplete(engineState);
  const canScore   = isLive && isCreator && !engineDone;
  const canTapScorePanels = canScore && !pbSetupGate;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0F172A] pb-28">

      {/* ── Header ── */}
      <div
        className="sticky top-0 z-10 bg-[#0F172A] flex items-center gap-3 px-4 pt-5 pb-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#1E293B" }}
        >
          <ChevronLeft style={{ width: "20px", height: "20px", color: "#94A3B8" }} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white truncate" style={{ fontSize: "16px", fontWeight: "700" }}>
              {sport?.displayName ?? sport?.name ?? "Match"}
            </p>
            <span className="text-[#64748B]" style={{ fontSize: "12px" }}>· {match.formatName as string}</span>
            {sportKey === "pickleball" && (
              <span
                className="shrink-0 px-1.5 py-0.5"
                style={{
                  fontSize: "9px",
                  fontWeight: "800",
                  letterSpacing: "0.04em",
                  borderRadius: "6px",
                  backgroundColor: scoreType === "pickleball_service" ? "rgba(245,158,11,0.2)" : "rgba(59,130,246,0.15)",
                  color: scoreType === "pickleball_service" ? "#FBBF24" : "#93C5FD",
                }}
              >
                {scoreType === "pickleball_service" ? "SERVICE" : "RALLY"}
              </span>
            )}
          </div>
          <p className="text-[#64748B]" style={{ fontSize: "11px" }}>
            {venue?.name ?? (match.matchDate ? format(new Date(match.matchDate as string), "MMM d") : "—")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Live dot */}
          {isLive && (
            <div className="flex items-center gap-1.5 px-2 py-1"
              style={{ borderRadius: "999px", backgroundColor: "rgba(239,68,68,0.12)" }}>
              <Radio style={{ width: "10px", height: "10px", color: "#EF4444" }} className="animate-pulse" />
              <span className="text-[#EF4444]" style={{ fontSize: "10px", fontWeight: "700" }}>LIVE</span>
            </div>
          )}
          {isDone && (
            <div className="flex items-center gap-1.5 px-2 py-1"
              style={{ borderRadius: "999px", backgroundColor: "rgba(34,197,94,0.12)" }}>
              <span className="text-[#22C55E]" style={{ fontSize: "10px", fontWeight: "700" }}>DONE</span>
            </div>
          )}
          {/* Socket indicator */}
          <div className={`rounded-full ${socketConnected ? "bg-[#22C55E]" : "bg-[#334155]"}`}
            style={{ width: "6px", height: "6px" }} />
          {/* TV button */}
          <Link to={`/scoreboard/${matchId}`} target="_blank"
            className="flex items-center justify-center"
            style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "#1E293B" }}>
            <Tv2 style={{ width: "15px", height: "15px", color: "#64748B" }} />
          </Link>
        </div>
      </div>

      <div className="px-4 pt-4 pb-4 space-y-3 max-w-md mx-auto">

        {/* ── MATCH COMPLETE — Result card ── */}
        {isDone && (
          <div
            className="text-center overflow-hidden"
            style={{
              borderRadius: "24px",
              background: winnerKey
                ? "linear-gradient(145deg,#0F172A 0%,rgba(245,158,11,0.18) 60%,#0F172A 100%)"
                : "linear-gradient(145deg,#0F172A 0%,rgba(100,116,139,0.18) 60%,#0F172A 100%)",
              border: winnerKey
                ? "1px solid rgba(245,158,11,0.4)"
                : "1px solid rgba(100,116,139,0.3)",
              position: "relative",
            }}
          >
            {/* Glowing top bar */}
            <div style={{
              height: "3px",
              background: winnerKey
                ? "linear-gradient(90deg,transparent,#F59E0B,transparent)"
                : "linear-gradient(90deg,transparent,#64748B,transparent)",
            }} />

            <div className="px-5 pt-5 pb-6">
              {/* Label */}
              <p style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "0.12em", color: winnerKey ? "#F59E0B" : "#64748B", textTransform: "uppercase", marginBottom: "14px" }}>
                {winnerKey ? "🏆 Winner" : "🤝 Match Drawn"}
              </p>

              {winnerKey ? (
                <>
                  {/* Winner team name */}
                  <p style={{ fontSize: "28px", fontWeight: "900", color: "#FFFFFF", lineHeight: 1.1, marginBottom: "2px" }}>
                    {teamNames[winnerKey] ?? winnerKey}
                  </p>
                  {/* Player names for doubles/team sports */}
                  {(teamPlayerNames[winnerKey]?.length ?? 0) > 1 && (
                    <p style={{ fontSize: "13px", fontWeight: "600", color: "#94A3B8", marginBottom: "8px", letterSpacing: "0.02em" }}>
                      {teamPlayerNames[winnerKey].join(" · ")}
                    </p>
                  )}
                  {/* Show games/sets score (secondary) as the headline when it exists,
                      falling back to primary for simple single-score sports */}
                  <p style={{ fontSize: "18px", fontWeight: "700", color: "#F59E0B", marginBottom: "4px" }}>
                    {displayForUi.secondary ?? displayForUi.primary}
                  </p>
                  {displayForUi.secondary && (
                    <p style={{ fontSize: "12px", color: "#64748B" }}>
                      {displayForUi.primary}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p style={{ fontSize: "32px", fontWeight: "900", color: "#E2E8F0", lineHeight: 1.1, marginBottom: "4px" }}>
                    {displayForUi.primary}
                  </p>
                  <p style={{ fontSize: "13px", color: "#64748B" }}>
                    {teamNames[teamKeys[0]]} · {teamNames[teamKeys[1]]}
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Pickleball service: court baseline before first rally ── */}
        {pbSetupGate && (
          <div
            className="p-4 space-y-4"
            style={{
              borderRadius: "16px",
              backgroundColor: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.35)",
            }}
          >
            <p className="text-[#F59E0B]" style={{ fontSize: "13px", fontWeight: "800" }}>Court setup (Game {((engineState as PickleballServiceState | PickleballRallyState).completedGames?.length ?? 0) + 1})</p>
            <p className="text-[#94A3B8]" style={{ fontSize: "12px" }}>
              At <strong className="text-white">0–0</strong>, who starts on the <strong className="text-white">right</strong> (even) side for each team? Tap one player per team, then lock setup.
            </p>
            {(["A", "B"] as const).map((side, idx) => {
              const tk = teamKeys[idx];
              const names = teamPlayerNames[tk];
              const p1 = names?.[0] ?? "Player 1";
              const p2 = names?.[1] ?? "Player 2";
              const st = engineState as PickleballServiceState | PickleballRallyState;
              const ack = st.setupBaselineAck?.[side];
              const rightIdx = st.starterRightPlayerIndex?.[side] ?? 0;
              const pick = (playerIdx: 0 | 1): ScoringAction => ({
                label: playerIdx === 0 ? p1 : p2,
                eventType: playerIdx === 0 ? "set_starter_right_0" : "set_starter_right_1",
                value: 0,
                style: "secondary",
              });
              const starterBtnStyle = (playerIdx: 0 | 1): React.CSSProperties => {
                const selected = Boolean(ack) && rightIdx === playerIdx;
                const muted = Boolean(ack) && rightIdx !== playerIdx;
                if (selected) {
                  return {
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: "700",
                    backgroundColor: "rgba(245,158,11,0.22)",
                    border: "2px solid rgba(251,191,36,0.75)",
                    color: "#FBBF24",
                  };
                }
                return {
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: "700",
                  backgroundColor: muted ? "rgba(59,130,246,0.06)" : "rgba(59,130,246,0.15)",
                  border: muted ? "1px solid rgba(59,130,246,0.2)" : "1px solid rgba(59,130,246,0.45)",
                  color: muted ? "#64748B" : "#93C5FD",
                  opacity: muted ? 0.75 : 1,
                };
              };
              return (
                <div key={side}>
                  <p className="text-white mb-2" style={{ fontSize: "12px", fontWeight: "700" }}>
                    {teamNames[tk]} {ack ? <span className="text-emerald-400">✓</span> : null}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!canScore}
                      aria-pressed={Boolean(ack) && rightIdx === 0}
                      onClick={() => scoreTeam(tk, pick(0))}
                      className="flex-1 py-2.5"
                      style={starterBtnStyle(0)}
                    >
                      Right: {p1}
                    </button>
                    <button
                      type="button"
                      disabled={!canScore}
                      aria-pressed={Boolean(ack) && rightIdx === 1}
                      onClick={() => scoreTeam(tk, pick(1))}
                      className="flex-1 py-2.5"
                      style={starterBtnStyle(1)}
                    >
                      Right: {p2}
                    </button>
                  </div>
                </div>
              );
            })}
            {/* Who serves first? */}
            <div>
              <p style={{ fontSize: "12px", fontWeight: "700", color: "#94A3B8", marginBottom: "8px" }}>
                Who serves first?
              </p>
              <div className="flex gap-2">
                {(["A", "B"] as const).map((side, idx) => {
                  const tk = teamKeys[idx];
                  const isSelected = (engineState as PickleballServiceState | PickleballRallyState).serving === side;
                  return (
                    <button
                      key={side}
                      type="button"
                      disabled={!canScore}
                      onClick={() => {
                        if (!isSelected) scoreTeam(tk, {
                          label: "Switch serve",
                          eventType: "switch_serve",
                          value: 0,
                          style: "secondary",
                        });
                      }}
                      className="flex-1 py-2.5"
                      style={{
                        borderRadius: "10px",
                        fontSize: "13px",
                        fontWeight: "700",
                        backgroundColor: isSelected ? "rgba(245,158,11,0.22)" : "rgba(59,130,246,0.15)",
                        border: isSelected ? "2px solid rgba(251,191,36,0.75)" : "1px solid rgba(59,130,246,0.45)",
                        color: isSelected ? "#FBBF24" : "#93C5FD",
                      }}
                    >
                      {teamNames[tk]}
                    </button>
                  );
                })}
              </div>
            </div>

            {(engineState as PickleballServiceState | PickleballRallyState).setupBaselineAck?.A
              && (engineState as PickleballServiceState | PickleballRallyState).setupBaselineAck?.B && (
              <button
                type="button"
                disabled={!canScore}
                onClick={() => scoreTeam(teamKeys[0], {
                  label: "Lock setup",
                  eventType: "confirm_setup",
                  value: 0,
                  style: "primary",
                })}
                className="w-full py-3"
                style={{
                  borderRadius: "12px",
                  background: "linear-gradient(135deg,#F59E0B,#D97706)",
                  fontSize: "15px",
                  fontWeight: "800",
                  color: "#fff",
                  border: "none",
                }}
              >
                Lock setup & begin serving
              </button>
            )}
          </div>
        )}

        {/* ── SCORE PANELS — tap targets (default) or read-only + serve-centric actions (pickleball service) ── */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {teamKeys.map((key, idx) => {
              const panelVal  = panelValues[idx] ?? "0";
              const isLeading = leadingKey === key;
              const isWinner  = winnerKey === key;
              const flashing  = flashTeam === key;
              const mainAction = primaryActions[0];
              const teamABKey = idx === 0 ? "A" : "B";
              const hasServeData = displayForUi.serve !== undefined;
              const isServing = hasServeData && displayForUi.serve === teamABKey;

              const cardStyle: React.CSSProperties = {
                borderRadius: "20px",
                backgroundColor: isWinner
                  ? "rgba(34,197,94,0.12)"
                  : isServing
                  ? "rgba(245,158,11,0.06)"
                  : isLeading
                  ? "rgba(59,130,246,0.08)"
                  : "#1E293B",
                border: isWinner
                  ? "2px solid rgba(34,197,94,0.5)"
                  : isServing
                  ? "2px solid rgba(245,158,11,0.5)"
                  : isLeading
                  ? "2px solid rgba(59,130,246,0.3)"
                  : "1px solid rgba(255,255,255,0.05)",
                padding: "20px 12px 16px",
                minHeight: "160px",
                position: "relative",
                overflow: "hidden",
              };

              const inner = (
                <>
                  {flashing && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{ backgroundColor: "rgba(34,197,94,0.25)", borderRadius: "20px", transition: "opacity 0.3s" }}
                    />
                  )}

                  {(isLeading || isWinner) && (
                    <div
                      className="absolute top-2 right-2 px-2 py-0.5"
                      style={{
                        borderRadius: "999px",
                        fontSize: "9px",
                        fontWeight: "800",
                        letterSpacing: "0.06em",
                        backgroundColor: isWinner ? "rgba(34,197,94,0.2)" : "rgba(59,130,246,0.15)",
                        color: isWinner ? "#22C55E" : "#60A5FA",
                      }}
                    >
                      {isWinner ? "WINNER" : "LEADING"}
                    </div>
                  )}

                  <p
                    className="truncate w-full"
                    style={{
                      fontSize: "13px",
                      fontWeight: "600",
                      color: isWinner ? "#22C55E" : isServing ? "#F59E0B" : isLeading ? "#60A5FA" : "#94A3B8",
                      marginBottom: "6px",
                    }}
                  >
                    {hasServeData
                      ? (isServing
                          ? <span style={{ color: "#F59E0B" }}>● </span>
                          : <span style={{ opacity: 0 }}>● </span>)
                      : (idx === 0 ? "◀ " : "▶ ")}
                    {teamNames[key]}
                  </p>

                  <p
                    style={{
                      fontSize: panelVal.length > 3 ? "36px" : "64px",
                      fontWeight: "900",
                      lineHeight: 1,
                      color: flashing ? "#22C55E" : isWinner ? "#22C55E" : "#FFFFFF",
                      transition: "color 0.3s",
                      marginBottom: pbServeCentricPrimary ? "0" : "12px",
                      letterSpacing: panelVal.length > 2 ? "-0.02em" : "normal",
                    }}
                  >
                    {panelVal}
                  </p>

                  {!pbServeCentricPrimary && canScore && mainAction && (
                    <div
                      className="w-full flex items-center justify-center gap-1"
                      style={{
                        borderRadius: "12px",
                        backgroundColor: "rgba(255,255,255,0.07)",
                        padding: "10px 0",
                        fontSize: "14px",
                        fontWeight: "700",
                        color: "#fff",
                      }}
                    >
                      {mainAction.label}
                    </div>
                  )}
                </>
              );

              if (pbServeCentricPrimary) {
                return (
                  <div
                    key={key}
                    className="flex flex-col items-center text-center"
                    style={cardStyle}
                  >
                    {inner}
                  </div>
                );
              }

              return (
                <button
                  key={key}
                  type="button"
                  disabled={!canTapScorePanels}
                  onClick={() => mainAction && scoreTeam(key, mainAction)}
                  className="flex flex-col items-center text-center active:scale-95 transition-transform duration-100"
                  style={cardStyle}
                >
                  {inner}
                </button>
              );
            })}
          </div>

          {pbServeCentricPrimary && serveTeamKey && recvTeamKey && canTapScorePanels && primaryActions[0] && (
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={!canScore}
                onClick={() => scoreTeam(serveTeamKey, primaryActions[0]!)}
                className="w-full py-3.5 active:scale-[0.99] transition-transform"
                style={{
                  borderRadius: "14px",
                  backgroundColor: "rgba(34,197,94,0.14)",
                  border: "1px solid rgba(34,197,94,0.45)",
                  fontSize: "15px",
                  fontWeight: "800",
                  color: "#86EFAC",
                }}
              >
                Point — {teamNames[serveTeamKey]} (serving)
              </button>
              <button
                type="button"
                disabled={!canScore}
                onClick={() => scoreTeam(recvTeamKey, primaryActions[0]!)}
                className="w-full py-3.5 active:scale-[0.99] transition-transform"
                style={{
                  borderRadius: "14px",
                  backgroundColor: "rgba(59,130,246,0.12)",
                  border: "1px solid rgba(59,130,246,0.4)",
                  fontSize: "15px",
                  fontWeight: "800",
                  color: "#93C5FD",
                }}
              >
                Returners win — {teamNames[recvTeamKey]} (side out / no point)
              </button>
            </div>
          )}
        </div>

        {/* ── Score context bar (period / set / game info) ── */}
        {(displayForUi.secondary || displayForUi.tertiary || displayForUi.period) && (
          <div
            className="flex items-center justify-center gap-3 px-4 py-2.5"
            style={{
              borderRadius: "12px",
              backgroundColor: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {displayForUi.period && (
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#60A5FA" }}>
                {displayForUi.period}
              </span>
            )}
            {displayForUi.period && (displayForUi.secondary || displayForUi.tertiary) && (
              <span style={{ color: "#334155", fontSize: "12px" }}>·</span>
            )}
            {displayForUi.tertiary && (
              <span style={{ fontSize: "13px", fontWeight: "800", color: "#F59E0B" }}>
                {displayForUi.tertiary}
              </span>
            )}
            {displayForUi.tertiary && displayForUi.secondary && (
              <span style={{ color: "#334155", fontSize: "12px" }}>·</span>
            )}
            {displayForUi.secondary && (
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#94A3B8" }}>
                {displayForUi.secondary}
              </span>
            )}
          </div>
        )}

        {/* ── ENGINE-DONE fallback banner ── */}
        {/* Shown when the engine has a winner but status is still "live" —
            e.g. auto-complete failed due to a network error, or the match was
            loaded from the DB already at a terminal engine state. */}
        {engineDone && isLive && isCreator && (
          <div
            className="p-4 text-center"
            style={{
              borderRadius: "16px",
              background: "linear-gradient(135deg,rgba(34,197,94,0.12),rgba(59,130,246,0.08))",
              border: "1px solid rgba(34,197,94,0.3)",
            }}
          >
            <p style={{ fontSize: "13px", fontWeight: "700", color: "#22C55E", marginBottom: "10px" }}>
              Match complete — finalise the result
            </p>
            <button
              onClick={() => { setResultType(null); setShowEndModal(true); }}
              className="w-full py-3"
              style={{
                borderRadius: "12px",
                background: "linear-gradient(135deg,#22C55E,#16A34A)",
                fontSize: "15px",
                fontWeight: "800",
                color: "#fff",
                border: "none",
              }}
            >
              End Match
            </button>
          </div>
        )}

        {/* ── START MATCH button (if scheduled) ── */}
        {isCreator && !isLive && !isDone && (
          <button
            onClick={() => updateStatus.mutate({ id: matchId, status: "live" })}
            disabled={updateStatus.isPending}
            className="w-full py-4"
            style={{
              borderRadius: "16px",
              background: "linear-gradient(135deg,#EF4444,#DC2626)",
              fontSize: "16px",
              fontWeight: "800",
              color: "#fff",
            }}
          >
            {updateStatus.isPending ? "Starting…" : "⚡ Start Match"}
          </button>
        )}

        {/* ── UNDO row ── */}
        {canScore && undoStack.length > 0 && (
          <button
            onClick={handleUndo}
            disabled={updateScore.isPending}
            className="w-full flex items-center justify-center gap-2 py-3"
            style={{
              borderRadius: "14px",
              backgroundColor: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.25)",
              fontSize: "14px",
              fontWeight: "600",
              color: "#F59E0B",
            }}
          >
            <Undo2 style={{ width: "16px", height: "16px" }} />
            Undo last action ({undoStack.length})
          </button>
        )}

        {/* ── EXTRA SCORING ACTIONS (additional primary actions + secondary events) ── */}
        {canScore && (primaryActions.length > 1 || secondaryActions.length > 0) && (
          <div
            className="p-4"
            style={{ borderRadius: "16px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <p className="text-[#64748B] mb-3" style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Extra Events
            </p>

            {/* Team selector tabs */}
            <div className="flex gap-2 mb-3">
              {teamKeys.map((k) => (
                <button
                  key={k}
                  onClick={() => setActiveSecTeam(activeSecTeam === k ? null : k)}
                  className="flex-1 py-2"
                  style={{
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: "600",
                    backgroundColor: activeSecTeam === k ? "#3B82F6" : "rgba(255,255,255,0.06)",
                    color: activeSecTeam === k ? "#fff" : "#94A3B8",
                    border: "none",
                  }}
                >
                  {teamNames[k]}
                </button>
              ))}
            </div>

            {/* Additional primary actions (e.g. +3, free throw for basketball; runs for cricket) */}
            {primaryActions.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {primaryActions.slice(1).map((action) => (
                  <button
                    key={action.eventType}
                    disabled={!activeSecTeam || updateScore.isPending}
                    onClick={() => activeSecTeam && scoreTeam(activeSecTeam, action)}
                    className="px-3 py-2 active:scale-95 transition-all"
                    style={{
                      borderRadius: "10px",
                      fontSize: "13px",
                      fontWeight: "700",
                      backgroundColor: activeSecTeam ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.02)",
                      color: activeSecTeam ? "#60A5FA" : "#334155",
                      border: `1px solid ${activeSecTeam ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.04)"}`,
                      opacity: activeSecTeam ? 1 : 0.4,
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}

            {/* Secondary / non-scoring events */}
            {secondaryActions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {secondaryActions.map((action) => {
                  const isDanger = action.style === "danger";
                  const pbSvc = scoreType === "pickleball_service";
                  const pbRallyLike = scoreType === "pickleball_rally" || scoreType === "pickleball";
                  const allowWithoutTeamTab = (pbSvc
                    && (action.eventType === "fault"
                      || action.eventType === "kitchen_fault"
                      || action.eventType === "switch_serve"))
                    || (pbRallyLike && action.eventType === "switch_serve");
                  const disabledSecondary = addEvent.isPending || (!allowWithoutTeamTab && !activeSecTeam);
                  const actionLooksEnabled = !disabledSecondary;
                  return (
                    <button
                      key={`${action.eventType}-${action.label}`}
                      disabled={disabledSecondary}
                      onClick={() => {
                        if (addEvent.isPending) return;
                        if (pbSvc && (action.eventType === "fault" || action.eventType === "kitchen_fault")) {
                          const srv = (engineState as { serving?: "A" | "B" }).serving ?? "A";
                          scoreTeam(srv === "B" ? teamKeys[1] : teamKeys[0], action);
                          return;
                        }
                        if (action.eventType === "switch_serve" && (pbSvc || pbRallyLike)) {
                          scoreTeam(teamKeys[0], action);
                          return;
                        }
                        if (!activeSecTeam) return;
                        scoreTeam(activeSecTeam, action);
                      }}
                      className="px-3 py-2 active:scale-95 transition-all"
                      style={{
                        borderRadius: "10px",
                        fontSize: "13px",
                        fontWeight: "600",
                        backgroundColor: actionLooksEnabled
                          ? isDanger ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.06)"
                          : "rgba(255,255,255,0.02)",
                        color: actionLooksEnabled
                          ? isDanger ? "#F87171" : "#fff"
                          : "#334155",
                        border: `1px solid ${actionLooksEnabled
                          ? isDanger ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)"
                          : "rgba(255,255,255,0.04)"}`,
                        opacity: actionLooksEnabled ? 1 : 0.4,
                      }}
                    >
                      {action.label}
                    </button>
                  );
                })}
              </div>
            )}

            {!activeSecTeam && !secondaryAnyNoTeamNeeded && (
              <p className="text-[#475569] mt-3 text-center" style={{ fontSize: "12px" }}>
                Select a team above to log an event
              </p>
            )}
            {!activeSecTeam && secondaryAnyNoTeamNeeded && (
              <p className="text-[#475569] mt-3 text-center" style={{ fontSize: "12px" }}>
                {scoreType === "pickleball_service"
                  ? "Fault, kitchen fault, and switch serve work without a team tab; select a team for Ace."
                  : "Switch serve works without a team tab; select a team for Ace, Fault, and Kitchen fault."}
              </p>
            )}
          </div>
        )}

        {/* ── ACTIONS toolbar ── */}
        {canScore && (
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => {
                setScoreInputs({
                  [teamKeys[0]]: String(flatA),
                  [teamKeys[1]]: String(flatB),
                });
                setShowScoreModal(true);
              }}
              className="flex flex-col items-center gap-1 py-3"
              style={{ borderRadius: "12px", backgroundColor: "#1E293B", fontSize: "11px", fontWeight: "600", color: "#94A3B8" }}
            >
              <RotateCcw style={{ width: "16px", height: "16px" }} />
              Edit Score
            </button>

            <button
              onClick={() => { setEventTeam(""); setShowEventModal(true); }}
              className="flex flex-col items-center gap-1 py-3"
              style={{ borderRadius: "12px", backgroundColor: "#1E293B", fontSize: "11px", fontWeight: "600", color: "#3B82F6" }}
            >
              <Plus style={{ width: "16px", height: "16px" }} />
              Custom
            </button>

            <button
              onClick={() => { setResultType(null); setShowEndModal(true); }}
              className="flex flex-col items-center gap-1 py-3"
              style={{ borderRadius: "12px", backgroundColor: "rgba(239,68,68,0.08)", fontSize: "11px", fontWeight: "600", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <Trophy style={{ width: "16px", height: "16px" }} />
              End Match
            </button>
          </div>
        )}

        {/* ── Match info ── */}
        <div className="p-4" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
          <p className="text-white mb-3" style={{ fontSize: "14px", fontWeight: "700" }}>Match Info</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[#64748B]">
              <Activity style={{ width: "13px", height: "13px" }} />
              <span style={{ fontSize: "13px" }}>
                {sport?.displayName ?? sport?.name ?? sportKey} · {match.formatName as string} · {(match.matchType as string) === "COMPETITIVE" ? "Competitive" : "Friendly"}
              </span>
            </div>
            {venue?.name && (
              <div className="flex items-center gap-2 text-[#64748B]">
                <MapPin style={{ width: "13px", height: "13px" }} />
                <span style={{ fontSize: "13px" }}>{venue.name}{venue.location?.city ? `, ${venue.location.city}` : ""}</span>
              </div>
            )}
            {match.matchDate != null && String(match.matchDate) !== "" ? (
              <div className="flex items-center gap-2 text-[#64748B]">
                <Calendar style={{ width: "13px", height: "13px" }} />
                <span style={{ fontSize: "13px" }}>{format(new Date(String(match.matchDate)), "EEE, MMM d")}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* ── Event log ── */}
        <div className="p-4" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
          <p className="text-white mb-3" style={{ fontSize: "14px", fontWeight: "700" }}>
            Event Log
            {allEvents.length > 0 && (
              <span className="text-[#475569] ml-2" style={{ fontSize: "12px", fontWeight: "500" }}>
                {allEvents.length} event{allEvents.length !== 1 ? "s" : ""}
              </span>
            )}
          </p>

          <div className="max-h-52 overflow-y-auto space-y-0">
            {allEvents.length === 0 ? (
              <p className="text-[#475569] text-center py-5" style={{ fontSize: "13px" }}>
                No events yet — start scoring above
              </p>
            ) : (
              allEvents.map((ev, i) => {
                const isA = ev.team === teamKeys[0];
                return (
                  <div
                    key={ev.id ?? `ev-${i}`}
                    className="flex items-center justify-between py-2.5"
                    style={{ borderBottom: i < allEvents.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
                  >
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: "16px" }}>{EVENT_ICONS[ev.eventType] ?? "●"}</span>
                      <div>
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: "700",
                            color: isA ? "#60A5FA" : "#F472B6",
                          }}
                        >
                          {teamNames[ev.team]?.slice(0, 8) ?? ev.team}
                        </span>
                        <span className="text-[#64748B] ml-2" style={{ fontSize: "12px" }}>
                          {ev.eventType.replace(/_/g, " ")}
                        </span>
                        {ev.eventValue > 0 && (
                          <span
                            className="ml-2 px-1.5 py-0.5"
                            style={{ borderRadius: "4px", backgroundColor: "rgba(59,130,246,0.12)", fontSize: "11px", fontWeight: "700", color: "#60A5FA" }}
                          >
                            +{ev.eventValue}
                          </span>
                        )}
                      </div>
                    </div>
                    {ev.eventTimestamp && (
                      <span className="text-[#334155]" style={{ fontSize: "11px" }}>
                        {format(new Date(ev.eventTimestamp), "HH:mm")}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* ══════════════ BOTTOM SHEETS ══════════════ */}

      {/* Edit Score sheet */}
      {showScoreModal && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ backgroundColor: "rgba(0,0,0,0.75)", paddingBottom: "84px" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowScoreModal(false); }}>
          <div className="w-full max-w-md mx-auto" style={{ borderRadius: "24px 24px 0 0", backgroundColor: "#1E293B" }}>
            <div className="p-5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-white" style={{ fontSize: "17px", fontWeight: "800" }}>Edit Score</p>
              <button onClick={() => setShowScoreModal(false)} style={{ fontSize: "20px", color: "#64748B" }}>✕</button>
            </div>
            <div className="p-5 space-y-4">
              {teamKeys.map((key) => (
                <div key={key}>
                  <label className="block text-[#94A3B8] mb-1.5" style={{ fontSize: "12px", fontWeight: "600" }}>
                    {teamNames[key]}
                  </label>
                  <input
                    type="number"
                    value={scoreInputs[key] ?? ""}
                    onChange={(e) => setScoreInputs((s) => ({ ...s, [key]: e.target.value }))}
                    style={{
                      width: "100%", padding: "14px", borderRadius: "12px",
                      backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.08)",
                      color: "#fff", fontSize: "22px", fontWeight: "800", outline: "none", textAlign: "center",
                    }}
                  />
                </div>
              ))}
              <button
                onClick={handleUpdateScore}
                disabled={updateScore.isPending}
                className="w-full py-4"
                style={{ borderRadius: "14px", background: "linear-gradient(135deg,#3B82F6,#2563EB)", fontSize: "15px", fontWeight: "700", color: "#fff" }}
              >
                {updateScore.isPending ? "Saving…" : "Save Score"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Event sheet */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ backgroundColor: "rgba(0,0,0,0.75)", paddingBottom: "84px" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowEventModal(false); }}>
          <div className="w-full max-w-md mx-auto" style={{ borderRadius: "24px 24px 0 0", backgroundColor: "#1E293B" }}>
            <div className="p-5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-white" style={{ fontSize: "17px", fontWeight: "800" }}>Custom Event</p>
              <button onClick={() => setShowEventModal(false)} style={{ fontSize: "20px", color: "#64748B" }}>✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[#94A3B8] mb-1.5" style={{ fontSize: "12px", fontWeight: "600" }}>Team</label>
                <select value={eventTeam} onChange={(e) => setEventTeam(e.target.value)} style={selectSt}>
                  <option value="">Select team…</option>
                  {teamKeys.map((k) => <option key={k} value={k}>{teamNames[k]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[#94A3B8] mb-1.5" style={{ fontSize: "12px", fontWeight: "600" }}>Event</label>
                <select value={eventType} onChange={(e) => setEventType(e.target.value)} style={selectSt}>
                  <option value="point">Point</option>
                  <option value="goal">Goal</option>
                  <option value="foul">Foul</option>
                  <option value="timeout">Timeout</option>
                  <option value="substitution">Substitution</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <button
                onClick={handleAddEvent}
                disabled={addEvent.isPending || !eventTeam}
                className="w-full py-4"
                style={{
                  borderRadius: "14px",
                  background: !eventTeam ? "#0F172A" : "linear-gradient(135deg,#3B82F6,#2563EB)",
                  fontSize: "15px", fontWeight: "700",
                  color: !eventTeam ? "#475569" : "#fff",
                }}
              >
                {addEvent.isPending ? "Adding…" : "Log Event"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Match sheet */}
      {showEndModal && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ backgroundColor: "rgba(0,0,0,0.75)", paddingBottom: "84px" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowEndModal(false); setResultType(null); } }}>
          <div className="w-full max-w-md mx-auto" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>

            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2">
                {resultType && (
                  <button
                    onClick={() => setResultType(null)}
                    style={{ background: "none", border: "none", color: "#64748B", fontSize: "18px", cursor: "pointer", padding: "0 4px" }}
                  >
                    ←
                  </button>
                )}
                <p className="text-white" style={{ fontSize: "16px", fontWeight: "800" }}>
                  {resultType === "winner" ? "Who won?" : resultType === "draw" ? "Confirm Draw" : "End Match"}
                </p>
              </div>
              <button onClick={() => { setShowEndModal(false); setResultType(null); }} style={{ fontSize: "20px", color: "#64748B" }}>✕</button>
            </div>

            <div className="px-4 pt-4 pb-5">
              {/* Final score pill */}
              <div className="flex items-center justify-center gap-3 mb-4 px-3 py-2"
                style={{ borderRadius: "12px", backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <span className="text-white" style={{ fontSize: "15px", fontWeight: "800" }}>{teamNames[teamKeys[0]]}</span>
                <span className="text-white" style={{ fontSize: "18px", fontWeight: "900" }}>{displayForUi.primary}</span>
                <span className="text-white" style={{ fontSize: "15px", fontWeight: "800" }}>{teamNames[teamKeys[1]]}</span>
              </div>

              {/* Step 1 — choose result type */}
              {!resultType && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setResultType("winner")}
                    className="flex flex-col items-center gap-2 py-4"
                    style={{
                      borderRadius: "16px",
                      backgroundColor: "rgba(245,158,11,0.08)",
                      border: "1.5px solid rgba(245,158,11,0.35)",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: "26px" }}>🏆</span>
                    <span style={{ fontSize: "13px", fontWeight: "700", color: "#F59E0B" }}>Declare Winner</span>
                  </button>
                  <button
                    onClick={() => setResultType("draw")}
                    className="flex flex-col items-center gap-2 py-4"
                    style={{
                      borderRadius: "16px",
                      backgroundColor: "rgba(99,102,241,0.08)",
                      border: "1.5px solid rgba(99,102,241,0.35)",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: "26px" }}>🤝</span>
                    <span style={{ fontSize: "13px", fontWeight: "700", color: "#818CF8" }}>It's a Draw</span>
                  </button>
                </div>
              )}

              {/* Step 2a — pick the winning team */}
              {resultType === "winner" && (
                <div className="space-y-2">
                  {teamKeys.map((k) => (
                    <button
                      key={k}
                      onClick={() => handleEndMatch(k)}
                      disabled={updateStatus.isPending}
                      className="w-full py-3 flex items-center justify-center gap-2"
                      style={{
                        borderRadius: "14px",
                        backgroundColor: "rgba(245,158,11,0.08)",
                        border: "1.5px solid rgba(245,158,11,0.35)",
                        fontSize: "15px",
                        fontWeight: "800",
                        color: "#F59E0B",
                      }}
                    >
                      🏆 {teamNames[k]} Wins
                    </button>
                  ))}
                </div>
              )}

              {/* Step 2b — confirm draw */}
              {resultType === "draw" && (
                <div>
                  <p className="text-center mb-3" style={{ fontSize: "13px", color: "#94A3B8" }}>
                    No winner will be recorded. Both teams share the result.
                  </p>
                  <button
                    onClick={() => handleEndMatch(undefined)}
                    disabled={updateStatus.isPending}
                    className="w-full py-3 flex items-center justify-center gap-2"
                    style={{
                      borderRadius: "14px",
                      backgroundColor: "rgba(99,102,241,0.1)",
                      border: "1.5px solid rgba(99,102,241,0.35)",
                      fontSize: "15px",
                      fontWeight: "800",
                      color: "#818CF8",
                    }}
                  >
                    {updateStatus.isPending ? "Ending…" : "🤝 Confirm Draw"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
