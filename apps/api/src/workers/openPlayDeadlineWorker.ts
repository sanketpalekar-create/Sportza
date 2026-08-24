/**
 * Open Play Deadline Worker (local / Docker only)
 * On Vercel, use Cron → GET /api/cron/open-play-deadline instead.
 */
import { Worker, Queue } from "bullmq";
import redis from "../lib/redis";
import { runOpenPlayDeadlineCheck } from "../services/openPlayDeadline";

const QUEUE_NAME = "openplay-deadline";
const REPEAT_EVERY_MS = 5 * 60_000;

let deadlineQueue: Queue | null = null;
let deadlineWorker: Worker | null = null;

export async function startOpenPlayDeadlineSchedule() {
  deadlineQueue = new Queue(QUEUE_NAME, { connection: redis });
  deadlineWorker = new Worker(QUEUE_NAME, async () => runOpenPlayDeadlineCheck(), {
    connection: redis,
  });

  deadlineWorker.on("failed", (job, err) => {
    console.error(`[openplay-deadline] Job ${job?.id} failed:`, err);
  });

  await deadlineQueue.upsertJobScheduler(
    "openplay-deadline-repeat",
    { every: REPEAT_EVERY_MS },
    { name: "openplay-deadline" }
  );
  console.log("[openplay-deadline] Scheduler started (every 5 min)");
}

export { deadlineWorker, deadlineQueue };
