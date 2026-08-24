import { Router, Request, Response, NextFunction } from "express";
import { expireBookingHolds } from "../services/holdCleanup";
import { runOpenPlayDeadlineCheck } from "../services/openPlayDeadline";

const router = Router();

/**
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
 * Also accept `x-cron-secret` for manual / curl testing.
 */
function requireCronSecret(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
      return res.status(500).json({ error: "CRON_SECRET is not configured" });
    }
    // Local dev without secret — allow
    return next();
  }

  const auth = req.headers.authorization;
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
  const headerSecret = req.headers["x-cron-secret"];
  const provided = bearer || (typeof headerSecret === "string" ? headerSecret : undefined);

  if (provided !== secret) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}

router.use(requireCronSecret);

/** Every minute — expire booking holds */
router.get("/hold-cleanup", async (_req, res) => {
  try {
    const expired = await expireBookingHolds();
    res.json({ ok: true, expired, at: new Date().toISOString() });
  } catch (err) {
    console.error("[cron/hold-cleanup]", err);
    res.status(500).json({ ok: false, error: "hold-cleanup failed" });
  }
});

/** Every 5 minutes — open-play join deadline automation */
router.get("/open-play-deadline", async (_req, res) => {
  try {
    const result = await runOpenPlayDeadlineCheck();
    res.json({ ok: true, ...result, at: new Date().toISOString() });
  } catch (err) {
    console.error("[cron/open-play-deadline]", err);
    res.status(500).json({ ok: false, error: "open-play-deadline failed" });
  }
});

export default router;
