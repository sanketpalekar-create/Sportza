import { Queue } from "bullmq";
import redis from "./redis";

const connection = { connection: redis };

/** Enqueue only — workers are not started on Vercel (see docs/VERCEL.md). */
export const emailQueue = new Queue("email", connection);
export const refundQueue = new Queue("refund", connection);

export async function addEmailJob(
  type: "otp" | "magic-link" | "booking-confirmation" | "payment-receipt" | "reset-password",
  data: Record<string, any>
) {
  return emailQueue.add(type, data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
  });
}

export async function addRefundJob(data: {
  bookingId: number;
  userId: number;
  amount: number;
  razorpayPaymentId: string;
  reason: string;
}) {
  return refundQueue.add("process-refund", data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  });
}
