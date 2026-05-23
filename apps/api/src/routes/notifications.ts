import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { jwtCheck, attachUser, requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { BadRequestError, ForbiddenError, NotFoundError } from "../lib/errors";

const router: Router = Router();

const paginationSchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// ─── GET /notifications/unread-count ─────────────────────────────────────────

router.get(
  "/unread-count",
  jwtCheck,
  attachUser,
  requireAuth,
  async (req: Request, res: Response, next) => {
    try {
      const count = await prisma.notification.count({
        where: { userId: req.userId!, isRead: false },
      });
      res.json({ success: true, count });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /notifications ───────────────────────────────────────────────────────

router.get(
  "/",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ query: paginationSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { page, limit } = req.query as unknown as z.infer<typeof paginationSchema>;
      const skip = (page - 1) * limit;
      const userId = req.userId!;

      const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.notification.count({ where: { userId } }),
        prisma.notification.count({ where: { userId, isRead: false } }),
      ]);

      res.json({
        success: true,
        data: notifications,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        unreadCount,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /notifications/read-all ───────────────────────────────────────────

router.patch(
  "/read-all",
  jwtCheck,
  attachUser,
  requireAuth,
  async (req: Request, res: Response, next) => {
    try {
      await prisma.notification.updateMany({
        where: { userId: req.userId!, isRead: false },
        data: { isRead: true },
      });
      res.json({ success: true, message: "All notifications marked as read" });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /notifications/:id/read ───────────────────────────────────────────

router.patch(
  "/:id/read",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;

      const existing = await prisma.notification.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError("Notification");
      if (existing.userId !== req.userId!) throw new ForbiddenError("Not your notification");

      const updated = await prisma.notification.update({
        where: { id },
        data: { isRead: true },
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
