import type {
  ScoringEngine, MatchConfig, ScoreDisplay,
  ScoringAction, SecondaryAction, ConfigOption,
} from "../types";

export interface SquashConfig extends MatchConfig {
  sport: "squash";
  games: number;
  pointsToWin: number;
  winBy: number;
  maxPoints: number;
}

export interface SquashState {
  config: SquashConfig;
  gamesWon: { A: number; B: number };
  completedGames: Array<{ A: number; B: number }>;
  currentGame: { A: number; B: number };
  serving: "A" | "B";
  winner: "A" | "B" | null;
}

export const squashEngine: ScoringEngine<SquashState> = {
  init(config: MatchConfig): SquashState {
    const cfg: SquashConfig = {
      games: 5,
      pointsToWin: 11,
      winBy: 2,
      maxPoints: 15,
      ...config,
      sport: "squash",
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

  applyEvent(state: SquashState, team: "A" | "B", eventType: string): SquashState {
    if (state.winner) return state;
    if (eventType === "switch_serve") {
      return { ...structuredClone(state), serving: state.serving === "A" ? "B" : "A" };
    }
    if (eventType !== "point" && eventType !== "rally" && eventType !== "stroke") return state;

    const s = structuredClone(state);
    s.currentGame[team]++;
    s.serving = team;

    const a = s.currentGame.A, b = s.currentGame.B;
    const { pointsToWin, winBy, maxPoints } = s.config;

    let gameWinner: "A" | "B" | null = null;
    if (a >= pointsToWin && a - b >= winBy) gameWinner = "A";
    else if (b >= pointsToWin && b - a >= winBy) gameWinner = "B";
    else if (a >= maxPoints) gameWinner = "A";
    else if (b >= maxPoints) gameWinner = "B";

    if (gameWinner) {
      s.gamesWon[gameWinner]++;
      s.completedGames.push({ A: a, B: b });
      s.currentGame = { A: 0, B: 0 };

      const needed = Math.ceil(s.config.games / 2);
      if (s.gamesWon[gameWinner] >= needed) {
        s.winner = gameWinner;
      }
    }
    return s;
  },

  display(state: SquashState, _teamNames: Record<"A" | "B", string>): ScoreDisplay {
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

  getActions(_state: SquashState): ScoringAction[] {
    return [{ label: "Point", eventType: "point", value: 1, style: "primary" }];
  },

  getSecondaryActions(_state: SquashState): SecondaryAction[] {
    return [
      { label: "Let", eventType: "let", value: 0, style: "secondary" },
      { label: "Stroke", eventType: "stroke", value: 1, style: "secondary" },
      { label: "No Let", eventType: "no_let", value: 0, style: "danger" },
      { label: "Switch Serve", eventType: "switch_serve", value: 0, style: "secondary" },
    ];
  },

  isComplete(state: SquashState): boolean {
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
        ],
        default: 5,
      },
      {
        key: "pointsToWin",
        label: "Points per Game",
        type: "select",
        options: [
          { value: 11, label: "11 (standard PAR)" },
          { value: 9, label: "9 (British hand-in)" },
        ],
        default: 11,
      },
    ];
  },
};
