import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { registry } from "../lib/openapi";
import { validate } from "../middleware/validate";
import { jwtCheck, attachUser, requireAuth, requireRole } from "../middleware/auth";
import { NotFoundError, BadRequestError } from "../lib/errors";
import { idParamSchema } from "../schemas/common";

const router: Router = Router();

const revenueQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  groupBy: z.enum(["day", "week", "month"]).default("day"),
  venueId: z.coerce.number().int().positive().optional(),
});

const bookingsQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  venueId: z.coerce.number().int().positive().optional(),
});

const venueIdParamSchema = z.object({
  venueId: z.coerce.number().int().positive(),
});


// Auth + venue_owner or admin for all report routes
const reportAuth = [jwtCheck, attachUser, requireAuth, requireRole("venue_owner", "admin")];

// GET /revenue - Revenue report with date range
router.get(
  "/revenue",
  ...reportAuth,
  validate({ query: revenueQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate, groupBy, venueId } = req.query as unknown as z.infer<
        typeof revenueQuerySchema
      >;
      const userId = req.userId!;
      const role = req.userRole!;

      const start = new Date(startDate + "T00:00:00.000Z");
      const end = new Date(endDate + "T23:59:59.999Z");

      const where: Record<string, unknown> = {
        bookingDate: { gte: start, lte: end },
        status: { notIn: ["cancelled", "cancelled_user", "cancelled_conflict"] },
      };

      if (venueId) {
        if (role !== "admin") {
          const venue = await prisma.venue.findFirst({
            where: { id: venueId, ownerId: userId },
          });
          if (!venue) throw new BadRequestError("Venue not found or access denied");
        }
        where.venueId = venueId;
      } else if (role !== "admin") {
        where.venue = { ownerId: userId };
      }

      const bookings = await prisma.booking.findMany({
        where,
        select: {
          bookingDate: true,
          totalAmount: true,
          venueId: true,
        },
      });

      const grouped: Record<string, { total: number; count: number }> = {};
      const formatKey = (d: Date) => {
        if (groupBy === "day") return d.toISOString().slice(0, 10);
        if (groupBy === "week") {
          const weekStart = new Date(d);
          weekStart.setDate(d.getDate() - d.getDay());
          return weekStart.toISOString().slice(0, 10);
        }
        return d.toISOString().slice(0, 7);
      };

      for (const b of bookings) {
        const key = formatKey(b.bookingDate);
        if (!grouped[key]) grouped[key] = { total: 0, count: 0 };
        grouped[key].total += b.totalAmount;
        grouped[key].count += 1;
      }

      const data = Object.entries(grouped).map(([period, stats]) => ({
        period,
        ...stats,
      }));
      data.sort((a, b) => a.period.localeCompare(b.period));

      const summary = {
        totalRevenue: data.reduce((s, x) => s + x.total, 0),
        totalBookings: data.reduce((s, x) => s + x.count, 0),
      };

      res.json({ success: true, data, summary });
    } catch (err) {
      next(err);
    }
  }
);

// GET /bookings - Booking analytics
router.get(
  "/bookings",
  ...reportAuth,
  validate({ query: bookingsQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate, venueId } = req.query as unknown as z.infer<
        typeof bookingsQuerySchema
      >;
      const userId = req.userId!;
      const role = req.userRole!;

      const start = new Date(startDate + "T00:00:00.000Z");
      const end = new Date(endDate + "T23:59:59.999Z");

      const where: Record<string, unknown> = {
        bookingDate: { gte: start, lte: end },
      };

      if (venueId) {
        if (role !== "admin") {
          const venue = await prisma.venue.findFirst({
            where: { id: venueId, ownerId: userId },
          });
          if (!venue) throw new BadRequestError("Venue not found or access denied");
        }
        where.venueId = venueId;
      } else if (role !== "admin") {
        where.venue = { ownerId: userId };
      }

      const bookings = await prisma.booking.findMany({
        where,
        select: { status: true, sport: true, facilityId: true, facilityName: true },
      });

      const byStatus: Record<string, number> = {};
      const bySport: Record<string, number> = {};
      const byFacility: Record<string, number> = {};

      for (const b of bookings) {
        byStatus[b.status] = (byStatus[b.status] ?? 0) + 1;
        bySport[b.sport] = (bySport[b.sport] ?? 0) + 1;
        const facKey = `${b.facilityName ?? b.facilityId}`;
        byFacility[facKey] = (byFacility[facKey] ?? 0) + 1;
      }

      res.json({
        success: true,
        data: {
          byStatus,
          bySport,
          byFacility,
          total: bookings.length,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

const venueBookingsQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  venueId: z.coerce.number().int().positive().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /venue-bookings - List bookings for venue owner
router.get(
  "/venue-bookings",
  ...reportAuth,
  validate({ query: venueBookingsQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate, venueId, status, page, limit } = req.query as unknown as z.infer<
        typeof venueBookingsQuerySchema
      >;
      const userId = req.userId!;
      const role = req.userRole!;

      const now = new Date();
      const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      const start = new Date((startDate || defaultStart) + "T00:00:00.000Z");
      const end = new Date((endDate || defaultEnd) + "T23:59:59.999Z");

      const where: Record<string, unknown> = {
        bookingDate: { gte: start, lte: end },
      };

      if (venueId) {
        if (role !== "admin") {
          const venue = await prisma.venue.findFirst({
            where: { id: venueId, ownerId: userId },
          });
          if (!venue) throw new BadRequestError("Venue not found or access denied");
        }
        where.venueId = venueId;
      } else if (role !== "admin") {
        where.venue = { ownerId: userId };
      }

      if (status === "pending") {
        where.status = { in: ["pending", "pending_open_play"] };
      } else if (status === "cancelled") {
        where.status = { in: ["cancelled", "cancelled_user", "cancelled_conflict"] };
      } else if (status) {
        where.status = status;
      }

      const skip = (page - 1) * limit;
      const [bookings, total] = await Promise.all([
        prisma.booking.findMany({
          where,
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
          },
          orderBy: [{ bookingDate: "desc" }, { startTime: "desc" }],
          skip,
          take: limit,
        }),
        prisma.booking.count({ where }),
      ]);

      res.json({
        success: true,
        data: bookings,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /venue/:venueId - Venue-specific report
router.get(
  "/venue/:venueId",
  ...reportAuth,
  validate({ params: venueIdParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { venueId } = req.params as unknown as z.infer<typeof venueIdParamSchema>;
      const userId = req.userId!;
      const role = req.userRole!;

      const venue = await prisma.venue.findUnique({
        where: { id: venueId },
      });

      if (!venue) throw new NotFoundError("Venue");
      if (role !== "admin" && venue.ownerId !== userId)
        throw new BadRequestError("Access denied to this venue");

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [bookings, totalRevenue] = await Promise.all([
        prisma.booking.findMany({
          where: {
            venueId,
            bookingDate: { gte: thirtyDaysAgo },
            status: { notIn: ["cancelled", "cancelled_user", "cancelled_conflict"] },
          },
          select: {
            bookingDate: true,
            startTime: true,
            endTime: true,
            totalAmount: true,
            sport: true,
          },
        }),
        prisma.booking.aggregate({
          where: {
            venueId,
            status: { notIn: ["cancelled", "cancelled_user", "cancelled_conflict"] },
          },
          _sum: { totalAmount: true },
        }),
      ]);

      const popularTimes: Record<string, number> = {};
      const popularSports: Record<string, number> = {};

      for (const b of bookings) {
        if (typeof b.startTime === "string" && b.startTime.includes(":")) {
          const hour = parseInt(b.startTime.split(":")[0], 10);
          if (!isNaN(hour)) {
            const slot = `${hour}:00`;
            popularTimes[slot] = (popularTimes[slot] ?? 0) + 1;
          }
        }
        popularSports[b.sport] = (popularSports[b.sport] ?? 0) + 1;
      }

      const occupancy = bookings.length;
      const revenue = totalRevenue._sum.totalAmount ?? 0;

      res.json({
        success: true,
        data: {
          venue: { id: venue.id, name: venue.name },
          occupancy,
          revenue,
          popularTimes: Object.entries(popularTimes).sort(
            (a, b) => b[1] - a[1]
          ),
          popularSports,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
