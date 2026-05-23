const express = require('express');
const { Prisma } = require('@prisma/client');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');
const { recalculatePlayerStats } = require('../services/matchLogging');
const { getScoreSummary } = require('../services/scoring');

const router = express.Router();

// GET /api/stats/player/:playerId — player stats (optionally filtered by sport)
router.get('/player/:playerId', async (req, res) => {
  try {
    const playerId = parseInt(req.params.playerId, 10);
    if (isNaN(playerId)) {
      return res.status(400).json({ message: 'Invalid player ID' });
    }
    const { sport } = req.query;

    const where = { playerId };
    if (sport) where.sport = sport;

    const stats = await prisma.playerStats.findMany({
      where,
      include: { player: { select: { name: true, email: true } } }
    });
    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/stats/me — current user's stats
router.get('/me', auth, async (req, res) => {
  try {
    const { sport } = req.query;
    const userId = req.user.id ?? req.user._id;
    const where = { playerId: userId };
    if (sport) where.sport = sport;

    const stats = await prisma.playerStats.findMany({ where });
    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/stats/me/reviews — current user's monthly batch reviews
router.get('/me/reviews', auth, async (req, res) => {
  try {
    const userId = req.user.id ?? req.user._id;
    const where = { playerId: userId };
    const batchId = req.query.batch;
    if (batchId) where.batchId = parseInt(batchId, 10);
    const fromYear = req.query.fromYear != null ? parseInt(req.query.fromYear, 10) : null;
    const fromMonth = req.query.fromMonth != null ? parseInt(req.query.fromMonth, 10) : null;
    const toYear = req.query.toYear != null ? parseInt(req.query.toYear, 10) : null;
    const toMonth = req.query.toMonth != null ? parseInt(req.query.toMonth, 10) : null;
    const useRange = (Number.isInteger(fromYear) && Number.isInteger(fromMonth)) || (Number.isInteger(toYear) && Number.isInteger(toMonth));
    if (useRange) {
      const andConditions = [];
      if (Number.isInteger(fromYear) && Number.isInteger(fromMonth)) {
        andConditions.push({
          OR: [
            { year: { gt: fromYear } },
            { year: fromYear, month: { gte: fromMonth } }
          ]
        });
      }
      if (Number.isInteger(toYear) && Number.isInteger(toMonth)) {
        andConditions.push({
          OR: [
            { year: { lt: toYear } },
            { year: toYear, month: { lte: toMonth } }
          ]
        });
      }
      if (andConditions.length) where.AND = andConditions;
    } else {
      const year = req.query.year != null ? parseInt(req.query.year, 10) : null;
      const month = req.query.month != null ? parseInt(req.query.month, 10) : null;
      if (Number.isInteger(year)) where.year = year;
      if (Number.isInteger(month) && month >= 1 && month <= 12) where.month = month;
    }

    const reviews = await prisma.playerBatchReview.findMany({
      where,
      include: {
        batch: { select: { name: true, sport: true } },
        trainer: { select: { name: true, email: true } }
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });
    res.json(reviews);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/stats/leaderboard — leaderboard by sport
router.get('/leaderboard', async (req, res) => {
  try {
    const { sport } = req.query;
    if (!sport) return res.status(400).json({ message: 'Sport parameter is required' });

    const sportDoc = await prisma.sport.findFirst({
      where: { name: sport, isActive: true }
    });

    let leaderboard = await prisma.playerStats.findMany({
      where: { sport },
      include: { player: { select: { name: true, email: true } } },
      take: 100
    });

    const statFields = (sportDoc?.statFields && Array.isArray(sportDoc.statFields)) ? sportDoc.statFields : [];
    const leaderboardField = statFields.find(f => f.leaderboard) || statFields[0];
    const sortKey = leaderboardField?.key;

    if (sortKey) {
      leaderboard.sort((a, b) => {
        const va = (a.stats && typeof a.stats === 'object' && a.stats[sortKey] != null) ? Number(a.stats[sortKey]) : 0;
        const vb = (b.stats && typeof b.stats === 'object' && b.stats[sortKey] != null) ? Number(b.stats[sortKey]) : 0;
        return vb - va;
      });
    } else {
      leaderboard.sort((a, b) => (b.winPercentage || 0) - (a.winPercentage || 0));
    }

    res.json(leaderboard.slice(0, 50));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/stats/player/:playerId/matches — match history for a player
router.get('/player/:playerId/matches', async (req, res) => {
  try {
    const playerId = parseInt(req.params.playerId, 10);
    if (isNaN(playerId)) {
      return res.status(400).json({ message: 'Invalid player ID' });
    }
    const { sport, status, matchType, limit = 20 } = req.query;
    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);

    const conditions = [
      Prisma.sql`teams IS NOT NULL`,
      Prisma.sql`(JSON_CONTAINS(teams, CAST(${playerId} AS JSON), '$.team1.players') OR JSON_CONTAINS(teams, CAST(${playerId} AS JSON), '$.team2.players'))`
    ];
    if (sport) conditions.push(Prisma.sql`sportName = ${sport}`);
    if (status) conditions.push(Prisma.sql`status = ${status}`);
    if (matchType) conditions.push(Prisma.sql`matchType = ${matchType}`);

    const matchRows = await prisma.$queryRaw`
      SELECT id FROM matches
      WHERE ${Prisma.join(conditions, ' AND ')}
      ORDER BY matchDate DESC
      LIMIT ${limitNum}
    `;

    const matchIds = matchRows.map(r => r.id);
    if (matchIds.length === 0) {
      return res.json([]);
    }

    const matches = await prisma.match.findMany({
      where: { id: { in: matchIds } },
      include: {
        venue: { select: { name: true, locationCity: true, locationAddr: true, locationPin: true } },
        booking: { select: { bookingDate: true, startTime: true, endTime: true } }
      },
      orderBy: { matchDate: 'desc' }
    });

    const idOrder = new Map(matchIds.map((id, i) => [id, i]));
    matches.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));

    const enriched = matches.map(m => {
      const obj = { ...m };
      const scoreType = m.scoreType || 'simple';
      obj.scoreSummary = getScoreSummary(scoreType, m.scores);
      if (m.venue) {
        obj.venue = {
          ...m.venue,
          location: {
            city: m.venue.locationCity,
            address: m.venue.locationAddr,
            pincode: m.venue.locationPin
          }
        };
      }
      return obj;
    });

    res.json(enriched);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/stats/me/sport-summary — per-sport summary for current user
router.get('/me/sport-summary', auth, async (req, res) => {
  try {
    const userId = req.user.id ?? req.user._id;
    const stats = await prisma.playerStats.findMany({
      where: { playerId: userId }
    });

    const summary = stats.map(s => ({
      sport: s.sport,
      totalMatches: s.totalMatches,
      matchesWon: s.matchesWon,
      matchesLost: s.matchesLost,
      winPercentage: s.winPercentage,
      stats: s.stats,
    }));

    const totals = {
      totalMatches: summary.reduce((a, s) => a + s.totalMatches, 0),
      totalWins: summary.reduce((a, s) => a + s.matchesWon, 0),
      totalLosses: summary.reduce((a, s) => a + s.matchesLost, 0),
      sportsPlayed: summary.length,
    };
    totals.overallWinRate = totals.totalMatches > 0
      ? Math.round((totals.totalWins / totals.totalMatches) * 10000) / 100
      : 0;

    res.json({ sports: summary, totals });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/stats/recalculate — force recalculation of a player's stats for a sport
router.post('/recalculate', auth, async (req, res) => {
  try {
    const { playerId, sport } = req.body;
    const targetPlayer = playerId != null ? parseInt(playerId, 10) : (req.user.id ?? req.user._id);
    if (!sport) return res.status(400).json({ message: 'sport is required' });

    await recalculatePlayerStats(targetPlayer, sport);
    const updated = await prisma.playerStats.findFirst({
      where: { playerId: targetPlayer, sport }
    });
    res.json({ message: 'Stats recalculated', stats: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
