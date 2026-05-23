const express = require('express');
const prisma = require('../lib/prisma');
const { attachTrainerRatings, getTrainerRatingStats } = require('../utils/ratingAggregate');

const router = express.Router();

/**
 * GET /api/trainings/explore
 * Player discovery of trainers and batches.
 * Filters: sport, city, skill_level, search
 */
router.get('/explore', async (req, res) => {
  try {
    const { sport, city, skill_level, search, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));

    const filter = { isActive: true };
    if (sport && sport.trim()) {
      filter.sport = { contains: sport.trim() };
    }

    let batches = await prisma.batch.findMany({
      where: filter,
      include: {
        trainer: { select: { id: true, name: true, email: true, sports: true, locationCity: true, locationAddr: true } },
        venue: { select: { id: true, name: true, locationCity: true, locationAddr: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });

    if (city && city.trim()) {
      const cityLower = city.trim().toLowerCase();
      batches = batches.filter(b => {
        if (b.venue && b.venue.locationCity && b.venue.locationCity.toLowerCase() === cityLower) return true;
        if (b.location && b.location.city && b.location.city.toLowerCase() === cityLower) return true;
        return false;
      });
    }

    if (search && search.trim()) {
      const searchLower = search.trim().toLowerCase();
      batches = batches.filter(b =>
        b.name.toLowerCase().includes(searchLower) ||
        b.trainer?.name?.toLowerCase().includes(searchLower) ||
        b.sport?.toLowerCase().includes(searchLower)
      );
    }

    const batchesWithDetails = await Promise.all(batches.map(async (b) => {
      const playerCount = await prisma.batchMembership.count({
        where: { batchId: b.id, status: 'active' }
      });
      const trainerProfile = b.trainer
        ? await prisma.trainerProfile.findFirst({
            where: { userId: b.trainer.id }
          })
        : null;

      return {
        ...b,
        venue: b.venue ? { ...b.venue, location: { city: b.venue.locationCity, address: b.venue.locationAddr } } : null,
        playerCount,
        isFull: b.capacity ? playerCount >= b.capacity : false,
        trainerProfile: trainerProfile ? {
          bio: trainerProfile.bio,
          yearsExperience: trainerProfile.yearsExperience,
          certifications: trainerProfile.certifications,
          achievements: trainerProfile.achievements,
          sports: trainerProfile.sports,
        } : null,
        place: b.venue
          ? { type: 'venue', id: b.venue.id, name: b.venue.name, location: { city: b.venue.locationCity, address: b.venue.locationAddr } }
          : { type: 'location', location: b.location || {} }
      };
    }));

    const withRatings = await attachTrainerRatings(batchesWithDetails);

    const total = withRatings.length;
    const startIndex = (pageNum - 1) * pageSize;
    const paginated = withRatings.slice(startIndex, startIndex + pageSize);

    res.json({
      batches: paginated,
      total,
      page: pageNum,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/trainings/trainer/:trainerId
 * Get full trainer profile with batches for player viewing.
 */
router.get('/trainer/:trainerId', async (req, res) => {
  try {
    const trainer = await prisma.user.findUnique({
      where: { id: parseInt(req.params.trainerId) },
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
    if (!trainer) return res.status(404).json({ message: 'Trainer not found' });

    const trainerVenues = await prisma.trainerVenue.findMany({
      where: { userId: parseInt(req.params.trainerId) },
      include: { venue: { select: { id: true, name: true, locationCity: true, locationAddr: true } } }
    });
    const associatedVenues = trainerVenues.map(tv => ({
      ...tv.venue,
      location: { city: tv.venue.locationCity, address: tv.venue.locationAddr }
    }));

    const profile = await prisma.trainerProfile.findFirst({
      where: { userId: parseInt(req.params.trainerId) }
    });

    const batches = await prisma.batch.findMany({
      where: { trainerId: parseInt(req.params.trainerId), isActive: true },
      include: { venue: { select: { id: true, name: true, locationCity: true, locationAddr: true } } }
    });

    const batchesWithPlayers = await Promise.all(batches.map(async (b) => {
      const playerCount = await prisma.batchMembership.count({
        where: { batchId: b.id, status: 'active' }
      });
      return {
        ...b,
        venue: b.venue ? { ...b.venue, location: { city: b.venue.locationCity, address: b.venue.locationAddr } } : null,
        playerCount
      };
    }));

    const stats = await getTrainerRatingStats(req.params.trainerId);

    res.json({
      trainer: {
        ...trainer,
        location: trainer.locationCity ? { city: trainer.locationCity, address: trainer.locationAddr } : null,
        associatedVenues
      },
      profile: profile || {},
      averageRating: stats.averageRating,
      reviewCount: stats.reviewCount,
      batches: batchesWithPlayers
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
