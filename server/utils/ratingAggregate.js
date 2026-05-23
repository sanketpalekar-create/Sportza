/**
 * Compute average rating and review count for venues or trainers.
 * Used to attach to venue/trainer profile and list responses (discovery).
 */

const prisma = require('../lib/prisma');

async function getVenueRatingStats(venueId) {
  const vid = typeof venueId === 'number' ? venueId : parseInt(venueId, 10);
  const result = await prisma.venueReview.aggregate({
    where: { venueId: vid },
    _avg: { rating: true },
    _count: { rating: true }
  });
  if (result._count.rating === 0) return { averageRating: null, reviewCount: 0 };
  return {
    averageRating: Math.round((result._avg.rating || 0) * 100) / 100,
    reviewCount: result._count.rating
  };
}

async function getTrainerRatingStats(trainerId) {
  const tid = typeof trainerId === 'number' ? trainerId : parseInt(trainerId, 10);
  const result = await prisma.trainerReview.aggregate({
    where: { trainerId: tid },
    _avg: { rating: true },
    _count: { rating: true }
  });
  if (result._count.rating === 0) return { averageRating: null, reviewCount: 0 };
  return {
    averageRating: Math.round((result._avg.rating || 0) * 100) / 100,
    reviewCount: result._count.rating
  };
}

/** Attach averageRating and reviewCount to multiple venues (list). */
async function attachVenueRatings(venues) {
  if (!venues || venues.length === 0) return venues;
  const ids = venues.map(v => (v.id ?? v._id)).filter(Boolean).map(id => typeof id === 'number' ? id : parseInt(id, 10));
  if (ids.length === 0) return venues;

  const stats = await prisma.venueReview.groupBy({
    by: ['venueId'],
    where: { venueId: { in: ids } },
    _avg: { rating: true },
    _count: { rating: true }
  });

  const map = Object.fromEntries(
    stats.map(s => [
      String(s.venueId),
      { averageRating: Math.round((s._avg.rating || 0) * 100) / 100, reviewCount: s._count.rating }
    ])
  );

  return venues.map(v => {
    const o = v && typeof v === 'object' ? { ...v } : v;
    const vid = o.id ?? o._id;
    const key = vid != null ? String(vid) : null;
    const s = key ? (map[key] || { averageRating: null, reviewCount: 0 }) : { averageRating: null, reviewCount: 0 };
    o.averageRating = s.averageRating;
    o.reviewCount = s.reviewCount;
    return o;
  });
}

/** Attach averageRating and reviewCount to multiple trainers (list). Items can be User (trainer) docs or objects with trainer: { id }. */
async function attachTrainerRatings(usersOrBatches) {
  if (!usersOrBatches || usersOrBatches.length === 0) return usersOrBatches;
  const idList = usersOrBatches
    .map(t => {
      const tid = t.trainer && (t.trainer.id ?? t.trainer._id ?? t.trainer);
      return tid ?? t.id ?? t._id;
    })
    .filter(Boolean)
    .map(id => (typeof id === 'number' ? id : parseInt(id, 10)))
    .filter(id => !isNaN(id));

  if (idList.length === 0) return usersOrBatches;

  const stats = await prisma.trainerReview.groupBy({
    by: ['trainerId'],
    where: { trainerId: { in: idList } },
    _avg: { rating: true },
    _count: { rating: true }
  });

  const map = Object.fromEntries(
    stats.map(s => [
      String(s.trainerId),
      { averageRating: Math.round((s._avg.rating || 0) * 100) / 100, reviewCount: s._count.rating }
    ])
  );

  return usersOrBatches.map(t => {
    const o = t && typeof t === 'object' ? { ...t } : t;
    const id = t.trainer && (t.trainer.id ?? t.trainer._id)
      ? String(t.trainer.id ?? t.trainer._id)
      : (t.id ?? t._id)
        ? String(t.id ?? t._id)
        : null;
    const s = id ? (map[id] || { averageRating: null, reviewCount: 0 }) : { averageRating: null, reviewCount: 0 };
    o.averageRating = s.averageRating;
    o.reviewCount = s.reviewCount;
    return o;
  });
}

module.exports = {
  getVenueRatingStats,
  getTrainerRatingStats,
  attachVenueRatings,
  attachTrainerRatings
};
