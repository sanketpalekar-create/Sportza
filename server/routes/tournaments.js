const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');
const { generateAndPersistFixtures } = require('../services/tournamentFixtures');

const router = express.Router();

function buildPlace(tournament) {
  const placeType = tournament.venueId ? 'venue' : 'location';
  const place = tournament.venue
    ? { type: 'venue', id: tournament.venue.id, name: tournament.venue.name, location: tournament.location }
    : { type: 'location', location: tournament.location || {} };
  if (tournament.venue && tournament.venue.locationCity) {
    place.location = { city: tournament.venue.locationCity, address: tournament.venue.locationAddr };
  }
  return { placeType, place };
}

// List tournaments (filter by sport, status)
router.get('/', auth, async (req, res) => {
  try {
    const { sport, status } = req.query;
    const filter = {};
    if (sport) filter.sport = sport;
    if (status) filter.status = status;

    const tournaments = await prisma.tournament.findMany({
      where: filter,
      include: {
        createdBy: { select: { name: true, email: true } },
        venue: { select: { id: true, name: true, locationCity: true, locationAddr: true } }
      },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }]
    });

    const withPlace = tournaments.map(t => {
      const obj = { ...t, venue: t.venue ? { ...t.venue, location: { city: t.venue.locationCity, address: t.venue.locationAddr } } : t.venue };
      const { placeType, place } = buildPlace(obj);
      obj.placeType = placeType;
      obj.place = place;
      return obj;
    });

    res.json(withPlace);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get one tournament
router.get('/:id', auth, async (req, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        createdBy: { select: { name: true, email: true } },
        venue: { select: { id: true, name: true, locationCity: true, locationAddr: true } }
      }
    });

    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    const teams = tournament.teams || [];
    const teamPlayerIds = teams.flatMap(t => (t.players || []));
    const players = teamPlayerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: teamPlayerIds } },
          select: { id: true, name: true, email: true }
        })
      : [];
    const playerMap = Object.fromEntries(players.map(p => [p.id, p]));
    const teamsWithPlayers = teams.map(t => ({
      ...t,
      players: (t.players || []).map(pid => playerMap[pid] || { id: pid })
    }));

    const obj = {
      ...tournament,
      teams: teamsWithPlayers,
      venue: tournament.venue ? { ...tournament.venue, location: { city: tournament.venue.locationCity, address: tournament.venue.locationAddr } } : tournament.venue
    };
    const { placeType, place } = buildPlace(obj);
    obj.placeType = placeType;
    obj.place = place;
    res.json(obj);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get matches for this tournament
router.get('/:id/matches', auth, async (req, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    const matches = await prisma.match.findMany({
      where: { tournamentId: parseInt(req.params.id) },
      include: {
        sport: { select: { name: true, displayName: true, formats: true } },
        venue: { select: { id: true, name: true, locationCity: true, locationAddr: true } },
        tournament: { select: { name: true, sport: true, format: true, status: true } }
      },
      orderBy: { matchDate: 'asc' }
    });

    const withLocation = matches.map(m => ({
      ...m,
      venue: m.venue ? { ...m.venue, location: { city: m.venue.locationCity, address: m.venue.locationAddr } } : null
    }));
    res.json(withLocation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Register teams (and optionally set maxTeams). Body: { teams: [{ name, players: [userId] }], maxTeams?: number }
router.put('/:id/teams', auth, async (req, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }
    if (tournament.createdById !== parseInt(req.user.id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { teams: teamsBody, maxTeams } = req.body;
    const updateData = {};
    if (Array.isArray(teamsBody)) {
      const teams = teamsBody.filter(t => t && t.name).map(t => ({
        name: String(t.name).trim(),
        players: Array.isArray(t.players) ? t.players.map(id => parseInt(id)) : []
      }));
      const existingFixtures = await prisma.tournamentFixture.count({
        where: { tournamentId: tournament.id }
      });
      if (existingFixtures > 0 && teams.length !== (tournament.teams || []).length) {
        return res.status(400).json({ message: 'Cannot change team count after fixtures are generated. Delete fixtures first.' });
      }
      updateData.teams = teams;
    }
    if (typeof maxTeams === 'number' && maxTeams >= 2) {
      updateData.maxTeams = maxTeams;
      const teams = updateData.teams || tournament.teams || [];
      if (teams.length > maxTeams) {
        return res.status(400).json({ message: `Team count (${teams.length}) exceeds maxTeams (${maxTeams}).` });
      }
    }

    const updated = await prisma.tournament.update({
      where: { id: parseInt(req.params.id) },
      data: updateData,
      include: {
        createdBy: { select: { name: true, email: true } },
        venue: { select: { id: true, name: true, locationCity: true, locationAddr: true } }
      }
    });
    const obj = {
      ...updated,
      venue: updated.venue ? { ...updated.venue, location: { city: updated.venue.locationCity, address: updated.venue.locationAddr } } : updated.venue
    };
    const { placeType, place } = buildPlace(obj);
    obj.placeType = placeType;
    obj.place = place;
    res.json(obj);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Generate fixture slots from registered teams (knockout: power of 2; round_robin/league: any ≥2)
router.post('/:id/generate-fixtures', auth, async (req, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }
    if (tournament.createdById !== parseInt(req.user.id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const fixtures = await generateAndPersistFixtures(tournament);
    res.status(201).json({ message: 'Fixtures generated', count: fixtures.length, fixtures });
  } catch (error) {
    if (error.message && (error.message.includes('Register at least') || error.message.includes('power of 2') || error.message.includes('already generated') || error.message.includes('not supported'))) {
      return res.status(400).json({ message: error.message });
    }
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// List fixture slots for this tournament (with match populated when set). Query: ?stage=1 to filter by stage.
router.get('/:id/fixtures', auth, async (req, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    const filter = { tournamentId: parseInt(req.params.id) };
    const stageParam = req.query.stage;
    if (stageParam != null && stageParam !== '') {
      const stageNum = parseInt(stageParam, 10);
      if (!isNaN(stageNum) && stageNum >= 1) filter.stage = stageNum;
    }

    const fixtures = await prisma.tournamentFixture.findMany({
      where: filter,
      include: { match: true },
      orderBy: [{ stage: 'asc' }, { round: 'asc' }, { matchOrder: 'asc' }]
    });

    const withResolved = fixtures.map(f => {
      const team1 = resolveTeamRef(tournament, f.team1Type, f.team1Ref, fixtures);
      const team2 = resolveTeamRef(tournament, f.team2Type, f.team2Ref, fixtures);
      return { ...f, team1Label: team1, team2Label: team2 };
    });

    res.json(withResolved);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

function resolveTeamRef(tournament, type, ref, allFixtures) {
  const teams = tournament.teams || [];
  if (type === 'team' && typeof ref === 'number' && teams[ref]) {
    return teams[ref].name;
  }
  if (type === 'winner' && ref != null) {
    const refId = typeof ref === 'object' && ref !== null && 'id' in ref ? ref.id : ref;
    const fixture = allFixtures.find(f => f.id === refId || f.id === parseInt(refId));
    return fixture ? `Winner of R${fixture.round} M${fixture.matchOrder}` : 'TBD';
  }
  return 'TBD';
}

// Delete all fixtures (to allow re-registering teams and regenerating)
router.delete('/:id/fixtures', auth, async (req, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }
    if (tournament.createdById !== parseInt(req.user.id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const result = await prisma.tournamentFixture.deleteMany({
      where: { tournamentId: tournament.id }
    });
    res.json({ message: 'Fixtures deleted', deleted: result.count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create tournament
router.post('/', auth, [
  body('name').notEmpty().withMessage('Name is required'),
  body('sport').notEmpty().withMessage('Sport is required'),
  body('format').notEmpty().withMessage('Tournament format is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, sport, format, venue: venueId, location, matchFormatName, maxTeams, startDate, endDate, stages: stagesBody } = req.body;

    const sportDoc = await prisma.sport.findFirst({
      where: { name: (sport || '').toLowerCase(), isActive: true }
    });
    if (!sportDoc) {
      return res.status(400).json({ message: 'Sport not found or inactive. Use /api/sports to list.' });
    }

    const stages = Array.isArray(stagesBody)
      ? stagesBody
        .filter(s => s && s.stageOrder >= 1 && s.format)
        .map(s => ({
          stageOrder: Number(s.stageOrder),
          name: s.name ? String(s.name).trim() : undefined,
          format: String(s.format).toLowerCase(),
          groupCount: typeof s.groupCount === 'number' && s.groupCount >= 1 ? s.groupCount : undefined,
          advancePerGroup: typeof s.advancePerGroup === 'number' && s.advancePerGroup >= 1 ? s.advancePerGroup : undefined,
          bestOf: typeof s.bestOf === 'number' && s.bestOf >= 1 ? s.bestOf : undefined
        }))
        .sort((a, b) => a.stageOrder - b.stageOrder)
      : undefined;

    const tournament = await prisma.tournament.create({
      data: {
        name,
        description: description || undefined,
        sport: sportDoc.name,
        format: format || 'league',
        matchFormatName: matchFormatName || undefined,
        venueId: venueId ? parseInt(venueId) : undefined,
        location: location || undefined,
        maxTeams: typeof maxTeams === 'number' && maxTeams >= 2 ? maxTeams : undefined,
        createdById: parseInt(req.user.id),
        status: 'draft',
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        stages: stages && stages.length ? stages : undefined
      },
      include: {
        createdBy: { select: { name: true, email: true } },
        venue: { select: { id: true, name: true, locationCity: true, locationAddr: true } }
      }
    });

    const obj = {
      ...tournament,
      venue: tournament.venue ? { ...tournament.venue, location: { city: tournament.venue.locationCity, address: tournament.venue.locationAddr } } : tournament.venue
    };
    const { placeType, place } = buildPlace(obj);
    obj.placeType = placeType;
    obj.place = place;
    res.status(201).json(obj);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update tournament
router.put('/:id', auth, async (req, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }
    if (tournament.createdById !== parseInt(req.user.id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { name, description, sport, format, venue: venueId, location, matchFormatName, maxTeams, status, winner, runnerUp, startDate, endDate, stages: stagesBody } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (sport !== undefined) updateData.sport = sport;
    if (format !== undefined) updateData.format = format;
    if (stagesBody !== undefined) {
      updateData.stages = Array.isArray(stagesBody)
        ? stagesBody
          .filter(s => s && s.stageOrder >= 1 && s.format)
          .map(s => ({
            stageOrder: Number(s.stageOrder),
            name: s.name ? String(s.name).trim() : undefined,
            format: String(s.format).toLowerCase(),
            groupCount: typeof s.groupCount === 'number' && s.groupCount >= 1 ? s.groupCount : undefined,
            advancePerGroup: typeof s.advancePerGroup === 'number' && s.advancePerGroup >= 1 ? s.advancePerGroup : undefined,
            bestOf: typeof s.bestOf === 'number' && s.bestOf >= 1 ? s.bestOf : undefined
          }))
          .sort((a, b) => a.stageOrder - b.stageOrder)
        : undefined;
    }
    if (venueId !== undefined) updateData.venueId = venueId ? parseInt(venueId) : undefined;
    if (location !== undefined) updateData.location = location;
    if (matchFormatName !== undefined) updateData.matchFormatName = matchFormatName;
    if (typeof maxTeams === 'number' && maxTeams >= 2) updateData.maxTeams = maxTeams;
    if (status !== undefined) updateData.status = status;
    if (winner !== undefined) {
      updateData.winner = (winner && (winner.name != null || winner.id != null))
        ? { name: winner.name ? String(winner.name).trim() : undefined, id: winner.id || undefined }
        : undefined;
    }
    if (runnerUp !== undefined) {
      updateData.runnerUp = (runnerUp && (runnerUp.name != null || runnerUp.id != null))
        ? { name: runnerUp.name ? String(runnerUp.name).trim() : undefined, id: runnerUp.id || undefined }
        : undefined;
    }
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : undefined;
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : undefined;

    const updated = await prisma.tournament.update({
      where: { id: parseInt(req.params.id) },
      data: updateData,
      include: {
        createdBy: { select: { name: true, email: true } },
        venue: { select: { id: true, name: true, locationCity: true, locationAddr: true } }
      }
    });

    const obj = {
      ...updated,
      venue: updated.venue ? { ...updated.venue, location: { city: updated.venue.locationCity, address: updated.venue.locationAddr } } : updated.venue
    };
    const { placeType, place } = buildPlace(obj);
    obj.placeType = placeType;
    obj.place = place;
    res.json(obj);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================== STANDINGS & SCORING ====================

/** League/Round-Robin points configuration */
const POINTS_CONFIG = {
  win: 3,
  draw: 1,
  loss: 0,
};

/**
 * GET /api/tournaments/:id/standings
 * Calculates format-specific standings:
 * - League/Round Robin: Points table (W/D/L, GF, GA, GD, Pts)
 * - Knockout: Bracket progression with results
 * - Group+Knockout: Group standings + knockout bracket
 */
router.get('/:id/standings', auth, async (req, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { venue: { select: { id: true, name: true, locationCity: true, locationAddr: true } } }
    });
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });

    const fixtures = await prisma.tournamentFixture.findMany({
      where: { tournamentId: tournament.id },
      include: { match: true },
      orderBy: [{ stage: 'asc' }, { round: 'asc' }, { matchOrder: 'asc' }]
    });

    const matches = await prisma.match.findMany({
      where: { tournamentId: tournament.id }
    });

    const format = tournament.format;

    if (format === 'league' || format === 'round_robin') {
      const standings = calculatePointsTable(tournament, matches, fixtures);
      return res.json({ format, standings, fixtures: resolveFixtureLabels(tournament, fixtures), matches });
    }

    if (format === 'knockout') {
      const bracket = buildKnockoutBracket(tournament, fixtures);
      return res.json({ format, bracket, fixtures: resolveFixtureLabels(tournament, fixtures), matches });
    }

    if (format === 'group_knockout') {
      const groupFixtures = fixtures.filter(f => f.groupIndex != null);
      const knockoutFixtures = fixtures.filter(f => f.groupIndex == null && f.round > 1);
      const groupStandings = calculateGroupStandings(tournament, matches, groupFixtures);
      const bracket = buildKnockoutBracket(tournament, knockoutFixtures.length > 0 ? knockoutFixtures : fixtures.filter(f => f.groupIndex == null));
      return res.json({ format, groupStandings, bracket, fixtures: resolveFixtureLabels(tournament, fixtures), matches });
    }

    res.json({ format, fixtures: resolveFixtureLabels(tournament, fixtures), matches });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

function resolveFixtureLabels(tournament, fixtures) {
  return fixtures.map(f => ({
    ...f,
    team1Label: resolveTeamRef(tournament, f.team1Type, f.team1Ref, fixtures),
    team2Label: resolveTeamRef(tournament, f.team2Type, f.team2Ref, fixtures),
  }));
}

/**
 * Build a points table for league/round-robin formats.
 * Determines W/D/L from match scores or winnerTeam field.
 */
function calculatePointsTable(tournament, matches, fixtures) {
  const teams = (tournament.teams || []).map((t, i) => ({
    index: i,
    name: t.name,
    played: 0, wins: 0, draws: 0, losses: 0,
    goalsFor: 0, goalsAgainst: 0, goalDifference: 0,
    points: 0,
  }));

  const teamMap = {};
  teams.forEach(t => { teamMap[t.index] = t; });

  for (const fixture of fixtures) {
    if (fixture.status !== 'completed' || !fixture.match) continue;

    const match = typeof fixture.match === 'object' ? fixture.match
      : matches.find(m => m.id === fixture.matchId);
    if (!match || (match.status !== 'completed' && match.status !== 'CONFIRMED')) continue;

    const t1Idx = fixture.team1Type === 'team' ? fixture.team1Ref : null;
    const t2Idx = fixture.team2Type === 'team' ? fixture.team2Ref : null;
    if (t1Idx == null || t2Idx == null) continue;
    if (!teamMap[t1Idx] || !teamMap[t2Idx]) continue;

    teamMap[t1Idx].played++;
    teamMap[t2Idx].played++;

    const score1 = getTeamScore(match, 0);
    const score2 = getTeamScore(match, 1);

    teamMap[t1Idx].goalsFor += score1;
    teamMap[t1Idx].goalsAgainst += score2;
    teamMap[t2Idx].goalsFor += score2;
    teamMap[t2Idx].goalsAgainst += score1;

    if (match.winnerTeam === 'team1' || score1 > score2) {
      teamMap[t1Idx].wins++;
      teamMap[t2Idx].losses++;
    } else if (match.winnerTeam === 'team2' || score2 > score1) {
      teamMap[t2Idx].wins++;
      teamMap[t1Idx].losses++;
    } else {
      teamMap[t1Idx].draws++;
      teamMap[t2Idx].draws++;
    }
  }

  teams.forEach(t => {
    t.goalDifference = t.goalsFor - t.goalsAgainst;
    t.points = t.wins * POINTS_CONFIG.win + t.draws * POINTS_CONFIG.draw + t.losses * POINTS_CONFIG.loss;
  });

  teams.sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor);
  return teams;
}

function calculateGroupStandings(tournament, matches, groupFixtures) {
  const groups = {};
  for (const f of groupFixtures) {
    const gi = f.groupIndex || 0;
    if (!groups[gi]) groups[gi] = [];
    groups[gi].push(f);
  }

  const result = {};
  for (const [groupIdx, fixtures] of Object.entries(groups)) {
    result[groupIdx] = calculatePointsTable(tournament, matches, fixtures);
  }
  return result;
}

/**
 * Extract a numeric score for a team from a match.
 * Handles various score formats stored in match.scores[].
 */
function getTeamScore(match, teamIndex) {
  if (!match.scores || !Array.isArray(match.scores)) return 0;
  const teamScores = match.scores.filter((s, i) => {
    if (s.team) {
      const teamKey = teamIndex === 0 ? 'team1' : 'team2';
      return s.team === teamKey || s.teamIndex === teamIndex;
    }
    return i === teamIndex;
  });
  if (teamScores.length === 0 && match.scores[teamIndex]) {
    const s = match.scores[teamIndex];
    return typeof s.scoreValue === 'number' ? s.scoreValue
      : typeof s.score === 'number' ? s.score
      : parseInt(String(s.scoreValue || s.score || 0), 10) || 0;
  }
  return teamScores.reduce((sum, s) => sum + (typeof s.scoreValue === 'number' ? s.scoreValue : parseInt(String(s.scoreValue || 0), 10) || 0), 0);
}

/**
 * Build knockout bracket structure from fixtures.
 * Returns rounds with fixtures and results.
 */
function buildKnockoutBracket(tournament, fixtures) {
  const rounds = {};
  for (const f of fixtures) {
    const r = f.round || 1;
    if (!rounds[r]) rounds[r] = [];
    rounds[r].push({
      ...f,
      team1Label: resolveTeamRef(tournament, f.team1Type, f.team1Ref, fixtures),
      team2Label: resolveTeamRef(tournament, f.team2Type, f.team2Ref, fixtures),
      winner: f.match?.winnerTeam || null,
      score1: f.match ? getTeamScore(f.match, 0) : null,
      score2: f.match ? getTeamScore(f.match, 1) : null,
      isCompleted: f.status === 'completed',
    });
  }

  const totalRounds = Object.keys(rounds).length;
  const roundNames = {};
  const roundKeys = Object.keys(rounds).map(Number).sort((a, b) => a - b);
  roundKeys.forEach((r, i) => {
    const fromEnd = totalRounds - i;
    if (fromEnd === 1) roundNames[r] = 'Final';
    else if (fromEnd === 2) roundNames[r] = 'Semi Finals';
    else if (fromEnd === 3) roundNames[r] = 'Quarter Finals';
    else roundNames[r] = `Round ${r}`;
  });

  return roundKeys.map(r => ({
    round: r,
    name: roundNames[r],
    matches: rounds[r],
  }));
}

// Cancel tournament
router.put('/:id/cancel', auth, async (req, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }
    if (tournament.createdById !== parseInt(req.user.id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const updated = await prisma.tournament.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'cancelled' }
    });
    res.json({ message: 'Tournament cancelled', tournament: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
