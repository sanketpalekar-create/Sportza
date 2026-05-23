import type {
  ScoringEngine, MatchConfig, ScoreDisplay,
  ScoringAction, SecondaryAction, ConfigOption,
} from "../types";

/** Generic fallback engine — just raw score counters */
export interface SimpleState {
  config: MatchConfig;
  scores: { A: number; B: number };
  matchEnded: boolean;
  winner: "A" | "B" | "draw" | null;
}

export const simpleEngine: ScoringEngine<SimpleState> = {
  init(config: MatchConfig): SimpleState {
    return {
      config,
      scores: { A: 0, B: 0 },
      matchEnded: false,
      winner: null,
    };
  },

  applyEvent(state: SimpleState, team: "A" | "B", eventType: string): SimpleState {
    if (state.matchEnded) return state;

    const pointEvents = ["point", "goal", "basket", "score", "run", "try", "ace"];
    if (!pointEvents.some((e) => eventType.startsWith(e))) return state;

    const s = structuredClone(state);
    s.scores[team]++;
    return s;
  },

  display(state: SimpleState, _teamNames: Record<"A" | "B", string>): ScoreDisplay {
    if (state.matchEnded || state.winner) {
      return {
        primary: `${state.scores.A} – ${state.scores.B}`,
        period: "Final",
        winner: state.winner ?? undefined,
        isComplete: true,
      };
    }
    return {
      primary: `${state.scores.A} – ${state.scores.B}`,
      isComplete: false,
    };
  },

  getActions(_state: SimpleState): ScoringAction[] {
    return [
      { label: "+ Point", eventType: "point", value: 1, style: "primary" },
    ];
  },

  getSecondaryActions(_state: SimpleState): SecondaryAction[] {
    return [];
  },

  isComplete(state: SimpleState): boolean {
    return state.matchEnded || state.winner !== null;
  },

  configOptions(): ConfigOption[] {
    return [];
  },
};
