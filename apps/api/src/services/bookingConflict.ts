import prisma from "../lib/prisma";
import { addRefundJob, addEmailJob } from "../lib/queue";
import { emitBookingEvent } from "../lib/socket";
import { createNotification, NotifType } from "./notificationService";

interface TimeSlot {
  date: string;
  startTime: string;
  endTime: string;
}

/**
 * Check if a booking would conflict with existing bookings for the same slot.
 */
export async function checkBookingConflict(
  venueId: number,
  facilityId: number,
  slot: TimeSlot
): Promise<{ hasConflict: boolean; conflictingBookings: any[] }> {
  const bookingDate = new Date(slot.date);

  const conflicting = await prisma.booking.findMany({
    where: {
      venueId,
      facilityId,
      bookingDate,
      status: { in: ["confirmed", "fully_paid"] },
      OR: [
        {
          startTime: { lt: slot.endTime },
          endTime: { gt: slot.startTime },
        },
      ],
    },
    select: {
      id: true,
      startTime: true,
      endTime: true,
      status: true,
    },
  });

  return {
    hasConflict: conflicting.length > 0,
    conflictingBookings: conflicting,
  };
}

export async function getAvailableSlots(
  venueId: number,
  facilityId: number,
  date: string,
  operatingHours: { start: number; end: number } = { start: 6, end: 23 }
): Promise<Array<{ startTime: string; endTime: string; available: boolean }>> {
  const bookingDate = new Date(date);

  const existingBookings = await prisma.booking.findMany({
    where: {
      venueId,
      facilityId,
      bookingDate,
      status: { in: ["confirmed", "fully_paid", "pending", "pending_open_play"] },
    },
    select: { startTime: true, endTime: true, status: true },
  });

  const slots: Array<{ startTime: string; endTime: string; available: boolean }> = [];
  const now = new Date();
  const isToday =
    bookingDate.getFullYear() === now.getFullYear() &&
    bookingDate.getMonth() === now.getMonth() &&
    bookingDate.getDate() === now.getDate();

  for (let hour = operatingHours.start; hour < operatingHours.end; hour++) {
    const startTime = `${hour.toString().padStart(2, "0")}:00`;
    const endTime = `${(hour + 1).toString().padStart(2, "0")}:00`;

    if (isToday && hour <= now.getHours()) {
      continue;
    }

    const isConfirmed = existingBookings.some(
      (b) =>
        b.startTime < endTime &&
        b.endTime > startTime &&
        ["confirmed", "fully_paid"].includes(b.status)
    );

    slots.push({ startTime, endTime, available: !isConfirmed });
  }

  return slots;
}

export async function validateBookingTime(
  date: string,
  startTime: string,
  endTime: string
): Promise<{ valid: boolean; error?: string }> {
  const bookingDate = new Date(date);
  const now = new Date();

  if (bookingDate < new Date(now.toISOString().split("T")[0])) {
    return { valid: false, error: "Cannot book for past dates" };
  }

  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (endMinutes <= startMinutes) {
    return { valid: false, error: "End time must be after start time" };
  }

  if (startH < 6 || endH > 23) {
    return { valid: false, error: "Bookings only available between 6:00 and 23:00" };
  }

  return { valid: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Slot Conflict Resolution — Payment-priority booking engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve slot conflict using payment-priority logic.
 *
 * Rules:
 * - ONE slot can have many pending bookings, but only ONE confirmed booking
 * - The first booking to reach the payment threshold wins
 * - All other pending bookings for the same slot become cancelled_conflict
 * - Conflict-cancelled bookings receive 100% refund (no platform fee)
 *
 * Must be called inside a serializable transaction for safety.
 */
export async function resolveSlotConflict(bookingId: number): Promise<{
  won: boolean;
  cancelledIds: number[];
}> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || !["pending", "pending_open_play"].includes(booking.status)) {
    return { won: false, cancelledIds: [] };
  }

  // Check if another booking already won this slot
  const alreadyWon = await prisma.booking.findFirst({
    where: {
      venueId: booking.venueId,
      facilityId: booking.facilityId,
      bookingDate: booking.bookingDate,
      startTime: { lt: booking.endTime },
      endTime: { gt: booking.startTime },
      status: { in: ["confirmed", "fully_paid"] },
      id: { not: bookingId },
    },
  });

  if (alreadyWon) {
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: "cancelled_conflict" },
    });
    emitBookingEvent("booking:cancelled", {
      bookingId,
      venueId: booking.venueId,
      facilityId: booking.facilityId,
      status: "cancelled_conflict",
    });
    return { won: false, cancelledIds: [] };
  }

  // This booking wins — confirm it
  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "confirmed" },
  });

  // Send booking confirmation email to player
  addEmailJob("booking-confirmation", { bookingId, userId: booking.userId }).catch(() => { /* non-critical */ });

  emitBookingEvent("booking:confirmed", {
    bookingId,
    venueId: booking.venueId,
    facilityId: booking.facilityId,
    status: "confirmed",
  });

  // In-app notification for booking winner (non-blocking)
  void createNotification(
    booking.userId,
    NotifType.BOOKING_CONFIRMED,
    "Booking confirmed",
    `Your booking on ${booking.bookingDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} (${booking.startTime}–${booking.endTime}) is confirmed.`,
    { bookingId, venueId: booking.venueId }
  );

  // Cancel all other pending bookings for the same slot
  const losers = await prisma.booking.findMany({
    where: {
      venueId: booking.venueId,
      facilityId: booking.facilityId,
      bookingDate: booking.bookingDate,
      startTime: { lt: booking.endTime },
      endTime: { gt: booking.startTime },
      status: { in: ["pending", "pending_open_play"] },
      id: { not: bookingId },
    },
  });

  const cancelledIds = losers.map((l) => l.id);
  if (cancelledIds.length > 0) {
    await prisma.booking.updateMany({
      where: { id: { in: cancelledIds } },
      data: { status: "cancelled_conflict" },
    });

    for (const loser of losers) {
      emitBookingEvent("booking:cancelled", {
        bookingId: loser.id,
        venueId: loser.venueId,
        facilityId: loser.facilityId,
        status: "cancelled_conflict",
      });

      // Notify loser (non-blocking)
      void createNotification(
        loser.userId,
        NotifType.BOOKING_CANCELLED,
        "Booking not available",
        `Your booking on ${loser.bookingDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} (${loser.startTime}–${loser.endTime}) could not be confirmed — the slot was taken. Any payment will be refunded.`,
        { bookingId: loser.id, venueId: loser.venueId }
      );

      const isSplitType = loser.bookingType === "split" || loser.bookingType === "open_play";

      if (isSplitType && loser.paidAmount > 0) {
        // Refund each individual payer their share (100%, no platform fee)
        const paidSplits = await prisma.splitPayment.findMany({
          where: { bookingId: loser.id, status: "paid" },
        });
        for (const sp of paidSplits) {
          if (sp.razorpayPaymentId && sp.amount > 0) {
            const refundUserId = sp.userId ?? loser.userId;
            await prisma.refund.create({
              data: {
                bookingId: loser.id,
                userId: refundUserId,
                amountPaid: sp.amount,
                amountRefunded: sp.amount,
                platformFee: 0,
                reason: "conflict_cancelled",
                razorpayPaymentId: sp.razorpayPaymentId,
                status: "pending",
              },
            });
            await addRefundJob({
              bookingId: loser.id,
              userId: refundUserId,
              amount: sp.amount,
              razorpayPaymentId: sp.razorpayPaymentId,
              reason: "conflict_cancelled",
            });
          }
          await prisma.splitPayment.update({
            where: { id: sp.id },
            data: { status: "cancelled" },
          });
        }
        await prisma.splitPayment.updateMany({
          where: { bookingId: loser.id, status: "pending" },
          data: { status: "cancelled" },
        });
      } else if (loser.paidAmount > 0 && loser.razorpayPaymentId) {
        await prisma.refund.create({
          data: {
            bookingId: loser.id,
            userId: loser.userId,
            amountPaid: loser.paidAmount,
            amountRefunded: loser.paidAmount,
            platformFee: 0,
            reason: "conflict_cancelled",
            razorpayPaymentId: loser.razorpayPaymentId,
            status: "pending",
          },
        });
        await addRefundJob({
          bookingId: loser.id,
          userId: loser.userId,
          amount: loser.paidAmount,
          razorpayPaymentId: loser.razorpayPaymentId,
          reason: "conflict_cancelled",
        });
      }
    }
  }

  return { won: true, cancelledIds };
}

/**
 * Called after a payment is captured (from /verify or /webhook).
 * Checks if the booking meets its confirmation threshold and triggers
 * conflict resolution if so.
 *
 * Confirmation thresholds:
 * - solo: 100% paid
 * - split / open_play: >= 50% paid
 * - batch: immediate (already confirmed at creation)
 */
export async function applyPaymentCaptured(bookingId: number) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return;

  // Already resolved — nothing to do
  if (["confirmed", "fully_paid", "cancelled_conflict", "cancelled_user", "cancelled"].includes(booking.status)) {
    // But check if we should upgrade confirmed -> fully_paid
    if (booking.status === "confirmed" && booking.totalAmount > 0) {
      const paidPercent = (booking.paidAmount / booking.totalAmount) * 100;
      if (paidPercent >= 100) {
        await prisma.booking.update({
          where: { id: bookingId },
          data: { status: "fully_paid" },
        });
      }
    }
    return;
  }

  // Batch bookings are confirmed immediately — no threshold check
  if (booking.bookingType === "batch") return;

  const paidPercent = booking.totalAmount > 0
    ? (booking.paidAmount / booking.totalAmount) * 100
    : 0;

  let shouldResolve = false;

  if (booking.bookingType === "solo" && paidPercent >= 100) {
    shouldResolve = true;
  } else if (["split", "open_play"].includes(booking.bookingType) && paidPercent >= 50) {
    shouldResolve = true;
  }

  if (shouldResolve) {
    const result = await resolveSlotConflict(bookingId);

    // If won and 100% paid, upgrade to fully_paid
    if (result.won && paidPercent >= 100) {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { status: "fully_paid" },
      });
    }
  }

  emitBookingEvent("booking:payment_update", {
    bookingId,
    venueId: booking.venueId,
    facilityId: booking.facilityId,
    status: booking.status,
  });
}

/**
 * Get pending booking count for a slot (for "High Demand" UI state).
 */
export async function getSlotDemand(
  venueId: number,
  facilityId: number,
  date: string,
  startTime: string,
  endTime: string
): Promise<number> {
  return prisma.booking.count({
    where: {
      venueId,
      facilityId,
      bookingDate: new Date(date),
      startTime: { lt: endTime },
      endTime: { gt: startTime },
      status: { in: ["pending", "pending_open_play"] },
    },
  });
}
