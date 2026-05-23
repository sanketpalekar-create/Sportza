/**
 * Hold Cleanup Worker
 * Runs on a repeating schedule to expire booking holds that have passed their TTL.
 */
import { Worker, Queue } from "bullmq";
import redis from "../lib/redis";
import prisma from "../lib/prisma";

const QUEUE_NAME = "hold-cleanup";
const REPEAT_EVERY_MS = 60_000; // every 60 seconds

const holdCleanupQueue = new Queue(QUEUE_NAME, { connection: redis });

const holdCleanupWorker = new Worker(
  QUEUE_NAME,
  async () => {
    const now = new Date();
    const result = await prisma.bookingHold.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    if (result.count > 0) {
      console.log(`[hold-cleanup] Expired ${result.count} hold(s)`);
    }
  },
  { connection: redis }
);

holdCleanupWorker.on("failed", (job, err) => {
  console.error(`[hold-cleanup] Job ${job?.id} failed:`, err);
});

export async function startHoldCleanupSchedule() {
  await holdCleanupQueue.upsertJobScheduler(
    "hold-cleanup-repeat",
    { every: REPEAT_EVERY_MS },
    { name: "hold-cleanup" }
  );
  console.log("[hold-cleanup] Scheduler started (every 60s)");
}

export { holdCleanupWorker, holdCleanupQueue };
