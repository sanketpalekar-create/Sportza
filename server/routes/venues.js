const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');
const { attachVenueRatings, getVenueRatingStats } = require('../utils/ratingAggregate');

const router = express.Router();

/** Normalize addOns: only include items with name, category, and valid price. */
function normalizeAddOns(addOns) {
  if (!Array.isArray(addOns)) return undefined;
  const valid = addOns.filter(a => a && a.name && a.category && typeof a.price === 'number' && a.price >= 0);
  return valid.length > 0 ? valid.map(a => ({
    name: String(a.name).trim(),
    category: a.category,
    price: Number(a.price),
    unit: a.unit && ['per_item', 'per_hour', 'per_session'].includes(a.unit) ? a.unit : 'per_item',
    sport: a.sport ? String(a.sport).trim() : undefined,
    description: a.description ? String(a.description).trim() : undefined
  })) : undefined;
}

// GET /api/venues/nearby — Venues for instant book (must be before /:id)
router.get('/nearby', async (req, res) => {
  try {
    const { city, sport, limit } = req.query;

    const where = { isActive: true };
    if (city) where.locationCity = city;

    const venues = await prisma.venue.findMany({
      where,
      include: {
        sportFacilities: { select: { id: true, name: true, surfaceType: true, sports: true } },
        sportRates: true
      },
      take: parseInt(limit) || 20,
      orderBy: { createdAt: 'desc' }
    });

    let result = venues;
    if (sport) {
      result = venues.filter(v => {
        const sports = Array.isArray(v.sports) ? v.sports : [];
        if (sports.includes(sport)) return true;
        if (v.sportRates?.some(sr => sr.sport === sport)) return true;
        return v.sportFacilities?.some(f => {
          const fs = Array.isArray(f.sports) ? f.sports : [];
          return fs.includes(sport);
        });
      });
    }

    const mapped = result.map(v => ({
      id: v.id,
      name: v.name,
      location: { city: v.locationCity, address: v.locationAddr, coords: v.locationCoords },
      pricePerHour: v.pricePerHour,
      gstRate: v.gstRate,
      images: v.images,
      facilities: v.sportFacilities,
      sportRates: v.sportRates
    }));

    res.json(mapped);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all venues (with optional filters)
router.get('/', async (req, res) => {
  try {
    const { sport, city, search } = req.query;
    const where = { isActive: true };
    if (city) where.locationCity = city;

    let venues = await prisma.venue.findMany({
      where,
      include: {
        sportFacilities: true,
        sportRates: true,
        addOns: true,
        owner: { select: { name: true, email: true, phone: true } }
      }
    });

    if (sport) {
      venues = venues.filter(v => {
        const s = v.sports;
        return Array.isArray(s) && s.includes(sport);
      });
    }
    if (search) {
      const searchLower = search.toLowerCase();
      venues = venues.filter(venue =>
        venue.name.toLowerCase().includes(searchLower) ||
        (venue.locationAddr && venue.locationAddr.toLowerCase().includes(searchLower))
      );
    }

    const withRatings = await attachVenueRatings(venues);
    res.json(withRatings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single venue (includes averageRating and reviewCount for discovery)
router.get('/:id', async (req, res) => {
  try {
    const venueId = parseInt(req.params.id, 10);
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      include: {
        sportFacilities: true,
        sportRates: true,
        addOns: true,
        owner: { select: { name: true, email: true, phone: true } }
      }
    });
    if (!venue) {
      return res.status(404).json({ message: 'Venue not found' });
    }
    const stats = await getVenueRatingStats(venue.id);
    const out = { ...venue };
    out.averageRating = stats.averageRating;
    out.reviewCount = stats.reviewCount;
    res.json(out);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// List reviews for a venue (for discovery / venue page)
router.get('/:id/reviews', async (req, res) => {
  try {
    const venueId = parseInt(req.params.id, 10);
    const venue = await prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) return res.status(404).json({ message: 'Venue not found' });
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;
    const reviews = await prisma.venueReview.findMany({
      where: { venueId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    });
    const total = await prisma.venueReview.count({ where: { venueId } });
    res.json({ reviews, total, page, limit });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit or update my review for a venue (auth)
router.post('/:id/reviews', auth, [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
  body('review').optional().isString().isLength({ max: 2000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const venueId = parseInt(req.params.id, 10);
    const venue = await prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) return res.status(404).json({ message: 'Venue not found' });
    const userId = req.user.id ?? req.user._id;
    const rating = parseInt(req.body.rating, 10);
    const review = typeof req.body.review === 'string' ? req.body.review.trim().slice(0, 2000) : '';
    let doc = await prisma.venueReview.findUnique({
      where: { venueId_userId: { venueId, userId } }
    });
    if (doc) {
      doc = await prisma.venueReview.update({
        where: { id: doc.id },
        data: { rating, review },
        include: { user: { select: { name: true } } }
      });
    } else {
      doc = await prisma.venueReview.create({
        data: { venueId, userId, rating, review },
        include: { user: { select: { name: true } } }
      });
    }
    res.json(doc);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete my review for a venue (auth)
router.delete('/:id/reviews/me', auth, async (req, res) => {
  try {
    const venueId = parseInt(req.params.id, 10);
    const userId = req.user.id ?? req.user._id;
    const deleted = await prisma.venueReview.deleteMany({
      where: { venueId, userId }
    });
    if (deleted.count === 0) return res.status(404).json({ message: 'Review not found' });
    res.json({ message: 'Review deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create venue (venue owner/admin only)
// Accept either legacy (sport + pricePerHour) or sportRates: [{ sport, rates: { morning, afternoon, evening, default? } }]
router.post('/', auth, [
  body('name').notEmpty().withMessage('Venue name is required'),
  body('address').notEmpty().withMessage('Address is required'),
  body('capacity').isInt({ min: 1 }).withMessage('Capacity must be a positive number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (req.user.role !== 'admin' && req.user.role !== 'venue_owner') {
      return res.status(403).json({ message: 'Not authorized to create venues' });
    }

    const { sportRates, sports, sport, sportFacilities, pricePerHour } = req.body;
    const sportsArray = Array.isArray(sports) && sports.length > 0 ? sports : (typeof sport === 'string' ? [sport] : []);
    const hasSportRates = sportRates && Array.isArray(sportRates) && sportRates.length > 0;
    const hasSportFacilities = sportFacilities && Array.isArray(sportFacilities) && sportFacilities.length > 0;
    if (!sportsArray.length && !hasSportRates && !hasSportFacilities) {
      return res.status(400).json({
        message: 'Provide sports (array), sportRates, or sportFacilities; for legacy use sports and pricePerHour'
      });
    }
    if (!hasSportRates && (pricePerHour == null || pricePerHour < 0) && !hasSportFacilities) {
      return res.status(400).json({ message: 'Legacy venue requires pricePerHour as a non-negative number' });
    }

    let finalSports = sportsArray;
    let finalSportFacilities = sportFacilities;
    if (hasSportFacilities) {
      const valid = sportFacilities.filter(f => f && Array.isArray(f.sports) && f.sports.length > 0);
      finalSportFacilities = valid.length > 0 ? valid : sportFacilities;
      const fromFacilities = [...new Set((finalSportFacilities || []).flatMap(f => (f.sports || []).filter(Boolean)))];
      finalSports = sportsArray.length > 0 ? sportsArray : fromFacilities;
    } else if (sportsArray.length === 0 && hasSportRates) {
      finalSports = sportRates.map(sr => sr.sport);
    } else if (sportsArray.length > 0) {
      finalSports = sportsArray;
    }

    let addOnsData = [];
    if (req.body.addOns !== undefined) {
      const normalized = normalizeAddOns(req.body.addOns);
      addOnsData = normalized || [];
    }

    const ownerId = req.user.id ?? req.user._id;
    const locationCity = req.body.location?.city || 'Pune';
    const locationAddr = req.body.address || req.body.location?.address || '';
    const locationPin = req.body.location?.pincode;

    const venue = await prisma.venue.create({
      data: {
        name: req.body.name,
        ownerId,
        sports: finalSports,
        locationCity,
        locationAddr,
        locationPin,
        locationCoords: req.body.location?.coords,
        facilities: req.body.facilities || [],
        capacity: req.body.capacity,
        pricePerHour: pricePerHour ?? null,
        images: req.body.images || [],
        gstRate: req.body.gstRate ?? 18,
        commissionPercent: req.body.commissionPercent ?? 0,
        sportFacilities: hasSportFacilities && finalSportFacilities?.length > 0 ? {
          create: finalSportFacilities.map(f => ({
            name: f.name,
            surfaceType: f.surfaceType,
            count: f.count ?? 1,
            sports: f.sports || []
          }))
        } : undefined,
        sportRates: hasSportRates ? {
          create: sportRates.map(sr => ({
            sport: sr.sport,
            minBookingHours: sr.minBookingHours,
            rates: sr.rates || {}
          }))
        } : undefined,
        addOns: addOnsData.length > 0 ? {
          create: addOnsData.map(a => ({
            name: a.name,
            category: a.category,
            price: a.price,
            unit: a.unit || 'per_item',
            sport: a.sport,
            description: a.description
          }))
        } : undefined
      },
      include: {
        sportFacilities: true,
        sportRates: true,
        addOns: true,
        owner: { select: { name: true, email: true, phone: true } }
      }
    });

    res.status(201).json(venue);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update venue
router.put('/:id', auth, async (req, res) => {
  try {
    const venueId = parseInt(req.params.id, 10);
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      include: { sportFacilities: true, sportRates: true, addOns: true }
    });
    if (!venue) {
      return res.status(404).json({ message: 'Venue not found' });
    }

    const userId = req.user.id ?? req.user._id;
    if (venue.ownerId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const updateData = {};
    const allowed = ['name', 'sports', 'gstRate', 'commissionPercent', 'facilities', 'capacity', 'pricePerHour', 'images', 'availability', 'isActive'];
    for (const k of allowed) {
      if (req.body[k] !== undefined) updateData[k] = req.body[k];
    }
    if (req.body.location) {
      if (req.body.location.city != null) updateData.locationCity = req.body.location.city;
      if (req.body.location.address != null) updateData.locationAddr = req.body.location.address;
      if (req.body.location.pincode != null) updateData.locationPin = req.body.location.pincode;
      if (req.body.location.coords != null) updateData.locationCoords = req.body.location.coords;
    }
    if (req.body.address != null) updateData.locationAddr = req.body.address;

    if (req.body.addOns !== undefined) {
      const normalized = normalizeAddOns(req.body.addOns) || [];
      await prisma.venueAddOn.deleteMany({ where: { venueId } });
      if (normalized.length > 0) {
        await prisma.venueAddOn.createMany({
          data: normalized.map(a => ({
            venueId,
            name: a.name,
            category: a.category,
            price: a.price,
            unit: a.unit || 'per_item',
            sport: a.sport,
            description: a.description
          }))
        });
      }
    }

    if (req.body.sportFacilities && Array.isArray(req.body.sportFacilities) && req.body.sportFacilities.length > 0) {
      const valid = req.body.sportFacilities.filter(f => f && Array.isArray(f.sports) && f.sports.length > 0);
      if (valid.length > 0) {
        await prisma.sportFacility.deleteMany({ where: { venueId } });
        await prisma.sportFacility.createMany({
          data: valid.map(f => ({
            venueId,
            name: f.name,
            surfaceType: f.surfaceType,
            count: f.count ?? 1,
            sports: f.sports || []
          }))
        });
        const fromFacilities = [...new Set(valid.flatMap(f => (f.sports || []).filter(Boolean)))];
        if (fromFacilities.length > 0) updateData.sports = fromFacilities;
      }
    }

    const updated = await prisma.venue.update({
      where: { id: venueId },
      data: updateData,
      include: {
        sportFacilities: true,
        sportRates: true,
        addOns: true,
        owner: { select: { name: true, email: true, phone: true } }
      }
    });
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete venue
router.delete('/:id', auth, async (req, res) => {
  try {
    const venueId = parseInt(req.params.id, 10);
    const venue = await prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) {
      return res.status(404).json({ message: 'Venue not found' });
    }

    const userId = req.user.id ?? req.user._id;
    if (venue.ownerId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await prisma.venue.update({
      where: { id: venueId },
      data: { isActive: false }
    });
    res.json({ message: 'Venue deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── Facility Pricing Rules (Venue Admin) ─────────────────────

// GET pricing rules for a venue
router.get('/:id/pricing-rules', auth, async (req, res) => {
  try {
    const venueId = parseInt(req.params.id, 10);
    const venue = await prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) return res.status(404).json({ message: 'Venue not found' });

    if (venue.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const rules = await prisma.facilityPricingRule.findMany({
      where: { venueId },
      orderBy: [{ facilityId: 'asc' }, { ruleType: 'asc' }]
    });

    res.json(rules);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// CREATE a pricing rule
router.post('/:id/pricing-rules', auth, async (req, res) => {
  try {
    const venueId = parseInt(req.params.id, 10);
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      include: { sportFacilities: { select: { id: true } } }
    });
    if (!venue) return res.status(404).json({ message: 'Venue not found' });

    if (venue.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { facilityId, ruleType, ruleValue, metadata } = req.body;
    if (!facilityId || !ruleType) {
      return res.status(400).json({ message: 'facilityId and ruleType are required' });
    }

    const validTypes = ['TIME_BASED_SURCHARGE', 'DAY_BASED_PRICING', 'PEAK_HOUR_PRICING', 'EVENT_PRICING', 'SEASON_PRICING'];
    if (!validTypes.includes(ruleType)) {
      return res.status(400).json({ message: `ruleType must be one of: ${validTypes.join(', ')}` });
    }

    const facExists = venue.sportFacilities.some(f => f.id === parseInt(facilityId));
    if (!facExists) {
      return res.status(400).json({ message: 'Facility does not belong to this venue' });
    }

    const rule = await prisma.facilityPricingRule.create({
      data: {
        facilityId: parseInt(facilityId),
        venueId,
        ruleType,
        ruleValue: Number(ruleValue) || 0,
        metadata: metadata || null
      }
    });

    res.status(201).json(rule);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// UPDATE a pricing rule
router.put('/:id/pricing-rules/:ruleId', auth, async (req, res) => {
  try {
    const venueId = parseInt(req.params.id, 10);
    const ruleId = parseInt(req.params.ruleId, 10);

    const rule = await prisma.facilityPricingRule.findUnique({ where: { id: ruleId } });
    if (!rule || rule.venueId !== venueId) {
      return res.status(404).json({ message: 'Rule not found' });
    }

    const venue = await prisma.venue.findUnique({ where: { id: venueId } });
    if (venue.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { ruleType, ruleValue, metadata, isActive } = req.body;

    const updated = await prisma.facilityPricingRule.update({
      where: { id: ruleId },
      data: {
        ...(ruleType && { ruleType }),
        ...(ruleValue !== undefined && { ruleValue: Number(ruleValue) }),
        ...(metadata !== undefined && { metadata }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) })
      }
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE a pricing rule
router.delete('/:id/pricing-rules/:ruleId', auth, async (req, res) => {
  try {
    const venueId = parseInt(req.params.id, 10);
    const ruleId = parseInt(req.params.ruleId, 10);

    const rule = await prisma.facilityPricingRule.findUnique({ where: { id: ruleId } });
    if (!rule || rule.venueId !== venueId) {
      return res.status(404).json({ message: 'Rule not found' });
    }

    const venue = await prisma.venue.findUnique({ where: { id: venueId } });
    if (venue.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await prisma.facilityPricingRule.delete({ where: { id: ruleId } });
    res.json({ message: 'Pricing rule deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/venues/nearby — Venues sorted by proximity (simplified: same city)
module.exports = router;
