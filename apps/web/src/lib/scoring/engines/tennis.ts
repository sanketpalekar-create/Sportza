import type {
  ScoringEngine, MatchConfig, ScoreDisplay,
  ScoringAction, SecondaryAction, ConfigOption,
} from "../types";

// ─── State ────────────────────────────────────────────────────────────────────

export interface TennisConfig extends MatchConfig {
  sport: "tennis";
  /** Total sets in the match — must be odd (1, 3, 5) */
  sets: number;
  /** Games needed to win a set (standard = 6) */
  gamesPerSet: number;
  /** Allow deuce/advantage? */
  deuce: boolean;
  /** Use tiebreak at 6-6? */
  tiebreak: boolean;
  /** Final set tiebreak (match tiebreak to 10) instead of full set */
  finalSetTiebreak: boolean;
}

export interface TennisState {
  config: TennisConfig;
  /** Sets won by each team */
  setsWon: { A: number; B: number };
  /** Each completed set's game score */
  completedSets: Array<{ A: number; B: number }>;
  /** Games in the current set */
  currentSet: { A: number; B: number };
  /** Raw point counts in the current game (or tiebreak) */
  currentGame: { A: number; B: number };
  /** "game" | "tiebreak" | "matchtiebreak" */
  phase: "game" | "tiebreak" | "matchtiebreak";
  /** Which team is currently serving */
  serving: "A" | "B";
  winner: "A" | "B" | null;
}

// ─── Point-to-display mapping ─────────────────────────────────────────────────

const POINT_LABELS = ["0", "15", "30", "40"];

function gameDisplay(a: number, b: number): string {
  if (a <= 3 && b <= 3 && !(a === 3 && b === 3)) {
    return `${POINT_LABELS[a]} – ${POINT_LABELS[b]}`;
  }
  if (a === b) return "Deuce";
  if (a > b) return "Adv A";
  return "Adv B";
}

// ─── Serve inference ──────────────────────────────────────────────────────────

export function inferTennisServe(state: TennisState): "A" | "B" {
  const totalGames = state.completedSets.reduce((n, s) => n + s.A + s.B, 0)
                   + state.currentSet.A + state.currentSet.B;
  const base: "A" | "B" = totalGames % 2 === 0 ? "A" : "B";
  if (state.phase === "tiebreak" || state.phase === "matchtiebreak") {
    const tbPts = state.currentGame.A + state.currentGame.B;
    const switches = Math.floor((tbPts + 1) / 2);
    return switches % 2 === 0 ? base : (base === "A" ? "B" : "A");
  }
  return base;
}

// ─── Engine logic ─────────────────────────────────────────────────────────────

function setsToWin(cfg: TennisConfig): number {
  return Math.ceil(cfg.sets / 2);
}

function isFinalSet(state: TennisState): boolean {
  return (state.setsWon.A + state.setsWon.B) === (state.config.sets - 1);
}

function applyPoint(state: TennisState, team: "A" | "B"): TennisState {
  if (state.winner) return state;

  const opp: "A" | "B" = team === "A" ? "B" : "A";
  let s = structuredClone(state);

  // ── Tiebreak / match-tiebreak ────────────────────────────────────────────
  if (s.phase === "tiebreak" || s.phase === "matchtiebreak") {
    const target = s.phase === "matchtiebreak" ? 10 : 7;
    s.currentGame[team]++;
    const a = s.currentGame.A, b = s.currentGame.B;
    const lead = Math.abs(a - b);
    const winner = a >= target && lead >= 2 ? "A" : b >= target && lead >= 2 ? "B" : null;
    if (winner) {
      s = winGame(s, winner);
    }
    return s;
  }

  // ── Normal game ───────────────────────────────────────────────────────────
  const cfg = s.config;
  s.currentGame[team]++;
  const a = s.currentGame.A, b = s.currentGame.B;

  let gameWinner: "A" | "B" | null = null;

  if (cfg.deuce) {
    if (a >= 4 && b < 3) gameWinner = "A";
    else if (b >= 4 && a < 3) gameWinner = "B";
    else if (a >= 4 && b >= 3 && a - b >= 2) gameWinner = "A";
    else if (b >= 4 && a >= 3 && b - a >= 2) gameWinner = "B";
  } else {
    if (a >= 4 && a > b) gameWinner = "A";
    else if (b >= 4 && b > a) gameWinner = "B";
  }

  if (gameWinner) {
    s = winGame(s, gameWinner);
  }
  return s;
}

function winGame(state: TennisState, team: "A" | "B"): TennisState {
  const opp: "A" | "B" = team === "A" ? "B" : "A";
  const s = structuredClone(state);
  s.currentGame = { A: 0, B: 0 };
  s.currentSet[team]++;

  const setA = s.currentSet.A, setB = s.currentSet.B;
  const cfg = s.config;

  // Determine if this set is won
  let setWinner: "A" | "B" | null = null;
  const finalSet = isFinalSet(s);

  if (finalSet && cfg.finalSetTiebreak) {
    // Final set is decided by a match tiebreak — handled above, so we just record it
    setWinner = team;
  } else {
    const target = cfg.gamesPerSet;
    const teamGames = s.currentSet[team];
    const oppGames = s.currentSet[opp];

    if (teamGames >= target && teamGames - oppGames >= 2) {
      setWinner = team;
    } else if (teamGames === target + 1 && oppGames === target) {
      // 7-5 style win (no tiebreak scenario)
      setWinner = team;
    } else if (teamGames === target && oppGames === target && cfg.tiebreak) {
      // 6-6 → start tiebreak; serve alternates after each game
      s.serving = s.serving === "A" ? "B" : "A";
      s.phase = "tiebreak";
      return s;
    }
  }

  if (setWinner) {
    s.setsWon[setWinner]++;
    s.completedSets.push({ A: s.currentSet.A, B: s.currentSet.B });
    s.currentSet = { A: 0, B: 0 };
    s.phase = "game";

    const needed = setsToWin(cfg);
    if (s.setsWon[setWinner] >= needed) {
      s.winner = setWinner;
    } else if (isFinalSet(s) && cfg.finalSetTiebreak) {
      s.phase = "matchtiebreak";
      s.currentGame = { A: 0, B: 0 };
    }
  }

  // Toggle serve after every game (including after a set)
  s.serving = s.serving === "A" ? "B" : "A";
  return s;
}

// ─── ScoringEngine implementation ─────────────────────────────────────────────

export const tennisEngine: ScoringEngine<TennisState> = {
  init(config: MatchConfig): TennisState {
    const cfg: TennisConfig = {
      sets: 3,
      gamesPerSet: 6,
      deuce: true,
      tiebreak: true,
      finalSetTiebreak: false,
      ...config,
      sport: "tennis",
    };
    return {
      config: cfg,
      setsWon: { A: 0, B: 0 },
      completedSets: [],
      currentSet: { A: 0, B: 0 },
      currentGame: { A: 0, B: 0 },
      phase: "game",
      serving: "A",
      winner: null,
    };
  },

  applyEvent(state: TennisState, team: "A" | "B", eventType: string): TennisState {
    if (state.winner) return state;
    switch (eventType) {
      case "point":
      case "ace":
      case "winner":
      case "forced_error":
        return applyPoint(state, team);
      case "double_fault": {
        const opp: "A" | "B" = team === "A" ? "B" : "A";
        return applyPoint(state, opp);
      }
      case "switch_serve":
        return { ...structuredClone(state), serving: state.serving === "A" ? "B" : "A" };
      case "undo":
        return state; // handled externally via snapshot
      default:
        return state;
    }
  },

  display(state: TennisState, _teamNames: Record<"A" | "B", string>): ScoreDisplay {
    if (state.winner) {
      return {
        primary: `${state.setsWon.A} – ${state.setsWon.B}`,
        secondary: state.completedSets.map((s) => `${s.A}-${s.B}`).join(", "),
        period: "Final",
        winner: state.winner,
        isComplete: true,
      };
    }

    let primary: string;
    let period: string;

    if (state.phase === "tiebreak") {
      primary = `${state.currentGame.A} – ${state.currentGame.B}`;
      period = `Tiebreak · Set ${state.completedSets.length + 1}`;
    } else if (state.phase === "matchtiebreak") {
      primary = `${state.currentGame.A} – ${state.currentGame.B}`;
      period = "Match Tiebreak";
    } else {
      primary = gameDisplay(state.currentGame.A, state.currentGame.B);
      period = `Set ${state.completedSets.length + 1}`;
    }

    return {
      primary,
      secondary: `${state.currentSet.A} – ${state.currentSet.B}`,
      tertiary: state.setsWon.A + state.setsWon.B > 0
        ? `${state.setsWon.A} – ${state.setsWon.B}`
        : undefined,
      period,
      isComplete: false,
      serve: state.serving,
    };
  },

  getActions(_state: TennisState): ScoringAction[] {
    return [
      { label: "Point", eventType: "point", value: 1, style: "primary" },
    ];
  },

  getSecondaryActions(_state: TennisState): SecondaryAction[] {
    return [
      { label: "Ace", eventType: "ace", value: 1, style: "secondary" },
      { label: "Winner", eventType: "winner", value: 1, style: "secondary" },
      { label: "Double Fault", eventType: "double_fault", value: 0, style: "danger" },
      { label: "Switch Serve", eventType: "switch_serve", value: 0, style: "secondary" },
    ];
  },

  isComplete(state: TennisState): boolean {
    return state.winner !== null;
  },

  configOptions(): ConfigOption[] {
    return [
      {
        key: "sets",
        label: "Sets",
        type: "select",
        options: [
          { value: 1, label: "Best of 1" },
          { value: 3, label: "Best of 3" },
          { value: 5, label: "Best of 5" },
        ],
        default: 3,
      },
      {
        key: "deuce",
        label: "Deuce Rule",
        type: "toggle",
        default: true,
      },
      {
        key: "tiebreak",
        label: "Tiebreak at 6-6",
        type: "toggle",
        default: true,
      },
      {
        key: "finalSetTiebreak",
        label: "Final Set Match Tiebreak",
        type: "toggle",
        default: false,
      },
    ];
  },
};
