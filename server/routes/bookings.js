const express = require('express');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');
const { calculateBookingAmount, applyGst, getMinBookingHours } = require('../utils/pricing');

const router = express.Router();

// Helper: parse venue sports (JSON array)
function venueHasSport(venue, sport) {
  const sports = Array.isArray(venue.sports) ? venue.sports : (venue.sports ? JSON.parse(JSON.stringify(venue.sports)) : []);
  if (Array.isArray(sports) && sports.includes(sport)) return true;
  if (venue.sportRates && venue.sportRates.some(sr => sr.sport === sport)) return true;
  if (venue.sportFacilities && venue.sportFacilities.some(f => {
    const fSports = Array.isArray(f.sports) ? f.sports : (f.sports ? JSON.parse(JSON.stringify(f.sports)) : []);
    return fSports.includes(sport);
  })) return true;
  return false;
}

// Get all bookings
router.get('/', auth, async (req, res) => {
  try {
    const where = {};
    if (req.user.role === 'player') {
      where.userId = req.user.id;
    } else if (req.user.role === 'venue_owner') {
      const venues = await prisma.venue.findMany({ where: { ownerId: req.user.id }, select: { id: true } });
      where.venueId = { in: venues.map(v => v.id) };
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, phone: true } },
        venue: {
          select: {
            name: true,
            locationCity: true,
            locationAddr: true,
            locationPin: true,
            locationCoords: true,
            sports: true,
            sportFacilities: true,
            sportRates: true,
            pricePerHour: true,
            addOns: true
          }
        },
        batch: { select: { name: true, venueId: true, venueDiscountPct: true } },
        addOnPurchases: true,
        splitPayments: true
      },
      orderBy: { bookingDate: 'desc' }
    });

    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get matches for a booking (one booking can have many matches)
router.get('/:id/matches', auth, async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    if (req.user.role === 'player' && booking.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const matches = await prisma.match.findMany({
      where: { bookingId: parseInt(req.params.id) },
      include: {
        sport: { select: { name: true, displayName: true, formats: true } },
        venue: { select: { name: true, locationCity: true, locationAddr: true, locationPin: true, locationCoords: true } }
      },
      orderBy: { matchDate: 'desc' }
    });
    res.json(matches);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single booking
router.get('/:id', auth, async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        user: { select: { name: true, email: true, phone: true } },
        venue: {
          select: {
            name: true,
            locationCity: true,
            locationAddr: true,
            locationPin: true,
            locationCoords: true,
            sports: true,
            sportFacilities: true,
            sportRates: true,
            pricePerHour: true,
            addOns: true
          }
        },
        batch: { select: { name: true, venueId: true, venueDiscountPct: true } },
        addOnPurchases: true,
        splitPayments: true
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (req.user.role === 'player' && booking.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create booking
router.post('/', auth, [
  body('venue').notEmpty().withMessage('Venue is required'),
  body('sport').notEmpty().withMessage('Sport is required'),
  body('facilityId').notEmpty().withMessage('Facility is required'),
  body('bookingDate').notEmpty().withMessage('Booking date is required'),
  body('startTime').notEmpty().withMessage('Start time is required'),
  body('endTime').notEmpty().withMessage('End time is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { venue: venueId, sport, bookingDate, startTime, endTime, paymentType, splitAmongPlayers, splitAmong, batch: batchId, facilityId: facilityIdParam, facilityName: facilityNameParam } = req.body;

    const venueIdInt = parseInt(venueId);

    // Check venue exists
    const venue = await prisma.venue.findUnique({
      where: { id: venueIdInt },
      include: { sportFacilities: true, sportRates: true }
    });
    if (!venue || !venue.isActive) {
      return res.status(404).json({ message: 'Venue not found or inactive' });
    }

    if (!venueHasSport(venue, sport)) {
      return res.status(400).json({ message: 'This venue does not offer the selected sport' });
    }

    if (!venue.sportFacilities || venue.sportFacilities.length === 0) {
      return res.status(400).json({ message: 'This venue has no facilities defined; add sportFacilities to the venue first' });
    }
    const facility = await prisma.sportFacility.findUnique({
      where: { id: parseInt(facilityIdParam), venueId: venueIdInt }
    });
    if (!facility) {
      return res.status(400).json({ message: 'Facility not found at this venue' });
    }
    const fSports = Array.isArray(facility.sports) ? facility.sports : (facility.sports ? JSON.parse(JSON.stringify(facility.sports)) : []);
    if (!fSports.includes(sport)) {
      return res.status(400).json({ message: 'This facility does not support the selected sport' });
    }
    const facilityId = parseInt(facilityIdParam);
    const facilityName = facilityNameParam && String(facilityNameParam).trim() ? String(facilityNameParam).trim() : (facility.name || 'Facility');
    const facilitySurfaceType = facility.surfaceType || null;

    let batch = null;
    let discountPercent = 0;
    if (batchId) {
      batch = await prisma.batch.findUnique({
        where: { id: parseInt(batchId) }
      });
      if (!batch || !batch.isActive) {
        return res.status(404).json({ message: 'Batch not found or inactive' });
      }
      if (!batch.venueId || batch.venueId !== venueIdInt) {
        return res.status(400).json({ message: 'This batch is not associated with the selected venue' });
      }
      discountPercent = typeof batch.venueDiscountPct === 'number' ? Math.min(100, Math.max(0, batch.venueDiscountPct)) : 0;
    }

    const date = new Date(bookingDate);
    const overlapWhere = {
      venueId: venueIdInt,
      facilityId,
      bookingDate: date,
      status: { in: ['confirmed', 'fully_paid', 'completed'] },
      OR: [
        { startTime: { lte: startTime }, endTime: { gt: startTime } },
        { startTime: { lt: endTime }, endTime: { gte: endTime } },
        { startTime: { gte: startTime }, endTime: { lte: endTime } }
      ]
    };

    const existingBooking = await prisma.booking.findFirst({ where: overlapWhere });
    if (existingBooking) {
      return res.status(400).json({ message: 'Time slot already booked for this facility' });
    }

    const sportDoc = await prisma.sport.findFirst({ where: { name: sport, isActive: true } });
    const { totalHours, subtotal: rawSubtotal } = calculateBookingAmount(venue, sport, startTime, endTime, date, sportDoc);
    if (rawSubtotal < 0 || totalHours <= 0) {
      return res.status(400).json({ message: 'Invalid time range or no rate configured for this sport and time' });
    }

    const minHours = getMinBookingHours(venue, sport, sportDoc);
    if (minHours > 0 && totalHours < minHours) {
      return res.status(400).json({
        message: `Minimum booking duration for ${sport} at this venue is ${minHours} hour(s). You requested ${totalHours} hour(s).`
      });
    }

    const subtotal = discountPercent > 0
      ? Math.round(rawSubtotal * (1 - discountPercent / 100) * 100) / 100
      : rawSubtotal;
    const gstRate = venue.gstRate != null ? venue.gstRate : 18;
    const { gstAmount, totalAmount } = applyGst(subtotal, gstRate);

    const commissionPercent = typeof venue.commissionPercent === 'number' ? Math.min(100, Math.max(0, venue.commissionPercent)) : 0;
    const platformCommissionAmount = Math.round(totalAmount * (commissionPercent / 100) * 100) / 100;
    const venueNetAmount = Math.round((totalAmount - platformCommissionAmount) * 100) / 100;

    const payType = (paymentType === 'split') ? 'split' : 'full';
    let splitPaymentsData = [];

    if (payType === 'split') {
      const players = Array.isArray(splitAmongPlayers) && splitAmongPlayers.length > 0
        ? splitAmongPlayers.filter(Boolean).map(p => parseInt(p))
        : (Array.isArray(splitAmong) && splitAmong.length > 0 ? splitAmong.map(s => parseInt(s.userId || s.user)) : []);
      if (players.length === 0) {
        return res.status(400).json({ message: 'Split payment requires splitAmongPlayers (user ids) or splitAmong ([{ userId, amount }])' });
      }
      if (splitAmong && splitAmong.length > 0 && splitAmong.every(s => typeof (s.amount) === 'number')) {
        const sum = splitAmong.reduce((a, s) => a + (s.amount || 0), 0);
        if (Math.abs(sum - totalAmount) > 0.02) {
          return res.status(400).json({ message: `Split amounts sum (${sum}) must equal total amount (${totalAmount})` });
        }
        splitPaymentsData = splitAmong.map(s => ({
          userId: parseInt(s.userId || s.user),
          amount: Math.round((s.amount || 0) * 100) / 100,
          status: 'pending'
        }));
      } else {
        const n = players.length;
        const perPerson = Math.round((totalAmount / n) * 100) / 100;
        const remainder = Math.round((totalAmount - perPerson * n) * 100) / 100;
        splitPaymentsData = players.map((userId, i) => ({
          userId,
          amount: i === 0 ? perPerson + remainder : perPerson,
          status: 'pending'
        }));
      }
    }

    const bookingType = batch ? 'batch' : (payType === 'split' ? 'split' : 'solo');
    const initialStatus = batch ? 'confirmed' : (payType === 'split' ? 'pending' : 'pending');

    const booking = await prisma.booking.create({
      data: {
        userId: req.user.id,
        createdById: req.user.id,
        bookingType,
        venueId: venueIdInt,
        sport,
        facilityId,
        facilityName,
        ...(facilitySurfaceType && { facilitySurfaceType }),
        ...(batch && { batchId: batch.id, discountPercent }),
        bookingDate: date,
        startTime,
        endTime,
        totalHours,
        subtotal,
        gstRate,
        gstAmount,
        totalAmount,
        platformCommissionPercent: commissionPercent,
        platformCommissionAmount,
        venueNetAmount,
        paymentType: payType,
        status: initialStatus,
        splitPayments: payType === 'split' ? { create: splitPaymentsData } : undefined
      },
      include: {
        venue: {
          select: {
            name: true,
            locationCity: true,
            locationAddr: true,
            locationPin: true,
            locationCoords: true,
            sports: true,
            sportFacilities: true,
            sportRates: true,
            pricePerHour: true
          }
        },
        batch: { select: { name: true, venueId: true, venueDiscountPct: true } }
      }
    });

    res.status(201).json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create multi-court booking (atomic: all facilities or none)
router.post('/multi', auth, [
  body('venue').notEmpty().withMessage('Venue is required'),
  body('sport').notEmpty().withMessage('Sport is required'),
  body('facilities').isArray({ min: 1 }).withMessage('facilities array with at least one entry is required'),
  body('facilities.*.facilityId').notEmpty().withMessage('Each facility must have a facilityId'),
  body('bookingDate').notEmpty().withMessage('Booking date is required'),
  body('startTime').notEmpty().withMessage('Start time is required'),
  body('endTime').notEmpty().withMessage('End time is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { venue: venueId, sport, bookingDate, startTime, endTime, facilities, paymentType } = req.body;
    const venueIdInt = parseInt(venueId);

    const venue = await prisma.venue.findUnique({
      where: { id: venueIdInt },
      include: { sportFacilities: true, sportRates: true }
    });
    if (!venue || !venue.isActive) {
      return res.status(404).json({ message: 'Venue not found or inactive' });
    }

    if (!venueHasSport(venue, sport)) {
      return res.status(400).json({ message: 'This venue does not offer the selected sport' });
    }

    if (!venue.sportFacilities || venue.sportFacilities.length === 0) {
      return res.status(400).json({ message: 'This venue has no facilities defined' });
    }

    const date = new Date(bookingDate);
    const sportDoc = await prisma.sport.findFirst({ where: { name: sport, isActive: true } });

    const { totalHours, subtotal: rawSubtotal } = calculateBookingAmount(venue, sport, startTime, endTime, date, sportDoc);
    if (rawSubtotal < 0 || totalHours <= 0) {
      return res.status(400).json({ message: 'Invalid time range or no rate configured for this sport and time' });
    }

    const minHours = getMinBookingHours(venue, sport, sportDoc);
    if (minHours > 0 && totalHours < minHours) {
      return res.status(400).json({
        message: `Minimum booking duration for ${sport} at this venue is ${minHours} hour(s). You requested ${totalHours} hour(s).`
      });
    }

    const gstRate = venue.gstRate != null ? venue.gstRate : 18;
    const commissionPercent = typeof venue.commissionPercent === 'number' ? Math.min(100, Math.max(0, venue.commissionPercent)) : 0;
    const payType = (paymentType === 'split') ? 'split' : 'full';
    const groupId = crypto.randomUUID();
    const unavailable = [];

    const facilityDocs = facilities.map(f => {
      const fac = venue.sportFacilities.find(sf => String(sf.id) === String(f.facilityId));
      if (!fac) return { error: `Facility ${f.facilityId} not found at this venue` };
      const fSports = Array.isArray(fac.sports) ? fac.sports : (fac.sports ? JSON.parse(JSON.stringify(fac.sports)) : []);
      if (!fSports.includes(sport)) return { error: `Facility ${fac.name} does not support ${sport}` };
      return {
        facilityId: fac.id,
        facilityName: (f.facilityName && String(f.facilityName).trim()) || fac.name || 'Facility',
        facilitySurfaceType: fac.surfaceType || null
      };
    });

    const facError = facilityDocs.find(f => f.error);
    if (facError) {
      return res.status(400).json({ message: facError.error });
    }

    for (const f of facilityDocs) {
      const overlapWhere = {
        venueId: venueIdInt,
        facilityId: f.facilityId,
        bookingDate: date,
        status: { in: ['confirmed', 'fully_paid', 'completed'] },
        OR: [
          { startTime: { lte: startTime }, endTime: { gt: startTime } },
          { startTime: { lt: endTime }, endTime: { gte: endTime } },
          { startTime: { gte: startTime }, endTime: { lte: endTime } }
        ]
      };
      const existing = await prisma.booking.findFirst({ where: overlapWhere });
      if (existing) unavailable.push(f.facilityName);
    }

    if (unavailable.length > 0) {
      return res.status(400).json({
        message: `Time slot already booked for: ${unavailable.join(', ')}`,
        unavailableFacilities: unavailable
      });
    }

    const createdBookings = await prisma.$transaction(async (tx) => {
      const created = [];
      for (const f of facilityDocs) {
        const { gstAmount, totalAmount } = applyGst(rawSubtotal, gstRate);
        const platformCommissionAmount = Math.round(totalAmount * (commissionPercent / 100) * 100) / 100;
        const venueNetAmount = Math.round((totalAmount - platformCommissionAmount) * 100) / 100;

        const b = await tx.booking.create({
          data: {
            userId: req.user.id,
            createdById: req.user.id,
            bookingType: payType === 'split' ? 'split' : 'solo',
            venueId: venueIdInt,
            sport,
            facilityId: f.facilityId,
            facilityName: f.facilityName,
            ...(f.facilitySurfaceType && { facilitySurfaceType: f.facilitySurfaceType }),
            groupId,
            bookingDate: date,
            startTime,
            endTime,
            totalHours,
            subtotal: rawSubtotal,
            gstRate,
            gstAmount,
            totalAmount,
            platformCommissionPercent: commissionPercent,
            platformCommissionAmount,
            venueNetAmount,
            paymentType: payType,
            status: 'pending'
          }
        });
        created.push(b);
      }
      return created;
    });

    const populated = await prisma.booking.findMany({
      where: { groupId },
      include: {
        venue: {
          select: {
            name: true,
            locationCity: true,
            locationAddr: true,
            locationPin: true,
            locationCoords: true,
            sports: true,
            sportFacilities: true,
            sportRates: true,
            pricePerHour: true
          }
        }
      },
      orderBy: { facilityName: 'asc' }
    });

    const combinedSubtotal = populated.reduce((s, b) => s + b.subtotal, 0);
    const combinedGst = populated.reduce((s, b) => s + b.gstAmount, 0);
    const combinedTotal = populated.reduce((s, b) => s + b.totalAmount, 0);

    res.status(201).json({
      groupId,
      bookings: populated,
      facilitiesCount: populated.length,
      combinedSubtotal: Math.round(combinedSubtotal * 100) / 100,
      combinedGst: Math.round(combinedGst * 100) / 100,
      combinedTotal: Math.round(combinedTotal * 100) / 100
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── Instant Booking (optimised 3-tap flow) ───────────────────

router.post('/instant', auth, [
  body('facilityId').notEmpty().withMessage('facilityId is required'),
  body('date').notEmpty().withMessage('date (YYYY-MM-DD) is required'),
  body('startTime').notEmpty().withMessage('startTime (HH:mm) is required'),
  body('endTime').notEmpty().withMessage('endTime (HH:mm) is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { facilityId: facIdParam, date, startTime, endTime } = req.body;
    const facilityId = parseInt(facIdParam);

    const facility = await prisma.sportFacility.findUnique({
      where: { id: facilityId },
      include: {
        venue: { include: { sportRates: true } },
        pricingRules: { where: { isActive: true } }
      }
    });

    if (!facility) {
      return res.status(404).json({ message: 'Facility not found' });
    }
    const venue = facility.venue;
    if (!venue || !venue.isActive) {
      return res.status(404).json({ message: 'Venue not found or inactive' });
    }

    const fSports = Array.isArray(facility.sports) ? facility.sports : [];
    const sport = fSports[0] || 'general';

    const bookingDate = new Date(date);
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const isToday = bookingDate.toISOString().slice(0, 10) === todayStr;

    if (bookingDate < new Date(todayStr)) {
      return res.status(400).json({ message: 'Cannot book past dates' });
    }

    const { timeToMinutes } = require('../utils/pricing');
    const slotStartMin = timeToMinutes(startTime);
    if (isToday && slotStartMin <= now.getHours() * 60 + now.getMinutes()) {
      return res.status(400).json({ message: 'Cannot book past time slots' });
    }

    const overlapWhere = {
      venueId: venue.id,
      facilityId,
      bookingDate,
      status: { in: ['confirmed', 'fully_paid', 'completed', 'pending'] },
      OR: [
        { startTime: { lte: startTime }, endTime: { gt: startTime } },
        { startTime: { lt: endTime }, endTime: { gte: endTime } },
        { startTime: { gte: startTime }, endTime: { lte: endTime } }
      ]
    };
    const conflict = await prisma.booking.findFirst({ where: overlapWhere });
    if (conflict) {
      return res.status(409).json({ message: 'This slot is already booked' });
    }

    const { applyPricingRules } = require('../utils/pricing');
    let basePrice = venue.pricePerHour || 500;
    if (venue.sportRates) {
      const sr = venue.sportRates.find(r => r.sport === sport);
      if (sr && sr.rates) {
        const rates = typeof sr.rates === 'string' ? JSON.parse(sr.rates) : sr.rates;
        if (typeof rates.default === 'number') basePrice = rates.default;
      }
    }

    const hours = (timeToMinutes(endTime) - timeToMinutes(startTime)) / 60;
    if (hours <= 0) {
      return res.status(400).json({ message: 'Invalid time range' });
    }

    const { finalPrice } = applyPricingRules(basePrice, facility.pricingRules, startTime, bookingDate);
    const subtotal = Math.round(finalPrice * hours * 100) / 100;
    const gstRate = venue.gstRate != null ? venue.gstRate : 18;
    const { gstAmount, totalAmount } = applyGst(subtotal, gstRate);

    const commissionPercent = typeof venue.commissionPercent === 'number'
      ? Math.min(100, Math.max(0, venue.commissionPercent)) : 0;
    const platformCommissionAmount = Math.round(totalAmount * (commissionPercent / 100) * 100) / 100;
    const venueNetAmount = Math.round((totalAmount - platformCommissionAmount) * 100) / 100;

    const booking = await prisma.booking.create({
      data: {
        userId: req.user.id,
        createdById: req.user.id,
        bookingType: 'solo',
        venueId: venue.id,
        sport,
        facilityId,
        facilityName: facility.name,
        facilitySurfaceType: facility.surfaceType || null,
        bookingDate,
        startTime,
        endTime,
        totalHours: hours,
        subtotal,
        gstRate,
        gstAmount,
        totalAmount,
        platformCommissionPercent: commissionPercent,
        platformCommissionAmount,
        venueNetAmount,
        paymentType: 'full',
        status: 'pending'
      },
      include: {
        venue: { select: { name: true, locationCity: true, locationAddr: true } }
      }
    });

    res.status(201).json({
      booking,
      priceBreakdown: {
        basePrice,
        pricePerHour: finalPrice,
        hours,
        subtotal,
        gstRate,
        gstAmount,
        totalAmount
      }
    });
  } catch (error) {
    console.error('POST /bookings/instant error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Cancel booking (group-aware: cancelling one booking in a group cancels all)
router.put('/:id/cancel', auth, async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const cancelledStatuses = ['cancelled', 'cancelled_user', 'cancelled_conflict'];
    if (cancelledStatuses.includes(booking.status)) {
      return res.status(400).json({ message: 'Booking already cancelled' });
    }

    if (booking.groupId) {
      const groupBookings = await prisma.booking.findMany({
        where: {
          groupId: booking.groupId,
          status: { notIn: cancelledStatuses }
        }
      });
      await prisma.booking.updateMany({
        where: { id: { in: groupBookings.map(b => b.id) } },
        data: { status: 'cancelled_user' }
      });
      return res.json({
        message: `${groupBookings.length} booking(s) in this group cancelled successfully`,
        cancelledCount: groupBookings.length,
        groupId: booking.groupId
      });
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'cancelled_user' }
    });

    const updated = await prisma.booking.findUnique({
      where: { id: booking.id }
    });
    res.json({ message: 'Booking cancelled successfully', booking: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add an add-on purchase to a booking (purchaser = current user). For split payment, amount is added to that user's share.
router.post('/:id/add-ons', auth, [
  body('addOnId').notEmpty().withMessage('Add-on id is required'),
  body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { addOnId, quantity: qty = 1 } = req.body;
    const purchasedBy = req.user.id;

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { venue: { include: { addOns: true } }, splitPayments: true }
    });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    const cancelledStatuses = ['cancelled', 'cancelled_user', 'cancelled_conflict'];
    if (cancelledStatuses.includes(booking.status)) {
      return res.status(400).json({ message: 'Cannot add to a cancelled booking' });
    }
    const venue = booking.venue;
    if (!venue || !venue.addOns || venue.addOns.length === 0) {
      return res.status(400).json({ message: 'Venue has no add-ons' });
    }
    const addOn = await prisma.venueAddOn.findUnique({
      where: { id: parseInt(addOnId), venueId: venue.id }
    });
    if (!addOn) {
      return res.status(404).json({ message: 'Add-on not found at this venue' });
    }

    const quantity = Math.max(1, parseInt(qty, 10) || 1);
    const lineAmount = Math.round(addOn.price * quantity * 100) / 100;

    if (booking.paymentType === 'split' && booking.splitPayments && booking.splitPayments.length > 0) {
      const spIdx = booking.splitPayments.findIndex(sp => sp.userId === purchasedBy);
      if (spIdx < 0) {
        return res.status(400).json({ message: 'For split payment, add-on purchaser must be one of the split participants' });
      }
      const sp = booking.splitPayments[spIdx];
      await prisma.splitPayment.update({
        where: { id: sp.id },
        data: { amount: Math.round((sp.amount + lineAmount) * 100) / 100 }
      });
    }

    await prisma.bookingAddOn.create({
      data: {
        bookingId: booking.id,
        name: addOn.name,
        category: addOn.category,
        price: addOn.price,
        unit: addOn.unit || 'per_item',
        quantity,
        amount: lineAmount,
        purchasedBy
      }
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        totalAmount: Math.round((booking.totalAmount + lineAmount) * 100) / 100,
        venueNetAmount: Math.round((booking.venueNetAmount + lineAmount) * 100) / 100
      }
    });

    const updated = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: {
        user: { select: { name: true, email: true, phone: true } },
        venue: {
          select: {
            name: true,
            locationCity: true,
            locationAddr: true,
            locationPin: true,
            locationCoords: true,
            sports: true,
            sportFacilities: true,
            sportRates: true,
            pricePerHour: true,
            addOns: true
          }
        },
        addOnPurchases: true,
        batch: { select: { name: true, venueId: true, venueDiscountPct: true } }
      }
    });

    res.status(201).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Check availability (supports single facilityId, array of facilityIds, or venue-wide)
router.post('/check-availability', async (req, res) => {
  try {
    const { venue, date, startTime, endTime, facilityId, facilityIds } = req.body;

    const overlapCondition = {
      venueId: parseInt(venue),
      bookingDate: new Date(date),
      status: { in: ['confirmed', 'fully_paid', 'completed'] },
      OR: [
        { startTime: { lte: startTime }, endTime: { gt: startTime } },
        { startTime: { lt: endTime }, endTime: { gte: endTime } },
        { startTime: { gte: startTime }, endTime: { lte: endTime } }
      ]
    };

    const ids = Array.isArray(facilityIds) ? facilityIds : (facilityId ? [facilityId] : null);

    if (ids && ids.length > 0) {
      const results = await Promise.all(ids.map(async (fid) => {
        const count = await prisma.booking.count({
          where: { ...overlapCondition, facilityId: parseInt(fid) }
        });
        return { facilityId: fid, available: count === 0 };
      }));
      return res.json({ facilities: results, available: results.every(r => r.available) });
    }

    const count = await prisma.booking.count({ where: overlapCondition });
    res.json({ available: count === 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get price estimate (sport + start/end time + bookingDate for weekday/weekend and GST). Optional batch id for discounted rate.
router.post('/estimate', async (req, res) => {
  try {
    const { venue: venueId, sport, startTime, endTime, bookingDate, batch: batchId } = req.body;
    if (!venueId || !sport || !startTime || !endTime) {
      return res.status(400).json({ message: 'venue, sport, startTime and endTime are required' });
    }
    const venue = await prisma.venue.findUnique({
      where: { id: parseInt(venueId) },
      include: { sportFacilities: true, sportRates: true }
    });
    if (!venue || !venue.isActive) {
      return res.status(404).json({ message: 'Venue not found or inactive' });
    }
    if (!venueHasSport(venue, sport)) {
      return res.status(400).json({ message: 'This venue does not offer the selected sport' });
    }
    let discountPercent = 0;
    if (batchId) {
      const batch = await prisma.batch.findUnique({
        where: { id: parseInt(batchId) }
      });
      if (batch && batch.isActive && batch.venueId && batch.venueId === parseInt(venueId)) {
        discountPercent = typeof batch.venueDiscountPct === 'number' ? Math.min(100, Math.max(0, batch.venueDiscountPct)) : 0;
      }
    }
    const date = bookingDate ? new Date(bookingDate) : new Date();
    const sportDoc = await prisma.sport.findFirst({ where: { name: sport, isActive: true } });
    const { totalHours, subtotal: rawSubtotal, breakdown } = calculateBookingAmount(venue, sport, startTime, endTime, date, sportDoc);
    const minBookingHours = getMinBookingHours(venue, sport, sportDoc);
    const subtotal = discountPercent > 0
      ? Math.round(rawSubtotal * (1 - discountPercent / 100) * 100) / 100
      : rawSubtotal;
    const gstRate = venue.gstRate != null ? venue.gstRate : 18;
    const { gstAmount, totalAmount } = applyGst(subtotal, gstRate);
    res.json({
      totalHours,
      subtotal,
      gstRate,
      gstAmount,
      totalAmount,
      minBookingHours,
      breakdown,
      ...(discountPercent > 0 && { discountPercent, batchDedicated: true })
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
