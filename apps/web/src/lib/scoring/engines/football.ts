import type {
  ScoringEngine, MatchConfig, ScoreDisplay,
  ScoringAction, SecondaryAction, ConfigOption,
} from "../types";

export interface FootballConfig extends MatchConfig {
  sport: "football";
  /** "standard" | "futsal" | "5-a-side" */
  variant: string;
  halves: number;
}

export interface FootballState {
  config: FootballConfig;
  scores: { A: number; B: number };
  halfScores: Array<{ A: number; B: number }>;
  currentHalf: number;
  currentHalfScores: { A: number; B: number };
  matchEnded: boolean;
  winner: "A" | "B" | "draw" | null;
}

function halfLabel(half: number): string {
  if (half === 1) return "1st Half";
  if (half === 2) return "2nd Half";
  if (half === 3) return "Extra Time";
  return `Period ${half}`;
}

export const footballEngine: ScoringEngine<FootballState> = {
  init(config: MatchConfig): FootballState {
    const cfg: FootballConfig = {
      variant: "standard",
      halves: 2,
      ...config,
      sport: "football",
    };
    return {
      config: cfg,
      scores: { A: 0, B: 0 },
      halfScores: [],
      currentHalf: 1,
      currentHalfScores: { A: 0, B: 0 },
      matchEnded: false,
      winner: null,
    };
  },

  applyEvent(state: FootballState, team: "A" | "B", eventType: string): FootballState {
    if (state.matchEnded) return state;

    const s = structuredClone(state);
    if (!s.scores) s.scores = { A: 0, B: 0 };
    if (!s.halfScores) s.halfScores = [];
    if (!s.currentHalfScores) s.currentHalfScores = { A: 0, B: 0 };
    if (!s.currentHalf) s.currentHalf = 1;

    switch (eventType) {
      case "goal":
        s.scores[team]++;
        s.currentHalfScores[team]++;
        break;
      case "own_goal": {
        const opp: "A" | "B" = team === "A" ? "B" : "A";
        s.scores[opp]++;
        s.currentHalfScores[opp]++;
        break;
      }
      case "penalty":
        s.scores[team]++;
        s.currentHalfScores[team]++;
        break;
      case "half_time":
        s.halfScores.push({ ...s.currentHalfScores });
        s.currentHalfScores = { A: 0, B: 0 };
        s.currentHalf++;
        break;
    }
    return s;
  },

  display(state: FootballState, _teamNames: Record<"A" | "B", string>): ScoreDisplay {
    if (state.matchEnded || state.winner) {
      return {
        primary: `${state.scores.A} – ${state.scores.B}`,
        secondary: state.halfScores.map((h, i) => `H${i + 1}: ${h.A}-${h.B}`).join(" · ") || undefined,
        period: "Full Time",
        winner: state.winner ?? undefined,
        isComplete: true,
      };
    }

    return {
      primary: `${state.scores.A} – ${state.scores.B}`,
      secondary: state.halfScores.length > 0
        ? state.halfScores.map((h, i) => `H${i + 1}: ${h.A}-${h.B}`).join(" · ")
        : undefined,
      period: halfLabel(state.currentHalf),
      isComplete: false,
    };
  },

  getActions(_state: FootballState): ScoringAction[] {
    return [
      { label: "Goal", eventType: "goal", value: 1, style: "primary", description: "Goal scored" },
    ];
  },

  getSecondaryActions(_state: FootballState): SecondaryAction[] {
    return [
      { label: "Own Goal", eventType: "own_goal", value: 1, style: "secondary", description: "Own goal (credited to opponent)" },
      { label: "Penalty", eventType: "penalty", value: 1, style: "secondary" },
      { label: "Yellow Card", eventType: "yellow_card", value: 0, style: "danger" },
      { label: "Red Card", eventType: "red_card", value: 0, style: "danger" },
      { label: "Offside", eventType: "offside", value: 0, style: "secondary" },
      { label: "Corner", eventType: "corner", value: 0, style: "secondary" },
      { label: "Half Time", eventType: "half_time", value: 0, style: "secondary" },
    ];
  },

  isComplete(state: FootballState): boolean {
    return state.matchEnded || state.winner !== null;
  },

  configOptions(): ConfigOption[] {
    return [
      {
        key: "variant",
        label: "Variant",
        type: "select",
        options: [
          { value: "standard", label: "Football (11v11)" },
          { value: "futsal", label: "Futsal (5v5)" },
          { value: "5-a-side", label: "5-a-side" },
          { value: "7-a-side", label: "7-a-side" },
        ],
        default: "standard",
      },
    ];
  },
};
