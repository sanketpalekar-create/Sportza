/**
 * Open Play Deadline Worker
 *
 * Runs every 5 minutes. Finds open play sessions whose join deadline has
 * passed and which have not yet reached the minimum player threshold.
 *
 * On deadline miss:
 *  - All paid amounts (host protection + player shares) are credited back
 *    to each user's Sportza Wallet (no gateway refund — per product policy).
 *  - The open play and its underlying booking are marked cancelled.
 */
import { Worker, Queue } from "bullmq";
import redis from "../lib/redis";
import prisma from "../lib/prisma";
import { handleDeadlineMiss } from "../services/openPlayConfirmations";

const QUEUE_NAME = "openplay-deadline";
const REPEAT_EVERY_MS = 5 * 60_000; // every 5 minutes

const deadlineQueue = new Queue(QUEUE_NAME, { connection: redis });

const deadlineWorker = new Worker(
  QUEUE_NAME,
  async () => {
    const now = new Date();

    // Find open plays past their deadline that are still open/full (not confirmed/cancelled)
    const expired = await (prisma as any).openPlay.findMany({
      where: {
        joinDeadlineAt: { lt: now },
        status: { in: ["open", "full"] },
      },
      select: { id: true, minimumPlayers: true, bookingId: true },
    });

    if (expired.length === 0) return;

    console.log(`[openplay-deadline] Checking ${expired.length} expired session(s)`);

    for (const op of expired) {
      try {
        // Count paid players for this session
        const paidCount = await prisma.splitPayment.count({
          where: {
            bookingId: op.bookingId,
            status: "paid",
          },
        });

        const minimumPlayers = op.minimumPlayers ?? 2;

        if (paidCount < minimumPlayers) {
          console.log(`[openplay-deadline] Session ${op.id}: ${paidCount}/${minimumPlayers} paid — auto-cancelling`);
          await handleDeadlineMiss(op.id);
        } else {
          // Minimum met but deadline passed without host locking — auto-confirm
          console.log(`[openplay-deadline] Session ${op.id}: minimum met (${paidCount}/${minimumPlayers}) — confirming`);
          await (prisma as any).openPlay.update({
            where: { id: op.id },
            data: { status: "confirmed" },
          });
          await prisma.booking.update({
            where: { id: op.bookingId },
            data: { status: "confirmed" },
          });
        }
      } catch (err) {
        console.error(`[openplay-deadline] Error processing session ${op.id}:`, err);
      }
    }
  },
  { connection: redis }
);

deadlineWorker.on("failed", (job, err) => {
  console.error(`[openplay-deadline] Job ${job?.id} failed:`, err);
});

export async function startOpenPlayDeadlineSchedule() {
  await deadlineQueue.upsertJobScheduler(
    "openplay-deadline-repeat",
    { every: REPEAT_EVERY_MS },
    { name: "openplay-deadline" }
  );
  console.log("[openplay-deadline] Scheduler started (every 5 min)");
}

export { deadlineWorker, deadlineQueue };
