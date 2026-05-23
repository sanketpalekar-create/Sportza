import type {
  ScoringEngine, MatchConfig, ScoreDisplay,
  ScoringAction, SecondaryAction, ConfigOption,
} from "../types";

export interface CricketConfig extends MatchConfig {
  sport: "cricket";
  /** Total overs per innings */
  overs: number;
  /** Max wickets per innings (standard = 10) */
  maxWickets: number;
  /** Number of innings each team bats */
  innings: number;
}

export interface CricketInnings {
  battingTeam: "A" | "B";
  runs: number;
  wickets: number;
  balls: number;
  extras: number;
  completed: boolean;
}

export interface CricketState {
  config: CricketConfig;
  completedInnings: CricketInnings[];
  currentInnings: CricketInnings;
  /** Which innings number (1-indexed) */
  inningsNumber: number;
  matchEnded: boolean;
  winner: "A" | "B" | "draw" | null;
}

function currentOver(balls: number): string {
  const overs = Math.floor(balls / 6);
  const rem = balls % 6;
  return `${overs}.${rem}`;
}

export const cricketEngine: ScoringEngine<CricketState> = {
  init(config: MatchConfig): CricketState {
    const cfg: CricketConfig = {
      overs: 20,
      maxWickets: 10,
      innings: 2,
      ...config,
      sport: "cricket",
    };
    const firstInnings: CricketInnings = {
      battingTeam: "A",
      runs: 0,
      wickets: 0,
      balls: 0,
      extras: 0,
      completed: false,
    };
    return {
      config: cfg,
      completedInnings: [],
      currentInnings: firstInnings,
      inningsNumber: 1,
      matchEnded: false,
      winner: null,
    };
  },

  applyEvent(state: CricketState, team: "A" | "B", eventType: string): CricketState {
    if (state.matchEnded) return state;
    const s = structuredClone(state);
    if (!s.completedInnings) s.completedInnings = [];
    if (!s.currentInnings) s.currentInnings = { battingTeam: "A", runs: 0, wickets: 0, balls: 0, extras: 0, completed: false };
    const inn = s.currentInnings;

    // Validate: the scoring team should be the batting team
    // (team parameter = team taking the action, which for cricket is the batting team)

    switch (eventType) {
      case "1":
      case "run_1": inn.runs++; inn.balls++; break;
      case "2":
      case "run_2": inn.runs += 2; inn.balls++; break;
      case "3":
      case "run_3": inn.runs += 3; inn.balls++; break;
      case "4":
      case "four": inn.runs += 4; inn.balls++; break;
      case "6":
      case "six": inn.runs += 6; inn.balls++; break;
      case "0":
      case "dot": inn.balls++; break;
      case "wicket": inn.wickets++; inn.balls++; break;
      case "wide": inn.runs++; inn.extras++; break;
      case "no_ball": inn.runs++; inn.extras++; break;
      case "bye": inn.runs++; inn.extras++; inn.balls++; break;
      case "leg_bye": inn.runs++; inn.extras++; inn.balls++; break;
    }

    const { overs, maxWickets, innings } = s.config;
    const maxBalls = overs * 6;

    // Live chase check: if the chasing team passes the target mid-innings, win immediately
    if (innings === 1 && s.completedInnings.length > 0) {
      const firstInn = s.completedInnings[0];
      if (firstInn && inn.battingTeam !== firstInn.battingTeam && inn.runs > firstInn.runs) {
        inn.completed = true;
        s.completedInnings.push(inn);
        s.matchEnded = true;
        s.winner = inn.battingTeam as "A" | "B";
        return s;
      }
    }

    // Check if innings is over (all out or overs exhausted)
    if (inn.wickets >= maxWickets || inn.balls >= maxBalls) {
      inn.completed = true;
      s.completedInnings.push(inn);

      if (s.inningsNumber >= innings * 2) {
        s.matchEnded = true;
        s.winner = resolveWinner(s);
      } else {
        const nextBatting: "A" | "B" = inn.battingTeam === "A" ? "B" : "A";
        s.inningsNumber++;
        s.currentInnings = {
          battingTeam: nextBatting,
          runs: 0,
          wickets: 0,
          balls: 0,
          extras: 0,
          completed: false,
        };
      }
    }

    return s;
  },

  display(state: CricketState, _teamNames: Record<"A" | "B", string>): ScoreDisplay {
    if (state.matchEnded) {
      const aRuns = state.completedInnings.filter((i) => i.battingTeam === "A").reduce((s, i) => s + i.runs, 0);
      const bRuns = state.completedInnings.filter((i) => i.battingTeam === "B").reduce((s, i) => s + i.runs, 0);
      return {
        primary: `${aRuns} – ${bRuns}`,
        period: "Match Over",
        winner: state.winner ?? undefined,
        isComplete: true,
      };
    }

    const inn = state.currentInnings;
    const { overs } = state.config;
    const oversLeft = overs - Math.floor(inn.balls / 6);
    const batting = inn.battingTeam;

    // Show previous innings in secondary
    const prevSummary = state.completedInnings.map((i) => `${i.battingTeam}: ${i.runs}/${i.wickets}`).join(" · ");

    return {
      primary: `${inn.runs}/${inn.wickets}`,
      secondary: prevSummary || undefined,
      period: `Innings ${state.inningsNumber} · ${currentOver(inn.balls)}/${overs} overs · ${batting} batting`,
      isComplete: false,
    };
  },

  getActions(state: CricketState): ScoringAction[] {
    return [
      { label: "0 (Dot)", eventType: "dot", value: 0, style: "secondary" },
      { label: "1 Run", eventType: "1", value: 1, style: "primary" },
      { label: "2 Runs", eventType: "2", value: 2, style: "primary" },
      { label: "3 Runs", eventType: "3", value: 3, style: "secondary" },
      { label: "4 (Four)", eventType: "4", value: 4, style: "primary" },
      { label: "6 (Six)", eventType: "6", value: 6, style: "primary" },
      { label: "Wicket!", eventType: "wicket", value: 0, style: "danger" },
    ];
  },

  getSecondaryActions(_state: CricketState): SecondaryAction[] {
    return [
      { label: "Wide", eventType: "wide", value: 1, style: "secondary" },
      { label: "No Ball", eventType: "no_ball", value: 1, style: "secondary" },
      { label: "Bye", eventType: "bye", value: 1, style: "secondary" },
      { label: "Leg Bye", eventType: "leg_bye", value: 1, style: "secondary" },
    ];
  },

  isComplete(state: CricketState): boolean {
    return state.matchEnded;
  },

  configOptions(): ConfigOption[] {
    return [
      {
        key: "overs",
        label: "Overs per Innings",
        type: "select",
        options: [
          { value: 5, label: "5 overs" },
          { value: 10, label: "10 overs" },
          { value: 20, label: "20 overs (T20)" },
          { value: 50, label: "50 overs (ODI)" },
        ],
        default: 20,
      },
      {
        key: "innings",
        label: "Innings",
        type: "select",
        options: [
          { value: 1, label: "1 innings each" },
          { value: 2, label: "2 innings each (Test)" },
        ],
        default: 1,
      },
    ];
  },
};

function resolveWinner(state: CricketState): "A" | "B" | "draw" {
  const aRuns = state.completedInnings.filter((i) => i.battingTeam === "A").reduce((s, i) => s + i.runs, 0);
  const bRuns = state.completedInnings.filter((i) => i.battingTeam === "B").reduce((s, i) => s + i.runs, 0);
  if (aRuns > bRuns) return "A";
  if (bRuns > aRuns) return "B";
  return "draw";
}
