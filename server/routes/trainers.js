const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');
const { getTrainerRatingStats, attachTrainerRatings } = require('../utils/ratingAggregate');
const { getDashboard, generateSettlementReport } = require('../services/trainerService');

const router = express.Router();

// ==================== TRAINER DASHBOARD ====================

/** Get trainer dashboard data */
router.get('/me/dashboard', auth, async (req, res) => {
  try {
    if (req.user.role !== 'trainer' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only trainers can access the dashboard' });
    }
    const data = await getDashboard(req.user.id);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================== TRAINER PROFILE (EXTENDED) ====================

/** Get my trainer profile (extended bio, certs, achievements) */
router.get('/me/profile', auth, async (req, res) => {
  try {
    if (req.user.role !== 'trainer' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only trainers can access their profile' });
    }
    let profile = await prisma.trainerProfile.findFirst({
      where: { userId: parseInt(req.user.id) }
    });
    if (!profile) {
      profile = await prisma.trainerProfile.create({
        data: { userId: parseInt(req.user.id) }
      });
    }
    const user = await prisma.user.findUnique({
      where: { id: parseInt(req.user.id) },
      select: { name: true, email: true, sports: true, locationCity: true, locationAddr: true, locationPin: true }
    });
    const trainerVenues = await prisma.trainerVenue.findMany({
      where: { userId: parseInt(req.user.id) },
      include: { venue: { select: { id: true, name: true, locationCity: true, locationAddr: true } } }
    });
    const associatedVenues = trainerVenues.map(tv => ({
      ...tv.venue,
      location: { city: tv.venue.locationCity, address: tv.venue.locationAddr }
    }));
    const stats = await getTrainerRatingStats(req.user.id);

    const batches = await prisma.batch.findMany({
      where: { trainerId: parseInt(req.user.id), isActive: true },
      include: { venue: { select: { name: true, locationCity: true, locationAddr: true } } }
    });
    const batchesWithPlayers = await Promise.all(batches.map(async (b) => {
      const count = await prisma.batchMembership.count({
        where: { batchId: b.id, status: 'active' }
      });
      return {
        ...b,
        venue: b.venue ? { ...b.venue, location: { city: b.venue.locationCity, address: b.venue.locationAddr } } : null,
        playerCount: count
      };
    }));

    res.json({
      user: { ...user, associatedVenues },
      profile: { ...profile },
      averageRating: stats.averageRating,
      reviewCount: stats.reviewCount,
      batches: batchesWithPlayers
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Update my trainer profile */
router.patch('/me/profile', auth, [
  body('bio').optional().isString().isLength({ max: 2000 }),
  body('yearsExperience').optional().isInt({ min: 0 }),
  body('sports').optional().isArray(),
  body('certifications').optional().isArray(),
  body('achievements').optional().isArray()
], async (req, res) => {
  try {
    if (req.user.role !== 'trainer' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only trainers can update their profile' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    let profile = await prisma.trainerProfile.findFirst({
      where: { userId: parseInt(req.user.id) }
    });
    if (!profile) {
      profile = await prisma.trainerProfile.create({
        data: { userId: parseInt(req.user.id) }
      });
    }

    const { bio, yearsExperience, sports, certifications, achievements } = req.body;
    const updateData = {};
    if (bio !== undefined) updateData.bio = bio;
    if (yearsExperience !== undefined) updateData.yearsExperience = yearsExperience;
    if (sports !== undefined) updateData.sports = sports;
    if (certifications !== undefined) updateData.certifications = certifications;
    if (achievements !== undefined) updateData.achievements = achievements;

    const updated = await prisma.trainerProfile.update({
      where: { id: profile.id },
      data: updateData
    });
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================== SETTLEMENT REPORTS ====================

/** Get monthly settlement report */
router.get('/me/settlement', auth, async (req, res) => {
  try {
    if (req.user.role !== 'trainer' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only trainers can view settlement reports' });
    }
    const now = new Date();
    const month = parseInt(req.query.month, 10) || (now.getMonth() + 1);
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const report = await generateSettlementReport(req.user.id, month, year);
    res.json(report);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** List trainers for discovery (optional sport, city). Returns trainers with averageRating and reviewCount. */
router.get('/', async (req, res) => {
  try {
    const { sport, city } = req.query;
    const filter = { role: 'trainer' };
    if (sport && sport.trim()) {
      const sportVal = sport.trim();
      const trainerIdsWithBatch = (await prisma.batch.findMany({
        where: { sport: sportVal, isActive: true },
        select: { trainerId: true }
      })).map(b => b.trainerId);
      if (trainerIdsWithBatch.length > 0) {
        filter.id = { in: trainerIdsWithBatch };
      }
    }
    let trainers = await prisma.user.findMany({
      where: filter,
      select: {
        id: true,
        name: true,
        email: true,
        sports: true,
        locationCity: true,
        locationAddr: true,
        locationPin: true
      }
    });

    const trainerVenueMap = {};
    const trainerVenues = await prisma.trainerVenue.findMany({
      where: { userId: { in: trainers.map(t => t.id) } },
      include: { venue: { select: { id: true, name: true, locationCity: true, locationAddr: true } } }
    });
    for (const tv of trainerVenues) {
      if (!trainerVenueMap[tv.userId]) trainerVenueMap[tv.userId] = [];
      trainerVenueMap[tv.userId].push({
        ...tv.venue,
        location: { city: tv.venue.locationCity, address: tv.venue.locationAddr }
      });
    }

    trainers = trainers.map(t => ({
      ...t,
      location: t.locationCity ? { city: t.locationCity, address: t.locationAddr } : null,
      associatedVenues: trainerVenueMap[t.id] || []
    }));

    if (city && city.trim()) {
      const cityLower = city.trim().toLowerCase();
      trainers = trainers.filter(t => {
        if (t.location && t.location.city && t.location.city.toLowerCase() === cityLower) return true;
        if (t.associatedVenues && t.associatedVenues.some(v => v && v.location && v.location.city && v.location.city.toLowerCase() === cityLower)) return true;
        return false;
      });
    }
    const withRatings = await attachTrainerRatings(trainers);
    res.json(withRatings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Get trainer profile for discovery (includes averageRating, reviewCount). */
router.get('/:id', async (req, res) => {
  try {
    const trainer = await prisma.user.findUnique({
      where: { id: parseInt(req.params.id) },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        sports: true,
        locationCity: true,
        locationAddr: true,
        locationPin: true
      }
    });
    if (!trainer) return res.status(404).json({ message: 'Trainer not found' });
    if (trainer.role !== 'trainer') return res.status(404).json({ message: 'Not a trainer' });

    const trainerVenues = await prisma.trainerVenue.findMany({
      where: { userId: parseInt(req.params.id) },
      include: { venue: { select: { id: true, name: true, locationCity: true, locationAddr: true, sports: true } } }
    });
    const associatedVenues = trainerVenues.map(tv => ({
      ...tv.venue,
      location: { city: tv.venue.locationCity, address: tv.venue.locationAddr }
    }));

    const stats = await getTrainerRatingStats(trainer.id);
    const out = {
      ...trainer,
      location: trainer.locationCity ? { city: trainer.locationCity, address: trainer.locationAddr } : null,
      associatedVenues,
      averageRating: stats.averageRating,
      reviewCount: stats.reviewCount
    };
    res.json(out);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** List reviews for a trainer (discovery). */
router.get('/:id/reviews', async (req, res) => {
  try {
    const trainer = await prisma.user.findUnique({
      where: { id: parseInt(req.params.id) },
      select: { role: true }
    });
    if (!trainer || trainer.role !== 'trainer') return res.status(404).json({ message: 'Trainer not found' });
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;
    const [reviews, total] = await Promise.all([
      prisma.trainerReview.findMany({
        where: { trainerId: parseInt(req.params.id) },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.trainerReview.count({ where: { trainerId: parseInt(req.params.id) } })
    ]);
    res.json({ reviews, total, page, limit });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Submit or update my review for a trainer (auth). Player can review only after completing at least 1 month in a batch with that trainer. */
router.post('/:id/reviews', auth, [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
  body('review').optional().isString().isLength({ max: 2000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const trainer = await prisma.user.findUnique({
      where: { id: parseInt(req.params.id) },
      select: { role: true }
    });
    if (!trainer || trainer.role !== 'trainer') return res.status(404).json({ message: 'Trainer not found' });
    if (req.user.role !== 'admin') {
      const hasCompletedMonth = await prisma.playerBatchReview.findFirst({
        where: { trainerId: parseInt(req.params.id), playerId: parseInt(req.user.id) }
      });
      if (!hasCompletedMonth) {
        return res.status(403).json({
          message: 'You can review a trainer only after completing at least 1 month in a batch with them. The trainer must have submitted a monthly review for you first.'
        });
      }
    }
    const rating = parseInt(req.body.rating, 10);
    const review = typeof req.body.review === 'string' ? req.body.review.trim().slice(0, 2000) : '';
    const existing = await prisma.trainerReview.findFirst({
      where: { trainerId: parseInt(req.params.id), userId: parseInt(req.user.id) }
    });
    let doc;
    if (existing) {
      doc = await prisma.trainerReview.update({
        where: { id: existing.id },
        data: { rating, review },
        include: { user: { select: { name: true } } }
      });
    } else {
      doc = await prisma.trainerReview.create({
        data: {
          trainerId: parseInt(req.params.id),
          userId: parseInt(req.user.id),
          rating,
          review
        },
        include: { user: { select: { name: true } } }
      });
    }
    res.json(doc);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Delete my review for a trainer (auth). */
router.delete('/:id/reviews/me', auth, async (req, res) => {
  try {
    const deleted = await prisma.trainerReview.deleteMany({
      where: { trainerId: parseInt(req.params.id), userId: parseInt(req.user.id) }
    });
    if (deleted.count === 0) return res.status(404).json({ message: 'Review not found' });
    res.json({ message: 'Review deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** List venues associated with the current trainer (or with given trainer if admin) */
router.get('/me/venues', auth, async (req, res) => {
  try {
    if (req.user.role !== 'trainer' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only trainers can view associated venues' });
    }
    const trainerVenues = await prisma.trainerVenue.findMany({
      where: { userId: parseInt(req.user.id) },
      include: { venue: { select: { id: true, name: true, locationCity: true, locationAddr: true, sports: true } } }
    });
    const venues = trainerVenues.map(tv => ({
      ...tv.venue,
      location: { city: tv.venue.locationCity, address: tv.venue.locationAddr }
    }));
    res.json(venues);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Add a venue to the current trainer's associated venues */
router.post('/me/venues', auth, async (req, res) => {
  try {
    if (req.user.role !== 'trainer' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only trainers can associate with venues' });
    }
    const { venue: venueId } = req.body;
    if (!venueId) {
      return res.status(400).json({ message: 'venue (venue id) is required' });
    }
    const venue = await prisma.venue.findUnique({
      where: { id: parseInt(venueId) }
    });
    if (!venue || !venue.isActive) {
      return res.status(404).json({ message: 'Venue not found or inactive' });
    }
    const existing = await prisma.trainerVenue.findFirst({
      where: { userId: parseInt(req.user.id), venueId: parseInt(venueId) }
    });
    if (existing) {
      return res.status(400).json({ message: 'Venue already associated' });
    }
    await prisma.trainerVenue.create({
      data: { userId: parseInt(req.user.id), venueId: parseInt(venueId) }
    });
    const trainerVenues = await prisma.trainerVenue.findMany({
      where: { userId: parseInt(req.user.id) },
      include: { venue: { select: { id: true, name: true, locationCity: true, locationAddr: true, sports: true } } }
    });
    const venues = trainerVenues.map(tv => ({
      ...tv.venue,
      location: { city: tv.venue.locationCity, address: tv.venue.locationAddr }
    }));
    res.json(venues);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Remove a venue from the current trainer's associated venues */
router.delete('/me/venues/:venueId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'trainer' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only trainers can manage associated venues' });
    }
    await prisma.trainerVenue.deleteMany({
      where: { userId: parseInt(req.user.id), venueId: parseInt(req.params.venueId) }
    });
    const trainerVenues = await prisma.trainerVenue.findMany({
      where: { userId: parseInt(req.user.id) },
      include: { venue: { select: { id: true, name: true, locationCity: true, locationAddr: true, sports: true } } }
    });
    const venues = trainerVenues.map(tv => ({
      ...tv.venue,
      location: { city: tv.venue.locationCity, address: tv.venue.locationAddr }
    }));
    res.json(venues);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Set full list of associated venues (trainer or admin) */
router.put('/me/venues', auth, async (req, res) => {
  try {
    if (req.user.role !== 'trainer' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only trainers can set associated venues' });
    }
    const venueIds = Array.isArray(req.body.venues) ? req.body.venues.map(id => parseInt(id)) : [];
    await prisma.trainerVenue.deleteMany({
      where: { userId: parseInt(req.user.id) }
    });
    if (venueIds.length > 0) {
      await prisma.trainerVenue.createMany({
        data: venueIds.map(venueId => ({ userId: parseInt(req.user.id), venueId }))
      });
    }
    const trainerVenues = await prisma.trainerVenue.findMany({
      where: { userId: parseInt(req.user.id) },
      include: { venue: { select: { id: true, name: true, locationCity: true, locationAddr: true, sports: true } } }
    });
    const venues = trainerVenues.map(tv => ({
      ...tv.venue,
      location: { city: tv.venue.locationCity, address: tv.venue.locationAddr }
    }));
    res.json(venues);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
