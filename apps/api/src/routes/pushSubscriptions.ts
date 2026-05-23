import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { validate } from "../middleware/validate";
import { jwtCheck, attachUser, requireAuth } from "../middleware/auth";

const router: Router = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth:   z.string().min(1),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

// ─── POST / — Save or update a web push subscription ──────────────────────────
// Browser-only contract (PushManager). Mobile native tokens use /api/mobile-push-tokens.

router.post(
  "/",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ body: subscribeSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { endpoint, keys } = req.body as z.infer<typeof subscribeSchema>;

      // Upsert by userId + endpoint — handles browser refreshing keys
      const existing = await (prisma as any).pushSubscription.findFirst({
        where: { userId, endpoint },
      });
      if (existing) {
        await (prisma as any).pushSubscription.update({
          where: { id: existing.id },
          data:  { p256dh: keys.p256dh, auth: keys.auth },
        });
      } else {
        await (prisma as any).pushSubscription.create({
          data: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
        });
      }

      res.json({ success: true, message: "Push subscription saved" });
    } catch (err) {
      next(err);
    }
  }
);

// ─── DELETE / — Remove a push subscription ────────────────────────────────────
// Called when the user disables notifications in Settings.

router.delete(
  "/",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ body: unsubscribeSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { endpoint } = req.body as z.infer<typeof unsubscribeSchema>;

      await (prisma as any).pushSubscription.deleteMany({
        where: { userId, endpoint },
      });

      res.json({ success: true, message: "Push subscription removed" });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /vapid-public-key — Serve the VAPID public key to the frontend ───────

router.get("/vapid-public-key", (_req: Request, res: Response) => {
  const key = process.env.VAPID_PUBLIC_KEY ?? "";
  if (!key) {
    return res.status(503).json({ success: false, error: "Push not configured" });
  }
  res.json({ success: true, data: { publicKey: key } });
});

export default router;
