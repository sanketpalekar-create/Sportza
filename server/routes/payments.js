const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');
const { resolveSlotConflict, resolveGroupConflict } = require('../services/bookingConflict');
const { processRefundsForBooking } = require('../services/refundService');

const router = express.Router();

/** Create or find BookingPayment record (source of truth for paid amount). Idempotent by paymentGatewayId. */
async function ensureBookingPayment(bookingId, userId, amount, paymentId, orderId, splitIndex) {
  const existing = await prisma.bookingPayment.findFirst({
    where: { bookingId, paymentGatewayId: paymentId }
  });
  if (existing) return existing;
  return prisma.bookingPayment.create({
    data: {
      bookingId,
      userId,
      amount: Math.round(amount * 100) / 100,
      paymentMethod: 'online',
      paymentGatewayId: paymentId,
      razorpayOrderId: orderId,
      status: 'paid',
      ...(splitIndex != null && { splitIndex })
    }
  });
}

/** Resolve conflicts for a booking, using group-aware resolution when the booking belongs to a multi-court group. */
async function resolveConflictForBooking(booking, newStatus) {
  if (booking.groupId) {
    return resolveGroupConflict(booking.groupId, newStatus);
  }
  return resolveSlotConflict(booking, newStatus);
}

/** For grouped bookings, mark all siblings as paid and run group conflict resolution. */
async function applyGroupPayment(primaryBooking, paymentId, orderId) {
  const siblings = await prisma.booking.findMany({
    where: { groupId: primaryBooking.groupId }
  });
  for (const b of siblings) {
    await prisma.booking.update({
      where: { id: b.id },
      data: {
        paymentStatus: 'completed',
        paymentId,
        razorpayPaymentId: paymentId,
        razorpayOrderId: orderId,
        paidAmount: b.totalAmount || 0
      }
    });
    await ensureBookingPayment(b.id, b.userId, b.totalAmount || 0, paymentId, orderId, null);
  }
  const newStatus = primaryBooking.batchId ? 'confirmed' : 'fully_paid';
  const result = await resolveGroupConflict(primaryBooking.groupId, newStatus);
  if (!result.won) {
    for (const b of siblings) {
      processRefundsForBooking(b.id, 'conflict').catch(err => console.error('Refund (conflict) failed:', err));
    }
    return { won: false };
  }
  result.cancelledConflictIds.forEach(id => processRefundsForBooking(parseInt(id), 'conflict').catch(err => console.error('Refund (conflict) failed:', err)));
  return { won: true };
}

/** Apply payment success to a booking (full or one split). Idempotent: if already paid with this paymentId, returns true without changing. */
async function applyPaymentCaptured(booking, orderId, paymentId, splitIndex) {
  const idx = splitIndex != null ? parseInt(splitIndex, 10) : -1;
  const splitPayments = await prisma.splitPayment.findMany({
    where: { bookingId: booking.id },
    orderBy: { id: 'asc' }
  });

  if (booking.paymentType === 'split' && splitPayments.length > 0 && idx >= 0) {
    if (idx >= splitPayments.length) return false;
    const sp = splitPayments[idx];
    if (sp.status === 'paid' && sp.razorpayPaymentId === paymentId) return true;
    if (sp.razorpayOrderId !== orderId) return false;

    await prisma.splitPayment.update({
      where: { id: sp.id },
      data: { status: 'paid', razorpayPaymentId: paymentId }
    });

    await ensureBookingPayment(booking.id, sp.userId, sp.amount, paymentId, orderId, idx);

    const updatedSplits = await prisma.splitPayment.findMany({
      where: { bookingId: booking.id },
      orderBy: { id: 'asc' }
    });
    const allPaid = updatedSplits.every(s => s.status === 'paid');
    const totalPaid = updatedSplits.reduce((s, ssp) => s + (ssp.status === 'paid' ? ssp.amount : 0), 0);

    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        ...(allPaid && { paymentStatus: 'completed' }),
        paidAmount: Math.round(totalPaid * 100) / 100
      }
    });

    const paidPct = booking.totalAmount > 0 ? (totalPaid / booking.totalAmount) * 100 : 0;
    if (paidPct >= 100) {
      const result = await resolveConflictForBooking({ ...booking, paymentStatus: allPaid ? 'completed' : booking.paymentStatus }, 'fully_paid');
      if (!result.won) {
        processRefundsForBooking(booking.id, 'conflict').catch(err => console.error('Refund (conflict) failed:', err));
        return true;
      }
      result.cancelledConflictIds.forEach(id => processRefundsForBooking(parseInt(id), 'conflict').catch(err => console.error('Refund (conflict) failed:', err)));
    } else if (paidPct >= 50) {
      const result = await resolveConflictForBooking(booking, 'confirmed');
      if (!result.won) {
        processRefundsForBooking(booking.id, 'conflict').catch(err => console.error('Refund (conflict) failed:', err));
        return true;
      }
      result.cancelledConflictIds.forEach(id => processRefundsForBooking(parseInt(id), 'conflict').catch(err => console.error('Refund (conflict) failed:', err)));
    }
    return true;
  }

  // Full payment
  if (booking.paymentStatus === 'completed' && booking.razorpayPaymentId === paymentId) return true;
  if (booking.razorpayOrderId !== orderId) return false;

  if (booking.groupId) {
    const groupResult = await applyGroupPayment(booking, paymentId, orderId);
    return true;
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      paymentStatus: 'completed',
      paymentId,
      razorpayPaymentId: paymentId,
      paidAmount: booking.totalAmount || 0
    }
  });
  await ensureBookingPayment(booking.id, booking.userId, booking.totalAmount || 0, paymentId, orderId, null);

  const newStatus = booking.batchId ? 'confirmed' : 'fully_paid';
  const result = await resolveSlotConflict(booking, newStatus);
  if (!result.won) {
    processRefundsForBooking(booking.id, 'conflict').catch(err => console.error('Refund (conflict) failed:', err));
    return true;
  }
  result.cancelledConflictIds.forEach(id => processRefundsForBooking(parseInt(id), 'conflict').catch(err => console.error('Refund (conflict) failed:', err)));
  return true;
}

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_key',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret'
});

// Create payment order (supports single bookingId or groupId for multi-court)
router.post('/create-order', auth, async (req, res) => {
  try {
    const { bookingId, groupId, forUser, splitIndex, method } = req.body;

    if (groupId && !bookingId) {
      const groupBookings = await prisma.booking.findMany({
        where: { groupId, userId: req.user.id }
      });
      if (!groupBookings.length) {
        return res.status(404).json({ message: 'No bookings found for this group' });
      }
      const cancelledStatuses = ['cancelled', 'cancelled_user', 'cancelled_conflict'];
      const invalid = groupBookings.find(b => cancelledStatuses.includes(b.status) || b.status === 'completed');
      if (invalid) {
        return res.status(400).json({ message: `Booking ${invalid.facilityName} is ${invalid.status}; payment not allowed` });
      }
      const alreadyPaid = groupBookings.every(b => b.paymentStatus === 'completed');
      if (alreadyPaid) {
        return res.status(400).json({ message: 'All bookings in this group are already paid' });
      }

      const combinedTotal = groupBookings.reduce((s, b) => s + (b.totalAmount || 0), 0);
      const amountPaise = Math.round(combinedTotal * 100);
      const primaryBooking = groupBookings[0];

      const options = {
        amount: amountPaise,
        currency: 'INR',
        receipt: `group_${groupId}`,
        notes: {
          bookingId: String(primaryBooking.id),
          groupId: String(groupId),
          userId: String(req.user.id)
        }
      };
      if (method && ['upi', 'card', 'netbanking', 'wallet'].includes(String(method).toLowerCase())) {
        options.notes.preferred_method = String(method).toLowerCase();
      }

      const order = await razorpay.orders.create(options);
      await prisma.booking.update({
        where: { id: primaryBooking.id },
        data: { razorpayOrderId: order.id }
      });

      return res.json({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        groupId,
        facilitiesCount: groupBookings.length,
        preferredMethod: options.notes.preferred_method || null
      });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      include: { splitPayments: true }
    });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    const cancelledStatuses = ['cancelled', 'cancelled_user', 'cancelled_conflict'];
    if (cancelledStatuses.includes(booking.status) || booking.status === 'completed') {
      return res.status(400).json({ message: 'Booking is cancelled or completed; payment not allowed' });
    }

    const isBooker = booking.userId === req.user.id;

    if (booking.paymentStatus === 'completed') {
      return res.status(400).json({ message: 'Booking already paid' });
    }

    let amountPaise;
    let noteSplitIndex = null;

    if (booking.paymentType === 'split' && booking.splitPayments && booking.splitPayments.length > 0) {
      let idx = typeof splitIndex === 'number' ? splitIndex : -1;
      if (idx < 0 && forUser) {
        idx = booking.splitPayments.findIndex(sp => sp.userId === parseInt(forUser));
      }
      if (idx < 0 || idx >= booking.splitPayments.length) {
        return res.status(400).json({ message: 'Provide forUser (userId) or splitIndex for split payment' });
      }
      const share = booking.splitPayments[idx];
      if (share.status === 'paid') {
        return res.status(400).json({ message: 'This share is already paid' });
      }
      const canPay = isBooker || (share.userId === req.user.id);
      if (!canPay) {
        return res.status(403).json({ message: 'Not authorized to pay this share' });
      }
      amountPaise = Math.round(share.amount * 100);
      noteSplitIndex = idx;
    } else {
      if (!isBooker) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      if (booking.groupId) {
        const groupBookings = await prisma.booking.findMany({
          where: { groupId: booking.groupId }
        });
        amountPaise = Math.round(groupBookings.reduce((s, b) => s + (b.totalAmount || 0), 0) * 100);
      } else {
        amountPaise = Math.round(booking.totalAmount * 100);
      }
    }

    const options = {
      amount: amountPaise,
      currency: 'INR',
      receipt: noteSplitIndex != null ? `booking_${booking.id}_split_${noteSplitIndex}` : `booking_${booking.id}`,
      notes: {
        bookingId: String(booking.id),
        userId: String(req.user.id)
      }
    };
    if (booking.groupId) options.notes.groupId = String(booking.groupId);
    if (noteSplitIndex != null) options.notes.splitIndex = String(noteSplitIndex);
    if (method && ['upi', 'card', 'netbanking', 'wallet'].includes(String(method).toLowerCase())) {
      options.notes.preferred_method = String(method).toLowerCase();
    }

    const order = await razorpay.orders.create(options);

    if (booking.paymentType === 'split' && noteSplitIndex != null) {
      const sp = booking.splitPayments[noteSplitIndex];
      await prisma.splitPayment.update({
        where: { id: sp.id },
        data: { razorpayOrderId: order.id }
      });
    } else {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { razorpayOrderId: order.id }
      });
    }

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      splitIndex: noteSplitIndex,
      groupId: booking.groupId || null,
      preferredMethod: options.notes.preferred_method || null
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Payment order creation failed', error: error.message });
  }
});

// Verify payment (client-triggered; idempotent: if already paid with this paymentId, return success)
router.post('/verify', auth, async (req, res) => {
  try {
    const { orderId, paymentId, signature, bookingId, splitIndex } = req.body;

    const text = `${orderId}|${paymentId}`;
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest('hex');

    if (generatedSignature !== signature) {
      return res.status(400).json({ message: 'Payment verification failed' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      include: { splitPayments: true }
    });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const idx = splitIndex != null ? parseInt(splitIndex, 10) : -1;
    if (booking.paymentType === 'split' && booking.splitPayments && idx >= 0 && idx < booking.splitPayments.length) {
      const sp = booking.splitPayments[idx];
      if (sp.status === 'paid' && sp.razorpayPaymentId === paymentId) {
        const updated = await prisma.booking.findUnique({
          where: { id: parseInt(bookingId) },
          include: {
            user: { select: { name: true, email: true, phone: true } },
            venue: { select: { name: true, locationCity: true, locationAddr: true, locationPin: true, locationCoords: true } }
          }
        });
        return res.json({ message: 'Payment already recorded', booking: updated });
      }
    } else if (booking.paymentStatus === 'completed' && booking.razorpayPaymentId === paymentId) {
      const updated = await prisma.booking.findUnique({
        where: { id: parseInt(bookingId) },
        include: {
          user: { select: { name: true, email: true, phone: true } },
          venue: { select: { name: true, locationCity: true, locationAddr: true, locationPin: true, locationCoords: true } }
        }
      });
      return res.json({ message: 'Payment already recorded', booking: updated });
    }

    if (booking.paymentType === 'split' && booking.splitPayments && booking.splitPayments.length > 0 && idx >= 0) {
      if (idx >= booking.splitPayments.length) {
        return res.status(400).json({ message: 'Invalid splitIndex' });
      }
      const sp = booking.splitPayments[idx];
      await prisma.splitPayment.update({
        where: { id: sp.id },
        data: { status: 'paid', razorpayPaymentId: paymentId }
      });
      await ensureBookingPayment(booking.id, sp.userId, sp.amount, paymentId, orderId, idx);

      const updatedSplits = await prisma.splitPayment.findMany({
        where: { bookingId: booking.id },
        orderBy: { id: 'asc' }
      });
      const allPaid = updatedSplits.every(s => s.status === 'paid');
      const totalPaid = updatedSplits.reduce((s, ssp) => s + (ssp.status === 'paid' ? ssp.amount : 0), 0);

      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          ...(allPaid && { paymentStatus: 'completed' }),
          paidAmount: Math.round(totalPaid * 100) / 100
        }
      });

      const paidPct = booking.totalAmount > 0 ? (totalPaid / booking.totalAmount) * 100 : 0;
      if (paidPct >= 100) {
        const result = await resolveSlotConflict(booking, 'fully_paid');
        if (!result.won) {
          processRefundsForBooking(parseInt(bookingId), 'conflict').catch(err => console.error('Refund (conflict) failed:', err));
          const updated = await prisma.booking.findUnique({
            where: { id: parseInt(bookingId) },
            include: {
              user: { select: { name: true, email: true } },
              venue: { select: { name: true } }
            }
          });
          return res.json({ message: 'Payment verified but slot was taken by another booking', booking: updated, refund: '100% (cancelled_conflict)' });
        }
        result.cancelledConflictIds.forEach(id => processRefundsForBooking(parseInt(id), 'conflict').catch(err => console.error('Refund (conflict) failed:', err)));
      } else if (paidPct >= 50) {
        const result = await resolveSlotConflict(booking, 'confirmed');
        if (!result.won) {
          processRefundsForBooking(parseInt(bookingId), 'conflict').catch(err => console.error('Refund (conflict) failed:', err));
          const updated = await prisma.booking.findUnique({
            where: { id: parseInt(bookingId) },
            include: {
              user: { select: { name: true, email: true } },
              venue: { select: { name: true } }
            }
          });
          return res.json({ message: 'Payment verified but slot was taken by another booking', booking: updated, refund: '100% (cancelled_conflict)' });
        }
        result.cancelledConflictIds.forEach(id => processRefundsForBooking(parseInt(id), 'conflict').catch(err => console.error('Refund (conflict) failed:', err)));
      }
    } else {
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          paymentStatus: 'completed',
          paymentId,
          razorpayPaymentId: paymentId,
          paidAmount: booking.totalAmount || 0
        }
      });
      await ensureBookingPayment(booking.id, booking.userId, booking.totalAmount || 0, paymentId, orderId, null);

      const newStatus = booking.batchId ? 'confirmed' : 'fully_paid';
      const result = await resolveSlotConflict(booking, newStatus);
      if (!result.won) {
        processRefundsForBooking(parseInt(bookingId), 'conflict').catch(err => console.error('Refund (conflict) failed:', err));
        const updated = await prisma.booking.findUnique({
          where: { id: parseInt(bookingId) },
          include: {
            user: { select: { name: true, email: true } },
            venue: { select: { name: true } }
          }
        });
        return res.json({ message: 'Payment verified but slot was taken by another booking', booking: updated, refund: '100% (cancelled_conflict)' });
      }
      result.cancelledConflictIds.forEach(id => processRefundsForBooking(parseInt(id), 'conflict').catch(err => console.error('Refund (conflict) failed:', err)));
    }

    if (booking.groupId) {
      const groupBookings = await prisma.booking.findMany({
        where: { groupId: booking.groupId },
        include: {
          user: { select: { name: true, email: true, phone: true } },
          venue: { select: { name: true, locationCity: true, locationAddr: true, locationPin: true, locationCoords: true } }
        }
      });
      return res.json({ message: 'Payment verified', bookings: groupBookings, groupId: booking.groupId });
    }

    const updated = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      include: {
        user: { select: { name: true, email: true, phone: true } },
        venue: { select: { name: true, locationCity: true, locationAddr: true, locationPin: true, locationCoords: true } }
      }
    });
    res.json({ message: 'Payment verified', booking: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Payment verification failed', error: error.message });
  }
});

// Razorpay webhook: server-side payment confirmation (no auth; signature verified with RAZORPAY_WEBHOOK_SECRET)
router.post('/webhook', async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.warn('Payments webhook: RAZORPAY_WEBHOOK_SECRET not set; rejecting webhook');
      return res.status(503).json({ message: 'Webhook not configured' });
    }
    const rawBody = req.body && Buffer.isBuffer(req.body) ? req.body.toString('utf8') : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      return res.status(400).json({ message: 'Missing x-razorpay-signature' });
    }
    const expectedSig = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    if (expectedSig !== signature) {
      return res.status(400).json({ message: 'Invalid webhook signature' });
    }
    const payload = JSON.parse(rawBody);
    const event = payload.event;
    if (event !== 'payment.captured') {
      return res.status(200).json({ received: true });
    }
    const entity = payload.payload && payload.payload.payment && payload.payload.payment.entity;
    if (!entity || !entity.id || !entity.order_id) {
      return res.status(200).json({ received: true });
    }
    const paymentId = entity.id;
    const orderId = entity.order_id;
    const notes = entity.notes || {};
    let booking = notes.bookingId ? await prisma.booking.findUnique({ where: { id: parseInt(notes.bookingId) } }) : null;
    if (!booking) {
      const byOrder = await prisma.booking.findFirst({ where: { razorpayOrderId: orderId } });
      if (byOrder) booking = byOrder;
    }
    if (!booking) {
      const splitWithOrder = await prisma.splitPayment.findFirst({ where: { razorpayOrderId: orderId } });
      if (splitWithOrder) {
        booking = await prisma.booking.findUnique({ where: { id: splitWithOrder.bookingId } });
      }
    }
    if (!booking) {
      console.warn('Payments webhook: no booking found for order_id=', orderId);
      return res.status(200).json({ received: true });
    }
    let splitIndex = notes.splitIndex != null ? String(notes.splitIndex) : null;
    if (splitIndex == null && booking.paymentType === 'split') {
      const splitPayments = await prisma.splitPayment.findMany({ where: { bookingId: booking.id }, orderBy: { id: 'asc' } });
      const idx = splitPayments.findIndex(sp => sp.razorpayOrderId === orderId);
      if (idx >= 0) splitIndex = String(idx);
    }
    await applyPaymentCaptured(booking, orderId, paymentId, splitIndex);
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Payments webhook error:', error);
    res.status(500).json({ message: 'Webhook processing failed' });
  }
});

// List refunds for the current user (across all bookings)
router.get('/refunds', auth, async (req, res) => {
  try {
    const refunds = await prisma.refund.findMany({
      where: { userId: req.user.id },
      include: {
        booking: { select: { venueId: true, bookingDate: true, startTime: true, endTime: true, facilityName: true, sport: true, status: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    const totalRefunded = refunds.reduce((s, r) => s + r.amountRefunded, 0);
    res.json({ refunds, totalRefunded });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get payment status (for full or split; if split, includes splitPayments)
router.get('/booking/:bookingId', auth, async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(req.params.bookingId) },
      include: {
        splitPayments: { include: { user: { select: { name: true, email: true } } } }
      }
    });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const isBooker = booking.userId === req.user.id;
    const isParticipant = booking.splitPayments && booking.splitPayments.some(sp => sp.userId === req.user.id);
    if (!isBooker && !isParticipant) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const payload = {
      paymentStatus: booking.paymentStatus,
      paymentType: booking.paymentType,
      totalAmount: booking.totalAmount,
      orderId: booking.razorpayOrderId,
      paymentId: booking.razorpayPaymentId
    };
    if (booking.paymentType === 'split' && booking.splitPayments) {
      payload.splitPayments = booking.splitPayments.map((sp, i) => ({
        index: i,
        user: sp.user,
        amount: sp.amount,
        status: sp.status,
        razorpayOrderId: sp.razorpayOrderId
      }));
    }
    res.json(payload);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
