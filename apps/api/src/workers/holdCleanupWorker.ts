/**
 * Hold Cleanup Worker (local / Docker only)
 * On Vercel, use Cron → GET /api/cron/hold-cleanup instead.
 */
import { Worker, Queue } from "bullmq";
import redis from "../lib/redis";
import { expireBookingHolds } from "../services/holdCleanup";

const QUEUE_NAME = "hold-cleanup";
const REPEAT_EVERY_MS = 60_000;

let holdCleanupQueue: Queue | null = null;
let holdCleanupWorker: Worker | null = null;

export async function startHoldCleanupSchedule() {
  holdCleanupQueue = new Queue(QUEUE_NAME, { connection: redis });
  holdCleanupWorker = new Worker(QUEUE_NAME, async () => expireBookingHolds(), {
    connection: redis,
  });

  holdCleanupWorker.on("failed", (job, err) => {
    console.error(`[hold-cleanup] Job ${job?.id} failed:`, err);
  });

  await holdCleanupQueue.upsertJobScheduler(
    "hold-cleanup-repeat",
    { every: REPEAT_EVERY_MS },
    { name: "hold-cleanup" }
  );
  console.log("[hold-cleanup] Scheduler started (every 60s)");
}

export { holdCleanupWorker, holdCleanupQueue };
