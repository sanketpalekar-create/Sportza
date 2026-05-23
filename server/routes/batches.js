const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');
const { validateRatings } = require('../utils/reviewParameters');
const { attachTrainerRatings } = require('../utils/ratingAggregate');
const { generateSessions } = require('../services/trainerService');

/** Get player IDs for a batch (from BatchMembership, status active) */
async function getBatchPlayerIds(batchId) {
  const memberships = await prisma.batchMembership.findMany({
    where: { batchId: parseInt(batchId), status: 'active' },
    select: { playerId: true }
  });
  return memberships.map(m => m.playerId);
}

/** Check if user is a player in batch */
async function isPlayerInBatch(batchId, userId) {
  const count = await prisma.batchMembership.count({
    where: { batchId: parseInt(batchId), playerId: parseInt(userId), status: 'active' }
  });
  return count > 0;
}

/** Validate and normalize feeSchedules: sport + fee required; daysOfWeek 0-6; startTime/endTime optional */
function normalizeFeeSchedules(feeSchedules) {
  if (!Array.isArray(feeSchedules)) return [];
  return feeSchedules
    .filter(s => s && s.sport != null && typeof s.fee === 'number' && s.fee >= 0)
    .map(s => ({
      sport: String(s.sport).trim(),
      daysOfWeek: Array.isArray(s.daysOfWeek) ? s.daysOfWeek.filter(d => typeof d === 'number' && d >= 0 && d <= 6) : [],
      startTime: s.startTime != null ? String(s.startTime).trim() : undefined,
      endTime: s.endTime != null ? String(s.endTime).trim() : undefined,
      fee: Number(s.fee)
    }));
}

/** Resolve fee from batch: feeSchedules first (match sport, day in daysOfWeek, time in range), then sportFees fallback. */
function resolveBatchFee(batch, sport, day, timeStr) {
  if (!sport) return null;
  const timeMinutes = (t) => {
    if (!t || typeof t !== 'string') return null;
    const [h, m] = t.trim().split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const t = timeMinutes(timeStr);
  const s = (batch.feeSchedules || []).find(sched => {
    if (sched.sport !== sport) return false;
    if (Array.isArray(sched.daysOfWeek) && sched.daysOfWeek.length > 0 && (day == null || !sched.daysOfWeek.includes(day))) return false;
    if (sched.startTime != null && sched.endTime != null && t != null) {
      const start = timeMinutes(sched.startTime);
      const end = timeMinutes(sched.endTime);
      if (start != null && end != null && (t < start || t >= end)) return false;
    }
    return true;
  });
  if (s) return s.fee;
  const fallback = (batch.sportFees || []).find(sf => sf.sport === sport);
  return fallback ? fallback.fee : null;
}

/** Attach placeType and place so client can identify venue vs custom location */
function withPlace(batch) {
  const obj = { ...batch };
  obj.placeType = batch.venueId ? 'venue' : 'location';
  obj.place = batch.venue
    ? {
        type: 'venue',
        id: batch.venue.id,
        name: batch.venue.name,
        location: { city: batch.venue.locationCity, address: batch.venue.locationAddr }
      }
    : { type: 'location', location: batch.location || {} };
  return obj;
}

const router = express.Router();

/** List batches: trainer = own, player = batches they're in, admin = all */
router.get('/', auth, async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'trainer') {
      filter.trainerId = parseInt(req.user.id);
    } else if (req.user.role === 'player') {
      const membershipBatchIds = (await prisma.batchMembership.findMany({
        where: { playerId: parseInt(req.user.id), status: 'active' },
        select: { batchId: true }
      })).map(m => m.batchId);
      filter.id = { in: membershipBatchIds };
    }

    const batches = await prisma.batch.findMany({
      where: filter,
      include: {
        trainer: { select: { name: true, email: true } },
        venue: { select: { name: true, locationCity: true, locationAddr: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const batchesWithPlayers = await Promise.all(batches.map(async (b) => {
      const obj = withPlace(b);
      const playerIds = await getBatchPlayerIds(b.id);
      const players = playerIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: playerIds } },
            select: { name: true, email: true }
          })
        : [];
      obj.players = players;
      return obj;
    }));

    res.json(batchesWithPlayers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Get default review parameters (sport + cognitive) for monthly player reviews */
router.get('/review-parameters', auth, (req, res) => {
  const { getDefaultReviewParameters } = require('../utils/reviewParameters');
  res.json({ parameters: getDefaultReviewParameters() });
});

/** Discover ongoing batches for players (sport, city). No auth required. Returns batches with trainer (with averageRating) and place. */
router.get('/discover', async (req, res) => {
  try {
    const { sport, city } = req.query;
    const filter = { isActive: true };
    if (sport && sport.trim()) filter.sport = sport.trim();
    let batches = await prisma.batch.findMany({
      where: filter,
      include: {
        trainer: { select: { name: true, email: true, sports: true } },
        venue: { select: { name: true, locationCity: true, locationAddr: true } }
      },
      orderBy: { updatedAt: 'desc' },
      take: 100
    });

    let batchesWithPlayers = await Promise.all(batches.map(async (b) => {
      const playerIds = await getBatchPlayerIds(b.id);
      const players = playerIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: playerIds } },
            select: { name: true }
          })
        : [];
      return { ...b, players };
    }));

    if (city && city.trim()) {
      const cityLower = city.trim().toLowerCase();
      const venueRows = await prisma.$queryRaw`SELECT id FROM venues WHERE LOWER(locationCity) = LOWER(${cityLower})`;
      const venueIds = venueRows.map(r => r.id);
      batchesWithPlayers = batchesWithPlayers.filter(b => {
        if (b.venue && b.venue.locationCity && b.venue.locationCity.toLowerCase() === cityLower) return true;
        if (b.venue && venueIds.includes(b.venue.id)) return true;
        if (b.location && b.location.city && b.location.city.toLowerCase() === cityLower) return true;
        return false;
      });
    }
    const withPlaceAndRating = batchesWithPlayers.map(b => withPlace(b));
    const withTrainerRatings = await attachTrainerRatings(withPlaceAndRating);
    res.json(withTrainerRatings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Get one batch (includes trainer averageRating for discovery / batch detail). */
router.get('/:id', auth, async (req, res) => {
  try {
    const batch = await prisma.batch.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        trainer: { select: { name: true, email: true } },
        venue: { select: { name: true, locationCity: true, locationAddr: true } }
      }
    });

    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    const playerIds = await getBatchPlayerIds(batch.id);
    const players = playerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: playerIds } },
          select: { name: true, email: true }
        })
      : [];
    const batchObj = { ...batch, players };

    const [withRating] = await attachTrainerRatings([withPlace(batchObj)]);
    res.json(withRating);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** List dedicated bookings for this batch (bookings linked to this batch at its venue, at discounted price) */
router.get('/:id/bookings', auth, async (req, res) => {
  try {
    const batch = await prisma.batch.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    const isTrainer = batch.trainerId === parseInt(req.user.id);
    const isPlayer = await isPlayerInBatch(req.params.id, req.user.id);
    if (!isTrainer && !isPlayer && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view this batch\'s bookings' });
    }
    const bookings = await prisma.booking.findMany({
      where: { batchId: parseInt(req.params.id) },
      include: {
        user: { select: { name: true, email: true } },
        venue: { select: { name: true, locationCity: true, locationAddr: true } }
      },
      orderBy: { bookingDate: 'desc' }
    });
    const withLocation = bookings.map(b => ({
      ...b,
      venue: b.venue ? { ...b.venue, location: { city: b.venue.locationCity, address: b.venue.locationAddr } } : null
    }));
    res.json(withLocation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Resolve fee for this batch: ?sport=cricket&day=1&time=09:00 (day 0=Sun..6=Sat, time HH:mm) */
router.get('/:id/fee', auth, async (req, res) => {
  try {
    const batch = await prisma.batch.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    const isTrainer = batch.trainerId === parseInt(req.user.id);
    const isPlayer = await isPlayerInBatch(req.params.id, req.user.id);
    if (!isTrainer && !isPlayer && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const sport = req.query.sport;
    const day = req.query.day != null ? parseInt(req.query.day, 10) : null;
    const time = req.query.time || '';
    const fee = resolveBatchFee(batch, sport, day, time);
    if (fee == null) {
      return res.status(404).json({ message: 'No fee found for this sport/day/time' });
    }
    res.json({ sport, day, time, fee });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Create batch (trainer or admin) */
router.post('/', auth, [
  body('name').notEmpty().withMessage('Batch name is required')
], async (req, res) => {
  try {
    if (req.user.role !== 'trainer' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only trainers or admins can create batches' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, location, venue: venueId, venueDiscountPercent, commissionPercent, sport, sportFees, feeSchedules, schedule, capacity, joinType, reservationPercent } = req.body;
    const batch = await prisma.batch.create({
      data: {
        trainerId: req.user.role === 'trainer' ? parseInt(req.user.id) : parseInt(req.body.trainer || req.user.id),
        name,
        description: description || '',
        location: location || undefined,
        venueId: venueId ? parseInt(venueId) : undefined,
        venueDiscountPct: typeof venueDiscountPercent === 'number' ? Math.min(100, Math.max(0, venueDiscountPercent)) : undefined,
        commissionPercent: typeof commissionPercent === 'number' ? Math.min(100, Math.max(0, commissionPercent)) : undefined,
        sport: sport || undefined,
        sportFees: Array.isArray(sportFees) ? sportFees.filter(s => s && s.sport != null && typeof s.fee === 'number') : [],
        feeSchedules: normalizeFeeSchedules(feeSchedules),
        schedule: schedule || undefined,
        capacity: typeof capacity === 'number' ? capacity : undefined,
        joinType: joinType || undefined,
        reservationPercent: typeof reservationPercent === 'number' ? reservationPercent : undefined
      },
      include: {
        trainer: { select: { name: true, email: true } },
        venue: { select: { name: true, locationCity: true, locationAddr: true } }
      }
    });
    const result = withPlace(batch);
    result.players = [];
    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Update batch (trainer own, or admin) */
router.put('/:id', auth, async (req, res) => {
  try {
    const batch = await prisma.batch.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }
    const isOwner = batch.trainerId === parseInt(req.user.id);
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this batch' });
    }

    const { name, description, location, venue: venueId, venueDiscountPercent, commissionPercent, sport, sportFees, feeSchedules, schedule, isActive, capacity, joinType, reservationPercent } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (location !== undefined) updateData.location = location;
    if (venueId !== undefined) updateData.venueId = venueId ? parseInt(venueId) : null;
    if (venueDiscountPercent !== undefined) updateData.venueDiscountPct = typeof venueDiscountPercent === 'number' ? Math.min(100, Math.max(0, venueDiscountPercent)) : batch.venueDiscountPct;
    if (commissionPercent !== undefined) updateData.commissionPercent = typeof commissionPercent === 'number' ? Math.min(100, Math.max(0, commissionPercent)) : batch.commissionPercent;
    if (sport !== undefined) updateData.sport = sport;
    if (Array.isArray(sportFees)) updateData.sportFees = sportFees.filter(s => s && s.sport != null && typeof s.fee === 'number');
    if (Array.isArray(feeSchedules)) updateData.feeSchedules = normalizeFeeSchedules(feeSchedules);
    if (schedule !== undefined) updateData.schedule = schedule;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;
    if (typeof capacity === 'number') updateData.capacity = capacity;
    if (joinType !== undefined) updateData.joinType = joinType;
    if (typeof reservationPercent === 'number') updateData.reservationPercent = reservationPercent;

    const updated = await prisma.batch.update({
      where: { id: parseInt(req.params.id) },
      data: updateData,
      include: {
        trainer: { select: { name: true, email: true } },
        venue: { select: { name: true, locationCity: true, locationAddr: true } }
      }
    });
    const playerIds = await getBatchPlayerIds(updated.id);
    const players = playerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: playerIds } },
          select: { name: true, email: true }
        })
      : [];
    const batchObj = { ...updated, players };
    res.json(withPlace(batchObj));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Delete batch (trainer own, or admin) */
router.delete('/:id', auth, async (req, res) => {
  try {
    const batch = await prisma.batch.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }
    const isOwner = batch.trainerId === parseInt(req.user.id);
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this batch' });
    }
    await prisma.batch.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Batch deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Add player(s) to batch (trainer own, or admin) */
router.post('/:id/players', auth, [
  body('player').optional().isInt(),
  body('players').optional().isArray()
], async (req, res) => {
  try {
    const batch = await prisma.batch.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }
    const isOwner = batch.trainerId === parseInt(req.user.id);
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to modify this batch' });
    }

    const toAdd = [];
    if (req.body.player != null) toAdd.push(String(req.body.player));
    if (Array.isArray(req.body.players)) toAdd.push(...req.body.players.map(String));
    const unique = [...new Set(toAdd)].filter(Boolean);

    for (const id of unique) {
      const existing = await prisma.batchMembership.findFirst({
        where: { batchId: parseInt(req.params.id), playerId: parseInt(id) }
      });
      if (!existing) {
        await prisma.batchMembership.create({
          data: {
            batchId: parseInt(req.params.id),
            playerId: parseInt(id),
            status: 'active',
            reservationStatus: 'confirmed'
          }
        });
      }
    }

    const batchDoc = await prisma.batch.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        trainer: { select: { name: true, email: true } },
        venue: { select: { name: true, locationCity: true, locationAddr: true } }
      }
    });
    const playerIds = await getBatchPlayerIds(req.params.id);
    const players = playerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: playerIds } },
          select: { name: true, email: true }
        })
      : [];
    const result = withPlace(batchDoc);
    result.players = players;
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Remove player from batch (trainer own, or admin) */
router.delete('/:id/players/:playerId', auth, async (req, res) => {
  try {
    const batch = await prisma.batch.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }
    const isOwner = batch.trainerId === parseInt(req.user.id);
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to modify this batch' });
    }

    await prisma.batchMembership.deleteMany({
      where: { batchId: parseInt(req.params.id), playerId: parseInt(req.params.playerId) }
    });

    const batchDoc = await prisma.batch.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        trainer: { select: { name: true, email: true } },
        venue: { select: { name: true, locationCity: true, locationAddr: true } }
      }
    });
    const playerIds = await getBatchPlayerIds(req.params.id);
    const players = playerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: playerIds } },
          select: { name: true, email: true }
        })
      : [];
    const result = withPlace(batchDoc);
    result.players = players;
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Player joins a batch (self-registration for discovery). Auth required. */
router.post('/:id/join', auth, async (req, res) => {
  try {
    const batch = await prisma.batch.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        trainer: { select: { name: true, email: true } },
        venue: { select: { name: true, locationCity: true, locationAddr: true } }
      }
    });
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    if (!batch.isActive) return res.status(400).json({ message: 'Batch is not active' });
    const alreadyIn = await isPlayerInBatch(req.params.id, req.user.id);
    if (alreadyIn) return res.status(400).json({ message: 'You are already in this batch' });

    const activeCount = await prisma.batchMembership.count({
      where: { batchId: parseInt(req.params.id), status: 'active' }
    });
    if (batch.capacity && activeCount >= batch.capacity) {
      return res.status(400).json({ message: 'Batch is full' });
    }

    const status = batch.joinType === 'approval' ? 'pending' : 'active';
    await prisma.batchMembership.create({
      data: {
        batchId: parseInt(req.params.id),
        playerId: parseInt(req.user.id),
        status,
        reservationStatus: 'confirmed'
      }
    });

    const playerIds = await getBatchPlayerIds(batch.id);
    const players = playerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: playerIds } },
          select: { name: true, email: true }
        })
      : [];
    const result = withPlace(batch);
    result.players = players;
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** List payments for this batch (trainer or admin) */
router.get('/:id/payments', auth, async (req, res) => {
  try {
    const batch = await prisma.batch.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    const isTrainer = batch.trainerId === parseInt(req.user.id);
    if (!isTrainer && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view this batch\'s payments' });
    }
    const payments = await prisma.batchPayment.findMany({
      where: { batchId: parseInt(req.params.id) },
      include: { payer: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(payments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Record a batch fee payment (payer pays amount; platform takes commission; trainer gets trainerNetAmount) */
router.post('/:id/payments', auth, [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
  body('payer').optional().isInt(),
  body('player').optional().isInt(),
  body('cycleMonth').optional().isInt({ min: 1, max: 12 }),
  body('cycleYear').optional().isInt({ min: 2020, max: 2100 }),
  body('paymentMode').optional().isIn(['online', 'offline'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const batch = await prisma.batch.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }
    const isTrainer = batch.trainerId === parseInt(req.user.id);
    const isPlayer = await isPlayerInBatch(req.params.id, req.user.id);
    if (!isTrainer && !isPlayer && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to record a payment for this batch' });
    }

    const amount = Math.round(parseFloat(req.body.amount) * 100) / 100;
    const payerId = req.body.payer ? parseInt(req.body.payer) : parseInt(req.user.id);
    const playerId = req.body.player ? parseInt(req.body.player) : payerId;
    const now = new Date();

    const commissionPercent = typeof batch.commissionPercent === 'number' ? Math.min(100, Math.max(0, batch.commissionPercent)) : 0;
    const platformCommissionAmount = Math.round(amount * (commissionPercent / 100) * 100) / 100;
    const trainerNetAmount = Math.round((amount - platformCommissionAmount) * 100) / 100;

    const payment = await prisma.batchPayment.create({
      data: {
        batchId: batch.id,
        playerId,
        payerId,
        amount,
        cycleMonth: req.body.cycleMonth ?? now.getMonth() + 1,
        cycleYear: req.body.cycleYear ?? now.getFullYear(),
        paymentMode: req.body.paymentMode || 'online',
        validationStatus: 'confirmed',
        platformCommissionPercent: commissionPercent,
        platformCommissionAmount,
        trainerNetAmount,
        status: 'completed'
      },
      include: {
        payer: { select: { name: true, email: true } },
        player: { select: { name: true, email: true } },
        batch: { select: { name: true, trainerId: true, commissionPercent: true } }
      }
    });

    await prisma.batchMembership.updateMany({
      where: { batchId: batch.id, playerId },
      data: { paymentStatus: 'paid' }
    });

    res.status(201).json(payment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** List monthly reviews for this batch (trainer or admin). Query: year, month */
router.get('/:id/reviews', auth, async (req, res) => {
  try {
    const batch = await prisma.batch.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    const isTrainer = batch.trainerId === parseInt(req.user.id);
    if (!isTrainer && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view this batch\'s reviews' });
    }
    const filter = { batchId: parseInt(req.params.id) };
    const year = req.query.year != null ? parseInt(req.query.year, 10) : null;
    const month = req.query.month != null ? parseInt(req.query.month, 10) : null;
    if (Number.isInteger(year)) filter.year = year;
    if (Number.isInteger(month) && month >= 1 && month <= 12) filter.month = month;
    const reviews = await prisma.playerBatchReview.findMany({
      where: filter,
      include: {
        player: { select: { name: true, email: true } },
        trainer: { select: { name: true, email: true } }
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { playerId: 'asc' }]
    });
    res.json(reviews);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Submit monthly review for batch players (trainer). Body: { year, month, reviews: [ { playerId, ratings: {}, comment? } ] } */
router.post('/:id/reviews', auth, [
  body('year').isInt({ min: 2020, max: 2100 }).withMessage('Year is required (2020-2100)'),
  body('month').isInt({ min: 1, max: 12 }).withMessage('Month is required (1-12)'),
  body('reviews').isArray({ min: 1 }).withMessage('reviews array with at least one player review is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const batch = await prisma.batch.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    const isTrainer = batch.trainerId === parseInt(req.user.id);
    if (!isTrainer && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to submit reviews for this batch' });
    }

    const { year, month, reviews } = req.body;
    const playerIds = (await getBatchPlayerIds(req.params.id)).map(id => String(id));

    const results = [];
    for (const item of reviews) {
      const playerId = item.playerId || item.player;
      if (!playerId) {
        results.push({ playerId: null, error: 'playerId is required' });
        continue;
      }
      const playerIdStr = String(playerId);
      if (!playerIds.includes(playerIdStr)) {
        results.push({ playerId: playerIdStr, error: 'Player is not in this batch' });
        continue;
      }
      const ratingValidation = validateRatings(item.ratings || {});
      if (!ratingValidation.valid) {
        results.push({ playerId: playerIdStr, error: ratingValidation.error });
        continue;
      }

      const comment = typeof item.comment === 'string' ? item.comment.trim().slice(0, 2000) : undefined;
      const ratings = item.ratings && typeof item.ratings === 'object' ? item.ratings : {};

      const existing = await prisma.playerBatchReview.findFirst({
        where: {
          batchId: batch.id,
          playerId: parseInt(playerId),
          year,
          month
        }
      });

      if (existing) {
        const updated = await prisma.playerBatchReview.update({
          where: { id: existing.id },
          data: { ratings, ...(comment !== undefined && { comment }) },
          include: { player: { select: { name: true, email: true } } }
        });
        results.push({ playerId: playerIdStr, review: updated, updated: true });
      } else {
        const review = await prisma.playerBatchReview.create({
          data: {
            batchId: batch.id,
            playerId: parseInt(playerId),
            trainerId: parseInt(req.user.id),
            year,
            month,
            ratings,
            comment
          },
          include: { player: { select: { name: true, email: true } } }
        });
        results.push({ playerId: playerIdStr, review, updated: false });
      }
    }

    res.status(201).json({ year, month, batchId: batch.id, results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================== SESSIONS ====================

/** List sessions for a batch */
router.get('/:id/sessions', auth, async (req, res) => {
  try {
    const batch = await prisma.batch.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    const isTrainer = batch.trainerId === parseInt(req.user.id);
    const isPlayer = await isPlayerInBatch(req.params.id, req.user.id);
    if (!isTrainer && !isPlayer && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { status } = req.query;
    const filter = { batchId: parseInt(req.params.id) };
    if (status) filter.status = status;

    const sessions = await prisma.batchSession.findMany({
      where: filter,
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }]
    });
    res.json(sessions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Generate sessions for a batch (auto-create from schedule) */
router.post('/:id/sessions/generate', auth, async (req, res) => {
  try {
    const batch = await prisma.batch.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    const isOwner = batch.trainerId === parseInt(req.user.id);
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only the batch trainer can generate sessions' });
    }
    const weeks = parseInt(req.body.weeks, 10) || 4;
    const sessions = await generateSessions(req.params.id, weeks, req.body.fromDate);
    res.status(201).json(sessions);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Update a session (mark completed, cancel, reschedule) */
router.patch('/sessions/:sessionId', auth, async (req, res) => {
  try {
    const session = await prisma.batchSession.findUnique({
      where: { id: parseInt(req.params.sessionId) }
    });
    if (!session) return res.status(404).json({ message: 'Session not found' });

    const batch = await prisma.batch.findUnique({
      where: { id: session.batchId }
    });
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    const isOwner = batch.trainerId === parseInt(req.user.id);
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { status, date, startTime, endTime } = req.body;
    const updateData = {};
    if (status && ['scheduled', 'completed', 'cancelled'].includes(status)) updateData.status = status;
    if (date) updateData.date = new Date(date);
    if (startTime) updateData.startTime = startTime;
    if (endTime) updateData.endTime = endTime;

    const updated = await prisma.batchSession.update({
      where: { id: parseInt(req.params.sessionId) },
      data: updateData
    });
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================== ATTENDANCE ====================

/** Get attendance for a session */
router.get('/sessions/:sessionId/attendance', auth, async (req, res) => {
  try {
    const session = await prisma.batchSession.findUnique({
      where: { id: parseInt(req.params.sessionId) }
    });
    if (!session) return res.status(404).json({ message: 'Session not found' });

    const batch = await prisma.batch.findUnique({
      where: { id: session.batchId }
    });
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    const isOwner = batch.trainerId === parseInt(req.user.id);
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const attendance = await prisma.sessionAttendance.findMany({
      where: { sessionId: parseInt(req.params.sessionId) },
      include: { player: { select: { name: true, email: true } } }
    });
    const players = await getBatchPlayerIds(session.batchId);
    const playerDetails = players.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: players } },
          select: { name: true, email: true }
        })
      : [];

    res.json({
      session,
      attendance,
      players: playerDetails
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Mark attendance for a session (bulk upsert) */
router.post('/sessions/:sessionId/attendance', auth, [
  body('attendance').isArray({ min: 1 }).withMessage('attendance array is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const session = await prisma.batchSession.findUnique({
      where: { id: parseInt(req.params.sessionId) }
    });
    if (!session) return res.status(404).json({ message: 'Session not found' });

    const batch = await prisma.batch.findUnique({
      where: { id: session.batchId }
    });
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    const isOwner = batch.trainerId === parseInt(req.user.id);
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only the batch trainer can mark attendance' });
    }

    const results = [];
    for (const entry of req.body.attendance) {
      const { player, status } = entry;
      if (!player || !['present', 'absent'].includes(status)) continue;

      const record = await prisma.sessionAttendance.upsert({
        where: {
          sessionId_playerId: { sessionId: parseInt(req.params.sessionId), playerId: parseInt(player) }
        },
        update: { status },
        create: {
          sessionId: parseInt(req.params.sessionId),
          playerId: parseInt(player),
          status
        }
      });
      results.push(record);
    }

    if (session.status !== 'completed') {
      await prisma.batchSession.update({
        where: { id: parseInt(req.params.sessionId) },
        data: { status: 'completed' }
      });
    }

    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================== ANNOUNCEMENTS ====================

/** List announcements for a batch */
router.get('/:id/announcements', auth, async (req, res) => {
  try {
    const batch = await prisma.batch.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    const isTrainer = batch.trainerId === parseInt(req.user.id);
    const isPlayer = await isPlayerInBatch(req.params.id, req.user.id);
    if (!isTrainer && !isPlayer && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
    const announcements = await prisma.batchAnnouncement.findMany({
      where: { batchId: parseInt(req.params.id) },
      include: { trainer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    res.json(announcements);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Post an announcement to a batch (trainer only) */
router.post('/:id/announcements', auth, [
  body('message').notEmpty().withMessage('Message is required').isLength({ max: 2000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const batch = await prisma.batch.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    const isOwner = batch.trainerId === parseInt(req.user.id);
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only the creator can post announcements' });
    }

    const announcement = await prisma.batchAnnouncement.create({
      data: {
        batchId: parseInt(req.params.id),
        trainerId: parseInt(req.user.id),
        message: req.body.message.trim()
      },
      include: { trainer: { select: { name: true } } }
    });
    res.status(201).json(announcement);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
