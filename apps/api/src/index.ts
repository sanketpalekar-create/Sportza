import "dotenv/config";
import http from "http";
import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";

import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { generateOpenAPISpec } from "./lib/openapi";
import prisma from "./lib/prisma";
import { initSocket } from "./lib/socket";
import { startHoldCleanupSchedule } from "./workers/holdCleanupWorker";

import authRoutes from "./routes/auth";
import venueRoutes from "./routes/venues";
import bookingRoutes from "./routes/bookings";
import slotRoutes from "./routes/slots";
import paymentRoutes from "./routes/payments";
import matchRoutes from "./routes/matches";
import sportRoutes from "./routes/sports";
import batchRoutes from "./routes/batches";
import trainerRoutes from "./routes/trainers";
import openPlayRoutes from "./routes/open-plays";
import tournamentRoutes from "./routes/tournaments";
import reportRoutes from "./routes/reports";
import trainingRoutes from "./routes/trainings";
import statsRoutes from "./routes/stats";
import displayRoutes from "./routes/displays";
import matchmakingRoutes from "./routes/matchmaking";
import peerInviteRoutes from "./routes/peer-invites";
import peersRoutes from "./routes/peers";
import publicRoutes from "./routes/public";
import placesRoutes from "./routes/places";
import scheduleRoutes from "./routes/schedules";
import notificationRoutes from "./routes/notifications";
import notificationPreferenceRoutes from "./routes/notificationPreferences";
import pushSubscriptionRoutes from "./routes/pushSubscriptions";
import mobilePushTokenRoutes from "./routes/mobilePushTokens";
import walletRoutes from "./routes/wallet";
import adminRoutes from "./routes/admin/index";
import { startOpenPlayDeadlineSchedule } from "./workers/openPlayDeadlineWorker";

const app: Express = express();
const PORT = parseInt(process.env.PORT || "5000", 10);
const isProd = process.env.NODE_ENV === "production";

if (isProd && !process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET must be set in production");
  process.exit(1);
}

/**
 * Parse CLIENT_ORIGIN — supports comma-separated list of allowed origins.
 * Examples:
 *   CLIENT_ORIGIN=http://localhost:5173
 *   CLIENT_ORIGIN=http://localhost:5173,https://abc123.ngrok.io
 *   CLIENT_ORIGIN=* (open — dev only)
 */
function parseAllowedOrigins(raw: string | undefined): cors.CorsOptions["origin"] {
  const isDev = process.env.NODE_ENV !== "production";
  const list = (raw ?? "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  return (origin, callback) => {
    // No origin = same-origin / server-to-server — always allow
    if (!origin) return callback(null, true);
    // In dev: allow any localhost port automatically
    if (isDev && /^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true);
    // In dev: allow Cloudflare tunnels and ngrok (used for mobile device testing)
    if (isDev && /\.(trycloudflare\.com|ngrok[-.]io|ngrok-free\.app)$/.test(origin)) return callback(null, true);
    // Otherwise match the explicit list
    if (list.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  };
}

const allowedOriginsFn = parseAllowedOrigins(process.env.CLIENT_ORIGIN);

// Trust the first proxy so that req.ip and secure cookies work behind ngrok / Cloudflare
app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: allowedOriginsFn,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-razorpay-signature"],
  })
);
app.use(morgan(isProd ? "combined" : "dev"));

// Capture the raw request body for Razorpay webhook signature verification
// before express.json() parses and re-serialises the payload.
app.use(
  express.json({
    limit: "10mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const openApiSpec = generateOpenAPISpec();
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.get("/api/docs.json", (_req, res) => res.json(openApiSpec));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    env: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/public", publicRoutes);
app.use("/api/places", placesRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/venues", venueRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/slots", slotRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/sports", sportRoutes);
app.use("/api/batches", batchRoutes);
app.use("/api/trainers", trainerRoutes);
app.use("/api/open-plays", openPlayRoutes);
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/trainings", trainingRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/displays", displayRoutes);
app.use("/api/matchmaking", matchmakingRoutes);
app.use("/api/peer-invites", peerInviteRoutes);
app.use("/api/peers", peersRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/notification-preferences", notificationPreferenceRoutes);
app.use("/api/push-subscriptions", pushSubscriptionRoutes);
app.use("/api/mobile-push-tokens", mobilePushTokenRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/admin",  adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

// Wrap Express in an HTTP server so Socket.io can share the same port
const httpServer = http.createServer(app);

async function start() {
  try {
    await prisma.$connect();
    console.log("Database connected");

    // Attach Socket.io to the HTTP server
    initSocket(httpServer);
    console.log("Socket.io initialised");

    // Start hold expiry cleanup scheduler
    await startHoldCleanupSchedule();

    // Start open play deadline automation
    await startOpenPlayDeadlineSchedule();

    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`✅  Sportza API   → http://localhost:${PORT}/api`);
      console.log(`📄  Swagger docs  → http://localhost:${PORT}/api/docs`);
      console.log(`🔌  Socket.io     → ws://localhost:${PORT}`);
      console.log(`🌍  CORS origins  → all localhost ports + explicit list`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

start();

export default app;
