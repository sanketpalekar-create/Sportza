import type {
  ScoringEngine, MatchConfig, ScoreDisplay,
  ScoringAction, SecondaryAction, ConfigOption,
} from "../types";

export interface VolleyballConfig extends MatchConfig {
  sport: "volleyball";
  sets: number;
  pointsToWin: number;
  winBy: number;
  finalSetPoints: number;
}

export interface VolleyballState {
  config: VolleyballConfig;
  setsWon: { A: number; B: number };
  completedSets: Array<{ A: number; B: number }>;
  currentSet: { A: number; B: number };
  serving: "A" | "B";
  winner: "A" | "B" | null;
}

export const volleyballEngine: ScoringEngine<VolleyballState> = {
  init(config: MatchConfig): VolleyballState {
    const cfg: VolleyballConfig = {
      sets: 5,
      pointsToWin: 25,
      winBy: 2,
      finalSetPoints: 15,
      ...config,
      sport: "volleyball",
    };
    return {
      config: cfg,
      setsWon: { A: 0, B: 0 },
      completedSets: [],
      currentSet: { A: 0, B: 0 },
      serving: "A",
      winner: null,
    };
  },

  applyEvent(state: VolleyballState, team: "A" | "B", eventType: string): VolleyballState {
    if (state.winner) return state;
    if (eventType !== "point" && eventType !== "rally" && eventType !== "ace" && eventType !== "block") return state;

    const s = structuredClone(state);
    s.currentSet[team]++;
    s.serving = team;

    const a = s.currentSet.A, b = s.currentSet.B;
    const isFinalSet = s.setsWon.A + s.setsWon.B === s.config.sets - 1;
    const target = isFinalSet ? s.config.finalSetPoints : s.config.pointsToWin;
    const { winBy } = s.config;

    let setWinner: "A" | "B" | null = null;
    if (a >= target && a - b >= winBy) setWinner = "A";
    else if (b >= target && b - a >= winBy) setWinner = "B";

    if (setWinner) {
      s.setsWon[setWinner]++;
      s.completedSets.push({ A: a, B: b });
      s.currentSet = { A: 0, B: 0 };

      const needed = Math.ceil(s.config.sets / 2);
      if (s.setsWon[setWinner] >= needed) {
        s.winner = setWinner;
      }
    }
    return s;
  },

  display(state: VolleyballState, _teamNames: Record<"A" | "B", string>): ScoreDisplay {
    const setNum = state.completedSets.length + 1;

    if (state.winner) {
      return {
        primary: `${state.setsWon.A} – ${state.setsWon.B}`,
        secondary: state.completedSets.map((s) => `${s.A}-${s.B}`).join(", "),
        period: "Final",
        winner: state.winner,
        isComplete: true,
      };
    }

    const isFinalSet = state.setsWon.A + state.setsWon.B === state.config.sets - 1;

    return {
      primary: `${state.currentSet.A} – ${state.currentSet.B}`,
      secondary: state.setsWon.A + state.setsWon.B > 0
        ? `${state.setsWon.A} – ${state.setsWon.B} sets`
        : undefined,
      period: isFinalSet ? `Set ${setNum} (Final Set — ${state.config.finalSetPoints} pts)` : `Set ${setNum}`,
      isComplete: false,
    };
  },

  getActions(_state: VolleyballState): ScoringAction[] {
    return [{ label: "Point", eventType: "point", value: 1, style: "primary" }];
  },

  getSecondaryActions(_state: VolleyballState): SecondaryAction[] {
    return [
      { label: "Ace", eventType: "ace", value: 1, style: "secondary" },
      { label: "Block", eventType: "block", value: 1, style: "secondary" },
      { label: "Attack Error", eventType: "attack_error", value: 0, style: "danger" },
      { label: "Service Error", eventType: "service_error", value: 0, style: "danger" },
      { label: "Timeout", eventType: "timeout", value: 0, style: "danger" },
    ];
  },

  isComplete(state: VolleyballState): boolean {
    return state.winner !== null;
  },

  configOptions(): ConfigOption[] {
    return [
      {
        key: "sets",
        label: "Sets",
        type: "select",
        options: [
          { value: 3, label: "Best of 3" },
          { value: 5, label: "Best of 5" },
        ],
        default: 5,
      },
      {
        key: "pointsToWin",
        label: "Points per Set",
        type: "select",
        options: [
          { value: 25, label: "25 (standard)" },
          { value: 21, label: "21 (beach)" },
        ],
        default: 25,
      },
    ];
  },
};
