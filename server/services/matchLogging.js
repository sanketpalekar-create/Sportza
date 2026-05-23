const prisma = require('../lib/prisma');
const { getScoringType, validateAndNormalizeScores, getSimpleTotals } = require('./scoring');

const DUPLICATE_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Check for duplicate matches between the same set of players within a short time window.
 * Prevents accidental double-logging.
 */
async function checkDuplicate(sportId, allPlayerIds, matchDate) {
  const windowStart = new Date(matchDate.getTime() - DUPLICATE_WINDOW_MS);
  const windowEnd = new Date(matchDate.getTime() + DUPLICATE_WINDOW_MS);

  const sportIdInt = typeof sportId === 'number' ? sportId : parseInt(sportId);
  const recentMatches = await prisma.match.findMany({
    where: {
      sportId: sportIdInt,
      matchDate: { gte: windowStart, lte: windowEnd },
      status: { notIn: ['CANCELLED', 'REJECTED', 'cancelled'] }
    }
  });

  const playerIdSet = new Set(allPlayerIds.map(p => String(p)));
  for (const m of recentMatches) {
    const teams = m.teams && typeof m.teams === 'object' ? m.teams : {};
    const t1Players = (teams.team1?.players || []).map(p => String(p));
    const t2Players = (teams.team2?.players || []).map(p => String(p));
    const matchPlayerSet = new Set([...t1Players, ...t2Players]);
    const allPresent = [...playerIdSet].every(pid => matchPlayerSet.has(pid));
    if (allPresent && playerIdSet.size === matchPlayerSet.size) {
      return m;
    }
  }
  return null;
}

/**
 * Determine winner from scores and scoreType.
 * Returns 'team1', 'team2', or 'draw'.
 */
function determineWinner(scoreType, scores) {
  const totals = getSimpleTotals(scoreType, scores);
  if (totals.team1 > totals.team2) return 'team1';
  if (totals.team2 > totals.team1) return 'team2';
  return 'draw';
}

/**
 * Create a match with teams and players.
 * Validates sport, format, minimum players, and duplicate prevention.
 *
 * @param {Object} opts
 * @param {string} opts.sportName - Sport slug
 * @param {string} opts.formatName - Format name
 * @param {string} opts.matchType - OPEN_PLAY|PRACTICE|COMPETITIVE|TOURNAMENT
 * @param {string} opts.loggingMode - QUICK_RESULT|SCORE_LOGGING|EVENT_LOGGING
 * @param {Object} opts.teams - { team1: { name, players: [userId] }, team2: { ... } }
 * @param {Date|string} opts.matchDate
 * @param {string} [opts.venueId]
 * @param {string} [opts.bookingId]
 * @param {string} [opts.tournamentId]
 * @param {string} [opts.activityId]
 * @param {string} opts.createdBy - User ID
 * @param {Object} [opts.scores] - Optional scores for QUICK_RESULT
 * @param {string} [opts.winner] - Optional explicit winner for QUICK_RESULT ('team1'|'team2'|'draw')
 * @returns {{ match: Object, confirmations: Object[] }}
 */
async function createMatch(opts) {
  const {
    sportName, formatName, matchType = 'COMPETITIVE', loggingMode = 'QUICK_RESULT',
    teams, matchDate, venueId, bookingId, tournamentId, activityId,
    createdBy, scores: rawScores, winner
  } = opts;

  const sportDoc = await prisma.sport.findFirst({
    where: { name: sportName.toLowerCase(), isActive: true },
    include: { formats: true }
  });
  if (!sportDoc) throw Object.assign(new Error(`Sport "${sportName}" not found or inactive`), { status: 400 });

  const fmt = formatName ? formatName.trim() : '';
  const format = sportDoc.formats.find(f => f.name && f.name.toLowerCase() === fmt.toLowerCase());
  if (!format) {
    const available = sportDoc.formats.map(f => f.name).join(', ');
    throw Object.assign(new Error(`Format "${fmt}" not found. Available: ${available}`), { status: 400 });
  }

  if (!teams?.team1?.name || !teams?.team2?.name) {
    throw Object.assign(new Error('Both team names are required'), { status: 400 });
  }

  const t1Players = Array.isArray(teams.team1.players) ? teams.team1.players.map(p => parseInt(p, 10)) : [];
  const t2Players = Array.isArray(teams.team2.players) ? teams.team2.players.map(p => parseInt(p, 10)) : [];

  if (t1Players.length > format.playersPerTeam || t2Players.length > format.playersPerTeam) {
    throw Object.assign(new Error(`Format allows max ${format.playersPerTeam} players per team`), { status: 400 });
  }

  const allPlayers = [...t1Players, ...t2Players];
  if (allPlayers.length < 2) {
    throw Object.assign(new Error('At least 2 players required'), { status: 400 });
  }

  const date = new Date(matchDate || Date.now());
  const dup = await checkDuplicate(sportDoc.id, allPlayers, date);
  if (dup) {
    throw Object.assign(new Error(`Possible duplicate: match ${dup.id} found within 30 minutes with same players`), { status: 409 });
  }

  const scoreType = getScoringType(sportDoc, format.name);

  let processedScores = { team1: 0, team2: 0 };
  let winnerTeam = null;
  let status = 'PENDING_CONFIRMATION';

  if (loggingMode === 'QUICK_RESULT' && (rawScores || winner)) {
    if (rawScores) {
      const validated = validateAndNormalizeScores(scoreType, rawScores);
      if (!validated.valid) throw Object.assign(new Error(validated.error), { status: 400 });
      processedScores = validated.scores;
      winnerTeam = winner || determineWinner(scoreType, processedScores);
    } else if (winner) {
      winnerTeam = winner;
    }
  } else if (loggingMode === 'QUICK_RESULT') {
    status = 'DRAFT';
  }

  const createdById = createdBy ? parseInt(createdBy, 10) : null;

  const match = await prisma.match.create({
    data: {
      sportId: sportDoc.id,
      sportName: sportDoc.name,
      formatName: format.name,
      playersPerTeam: format.playersPerTeam,
      matchType,
      loggingMode,
      teams,
      matchDate: date,
      scores: processedScores,
      scoreType,
      winnerTeam,
      status,
      createdById,
      ...(venueId && { venueId: parseInt(venueId, 10) }),
      ...(bookingId && { bookingId: parseInt(bookingId, 10) }),
      ...(tournamentId && { tournamentId: parseInt(tournamentId, 10) }),
      ...(activityId && { activityId: parseInt(activityId, 10) }),
    }
  });

  const confirmations = [];
  const opponentPlayers = t1Players.some(p => p === createdById) ? t2Players : t1Players;

  if (status === 'PENDING_CONFIRMATION' && opponentPlayers.length > 0) {
    for (const pid of opponentPlayers) {
      const conf = await prisma.matchConfirmation.create({
        data: { matchId: match.id, playerId: pid }
      });
      confirmations.push(conf);
    }
  }

  return { match, confirmations };
}

/**
 * Log scores for an existing match.
 * Used by SCORE_LOGGING mode.
 */
async function logScore(matchId, scores, userId) {
  const matchIdInt = parseInt(matchId, 10);
  const match = await prisma.match.findUnique({
    where: { id: matchIdInt },
    include: { sport: { include: { formats: true } } }
  });
  if (!match) throw Object.assign(new Error('Match not found'), { status: 404 });

  const scoreType = match.scoreType || getScoringType(match.sport, match.formatName);
  const validated = validateAndNormalizeScores(scoreType, scores);
  if (!validated.valid) throw Object.assign(new Error(validated.error), { status: 400 });

  const allPlayers = [
    ...((match.teams?.team1?.players || []).map(p => parseInt(p, 10))),
    ...((match.teams?.team2?.players || []).map(p => parseInt(p, 10)))
  ];
  const userIdInt = userId ? parseInt(userId, 10) : null;
  const opponents = allPlayers.filter(p => p !== userIdInt);

  if (match.status === 'DRAFT') {
    for (const pid of opponents) {
      const exists = await prisma.matchConfirmation.findFirst({
        where: { matchId: matchIdInt, playerId: pid }
      });
      if (!exists) {
        await prisma.matchConfirmation.create({
          data: { matchId: matchIdInt, playerId: pid }
        });
      }
    }
  }

  const updatedMatch = await prisma.match.update({
    where: { id: matchIdInt },
    data: {
      scores: validated.scores,
      winnerTeam: determineWinner(scoreType, validated.scores),
      ...(match.status === 'DRAFT' && { status: 'PENDING_CONFIRMATION' })
    }
  });

  try {
    const getIO = require('../socket').getIO;
    if (getIO) {
      const io = getIO();
      if (io) io.to(`match:${match.id}`).emit('match:score', { matchId: match.id, scores: validated.scores, scoreType });
    }
  } catch (_) { /* socket optional */ }

  return updatedMatch;
}

/**
 * Log detailed events for a match (EVENT_LOGGING mode).
 * @param {string} matchId
 * @param {Object[]} events - Array of { team, player, eventType, eventValue, eventTimestamp, metadata }
 * @returns {Object[]} Created MatchEvent documents
 */
async function logEvents(matchId, events) {
  const matchIdInt = parseInt(matchId, 10);
  const match = await prisma.match.findUnique({ where: { id: matchIdInt } });
  if (!match) throw Object.assign(new Error('Match not found'), { status: 404 });

  if (!Array.isArray(events) || events.length === 0) {
    throw Object.assign(new Error('events array is required'), { status: 400 });
  }

  const docs = events.map(ev => ({
    matchId: matchIdInt,
    team: ev.team,
    playerId: ev.player ? parseInt(ev.player, 10) : null,
    eventType: (ev.eventType || '').toLowerCase().trim(),
    eventValue: ev.eventValue ?? 1,
    eventTimestamp: ev.eventTimestamp || new Date(),
    metadata: ev.metadata || {}
  }));

  const created = await prisma.matchEvent.createMany({ data: docs });

  if (match.loggingMode !== 'EVENT_LOGGING') {
    await prisma.match.update({
      where: { id: matchIdInt },
      data: { loggingMode: 'EVENT_LOGGING' }
    });
  }

  return prisma.matchEvent.findMany({
    where: { matchId: matchIdInt },
    orderBy: { eventTimestamp: 'asc' },
    take: docs.length
  });
}

/**
 * Confirm or reject a match by an opponent player.
 * When all opponents confirm: match status → CONFIRMED, trigger stats.
 */
async function confirmMatch(matchId, playerId, decision) {
  const matchIdInt = parseInt(matchId, 10);
  const playerIdInt = parseInt(playerId, 10);

  const match = await prisma.match.findUnique({ where: { id: matchIdInt } });
  if (!match) throw Object.assign(new Error('Match not found'), { status: 404 });

  if (match.status !== 'PENDING_CONFIRMATION') {
    throw Object.assign(new Error(`Match is ${match.status}, not pending confirmation`), { status: 400 });
  }

  const conf = await prisma.matchConfirmation.findFirst({
    where: { matchId: matchIdInt, playerId: playerIdInt }
  });
  if (!conf) throw Object.assign(new Error('No confirmation request found for this player'), { status: 404 });
  if (conf.status !== 'PENDING') {
    throw Object.assign(new Error(`Already ${conf.status}`), { status: 400 });
  }

  await prisma.matchConfirmation.update({
    where: { id: conf.id },
    data: {
      status: decision === 'CONFIRMED' ? 'CONFIRMED' : 'REJECTED',
      respondedAt: new Date()
    }
  });

  if (decision === 'REJECTED') {
    await prisma.match.update({
      where: { id: matchIdInt },
      data: { status: 'REJECTED' }
    });
    return { match: { ...match, status: 'REJECTED' }, allConfirmed: false };
  }

  const allConfs = await prisma.matchConfirmation.findMany({ where: { matchId: matchIdInt } });
  const allConfirmed = allConfs.every(c => c.status === 'CONFIRMED');

  if (allConfirmed) {
    await prisma.match.update({
      where: { id: matchIdInt },
      data: { status: 'CONFIRMED' }
    });
    const updatedMatch = await prisma.match.findUnique({ where: { id: matchIdInt } });
    await processMatchStats(updatedMatch);
    return { match: updatedMatch, allConfirmed };
  }

  const updatedMatch = await prisma.match.findUnique({ where: { id: matchIdInt } });
  return { match: updatedMatch, allConfirmed };
}

/**
 * Compute and persist player stats from a confirmed/completed match.
 * Only COMPETITIVE and TOURNAMENT matches affect lifetime stats.
 * PRACTICE and OPEN_PLAY are logged but don't alter rankings.
 */
async function processMatchStats(match) {
  if (match.statsProcessed) return;
  if (!['COMPETITIVE', 'TOURNAMENT'].includes(match.matchType)) {
    await prisma.match.update({
      where: { id: match.id },
      data: { statsProcessed: true }
    });
    return;
  }

  const sportName = match.sportName;
  const allPlayers = [
    ...(match.teams?.team1?.players || []).map(p => ({ playerId: parseInt(p, 10), team: 'team1' })),
    ...(match.teams?.team2?.players || []).map(p => ({ playerId: parseInt(p, 10), team: 'team2' })),
  ];

  const sportDoc = await prisma.sport.findFirst({ where: { name: sportName, isActive: true } });
  const statFields = sportDoc?.statFields || [];

  for (const { playerId, team } of allPlayers) {
    const won = match.winnerTeam === team;
    const lost = match.winnerTeam && match.winnerTeam !== 'draw' && match.winnerTeam !== team;

    const playerStatsArr = Array.isArray(match.playerStats) ? match.playerStats : [];
    const ps = playerStatsArr.find(s => String(s?.player) === String(playerId));
    const matchData = ps ? (ps.stats || {}) : {};

    let stats = await prisma.playerStats.findFirst({
      where: { playerId, sport: sportName }
    });

    const baseData = stats ? {
      totalMatches: stats.totalMatches + 1,
      matchesWon: stats.matchesWon + (won ? 1 : 0),
      matchesLost: stats.matchesLost + (lost ? 1 : 0),
    } : {
      totalMatches: 1,
      matchesWon: won ? 1 : 0,
      matchesLost: lost ? 1 : 0,
    };
    const totalMatches = baseData.totalMatches;
    const winPercentage = totalMatches > 0 ? Math.round((baseData.matchesWon / totalMatches) * 10000) / 100 : 0;

    let statsObj = stats?.stats && typeof stats.stats === 'object' ? { ...stats.stats } : {};
    for (const field of statFields) {
      const key = field.key;
      const matchKey = field.matchKey || key;
      const agg = field.aggregate || 'sum';
      const raw = matchData[matchKey];
      if (raw === undefined) continue;
      const num = typeof raw === 'number' ? raw : (parseFloat(raw) || 0);
      const current = typeof statsObj[key] === 'number' ? statsObj[key] : 0;

      if (agg === 'sum') statsObj[key] = Math.round((current + num) * 100) / 100;
      else if (agg === 'max') statsObj[key] = Math.max(current, num);
      else if (agg === 'avg') {
        const sum = current * (totalMatches - 1) + num;
        statsObj[key] = totalMatches > 0 ? Math.round((sum / totalMatches) * 100) / 100 : num;
      }
    }

    await prisma.playerStats.upsert({
      where: { playerId_sport: { playerId, sport: sportName } },
      create: {
        playerId,
        sport: sportName,
        ...baseData,
        winPercentage,
        stats: statsObj,
        lastUpdated: new Date()
      },
      update: {
        ...baseData,
        winPercentage,
        stats: statsObj,
        lastUpdated: new Date()
      }
    });
  }

  await prisma.match.update({
    where: { id: match.id },
    data: { statsProcessed: true }
  });
}

/**
 * Full recalculation of a player's stats from all confirmed/completed matches.
 * Used when a match is edited or deleted.
 */
async function recalculatePlayerStats(playerId, sportName) {
  const playerIdInt = parseInt(playerId, 10);

  const allMatches = await prisma.match.findMany({
    where: {
      sportName,
      status: { in: ['CONFIRMED', 'COMPLETED', 'completed'] },
      matchType: { in: ['COMPETITIVE', 'TOURNAMENT'] }
    }
  });

  const matches = allMatches.filter(m => {
    const t1 = (m.teams?.team1?.players || []).map(p => String(p));
    const t2 = (m.teams?.team2?.players || []).map(p => String(p));
    return t1.includes(String(playerId)) || t2.includes(String(playerId));
  });

  const sportDoc = await prisma.sport.findFirst({ where: { name: sportName, isActive: true } });
  const statFields = sportDoc?.statFields || [];

  let totalMatches = 0, matchesWon = 0, matchesLost = 0;
  const aggregated = {};

  for (const m of matches) {
    totalMatches += 1;
    const inTeam1 = (m.teams?.team1?.players || []).some(p => String(p) === String(playerId));
    const team = inTeam1 ? 'team1' : 'team2';
    const won = m.winnerTeam === team;
    const lost = m.winnerTeam && m.winnerTeam !== 'draw' && m.winnerTeam !== team;
    if (won) matchesWon += 1;
    if (lost) matchesLost += 1;

    const playerStatsArr = Array.isArray(m.playerStats) ? m.playerStats : [];
    const ps = playerStatsArr.find(s => String(s?.player) === String(playerId));
    const matchData = ps ? (ps.stats || {}) : {};

    for (const field of statFields) {
      const key = field.key;
      const matchKey = field.matchKey || key;
      const raw = matchData[matchKey];
      if (raw === undefined) continue;
      const num = typeof raw === 'number' ? raw : (parseFloat(raw) || 0);

      if (!aggregated[key]) aggregated[key] = { values: [], aggregate: field.aggregate || 'sum' };
      aggregated[key].values.push(num);
    }
  }

  const statsObj = {};
  for (const [key, { values, aggregate }] of Object.entries(aggregated)) {
    if (aggregate === 'sum') statsObj[key] = Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;
    else if (aggregate === 'max') statsObj[key] = Math.max(...values);
    else if (aggregate === 'avg') statsObj[key] = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
  }

  await prisma.playerStats.upsert({
    where: { playerId_sport: { playerId: playerIdInt, sport: sportName } },
    create: {
      playerId: playerIdInt,
      sport: sportName,
      totalMatches,
      matchesWon,
      matchesLost,
      winPercentage: totalMatches > 0 ? Math.round((matchesWon / totalMatches) * 10000) / 100 : 0,
      stats: statsObj,
      lastUpdated: new Date()
    },
    update: {
      totalMatches,
      matchesWon,
      matchesLost,
      winPercentage: totalMatches > 0 ? Math.round((matchesWon / totalMatches) * 10000) / 100 : 0,
      stats: statsObj,
      lastUpdated: new Date()
    }
  });
}

/**
 * Auto-create a match from a completed activity (booking, open play, training session).
 * Pre-populates teams and players from the source activity.
 *
 * @param {Object} opts
 * @param {string} opts.sourceType - 'open_play'|'booking'|'tournament_match'|'training'
 * @param {string} opts.sourceId - Source document ID
 * @param {string} opts.sportName
 * @param {string} opts.formatName
 * @param {Object} opts.teams
 * @param {Date} opts.matchDate
 * @param {string} [opts.venueId]
 * @param {string} opts.createdBy
 * @returns {{ match: Object }}
 */
async function autoCreateMatch(opts) {
  const { sourceType, sourceId, sportName, formatName, teams, matchDate, venueId, createdBy } = opts;

  let matchType = 'OPEN_PLAY';
  if (sourceType === 'tournament_match') matchType = 'TOURNAMENT';
  else if (sourceType === 'training') matchType = 'PRACTICE';
  else if (sourceType === 'booking') matchType = 'COMPETITIVE';

  const result = await createMatch({
    sportName,
    formatName,
    matchType,
    loggingMode: 'QUICK_RESULT',
    teams,
    matchDate,
    venueId,
    activityId: sourceId,
    createdBy,
  });

  return result;
}

module.exports = {
  createMatch,
  logScore,
  logEvents,
  confirmMatch,
  processMatchStats,
  recalculatePlayerStats,
  autoCreateMatch,
  checkDuplicate,
  determineWinner,
};
