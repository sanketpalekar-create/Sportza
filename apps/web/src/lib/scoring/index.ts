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

/** Tournament stages store bestOf/targetScore; engines expect games/pointsToWin. */
function hydratePickleballEngineConfig(cfg: Record<string, unknown>): void {
  const bestOf = Number(cfg.bestOf);
  const target = Number(cfg.targetScore);
  if (cfg.games == null && Number.isFinite(bestOf) && bestOf > 0) cfg.games = bestOf;
  if (cfg.pointsToWin == null && Number.isFinite(target) && target > 0) cfg.pointsToWin = target;
  if (cfg.winBy == null) cfg.winBy = 2;
  if (cfg.games == null) cfg.games = 3;
  if (cfg.pointsToWin == null) cfg.pointsToWin = 11;
}

function isAbScore(v: unknown): v is { A?: unknown; B?: unknown } {
  return !!v && typeof v === "object";
}

function overlayAb(target: { A: number; B: number } | undefined, raw: unknown): void {
  if (!target || !isAbScore(raw)) return;
  if (raw.A != null) target.A = Number(raw.A) || 0;
  if (raw.B != null) target.B = Number(raw.B) || 0;
}

/**
 * Correct Score / repaired JSON often has gamesWon + completedGames but no config.
 * Overlay those onto a fresh engine state instead of discarding them.
 */
function overlayStructuredScores(base: Record<string, unknown>, scores: Record<string, unknown>): void {
  overlayAb(base.gamesWon as { A: number; B: number } | undefined, scores.gamesWon);
  overlayAb(base.setsWon as { A: number; B: number } | undefined, scores.setsWon);
  overlayAb(base.currentGame as { A: number; B: number } | undefined, scores.currentGame);
  overlayAb(base.currentSet as { A: number; B: number } | undefined, scores.currentSet);

  if (Array.isArray(scores.completedGames) && Array.isArray(base.completedGames)) {
    base.completedGames = scores.completedGames;
  }
  if (Array.isArray(scores.completedSets) && Array.isArray(base.completedSets)) {
    base.completedSets = scores.completedSets;
  }

  if (scores.winner === "A" || scores.winner === "B" || scores.winner === null) {
    base.winner = scores.winner;
  } else {
    const gw = base.gamesWon as { A: number; B: number } | undefined;
    const games = Number((base.config as { games?: unknown } | undefined)?.games);
    const needed = Number.isFinite(games) && games > 0 ? Math.ceil(games / 2) : 0;
    if (gw && needed > 0) {
      if (gw.A >= needed) base.winner = "A";
      else if (gw.B >= needed) base.winner = "B";
    }
  }

  // If currentGame was never stored, keep the last completed game so displays
  // don't fall back to 0–0 after a corrected Best of 1.
  const currentGame = base.currentGame as { A: number; B: number } | undefined;
  const completed = base.completedGames as Array<{ A?: number; B?: number }> | undefined;
  if (
    currentGame
    && scores.currentGame == null
    && Array.isArray(completed)
    && completed.length > 0
    && currentGame.A === 0
    && currentGame.B === 0
  ) {
    const last = completed[completed.length - 1];
    currentGame.A = Number(last?.A) || 0;
    currentGame.B = Number(last?.B) || 0;
  }
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
      hydratePickleballEngineConfig(pb.config as Record<string, unknown>);
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
      hydratePickleballEngineConfig(pb.config as Record<string, unknown>);
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

  // Legacy / corrected scores — build a complete engine state using init() so
  // all required fields exist, then overlay stored game totals instead of dropping them.
  const initConfig: MatchConfig = scoreType === "pickleball_service"
    ? { sport: "pickleball_service" }
    : { sport: scoreType };
  if (scoreType === "pickleball_service" || scoreType === "pickleball_rally" || scoreType === "pickleball") {
    const gw = scores.gamesWon as { A?: number; B?: number } | undefined;
    const maxWins = Math.max(Number(gw?.A) || 0, Number(gw?.B) || 0);
    if (maxWins > 0) initConfig.games = Math.max(1, maxWins * 2 - 1);
    hydratePickleballEngineConfig(initConfig);
  }
  const base = engine.init(initConfig) as Record<string, unknown>;
  overlayStructuredScores(base, scores);

  const hasStructured = scores.gamesWon != null || Array.isArray(scores.completedGames)
    || scores.setsWon != null || Array.isArray(scores.completedSets);
  if (!hasStructured) {
    const aVal = Number(scores.A ?? scores.teamA ?? scores.team1 ?? 0);
    const bVal = Number(scores.B ?? scores.teamB ?? scores.team2 ?? 0);
    const flat = base.scores as { A: number; B: number } | undefined;
    const current = base.currentGame as { A: number; B: number } | undefined;
    if (flat) {
      flat.A = aVal;
      flat.B = bVal;
    } else if (current) {
      current.A = aVal;
      current.B = bVal;
    }
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
