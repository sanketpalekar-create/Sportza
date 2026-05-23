const express = require('express');
const { body, query, validationResult } = require('express-validator');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');
const { getScoringType, validateAndNormalizeScores, getScoreSummary, getSimpleTotals } = require('../services/scoring');
const matchLogging = require('../services/matchLogging');

const router = express.Router();

const INCLUDE_MATCH = {
  sport: { select: { name: true, displayName: true, formats: true, statFields: true } },
  venue: { select: { name: true, locationCity: true, locationAddr: true, locationPin: true, locationCoords: true } },
  booking: { select: { bookingDate: true, startTime: true, endTime: true } },
  tournament: { select: { name: true, sport: true, format: true, status: true } },
  createdBy: { select: { name: true, email: true } }
};

// ---------- LIST & DETAIL ----------

// GET /api/matches — list matches (filterable)
router.get('/', auth, async (req, res) => {
  try {
    const { sport, status, matchType, loggingMode, limit } = req.query;
    const where = {};
    if (sport) where.sportName = sport;
    if (status) where.status = status;
    if (matchType) where.matchType = matchType;
    if (loggingMode) where.loggingMode = loggingMode;

    let matches;
    if (req.user.role === 'player') {
      const userId = req.user.id;
      const ids = await prisma.$queryRaw`
        SELECT id FROM matches
        WHERE createdById = ${userId}
           OR JSON_CONTAINS(COALESCE(JSON_EXTRACT(teams, '$.team1.players'), '[]'), CAST(${userId} AS JSON), '$')
           OR JSON_CONTAINS(COALESCE(JSON_EXTRACT(teams, '$.team2.players'), '[]'), CAST(${userId} AS JSON), '$')
      `;
      const matchIds = ids.map(r => r.id);
      if (matchIds.length === 0) {
        matches = [];
      } else {
        const filter = { id: { in: matchIds }, ...where };
        matches = await prisma.match.findMany({
          where: filter,
          include: INCLUDE_MATCH,
          orderBy: { matchDate: 'desc' },
          take: Math.min(parseInt(limit, 10) || 50, 200)
        });
      }
    } else {
      matches = await prisma.match.findMany({
        where,
        include: INCLUDE_MATCH,
        orderBy: { matchDate: 'desc' },
        take: Math.min(parseInt(limit, 10) || 50, 200)
      });
    }

    res.json(matches);
  } catch (error) {
    console.error('GET /matches error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/matches/pending-confirmations — matches waiting for current user's confirmation
router.get('/pending-confirmations', auth, async (req, res) => {
  try {
    const confs = await prisma.matchConfirmation.findMany({
      where: { playerId: req.user.id, status: 'PENDING' },
      include: {
        match: { include: INCLUDE_MATCH }
      }
    });

    const matches = confs.map(c => ({
      confirmation: { id: c.id, status: c.status },
      match: c.match
    })).filter(c => c.match);

    res.json(matches);
  } catch (error) {
    console.error('GET /pending-confirmations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/matches/history — current player's match history
router.get('/history', auth, async (req, res) => {
  try {
    const { sport, matchType, status, page = 1, limit = 20 } = req.query;
    const skip = (Math.max(1, parseInt(page, 10) || 1) - 1) * parseInt(limit, 10);
    const lim = Math.min(parseInt(limit, 10) || 20, 100);
    const userId = req.user.id;

    const extraConditions = [];
    const params = [userId, userId];
    if (sport) { extraConditions.push('sportName = ?'); params.push(sport); }
    if (matchType) { extraConditions.push('matchType = ?'); params.push(matchType); }
    if (status) { extraConditions.push('status = ?'); params.push(status); }
    const extraSql = extraConditions.length ? ' AND ' + extraConditions.join(' AND ') : '';

    const allMatches = await prisma.$queryRawUnsafe(
      `SELECT id FROM matches WHERE (
        JSON_CONTAINS(COALESCE(JSON_EXTRACT(teams, '$.team1.players'), '[]'), CAST(? AS JSON), '$')
        OR JSON_CONTAINS(COALESCE(JSON_EXTRACT(teams, '$.team2.players'), '[]'), CAST(? AS JSON), '$')
      )${extraSql}`,
      ...params
    );
    const total = allMatches.length;
    const matchIds = allMatches.slice(skip, skip + lim).map(r => r.id);

    const matches = matchIds.length > 0
      ? await prisma.match.findMany({
          where: { id: { in: matchIds } },
          include: INCLUDE_MATCH,
          orderBy: { matchDate: 'desc' }
        })
      : [];

    res.json({ matches, total, page: parseInt(page, 10), pages: Math.ceil(total / lim) });
  } catch (error) {
    console.error('GET /history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/matches/recent — recent matches across the platform
router.get('/recent', async (req, res) => {
  try {
    const { sport, limit = 10 } = req.query;
    const where = { status: { in: ['CONFIRMED', 'COMPLETED', 'completed'] } };
    if (sport) where.sportName = sport;

    const matches = await prisma.match.findMany({
      where,
      include: INCLUDE_MATCH,
      orderBy: { matchDate: 'desc' },
      take: Math.min(parseInt(limit, 10) || 10, 50)
    });

    res.json(matches);
  } catch (error) {
    console.error('GET /recent error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/matches/:id — single match with score summary
router.get('/:id', auth, async (req, res) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: parseInt(req.params.id) },
      include: INCLUDE_MATCH
    });
    if (!match) return res.status(404).json({ message: 'Match not found' });

    const scoreType = match.scoreType || getScoringType(match.sport, match.formatName);
    const scoreSummary = getScoreSummary(scoreType, match.scores);
    const out = { ...match, scoreType, scoreSummary };

    const confirmations = await prisma.matchConfirmation.findMany({
      where: { matchId: match.id },
      include: { player: { select: { name: true, email: true } } }
    });
    out.confirmations = confirmations;

    const events = await prisma.matchEvent.findMany({
      where: { matchId: match.id },
      include: { player: { select: { name: true, email: true } } },
      orderBy: { eventTimestamp: 'asc' }
    });
    out.events = events;

    res.json(out);
  } catch (error) {
    console.error('GET /matches/:id error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/matches/:id/events — events for a match
router.get('/:id/events', auth, async (req, res) => {
  try {
    const events = await prisma.matchEvent.findMany({
      where: { matchId: parseInt(req.params.id) },
      include: { player: { select: { name: true, email: true } } },
      orderBy: { eventTimestamp: 'asc' }
    });
    res.json(events);
  } catch (error) {
    console.error('GET /events error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------- CREATE ----------

/**
 * POST /api/matches/log — standalone match creation (new flow).
 */
router.post('/log', auth, [
  body('sportName').notEmpty().withMessage('sportName is required'),
  body('formatName').notEmpty().withMessage('formatName is required'),
  body('teams.team1.name').notEmpty().withMessage('team1 name required'),
  body('teams.team2.name').notEmpty().withMessage('team2 name required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { match, confirmations } = await matchLogging.createMatch({
      ...req.body,
      createdBy: req.user.id,
    });

    const matchId = match.id || match._id;
    const fullMatch = await prisma.match.findUnique({
      where: { id: parseInt(matchId) },
      include: INCLUDE_MATCH
    });
    res.status(201).json({ match: fullMatch || match, confirmations });
  } catch (error) {
    console.error('POST /log error:', error);
    res.status(error.status || 500).json({ message: error.message || 'Server error' });
  }
});

/**
 * POST /api/matches — legacy create from booking or tournament.
 */
router.post('/', auth, async (req, res) => {
  try {
    const { booking: bookingId, tournamentId, fixtureId, formatName: bodyFormatName, matchDate: bodyMatchDate, matchType: bodyMatchType } = req.body;

    if (bookingId && tournamentId) {
      return res.status(400).json({ message: 'Provide either booking or tournamentId, not both' });
    }
    if (!bookingId && !tournamentId) {
      return res.status(400).json({ message: 'Provide booking ID or tournamentId' });
    }

    let teamsFromBody = req.body.teams;
    if (!fixtureId && (!teamsFromBody || !teamsFromBody.team1?.name || !teamsFromBody.team2?.name)) {
      return res.status(400).json({ message: 'teams.team1.name and teams.team2.name are required when not using fixtureId' });
    }

    let sportDoc;
    let formatName;
    let matchPayload = { status: 'scheduled' };

    if (bookingId) {
      if (!bodyFormatName || !String(bodyFormatName).trim()) {
        return res.status(400).json({ message: 'formatName is required when creating match from booking' });
      }
      const booking = await prisma.booking.findUnique({
        where: { id: parseInt(bookingId) },
        include: { venue: true }
      });
      if (!booking) return res.status(404).json({ message: 'Booking not found' });
      if (booking.userId !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      const sportName = (booking.sport || '').toLowerCase();
      sportDoc = await prisma.sport.findFirst({ where: { name: sportName, isActive: true }, include: { formats: true } });
      if (!sportDoc) return res.status(400).json({ message: 'Sport not found or inactive.' });
      formatName = (bodyFormatName || '').trim();
      matchPayload.bookingId = booking.id;
      matchPayload.venueId = booking.venueId;
      matchPayload.matchDate = booking.bookingDate;
      matchPayload.teams = teamsFromBody;
    } else {
      const tournament = await prisma.tournament.findUnique({
        where: { id: parseInt(tournamentId) },
        include: { venue: true }
      });
      if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
      if (tournament.createdById !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized to add matches to this tournament' });
      }
      const sportName = (tournament.sport || '').toLowerCase();
      sportDoc = await prisma.sport.findFirst({ where: { name: sportName, isActive: true }, include: { formats: true } });
      if (!sportDoc) return res.status(400).json({ message: 'Sport not found or inactive for this tournament.' });
      formatName = (bodyFormatName || tournament.matchFormatName || '').trim();
      if (!formatName) return res.status(400).json({ message: 'Format name is required for tournament match' });
      matchPayload.tournamentId = tournament.id;
      matchPayload.venueId = tournament.venueId || undefined;
      matchPayload.location = tournament.venueId ? undefined : tournament.location;
      matchPayload.matchDate = bodyMatchDate ? new Date(bodyMatchDate) : (tournament.startDate || new Date());

      if (fixtureId) {
        const fixture = await prisma.tournamentFixture.findFirst({
          where: { id: parseInt(fixtureId), tournamentId: parseInt(tournamentId) }
        });
        if (!fixture) return res.status(404).json({ message: 'Fixture not found for this tournament' });
        if (fixture.matchId) return res.status(400).json({ message: 'This fixture slot already has a match' });
        const teams = tournament.teams ? (typeof tournament.teams === 'string' ? JSON.parse(tournament.teams) : tournament.teams) : [];
        const teamsArr = Array.isArray(teams) ? teams : [];
        const t1Ref = typeof fixture.team1Ref === 'number' ? fixture.team1Ref : (fixture.team1Ref && typeof fixture.team1Ref === 'object' ? parseInt(fixture.team1Ref) : null);
        const t2Ref = typeof fixture.team2Ref === 'number' ? fixture.team2Ref : (fixture.team2Ref && typeof fixture.team2Ref === 'object' ? parseInt(fixture.team2Ref) : null);
        if (fixture.team1Type === 'team' && fixture.team2Type === 'team' &&
            typeof t1Ref === 'number' && typeof t2Ref === 'number' &&
            teamsArr[t1Ref] && teamsArr[t2Ref]) {
          const t1 = teamsArr[t1Ref];
          const t2 = teamsArr[t2Ref];
          matchPayload.teams = { team1: { name: t1.name, players: t1.players || [] }, team2: { name: t2.name, players: t2.players || [] } };
        } else {
          matchPayload.teams = teamsFromBody;
          if (!matchPayload.teams?.team1?.name || !matchPayload.teams?.team2?.name) {
            return res.status(400).json({ message: 'For winner slots pass teams in body' });
          }
        }
      } else {
        matchPayload.teams = teamsFromBody;
      }
    }

    const format = sportDoc.formats?.find(f => f.name && f.name.toLowerCase() === formatName.toLowerCase());
    if (!format) {
      return res.status(400).json({ message: `Format "${formatName}" not found. Available: ${(sportDoc.formats || []).map(f => f.name).join(', ')}` });
    }

    const team1Players = Array.isArray(matchPayload.teams?.team1?.players) ? matchPayload.teams.team1.players : [];
    const team2Players = Array.isArray(matchPayload.teams?.team2?.players) ? matchPayload.teams.team2.players : [];
    if (team1Players.length > format.playersPerTeam || team2Players.length > format.playersPerTeam) {
      return res.status(400).json({ message: `Format allows ${format.playersPerTeam} players per team` });
    }

    const scoreType = getScoringType(sportDoc, format.name);
    const match = await prisma.match.create({
      data: {
        ...matchPayload,
        sportId: sportDoc.id,
        sportName: sportDoc.name,
        formatName: format.name,
        playersPerTeam: format.playersPerTeam,
        scoreType,
        matchType: bodyMatchType || (tournamentId ? 'TOURNAMENT' : 'COMPETITIVE'),
        createdById: req.user.id,
      }
    });

    if (fixtureId && tournamentId) {
      await prisma.tournamentFixture.updateMany({
        where: { id: parseInt(fixtureId), tournamentId: parseInt(tournamentId) },
        data: { matchId: match.id, status: 'scheduled' }
      });
    }

    const fullMatch = await prisma.match.findUnique({
      where: { id: match.id },
      include: INCLUDE_MATCH
    });
    res.status(201).json(fullMatch);
  } catch (error) {
    console.error('POST / error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------- SCORE & EVENT LOGGING ----------

// PUT /api/matches/:id/scores — log or update scores
router.put('/:id/scores', auth, async (req, res) => {
  try {
    const match = await matchLogging.logScore(req.params.id, req.body.scores, req.user.id);
    const scoreType = match.scoreType;
    const summary = getScoreSummary(scoreType, match.scores);
    const out = { ...match, scoreSummary: summary };
    res.json(out);
  } catch (error) {
    console.error('PUT /scores error:', error);
    res.status(error.status || 500).json({ message: error.message || 'Server error' });
  }
});

// POST /api/matches/:id/events — log match events (EVENT_LOGGING)
router.post('/:id/events', auth, [
  body('events').isArray({ min: 1 }).withMessage('events array is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const created = await matchLogging.logEvents(req.params.id, req.body.events);
    res.status(201).json(created);
  } catch (error) {
    console.error('POST /events error:', error);
    res.status(error.status || 500).json({ message: error.message || 'Server error' });
  }
});

// ---------- CONFIRMATION FLOW ----------

// POST /api/matches/:id/confirm — confirm or reject match result
router.post('/:id/confirm', auth, [
  body('decision').isIn(['CONFIRMED', 'REJECTED']).withMessage('decision must be CONFIRMED or REJECTED'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const result = await matchLogging.confirmMatch(req.params.id, req.user.id, req.body.decision);
    const fullMatch = await prisma.match.findUnique({
      where: { id: parseInt(result.match.id || result.match._id) },
      include: INCLUDE_MATCH
    });
    res.json({ ...result, match: fullMatch || result.match });
  } catch (error) {
    console.error('POST /confirm error:', error);
    res.status(error.status || 500).json({ message: error.message || 'Server error' });
  }
});

// ---------- LIFECYCLE ----------

// PUT /api/matches/:id/start — start match (real-time scoring)
router.put('/:id/start', auth, async (req, res) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!match) return res.status(404).json({ message: 'Match not found' });
    if (!['scheduled', 'DRAFT', 'CONFIRMED'].includes(match.status)) {
      return res.status(400).json({ message: `Cannot start match in ${match.status} status` });
    }
    const updated = await prisma.match.update({
      where: { id: match.id },
      data: { status: 'in_progress' }
    });
    try {
      const getIO = require('../socket').getIO;
      if (getIO) {
        const io = getIO();
        if (io) io.to(`match:${match.id}`).emit('match:status', { matchId: match.id, status: 'in_progress' });
      }
    } catch (_) {}
    res.json(updated);
  } catch (error) {
    console.error('PUT /start error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/matches/:id/complete — complete match and process stats
router.put('/:id/complete', auth, async (req, res) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!match) return res.status(404).json({ message: 'Match not found' });

    let winnerTeam = match.winnerTeam;
    if (!winnerTeam && match.scores) {
      const scoreType = match.scoreType || 'simple';
      winnerTeam = matchLogging.determineWinner(scoreType, match.scores);
    }

    await prisma.match.update({
      where: { id: match.id },
      data: { status: 'COMPLETED', winnerTeam }
    });

    try {
      const getIO = require('../socket').getIO;
      if (getIO) {
        const io = getIO();
        if (io) io.to(`match:${match.id}`).emit('match:status', { matchId: match.id, status: 'COMPLETED' });
      }
    } catch (_) {}

    if (match.tournamentId) {
      await prisma.tournamentFixture.updateMany({
        where: { matchId: match.id },
        data: { status: 'completed' }
      });
    }

    await matchLogging.processMatchStats({ ...match, winnerTeam });

    const updated = await prisma.match.findUnique({
      where: { id: match.id },
      include: INCLUDE_MATCH
    });
    res.json({ message: 'Match completed and stats processed', match: updated });
  } catch (error) {
    console.error('PUT /complete error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/matches/:id/cancel — cancel a match
router.put('/:id/cancel', auth, async (req, res) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!match) return res.status(404).json({ message: 'Match not found' });
    if (['COMPLETED', 'completed'].includes(match.status)) {
      return res.status(400).json({ message: 'Cannot cancel a completed match' });
    }
    const updated = await prisma.match.update({
      where: { id: match.id },
      data: { status: 'CANCELLED' }
    });
    res.json({ message: 'Match cancelled', match: updated });
  } catch (error) {
    console.error('PUT /cancel error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------- PLAYER STATS (per-match) ----------

// PUT /api/matches/:id/player-stats — update per-match player stats
router.put('/:id/player-stats', auth, [
  body('player').notEmpty().withMessage('Player ID is required'),
  body('stats').notEmpty().withMessage('Stats are required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const match = await prisma.match.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!match) return res.status(404).json({ message: 'Match not found' });

    const { player, team, stats } = req.body;
    const playerId = parseInt(player);
    const playerStatsArr = Array.isArray(match.playerStats) ? match.playerStats : (match.playerStats ? JSON.parse(JSON.stringify(match.playerStats)) : []);
    const idx = playerStatsArr.findIndex(ps => String(ps.player) === String(playerId) || ps.player === playerId);
    if (idx >= 0) {
      playerStatsArr[idx].stats = stats;
      playerStatsArr[idx].team = team;
    } else {
      playerStatsArr.push({ player: playerId, team, stats });
    }
    await prisma.match.update({
      where: { id: match.id },
      data: { playerStats: playerStatsArr }
    });
    const updated = await prisma.match.findUnique({
      where: { id: match.id },
      include: INCLUDE_MATCH
    });
    res.json(updated);
  } catch (error) {
    console.error('PUT /player-stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------- AUTO-MATCH CREATION ----------

/**
 * POST /api/matches/auto-create — auto-create a match from a completed activity.
 */
router.post('/auto-create', auth, [
  body('sourceType').isIn(['open_play', 'booking', 'tournament_match', 'training']).withMessage('Invalid sourceType'),
  body('sportName').notEmpty().withMessage('sportName required'),
  body('formatName').notEmpty().withMessage('formatName required'),
  body('teams.team1.name').notEmpty().withMessage('team1 name required'),
  body('teams.team2.name').notEmpty().withMessage('team2 name required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const result = await matchLogging.autoCreateMatch({
      ...req.body,
      createdBy: req.user.id,
    });

    const matchId = result.match?.id || result.match?._id;
    const fullMatch = matchId ? await prisma.match.findUnique({
      where: { id: parseInt(matchId) },
      include: INCLUDE_MATCH
    }) : null;
    res.status(201).json({ ...result, match: fullMatch || result.match });
  } catch (error) {
    console.error('POST /auto-create error:', error);
    res.status(error.status || 500).json({ message: error.message || 'Server error' });
  }
});

module.exports = router;
