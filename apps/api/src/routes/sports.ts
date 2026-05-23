import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { registry } from "../lib/openapi";
import { validate } from "../middleware/validate";
import { jwtCheck, attachUser, requireAuth, requireRole } from "../middleware/auth";
import { NotFoundError, BadRequestError, ConflictError } from "../lib/errors";
import { idParamSchema, paginationSchema } from "../schemas/common";

const router: Router = Router();

// Schemas
const createSportSchema = z.object({
  name: z.string().min(1).max(50),
  displayName: z.string().min(1).max(100),
  defaultPricePerHour: z.number().min(0).nullable().optional(),
  statFields: z.record(z.unknown()).nullable().optional(),
  rulebookTitle: z.string().max(150).nullable().optional(),
  rulebookLines: z.array(z.string()).nullable().optional(),
});

const updateSportSchema = createSportSchema.partial();

const addFormatSchema = z.object({
  name: z.string().min(1).max(100),
  playersPerTeam: z.number().int().min(1),
  minTeams: z.number().int().min(2).default(2),
  maxTeams: z.number().int().min(2).default(2),
  description: z.string().max(500).nullable().optional(),
  config: z.record(z.unknown()).nullable().optional(),
});

// GET / - List all active sports with formats
router.get(
  "/",
  validate({ query: paginationSchema }),
  async (req, res, next) => {
    try {
      const { page, limit } = req.query as unknown as z.infer<typeof paginationSchema>;
      const skip = (page - 1) * limit;

      const [sports, total] = await Promise.all([
        prisma.sport.findMany({
          where: { isActive: true },
          include: { formats: true },
          skip,
          take: limit,
          orderBy: { name: "asc" },
        }),
        prisma.sport.count({ where: { isActive: true } }),
      ]);

      res.json({
        success: true,
        data: sports,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /:id - Get sport details with formats
router.get(
  "/:id",
  validate({ params: idParamSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const sport = await prisma.sport.findUnique({
        where: { id },
        include: { formats: true },
      });

      if (!sport) {
        throw new NotFoundError("Sport");
      }

      res.json({ success: true, data: sport });
    } catch (err) {
      next(err);
    }
  }
);

// POST / - Create sport (admin only)
router.post(
  "/",
  jwtCheck,
  attachUser,
  requireAuth,
  requireRole("admin"),
  validate({ body: createSportSchema }),
  async (req, res, next) => {
    try {
      const data = req.body as z.infer<typeof createSportSchema>;
      const existing = await prisma.sport.findUnique({ where: { name: data.name } });
      if (existing) {
        throw new ConflictError("Sport with this name already exists");
      }

      const sport = await prisma.sport.create({
        data: {
          name: data.name,
          displayName: data.displayName,
          defaultPricePerHour: data.defaultPricePerHour ?? undefined,
          statFields: (data.statFields ?? undefined) as any,
          rulebookTitle: data.rulebookTitle ?? undefined,
          rulebookLines: (data.rulebookLines ?? undefined) as any,
        },
        include: { formats: true },
      });

      res.status(201).json({ success: true, data: sport });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /:id - Update sport (admin only)
router.put(
  "/:id",
  jwtCheck,
  attachUser,
  requireAuth,
  requireRole("admin"),
  validate({ params: idParamSchema, body: updateSportSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const data = req.body as z.infer<typeof updateSportSchema>;

      const sport = await prisma.sport.findUnique({ where: { id } });
      if (!sport) {
        throw new NotFoundError("Sport");
      }

      if (data.name && data.name !== sport.name) {
        const existing = await prisma.sport.findUnique({ where: { name: data.name } });
        if (existing) {
          throw new ConflictError("Sport with this name already exists");
        }
      }

      const updated = await prisma.sport.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.displayName && { displayName: data.displayName }),
          ...(data.defaultPricePerHour !== undefined && { defaultPricePerHour: data.defaultPricePerHour }),
          ...(data.statFields !== undefined && { statFields: data.statFields as any }),
          ...(data.rulebookTitle !== undefined && { rulebookTitle: data.rulebookTitle }),
          ...(data.rulebookLines !== undefined && { rulebookLines: data.rulebookLines as any }),
        } as any,
        include: { formats: true },
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// POST /:id/formats - Add format to sport (admin only)
router.post(
  "/:id/formats",
  jwtCheck,
  attachUser,
  requireAuth,
  requireRole("admin"),
  validate({ params: idParamSchema, body: addFormatSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const data = req.body as z.infer<typeof addFormatSchema>;

      const sport = await prisma.sport.findUnique({ where: { id } });
      if (!sport) {
        throw new NotFoundError("Sport");
      }

      const existing = await prisma.sportFormat.findFirst({
        where: { sportId: id, name: data.name },
      });
      if (existing) {
        throw new ConflictError("Format with this name already exists for this sport");
      }

      const format = await prisma.sportFormat.create({
        data: {
          sportId: id,
          name: data.name,
          playersPerTeam: data.playersPerTeam,
          minTeams: data.minTeams,
          maxTeams: data.maxTeams,
          description: data.description ?? undefined,
          config: (data.config ?? undefined) as any,
        },
      });

      res.status(201).json({ success: true, data: format });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
