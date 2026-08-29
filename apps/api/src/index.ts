import "dotenv/config";
import http from "http";
import { createApp } from "./app";
import prisma from "./lib/prisma";
import { initSocket } from "./lib/socket";
import { canRunPersistentWorkers } from "./lib/runtime";
import { startHoldCleanupSchedule } from "./workers/holdCleanupWorker";
import { startOpenPlayDeadlineSchedule } from "./workers/openPlayDeadlineWorker";
import "./workers/emailWorker";

/**
 * Local / Docker entrypoint: HTTP listen + Socket.io + BullMQ schedulers.
 * Vercel uses `api/index.ts` → `createApp()` only (never this file).
 */
const app = createApp();
const PORT = parseInt(process.env.PORT || "5000", 10);

async function startLocal() {
  if (!canRunPersistentWorkers) {
    console.warn(
      "[sportza-api] Persistent workers disabled (serverless). Use Vercel Cron for hold-cleanup / open-play-deadline."
    );
  }

  const httpServer = http.createServer(app);

  try {
    await prisma.$connect();
    console.log("Database connected");

    if (canRunPersistentWorkers) {
      initSocket(httpServer);
      console.log("Socket.io initialised");

      await startHoldCleanupSchedule();
      await startOpenPlayDeadlineSchedule();
    } else {
      console.warn("Socket.io skipped (serverless runtime)");
    }

    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`✅  Sportza API   → http://localhost:${PORT}/api`);
      console.log(`📄  Swagger docs  → http://localhost:${PORT}/api/docs`);
      if (canRunPersistentWorkers) {
        console.log(`🔌  Socket.io     → ws://localhost:${PORT}`);
      }
      console.log(`🌍  CORS origins  → localhost + CLIENT_ORIGIN + *.vercel.app`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startLocal();

export default app;
export { startLocal };
