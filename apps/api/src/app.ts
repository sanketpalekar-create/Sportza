import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";

import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { generateOpenAPISpec } from "./lib/openapi";
import { isVercel } from "./lib/runtime";

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
import cronRoutes from "./routes/cron";

/**
 * Parse CLIENT_ORIGIN — supports comma-separated list of allowed origins.
 */
function parseAllowedOrigins(raw: string | undefined): cors.CorsOptions["origin"] {
  const isDev = process.env.NODE_ENV !== "production";
  const list = (raw ?? "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  return (origin, callback) => {
    if (!origin) return callback(null, true);
    if (isDev && /^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true);
    if (isDev && /\.(trycloudflare\.com|ngrok[-.]io|ngrok-free\.app)$/.test(origin)) {
      return callback(null, true);
    }
    // Vercel preview deployments
    if (/\.vercel\.app$/.test(origin)) return callback(null, true);
    if (list.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  };
}

/**
 * Build the Express app (HTTP only).
 * Does not listen, start Socket.io, or start BullMQ workers.
 * Used by local server (`index.ts`) and Vercel (`api/index.ts`).
 */
export function createApp(): Express {
  const isProd = process.env.NODE_ENV === "production";

  if (isProd && !process.env.JWT_SECRET) {
    console.error("FATAL: JWT_SECRET must be set in production");
    // Do not process.exit on Vercel — fail requests instead of killing the isolate at import
    if (!isVercel) {
      process.exit(1);
    }
  }

  const app: Express = express();
  const allowedOriginsFn = parseAllowedOrigins(process.env.CLIENT_ORIGIN);

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: allowedOriginsFn,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "x-razorpay-signature",
        "x-cron-secret",
      ],
    })
  );
  app.use(morgan(isProd ? "combined" : "dev"));

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
      runtime: isVercel ? "vercel" : "node",
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/api/cron", cronRoutes);

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
  app.use("/api/admin", adminRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
