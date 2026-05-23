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
const listTrainersQuerySchema = paginationSchema.extend({
  sport: z.string().optional(),
});

const updateProfileSchema = z.object({
  bio: z.string().max(2000).optional(),
  yearsExperience: z.number().int().min(0).optional(),
  sports: z.array(z.string()).nullable().optional(),
  certifications: z.record(z.unknown()).nullable().optional(),
  achievements: z.record(z.unknown()).nullable().optional(),
});

const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  review: z.string().max(1000).nullable().optional(),
});

const addVenueSchema = z.object({
  venueId: z.coerce.number().int().positive(),
});

const venueIdParamSchema = z.object({
  venueId: z.coerce.number().int().positive(),
});

// GET / - List trainers with optional sport filter
router.get(
  "/",
  validate({ query: listTrainersQuerySchema }),
  async (req, res, next) => {
    try {
      const { page, limit, sport } = req.query as unknown as z.infer<typeof listTrainersQuerySchema>;
      const skip = (page - 1) * limit;

      const profileWhere: Record<string, unknown> = {};
      if (sport) profileWhere.sports = { string_contains: sport };

      const [profiles, total] = await Promise.all([
        prisma.trainerProfile.findMany({
          where: profileWhere,
          include: {
            user: { select: { id: true, name: true, avatar: true, location: { select: { city: true, state: true } } } },
          },
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.trainerProfile.count({ where: profileWhere }),
      ]);

      res.json({
        success: true,
        data: profiles,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /my/payments - Get all batch payments for the current trainer
router.get(
  "/my/payments",
  jwtCheck,
  attachUser,
  requireAuth,
  requireRole("trainer", "admin"),
  async (req, res, next) => {
    try {
      const userId = req.userId!;
      const { page = 1, limit = 50 } = req.query as { page?: number; limit?: number };
      const skip = (Number(page) - 1) * Number(limit);

      const [payments, total] = await Promise.all([
        prisma.batchPayment.findMany({
          where: { batch: { trainerId: userId } },
          include: {
            payer: { select: { id: true, name: true, avatar: true } },
            batch: { select: { id: true, name: true, sport: true } },
          },
          skip,
          take: Number(limit),
          orderBy: { createdAt: "desc" },
        }),
        prisma.batchPayment.count({ where: { batch: { trainerId: userId } } }),
      ]);

      res.json({
        success: true,
        data: payments,
        meta: { total, page: Number(page), limit: Number(limit) },
      });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /profile - Update own trainer profile (BEFORE /:id)
router.put(
  "/profile",
  jwtCheck,
  attachUser,
  requireAuth,
  requireRole("trainer", "admin"),
  validate({ body: updateProfileSchema }),
  async (req, res, next) => {
    try {
      const userId = req.userId!;
      const data = req.body as z.infer<typeof updateProfileSchema>;

      const existing = await prisma.trainerProfile.findUnique({
        where: { userId },
      });

      if (!existing) {
        throw new NotFoundError("Trainer profile");
      }

      const profile = await prisma.trainerProfile.update({
        where: { userId },
        data: {
          ...(data.bio !== undefined && { bio: data.bio }),
          ...(data.yearsExperience !== undefined && { yearsExperience: data.yearsExperience }),
          ...(data.sports !== undefined && { sports: data.sports as any }),
          ...(data.certifications !== undefined && { certifications: data.certifications as any }),
          ...(data.achievements !== undefined && { achievements: data.achievements as any }),
        } as any,
        include: { user: { select: { id: true, name: true, avatar: true } } },
      });

      res.json({ success: true, data: profile });
    } catch (err) {
      next(err);
    }
  }
);

// GET /dashboard - Get trainer dashboard stats (BEFORE /:id)
router.get(
  "/dashboard",
  jwtCheck,
  attachUser,
  requireAuth,
  requireRole("trainer", "admin"),
  async (req, res, next) => {
    try {
      const userId = req.userId!;

      const now = new Date();
      const cycleMonth = now.getMonth() + 1;
      const cycleYear = now.getFullYear();

      const [batchCount, studentCount, payments, batches, memberships, paidThisMonth] = await Promise.all([
        prisma.batch.count({ where: { trainerId: userId, isActive: true } }),
        prisma.batchMembership.count({
          where: { batch: { trainerId: userId }, status: "active" },
        }),
        prisma.batchPayment.findMany({
          where: { batch: { trainerId: userId } },
          select: { amount: true, trainerNetAmount: true, status: true, createdAt: true },
        }),
        prisma.batch.findMany({
          where: { trainerId: userId },
          select: {
            id: true,
            name: true,
            sport: true,
            capacity: true,
            _count: { select: { memberships: true } },
          },
        }),
        prisma.batchMembership.findMany({
          where: { batch: { trainerId: userId }, status: "active" },
          include: {
            player: { select: { id: true, name: true, phone: true } },
            batch: { select: { id: true, name: true } },
          },
        }),
        prisma.batchPayment.findMany({
          where: {
            batch: { trainerId: userId },
            cycleMonth,
            cycleYear,
            status: "completed",
            playerId: { not: null },
          },
          select: { batchId: true, playerId: true },
        }),
      ]);

      const totalEarnings = payments
        .filter((p) => p.status === "completed")
        .reduce((sum, p) => sum + (p.trainerNetAmount ?? p.amount), 0);

      const paidSet = new Set(paidThisMonth.map((p) => `${p.batchId}-${p.playerId}`));
      const overduePayments = memberships
        .filter((m) => !paidSet.has(`${m.batchId}-${m.playerId}`))
        .map((m) => ({
          batchId: m.batchId,
          batchName: m.batch.name,
          playerId: m.playerId,
          playerName: m.player?.name ?? "Student",
          playerPhone: m.player?.phone ?? null,
          cycleMonth,
          cycleYear,
        }));

      res.json({
        success: true,
        data: {
          batchCount,
          studentCount,
          totalEarnings,
          recentPayments: payments.slice(0, 10),
          batches,
          overduePayments,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /me/venues - List trainer's venue associations (auth required)
router.get(
  "/me/venues",
  jwtCheck,
  attachUser,
  requireAuth,
  requireRole("trainer", "admin"),
  async (req, res, next) => {
    try {
      const userId = req.userId!;
      const venues = await prisma.trainerVenue.findMany({
        where: { userId },
        include: { venue: { select: { id: true, name: true, location: { select: { address: true, city: true } } } } },
      });
      res.json({ success: true, data: venues });
    } catch (err) {
      next(err);
    }
  }
);

// POST /me/venues - Add venue association
router.post(
  "/me/venues",
  jwtCheck,
  attachUser,
  requireAuth,
  requireRole("trainer", "admin"),
  validate({ body: addVenueSchema }),
  async (req, res, next) => {
    try {
      const userId = req.userId!;
      const { venueId } = req.body as { venueId: number };
      const venue = await prisma.venue.findUnique({ where: { id: venueId } });
      if (!venue) throw new NotFoundError("Venue");
      const association = await prisma.trainerVenue.create({
        data: { userId, venueId },
        include: { venue: { select: { id: true, name: true } } },
      });
      res.status(201).json({ success: true, data: association });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /me/venues/:venueId - Remove venue association
router.delete(
  "/me/venues/:venueId",
  jwtCheck,
  attachUser,
  requireAuth,
  requireRole("trainer", "admin"),
  validate({ params: venueIdParamSchema }),
  async (req, res, next) => {
    try {
      const userId = req.userId!;
      const venueId = parseInt(req.params.venueId as string, 10);
      await prisma.trainerVenue.deleteMany({
        where: { userId, venueId },
      });
      res.json({ success: true, message: "Venue association removed" });
    } catch (err) {
      next(err);
    }
  }
);

// GET /:id - Get trainer profile with user details and venues
router.get(
  "/:id",
  validate({ params: idParamSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          avatar: true,
          location: { select: { city: true, state: true } },
          trainerProfile: true,
        },
      });

      if (!user?.trainerProfile) {
        throw new NotFoundError("Trainer");
      }

      const venues = await prisma.trainerVenue.findMany({
        where: { userId: id },
        include: { venue: { select: { id: true, name: true, location: { select: { address: true, city: true } } } } },
      });

      res.json({
        success: true,
        data: { ...user.trainerProfile, user: { id: user.id, name: user.name, avatar: user.avatar, location: user.location }, venues },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /:id/reviews - Get trainer reviews
router.get(
  "/:id/reviews",
  validate({ params: idParamSchema, query: paginationSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const { page, limit } = req.query as unknown as z.infer<typeof paginationSchema>;
      const skip = (page - 1) * limit;

      const [reviews, total] = await Promise.all([
        prisma.trainerReview.findMany({
          where: { trainerId: id },
          include: {
            user: { select: { id: true, name: true, avatar: true } },
          },
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.trainerReview.count({ where: { trainerId: id } }),
      ]);

      res.json({
        success: true,
        data: reviews,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /:id/reviews - Add trainer review (authenticated)
router.post(
  "/:id/reviews",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema, body: createReviewSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const data = req.body as z.infer<typeof createReviewSchema>;
      const userId = req.userId!;

      if (id === userId) {
        throw new BadRequestError("Cannot review yourself");
      }

      const trainer = await prisma.user.findUnique({
        where: { id },
        include: { trainerProfile: true },
      });

      if (!trainer) {
        throw new NotFoundError("Trainer");
      }

      const existing = await prisma.trainerReview.findUnique({
        where: { trainerId_userId: { trainerId: id, userId } },
      });

      if (existing) {
        throw new ConflictError("You have already reviewed this trainer");
      }

      // BRD: review only allowed after ≥1 month in trainer's batch
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const eligibleMembership = await prisma.batchMembership.findFirst({
        where: {
          playerId: userId,
          batch: { trainerId: id },
          joinDate: { lte: oneMonthAgo },
          status: "active",
        },
      });

      if (!eligibleMembership) {
        throw new BadRequestError(
          "You must be an active member of this trainer's batch for at least 1 month to leave a review"
        );
      }

      const review = await prisma.trainerReview.create({
        data: { trainerId: id, userId, rating: data.rating, review: data.review ?? undefined },
        include: {
          user: { select: { id: true, name: true, avatar: true } },
        },
      });

      res.status(201).json({ success: true, data: review });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
