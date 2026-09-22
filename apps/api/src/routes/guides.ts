import { Router, Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { registry } from "../lib/openapi";
import { validate } from "../middleware/validate";
import { jwtCheck, attachUser, requireAuth } from "../middleware/auth";
import { BadRequestError, NotFoundError } from "../lib/errors";
import {
  guideIdParamSchema,
  guideProgressUpdateSchema,
  guideStartSchema,
  guideVersionQuerySchema,
  ALLOWED_GUIDE_IDS,
} from "../schemas/guides";

const router: Router = Router();

registry.registerPath({
  method: "get",
  path: "/guides/progress",
  tags: ["Guides"],
  summary: "Get current user's guide progress",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "Guide progress list" },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "post",
  path: "/guides/{guideId}/start",
  tags: ["Guides"],
  summary: "Start or reset a guide",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "Guide started" },
    401: { description: "Unauthorized" },
    422: { description: "Validation error" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/guides/{guideId}/progress",
  tags: ["Guides"],
  summary: "Update guide progress",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "Progress updated" },
    401: { description: "Unauthorized" },
    404: { description: "Progress not found" },
    422: { description: "Validation error" },
  },
});

registry.registerPath({
  method: "post",
  path: "/guides/{guideId}/complete",
  tags: ["Guides"],
  summary: "Mark a guide as completed",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "Guide completed" },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "post",
  path: "/guides/{guideId}/skip",
  tags: ["Guides"],
  summary: "Skip a guide",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "Guide skipped" },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "get",
  path: "/guides",
  tags: ["Guides"],
  summary: "List available guide IDs",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "Guide ID allowlist" },
    401: { description: "Unauthorized" },
  },
});

// GET /guides — available guide IDs
router.get(
  "/",
  jwtCheck,
  attachUser,
  requireAuth,
  (_req: Request, res: Response) => {
    res.json({ success: true, data: [...ALLOWED_GUIDE_IDS] });
  }
);

// GET /guides/progress — all progress for current user
router.get(
  "/progress",
  jwtCheck,
  attachUser,
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const rows = await prisma.userGuideProgress.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  }
);

// POST /guides/:guideId/start
router.post(
  "/:guideId/start",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: guideIdParamSchema, body: guideStartSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { guideId } = req.params as { guideId: string };
      const version = (req.body.version as number) ?? 1;

      const row = await prisma.userGuideProgress.upsert({
        where: {
          userId_guideId_version: { userId, guideId, version },
        },
        create: {
          userId,
          guideId,
          version,
          currentStep: 0,
          completed: false,
          skipped: false,
          startedAt: new Date(),
          completedAt: null,
        },
        update: {
          currentStep: 0,
          completed: false,
          skipped: false,
          startedAt: new Date(),
          completedAt: null,
        },
      });

      res.json({ success: true, data: row, message: "Guide started" });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /guides/:guideId/progress
router.patch(
  "/:guideId/progress",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: guideIdParamSchema, body: guideProgressUpdateSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { guideId } = req.params as { guideId: string };
      const { version = 1, currentStep, completed, skipped } = req.body as {
        version?: number;
        currentStep?: number;
        completed?: boolean;
        skipped?: boolean;
      };

      const existing = await prisma.userGuideProgress.findUnique({
        where: {
          userId_guideId_version: { userId, guideId, version },
        },
      });

      if (!existing) {
        throw new NotFoundError("Guide progress not found. Start the guide first.");
      }

      const data: {
        currentStep?: number;
        completed?: boolean;
        skipped?: boolean;
        completedAt?: Date | null;
      } = {};

      if (typeof currentStep === "number") data.currentStep = currentStep;
      if (typeof completed === "boolean") {
        data.completed = completed;
        data.completedAt = completed ? new Date() : null;
      }
      if (typeof skipped === "boolean") {
        data.skipped = skipped;
        if (skipped) {
          data.completed = false;
          data.completedAt = new Date();
        }
      }

      if (Object.keys(data).length === 0) {
        throw new BadRequestError("No progress fields to update");
      }

      const row = await prisma.userGuideProgress.update({
        where: { id: existing.id },
        data,
      });

      res.json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  }
);

// POST /guides/:guideId/complete
router.post(
  "/:guideId/complete",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: guideIdParamSchema, query: guideVersionQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { guideId } = req.params as { guideId: string };
      const version = Number((req.query as { version?: number }).version ?? 1);

      const row = await prisma.userGuideProgress.upsert({
        where: {
          userId_guideId_version: { userId, guideId, version },
        },
        create: {
          userId,
          guideId,
          version,
          currentStep: 0,
          completed: true,
          skipped: false,
          startedAt: new Date(),
          completedAt: new Date(),
        },
        update: {
          completed: true,
          skipped: false,
          completedAt: new Date(),
        },
      });

      res.json({ success: true, data: row, message: "Guide completed" });
    } catch (err) {
      next(err);
    }
  }
);

// POST /guides/:guideId/skip
router.post(
  "/:guideId/skip",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: guideIdParamSchema, query: guideVersionQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { guideId } = req.params as { guideId: string };
      const version = Number((req.query as { version?: number }).version ?? 1);

      const row = await prisma.userGuideProgress.upsert({
        where: {
          userId_guideId_version: { userId, guideId, version },
        },
        create: {
          userId,
          guideId,
          version,
          currentStep: 0,
          completed: false,
          skipped: true,
          startedAt: new Date(),
          completedAt: new Date(),
        },
        update: {
          skipped: true,
          completed: false,
          completedAt: new Date(),
        },
      });

      res.json({ success: true, data: row, message: "Guide skipped" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
