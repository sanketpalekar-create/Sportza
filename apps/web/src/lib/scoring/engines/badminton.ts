import type {
  ScoringEngine, MatchConfig, ScoreDisplay,
  ScoringAction, SecondaryAction, ConfigOption,
} from "../types";

export interface BadmintonConfig extends MatchConfig {
  sport: "badminton";
  /** Best of N games (must be odd: 1, 3) */
  games: number;
  /** Points to win a game (standard = 21) */
  pointsToWin: number;
  /** Win by N points (standard = 2) */
  winBy: number;
  /** Maximum points before sudden death (standard = 30) */
  maxPoints: number;
}

export interface BadmintonState {
  config: BadmintonConfig;
  gamesWon: { A: number; B: number };
  completedGames: Array<{ A: number; B: number }>;
  currentGame: { A: number; B: number };
  /** Which team is serving */
  serving: "A" | "B";
  winner: "A" | "B" | null;
}

function checkGameWin(state: BadmintonState, team: "A" | "B"): "A" | "B" | null {
  const a = state.currentGame.A;
  const b = state.currentGame.B;
  const { pointsToWin, winBy, maxPoints } = state.config;

  if (a >= pointsToWin && a - b >= winBy) return "A";
  if (b >= pointsToWin && b - a >= winBy) return "B";
  // Sudden death at maxPoints
  if (a >= maxPoints) return "A";
  if (b >= maxPoints) return "B";
  return null;
}

export const badmintonEngine: ScoringEngine<BadmintonState> = {
  init(config: MatchConfig): BadmintonState {
    const cfg: BadmintonConfig = {
      games: 3,
      pointsToWin: 21,
      winBy: 2,
      maxPoints: 30,
      ...config,
      sport: "badminton",
    };
    return {
      config: cfg,
      gamesWon: { A: 0, B: 0 },
      completedGames: [],
      currentGame: { A: 0, B: 0 },
      serving: "A",
      winner: null,
    };
  },

  applyEvent(state: BadmintonState, team: "A" | "B", eventType: string): BadmintonState {
    if (state.winner) return state;
    if (eventType === "switch_serve") {
      return { ...structuredClone(state), serving: state.serving === "A" ? "B" : "A" };
    }
    if (eventType !== "point" && eventType !== "shuttle" && eventType !== "service_error") return state;

    const s = structuredClone(state);

    if (eventType === "service_error") {
      const opp: "A" | "B" = team === "A" ? "B" : "A";
      s.currentGame[opp]++;
      s.serving = opp;
    } else {
      s.currentGame[team]++;
      s.serving = team;
    }

    const scorer = eventType === "service_error" ? (team === "A" ? "B" : "A") : team;
    const gameWinner = checkGameWin(s, scorer);
    if (gameWinner) {
      s.gamesWon[gameWinner]++;
      s.completedGames.push({ ...s.currentGame });
      s.currentGame = { A: 0, B: 0 };

      const needed = Math.ceil(s.config.games / 2);
      if (s.gamesWon[gameWinner] >= needed) {
        s.winner = gameWinner;
      }
    }
    return s;
  },

  display(state: BadmintonState, _teamNames: Record<"A" | "B", string>): ScoreDisplay {
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
      period: `Game ${gameNum}`,
      isComplete: false,
      serve: state.serving,
    };
  },

  getActions(_state: BadmintonState): ScoringAction[] {
    return [
      { label: "Point", eventType: "point", value: 1, style: "primary" },
    ];
  },

  getSecondaryActions(_state: BadmintonState): SecondaryAction[] {
    return [
      { label: "Shuttle", eventType: "shuttle", value: 1, style: "secondary", description: "Rally won" },
      { label: "Service Error", eventType: "service_error", value: 0, style: "danger" },
      { label: "Switch Serve", eventType: "switch_serve", value: 0, style: "secondary" },
    ];
  },

  isComplete(state: BadmintonState): boolean {
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
        ],
        default: 3,
      },
      {
        key: "pointsToWin",
        label: "Points to Win",
        type: "select",
        options: [
          { value: 21, label: "21 points (standard)" },
          { value: 15, label: "15 points (short)" },
        ],
        default: 21,
      },
    ];
  },
};
