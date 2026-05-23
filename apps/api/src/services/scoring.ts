import prisma from "../lib/prisma";
import { updateSkillRatingsForMatch } from "./elo";
import { recordMatchConnections } from "./connections";

const MATCH_TYPES_AFFECTING_STATS = new Set([
  "COMPETITIVE",
  "TOURNAMENT",
  "OPEN_PLAY",
]);

interface ScoreUpdate {
  matchId: number;
  team: string;
  scoreType: string;
  value: number;
}

export async function updateMatchScore(matchId: number, scores: Record<string, any>) {
  const match = await prisma.match.update({
    where: { id: matchId },
    data: { scores: scores as any },
  });
  return match;
}

export async function processMatchResult(matchId: number) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { events: true },
  });

  if (!match || match.status !== "completed") return null;

  const scores = (match.scores as Record<string, any>) || {};
  const teams = (match.teams as Record<string, any>) || {};

  let winnerTeam: string | null = null;

  if (scores.teamA !== undefined && scores.teamB !== undefined) {
    if (scores.teamA > scores.teamB) winnerTeam = "A";
    else if (scores.teamB > scores.teamA) winnerTeam = "B";
  }

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: { winnerTeam, statsProcessed: true },
  });

  await calculateSportSpecificStats(matchId);

  const matchType = (match.matchType ?? "COMPETITIVE").toUpperCase();
  const affectsStats = MATCH_TYPES_AFFECTING_STATS.has(matchType);

  if (!affectsStats) return updated;

  const teamAPlayers: number[] = teams.teamA?.players || [];
  const teamBPlayers: number[] = teams.teamB?.players || [];
  const allPlayers = [...teamAPlayers, ...teamBPlayers];

  if (allPlayers.length === 0) return updated;

  const winnerPlayers: number[] = winnerTeam === "A" ? teamAPlayers : winnerTeam === "B" ? teamBPlayers : [];
  const loserPlayers: number[] = winnerTeam === "A" ? teamBPlayers : winnerTeam === "B" ? teamAPlayers : [];

  for (const playerId of allPlayers) {
    const isWinner = winnerPlayers.includes(playerId);
    const isLoser = loserPlayers.includes(playerId);
    const isDraw = !winnerTeam;

    let activity = await prisma.activity.findFirst({ where: { referenceId: match.id, type: "match" } });
    if (!activity) {
      activity = await prisma.activity.create({
        data: {
          type: "match",
          sport: match.sportName,
          venueId: match.venueId,
          referenceId: match.id,
          createdById: match.createdById,
          date: match.matchDate,
          status: "completed",
        },
      });
    }

    await prisma.playerActivityStats.upsert({
      where: { activityId_playerId: { activityId: activity.id, playerId } },
      create: {
        activityId: activity.id,
        playerId,
        sport: match.sportName,
        stats: { result: isDraw ? "draw" : isWinner ? "win" : "loss" } as any,
      },
      update: {
        stats: { result: isDraw ? "draw" : isWinner ? "win" : "loss" } as any,
      },
    });

    await prisma.playerStats.upsert({
      where: { playerId_sport: { playerId, sport: match.sportName } },
      update: {
        totalMatches: { increment: 1 },
        matchesWon: isWinner ? { increment: 1 } : undefined,
        matchesLost: isLoser ? { increment: 1 } : undefined,
        lastUpdated: new Date(),
      },
      create: {
        playerId,
        sport: match.sportName,
        totalMatches: 1,
        matchesWon: isWinner ? 1 : 0,
        matchesLost: isWinner ? 0 : 1,
        winPercentage: isWinner ? 100 : 0,
      },
    });
  }

  await recalculateWinPercentages(allPlayers, match.sportName);
  await updateSkillRatingsForMatch(matchId);
  await recordMatchConnections(matchId);

  return updated;
}

async function recalculateWinPercentages(playerIds: number[], sport: string) {
  for (const playerId of playerIds) {
    const stats = await prisma.playerStats.findUnique({
      where: { playerId_sport: { playerId, sport } },
    });
    if (stats && stats.totalMatches > 0) {
      const winPct = (stats.matchesWon / stats.totalMatches) * 100;
      await prisma.playerStats.update({
        where: { playerId_sport: { playerId, sport } },
        data: { winPercentage: Math.round(winPct * 100) / 100 },
      });
    }
  }
}

export async function calculateSportSpecificStats(matchId: number) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { events: true },
  });

  if (!match) return null;

  const playerStatsMap: Record<number, Record<string, number>> = {};

  for (const event of match.events) {
    if (!event.playerId) continue;
    if (!playerStatsMap[event.playerId]) {
      playerStatsMap[event.playerId] = {};
    }
    const key = event.eventType;
    playerStatsMap[event.playerId][key] =
      (playerStatsMap[event.playerId][key] || 0) + event.eventValue;
  }

  await prisma.match.update({
    where: { id: matchId },
    data: { playerStats: playerStatsMap as any },
  });

  return playerStatsMap;
}
