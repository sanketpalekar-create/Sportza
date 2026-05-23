import prisma from "../lib/prisma";

type ConnectionType = "match" | "open_play" | "venue";

/**
 * Upsert a bidirectional PlayerConnection between two users.
 * On conflict (same pair + type) increments playCount and refreshes lastActivityAt.
 */
async function upsertConnection(
  userA: number,
  userB: number,
  type: ConnectionType,
  venueId?: number
) {
  if (userA === userB) return;
  const now = new Date();

  const upsertOne = (userId: number, connectedUserId: number) =>
    prisma.playerConnection.upsert({
      where: { userId_connectedUserId_connectionType: { userId, connectedUserId, connectionType: type } },
      create: { userId, connectedUserId, connectionType: type, venueId: venueId ?? null, lastActivityAt: now, playCount: 1 },
      update: { playCount: { increment: 1 }, lastActivityAt: now, venueId: venueId ?? undefined },
    });

  await Promise.all([upsertOne(userA, userB), upsertOne(userB, userA)]);
}

/**
 * Called after a match completes.
 * Creates "match" connections between every player pair across both teams.
 */
export async function recordMatchConnections(matchId: number) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return;

  const teams = (match.teams as Record<string, { players?: number[] }>) || {};
  const teamAPlayers: number[] = teams.teamA?.players ?? [];
  const teamBPlayers: number[] = teams.teamB?.players ?? [];
  const allPlayers = [...teamAPlayers, ...teamBPlayers];

  const pairs: [number, number][] = [];
  for (let i = 0; i < allPlayers.length; i++) {
    for (let j = i + 1; j < allPlayers.length; j++) {
      pairs.push([allPlayers[i], allPlayers[j]]);
    }
  }

  await Promise.all(pairs.map(([a, b]) => upsertConnection(a, b, "match")));
}

/**
 * Called when a player joins an open play session.
 * Connects the new joiner to every existing player in the session.
 */
export async function recordOpenPlayConnection(openPlayId: number, newUserId: number) {
  const existingPlayers = await prisma.openPlayPlayer.findMany({
    where: { openPlayId, userId: { not: newUserId } },
    select: { userId: true },
  });

  await Promise.all(
    existingPlayers.map((p) => upsertConnection(newUserId, p.userId, "open_play"))
  );
}

/**
 * Called when a booking is confirmed at a venue.
 * Connects the user to everyone else who has booked the same venue in the last 90 days.
 */
export async function recordVenueConnections(userId: number, venueId: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const recentBookers = await prisma.booking.findMany({
    where: {
      venueId,
      userId: { not: userId },
      status: { in: ["confirmed", "fully_paid", "completed"] },
      bookingDate: { gte: cutoff },
    },
    select: { userId: true },
    distinct: ["userId"],
    take: 50,
  });

  await Promise.all(
    recentBookers.map((b) => upsertConnection(userId, b.userId, "venue", venueId))
  );
}
