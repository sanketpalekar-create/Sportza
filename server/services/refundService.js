const Razorpay = require('razorpay');
const prisma = require('../lib/prisma');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_key',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret'
});

const FEE_PERCENT_MANUAL = 5;
const FEE_PERCENT_CONFLICT = 0;

/**
 * Compute refund breakdown for a cancelled booking.
 * @param {Object} booking - populated or plain booking doc
 * @param {Array} [splitPayments] - Optional array of SplitPayment records (when paymentType is 'split')
 * @param {'manual'|'conflict'} reason
 * @returns {Array<{ user, splitIndex, amountPaid, amountRefunded, platformFee, razorpayPaymentId }>}
 */
function computeRefundBreakdown(booking, reason, splitPayments = null) {
  const feePercent = reason === 'manual' ? FEE_PERCENT_MANUAL : FEE_PERCENT_CONFLICT;
  const items = [];

  const splits = splitPayments || booking.splitPayments || [];

  if (booking.paymentType === 'split' && splits.length > 0) {
    for (let i = 0; i < splits.length; i++) {
      const sp = splits[i];
      if (sp.status !== 'paid' || !sp.razorpayPaymentId) continue;
      const amountPaid = sp.amount;
      const platformFee = Math.round(amountPaid * (feePercent / 100) * 100) / 100;
      const amountRefunded = Math.round((amountPaid - platformFee) * 100) / 100;
      items.push({
        user: sp.userId,
        splitIndex: i,
        amountPaid,
        amountRefunded,
        platformFee,
        razorpayPaymentId: sp.razorpayPaymentId
      });
    }
  } else {
    if (booking.paymentStatus !== 'completed' || !booking.razorpayPaymentId) return items;
    const amountPaid = booking.totalAmount || 0;
    const platformFee = Math.round(amountPaid * (feePercent / 100) * 100) / 100;
    const amountRefunded = Math.round((amountPaid - platformFee) * 100) / 100;
    items.push({
      user: booking.userId,
      splitIndex: null,
      amountPaid,
      amountRefunded,
      platformFee,
      razorpayPaymentId: booking.razorpayPaymentId
    });
  }

  return items;
}

/**
 * Create Refund documents and process each via Razorpay. Idempotent: skips if refunds already exist for this booking.
 * @param {string|number} bookingId
 * @param {'manual'|'conflict'} reason
 * @returns {{ refunds: Array, totalRefunded: number, totalFee: number, errors: string[], alreadyProcessed?: boolean }}
 */
async function processRefundsForBooking(bookingId, reason) {
  const bid = typeof bookingId === 'number' ? bookingId : parseInt(bookingId, 10);
  const booking = await prisma.booking.findUnique({
    where: { id: bid },
    include: { splitPayments: true }
  });

  if (!booking) {
    throw new Error('Booking not found');
  }
  const allowedStatuses = ['cancelled_user', 'cancelled_conflict'];
  if (!allowedStatuses.includes(booking.status)) {
    throw new Error(`Booking must be cancelled (status: ${booking.status})`);
  }

  const existing = await prisma.refund.count({ where: { bookingId: bid } });
  if (existing > 0) {
    const refunds = await prisma.refund.findMany({
      where: { bookingId: bid },
      include: { user: { select: { name: true, email: true } } }
    });
    const totalRefunded = refunds.reduce((s, r) => s + r.amountRefunded, 0);
    const totalFee = refunds.reduce((s, r) => s + r.platformFee, 0);
    return { refunds, totalRefunded, totalFee, errors: [], alreadyProcessed: true };
  }

  const breakdown = computeRefundBreakdown(booking, reason, booking.splitPayments);
  if (breakdown.length === 0) {
    return { refunds: [], totalRefunded: 0, totalFee: 0, errors: [] };
  }

  const errors = [];
  const created = [];

  for (const item of breakdown) {
    const refundDoc = await prisma.refund.create({
      data: {
        bookingId: bid,
        userId: item.user,
        splitIndex: item.splitIndex,
        amountPaid: item.amountPaid,
        amountRefunded: item.amountRefunded,
        platformFee: item.platformFee,
        reason,
        razorpayPaymentId: item.razorpayPaymentId,
        status: 'pending'
      }
    });
    created.push(refundDoc);

    const amountPaise = Math.round(item.amountRefunded * 100);
    if (amountPaise <= 0) continue;

    try {
      const refund = await razorpay.payments.refund(item.razorpayPaymentId, {
        amount: amountPaise,
        notes: { bookingId: String(bookingId), reason: String(reason) }
      });
      await prisma.refund.update({
        where: { id: refundDoc.id },
        data: {
          razorpayRefundId: refund.id,
          status: (refund.status === 'processed' || refund.status === 'pending') ? 'processed' : refund.status
        }
      });
    } catch (err) {
      await prisma.refund.update({
        where: { id: refundDoc.id },
        data: {
          status: 'failed',
          failureReason: err.message || String(err)
        }
      });
      errors.push(`Payment ${item.razorpayPaymentId}: ${err.message || String(err)}`);
    }
  }

  const updatedRefunds = await prisma.refund.findMany({ where: { bookingId: bid } });
  const totalRefunded = updatedRefunds
    .filter(r => r.status === 'processed')
    .reduce((s, r) => s + r.amountRefunded, 0);
  const totalFee = updatedRefunds.reduce((s, r) => s + r.platformFee, 0);

  await prisma.booking.update({
    where: { id: bid },
    data: { paymentStatus: 'refunded' }
  });

  const refunds = await prisma.refund.findMany({
    where: { bookingId: bid },
    include: { user: { select: { name: true, email: true } } }
  });

  return {
    refunds,
    totalRefunded,
    totalFee,
    errors
  };
}

module.exports = {
  computeRefundBreakdown,
  processRefundsForBooking,
  FEE_PERCENT_MANUAL,
  FEE_PERCENT_CONFLICT
};
