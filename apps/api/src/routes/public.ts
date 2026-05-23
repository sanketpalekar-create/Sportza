import { Router, Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { verifyProgressShareToken } from "../lib/progressShareToken";
import { NotFoundError } from "../lib/errors";

const router: Router = Router();

const USER_PUBLIC = { id: true, name: true, avatar: true } as const;

// GET /player-progress?token=JWT — read-only progress card for parents (no auth)
router.get(
  "/player-progress",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = typeof req.query.token === "string" ? req.query.token : "";
      if (!token) {
        res.status(400).json({ success: false, error: "token required" });
        return;
      }
      const decoded = verifyProgressShareToken(token);
      if (!decoded) {
        res.status(401).json({ success: false, error: "invalid or expired token" });
        return;
      }

      const { batchId, playerId } = decoded;

      const batch = await prisma.batch.findUnique({
        where: { id: batchId },
        include: {
          trainer: { select: USER_PUBLIC },
        },
      });
      if (!batch) throw new NotFoundError("Batch");

      const player = await prisma.user.findUnique({
        where: { id: playerId },
        select: USER_PUBLIC,
      });
      if (!player) throw new NotFoundError("Player");

      const reviews = await prisma.playerBatchReview.findMany({
        where: { batchId, playerId },
        orderBy: [{ year: "desc" }, { month: "desc" }],
        take: 24,
      });

      res.json({
        success: true,
        data: {
          batch: {
            id: batch.id,
            name: batch.name,
            sport: batch.sport,
            venue: batch.venueId,
          },
          trainer: batch.trainer,
          player,
          reviews,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
