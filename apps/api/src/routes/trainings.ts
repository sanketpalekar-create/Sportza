import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { registry } from "../lib/openapi";
import { validate } from "../middleware/validate";
import { NotFoundError } from "../lib/errors";
import { idParamSchema, paginationSchema } from "../schemas/common";

const router: Router = Router();

const listQuerySchema = paginationSchema.extend({
  sport: z.string().optional(),
  city: z.string().optional(),
  priceMin: z.coerce.number().min(0).optional(),
  priceMax: z.coerce.number().min(0).optional(),
});

// GET / - Discover training batches (public, no auth)
router.get(
  "/",
  validate({ query: listQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sport, city, priceMin, priceMax } = req.query as unknown as z.infer<
        typeof listQuerySchema
      >;

      const where: Record<string, unknown> = { isActive: true };
      if (sport) where.sport = sport;
      if (city) {
        where.venue = { location: { city: { contains: city } } };
      }

      const [batches, total] = await Promise.all([
        prisma.batch.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            trainer: {
              include: {
                trainerProfile: { select: { rating: true, reviewCount: true } },
              },
            },
            venue: {
              select: { id: true, name: true, location: { select: { city: true, address: true } } },
            },
            _count: { select: { memberships: true, reviews: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.batch.count({ where }),
      ]);

      let filtered = batches;
      if (priceMin !== undefined || priceMax !== undefined) {
        filtered = batches.filter((b) => {
          const fees = b.sportFees as Record<string, number> | null;
          const prices = fees ? Object.values(fees) : [];
          const minPrice = prices.length ? Math.min(...prices) : 0;
          const maxPrice = prices.length ? Math.max(...prices) : 0;
          const avgPrice = prices.length ? prices.reduce((a, p) => a + p, 0) / prices.length : 0;
          const price = avgPrice || minPrice || maxPrice;
          if (priceMin !== undefined && price < priceMin) return false;
          if (priceMax !== undefined && price > priceMax) return false;
          return true;
        });
      }

      const data = filtered.map((b) => ({
        ...b,
        trainer: {
          id: b.trainer.id,
          name: b.trainer.name,
          avatar: b.trainer.avatar,
          trainerProfile: b.trainer.trainerProfile,
        },
        trainerRating: b.trainer.trainerProfile?.rating ?? 0,
        trainerReviewCount: b.trainer.trainerProfile?.reviewCount ?? 0,
        memberCount: b._count.memberships,
        reviewCount: b._count.reviews,
      }));

      res.json({
        success: true,
        data,
        pagination: { page, limit, total: priceMin !== undefined || priceMax !== undefined ? filtered.length : total },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /:id - Get training batch details for discovery (public)
router.get(
  "/:id",
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;

      const batch = await prisma.batch.findFirst({
        where: { id, isActive: true },
        include: {
          trainer: {
            include: {
              trainerProfile: {
                select: {
                  bio: true,
                  rating: true,
                  reviewCount: true,
                  yearsExperience: true,
                  sports: true,
                },
              },
            },
          },
          venue: {
            select: {
              id: true,
              name: true,
              location: { select: { city: true, address: true } },
            },
          },
          sessions: {
            take: 20,
            orderBy: { date: "asc" },
          },
          _count: { select: { memberships: true, reviews: true } },
          reviews: {
            take: 5,
            include: {
              player: { select: { name: true } },
            },
          },
        },
      });

      if (!batch) throw new NotFoundError("Training batch");

      const trainerRating = batch.trainer.trainerProfile?.rating ?? 0;
      const trainerReviewCount = batch.trainer.trainerProfile?.reviewCount ?? 0;

      res.json({
        success: true,
        data: {
          ...batch,
          trainerRating,
          trainerReviewCount,
          memberCount: batch._count.memberships,
          reviewCount: batch._count.reviews,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
