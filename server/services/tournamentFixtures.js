const prisma = require('../lib/prisma');

/**
 * Generate knockout bracket: teams must be power of 2 (4, 8, 16).
 * Round 1: (0, n-1), (1, n-2), ... Round 2+: winner of fixture refs.
 */
function generateKnockoutFixtures(tournamentId, teamCount) {
  const n = teamCount;
  let pow = 1;
  while (pow < n) pow *= 2;
  if (pow !== n) {
    throw new Error(`Knockout requires team count to be a power of 2 (4, 8, 16). Got ${n}.`);
  }

  const fixtures = [];
  const round1Count = n / 2;
  for (let i = 0; i < round1Count; i++) {
    fixtures.push({
      tournamentId,
      round: 1,
      matchOrder: i + 1,
      team1Type: 'team',
      team1Ref: i,
      team2Type: 'team',
      team2Ref: n - 1 - i,
      status: 'pending'
    });
  }

  let prevRoundFixtures = fixtures.slice();
  let round = 2;
  while (prevRoundFixtures.length > 1) {
    const nextRound = [];
    for (let i = 0; i < prevRoundFixtures.length; i += 2) {
      const f1 = prevRoundFixtures[i];
      const f2 = prevRoundFixtures[i + 1];
      nextRound.push({
        tournamentId,
        round,
        matchOrder: Math.floor(i / 2) + 1,
        team1Type: 'winner',
        team1Ref: f1.id || f1,
        team2Type: 'winner',
        team2Ref: f2.id || f2,
        status: 'pending'
      });
    }
    fixtures.push(...nextRound);
    prevRoundFixtures = nextRound;
    round++;
  }

  return fixtures;
}

/**
 * Round-robin: generate all pairs (i,j) with i < j, then assign to rounds so each team plays at most one match per round.
 */
function generateRoundRobinFixtures(tournamentId, teamCount) {
  const n = teamCount;
  if (n < 2) throw new Error('Round-robin requires at least 2 teams.');

  const pairs = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      pairs.push([i, j]);
    }
  }

  const rounds = [];
  for (const [a, b] of pairs) {
    let placed = false;
    for (let r = 0; r < rounds.length; r++) {
      if (!rounds[r].some(([x, y]) => x === a || y === a || x === b || y === b)) {
        rounds[r].push([a, b]);
        placed = true;
        break;
      }
    }
    if (!placed) {
      rounds.push([[a, b]]);
    }
  }

  const fixtures = [];
  rounds.forEach((roundPairs, idx) => {
    roundPairs.forEach(([t1, t2], order) => {
      fixtures.push({
        tournamentId,
        round: idx + 1,
        matchOrder: order + 1,
        team1Type: 'team',
        team1Ref: t1,
        team2Type: 'team',
        team2Ref: t2,
        status: 'pending'
      });
    });
  });

  return fixtures;
}

/**
 * Group-stage round robin: split team indices into groupCount groups, generate round-robin within each group.
 */
function generateGroupRoundRobinFixtures(tournamentId, teamCount, groupCount, stageNum) {
  const n = teamCount;
  if (n < 2 || groupCount < 1) throw new Error('Group round-robin needs at least 2 teams and 1 group.');
  const perGroup = Math.floor(n / groupCount);
  const remainder = n % groupCount;
  const groups = [];
  let idx = 0;
  for (let g = 0; g < groupCount; g++) {
    const size = perGroup + (g < remainder ? 1 : 0);
    if (size < 2) continue;
    groups.push(Array.from({ length: size }, () => idx++));
  }
  const fixtures = [];
  let roundGlobal = 1;
  groups.forEach((groupTeamIndices, groupIndex) => {
    const pairs = [];
    for (let i = 0; i < groupTeamIndices.length; i++) {
      for (let j = i + 1; j < groupTeamIndices.length; j++) {
        pairs.push([groupTeamIndices[i], groupTeamIndices[j]]);
      }
    }
    const rounds = [];
    for (const [a, b] of pairs) {
      let placed = false;
      for (let r = 0; r < rounds.length; r++) {
        if (!rounds[r].some(([x, y]) => x === a || y === a || x === b || y === b)) {
          rounds[r].push([a, b]);
          placed = true;
          break;
        }
      }
      if (!placed) rounds.push([[a, b]]);
    }
    rounds.forEach((roundPairs, r) => {
      roundPairs.forEach(([t1, t2], order) => {
        fixtures.push({
          tournamentId,
          stage: stageNum,
          round: roundGlobal,
          matchOrder: order + 1,
          groupIndex,
          team1Type: 'team',
          team1Ref: t1,
          team2Type: 'team',
          team2Ref: t2,
          status: 'pending'
        });
      });
      roundGlobal++;
    });
  });
  return fixtures;
}

/**
 * Persist group-stage round robin (stage 1 with groupCount).
 */
async function persistGroupRoundRobin(tournamentId, teamCount, groupCount, tournament) {
  const stageNum = tournament && tournament.stages && tournament.stages.length ? 1 : undefined;
  const fixtures = generateGroupRoundRobinFixtures(tournamentId, teamCount, groupCount, stageNum);
  await prisma.tournamentFixture.createMany({
    data: fixtures.map(f => ({
      tournamentId: f.tournamentId,
      stage: f.stage,
      round: f.round,
      matchOrder: f.matchOrder,
      groupIndex: f.groupIndex,
      team1Type: f.team1Type,
      team1Ref: f.team1Ref,
      team2Type: f.team2Type,
      team2Ref: f.team2Ref,
      status: f.status
    }))
  });
  return prisma.tournamentFixture.findMany({
    where: { tournamentId },
    orderBy: [{ stage: 'asc' }, { groupIndex: 'asc' }, { round: 'asc' }, { matchOrder: 'asc' }]
  });
}

/**
 * Persist knockout fixtures. Insert round 1 first, get IDs, then insert round 2 with those IDs, etc.
 */
async function persistKnockout(tournamentId, teamCount, tournament) {
  const n = teamCount;
  let pow = 1;
  while (pow < n) pow *= 2;
  if (pow !== n) throw new Error(`Knockout requires team count power of 2. Got ${n}.`);

  const round1Count = n / 2;
  const inserted = [];
  const stageNum = tournament && tournament.stages && tournament.stages.length ? 1 : undefined;
  for (let i = 0; i < round1Count; i++) {
    const doc = await prisma.tournamentFixture.create({
      data: {
        tournamentId,
        stage: stageNum,
        round: 1,
        matchOrder: i + 1,
        team1Type: 'team',
        team1Ref: i,
        team2Type: 'team',
        team2Ref: n - 1 - i,
        status: 'pending'
      }
    });
    inserted.push(doc);
  }

  let prev = inserted;
  let round = 2;
  while (prev.length > 1) {
    const nextRound = [];
    for (let i = 0; i < prev.length; i += 2) {
      const doc = await prisma.tournamentFixture.create({
        data: {
          tournamentId,
          stage: stageNum,
          round,
          matchOrder: Math.floor(i / 2) + 1,
          team1Type: 'winner',
          team1Ref: prev[i].id,
          team2Type: 'winner',
          team2Ref: prev[i + 1].id,
          status: 'pending'
        }
      });
      nextRound.push(doc);
    }
    prev = nextRound;
    round++;
  }

  return prisma.tournamentFixture.findMany({
    where: { tournamentId },
    orderBy: [{ stage: 'asc' }, { round: 'asc' }, { matchOrder: 'asc' }]
  });
}

/**
 * Persist round-robin fixtures.
 */
async function persistRoundRobin(tournamentId, teamCount, tournament) {
  const fixtures = generateRoundRobinFixtures(tournamentId, teamCount);
  const stageNum = tournament && tournament.stages && tournament.stages.length ? 1 : undefined;
  const data = fixtures.map(f => ({
    tournamentId: f.tournamentId,
    stage: stageNum ?? f.stage,
    round: f.round,
    matchOrder: f.matchOrder,
    team1Type: f.team1Type,
    team1Ref: f.team1Ref,
    team2Type: f.team2Type,
    team2Ref: f.team2Ref,
    status: f.status
  }));
  await prisma.tournamentFixture.createMany({ data });
  return prisma.tournamentFixture.findMany({
    where: { tournamentId },
    orderBy: [{ stage: 'asc' }, { round: 'asc' }, { matchOrder: 'asc' }]
  });
}

/**
 * Generate and persist fixtures based on tournament format and registered teams count.
 */
async function generateAndPersistFixtures(tournament) {
  const count = tournament.teams && tournament.teams.length ? tournament.teams.length : 0;
  if (count < 2) throw new Error('Register at least 2 teams before generating fixtures.');
  if (tournament.maxTeams && count > tournament.maxTeams) {
    throw new Error(`Team count (${count}) exceeds maxTeams (${tournament.maxTeams}).`);
  }

  const tournamentId = tournament.id;
  const existing = await prisma.tournamentFixture.count({
    where: { tournamentId }
  });
  if (existing > 0) throw new Error('Fixtures already generated. Delete existing fixtures first to regenerate.');

  const hasStages = tournament.stages && tournament.stages.length > 0;
  const firstStage = hasStages ? tournament.stages[0] : null;
  const format = (firstStage ? firstStage.format : tournament.format || 'league').toLowerCase().trim();
  const groupCount = firstStage && typeof firstStage.groupCount === 'number' && firstStage.groupCount >= 1 ? firstStage.groupCount : null;

  if (groupCount != null && (format === 'round_robin' || format === 'league' || format === 'group_knockout')) {
    return persistGroupRoundRobin(tournamentId, count, groupCount, tournament);
  }
  if (format === 'knockout') {
    return persistKnockout(tournamentId, count, tournament);
  }
  if (format === 'round_robin' || format === 'league') {
    return persistRoundRobin(tournamentId, count, tournament);
  }
  throw new Error(`Fixture generation not supported for format: ${format}. Use knockout, round_robin, or group stage (groupCount).`);
}

module.exports = {
  generateKnockoutFixtures,
  generateRoundRobinFixtures,
  generateAndPersistFixtures
};
