const express = require('express');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');

const router = express.Router();

/** Parse year (YYYY) and month (1-12) from query; return { start, end } for the month in UTC date range. */
function getMonthRange(year, month) {
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return null;
  }
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return { start, end, year: y, month: m };
}

/**
 * Monthly report for a venue: net revenue and platform commission for bookings in that month.
 * Settlement is month-wise; this report gives transparency for venue owners.
 * GET /api/reports/venues/:venueId/monthly?year=2025&month=6
 */
router.get('/venues/:venueId/monthly', auth, async (req, res) => {
  try {
    const { venueId } = req.params;
    const range = getMonthRange(req.query.year, req.query.month);
    if (!range) {
      return res.status(400).json({ message: 'Query parameters year (YYYY) and month (1-12) are required' });
    }

    const venue = await prisma.venue.findUnique({
      where: { id: parseInt(venueId) }
    });
    if (!venue) {
      return res.status(404).json({ message: 'Venue not found' });
    }
    const isOwner = venue.ownerId === parseInt(req.user.id);
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view this venue report' });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        venueId: parseInt(venueId),
        bookingDate: { gte: range.start, lte: range.end },
        status: { in: ['confirmed', 'fully_paid', 'completed'] }
      }
    });

    const agg = {
      bookingCount: bookings.length,
      totalAmount: bookings.reduce((s, b) => s + (b.totalAmount || 0), 0),
      platformCommissionAmount: bookings.reduce((s, b) => s + (b.platformCommissionAmount || 0), 0),
      venueNetAmount: bookings.reduce((s, b) => s + (b.venueNetAmount || 0), 0)
    };

    const summary = {
      year: range.year,
      month: range.month,
      venueId: parseInt(venueId),
      venueName: venue.name,
      bookingCount: agg.bookingCount,
      totalAmount: Math.round(agg.totalAmount * 100) / 100,
      platformCommissionAmount: Math.round(agg.platformCommissionAmount * 100) / 100,
      venueNetAmount: Math.round(agg.venueNetAmount * 100) / 100
    };

    res.json(summary);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Monthly report for the current trainer: net revenue and platform commission from batch payments in that month.
 * GET /api/reports/trainers/me/monthly?year=2025&month=6
 */
router.get('/trainers/me/monthly', auth, async (req, res) => {
  try {
    if (req.user.role !== 'trainer' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only trainers can view trainer monthly report' });
    }

    const range = getMonthRange(req.query.year, req.query.month);
    if (!range) {
      return res.status(400).json({ message: 'Query parameters year (YYYY) and month (1-12) are required' });
    }

    const trainerId = parseInt(req.user.id);
    const batchIds = (await prisma.batch.findMany({
      where: { trainerId },
      select: { id: true }
    })).map(b => b.id);

    const payments = await prisma.batchPayment.findMany({
      where: {
        batchId: { in: batchIds },
        createdAt: { gte: range.start, lte: range.end },
        status: 'completed'
      }
    });

    const agg = {
      paymentCount: payments.length,
      totalAmount: payments.reduce((s, p) => s + p.amount, 0),
      platformCommissionAmount: payments.reduce((s, p) => s + (p.platformCommissionAmount || 0), 0),
      trainerNetAmount: payments.reduce((s, p) => s + (p.trainerNetAmount || 0), 0)
    };

    const summary = {
      year: range.year,
      month: range.month,
      trainerId: String(trainerId),
      paymentCount: agg.paymentCount,
      totalAmount: Math.round(agg.totalAmount * 100) / 100,
      platformCommissionAmount: Math.round(agg.platformCommissionAmount * 100) / 100,
      trainerNetAmount: Math.round(agg.trainerNetAmount * 100) / 100
    };

    res.json(summary);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Monthly report for a trainer (admin only). Same shape as trainers/me/monthly.
 * GET /api/reports/trainers/:trainerId/monthly?year=2025&month=6
 */
router.get('/trainers/:trainerId/monthly', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admin can view another trainer report' });
    }

    const range = getMonthRange(req.query.year, req.query.month);
    if (!range) {
      return res.status(400).json({ message: 'Query parameters year (YYYY) and month (1-12) are required' });
    }

    const trainerId = parseInt(req.params.trainerId);
    const batchIds = (await prisma.batch.findMany({
      where: { trainerId },
      select: { id: true }
    })).map(b => b.id);

    const payments = await prisma.batchPayment.findMany({
      where: {
        batchId: { in: batchIds },
        createdAt: { gte: range.start, lte: range.end },
        status: 'completed'
      }
    });

    const agg = {
      paymentCount: payments.length,
      totalAmount: payments.reduce((s, p) => s + p.amount, 0),
      platformCommissionAmount: payments.reduce((s, p) => s + (p.platformCommissionAmount || 0), 0),
      trainerNetAmount: payments.reduce((s, p) => s + (p.trainerNetAmount || 0), 0)
    };

    const summary = {
      year: range.year,
      month: range.month,
      trainerId: String(trainerId),
      paymentCount: agg.paymentCount,
      totalAmount: Math.round(agg.totalAmount * 100) / 100,
      platformCommissionAmount: Math.round(agg.platformCommissionAmount * 100) / 100,
      trainerNetAmount: Math.round(agg.trainerNetAmount * 100) / 100
    };

    res.json(summary);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Platform monthly report: total commission from bookings and from batch payments, with optional breakdown.
 * For transparency and month-wise settlement. Admin only.
 * GET /api/reports/platform/monthly?year=2025&month=6&breakdown=venue,trainer
 */
router.get('/platform/monthly', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admin can view platform report' });
    }

    const range = getMonthRange(req.query.year, req.query.month);
    if (!range) {
      return res.status(400).json({ message: 'Query parameters year (YYYY) and month (1-12) are required' });
    }

    const includeVenueBreakdown = req.query.breakdown === 'venue' || req.query.breakdown === 'venue,trainer' || req.query.breakdown === 'trainer,venue';
    const includeTrainerBreakdown = req.query.breakdown === 'trainer' || req.query.breakdown === 'venue,trainer' || req.query.breakdown === 'trainer,venue';

    const bookings = await prisma.booking.findMany({
      where: {
        bookingDate: { gte: range.start, lte: range.end },
        status: { in: ['confirmed', 'fully_paid', 'completed'] }
      }
    });

    const bookingTotals = {
      bookingCount: bookings.length,
      totalBookingAmount: bookings.reduce((s, b) => s + (b.totalAmount || 0), 0),
      platformCommissionAmount: bookings.reduce((s, b) => s + (b.platformCommissionAmount || 0), 0),
      venueNetAmount: bookings.reduce((s, b) => s + (b.venueNetAmount || 0), 0)
    };

    const batchPayments = await prisma.batchPayment.findMany({
      where: {
        createdAt: { gte: range.start, lte: range.end },
        status: 'completed'
      }
    });

    const batchPaymentTotals = {
      paymentCount: batchPayments.length,
      totalAmount: batchPayments.reduce((s, p) => s + p.amount, 0),
      platformCommissionAmount: batchPayments.reduce((s, p) => s + (p.platformCommissionAmount || 0), 0),
      trainerNetAmount: batchPayments.reduce((s, p) => s + (p.trainerNetAmount || 0), 0)
    };

    const commissionFromBookings = Math.round(bookingTotals.platformCommissionAmount * 100) / 100;
    const commissionFromBatchPayments = Math.round(batchPaymentTotals.platformCommissionAmount * 100) / 100;
    const totalPlatformCommission = Math.round((commissionFromBookings + commissionFromBatchPayments) * 100) / 100;

    const report = {
      year: range.year,
      month: range.month,
      commissionFromBookings,
      commissionFromBatchPayments,
      totalPlatformCommission,
      bookingCount: bookingTotals.bookingCount,
      totalBookingAmount: Math.round(bookingTotals.totalBookingAmount * 100) / 100,
      totalVenueNet: Math.round(bookingTotals.venueNetAmount * 100) / 100,
      batchPaymentCount: batchPaymentTotals.paymentCount,
      totalBatchPaymentAmount: Math.round(batchPaymentTotals.totalAmount * 100) / 100,
      totalTrainerNet: Math.round(batchPaymentTotals.trainerNetAmount * 100) / 100
    };

    if (includeVenueBreakdown) {
      const byVenueMap = {};
      for (const b of bookings) {
        const vid = b.venueId;
        if (!byVenueMap[vid]) {
          byVenueMap[vid] = { bookingCount: 0, totalAmount: 0, platformCommissionAmount: 0, venueNetAmount: 0 };
        }
        byVenueMap[vid].bookingCount++;
        byVenueMap[vid].totalAmount += b.totalAmount || 0;
        byVenueMap[vid].platformCommissionAmount += b.platformCommissionAmount || 0;
        byVenueMap[vid].venueNetAmount += b.venueNetAmount || 0;
      }
      const venueIds = Object.keys(byVenueMap).map(Number);
      const venues = venueIds.length > 0
        ? await prisma.venue.findMany({
            where: { id: { in: venueIds } },
            select: { id: true, name: true }
          })
        : [];
      const venueMap = Object.fromEntries(venues.map(v => [v.id, v.name]));
      report.byVenue = Object.entries(byVenueMap).map(([venueId, r]) => ({
        venueId: parseInt(venueId),
        venueName: venueMap[parseInt(venueId)] || '—',
        bookingCount: r.bookingCount,
        totalAmount: Math.round(r.totalAmount * 100) / 100,
        platformCommissionAmount: Math.round(r.platformCommissionAmount * 100) / 100,
        venueNetAmount: Math.round(r.venueNetAmount * 100) / 100
      })).sort((a, b) => b.platformCommissionAmount - a.platformCommissionAmount);
    }

    if (includeTrainerBreakdown) {
      const batchIds = [...new Set(batchPayments.map(p => p.batchId))];
      const batches = batchIds.length > 0
        ? await prisma.batch.findMany({
            where: { id: { in: batchIds } },
            select: { id: true, trainerId: true }
          })
        : [];
      const batchToTrainer = Object.fromEntries(batches.map(b => [b.id, b.trainerId]));
      const byTrainerMap = {};
      for (const p of batchPayments) {
        const tid = batchToTrainer[p.batchId];
        if (!tid) continue;
        if (!byTrainerMap[tid]) {
          byTrainerMap[tid] = { paymentCount: 0, totalAmount: 0, platformCommissionAmount: 0, trainerNetAmount: 0 };
        }
        byTrainerMap[tid].paymentCount++;
        byTrainerMap[tid].totalAmount += p.amount;
        byTrainerMap[tid].platformCommissionAmount += p.platformCommissionAmount || 0;
        byTrainerMap[tid].trainerNetAmount += p.trainerNetAmount || 0;
      }
      const trainerIds = Object.keys(byTrainerMap).map(Number);
      const users = trainerIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: trainerIds } },
            select: { id: true, name: true, email: true }
          })
        : [];
      const userMap = Object.fromEntries(users.map(u => [u.id, u]));
      report.byTrainer = Object.entries(byTrainerMap).map(([trainerId, r]) => {
        const id = parseInt(trainerId);
        const u = userMap[id];
        return {
          trainerId: id,
          trainerName: u ? u.name : '—',
          trainerEmail: u ? u.email : undefined,
          paymentCount: r.paymentCount,
          totalAmount: Math.round(r.totalAmount * 100) / 100,
          platformCommissionAmount: Math.round(r.platformCommissionAmount * 100) / 100,
          trainerNetAmount: Math.round(r.trainerNetAmount * 100) / 100
        };
      }).sort((a, b) => b.platformCommissionAmount - a.platformCommissionAmount);
    }

    res.json(report);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
