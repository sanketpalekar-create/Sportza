const prisma = require('../lib/prisma');

/** Same-slot query: returns a Prisma where clause for venue, facilityId, bookingDate, overlapping start/end time */
function sameSlotQuery(booking) {
  const d = booking.bookingDate instanceof Date ? booking.bookingDate : new Date(booking.bookingDate);
  const venueId = typeof booking.venueId === 'number' ? booking.venueId : parseInt(booking.venueId || booking.venue, 10);
  const facilityId = typeof booking.facilityId === 'number' ? booking.facilityId : parseInt(booking.facilityId, 10);

  return {
    venueId,
    facilityId,
    bookingDate: d,
    OR: [
      {
        startTime: { lte: booking.startTime },
        endTime: { gt: booking.startTime }
      },
      {
        startTime: { lt: booking.endTime },
        endTime: { gte: booking.endTime }
      },
      {
        startTime: { gte: booking.startTime },
        endTime: { lte: booking.endTime }
      }
    ]
  };
}

/**
 * Payment-priority conflict resolution: first to reach confirmation wins.
 * Uses Prisma transaction for ACID guarantees (prevents race conditions).
 * If another booking already has slot (confirmed/fully_paid), set this one to cancelled_conflict.
 * Else set this booking to newStatus and set all other pending for slot to cancelled_conflict.
 * @param {Object} booking - booking doc (with id, venueId, facilityId, bookingDate, startTime, endTime)
 * @param {string} newStatus - 'confirmed' or 'fully_paid'
 * @returns {{ won: boolean, cancelledConflictIds: string[] }}
 */
async function resolveSlotConflict(booking, newStatus) {
  const q = sameSlotQuery(booking);
  const bookingId = typeof booking.id === 'number' ? booking.id : parseInt(booking.id, 10);

  return prisma.$transaction(async (tx) => {
    const alreadyWon = await tx.booking.findFirst({
      where: {
        ...q,
        id: { not: bookingId },
        status: { in: ['confirmed', 'fully_paid'] }
      }
    });

    if (alreadyWon) {
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'cancelled_conflict' }
      });
      return { won: false, cancelledConflictIds: [] };
    }

    const updated = await tx.booking.updateMany({
      where: {
        id: bookingId,
        status: { in: ['pending', 'pending_open_play'] }
      },
      data: { status: newStatus }
    });

    if (updated.count === 0) {
      return { won: false, cancelledConflictIds: [] };
    }

    const others = await tx.booking.findMany({
      where: {
        ...q,
        id: { not: bookingId },
        status: { in: ['pending', 'pending_open_play'] }
      }
    });

    const ids = others.map(b => String(b.id));
    if (ids.length > 0) {
      await tx.booking.updateMany({
        where: { id: { in: others.map(b => b.id) } },
        data: { status: 'cancelled_conflict' }
      });
    }

    return { won: true, cancelledConflictIds: ids };
  });
}

/**
 * Paid amount for a booking. Source of truth: SUM(BookingPayment where status='paid').
 * Falls back to paidAmount/splitPayments for legacy bookings without BookingPayment records.
 */
async function getPaidAmount(booking) {
  const bookingId = booking && (booking.id ?? booking._id ?? booking);
  if (!bookingId) return 0;

  const bid = typeof bookingId === 'number' ? bookingId : parseInt(bookingId, 10);
  if (isNaN(bid)) return 0;

  const agg = await prisma.bookingPayment.aggregate({
    where: {
      bookingId: bid,
      status: 'paid'
    },
    _sum: { amount: true }
  });

  if (agg._sum?.amount != null && agg._sum.amount > 0) {
    return Math.round(agg._sum.amount * 100) / 100;
  }

  // Legacy fallback: paidAmount, splitPayments, or paymentStatus
  if (booking.paidAmount != null && typeof booking.paidAmount === 'number') {
    return booking.paidAmount;
  }
  if (booking.paymentType === 'split' && booking.splitPayments && booking.splitPayments.length) {
    return booking.splitPayments.filter(sp => sp.status === 'paid').reduce((s, sp) => s + sp.amount, 0);
  }
  return booking.paymentStatus === 'completed' ? (booking.totalAmount || 0) : 0;
}

/** Paid percentage (0–100) */
async function getPaidPercent(booking) {
  const total = booking.totalAmount || 0;
  if (total <= 0) return 0;
  return (await getPaidAmount(booking) / total) * 100;
}

/**
 * All-or-nothing conflict resolution for a multi-court booking group.
 * Runs resolveSlotConflict for each booking in the group. If ANY facility slot
 * is lost, all bookings in the group are cancelled with 100% refund.
 * @param {string} groupId
 * @param {string} newStatus - 'confirmed' or 'fully_paid'
 * @returns {{ won: boolean, cancelledConflictIds: string[] }}
 */
async function resolveGroupConflict(groupId, newStatus) {
  const bookings = await prisma.booking.findMany({
    where: {
      groupId,
      status: { in: ['pending', 'pending_open_play'] }
    }
  });

  if (!bookings.length) return { won: false, cancelledConflictIds: [] };

  const allCancelledIds = [];
  const results = [];

  for (const booking of bookings) {
    const result = await resolveSlotConflict(booking, newStatus);
    results.push({ bookingId: String(booking.id), ...result });
    if (result.won) {
      allCancelledIds.push(...result.cancelledConflictIds);
    }
  }

  const anyLost = results.some(r => !r.won);

  if (anyLost) {
    const wonIds = results.filter(r => r.won).map(r => r.bookingId);
    if (wonIds.length > 0) {
      await prisma.booking.updateMany({
        where: { id: { in: wonIds.map(id => parseInt(id, 10)) } },
        data: { status: 'cancelled_conflict' }
      });
      allCancelledIds.push(...wonIds);
    }
    const remainingPending = bookings
      .filter(b => !wonIds.includes(String(b.id)) && !results.find(r => r.bookingId === String(b.id) && !r.won))
      .map(b => b.id);
    if (remainingPending.length > 0) {
      await prisma.booking.updateMany({
        where: {
          id: { in: remainingPending },
          status: { in: ['pending', 'pending_open_play'] }
        },
        data: { status: 'cancelled_conflict' }
      });
    }
    return { won: false, cancelledConflictIds: allCancelledIds };
  }

  return { won: true, cancelledConflictIds: allCancelledIds };
}

module.exports = { sameSlotQuery, resolveSlotConflict, resolveGroupConflict, getPaidAmount, getPaidPercent };
