import { Worker, Job } from "bullmq";
import redis from "../lib/redis";
import prisma from "../lib/prisma";
import { createNotification, NotifType } from "../services/notificationService";

const refundWorker = new Worker(
  "refund",
  async (job: Job) => {
    const { bookingId, userId, amount, razorpayPaymentId, reason } = job.data;

    try {
      const Razorpay = require("razorpay");
      const instance = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });

      const refund = await instance.payments.refund(razorpayPaymentId, {
        amount: Math.round(amount * 100),
        speed: "normal",
      });

      await prisma.refund.updateMany({
        where: { bookingId, userId, status: "pending" },
        data: {
          razorpayRefundId: refund.id,
          status: "completed",
          amountRefunded: amount,
        },
      });

      await prisma.booking.update({
        where: { id: bookingId },
        data: { status: "refunded" },
      });

      // Notify user of successful refund (non-blocking)
      void createNotification(
        userId,
        NotifType.REFUND_COMPLETED,
        "Refund processed",
        `Your refund of ₹${amount.toFixed(2)} has been processed and will reflect in your account within 5–7 business days.`,
        { bookingId, amount }
      );
    } catch (error: any) {
      await prisma.refund.updateMany({
        where: { bookingId, userId, status: "pending" },
        data: {
          status: "failed",
          failureReason: error.message?.substring(0, 500),
        },
      });

      // Notify user of refund failure (non-blocking)
      void createNotification(
        userId,
        NotifType.REFUND_FAILED,
        "Refund failed",
        `We were unable to process your refund of ₹${amount.toFixed(2)}. Please contact support.`,
        { bookingId, amount }
      );

      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 2,
  }
);

refundWorker.on("completed", (job) => {
  console.log(`Refund job ${job.id} completed`);
});

refundWorker.on("failed", (job, err) => {
  console.error(`Refund job ${job?.id} failed:`, err.message);
});

export default refundWorker;
