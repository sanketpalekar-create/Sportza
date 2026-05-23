import prisma from "../lib/prisma";
import { addRefundJob } from "../lib/queue";

interface RefundRequest {
  bookingId: number;
  userId: number;
  reason: "user_cancelled" | "venue_cancelled" | "system" | "duplicate";
}

interface RefundPolicy {
  refundPercentage: number;
  platformFeePercentage: number;
}

export function calculateRefundPolicy(
  bookingDate: Date,
  cancellationTime: Date
): RefundPolicy {
  const hoursUntilBooking =
    (bookingDate.getTime() - cancellationTime.getTime()) / (1000 * 60 * 60);

  if (hoursUntilBooking >= 48) {
    return { refundPercentage: 100, platformFeePercentage: 0 };
  }
  if (hoursUntilBooking >= 24) {
    return { refundPercentage: 75, platformFeePercentage: 5 };
  }
  if (hoursUntilBooking >= 6) {
    return { refundPercentage: 50, platformFeePercentage: 10 };
  }
  return { refundPercentage: 0, platformFeePercentage: 0 };
}

export async function initiateRefund(request: RefundRequest) {
  const booking = await prisma.booking.findUnique({
    where: { id: request.bookingId },
    include: { payments: { where: { status: { in: ["paid", "completed"] } } } },
  });

  if (!booking) throw new Error("Booking not found");
  if (booking.userId !== request.userId) throw new Error("Unauthorized");
  if (["refunded", "cancelled", "cancelled_user", "cancelled_conflict"].includes(booking.status)) {
    throw new Error("Booking already cancelled/refunded");
  }

  const policy = calculateRefundPolicy(booking.bookingDate, new Date());
  const amountPaid = booking.paidAmount || booking.totalAmount;
  const refundAmount = (amountPaid * policy.refundPercentage) / 100;
  const platformFee = (amountPaid * policy.platformFeePercentage) / 100;
  const netRefund = refundAmount - platformFee;

  if (netRefund <= 0) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "cancelled" },
    });
    return {
      refundAmount: 0,
      platformFee: 0,
      message: "No refund applicable based on cancellation policy",
    };
  }

  const razorpayPaymentId =
    booking.razorpayPaymentId ||
    booking.payments.find((p) => p.paymentGatewayId)?.paymentGatewayId;

  if (!razorpayPaymentId) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "cancelled" },
    });
    return {
      refundAmount: netRefund,
      platformFee,
      message: "Booking cancelled. No payment to refund.",
    };
  }

  const refund = await prisma.refund.create({
    data: {
      bookingId: booking.id,
      userId: request.userId,
      amountPaid,
      amountRefunded: netRefund,
      platformFee,
      reason: request.reason,
      razorpayPaymentId,
      status: "pending",
    },
  });

  await addRefundJob({
    bookingId: booking.id,
    userId: request.userId,
    amount: netRefund,
    razorpayPaymentId,
    reason: request.reason,
  });

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "cancelled_user" },
  });

  return {
    refundId: refund.id,
    refundAmount: netRefund,
    platformFee,
    refundPercentage: policy.refundPercentage,
    message: "Refund initiated. Processing may take 5-7 business days.",
  };
}

/**
 * Cancel a split booking: refund each payer their individual share
 * according to the time-based refund policy.
 */
export async function initiateSplitBookingRefund(
  booking: {
    id: number;
    userId: number;
    bookingDate: Date;
    venueId: number;
    facilityId: number;
    status: string;
  }
) {
  if (["refunded", "cancelled", "cancelled_user", "cancelled_conflict"].includes(booking.status)) {
    throw new Error("Booking already cancelled/refunded");
  }

  const policy = calculateRefundPolicy(booking.bookingDate, new Date());
  const paidSplits = await prisma.splitPayment.findMany({
    where: { bookingId: booking.id, status: "paid" },
  });

  const refunds: Array<{ userId: number; refundAmount: number; platformFee: number }> = [];

  for (const sp of paidSplits) {
    const refundUserId = sp.userId ?? booking.userId;
    const refundAmount = (sp.amount * policy.refundPercentage) / 100;
    const platformFee = (sp.amount * policy.platformFeePercentage) / 100;
    const netRefund = Math.round((refundAmount - platformFee) * 100) / 100;

    if (netRefund > 0 && sp.razorpayPaymentId) {
      await prisma.refund.create({
        data: {
          bookingId: booking.id,
          userId: refundUserId,
          amountPaid: sp.amount,
          amountRefunded: netRefund,
          platformFee,
          reason: "user_cancelled",
          razorpayPaymentId: sp.razorpayPaymentId,
          status: "pending",
        },
      });

      await addRefundJob({
        bookingId: booking.id,
        userId: refundUserId,
        amount: netRefund,
        razorpayPaymentId: sp.razorpayPaymentId,
        reason: "user_cancelled",
      });
    }

    await prisma.splitPayment.update({
      where: { id: sp.id },
      data: { status: "cancelled" },
    });

    refunds.push({ userId: refundUserId, refundAmount: netRefund > 0 ? netRefund : 0, platformFee });
  }

  // Cancel all pending splits too
  await prisma.splitPayment.updateMany({
    where: { bookingId: booking.id, status: "pending" },
    data: { status: "cancelled" },
  });

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "cancelled_user" },
  });

  const totalRefunded = refunds.reduce((sum, r) => sum + r.refundAmount, 0);
  const totalFees = refunds.reduce((sum, r) => sum + r.platformFee, 0);

  return {
    refundCount: refunds.length,
    totalRefunded: Math.round(totalRefunded * 100) / 100,
    totalPlatformFee: Math.round(totalFees * 100) / 100,
    refundPercentage: policy.refundPercentage,
    perPayerRefunds: refunds,
    message: refunds.length > 0
      ? "Refunds initiated for all payers. Processing may take 5-7 business days."
      : "No refunds applicable based on cancellation policy.",
  };
}
