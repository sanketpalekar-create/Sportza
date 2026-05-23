import type {
  ScoringEngine, MatchConfig, ScoreDisplay,
  ScoringAction, SecondaryAction, ConfigOption,
} from "../types";

export interface BasketballConfig extends MatchConfig {
  sport: "basketball";
  /** "quarters" | "halves" */
  periodType: "quarters" | "halves";
}

export interface BasketballState {
  config: BasketballConfig;
  scores: { A: number; B: number };
  periodScores: Array<{ A: number; B: number }>;
  currentPeriod: number;
  currentPeriodScores: { A: number; B: number };
  /** true = match is over (all periods played or buzzer) */
  matchEnded: boolean;
  winner: "A" | "B" | "draw" | null;
}

function totalPeriods(cfg: BasketballConfig): number {
  return cfg.periodType === "quarters" ? 4 : 2;
}

function periodLabel(cfg: BasketballConfig, period: number): string {
  if (cfg.periodType === "halves") return period === 1 ? "1st Half" : "2nd Half";
  const suffixes = ["1st", "2nd", "3rd", "4th"];
  return `${suffixes[period - 1] ?? period + "th"} Quarter`;
}

export const basketballEngine: ScoringEngine<BasketballState> = {
  init(config: MatchConfig): BasketballState {
    const cfg: BasketballConfig = {
      periodType: "quarters",
      ...config,
      sport: "basketball",
    };
    return {
      config: cfg,
      scores: { A: 0, B: 0 },
      periodScores: [],
      currentPeriod: 1,
      currentPeriodScores: { A: 0, B: 0 },
      matchEnded: false,
      winner: null,
    };
  },

  applyEvent(state: BasketballState, team: "A" | "B", eventType: string): BasketballState {
    if (state.matchEnded) return state;

    const s = structuredClone(state);
    // Guard against missing fields from legacy/migrated states
    if (!s.scores) s.scores = { A: 0, B: 0 };
    if (!s.currentPeriodScores) s.currentPeriodScores = { A: 0, B: 0 };
    if (!s.periodScores) s.periodScores = [];
    if (!s.currentPeriod) s.currentPeriod = 1;

    const pointMap: Record<string, number> = {
      basket: 2,
      "2pt": 2,
      "3pt": 3,
      three_pointer: 3,
      free_throw: 1,
      "1pt": 1,
    };
    const pts = pointMap[eventType] ?? 0;
    if (pts === 0 && !["foul", "timeout", "flagrant", "technical", "end_period"].includes(eventType)) return s;

    if (eventType === "end_period") {
      s.periodScores.push({ ...s.currentPeriodScores });
      s.currentPeriodScores = { A: 0, B: 0 };
      s.currentPeriod++;
      return s;
    }

    if (pts > 0) {
      s.scores[team] += pts;
      s.currentPeriodScores[team] += pts;
    }
    return s;
  },

  display(state: BasketballState, _teamNames: Record<"A" | "B", string>): ScoreDisplay {
    if (state.matchEnded || state.winner) {
      return {
        primary: `${state.scores.A} – ${state.scores.B}`,
        period: "Final",
        winner: state.winner ?? undefined,
        isComplete: true,
      };
    }

    const periodHistory = state.periodScores
      .map((p, i) => `Q${i + 1}: ${p.A}-${p.B}`)
      .join(" · ");

    return {
      primary: `${state.scores.A} – ${state.scores.B}`,
      secondary: periodHistory || undefined,
      period: periodLabel(state.config, state.currentPeriod),
      isComplete: false,
    };
  },

  getActions(_state: BasketballState): ScoringAction[] {
    return [
      { label: "+2", eventType: "basket", value: 2, style: "primary", description: "2-point basket" },
      { label: "+3", eventType: "3pt", value: 3, style: "primary", description: "3-point shot" },
      { label: "+1", eventType: "free_throw", value: 1, style: "secondary", description: "Free throw" },
    ];
  },

  getSecondaryActions(_state: BasketballState): SecondaryAction[] {
    return [
      { label: "Foul", eventType: "foul", value: 0, style: "danger" },
      { label: "Technical", eventType: "technical", value: 0, style: "danger" },
      { label: "Timeout", eventType: "timeout", value: 0, style: "secondary" },
      { label: "End Period", eventType: "end_period", value: 0, style: "secondary" },
    ];
  },

  isComplete(state: BasketballState): boolean {
    return state.matchEnded || state.winner !== null;
  },

  configOptions(): ConfigOption[] {
    return [
      {
        key: "periodType",
        label: "Period Format",
        type: "select",
        options: [
          { value: "quarters", label: "4 Quarters" },
          { value: "halves", label: "2 Halves" },
        ],
        default: "quarters",
      },
    ];
  },
};
