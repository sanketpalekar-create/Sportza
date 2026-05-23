import prisma from "../lib/prisma";
import { createNotification, NotifType } from "./notificationService";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_RATING  = 1000;
const DEFAULT_FORMAT  = "overall";
const DAILY_GAIN_CAP  = 80;   // max rating points gained per sport+format per 24h
const BASEK_START     = 32;
const BASEK_FLOOR     = 8;
const BASEK_HALF_LIFE = 40;   // every 40 matches, baseK roughly halves

// Confidence tier definitions — index = tier number (0–6)
const CONFIDENCE_TIERS = [
  { label: "unranked",    multiplier: 1.15 },
  { label: "beginner",    multiplier: 1.05 },
  { label: "developing",  multiplier: 0.95 },
  { label: "established", multiplier: 0.85 },
  { label: "advanced",    multiplier: 0.75 },
  { label: "expert",      multiplier: 0.65 },
  { label: "master",      multiplier: 0.55 },
] as const;

const TIER_SIZE = 20; // matches per confidence tier
const MAX_TIER  = CONFIDENCE_TIERS.length - 1;

// ─── Factor 3: Base K — continuous decay ─────────────────────────────────────

export function getBaseK(matchesPlayed: number): number {
  const raw = BASEK_START / (1 + matchesPlayed / BASEK_HALF_LIFE);
  return Math.max(BASEK_FLOOR, Math.round(raw));
}

// ─── Factor 4: Confidence tier ───────────────────────────────────────────────

export function getTier(matchesPlayed: number): number {
  return Math.min(Math.floor(matchesPlayed / TIER_SIZE), MAX_TIER);
}

export function getConfidence(matchesPlayed: number): string {
  return CONFIDENCE_TIERS[getTier(matchesPlayed)].label;
}

export function getConfidenceMultiplier(confidence: string): number {
  const found = CONFIDENCE_TIERS.find((t) => t.label === confidence);
  // Safe fallback for any legacy label (provisional/low/medium/high) —
  // map them to the nearest v3 tier so existing rows still work.
  if (!found) {
    if (confidence === "provisional") return CONFIDENCE_TIERS[0].multiplier;
    if (confidence === "low")         return CONFIDENCE_TIERS[1].multiplier;
    if (confidence === "medium")      return CONFIDENCE_TIERS[2].multiplier;
    if (confidence === "high")        return CONFIDENCE_TIERS[3].multiplier;
    return 1.0;
  }
  return found.multiplier;
}

// ─── Factor 6: Team-size multiplier ──────────────────────────────────────────

export function getTeamSizeMultiplier(playersOnMyTeam: number): number {
  if (playersOnMyTeam <= 1) return 1.0;
  if (playersOnMyTeam === 2) return 0.9;
  return 0.82;
}

// ─── Factor 7: Rating-gap dampener ───────────────────────────────────────────

export function getRatingGapDampener(myRating: number, opponentAvg: number): number {
  const gap = Math.abs(myRating - opponentAvg);
  if (gap < 150) return 1.0;
  if (gap < 300) return 0.95;
  if (gap < 500) return 0.85;
  return 0.75;
}

// ─── Factor 5: Margin of Victory ─────────────────────────────────────────────

/**
 * Compute normalised margin of victory in [0, 1] from the stored score payload.
 *
 * For racket/net sports that store completedGames/completedSets with point-level data,
 * uses a three-signal composite:
 *   0.4 × gameWinRatio + 0.4 × totalPointDominance + 0.2 × avgWonGameDominance
 *
 * Falls back to game-win ratio only when completedGames is absent/empty.
 * Falls back to 0 (movMultiplier = 1.0) on any parse error — never throws.
 */
export function extractNormalisedMargin(
  scores: unknown,
  scoreType: string,
  winnerTeam: "A" | "B" | null,
): number {
  if (!winnerTeam || !scores || typeof scores !== "object") return 0;

  const s     = scores as Record<string, unknown>;
  const loser: "A" | "B" = winnerTeam === "A" ? "B" : "A";
  const key   = (scoreType ?? "").toLowerCase().trim();

  try {
    // ── Racket / net sports with game-point data ──────────────────────────
    if (
      key === "badminton" || key === "squash" ||
      key === "pickleball" || key === "pickleball_rally" || key === "pickleball_service" ||
      key === "tabletennis" || key === "table tennis" || key === "table-tennis"
    ) {
      const gamesWon      = s.gamesWon as { A: number; B: number } | undefined;
      const completedGames = s.completedGames as Array<{ A: number; B: number }> | undefined;

      if (!gamesWon) return 0;

      const won   = gamesWon[winnerTeam] ?? 0;
      const lost  = gamesWon[loser]      ?? 0;
      const total = won + lost;
      if (total === 0) return 0;

      const gameWinRatio = Math.abs(won - lost) / total;

      // If no scoreline data, fall back to game-win ratio only
      if (!completedGames || completedGames.length === 0) return gameWinRatio;

      return _compositeFromGames(completedGames, winnerTeam, loser, gameWinRatio);
    }

    // ── Tennis / Padel / Volleyball: setsWon + completedSets ─────────────
    if (key === "tennis" || key === "padel" || key === "volleyball") {
      const setsWon      = s.setsWon as { A: number; B: number } | undefined;
      const completedSets = s.completedSets as Array<{ A: number; B: number }> | undefined;

      if (!setsWon) return 0;

      const won   = setsWon[winnerTeam] ?? 0;
      const lost  = setsWon[loser]      ?? 0;
      const total = won + lost;
      if (total === 0) return 0;

      const gameWinRatio = Math.abs(won - lost) / total;

      if (!completedSets || completedSets.length === 0) return gameWinRatio;

      return _compositeFromGames(completedSets, winnerTeam, loser, gameWinRatio);
    }

    // ── Football / Basketball / Simple: flat point scores ─────────────────
    if (
      key === "football" || key === "soccer" || key === "futsal" ||
      key === "basketball" || key === "simple"
    ) {
      const sc = s.scores as { A: number; B: number } | undefined;
      if (!sc) return 0;
      const diff  = Math.abs((sc[winnerTeam] ?? 0) - (sc[loser] ?? 0));
      const total = (sc.A ?? 0) + (sc.B ?? 0);
      return Math.min(diff / Math.max(total * 0.5, 1), 1);
    }

    // ── Cricket: run totals across innings ────────────────────────────────
    if (key === "cricket") {
      const innings = s.completedInnings as Array<{
        battingTeam: "A" | "B"; runs: number; completed: boolean;
      }> | undefined;
      if (!innings || innings.length < 2) return 0;
      const runsA = innings.filter((i) => i.battingTeam === "A").reduce((n, i) => n + i.runs, 0);
      const runsB = innings.filter((i) => i.battingTeam === "B").reduce((n, i) => n + i.runs, 0);
      const total = runsA + runsB;
      if (total === 0) return 0;
      return Math.min(Math.abs(runsA - runsB) / Math.max(total * 0.3, 1), 1);
    }
  } catch {
    // Defensive — any parse error silently falls back to 0
  }

  return 0;
}

/** Shared composite logic for sports with per-game/set point arrays. */
function _compositeFromGames(
  games: Array<{ A: number; B: number }>,
  winner: "A" | "B",
  loser:  "A" | "B",
  gameWinRatio: number,
): number {
  const winnerTotal = games.reduce((n, g) => n + (g[winner] ?? 0), 0);
  const loserTotal  = games.reduce((n, g) => n + (g[loser]  ?? 0), 0);
  const allPoints   = winnerTotal + loserTotal;

  if (allPoints === 0) return gameWinRatio;

  const pointShare     = winnerTotal / allPoints;         // [0, 1]
  const pointDominance = Math.max((pointShare - 0.5) / 0.5, 0);

  // Average per-game dominance across games the winner actually won
  const wonGames = games.filter((g) => (g[winner] ?? 0) > (g[loser] ?? 0));
  const avgWonGameDominance = wonGames.length === 0 ? 0
    : wonGames.reduce((sum, g) => {
        const a = g[winner] ?? 0;
        const b = g[loser]  ?? 0;
        return sum + Math.abs(a - b) / Math.max(a + b, 1);
      }, 0) / wonGames.length;

  const composite = 0.4 * gameWinRatio + 0.4 * pointDominance + 0.2 * avgWonGameDominance;
  return Math.min(Math.max(composite, 0), 1);
}

/** Converts normalised margin to K multiplier. Range: [1.00, 1.35] */
export function movMultiplierFromMargin(normalisedMargin: number): number {
  return 1.0 + 0.35 * Math.min(Math.max(normalisedMargin, 0), 1);
}

// ─── Smurf dampener ───────────────────────────────────────────────────────────

/**
 * Returns true when a player's stats suggest smurf-like behaviour:
 * - fewer than 10 matches played
 * - win rate > 80%
 * - average MOV across wins > 0.7
 */
export function isSmurfPattern(
  matchesPlayed: number,
  winsCount: number,
  totalMOVSum: number,
): boolean {
  if (matchesPlayed >= 10) return false;
  if (matchesPlayed === 0) return false;
  const winRate  = winsCount / matchesPlayed;
  const avgMOV   = winsCount > 0 ? totalMOVSum / winsCount : 0;
  return winRate > 0.8 && avgMOV > 0.7;
}

// ─── Core Elo math ────────────────────────────────────────────────────────────

export function expectedScore(myRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - myRating) / 400));
}

export function clampRating(rating: number): number {
  return Math.max(100, Math.min(3000, Math.round(rating)));
}

/**
 * v3 rating calculation.
 *
 * effectiveK = baseK × confidenceMultiplier × movMultiplier × teamSizeMultiplier × ratingGapDampener
 *
 * movNormalisedMargin: pass the actual margin for winners; pass 0 for losers/draws
 *   so they always receive movMultiplier = 1.0.
 * smurfPattern: if true, halves the MOV bonus coefficient (×0.175 instead of ×0.35).
 */
export function calcNewRating(
  myRating: number,
  opponentAvgRating: number,
  result: number,            // 1 = win, 0.5 = draw, 0 = loss
  matchesPlayed: number,
  confidence: string,
  movNormalisedMargin: number,
  playersOnMyTeam: number,
  smurfPattern: boolean = false,
): number {
  const baseK        = getBaseK(matchesPlayed);
  const confMult     = getConfidenceMultiplier(confidence);
  const rawMargin    = Math.min(Math.max(movNormalisedMargin, 0), 1);
  const movCoeff     = smurfPattern ? 0.175 : 0.35;
  const movMult      = 1.0 + movCoeff * rawMargin;
  const teamSizeMult = getTeamSizeMultiplier(playersOnMyTeam);
  const gapDampener  = getRatingGapDampener(myRating, opponentAvgRating);

  const effectiveK = baseK * confMult * movMult * teamSizeMult * gapDampener;
  const exp        = expectedScore(myRating, opponentAvgRating);
  return clampRating(myRating + effectiveK * (result - exp));
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

/**
 * Fetches or creates a SportSkillRating row for userId + sportId + formatName.
 * New entries start at rating=1000, confidence="unranked", matchesPlayed=0.
 */
export async function getOrCreateRating(
  userId: number,
  sportId: number,
  formatName: string = DEFAULT_FORMAT,
) {
  const existing = await prisma.sportSkillRating.findUnique({
    where: { userId_sportId_formatName: { userId, sportId, formatName } },
  });
  if (existing) return existing;

  return prisma.sportSkillRating.create({
    data: {
      userId,
      sportId,
      formatName,
      rating: DEFAULT_RATING,
      matchesPlayed: 0,
      winsCount: 0,
      totalMOVSum: 0,
      confidence: "unranked",
    },
  });
}

/**
 * Creates a SportSkillRating row (formatName="overall") for every active sport
 * in the database for the given user. Called once at user registration.
 * Safe to call multiple times — getOrCreateRating is idempotent.
 */
export async function initializeRatingsForAllSports(userId: number): Promise<void> {
  const sports = await prisma.sport.findMany({
    where:  { isActive: true },
    select: { id: true },
  });
  await Promise.all(sports.map((s) => getOrCreateRating(userId, s.id, "overall")));
}

/**
 * Returns the total positive rating gain for userId+sportId+formatName in the last 24 hours.
 * Used to enforce the daily gain cap.
 */
async function dailyGainSoFar(
  userId: number,
  sportId: number,
  formatName: string,
): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await prisma.ratingHistory.findMany({
    where: {
      userId,
      sportId,
      formatName,
      createdAt: { gte: since },
      delta: { gt: 0 },
    },
    select: { delta: true },
  });
  return rows.reduce((sum, r) => sum + r.delta, 0);
}

// ─── Main entry point ─────────────────────────────────────────────────────────

const RATING_ELIGIBLE_TYPES = new Set(["COMPETITIVE", "TOURNAMENT"]);

/**
 * Called after a match is completed.
 * Updates Sportza Ratings (v3) for all players in the match.
 */
export async function updateSkillRatingsForMatch(matchId: number): Promise<void> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || match.status !== "completed") return;

  const matchType = (match.matchType ?? "COMPETITIVE").toUpperCase();
  if (!RATING_ELIGIBLE_TYPES.has(matchType)) return;

  const sport = await prisma.sport.findUnique({ where: { id: match.sportId } });
  if (!sport) return;

  const teams = (match.teams as Record<string, { players?: number[] }>) || {};
  const teamAPlayers: number[] = teams.teamA?.players ?? [];
  const teamBPlayers: number[] = teams.teamB?.players ?? [];
  if (teamAPlayers.length === 0 && teamBPlayers.length === 0) return;

  const winnerTeam  = (match.winnerTeam as "A" | "B" | null | undefined) ?? null;
  const formatName  = (match.formatName ?? DEFAULT_FORMAT).trim() || DEFAULT_FORMAT;

  // ── Fetch current ratings ─────────────────────────────────────────────────
  const allPlayers  = [...teamAPlayers, ...teamBPlayers];
  const currentRatings = await Promise.all(
    allPlayers.map((uid) => getOrCreateRating(uid, sport.id, formatName))
  );

  type RatingRow = Awaited<ReturnType<typeof getOrCreateRating>>;
  const ratingMap:       Record<number, RatingRow> = {};
  for (const r of currentRatings) ratingMap[r.userId] = r;

  // ── Team averages ─────────────────────────────────────────────────────────
  const avg = (players: number[]) =>
    players.length === 0 ? DEFAULT_RATING
      : players.reduce((s, uid) => s + (ratingMap[uid]?.rating ?? DEFAULT_RATING), 0) / players.length;

  const avgTeamA = avg(teamAPlayers);
  const avgTeamB = avg(teamBPlayers);

  // ── Result values ─────────────────────────────────────────────────────────
  const isDraw      = !winnerTeam;
  const teamAResult = isDraw ? 0.5 : winnerTeam === "A" ? 1 : 0;
  const teamBResult = isDraw ? 0.5 : winnerTeam === "B" ? 1 : 0;

  // ── MOV ───────────────────────────────────────────────────────────────────
  const normalisedMargin = extractNormalisedMargin(
    match.scores,
    match.scoreType ?? "simple",
    winnerTeam,
  );

  // ── Activity link ─────────────────────────────────────────────────────────
  const activity = await prisma.activity.findFirst({
    where: { referenceId: matchId, type: "match" },
  });

  // ── Per-player update ─────────────────────────────────────────────────────
  const updatePlayer = async (
    uid: number,
    result: number,
    opponentAvg: number,
    myTeamSize: number,
  ) => {
    const row        = ratingMap[uid];
    const oldRating  = row?.rating        ?? DEFAULT_RATING;
    const played     = row?.matchesPlayed ?? 0;
    const confidence = row?.confidence    ?? "unranked";
    const winsCount  = row?.winsCount     ?? 0;
    const totalMOV   = row?.totalMOVSum   ?? 0;

    // MOV bonus: winners get full margin; losers and draws get 0 (→ movMult = 1.0)
    const movForPlayer = result === 1 ? normalisedMargin : 0;

    // Smurf dampener check
    const smurf = isSmurfPattern(played, winsCount, totalMOV);

    // Compute new rating
    const newRating = calcNewRating(
      oldRating, opponentAvg, result, played, confidence,
      movForPlayer, myTeamSize, smurf,
    );

    // Daily gain cap — silently absorb excess
    let cappedRating = newRating;
    const gain = newRating - oldRating;
    if (gain > 0) {
      const alreadyGained = await dailyGainSoFar(uid, sport.id, formatName);
      const allowed = Math.max(0, DAILY_GAIN_CAP - alreadyGained);
      if (gain > allowed) {
        cappedRating = clampRating(oldRating + allowed);
      }
    }

    const newPlayed     = played + 1;
    const newWinsCount  = result === 1 ? winsCount + 1 : winsCount;
    const newTotalMOV   = result === 1 ? totalMOV + normalisedMargin : totalMOV;
    const delta         = cappedRating - oldRating;

    await prisma.sportSkillRating.upsert({
      where:  { userId_sportId_formatName: { userId: uid, sportId: sport.id, formatName } },
      update: {
        rating:       cappedRating,
        matchesPlayed: newPlayed,
        winsCount:    newWinsCount,
        totalMOVSum:  newTotalMOV,
        confidence:   getConfidence(newPlayed),
      },
      create: {
        userId: uid, sportId: sport.id, formatName,
        rating:       cappedRating,
        matchesPlayed: newPlayed,
        winsCount:    newWinsCount,
        totalMOVSum:  newTotalMOV,
        confidence:   getConfidence(newPlayed),
      },
    });

    // Only write history if something changed (gain cap may zero out the delta)
    if (delta !== 0) {
      await prisma.ratingHistory.create({
        data: {
          userId: uid, sportId: sport.id, formatName,
          oldRating, newRating: cappedRating, delta,
          activityId: activity?.id ?? null,
        },
      });

      const sign = delta > 0 ? "+" : "";
      void createNotification(
        uid,
        NotifType.RATING_CHANGED,
        "Your rating changed",
        `${sport.name} rating: ${oldRating} → ${cappedRating} (${sign}${delta})`,
        { sportId: sport.id, oldRating, newRating: cappedRating, delta }
      );
    }
  };

  await Promise.all([
    ...teamAPlayers.map((uid) => updatePlayer(uid, teamAResult, avgTeamB, teamAPlayers.length)),
    ...teamBPlayers.map((uid) => updatePlayer(uid, teamBResult, avgTeamA, teamBPlayers.length)),
  ]);
}
