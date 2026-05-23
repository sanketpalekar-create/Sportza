import prisma from "../lib/prisma";

interface Team {
  name: string;
  players: number[];
}

export async function generateRoundRobin(tournamentId: number) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  });

  if (!tournament) throw new Error("Tournament not found");

  const teams: Team[] = (tournament.teams as unknown as Team[]) || [];
  if (teams.length < 2) throw new Error("Need at least 2 teams");

  await prisma.tournamentFixture.deleteMany({ where: { tournamentId } });

  const fixtures: Array<{
    tournamentId: number;
    round: number;
    matchOrder: number;
    team1Type: string;
    team1Ref: any;
    team2Type: string;
    team2Ref: any;
    status: string;
  }> = [];

  const n = teams.length;
  const rounds = n % 2 === 0 ? n - 1 : n;
  const teamsPerRound = Math.floor(n / 2);

  const teamIndices = teams.map((_, i) => i);
  const fixed = teamIndices.shift()!;

  for (let round = 0; round < rounds; round++) {
    for (let match = 0; match < teamsPerRound; match++) {
      const home = match === 0 ? fixed : teamIndices[match - 1];
      const away = teamIndices[teamIndices.length - 1 - match + (match === 0 ? 0 : 0)];

      if (home === undefined || away === undefined) continue;

      fixtures.push({
        tournamentId,
        round: round + 1,
        matchOrder: match + 1,
        team1Type: "team",
        team1Ref: { index: home, name: teams[home].name },
        team2Type: "team",
        team2Ref: { index: away, name: teams[away].name },
        status: "pending",
      });
    }

    teamIndices.push(teamIndices.shift()!);
  }

  await prisma.tournamentFixture.createMany({ data: fixtures });

  return prisma.tournamentFixture.findMany({
    where: { tournamentId },
    orderBy: [{ round: "asc" }, { matchOrder: "asc" }],
  });
}

export async function generateKnockout(tournamentId: number) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  });

  if (!tournament) throw new Error("Tournament not found");

  const teams: Team[] = (tournament.teams as unknown as Team[]) || [];
  if (teams.length < 2) throw new Error("Need at least 2 teams");

  await prisma.tournamentFixture.deleteMany({ where: { tournamentId } });

  const size = nextPowerOf2(teams.length);
  const totalRounds = Math.log2(size);
  const fixtures: Array<{
    tournamentId: number;
    round: number;
    matchOrder: number;
    team1Type: string;
    team1Ref: any;
    team2Type: string;
    team2Ref: any;
    status: string;
  }> = [];

  for (let match = 0; match < size / 2; match++) {
    const t1 = teams[match * 2];
    const t2 = teams[match * 2 + 1];

    fixtures.push({
      tournamentId,
      round: 1,
      matchOrder: match + 1,
      team1Type: "team",
      team1Ref: t1 ? { index: match * 2, name: t1.name } : { bye: true },
      team2Type: "team",
      team2Ref: t2 ? { index: match * 2 + 1, name: t2.name } : { bye: true },
      status: t1 && t2 ? "pending" : "bye",
    });
  }

  for (let round = 2; round <= totalRounds; round++) {
    const matchesInRound = size / Math.pow(2, round);
    for (let match = 0; match < matchesInRound; match++) {
      fixtures.push({
        tournamentId,
        round,
        matchOrder: match + 1,
        team1Type: "winner",
        team1Ref: { round: round - 1, match: match * 2 + 1 },
        team2Type: "winner",
        team2Ref: { round: round - 1, match: match * 2 + 2 },
        status: "pending",
      });
    }
  }

  await prisma.tournamentFixture.createMany({ data: fixtures });

  return prisma.tournamentFixture.findMany({
    where: { tournamentId },
    orderBy: [{ round: "asc" }, { matchOrder: "asc" }],
  });
}

export async function calculateStandings(tournamentId: number) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { matches: { where: { status: "completed" } } },
  });

  if (!tournament) throw new Error("Tournament not found");

  const teams: Team[] = (tournament.teams as unknown as Team[]) || [];
  const standings = teams.map((team, index) => ({
    team: team.name,
    index,
    played: 0,
    won: 0,
    lost: 0,
    drawn: 0,
    points: 0,
  }));

  for (const match of tournament.matches) {
    const matchTeams = match.teams as any;
    if (!matchTeams?.teamA || !matchTeams?.teamB) continue;

    const teamAIdx = matchTeams.teamA.index;
    const teamBIdx = matchTeams.teamB.index;

    const a = standings.find((s) => s.index === teamAIdx);
    const b = standings.find((s) => s.index === teamBIdx);

    if (a) a.played++;
    if (b) b.played++;

    if (match.winnerTeam === "A") {
      if (a) { a.won++; a.points += 3; }
      if (b) b.lost++;
    } else if (match.winnerTeam === "B") {
      if (b) { b.won++; b.points += 3; }
      if (a) a.lost++;
    } else {
      if (a) { a.drawn++; a.points += 1; }
      if (b) { b.drawn++; b.points += 1; }
    }
  }

  standings.sort((a, b) => b.points - a.points || b.won - a.won);

  return standings;
}

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}
