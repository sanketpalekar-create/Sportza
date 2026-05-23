import prisma from "../lib/prisma";

export interface MatchEventInput {
  matchId: number;
  team: string;
  playerId?: number;
  eventType: string;
  eventValue?: number;
  metadata?: Record<string, any>;
}

export async function logMatchEvent(input: MatchEventInput) {
  const event = await prisma.matchEvent.create({
    data: {
      matchId: input.matchId,
      team: input.team,
      playerId: input.playerId || null,
      eventType: input.eventType,
      eventValue: input.eventValue || 1,
      metadata: input.metadata as any,
    },
  });

  await updateLiveScore(input.matchId);

  return event;
}

async function updateLiveScore(matchId: number) {
  const events = await prisma.matchEvent.findMany({
    where: { matchId },
    orderBy: { eventTimestamp: "asc" },
  });

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return;

  const scoreMap: Record<string, Record<string, number>> = {
    A: {},
    B: {},
  };

  const scoringEvents = ["goal", "run", "point", "wicket", "ace", "basket"];

  for (const event of events) {
    const team = event.team;
    if (!scoreMap[team]) scoreMap[team] = {};
    if (scoringEvents.includes(event.eventType)) {
      scoreMap[team][event.eventType] =
        (scoreMap[team][event.eventType] || 0) + event.eventValue;
    }
  }

  const scores: Record<string, any> = {
    ...(match.scores as Record<string, any> || {}),
    teamA: calculateTeamTotal(scoreMap["A"], match.sportName),
    teamB: calculateTeamTotal(scoreMap["B"], match.sportName),
    breakdown: scoreMap,
  };

  await prisma.match.update({
    where: { id: matchId },
    data: { scores: scores as any },
  });
}

function calculateTeamTotal(
  eventCounts: Record<string, number>,
  sport: string
): number {
  switch (sport.toLowerCase()) {
    case "football":
      return eventCounts["goal"] || 0;
    case "cricket":
      return eventCounts["run"] || 0;
    case "badminton":
    case "tennis":
    case "padel":
      return eventCounts["point"] || 0;
    case "basketball":
      return (eventCounts["basket"] || 0) * 2 + (eventCounts["three_pointer"] || 0) * 3;
    default:
      return Object.values(eventCounts).reduce((sum, v) => sum + v, 0);
  }
}

export async function getMatchTimeline(matchId: number) {
  return prisma.matchEvent.findMany({
    where: { matchId },
    include: { player: { select: { id: true, name: true } } },
    orderBy: { eventTimestamp: "asc" },
  });
}

export async function undoLastEvent(matchId: number) {
  const lastEvent = await prisma.matchEvent.findFirst({
    where: { matchId },
    orderBy: { eventTimestamp: "desc" },
  });

  if (!lastEvent) return null;

  await prisma.matchEvent.delete({ where: { id: lastEvent.id } });
  await updateLiveScore(matchId);

  return lastEvent;
}
