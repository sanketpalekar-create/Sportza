const prisma = require('../lib/prisma');
const { resolveSlotConflict, getPaidPercent } = require('./bookingConflict');
const { processRefundsForBooking } = require('./refundService');

/** Return slot start as Date from booking (bookingDate + startTime "HH:mm") */
function getSlotStart(booking) {
  const d = new Date(booking.bookingDate);
  const [h, m] = (booking.startTime || '00:00').split(':').map(Number);
  d.setHours(h, m || 0, 0, 0);
  return d;
}

/** Check if booking has all payment done (full: paymentStatus completed; split: all splitPayments paid) */
function isPaymentComplete(booking, splitPayments = null) {
  const splits = splitPayments || booking.splitPayments || [];
  if (booking.paymentType === 'split' && splits.length > 0) {
    return splits.every(sp => sp.status === 'paid');
  }
  return booking.paymentStatus === 'completed';
}

/**
 * Process open-play confirmations at T-30: confirm open-play bookings that have ≥50% paid (payment-priority).
 * No auto-cancel: bookings that are <50% paid remain pending_open_play. First to reach ≥50% wins the slot.
 * Call periodically or via GET /api/open-plays/process-confirmations.
 * @returns {{ confirmed: Array, noChange: Array }}
 */
async function processOpenPlayConfirmations() {
  const now = Date.now();
  const windowEnd = now + 30 * 60 * 1000; // 30 minutes from now

  const pending = await prisma.booking.findMany({
    where: { status: 'pending_open_play' },
    include: {
      venue: { select: { name: true } },
      splitPayments: true
    }
  });

  const results = { confirmed: [], noChange: [] };

  for (const booking of pending) {
    const slotStart = getSlotStart(booking);
    const slotMs = slotStart.getTime();
    if (slotMs < now || slotMs > windowEnd) continue;

    const openPlay = await prisma.openPlay.findFirst({
      where: { bookingId: booking.id }
    });
    if (!openPlay) continue;

    const paidPct = await getPaidPercent(booking);
    if (paidPct < 50) {
      results.noChange.push({ bookingId: booking.id, reason: 'under_50_paid', paidPct });
      continue;
    }

    const allPaid = isPaymentComplete(booking, booking.splitPayments);
    const newStatus = allPaid ? 'fully_paid' : 'confirmed';
    const result = await resolveSlotConflict(booking, newStatus);
    if (result.won) {
      results.confirmed.push({
        bookingId: booking.id,
        venue: booking.venue?.name,
        facilityName: booking.facilityName,
        slot: slotStart,
        status: newStatus,
        cancelledConflictIds: result.cancelledConflictIds
      });
      result.cancelledConflictIds.forEach(id =>
        processRefundsForBooking(id, 'conflict').catch(err => console.error('Refund (conflict) failed:', err))
      );
    } else {
      results.noChange.push({ bookingId: booking.id, reason: 'slot_taken_by_another' });
      processRefundsForBooking(booking.id, 'conflict').catch(err => console.error('Refund (conflict) failed:', err));
    }
  }

  return results;
}

module.exports = { processOpenPlayConfirmations, getSlotStart, isPaymentComplete };
