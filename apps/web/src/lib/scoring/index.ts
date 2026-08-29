import type { ScoringEngine, MatchConfig } from "./types";
import { tennisEngine, inferTennisServe } from "./engines/tennis";
import { padelEngine } from "./engines/padel";
import { badmintonEngine } from "./engines/badminton";
import { tableTennisEngine, inferTTServe } from "./engines/tabletennis";
import { squashEngine } from "./engines/squash";
import { volleyballEngine } from "./engines/volleyball";
import { basketballEngine } from "./engines/basketball";
import { footballEngine } from "./engines/football";
import { cricketEngine } from "./engines/cricket";
import { pickleballEngine } from "./engines/pickleball";
import { pickleballServiceEngine } from "./engines/pickleball-service";
import { pickleballRallyEngine } from "./engines/pickleball-rally";
import { simpleEngine } from "./engines/simple";

export type { ScoringEngine, MatchConfig } from "./types";
export type { ScoreDisplay, ScoringAction, SecondaryAction, ConfigOption } from "./types";

// ─── Registry ─────────────────────────────────────────────────────────────────

const ENGINES: Record<string, ScoringEngine<any>> = {
  tennis: tennisEngine,
  padel: padelEngine,
  badminton: badmintonEngine,
  tabletennis: tableTennisEngine,
  "table tennis": tableTennisEngine,
  "table-tennis": tableTennisEngine,
  squash: squashEngine,
  volleyball: volleyballEngine,
  basketball: basketballEngine,
  football: footballEngine,
  soccer: footballEngine,
  futsal: footballEngine,
  cricket: cricketEngine,
  pickleball: pickleballEngine,
  pickleball_rally: pickleballRallyEngine,
  pickleball_service: pickleballServiceEngine,
  simple: simpleEngine,
};

/**
 * Returns the scoring engine for the given sport/scoreType key.
 * Falls back to the simple engine for unknown sports.
 */
export function getEngine(scoreType: string): ScoringEngine<any> {
  const key = (scoreType ?? "").toLowerCase().trim();
  return ENGINES[key] ?? simpleEngine;
}

/**
 * Normalise any stored scores JSON into a valid engine state.
 * Old matches with flat `{ A: 0, B: 0 }` are migrated by running engine.init() to
 * get a fully-structured state, then overlaying the legacy score values so no engine
 * field (e.g. currentPeriodScores, completedSets) is ever undefined.
 */
export function normaliseState(rawScores: unknown, scoreType: string): unknown {
  const engine = getEngine(scoreType);

  if (rawScores == null) return engine.init({ sport: scoreType });

  const scores = rawScores as Record<string, unknown>;

  // Already a proper engine state — has a config key from our engine
  if (scores.config) {
    const sport = (scores.config as { sport?: string }).sport;
    if (sport === "pickleball_service") {
      const pb = scores as Record<string, unknown>;
      if (!Array.isArray(pb.completedGames)) pb.completedGames = [];
      if (typeof pb.gamesWon !== "object" || !pb.gamesWon) pb.gamesWon = { A: 0, B: 0 };
      if (typeof pb.currentGame !== "object" || !pb.currentGame) pb.currentGame = { A: 0, B: 0 };
      if (pb.serving !== "A" && pb.serving !== "B") pb.serving = "A";
      if (pb.winner === undefined) pb.winner = null;
      if (typeof pb.serverNumber !== "number") pb.serverNumber = 2;
      if (typeof pb.currentServerPlayerIndex !== "number") pb.currentServerPlayerIndex = 0;
      if (typeof pb.starterRightPlayerIndex !== "object" || !pb.starterRightPlayerIndex)
        pb.starterRightPlayerIndex = { A: 0, B: 0 };
      if (pb.firstServeTeamThisGame !== "A" && pb.firstServeTeamThisGame !== "B")
        pb.firstServeTeamThisGame = pb.serving;
      if (!Array.isArray(pb.rallyLog)) pb.rallyLog = [];
      if (typeof pb.nextSeq !== "number") pb.nextSeq = (pb.rallyLog as unknown[]).length + 1;
      if (typeof pb.setupComplete !== "boolean") pb.setupComplete = true;
      const cfg = pb.config as { doubles?: boolean } | undefined;
      const doubles = cfg?.doubles !== false;
      if (typeof pb.setupBaselineAck !== "object" || !pb.setupBaselineAck) {
        (pb as { setupBaselineAck: { A: boolean; B: boolean } }).setupBaselineAck = pb.setupComplete
          ? { A: true, B: true }
          : (doubles ? { A: false, B: false } : { A: true, B: true });
      }
      // Legacy locked matches tracked positions; unfinished/new doubles stay untracked until lock/skip.
      if (typeof pb.trackPositions !== "boolean") {
        pb.trackPositions = pb.setupComplete === true;
      }
      // Back-fill flag for states saved before this field existed.
      // Default true (active) only when both scores are still 0 — safe for fresh games.
      if (typeof pb.openingZeroZeroTwoActive !== "boolean") {
        const cg = pb.currentGame as { A?: number; B?: number } | undefined;
        pb.openingZeroZeroTwoActive = doubles && (cg?.A ?? 0) === 0 && (cg?.B ?? 0) === 0;
      }
      return scores;
    }
    if (sport === "pickleball_rally") {
      const pb = scores as Record<string, unknown>;
      if (!Array.isArray(pb.completedGames)) pb.completedGames = [];
      if (typeof pb.gamesWon !== "object" || !pb.gamesWon) pb.gamesWon = { A: 0, B: 0 };
      if (typeof pb.currentGame !== "object" || !pb.currentGame) pb.currentGame = { A: 0, B: 0 };
      if (pb.serving !== "A" && pb.serving !== "B") pb.serving = "A";
      if (pb.winner === undefined) pb.winner = null;
      if (typeof pb.setupComplete !== "boolean") pb.setupComplete = true;
      if (typeof pb.setupBaselineAck !== "object" || !pb.setupBaselineAck) {
        (pb as { setupBaselineAck: { A: boolean; B: boolean } }).setupBaselineAck = pb.setupComplete
          ? { A: true, B: true }
          : { A: false, B: false };
      }
      if (typeof pb.trackPositions !== "boolean") {
        pb.trackPositions = pb.setupComplete === true;
      }
      if (typeof pb.starterRightPlayerIndex !== "object" || !pb.starterRightPlayerIndex) {
        (pb as { starterRightPlayerIndex: { A: 0 | 1; B: 0 | 1 } }).starterRightPlayerIndex = { A: 0, B: 0 };
      }
      if (typeof pb.currentServerPlayerIndex !== "number") pb.currentServerPlayerIndex = 0;
      if (typeof pb.servingScoreIndex !== "object" || !pb.servingScoreIndex) {
        (pb as { servingScoreIndex: { A: number; B: number } }).servingScoreIndex = { A: 0, B: 0 };
      }
      return scores;
    }
    // Correct serving for engines that derive it from score state
    if (sport === "tennis" || sport === "padel")
      (scores as any).serving = inferTennisServe(scores as any);
    if (sport === "tabletennis")
      (scores as any).serving = inferTTServe(scores as any);
    return scores;
  }

  // Legacy flat scores like { A: 3, B: 1 } — build a complete engine state
  // using init() so all required fields exist, then overlay the score values.
  const base = engine.init(
    scoreType === "pickleball_service" ? { sport: "pickleball_service" } : { sport: scoreType },
  ) as any;
  const aVal = Number(scores.A ?? scores.teamA ?? scores.team1 ?? 0);
  const bVal = Number(scores.B ?? scores.teamB ?? scores.team2 ?? 0);

  // Overlay scores into whichever field the engine uses for top-level totals
  if (base.scores !== undefined) {
    base.scores.A = aVal;
    base.scores.B = bVal;
  } else if (base.currentGame !== undefined) {
    base.currentGame.A = aVal;
    base.currentGame.B = bVal;
  }
  return base;
}

export {
  tennisEngine,
  padelEngine,
  badmintonEngine,
  tableTennisEngine,
  squashEngine,
  volleyballEngine,
  basketballEngine,
  footballEngine,
  cricketEngine,
  pickleballEngine,
  pickleballRallyEngine,
  pickleballServiceEngine,
  simpleEngine,
};
