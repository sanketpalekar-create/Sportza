import type {
  ScoringEngine, MatchConfig, ScoreDisplay,
  ScoringAction, SecondaryAction, ConfigOption,
} from "../types";

export interface TableTennisConfig extends MatchConfig {
  sport: "tabletennis";
  games: number;
  pointsToWin: number;
  winBy: number;
}

export interface TableTennisState {
  config: TableTennisConfig;
  gamesWon: { A: number; B: number };
  completedGames: Array<{ A: number; B: number }>;
  currentGame: { A: number; B: number };
  serving: "A" | "B";
  serveCount: number;
  winner: "A" | "B" | null;
}

// ─── Serve inference ──────────────────────────────────────────────────────────

export function inferTTServe(state: TableTennisState): "A" | "B" {
  const gamesPlayed = state.gamesWon.A + state.gamesWon.B;
  const gameStart: "A" | "B" = gamesPlayed % 2 === 0 ? "A" : "B";
  const a = state.currentGame.A, b = state.currentGame.B;
  const { pointsToWin } = state.config;
  const deuce = a >= pointsToWin - 1 && b >= pointsToWin - 1;
  if (deuce) {
    const deuceExtra = (a + b) - 2 * (pointsToWin - 1);
    return deuceExtra % 2 === 0 ? gameStart : (gameStart === "A" ? "B" : "A");
  }
  const blocks = Math.floor((a + b) / 2);
  return blocks % 2 === 0 ? gameStart : (gameStart === "A" ? "B" : "A");
}

// ─── Point application ────────────────────────────────────────────────────────

function applyPoint(state: TableTennisState, team: "A" | "B"): TableTennisState {
  const s = structuredClone(state);
  s.currentGame[team]++;
  s.serveCount++;

  const a = s.currentGame.A, b = s.currentGame.B;
  const { pointsToWin, winBy } = s.config;

  const deuce = a >= pointsToWin - 1 && b >= pointsToWin - 1;
  if (deuce) {
    s.serving = s.currentGame.A > s.currentGame.B ? "B" : "A";
  } else if (s.serveCount % 2 === 0) {
    s.serving = s.serving === "A" ? "B" : "A";
  }

  let gameWinner: "A" | "B" | null = null;
  if (a >= pointsToWin && a - b >= winBy) gameWinner = "A";
  else if (b >= pointsToWin && b - a >= winBy) gameWinner = "B";

  if (gameWinner) {
    s.gamesWon[gameWinner]++;
    s.completedGames.push({ A: a, B: b });
    s.currentGame = { A: 0, B: 0 };
    s.serveCount = 0;

    // Service alternates every game
    s.serving = s.serving === "A" ? "B" : "A";

    const needed = Math.ceil(s.config.games / 2);
    if (s.gamesWon[gameWinner] >= needed) {
      s.winner = gameWinner;
    }
  }
  return s;
}

export const tableTennisEngine: ScoringEngine<TableTennisState> = {
  init(config: MatchConfig): TableTennisState {
    const cfg: TableTennisConfig = {
      games: 5,
      pointsToWin: 11,
      winBy: 2,
      ...config,
      sport: "tabletennis",
    };
    return {
      config: cfg,
      gamesWon: { A: 0, B: 0 },
      completedGames: [],
      currentGame: { A: 0, B: 0 },
      serving: "A",
      serveCount: 0,
      winner: null,
    };
  },

  applyEvent(state: TableTennisState, team: "A" | "B", eventType: string): TableTennisState {
    if (state.winner) return state;
    switch (eventType) {
      case "point":
        return applyPoint(state, team);
      case "serve_error": {
        const opp: "A" | "B" = team === "A" ? "B" : "A";
        return applyPoint(state, opp);
      }
      case "switch_serve":
        return { ...structuredClone(state), serving: state.serving === "A" ? "B" : "A" };
      default:
        return state;
    }
  },

  display(state: TableTennisState, _teamNames: Record<"A" | "B", string>): ScoreDisplay {
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

    return {
      primary: `${state.currentGame.A} – ${state.currentGame.B}`,
      secondary: state.gamesWon.A + state.gamesWon.B > 0
        ? `${state.gamesWon.A} – ${state.gamesWon.B} games`
        : undefined,
      period: `Game ${gameNum} of ${state.config.games}`,
      isComplete: false,
      serve: state.serving,
    };
  },

  getActions(_state: TableTennisState): ScoringAction[] {
    return [{ label: "Point", eventType: "point", value: 1, style: "primary" }];
  },

  getSecondaryActions(_state: TableTennisState): SecondaryAction[] {
    return [
      { label: "Serve Error", eventType: "serve_error", value: 0, style: "danger" },
      { label: "Switch Serve", eventType: "switch_serve", value: 0, style: "secondary" },
    ];
  },

  isComplete(state: TableTennisState): boolean {
    return state.winner !== null;
  },

  configOptions(): ConfigOption[] {
    return [
      {
        key: "games",
        label: "Games",
        type: "select",
        options: [
          { value: 3, label: "Best of 3" },
          { value: 5, label: "Best of 5" },
          { value: 7, label: "Best of 7" },
        ],
        default: 5,
      },
      {
        key: "pointsToWin",
        label: "Points per Game",
        type: "select",
        options: [
          { value: 11, label: "11 (standard)" },
          { value: 21, label: "21 (old style)" },
        ],
        default: 11,
      },
    ];
  },
};
