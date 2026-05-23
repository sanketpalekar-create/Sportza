// ─── Core types shared by all scoring engines ─────────────────────────────────

export interface MatchConfig {
  sport: string;
  [key: string]: unknown;
}

/** What the UI renders as the live score display */
export interface ScoreDisplay {
  /** Most granular score e.g. "15 – 30" (tennis game) or "21 – 18" (badminton) */
  primary: string;
  /** Mid-level e.g. "4 – 3" (games in current set) */
  secondary?: string;
  /** Top-level e.g. "1 – 1" (sets won) */
  tertiary?: string;
  /** Period label e.g. "Set 2", "Q3", "2nd Half" */
  period?: string;
  /** Set when match has a final result */
  winner?: "A" | "B" | "draw";
  /** Whether the match is fully over */
  isComplete: boolean;
  /** Which team is currently serving. Undefined for non-service sports. */
  serve?: "A" | "B";
}

/** A button the scorer can press */
export interface ScoringAction {
  label: string;
  eventType: string;
  /** Points added to total score (0 = event-only, no score change) */
  value: number;
  /** Visual hint */
  style?: "primary" | "secondary" | "danger";
  /** Short description shown in event log */
  description?: string;
}

/** Secondary/special actions (fouls, timeouts, etc.) */
export interface SecondaryAction extends ScoringAction {
  team?: "A" | "B" | "both";
}

export interface ScoringEngine<TState = unknown> {
  /** Produce the initial state for a new match */
  init(config: MatchConfig): TState;
  /** Apply a scoring event and return the next immutable state */
  applyEvent(state: TState, team: "A" | "B", eventType: string): TState;
  /** Produce display strings from current state */
  display(state: TState, teamNames: Record<"A" | "B", string>): ScoreDisplay;
  /** Buttons shown in the primary scoring area */
  getActions(state: TState): ScoringAction[];
  /** Extra event buttons (no score change) */
  getSecondaryActions(state: TState): SecondaryAction[];
  /** Is the overall match finished? */
  isComplete(state: TState): boolean;
  /** Config options this engine exposes in CreateMatch */
  configOptions(): ConfigOption[];
}

export interface ConfigOption {
  key: string;
  label: string;
  type: "select" | "toggle" | "number";
  options?: Array<{ value: string | number; label: string }>;
  default: string | number | boolean;
}
