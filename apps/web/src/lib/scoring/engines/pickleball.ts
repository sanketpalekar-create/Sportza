import type {
  ScoringEngine, MatchConfig, ScoreDisplay,
  ScoringAction, SecondaryAction, ConfigOption,
} from "../types";

export interface PickleballConfig extends MatchConfig {
  sport: "pickleball";
  games: number;
  pointsToWin: number;
  winBy: number;
}

export interface PickleballState {
  config: PickleballConfig;
  gamesWon: { A: number; B: number };
  completedGames: Array<{ A: number; B: number }>;
  currentGame: { A: number; B: number };
  serving: "A" | "B";
  winner: "A" | "B" | null;
}

export const pickleballEngine: ScoringEngine<PickleballState> = {
  init(config: MatchConfig): PickleballState {
    const cfg: PickleballConfig = {
      games: 3,
      pointsToWin: 11,
      winBy: 2,
      ...config,
      sport: "pickleball",
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

  applyEvent(state: PickleballState, team: "A" | "B", eventType: string): PickleballState {
    if (state.winner) return state;
    if (eventType === "switch_serve") {
      return { ...structuredClone(state), serving: state.serving === "A" ? "B" : "A" };
    }
    if (eventType !== "point" && eventType !== "rally" && eventType !== "ace") return state;

    const s = structuredClone(state);
    s.currentGame[team]++;
    s.serving = team;

    const a = s.currentGame.A, b = s.currentGame.B;
    const { pointsToWin, winBy } = s.config;

    let gameWinner: "A" | "B" | null = null;
    if (a >= pointsToWin && a - b >= winBy) gameWinner = "A";
    else if (b >= pointsToWin && b - a >= winBy) gameWinner = "B";

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

  display(state: PickleballState, _teamNames: Record<"A" | "B", string>): ScoreDisplay {
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

  getActions(_state: PickleballState): ScoringAction[] {
    return [{ label: "Point", eventType: "point", value: 1, style: "primary" }];
  },

  getSecondaryActions(_state: PickleballState): SecondaryAction[] {
    return [
      { label: "Ace", eventType: "ace", value: 1, style: "secondary" },
      { label: "Fault", eventType: "fault", value: 0, style: "danger" },
      { label: "Kitchen Fault", eventType: "kitchen_fault", value: 0, style: "danger" },
      { label: "Switch Serve", eventType: "switch_serve", value: 0, style: "secondary" },
    ];
  },

  isComplete(state: PickleballState): boolean {
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
        label: "Points to Win",
        type: "select",
        options: [
          { value: 11, label: "11 (standard)" },
          { value: 15, label: "15" },
          { value: 21, label: "21" },
        ],
        default: 11,
      },
    ];
  },
};
