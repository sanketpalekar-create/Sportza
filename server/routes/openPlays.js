const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');

const router = express.Router();

/** List open plays for discovery (filter by venue, sport, date, status) */
router.get('/', auth, async (req, res) => {
  try {
    const { venue, sport, date, status } = req.query;
    const filter = {};
    if (venue) filter.venueId = parseInt(venue);
    if (sport) filter.sport = sport;
    if (status) filter.status = status;
    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      filter.bookingDate = { gte: d, lt: next };
    }
    const openPlays = await prisma.openPlay.findMany({
      where: filter,
      include: {
        booking: { select: { id: true, bookingDate: true, startTime: true, endTime: true, venueId: true, facilityId: true, facilityName: true, sport: true } },
        venue: { select: { id: true, name: true, locationCity: true, locationAddr: true } },
        createdBy: { select: { name: true, email: true } },
        players: { include: { user: { select: { name: true, email: true } } } }
      },
      orderBy: [{ bookingDate: 'asc' }, { startTime: 'asc' }]
    });

    const withPlayers = openPlays.map(op => ({
      ...op,
      players: op.players.map(p => p.user),
      venue: op.venue ? { ...op.venue, location: { city: op.venue.locationCity, address: op.venue.locationAddr } } : null
    }));
    res.json(withPlayers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

const { processOpenPlayConfirmations } = require('../services/openPlayConfirmations');

/** Process open-play confirmations: 30 mins before slot, confirm booking only if open play is full and payment done; else cancel. Call from cron or use built-in scheduler. */
router.get('/process-confirmations', async (req, res) => {
  try {
    const results = await processOpenPlayConfirmations();
    res.json({ message: 'Open play confirmations processed', results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Get one open play */
router.get('/:id', auth, async (req, res) => {
  try {
    const openPlay = await prisma.openPlay.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        booking: { select: { id: true, bookingDate: true, startTime: true, endTime: true, venueId: true, facilityId: true, facilityName: true, sport: true } },
        venue: { select: { id: true, name: true, locationCity: true, locationAddr: true } },
        createdBy: { select: { name: true, email: true } },
        players: { include: { user: { select: { name: true, email: true } } } }
      }
    });

    if (!openPlay) {
      return res.status(404).json({ message: 'Open play not found' });
    }

    const result = {
      ...openPlay,
      players: openPlay.players.map(p => p.user),
      venue: openPlay.venue ? { ...openPlay.venue, location: { city: openPlay.venue.locationCity, address: openPlay.venue.locationAddr } } : null
    };
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Create open play from an existing booking (creator = booking owner). One open play per booking. */
router.post('/', auth, [
  body('bookingId').notEmpty().withMessage('Booking is required'),
  body('formatName').notEmpty().withMessage('Format is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { bookingId, formatName, title } = req.body;
    const bookingIdInt = parseInt(bookingId);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingIdInt },
      include: { venue: { select: { id: true, name: true, locationCity: true, locationAddr: true } } }
    });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    if (booking.userId !== parseInt(req.user.id)) {
      return res.status(403).json({ message: 'Only the person who made the booking can create an open play for it' });
    }
    const allowedForOpenPlay = ['pending', 'confirmed'];
    if (!allowedForOpenPlay.includes(booking.status)) {
      return res.status(400).json({ message: 'Booking must be pending or confirmed to create an open play' });
    }

    const existing = await prisma.openPlay.findFirst({
      where: { bookingId: bookingIdInt }
    });
    if (existing) {
      return res.status(400).json({ message: 'This booking already has an open play' });
    }

    const sportDoc = await prisma.sport.findFirst({
      where: { name: booking.sport, isActive: true },
      include: { formats: true }
    });
    if (!sportDoc || !sportDoc.formats || sportDoc.formats.length === 0) {
      return res.status(400).json({ message: 'Sport or format not found' });
    }
    const format = sportDoc.formats.find(f => (f.name || '').toLowerCase() === (formatName || '').toLowerCase());
    if (!format) {
      return res.status(400).json({
        message: `Format "${formatName}" not found for ${booking.sport}. Available: ${sportDoc.formats.map(f => f.name).join(', ')}`
      });
    }

    const teams = format.maxTeams || 2;
    const maxPlayers = (format.playersPerTeam || 0) * teams;

    const openPlay = await prisma.openPlay.create({
      data: {
        bookingId: bookingIdInt,
        venueId: booking.venueId,
        sport: booking.sport,
        formatName: format.name,
        playersPerTeam: format.playersPerTeam,
        maxPlayers,
        createdById: parseInt(req.user.id),
        facilityId: booking.facilityId,
        facilityName: booking.facilityName,
        title: title || undefined,
        bookingDate: booking.bookingDate,
        startTime: booking.startTime,
        endTime: booking.endTime
      }
    });

    await prisma.openPlayPlayer.create({
      data: { openPlayId: openPlay.id, userId: parseInt(req.user.id) }
    });

    await prisma.booking.update({
      where: { id: bookingIdInt },
      data: { status: 'pending_open_play', bookingType: 'open_play' }
    });

    const populated = await prisma.openPlay.findUnique({
      where: { id: openPlay.id },
      include: {
        booking: { select: { id: true, bookingDate: true, startTime: true, endTime: true, venueId: true, facilityId: true, facilityName: true, sport: true } },
        venue: { select: { id: true, name: true, locationCity: true, locationAddr: true } },
        createdBy: { select: { name: true, email: true } },
        players: { include: { user: { select: { name: true, email: true } } } }
      }
    });

    const result = {
      ...populated,
      players: populated.players.map(p => p.user),
      venue: populated.venue ? { ...populated.venue, location: { city: populated.venue.locationCity, address: populated.venue.locationAddr } } : null
    };
    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Join an open play (add current user to players if not full) */
router.post('/:id/join', auth, async (req, res) => {
  try {
    const openPlay = await prisma.openPlay.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!openPlay) {
      return res.status(404).json({ message: 'Open play not found' });
    }
    if (openPlay.status !== 'open') {
      return res.status(400).json({ message: 'This open play is not accepting more players' });
    }
    const userId = parseInt(req.user.id);
    const existingPlayer = await prisma.openPlayPlayer.findFirst({
      where: { openPlayId: openPlay.id, userId }
    });
    if (existingPlayer) {
      return res.status(400).json({ message: 'You have already joined' });
    }
    const playerCount = await prisma.openPlayPlayer.count({
      where: { openPlayId: openPlay.id }
    });
    if (playerCount >= openPlay.maxPlayers) {
      return res.status(400).json({ message: 'Open play is full' });
    }

    await prisma.openPlayPlayer.create({
      data: { openPlayId: openPlay.id, userId }
    });

    const newCount = playerCount + 1;
    if (newCount >= openPlay.maxPlayers) {
      await prisma.openPlay.update({
        where: { id: openPlay.id },
        data: { status: 'full' }
      });
    }

    const populated = await prisma.openPlay.findUnique({
      where: { id: openPlay.id },
      include: {
        booking: { select: { id: true, bookingDate: true, startTime: true, endTime: true, venueId: true, facilityId: true, facilityName: true, sport: true } },
        venue: { select: { id: true, name: true, locationCity: true, locationAddr: true } },
        createdBy: { select: { name: true, email: true } },
        players: { include: { user: { select: { name: true, email: true } } } }
      }
    });

    const result = {
      ...populated,
      players: populated.players.map(p => p.user),
      venue: populated.venue ? { ...populated.venue, location: { city: populated.venue.locationCity, address: populated.venue.locationAddr } } : null
    };
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Leave an open play (remove current user from players) */
router.post('/:id/leave', auth, async (req, res) => {
  try {
    const openPlay = await prisma.openPlay.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        players: { select: { userId: true } }
      }
    });
    if (!openPlay) {
      return res.status(404).json({ message: 'Open play not found' });
    }
    const userId = parseInt(req.user.id);
    const isCreator = openPlay.createdById === userId;

    await prisma.openPlayPlayer.deleteMany({
      where: { openPlayId: openPlay.id, userId }
    });

    const remainingCount = await prisma.openPlayPlayer.count({
      where: { openPlayId: openPlay.id }
    });

    const updateData = {};
    if (remainingCount === 0) {
      updateData.status = 'cancelled';
    } else if (openPlay.status === 'full') {
      updateData.status = 'open';
    }
    if (isCreator && remainingCount > 0) {
      const firstPlayer = await prisma.openPlayPlayer.findFirst({
        where: { openPlayId: openPlay.id },
        select: { userId: true }
      });
      if (firstPlayer) {
        updateData.createdById = firstPlayer.userId;
      }
    }
    if (Object.keys(updateData).length > 0) {
      await prisma.openPlay.update({
        where: { id: openPlay.id },
        data: updateData
      });
    }

    const populated = await prisma.openPlay.findUnique({
      where: { id: openPlay.id },
      include: {
        booking: { select: { id: true, bookingDate: true, startTime: true, endTime: true, venueId: true, facilityId: true, facilityName: true, sport: true } },
        venue: { select: { id: true, name: true, locationCity: true, locationAddr: true } },
        createdBy: { select: { name: true, email: true } },
        players: { include: { user: { select: { name: true, email: true } } } }
      }
    });

    const result = {
      ...populated,
      players: populated.players.map(p => p.user),
      venue: populated.venue ? { ...populated.venue, location: { city: populated.venue.locationCity, address: populated.venue.locationAddr } } : null
    };
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Update open play (cancel or set title) - creator only */
router.patch('/:id', auth, async (req, res) => {
  try {
    const openPlay = await prisma.openPlay.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!openPlay) {
      return res.status(404).json({ message: 'Open play not found' });
    }
    if (openPlay.createdById !== parseInt(req.user.id)) {
      return res.status(403).json({ message: 'Only the creator can update this open play' });
    }

    const { status, title } = req.body;
    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (title !== undefined) updateData.title = title;

    await prisma.openPlay.update({
      where: { id: parseInt(req.params.id) },
      data: updateData
    });

    const populated = await prisma.openPlay.findUnique({
      where: { id: openPlay.id },
      include: {
        booking: { select: { id: true, bookingDate: true, startTime: true, endTime: true, venueId: true, facilityId: true, facilityName: true, sport: true } },
        venue: { select: { id: true, name: true, locationCity: true, locationAddr: true } },
        createdBy: { select: { name: true, email: true } },
        players: { include: { user: { select: { name: true, email: true } } } }
      }
    });

    const result = {
      ...populated,
      players: populated.players.map(p => p.user),
      venue: populated.venue ? { ...populated.venue, location: { city: populated.venue.locationCity, address: populated.venue.locationAddr } } : null
    };
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
