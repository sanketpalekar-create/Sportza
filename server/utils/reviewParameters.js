/**
 * Default parameters for trainer monthly reviews (sports + cognitive characteristics).
 * Used by batch review UI and validation. Can be extended per-sport later.
 */
const DEFAULT_REVIEW_PARAMETERS = [
  { id: 'skill', label: 'Technical skill', category: 'sport', min: 1, max: 5 },
  { id: 'fitness', label: 'Fitness & stamina', category: 'sport', min: 1, max: 5 },
  { id: 'gameSense', label: 'Game sense / awareness', category: 'sport', min: 1, max: 5 },
  { id: 'consistency', label: 'Consistency', category: 'sport', min: 1, max: 5 },
  { id: 'teamwork', label: 'Teamwork & cooperation', category: 'cognitive', min: 1, max: 5 },
  { id: 'communication', label: 'Communication', category: 'cognitive', min: 1, max: 5 },
  { id: 'attitude', label: 'Attitude & effort', category: 'cognitive', min: 1, max: 5 },
  { id: 'discipline', label: 'Discipline & focus', category: 'cognitive', min: 1, max: 5 }
];

const RATING_MIN = 1;
const RATING_MAX = 5;

function getDefaultReviewParameters() {
  return DEFAULT_REVIEW_PARAMETERS;
}

function getParameterIds() {
  return DEFAULT_REVIEW_PARAMETERS.map(p => p.id);
}

/**
 * Validate ratings object: keys should be from parameter ids, values 1-5.
 * @param {Object} ratings
 * @returns {{ valid: boolean, error?: string }}
 */
function validateRatings(ratings) {
  if (!ratings || typeof ratings !== 'object') return { valid: true };
  const ids = getParameterIds();
  for (const [key, value] of Object.entries(ratings)) {
    if (!ids.includes(key)) continue;
    const num = typeof value === 'number' ? value : parseInt(value, 10);
    if (!Number.isInteger(num) || num < RATING_MIN || num > RATING_MAX) {
      return { valid: false, error: `Rating "${key}" must be between ${RATING_MIN} and ${RATING_MAX}` };
    }
  }
  return { valid: true };
}

module.exports = {
  DEFAULT_REVIEW_PARAMETERS,
  RATING_MIN,
  RATING_MAX,
  getDefaultReviewParameters,
  getParameterIds,
  validateRatings
};
