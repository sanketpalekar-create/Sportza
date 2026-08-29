import type {
  ScoringEngine, MatchConfig, ScoreDisplay,
  ScoringAction, SecondaryAction, ConfigOption,
} from "../types";

export interface PickleballRallyConfig extends MatchConfig {
  sport: "pickleball_rally";
  games: number;
  pointsToWin: number;
  winBy: number;
  /** Doubles enables court setup (who starts on the right per team) */
  doubles: boolean;
  /** Which team serves first — chosen in court setup, defaults to A */
  firstServeTeam: "A" | "B";
}

export interface PickleballRallyState {
  config: PickleballRallyConfig;
  gamesWon: { A: number; B: number };
  completedGames: Array<{ A: number; B: number }>;
  currentGame: { A: number; B: number };
  serving: "A" | "B";
  /** Which player (0 or 1) is currently serving for the serving team */
  currentServerPlayerIndex: 0 | 1;
  /** Which player index starts on the right (even side) at score 0 for each team */
  starterRightPlayerIndex: { A: 0 | 1; B: 0 | 1 };
  /**
   * How many points each team has scored WHILE they were the serving team.
   * This — not total score — determines physical side positions, because sides
   * only swap when the serving team wins a rally, not on receiving wins.
   */
  servingScoreIndex: { A: number; B: number };
  winner: "A" | "B" | null;
  /** Doubles: false until skip or lock setup */
  setupComplete: boolean;
  /** Doubles: tracks which teams have confirmed their starting right player */
  setupBaselineAck: { A: boolean; B: boolean };
  /**
   * True after Lock setup (configure path). False after Skip — no player/side
   * labels in the serve line.
   */
  trackPositions: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns the player index (0|1) that is on the RIGHT side given the serving-score index. */
function rightPlayerAtTeamScore(starterRight: 0 | 1, teamScore: number): 0 | 1 {
  return (teamScore % 2 === 0 ? starterRight : (starterRight === 0 ? 1 : 0)) as 0 | 1;
}

/**
 * Derive which player is currently serving for `team`.
 * Uses `servingScoreIndex` (not total score) because physical sides only
 * swap when a team scores WHILE SERVING.
 */
function deriveServerPlayerIndex(s: PickleballRallyState, team: "A" | "B"): 0 | 1 {
  const ssi = s.servingScoreIndex[team];
  const starterRight = s.starterRightPlayerIndex[team];
  const rightPlayer = rightPlayerAtTeamScore(starterRight, ssi);
  return (ssi % 2 === 0 ? rightPlayer : ((1 - rightPlayer) as 0 | 1));
}

function maybeEndGame(s: PickleballRallyState): void {
  const a = s.currentGame.A;
  const b = s.currentGame.B;
  const { pointsToWin, winBy } = s.config;
  let gameWinner: "A" | "B" | null = null;
  if (a >= pointsToWin && a - b >= winBy) gameWinner = "A";
  else if (b >= pointsToWin && b - a >= winBy) gameWinner = "B";
  if (!gameWinner) return;

  s.gamesWon[gameWinner]++;
  s.completedGames.push({ A: a, B: b });

  const needed = Math.ceil(s.config.games / 2);
  if (s.gamesWon[gameWinner] >= needed) {
    s.winner = gameWinner;
    return;
  }

  // Start next game — loser of previous game serves first; positions carry over.
  // Initial setup only — never re-gate between games (skip or configure).
  s.currentGame = { A: 0, B: 0 };
  s.servingScoreIndex = { A: 0, B: 0 };
  const loser: "A" | "B" = gameWinner === "A" ? "B" : "A";
  s.serving = loser;
  s.setupComplete = true;
  s.currentServerPlayerIndex = deriveServerPlayerIndex(s, loser);
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export const pickleballRallyEngine: ScoringEngine<PickleballRallyState> = {
  init(config: MatchConfig): PickleballRallyState {
    const fst = (config.firstServeTeam === "B" ? "B" : "A") as "A" | "B";
    const doubles = config.doubles !== false;
    const cfg: PickleballRallyConfig = {
      ...(config as object),
      sport: "pickleball_rally",
      games: Number((config as MatchConfig).games) || 3,
      pointsToWin: Number((config as MatchConfig).pointsToWin) || 11,
      winBy: 2,
      doubles,
      firstServeTeam: fst,
    };
    const starter: { A: 0 | 1; B: 0 | 1 } = {
      A: (Number(config.starterRightA) === 1 ? 1 : 0) as 0 | 1,
      B: (Number(config.starterRightB) === 1 ? 1 : 0) as 0 | 1,
    };
    const state: PickleballRallyState = {
      config: cfg,
      gamesWon: { A: 0, B: 0 },
      completedGames: [],
      currentGame: { A: 0, B: 0 },
      serving: fst,
      currentServerPlayerIndex: starter[fst],
      starterRightPlayerIndex: starter,
      servingScoreIndex: { A: 0, B: 0 },
      winner: null,
      setupComplete: !doubles,
      setupBaselineAck: doubles ? { A: false, B: false } : { A: true, B: true },
      trackPositions: false,
    };
    return state;
  },

  applyEvent(
    state: PickleballRallyState,
    team: "A" | "B",
    eventType: string,
  ): PickleballRallyState {
    if (state.winner) return state;

    const s = structuredClone(state) as PickleballRallyState;
    // Back-compat: older saved states may not have this field yet.
    if (!s.servingScoreIndex) s.servingScoreIndex = { A: 0, B: 0 };

    // ── Setup events ──────────────────────────────────────────────────────────

    if (eventType === "set_starter_right_0" || eventType === "set_starter_right_1") {
      const side = team;
      const val = (eventType === "set_starter_right_1" ? 1 : 0) as 0 | 1;
      s.starterRightPlayerIndex[side] = val;
      s.setupBaselineAck[side] = true;
      if (s.serving === side) {
        s.currentServerPlayerIndex = deriveServerPlayerIndex(s, side);
      }
      return s;
    }

    if (eventType === "confirm_setup") {
      if (s.config.doubles && (!s.setupBaselineAck.A || !s.setupBaselineAck.B)) {
        return state;
      }
      s.setupComplete = true;
      s.trackPositions = true;
      s.currentServerPlayerIndex = deriveServerPlayerIndex(s, s.serving);
      return s;
    }

    if (eventType === "skip_setup") {
      s.setupComplete = true;
      s.trackPositions = false;
      return s;
    }

    if (eventType === "swap_starter_right") {
      s.starterRightPlayerIndex[team] = (s.starterRightPlayerIndex[team] === 0 ? 1 : 0) as 0 | 1;
      if (s.serving === team) {
        s.currentServerPlayerIndex = deriveServerPlayerIndex(s, team);
      }
      return s;
    }

    if (eventType === "switch_serve") {
      const next: "A" | "B" = s.serving === "A" ? "B" : "A";
      s.serving = next;
      s.currentServerPlayerIndex = deriveServerPlayerIndex(s, next);
      return s;
    }

    // ── Rally events ─────────────────────────────────────────────────────────

    if (!s.setupComplete) return state;

    if (eventType === "point" || eventType === "rally" || eventType === "ace") {
      // The winning team scores.
      const wasServing = s.serving === team;
      s.currentGame[team]++;
      s.serving = team;
      // Only increment servingScoreIndex (swap sides) when the team was ALREADY serving.
      if (wasServing) s.servingScoreIndex[team]++;
      s.currentServerPlayerIndex = deriveServerPlayerIndex(s, team);
      maybeEndGame(s);
      return s;
    }

    if (eventType === "fault" || eventType === "kitchen_fault") {
      // Serving team faults → receiving team scores and gets serve.
      // Receiving team's servingScoreIndex does NOT change — no position swap.
      const recv: "A" | "B" = s.serving === "A" ? "B" : "A";
      s.currentGame[recv]++;
      s.serving = recv;
      s.currentServerPlayerIndex = deriveServerPlayerIndex(s, recv);
      maybeEndGame(s);
      return s;
    }

    return state;
  },

  display(
    state: PickleballRallyState,
    teamNames: Record<"A" | "B", string>,
  ): ScoreDisplay {
    const gameNum = state.completedGames.length + 1;

    if (state.winner) {
      return {
        primary: `${state.gamesWon.A} – ${state.gamesWon.B}`,
        secondary: state.completedGames.map((g) => `${g.A}-${g.B}`).join(", "),
        period: "Final",
        winner: state.winner,
        isComplete: true,
      };
    }

    const ssi = state.servingScoreIndex ?? { A: 0, B: 0 };
    const srv = state.serving;
    const recv: "A" | "B" = srv === "A" ? "B" : "A";
    const teamLabel = teamNames[srv] ?? srv;

    let secondary: string;
    if (state.config.doubles && !state.trackPositions) {
      secondary = `${state.currentGame[srv]}–${state.currentGame[recv]} · ${teamLabel}`;
    } else {
      // Doubles: physical sides only swap on service wins → use servingScoreIndex.
      // Singles: no partner; serve side is always even=right / odd=left by total score.
      const court = state.config.doubles
        ? (ssi[srv] % 2 === 0 ? "right" : "left")
        : (state.currentGame[srv] % 2 === 0 ? "right" : "left");
      secondary = state.config.doubles
        ? `${state.currentGame[srv]}–${state.currentGame[recv]} · P${state.currentServerPlayerIndex + 1} (${court}) · ${teamLabel}`
        : `${state.currentGame[srv]}–${state.currentGame[recv]} · ${teamLabel} (${court})`;
    }

    return {
      primary: `${state.currentGame.A} – ${state.currentGame.B}`,
      secondary,
      tertiary: state.gamesWon.A + state.gamesWon.B > 0
        ? `${state.gamesWon.A} – ${state.gamesWon.B} games`
        : undefined,
      period: `Game ${gameNum}`,
      isComplete: false,
      serve: srv,
    };
  },

  getActions(state: PickleballRallyState): ScoringAction[] {
    if (state.winner) return [];
    if (!state.setupComplete) {
      if (state.config.doubles && (!state.setupBaselineAck.A || !state.setupBaselineAck.B)) {
        return [];
      }
      return [{ label: "Lock setup & begin", eventType: "confirm_setup", value: 0, style: "primary" }];
    }
    return [{ label: "Point / Rally", eventType: "point", value: 1, style: "primary" }];
  },

  getSecondaryActions(state: PickleballRallyState): SecondaryAction[] {
    if (state.winner) return [];
    if (!state.setupComplete) return [];
    return [
      { label: "Ace", eventType: "ace", value: 1, style: "secondary" },
      { label: "Fault", eventType: "fault", value: 0, style: "danger", team: "both" },
      { label: "Kitchen fault", eventType: "kitchen_fault", value: 0, style: "danger", team: "both" },
      { label: "Switch serve (fix)", eventType: "switch_serve", value: 0, style: "secondary" },
    ];
  },

  isComplete(state: PickleballRallyState): boolean {
    return state.winner !== null;
  },

  configOptions(): ConfigOption[] {
    return [
      {
        key: "games",
        label: "Games",
        type: "select",
        options: [
          { value: 1, label: "Best of 1" },
          { value: 3, label: "Best of 3" },
          { value: 5, label: "Best of 5" },
        ],
        default: 3,
      },
      {
        key: "pointsToWin",
        label: "Points to win",
        type: "select",
        options: [
          { value: 11, label: "11 (standard)" },
          { value: 15, label: "15" },
          { value: 21, label: "21" },
        ],
        default: 11,
      },
      {
        key: "doubles",
        label: "Doubles",
        type: "toggle",
        default: true,
      },
      {
        key: "firstServeTeam",
        label: "First serve (game 1)",
        type: "select",
        options: [
          { value: "A", label: "Team A" },
          { value: "B", label: "Team B" },
        ],
        default: "A",
      },
    ];
  },
};

// ─── Serve-line formatter (used by LiveMatch to inject real player names) ─────

/**
 * Returns the "ready server" for a team — the player who would serve next
 * if that team were to get/keep the serve, based on their servingScoreIndex.
 */
function readyServer(
  ssi: number,
  starterRight: 0 | 1,
  players: string[],
): { name: string; side: "right" | "left" } {
  const rightIdx = rightPlayerAtTeamScore(starterRight, ssi);
  const serverIdx: 0 | 1 = ssi % 2 === 0 ? rightIdx : ((1 - rightIdx) as 0 | 1);
  const side: "right" | "left" = ssi % 2 === 0 ? "right" : "left";
  return { name: players[serverIdx] ?? `P${serverIdx + 1}`, side };
}

export function formatPickleballRallyServeLine(
  state: PickleballRallyState,
  names: { A: string; B: string },
  playersA: string[],
  playersB: string[],
): string {
  const ssi = state.servingScoreIndex ?? { A: 0, B: 0 };
  const srv = state.serving;
  const recv: "A" | "B" = srv === "A" ? "B" : "A";

  // Skip path: scores + serving team only — no player name or side.
  if (state.config.doubles && !state.trackPositions) {
    return `${state.currentGame[srv]}–${state.currentGame[recv]} · ${names[srv] ?? srv}`;
  }

  const srvInfo  = readyServer(ssi[srv],  state.starterRightPlayerIndex[srv],  srv  === "A" ? playersA : playersB);
  const recvInfo = readyServer(ssi[recv], state.starterRightPlayerIndex[recv], recv === "A" ? playersA : playersB);

  // Serving team shown first with ► marker; receiving team shown second.
  return `${names[srv]}►: ${srvInfo.name} (${srvInfo.side})  ·  ${names[recv]}: ${recvInfo.name} (${recvInfo.side})`;
}
