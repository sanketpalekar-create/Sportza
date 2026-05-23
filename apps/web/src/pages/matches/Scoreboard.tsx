import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useMatchSocket, MatchEventPayload } from "../../hooks/useMatchSocket";
import { getEngine, normaliseState } from "../../lib/scoring";
import type { ScoreDisplay } from "../../lib/scoring";
import { resolveMatchScoreType } from "../../lib/scoring/matchScoreType";
import {
  formatPickleballServeLine,
  type PickleballServiceState,
} from "../../lib/scoring/engines/pickleball-service";

interface MatchInfo {
  id: number;
  sportName: string;
  scoreType?: string;
  formatName: string;
  status: string;
  teams: Record<string, unknown> | null;
  scores: Record<string, unknown> | null;
  winnerTeam: string | null;
  venue?: { name: string } | null;
}

interface LastEvent {
  team: string;
  eventType: string;
  eventValue: number;
  playerName: string | null;
  at: string;
}

const API_BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:5000/api");

// Resolve team display names from match.teams JSON.
function resolveTeamNames(teams: MatchInfo["teams"] | Record<string, unknown> | null): { team1: string; team2: string } {
  if (!teams) return { team1: "Team A", team2: "Team B" };

  const t = teams as Record<string, unknown>;
  const resolve = (v: unknown, fallback: string): string => {
    if (!v) return fallback;
    if (typeof v === "string") return v;
    return (v as { name?: string }).name ?? fallback;
  };

  if (t.team1 !== undefined) return { team1: resolve(t.team1, "Team A"), team2: resolve(t.team2, "Team B") };
  if (t.A     !== undefined) return { team1: resolve(t.A,     "Team A"), team2: resolve(t.B,     "Team B") };

  const keys = Object.keys(t);
  return {
    team1: keys.length >= 1 ? resolve(t[keys[0]], "Team A") : "Team A",
    team2: keys.length >= 2 ? resolve(t[keys[1]], "Team B") : "Team B",
  };
}

// Resolve player names per team key (A/B) from match.teams JSON.
function resolvePlayerNames(teams: Record<string, unknown> | null): { team1: string[]; team2: string[] } {
  if (!teams) return { team1: [], team2: [] };
  const getPlayers = (v: unknown): string[] => {
    if (!v || typeof v !== "object") return [];
    return (v as { playerNames?: string[] }).playerNames ?? [];
  };
  if (teams.A !== undefined) return { team1: getPlayers(teams.A), team2: getPlayers(teams.B) };
  if (teams.team1 !== undefined) return { team1: getPlayers(teams.team1), team2: getPlayers(teams.team2) };
  const keys = Object.keys(teams);
  return {
    team1: keys.length >= 1 ? getPlayers(teams[keys[0]]) : [],
    team2: keys.length >= 2 ? getPlayers(teams[keys[1]]) : [],
  };
}

// Compute ScoreDisplay from raw scores using the engine.
function computeDisplay(
  rawScores: Record<string, unknown> | null,
  scoreType: string,
  teamNames: { team1: string; team2: string }
): ScoreDisplay {
  const engine = getEngine(scoreType);
  const state  = normaliseState(rawScores, scoreType);
  return engine.display(state, { A: teamNames.team1, B: teamNames.team2 });
}

/** Match LiveMatch: doubles serve line includes (left)/(right). Engine display alone omits court side. */
function enrichScoreboardDisplay(
  display: ScoreDisplay,
  rawScores: Record<string, unknown> | null,
  scoreType: string,
  teamNames: { team1: string; team2: string },
  players: { team1: string[]; team2: string[] },
  isCompleted = false,
): ScoreDisplay {
  if (scoreType !== "pickleball_service" || !rawScores) return display;
  const st = normaliseState(rawScores, scoreType) as PickleballServiceState;
  if (st?.config?.sport !== "pickleball_service") return display;

  // When the match is over (naturally or manually ended) show clean game scores,
  // never the serve-state triple.
  if (st.winner || isCompleted) {
    const gameScores = st.completedGames.map((g) => `${g.A}–${g.B}`).join("  ·  ");
    return {
      ...display,
      primary: `${st.gamesWon.A} – ${st.gamesWon.B}`,
      secondary: gameScores || undefined,
      period: "Final",
      isComplete: true,
    };
  }

  return {
    ...display,
    secondary: formatPickleballServeLine(st, { A: teamNames.team1, B: teamNames.team2 }, players.team1, players.team2),
  };
}

function servingKeyFromDisplayServe(serve: string | undefined): "team1" | "team2" | null {
  if (serve === "A") return "team1";
  if (serve === "B") return "team2";
  return null;
}

// Split "X – Y" primary into [left, right] for the two team panels.
function splitPrimary(primary: string): [string, string] {
  if (primary.includes(" – ")) {
    const parts = primary.split(" – ");
    return [parts[0] ?? "0", parts[1] ?? "0"];
  }
  if (primary === "Deuce") return ["D", "D"];
  if (primary.startsWith("Adv ")) {
    return primary === "Adv A" ? ["ADV", "–"] : ["–", "ADV"];
  }
  return [primary, ""];
}

function eventLabel(type: string): string {
  const map: Record<string, string> = {
    goal: "⚽ Goal",
    point: "🏓 Point",
    ace: "🎾 Ace",
    wicket: "🏏 Wicket",
    six: "🏏 Six",
    four: "🏏 Four",
    basket: "🏀 Basket",
    try: "🏉 Try",
    penalty: "🚫 Penalty",
  };
  return map[type.toLowerCase()] ?? `▪ ${type}`;
}

function statusBadge(status: string) {
  if (status === "live") return { text: "● LIVE", color: "#22c55e" };
  if (status === "completed") return { text: "FINAL", color: "#94a3b8" };
  if (status === "scheduled") return { text: "UPCOMING", color: "#f59e0b" };
  return { text: status.toUpperCase(), color: "#94a3b8" };
}

export default function Scoreboard() {
  const { matchId } = useParams<{ matchId: string }>();
  const id = matchId ? parseInt(matchId, 10) : null;

  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [engineDisplay, setEngineDisplay] = useState<ScoreDisplay>({ primary: "0 – 0", isComplete: false });
  const [matchStatus, setMatchStatus] = useState<string>("scheduled");
  const [lastEvent, setLastEvent] = useState<LastEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const [scoreFlash, setScoreFlash] = useState<"team1" | "team2" | null>(null);
  const [winnerReady, setWinnerReady] = useState(false);
  const [servingKey, setServingKey] = useState<"team1" | "team2" | null>(null);
  const lastEventTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPrimaryRef = useRef<[string, string]>(["0", "0"]);
  // Stable ref so socket callbacks always see the latest match without closing
  // over stale state — avoids calling setState inside another setState updater.
  const matchRef = useRef<MatchInfo | null>(null);

  // Keep ref in sync with state
  useEffect(() => { matchRef.current = match; }, [match]);

  // Fetch (or re-fetch) match data
  const fetchMatch = useCallback((markWinnerReady = false) => {
    if (!id) return;
    fetch(`${API_BASE}/matches/${id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          const m = res.data as MatchInfo;
          const names = resolveTeamNames(m.teams);
          const sType = resolveMatchScoreType(m);
          const players = resolvePlayerNames(m.teams as Record<string, unknown> | null);
          const display = enrichScoreboardDisplay(
            computeDisplay(m.scores, sType, names),
            m.scores,
            sType,
            names,
            players,
            m.status === "completed",
          );
          matchRef.current = m;
          setMatch(m);
          setEngineDisplay(display);
          setMatchStatus(m.status);
          setServingKey(servingKeyFromDisplayServe(display.serve as string | undefined));
          // Mark winner ready whenever the match is completed — covers the case
          // where the onStatus socket event was missed and polling detected it.
          if (markWinnerReady || m.status === "completed") setWinnerReady(true);
        }
      })
      .catch(console.error);
  }, [id]);

  useEffect(() => { fetchMatch(); }, [fetchMatch]);

  // Poll every 1.5 s while live — catches any missed socket events
  useEffect(() => {
    if (matchStatus !== "live") return;
    const interval = setInterval(() => fetchMatch(), 500);
    return () => clearInterval(interval);
  }, [matchStatus, fetchMatch]);

  // Socket handlers
  useMatchSocket({
    matchId: id,
    onScore: (payload) => {
      // Use matchRef so we never call setState inside a setState updater
      // (which React 18 treats as a side-effect and may ignore or double-call).
      const m = matchRef.current;
      if (m) {
        const names = resolveTeamNames(m.teams);
        const sType = resolveMatchScoreType(m);
        const players = resolvePlayerNames(m.teams as Record<string, unknown> | null);
        const display = enrichScoreboardDisplay(
          computeDisplay(payload.scores as Record<string, unknown>, sType, names),
          payload.scores as Record<string, unknown>,
          sType,
          names,
          players,
          matchRef.current?.status === "completed",
        );
        const [nextA, nextB] = splitPrimary(display.primary);
        const [prevA, prevB] = prevPrimaryRef.current;
        if (nextA !== prevA) triggerFlash("team1");
        if (nextB !== prevB) triggerFlash("team2");
        prevPrimaryRef.current = [nextA, nextB];
        setEngineDisplay(display);
        setServingKey(servingKeyFromDisplayServe(display.serve as string | undefined));
      }
      // Update match metadata (winnerTeam, status) cleanly in its own setter
      setMatch((prev) => prev
        ? { ...prev, winnerTeam: payload.winnerTeam ?? prev.winnerTeam, status: payload.status }
        : prev
      );
      setMatchStatus(payload.status);
      setConnected(true);
      if (payload.status === "completed") setWinnerReady(true);
    },
    onEvent: (payload: MatchEventPayload) => {
      const ev = payload.event;
      setLastEvent({
        team: ev.team,
        eventType: ev.eventType,
        eventValue: ev.eventValue,
        playerName: ev.playerName,
        at: new Date(ev.eventTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
      setConnected(true);
      if (lastEventTimer.current) clearTimeout(lastEventTimer.current);
      lastEventTimer.current = setTimeout(() => setLastEvent(null), 8000);
    },
    onStatus: (payload) => {
      setMatchStatus(payload.status);
      setMatch((m) => m ? { ...m, status: payload.status } : m);
      setConnected(true);
      if (payload.status === "completed") fetchMatch(true);
    },
  });

  // Clean up timer on unmount
  useEffect(() => () => { if (lastEventTimer.current) clearTimeout(lastEventTimer.current); }, []);

  function triggerFlash(team: "team1" | "team2") {
    setScoreFlash(team);
    setTimeout(() => setScoreFlash(null), 600);
  }

  if (!match) {
    return (
      <div style={styles.root}>
        <div style={styles.loading}>Loading…</div>
      </div>
    );
  }

  const teamNames = resolveTeamNames(match.teams);
  // Player names for the winner: team1 = index 0, team2 = index 1
  const winnerPlayerNames = match.winnerTeam
    ? (() => {
        const t = match.teams as Record<string, unknown> | null;
        if (!t) return [];
        const keys = Object.keys(t);
        const winnerKey = match.winnerTeam!;
        if (t[winnerKey] !== undefined) return (t[winnerKey] as { playerNames?: string[] })?.playerNames ?? [];
        const idx = winnerKey === "team1" ? 0 : winnerKey === "team2" ? 1 : -1;
        if (idx >= 0 && keys[idx]) return (t[keys[idx]] as { playerNames?: string[] })?.playerNames ?? [];
        return [];
      })()
    : [];
  const badge = statusBadge(matchStatus);
  const isCompleted = matchStatus === "completed";
  const isPickleballService = resolveMatchScoreType(match) === "pickleball_service";

  const [panelA, panelB] = splitPrimary(engineDisplay.primary);

  // Map any raw team key (e.g. "A", "B", "team1") → display name
  function teamLabel(rawKey: string): string {
    if (!match?.teams) return rawKey;
    const t = match.teams as Record<string, unknown>;
    const resolve = (v: unknown, fb: string) =>
      typeof v === "string" ? v : (v as { name?: string })?.name ?? fb;
    if (t[rawKey] !== undefined) return resolve(t[rawKey], rawKey);
    const keys = Object.keys(t);
    return rawKey === keys[0] ? teamNames.team1 : teamNames.team2;
  }

  const winnerName = match.winnerTeam ? teamLabel(match.winnerTeam) : null;

  // Which side is the winner?
  const winnerIsTeam1 = match.winnerTeam
    ? teamLabel(match.winnerTeam) === teamNames.team1
    : null;

  // Panel font size — shrink for longer labels (e.g. "ADV", "Deuce")
  const panelFontSize = (v: string) =>
    v.length > 3 ? "clamp(3rem, 10vw, 12rem)" : "clamp(5rem, 18vw, 20rem)";

  return (
    <div style={styles.root}>
      {/* Venue + Sport header */}
      <div style={styles.header}>
        <span style={styles.sportLabel}>{match.sportName} · {match.formatName}</span>
        {match.venue && <span style={styles.venueLabel}>{match.venue.name}</span>}
      </div>

      {/* Status badge */}
      <div style={{ ...styles.statusBadge, color: badge.color, borderColor: badge.color }}>
        {badge.text}
      </div>

      {/* ── Winner overlay — full-screen result graphic ── */}
      {isCompleted && winnerReady && (
        <div style={styles.winnerOverlay}>
          {/* Radial glow */}
          <div style={styles.winnerGlow} />

          {winnerName ? (
            <>
              <span style={styles.winnerTrophy}>🏆</span>
              <p style={styles.winnerSuperLabel}>WINNER</p>
              <p style={styles.winnerNameLarge}>{winnerName}</p>
              {/* Player names for doubles/team sports */}
              {winnerPlayerNames.length > 1 && (
                <p style={styles.winnerPlayerNames}>
                  {winnerPlayerNames.join("  ·  ")}
                </p>
              )}
              {/* Show games/sets (secondary) as the headline score when available —
                  for manually-ended matches the engine primary shows the in-progress
                  game score which is less meaningful than the games-won tally */}
              <p style={styles.winnerFinalScore}>
                {engineDisplay.secondary ?? engineDisplay.primary}
              </p>
              {engineDisplay.secondary && (
                <p style={styles.winnerSecondary}>{engineDisplay.primary}</p>
              )}
            </>
          ) : (
            <>
              <span style={styles.winnerTrophy}>🤝</span>
              <p style={styles.winnerSuperLabel}>MATCH DRAWN</p>
              <p style={styles.winnerFinalScore}>
                {engineDisplay.secondary ?? engineDisplay.primary}
              </p>
            </>
          )}
        </div>
      )}

      {/* Period / context label (e.g. "Set 2", "Q3", "Game 2") */}
      {engineDisplay.period && (
        <div style={styles.periodLabel}>
          {engineDisplay.period}
        </div>
      )}

      {/* Main scoreboard */}
      <div style={styles.scoreboard}>
        {/* Team 1 */}
        <div style={styles.teamBlock}>
          <div style={{
            ...styles.teamName,
            color: winnerReady && winnerIsTeam1 === true ? "#f59e0b" : "#e2e8f0",
          }}>
            {teamNames.team1}
            {isPickleballService && (
              <div style={{ fontSize: "clamp(0.55rem,1.1vw,0.85rem)", color: "#64748b", marginTop: "6px", fontWeight: "700", letterSpacing: "0.12em" }}>
                LEFT
              </div>
            )}
            {servingKey === "team1" && !isCompleted && (
              <div style={{ fontSize: "clamp(0.7rem,1.5vw,1.1rem)", color: "#F59E0B", marginTop: "4px" }}>
                ● SERVING
              </div>
            )}
          </div>
          <div style={{
            ...styles.score,
            fontSize: panelFontSize(panelA),
            color: scoreFlash === "team1" ? "#22c55e"
              : winnerReady && winnerIsTeam1 === true ? "#f59e0b"
              : "#f8fafc",
            transform: scoreFlash === "team1" ? "scale(1.12)" : "scale(1)",
            transition: "color 0.3s, transform 0.3s",
          }}>
            {panelA}
          </div>
        </div>

        {/* Divider */}
        <div style={styles.divider}>
          {winnerReady && winnerName ? (
            <div style={styles.winnerArrow}>
              {winnerIsTeam1 === true ? "◀" : "▶"}
            </div>
          ) : (
            <div style={styles.vs}>VS</div>
          )}
          {/* Secondary score (e.g. games in set) */}
          {engineDisplay.secondary && (
            <div style={styles.secondaryScore}>{engineDisplay.secondary}</div>
          )}
          {/* Tertiary score (e.g. sets won) */}
          {engineDisplay.tertiary && (
            <div style={styles.tertiaryScore}>{engineDisplay.tertiary}</div>
          )}
        </div>

        {/* Team 2 */}
        <div style={styles.teamBlock}>
          <div style={{
            ...styles.teamName,
            color: winnerReady && winnerIsTeam1 === false ? "#f59e0b" : "#e2e8f0",
          }}>
            {teamNames.team2}
            {isPickleballService && (
              <div style={{ fontSize: "clamp(0.55rem,1.1vw,0.85rem)", color: "#64748b", marginTop: "6px", fontWeight: "700", letterSpacing: "0.12em" }}>
                RIGHT
              </div>
            )}
            {servingKey === "team2" && !isCompleted && (
              <div style={{ fontSize: "clamp(0.7rem,1.5vw,1.1rem)", color: "#F59E0B", marginTop: "4px" }}>
                ● SERVING
              </div>
            )}
          </div>
          <div style={{
            ...styles.score,
            fontSize: panelFontSize(panelB),
            color: scoreFlash === "team2" ? "#22c55e"
              : winnerReady && winnerIsTeam1 === false ? "#f59e0b"
              : "#f8fafc",
            transform: scoreFlash === "team2" ? "scale(1.12)" : "scale(1)",
            transition: "color 0.3s, transform 0.3s",
          }}>
            {panelB}
          </div>
        </div>
      </div>

      {/* Last event strip — hidden when completed */}
      {!isCompleted && (
        <div style={{ ...styles.eventStrip, opacity: lastEvent ? 1 : 0, transition: "opacity 0.5s" }}>
          {lastEvent && (
            <>
              <span style={styles.eventTag}>{eventLabel(lastEvent.eventType)}</span>
              {lastEvent.playerName && (
                <span style={styles.eventPlayer}>{lastEvent.playerName}</span>
              )}
              <span style={styles.eventTeam}>
                {teamLabel(lastEvent.team)}
              </span>
              <span style={styles.eventTime}>{lastEvent.at}</span>
            </>
          )}
        </div>
      )}

      {/* Connection indicator (subtle, bottom-right) */}
      <div style={styles.connDot} title={connected ? "Live" : "Connecting…"}>
        <div style={{ ...styles.dot, background: connected ? "#22c55e" : "#f59e0b" }} />
      </div>

      {/* QR hint — bottom center, very subtle */}
      <div style={styles.qrHint}>
        sportza.app · Match #{match.id}
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
// Inline styles intentional — scoreboard is a standalone fullscreen page
// loaded on a TV/kiosk with no layout wrapper, no Tailwind purging issues.

const styles: Record<string, React.CSSProperties> = {
  root: {
    background: "#0a0f1a",
    minHeight: "100vh",
    width: "100vw",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    color: "#f8fafc",
    position: "relative",
    overflow: "hidden",
    padding: "0",
    margin: "0",
  },
  loading: {
    fontSize: "2rem",
    color: "#64748b",
    letterSpacing: "0.1em",
  },
  header: {
    position: "absolute",
    top: "2rem",
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "center",
    gap: "1.5rem",
    alignItems: "center",
  },
  sportLabel: {
    fontSize: "clamp(0.9rem, 2vw, 1.4rem)",
    color: "#94a3b8",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    fontWeight: 500,
  },
  venueLabel: {
    fontSize: "clamp(0.8rem, 1.5vw, 1.1rem)",
    color: "#475569",
    letterSpacing: "0.05em",
  },
  statusBadge: {
    position: "absolute",
    top: "5rem",
    fontSize: "clamp(0.75rem, 1.5vw, 1rem)",
    fontWeight: 700,
    letterSpacing: "0.2em",
    border: "1.5px solid",
    borderRadius: "999px",
    padding: "0.25rem 1rem",
  },
  scoreboard: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: "clamp(2rem, 6vw, 8rem)",
    width: "100%",
    padding: "0 4vw",
  },
  teamBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1.5rem",
    flex: 1,
    maxWidth: "38vw",
  },
  teamName: {
    fontSize: "clamp(1.5rem, 4vw, 4rem)",
    fontWeight: 700,
    color: "#e2e8f0",
    textAlign: "center",
    letterSpacing: "0.02em",
    lineHeight: 1.1,
    textTransform: "uppercase",
  },
  score: {
    fontSize: "clamp(5rem, 18vw, 20rem)",
    fontWeight: 900,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "-0.02em",
  },
  divider: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    flexShrink: 0,
  },
  vs: {
    fontSize: "clamp(1rem, 3vw, 3rem)",
    color: "#334155",
    fontWeight: 800,
    letterSpacing: "0.1em",
  },
  winnerLabel: {
    fontSize: "clamp(0.8rem, 1.8vw, 1.5rem)",
    color: "#22c55e",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  winnerArrow: {
    fontSize: "clamp(1.2rem, 3vw, 3rem)",
    color: "#f59e0b",
    fontWeight: 800,
  },
  periodLabel: {
    position: "absolute" as const,
    top: "7.5rem",
    fontSize: "clamp(0.75rem, 1.5vw, 1.1rem)",
    fontWeight: 700,
    color: "#3b82f6",
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
  },
  secondaryScore: {
    fontSize: "clamp(0.9rem, 2vw, 1.8rem)",
    fontWeight: 700,
    color: "#f59e0b",
    letterSpacing: "0.06em",
    textAlign: "center" as const,
    marginTop: "0.5rem",
  },
  tertiaryScore: {
    fontSize: "clamp(0.7rem, 1.4vw, 1.2rem)",
    fontWeight: 600,
    color: "#64748b",
    letterSpacing: "0.08em",
    textAlign: "center" as const,
  },
  winnerOverlay: {
    position: "absolute" as const,
    inset: 0,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: "clamp(0.4rem, 1.8vh, 1.4rem)",
    background: "rgba(9,15,29,0.88)",
    backdropFilter: "blur(6px)",
    zIndex: 30,
  },
  winnerGlow: {
    position: "absolute" as const,
    width: "60vw",
    height: "60vw",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(245,158,11,0.22) 0%, transparent 70%)",
    pointerEvents: "none" as const,
  },
  winnerTrophy: {
    fontSize: "clamp(3rem, 9vw, 8rem)",
    lineHeight: 1,
    filter: "drop-shadow(0 0 32px rgba(245,158,11,0.95))",
    zIndex: 1,
  },
  winnerSuperLabel: {
    fontSize: "clamp(0.8rem, 2.2vw, 1.6rem)",
    fontWeight: 900,
    color: "#F59E0B",
    letterSpacing: "0.3em",
    textTransform: "uppercase" as const,
    zIndex: 1,
    margin: 0,
  },
  winnerNameLarge: {
    fontSize: "clamp(2rem, 7vw, 7rem)",
    fontWeight: 900,
    color: "#FFFFFF",
    letterSpacing: "0.02em",
    textTransform: "uppercase" as const,
    textShadow: "0 0 80px rgba(245,158,11,0.55), 0 4px 32px rgba(0,0,0,0.6)",
    lineHeight: 1,
    zIndex: 1,
    margin: 0,
  },
  winnerFinalScore: {
    fontSize: "clamp(1.2rem, 4vw, 3.5rem)",
    fontWeight: 700,
    color: "#F59E0B",
    letterSpacing: "0.1em",
    zIndex: 1,
    margin: 0,
  },
  winnerPlayerNames: {
    fontSize: "clamp(0.9rem, 2.4vw, 2rem)",
    fontWeight: 600,
    color: "#CBD5E1",
    letterSpacing: "0.04em",
    zIndex: 1,
    margin: "0 0 8px 0",
    textAlign: "center" as const,
  },
  winnerSecondary: {
    fontSize: "clamp(0.75rem, 1.8vw, 1.4rem)",
    fontWeight: 600,
    color: "#94A3B8",
    letterSpacing: "0.06em",
    zIndex: 1,
    margin: 0,
  },
  eventStrip: {
    position: "absolute",
    bottom: "6rem",
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "1rem",
    padding: "0.75rem 2rem",
    background: "rgba(255,255,255,0.04)",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    flexWrap: "wrap",
  },
  eventTag: {
    fontSize: "clamp(0.9rem, 2vw, 1.5rem)",
    fontWeight: 700,
    color: "#f8fafc",
    letterSpacing: "0.04em",
  },
  eventPlayer: {
    fontSize: "clamp(0.85rem, 1.8vw, 1.3rem)",
    color: "#94a3b8",
    fontWeight: 500,
  },
  eventTeam: {
    fontSize: "clamp(0.75rem, 1.4vw, 1rem)",
    color: "#475569",
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  eventTime: {
    fontSize: "clamp(0.7rem, 1.2vw, 0.9rem)",
    color: "#334155",
  },
  connDot: {
    position: "absolute",
    bottom: "1.5rem",
    right: "2rem",
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
  },
  dot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    transition: "background 0.5s",
  },
  qrHint: {
    position: "absolute",
    bottom: "1.5rem",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: "clamp(0.65rem, 1vw, 0.85rem)",
    color: "#1e293b",
    letterSpacing: "0.08em",
  },
};
