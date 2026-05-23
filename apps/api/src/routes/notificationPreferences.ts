import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { jwtCheck, attachUser, requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router: Router = Router();

const updatePrefsSchema = z.object({
  emailBookings: z.boolean().optional(),
  emailMatches:  z.boolean().optional(),
  emailPromo:    z.boolean().optional(),
  pushBookings:  z.boolean().optional(),
  pushMatches:   z.boolean().optional(),
  pushInvites:   z.boolean().optional(),
  pushBatch:     z.boolean().optional(),
  pushWallet:    z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "At least one preference field is required" });

// GET /notification-preferences — get or create prefs for the current user
router.get(
  "/",
  jwtCheck,
  attachUser,
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;

      const prefs = await (prisma as any).notificationPreference.upsert({
        where: { userId },
        create: { userId },
        update: {},
      });

      res.json({ success: true, data: prefs });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /notification-preferences — update one or more preference flags
router.patch(
  "/",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ body: updatePrefsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const updates = req.body as z.infer<typeof updatePrefsSchema>;

      const prefs = await (prisma as any).notificationPreference.upsert({
        where: { userId },
        create: { userId, ...updates },
        update: updates,
      });

      res.json({ success: true, data: prefs });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
