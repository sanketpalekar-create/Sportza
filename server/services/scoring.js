/**
 * Real-time scoring for different sports and formats.
 * Defines score structures and validation for: simple (football, basketball, etc.),
 * cricket (runs/wickets/overs), tennis, padel (sets/games/points), pickleball (rally or service scoring).
 * Pickleball: rally point = every rally scores; service point = only serving side can score (traditional).
 */

const SCORING_TYPES = ['simple', 'cricket', 'tennis', 'padel', 'badminton', 'pickleball', 'pickleball_rally', 'pickleball_service'];

/**
 * Get scoring type for a sport format. Uses format.config.scoringType or infers from sport name.
 * @param {Object} sportDoc - Sport document (with formats)
 * @param {string} formatName - Format name (e.g. '11-a-side', 'singles')
 * @returns {string} - One of SCORING_TYPES
 */
function getScoringType(sportDoc, formatName) {
  if (!sportDoc || !sportDoc.formats) return 'simple';
  const format = sportDoc.formats.find(
    f => f.name && f.name.toLowerCase() === (formatName || '').toLowerCase()
  );
  const fromConfig = format && format.config && format.config.scoringType;
  if (fromConfig && SCORING_TYPES.includes(fromConfig)) return fromConfig;
  if (fromConfig === 'pickleball') return 'pickleball_rally'; // legacy
  const name = (sportDoc.name || '').toLowerCase();
  if (name === 'cricket') return 'cricket';
  if (name === 'tennis') return 'tennis';
  if (name === 'padel') return 'padel';
  if (name === 'badminton') return 'badminton';
  if (name === 'pickleball') return 'pickleball_rally';
  return 'simple';
}

/**
 * Validate and normalize score payload for the given scoring type.
 * @param {string} scoringType
 * @param {Object} scores - Raw scores from request body
 * @returns {{ valid: boolean, error?: string, scores: Object }}
 */
function validateAndNormalizeScores(scoringType, scores) {
  if (!scores || typeof scores !== 'object') {
    return { valid: false, error: 'scores object is required', scores: null };
  }

  switch (scoringType) {
    case 'simple': {
      const team1 = typeof scores.team1 === 'number' ? scores.team1 : parseInt(scores.team1, 10);
      const team2 = typeof scores.team2 === 'number' ? scores.team2 : parseInt(scores.team2, 10);
      if (!Number.isInteger(team1) || team1 < 0 || !Number.isInteger(team2) || team2 < 0) {
        return { valid: false, error: 'team1 and team2 must be non-negative integers', scores: null };
      }
      return { valid: true, scores: { team1, team2 } };
    }

    case 'cricket': {
      const t1 = scores.team1 && typeof scores.team1 === 'object' ? scores.team1 : {};
      const t2 = scores.team2 && typeof scores.team2 === 'object' ? scores.team2 : {};
      const runs1 = Math.max(0, parseInt(t1.runs, 10) || 0);
      const wickets1 = Math.min(10, Math.max(0, parseInt(t1.wickets, 10) || 0));
      const runs2 = Math.max(0, parseInt(t2.runs, 10) || 0);
      const wickets2 = Math.min(10, Math.max(0, parseInt(t2.wickets, 10) || 0));
      const overs1 = t1.overs != null ? (typeof t1.overs === 'number' ? t1.overs : parseFloat(t1.overs)) : null;
      const overs2 = t2.overs != null ? (typeof t2.overs === 'number' ? t2.overs : parseFloat(t2.overs)) : null;
      const currentInnings = scores.currentInnings === 2 ? 2 : 1;
      return {
        valid: true,
        scores: {
          team1: { runs: runs1, wickets: wickets1, ...(overs1 != null && !Number.isNaN(overs1) && { overs: Math.round(overs1 * 100) / 100 }) },
          team2: { runs: runs2, wickets: wickets2, ...(overs2 != null && !Number.isNaN(overs2) && { overs: Math.round(overs2 * 100) / 100 }) },
          currentInnings
        }
      };
    }

    case 'tennis':
    case 'padel': {
      // sets: [ { team1: 6, team2: 4 }, { team1: 3, team2: 2 } ], currentGame: { team1: 2, team2: 1 }, tiebreak?: { team1: 5, team2: 3 }
      const sets = Array.isArray(scores.sets) ? scores.sets : [];
      const normalizedSets = sets.slice(0, 5).map(s => ({
        team1: Math.max(0, parseInt(s.team1, 10) || 0),
        team2: Math.max(0, parseInt(s.team2, 10) || 0)
      }));
      let currentGame = null;
      if (scores.currentGame && typeof scores.currentGame === 'object') {
        const g = scores.currentGame;
        currentGame = {
          team1: Math.max(0, parseInt(g.team1, 10) || 0),
          team2: Math.max(0, parseInt(g.team2, 10) || 0)
        };
      }
      let tiebreak = null;
      if (scores.tiebreak && typeof scores.tiebreak === 'object') {
        tiebreak = {
          team1: Math.max(0, parseInt(scores.tiebreak.team1, 10) || 0),
          team2: Math.max(0, parseInt(scores.tiebreak.team2, 10) || 0)
        };
      }
      return {
        valid: true,
        scores: {
          sets: normalizedSets,
          ...(currentGame && { currentGame }),
          ...(tiebreak && { tiebreak })
        }
      };
    }

    case 'badminton': {
      // Sets-based: best of 3 sets to 21 (or 30 cap). Same shape as tennis sets.
      const sets = Array.isArray(scores.sets) ? scores.sets : [];
      const normalizedSets = sets.slice(0, 3).map(s => ({
        team1: Math.max(0, parseInt(s.team1, 10) || 0),
        team2: Math.max(0, parseInt(s.team2, 10) || 0)
      }));
      // Also accept simple team1/team2 for quick result
      if (normalizedSets.length === 0 && scores.team1 != null && scores.team2 != null) {
        return { valid: true, scores: { team1: Math.max(0, parseInt(scores.team1, 10) || 0), team2: Math.max(0, parseInt(scores.team2, 10) || 0) } };
      }
      return { valid: true, scores: { sets: normalizedSets } };
    }

    case 'pickleball':
    case 'pickleball_rally': {
      // Rally scoring: every rally scores a point. team1, team2; optional games[] for best-of-3.
      if (scores.games && Array.isArray(scores.games)) {
        const games = scores.games.slice(0, 5).map(g => ({
          team1: Math.max(0, parseInt(g.team1, 10) || 0),
          team2: Math.max(0, parseInt(g.team2, 10) || 0)
        }));
        let currentGame = null;
        if (scores.currentGame && typeof scores.currentGame === 'object') {
          currentGame = {
            team1: Math.max(0, parseInt(scores.currentGame.team1, 10) || 0),
            team2: Math.max(0, parseInt(scores.currentGame.team2, 10) || 0)
          };
        }
        return { valid: true, scores: { games, ...(currentGame && { currentGame }) } };
      }
      const team1 = typeof scores.team1 === 'number' ? scores.team1 : parseInt(scores.team1, 10);
      const team2 = typeof scores.team2 === 'number' ? scores.team2 : parseInt(scores.team2, 10);
      if (!Number.isInteger(team1) || team1 < 0 || !Number.isInteger(team2) || team2 < 0) {
        return { valid: false, error: 'team1 and team2 must be non-negative integers', scores: null };
      }
      return { valid: true, scores: { team1, team2 } };
    }

    case 'pickleball_service': {
      // Full engine state (currentGame A/B, rallyLog, etc.) from web — pass through when marked.
      if (scores && typeof scores === 'object' && scores.config && scores.config.sport === 'pickleball_service') {
        return { valid: true, scores: { ...scores } };
      }
      // Legacy flat: team1, team2, servingTeam, serverNumber (1 or 2 for doubles).
      const team1 = typeof scores.team1 === 'number' ? scores.team1 : parseInt(scores.team1, 10);
      const team2 = typeof scores.team2 === 'number' ? scores.team2 : parseInt(scores.team2, 10);
      if (!Number.isInteger(team1) || team1 < 0 || !Number.isInteger(team2) || team2 < 0) {
        return { valid: false, error: 'team1 and team2 must be non-negative integers', scores: null };
      }
      const servingTeam = scores.servingTeam === 'team2' ? 'team2' : 'team1';
      const serverNumber = scores.serverNumber === 2 ? 2 : 1;
      return {
        valid: true,
        scores: { team1, team2, servingTeam, serverNumber }
      };
    }

    default:
      return { valid: false, error: `Unknown scoring type: ${scoringType}`, scores: null };
  }
}

/**
 * Get a display summary of the score (e.g. for live banner).
 * @param {string} scoringType
 * @param {Object} scores
 * @returns {string}
 */
function getScoreSummary(scoringType, scores) {
  if (!scores) return '0 - 0';
  switch (scoringType) {
    case 'simple':
    case 'pickleball':
    case 'pickleball_rally':
      if (scores.team1 != null && scores.team2 != null) return `${scores.team1} - ${scores.team2}`;
      if (scores.games && scores.games.length) {
        const t1 = scores.games.reduce((a, g) => a + (g.team1 > g.team2 ? 1 : 0), 0);
        const t2 = scores.games.reduce((a, g) => a + (g.team2 > g.team1 ? 1 : 0), 0);
        return `Sets ${t1}-${t2} | Current: ${(scores.currentGame && scores.currentGame.team1) || 0}-${(scores.currentGame && scores.currentGame.team2) || 0}`;
      }
      return '0 - 0';
    case 'pickleball_service':
      if (scores.team1 != null && scores.team2 != null) {
        const serve = scores.servingTeam === 'team2' ? ` (Team2 serve ${scores.serverNumber || 1})` : ` (Team1 serve ${scores.serverNumber || 1})`;
        return `${scores.team1} - ${scores.team2}${serve}`;
      }
      return '0 - 0';
    case 'cricket':
      return `${scores.team1?.runs ?? 0}/${scores.team1?.wickets ?? 0} v ${scores.team2?.runs ?? 0}/${scores.team2?.wickets ?? 0}`;
    case 'badminton':
      if (scores.sets && scores.sets.length) {
        return scores.sets.map(s => `${s.team1}-${s.team2}`).join(', ');
      }
      if (scores.team1 != null) return `${scores.team1} - ${scores.team2}`;
      return '0 - 0';
    case 'tennis':
    case 'padel':
      if (scores.sets && scores.sets.length) {
        const setStr = scores.sets.map(s => `${s.team1}-${s.team2}`).join(' ');
        const game = scores.currentGame ? ` (${scores.currentGame.team1}-${scores.currentGame.team2})` : '';
        const tb = scores.tiebreak ? ` TB ${scores.tiebreak.team1}-${scores.tiebreak.team2}` : '';
        return setStr + game + tb;
      }
      return '0-0';
    default:
      return String(scores.team1 ?? 0) + ' - ' + String(scores.team2 ?? 0);
  }
}

/**
 * Derive simple team1/team2 totals for backward compatibility and winner detection.
 * For simple/pickleball: direct. For cricket: runs. For tennis/padel: sets won.
 */
function getSimpleTotals(scoringType, scores) {
  if (!scores) return { team1: 0, team2: 0 };
  switch (scoringType) {
    case 'simple':
    case 'pickleball':
    case 'pickleball_rally':
    case 'pickleball_service':
      if (scores.games && Array.isArray(scores.games)) {
        const team1 = scores.games.reduce((a, g) => a + (g.team1 > g.team2 ? 1 : 0), 0);
        const team2 = scores.games.reduce((a, g) => a + (g.team2 > g.team1 ? 1 : 0), 0);
        return { team1, team2 };
      }
      return { team1: scores.team1 ?? 0, team2: scores.team2 ?? 0 };
    case 'cricket':
      return { team1: scores.team1?.runs ?? 0, team2: scores.team2?.runs ?? 0 };
    case 'badminton':
      if (scores.sets && scores.sets.length) {
        const team1 = scores.sets.filter(s => s.team1 > s.team2).length;
        const team2 = scores.sets.filter(s => s.team2 > s.team1).length;
        return { team1, team2 };
      }
      return { team1: scores.team1 ?? 0, team2: scores.team2 ?? 0 };
    case 'tennis':
    case 'padel':
      if (scores.sets && scores.sets.length) {
        const team1 = scores.sets.filter(s => s.team1 > s.team2).length;
        const team2 = scores.sets.filter(s => s.team2 > s.team1).length;
        return { team1, team2 };
      }
      return { team1: 0, team2: 0 };
    default:
      return { team1: scores.team1 ?? 0, team2: scores.team2 ?? 0 };
  }
}

module.exports = {
  SCORING_TYPES,
  getScoringType,
  validateAndNormalizeScores,
  getScoreSummary,
  getSimpleTotals
};
