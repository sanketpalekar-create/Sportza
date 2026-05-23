/**
 * Schedules Router
 *
 * GET    /schedules/facility/:facilityId                   — weekly schedule (7 rows)
 * PUT    /schedules/facility/:facilityId                   — upsert all 7 days
 * PATCH  /schedules/facility/:facilityId/day/:day          — update a single day
 * GET    /schedules/facility/:facilityId/exceptions        — list exceptions (date range)
 * POST   /schedules/facility/:facilityId/exceptions        — create exception
 * DELETE /schedules/exceptions/:exceptionId                — delete exception
 * POST   /schedules/facility/:facilityId/bulk-block        — block multiple date ranges
 * GET    /schedules/facility/:facilityId/preview           — preview slots for a date
 * GET    /schedules/venue/:venueId                         — all facilities' schedules
 * POST   /schedules/facility/:facilityId/copy-to           — copy schedule to other facilities
 */

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { validate } from "../middleware/validate";
import { jwtCheck, attachUser, requireAuth } from "../middleware/auth";
import { NotFoundError, BadRequestError, ForbiddenError } from "../lib/errors";
import { emitToVenue } from "../lib/socket";

const router: Router = Router();

// ─── Common helpers ───────────────────────────────────────────────────────────

const facilityIdParam = z.object({ facilityId: z.coerce.number().int().positive() });
const venueIdParam    = z.object({ venueId:    z.coerce.number().int().positive() });
const exceptionIdParam = z.object({ exceptionId: z.coerce.number().int().positive() });

const TIME_RE = /^\d{2}:\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Verify ownership: caller owns the venue that contains this facility */
async function assertFacilityOwner(facilityId: number, userId: number) {
  const facility = await prisma.facility.findUnique({
    where: { id: facilityId },
    include: { venue: { select: { ownerId: true, id: true } } },
  });
  if (!facility) throw new NotFoundError("Facility");
  if (facility.venue.ownerId !== userId) throw new ForbiddenError("You do not own this venue");
  return facility;
}

async function assertVenueOwner(venueId: number, userId: number) {
  const venue = await prisma.venue.findFirst({ where: { id: venueId, ownerId: userId }, select: { id: true } });
  if (!venue) throw new ForbiddenError("You do not own this venue");
  return venue;
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const breakTimeSchema = z.object({
  start: z.string().regex(TIME_RE),
  end:   z.string().regex(TIME_RE),
});

const dayScheduleSchema = z.object({
  dayOfWeek:    z.number().int().min(0).max(6),
  isOpen:       z.boolean().default(true),
  openTime:     z.string().regex(TIME_RE).default("06:00"),
  closeTime:    z.string().regex(TIME_RE).default("23:00"),
  slotDuration: z.number().int().min(15).max(240).default(60),
  breakTimes:   z.array(breakTimeSchema).default([]),
});

const weeklyScheduleSchema = z.array(dayScheduleSchema).min(1).max(7);

const singleDayPatchSchema = dayScheduleSchema.omit({ dayOfWeek: true }).partial();

const exceptionSchema = z.object({
  startDate:   z.string().regex(DATE_RE),
  endDate:     z.string().regex(DATE_RE),
  type:        z.enum(["holiday", "event", "maintenance", "custom_hours"]),
  label:       z.string().max(100).optional(),
  isFullBlock: z.boolean().default(true),
  customOpen:  z.string().regex(TIME_RE).optional(),
  customClose: z.string().regex(TIME_RE).optional(),
  reason:      z.string().max(500).optional(),
});

const bulkBlockSchema = z.object({
  ranges: z.array(z.object({
    startDate: z.string().regex(DATE_RE),
    endDate:   z.string().regex(DATE_RE),
  })).min(1),
  label:  z.string().max(100).optional(),
  reason: z.string().max(500).optional(),
  type:   z.enum(["holiday", "event", "maintenance", "custom_hours"]).default("maintenance"),
});

const previewQuerySchema = z.object({
  date: z.string().regex(DATE_RE),
});

const copyToSchema = z.object({
  targetFacilityIds: z.array(z.number().int().positive()).min(1),
});

const exceptionListQuerySchema = z.object({
  startDate: z.string().regex(DATE_RE).optional(),
  endDate:   z.string().regex(DATE_RE).optional(),
});

// ─── Slot generation helper ───────────────────────────────────────────────────

type BreakTime = { start: string; end: string };

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function isInBreak(slotStart: number, slotEnd: number, breaks: BreakTime[]): boolean {
  return breaks.some((b) => {
    const bs = timeToMinutes(b.start);
    const be = timeToMinutes(b.end);
    return slotStart < be && slotEnd > bs;
  });
}

export function generateScheduledSlots(
  schedule: { openTime: string; closeTime: string; slotDuration: number; breakTimes: BreakTime[] },
  exception?: { isFullBlock: boolean; customOpen?: string | null; customClose?: string | null } | null
): Array<{ startTime: string; endTime: string }> {
  if (exception?.isFullBlock) return [];

  const openMin  = timeToMinutes(exception?.customOpen  ?? schedule.openTime);
  const closeMin = timeToMinutes(exception?.customClose ?? schedule.closeTime);
  const duration = schedule.slotDuration;
  const breaks   = schedule.breakTimes;

  const slots: Array<{ startTime: string; endTime: string }> = [];
  for (let cur = openMin; cur + duration <= closeMin; cur += duration) {
    if (!isInBreak(cur, cur + duration, breaks)) {
      slots.push({ startTime: minutesToTime(cur), endTime: minutesToTime(cur + duration) });
    }
  }
  return slots;
}

// ─── Default schedule (used when no rows exist) ───────────────────────────────

const DEFAULT_SCHEDULE = {
  isOpen: true,
  openTime: "06:00",
  closeTime: "23:00",
  slotDuration: 60,
  breakTimes: [] as BreakTime[],
};

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /schedules/facility/:facilityId — get weekly schedule
router.get(
  "/facility/:facilityId",
  jwtCheck, attachUser, requireAuth,
  validate({ params: facilityIdParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { facilityId } = req.params as unknown as z.infer<typeof facilityIdParam>;
      await assertFacilityOwner(facilityId, req.userId!);

      const rows = await prisma.facilitySchedule.findMany({
        where: { facilityId },
        orderBy: { dayOfWeek: "asc" },
      });

      // Fill missing days with defaults
      const DAYS = [0, 1, 2, 3, 4, 5, 6];
      const schedule = DAYS.map((day) => {
        const row = rows.find((r) => r.dayOfWeek === day);
        return row ?? { dayOfWeek: day, ...DEFAULT_SCHEDULE, facilityId, id: null };
      });

      res.json({ success: true, data: schedule });
    } catch (err) { next(err); }
  }
);

// PUT /schedules/facility/:facilityId — upsert full weekly schedule (all 7 days)
router.put(
  "/facility/:facilityId",
  jwtCheck, attachUser, requireAuth,
  validate({ params: facilityIdParam, body: weeklyScheduleSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { facilityId } = req.params as unknown as z.infer<typeof facilityIdParam>;
      const facility = await assertFacilityOwner(facilityId, req.userId!);
      const days = req.body as z.infer<typeof weeklyScheduleSchema>;

      // Validate no overlap in break times
      for (const day of days) {
        const breaks = day.breakTimes ?? [];
        for (const b of breaks) {
          if (timeToMinutes(b.end) <= timeToMinutes(b.start)) {
            throw new BadRequestError(`Break end must be after start on day ${day.dayOfWeek}`);
          }
        }
        if (timeToMinutes(day.closeTime) <= timeToMinutes(day.openTime)) {
          throw new BadRequestError(`Close time must be after open time on day ${day.dayOfWeek}`);
        }
      }

      const upserted = await Promise.all(
        days.map((d) =>
          prisma.facilitySchedule.upsert({
            where: { facilityId_dayOfWeek: { facilityId, dayOfWeek: d.dayOfWeek } },
            update: {
              isOpen: d.isOpen,
              openTime: d.openTime,
              closeTime: d.closeTime,
              slotDuration: d.slotDuration,
              breakTimes: d.breakTimes,
            },
            create: {
              facilityId,
              venueId: facility.venueId,
              dayOfWeek: d.dayOfWeek,
              isOpen: d.isOpen,
              openTime: d.openTime,
              closeTime: d.closeTime,
              slotDuration: d.slotDuration,
              breakTimes: d.breakTimes,
            },
          })
        )
      );

      // Notify owners in real-time
      emitToVenue(facility.venueId, "schedule:updated", { facilityId, venueId: facility.venueId });

      res.json({ success: true, data: upserted });
    } catch (err) { next(err); }
  }
);

// PATCH /schedules/facility/:facilityId/day/:day — update a single day
router.patch(
  "/facility/:facilityId/day/:day",
  jwtCheck, attachUser, requireAuth,
  validate({ params: facilityIdParam.extend({ day: z.coerce.number().int().min(0).max(6) }), body: singleDayPatchSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = req.params as unknown as { facilityId: number; day: number };
      const facilityId = Number(params.facilityId);
      const day        = Number(params.day);
      const facility   = await assertFacilityOwner(facilityId, req.userId!);
      const patch      = req.body as z.infer<typeof singleDayPatchSchema>;

      const result = await prisma.facilitySchedule.upsert({
        where: { facilityId_dayOfWeek: { facilityId, dayOfWeek: day } },
        update: patch,
        create: {
          facilityId,
          venueId: facility.venueId,
          dayOfWeek: day,
          openTime:  patch.openTime  ?? DEFAULT_SCHEDULE.openTime,
          closeTime: patch.closeTime ?? DEFAULT_SCHEDULE.closeTime,
          slotDuration: patch.slotDuration ?? DEFAULT_SCHEDULE.slotDuration,
          isOpen:    patch.isOpen    ?? DEFAULT_SCHEDULE.isOpen,
          breakTimes: patch.breakTimes ?? [],
        },
      });

      emitToVenue(facility.venueId, "schedule:updated", { facilityId, venueId: facility.venueId });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }
);

// GET /schedules/facility/:facilityId/exceptions — list exceptions
router.get(
  "/facility/:facilityId/exceptions",
  jwtCheck, attachUser, requireAuth,
  validate({ params: facilityIdParam, query: exceptionListQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { facilityId } = req.params as unknown as z.infer<typeof facilityIdParam>;
      await assertFacilityOwner(facilityId, req.userId!);
      const { startDate, endDate } = req.query as z.infer<typeof exceptionListQuerySchema>;

      const exceptions = await prisma.scheduleException.findMany({
        where: {
          facilityId,
          ...(startDate && endDate ? { startDate: { lte: endDate }, endDate: { gte: startDate } } : {}),
        },
        orderBy: { startDate: "asc" },
      });

      res.json({ success: true, data: exceptions });
    } catch (err) { next(err); }
  }
);

// POST /schedules/facility/:facilityId/exceptions — add exception
router.post(
  "/facility/:facilityId/exceptions",
  jwtCheck, attachUser, requireAuth,
  validate({ params: facilityIdParam, body: exceptionSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { facilityId } = req.params as unknown as z.infer<typeof facilityIdParam>;
      const facility = await assertFacilityOwner(facilityId, req.userId!);
      const body = req.body as z.infer<typeof exceptionSchema>;

      if (body.startDate > body.endDate) throw new BadRequestError("startDate must be ≤ endDate");
      if (!body.isFullBlock && body.type === "custom_hours" && (!body.customOpen || !body.customClose)) {
        throw new BadRequestError("customOpen and customClose are required for custom_hours type");
      }

      const exception = await prisma.scheduleException.create({
        data: {
          facilityId,
          venueId: facility.venueId,
          ...body,
        },
      });

      emitToVenue(facility.venueId, "schedule:exception_added", { facilityId, exception });
      res.status(201).json({ success: true, data: exception });
    } catch (err) { next(err); }
  }
);

// DELETE /schedules/exceptions/:exceptionId — remove exception
router.delete(
  "/exceptions/:exceptionId",
  jwtCheck, attachUser, requireAuth,
  validate({ params: exceptionIdParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { exceptionId } = req.params as unknown as z.infer<typeof exceptionIdParam>;

      const exc = await prisma.scheduleException.findUnique({ where: { id: exceptionId } });
      if (!exc) throw new NotFoundError("Exception");

      const venue = await prisma.venue.findFirst({ where: { id: exc.venueId, ownerId: req.userId! } });
      if (!venue) throw new ForbiddenError("You do not own this venue");

      await prisma.scheduleException.delete({ where: { id: exceptionId } });
      emitToVenue(exc.venueId, "schedule:exception_removed", { exceptionId });

      res.json({ success: true });
    } catch (err) { next(err); }
  }
);

// POST /schedules/facility/:facilityId/bulk-block — block multiple date ranges at once
router.post(
  "/facility/:facilityId/bulk-block",
  jwtCheck, attachUser, requireAuth,
  validate({ params: facilityIdParam, body: bulkBlockSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { facilityId } = req.params as unknown as z.infer<typeof facilityIdParam>;
      const facility = await assertFacilityOwner(facilityId, req.userId!);
      const { ranges, label, reason, type } = req.body as z.infer<typeof bulkBlockSchema>;

      const created = await Promise.all(
        ranges.map((r) =>
          prisma.scheduleException.create({
            data: {
              facilityId,
              venueId: facility.venueId,
              startDate: r.startDate,
              endDate: r.endDate,
              type,
              label: label ?? null,
              isFullBlock: true,
              reason: reason ?? null,
            },
          })
        )
      );

      emitToVenue(facility.venueId, "schedule:bulk_blocked", { facilityId, count: created.length });
      res.status(201).json({ success: true, data: created, count: created.length });
    } catch (err) { next(err); }
  }
);

// GET /schedules/facility/:facilityId/preview?date= — preview generated slots
router.get(
  "/facility/:facilityId/preview",
  jwtCheck, attachUser, requireAuth,
  validate({ params: facilityIdParam, query: previewQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { facilityId } = req.params as unknown as z.infer<typeof facilityIdParam>;
      await assertFacilityOwner(facilityId, req.userId!);
      const { date } = req.query as z.infer<typeof previewQuerySchema>;

      const dateObj  = new Date(date + "T00:00:00.000Z");
      const dayOfWeek = dateObj.getUTCDay();

      const schedule = await prisma.facilitySchedule.findUnique({
        where: { facilityId_dayOfWeek: { facilityId, dayOfWeek } },
      });

      // Check for active exception
      const exception = await prisma.scheduleException.findFirst({
        where: {
          facilityId,
          startDate: { lte: date },
          endDate:   { gte: date },
        },
      });

      const effective = schedule ?? DEFAULT_SCHEDULE;
      const breaks = (effective.breakTimes as BreakTime[] | null) ?? [];

      let slots: Array<{ startTime: string; endTime: string; status: string }> = [];
      let closedReason: string | null = null;

      if (!effective.isOpen) {
        closedReason = "Facility is closed on this day";
      } else if (exception?.isFullBlock) {
        closedReason = exception.label ?? exception.type ?? "Blocked";
      } else {
        const rawSlots = generateScheduledSlots(
          { ...effective, breakTimes: breaks },
          exception
        );
        // Fetch existing bookings for that day
        const bookingDate = new Date(date + "T00:00:00.000Z");
        const bookings = await prisma.booking.findMany({
          where: {
            facilityId,
            bookingDate,
            status: { notIn: ["cancelled", "cancelled_user", "cancelled_conflict", "cancelled_owner"] },
          },
          select: { startTime: true, endTime: true, status: true },
        });

        slots = rawSlots.map(({ startTime, endTime }) => {
          const conflict = bookings.find(
            (b) => b.startTime < endTime && b.endTime > startTime
          );
          const slotStatus = conflict
            ? ["confirmed", "fully_paid"].includes(conflict.status) ? "booked" : "pending"
            : "available";
          return { startTime, endTime, status: slotStatus };
        });
      }

      res.json({
        success: true,
        date,
        dayOfWeek,
        schedule: {
          isOpen: effective.isOpen,
          openTime: effective.openTime,
          closeTime: effective.closeTime,
          slotDuration: effective.slotDuration,
          breakTimes: breaks,
        },
        exception: exception ?? null,
        closedReason,
        slots,
      });
    } catch (err) { next(err); }
  }
);

// GET /schedules/venue/:venueId — all facilities' weekly schedules
router.get(
  "/venue/:venueId",
  jwtCheck, attachUser, requireAuth,
  validate({ params: venueIdParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { venueId } = req.params as unknown as z.infer<typeof venueIdParam>;
      await assertVenueOwner(venueId, req.userId!);

      const facilities = await prisma.facility.findMany({
        where: { venueId },
        include: {
          schedules: { orderBy: { dayOfWeek: "asc" } },
        },
        orderBy: { id: "asc" },
      });

      // Also load upcoming exceptions for next 90 days
      const today = new Date().toISOString().slice(0, 10);
      const future = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
      const exceptions = await prisma.scheduleException.findMany({
        where: { venueId, startDate: { lte: future }, endDate: { gte: today } },
        orderBy: { startDate: "asc" },
      });

      res.json({
        success: true,
        data: facilities.map((f) => ({
          facilityId: f.id,
          facilityName: f.name,
          schedule: f.schedules,
          exceptions: exceptions.filter((e) => e.facilityId === f.id || e.facilityId === null),
        })),
      });
    } catch (err) { next(err); }
  }
);

// POST /schedules/facility/:facilityId/copy-to — copy schedule to other facilities
router.post(
  "/facility/:facilityId/copy-to",
  jwtCheck, attachUser, requireAuth,
  validate({ params: facilityIdParam, body: copyToSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { facilityId } = req.params as unknown as z.infer<typeof facilityIdParam>;
      const facility = await assertFacilityOwner(facilityId, req.userId!);
      const { targetFacilityIds } = req.body as z.infer<typeof copyToSchema>;

      // Verify caller owns all target facilities in same venue
      const targets = await prisma.facility.findMany({
        where: { id: { in: targetFacilityIds }, venueId: facility.venueId },
        select: { id: true },
      });
      if (targets.length !== targetFacilityIds.length) {
        throw new BadRequestError("One or more target facilities not found in your venue");
      }

      const sourceSchedule = await prisma.facilitySchedule.findMany({ where: { facilityId } });
      if (sourceSchedule.length === 0) throw new BadRequestError("Source facility has no schedule set");

      for (const targetId of targetFacilityIds) {
        await Promise.all(
          sourceSchedule.map((s) =>
            prisma.facilitySchedule.upsert({
              where: { facilityId_dayOfWeek: { facilityId: targetId, dayOfWeek: s.dayOfWeek } },
              update: {
                isOpen: s.isOpen,
                openTime: s.openTime,
                closeTime: s.closeTime,
                slotDuration: s.slotDuration,
                breakTimes: s.breakTimes == null
                  ? Prisma.JsonNull
                  : (s.breakTimes as Prisma.InputJsonValue),
              },
              create: {
                facilityId: targetId,
                venueId: facility.venueId,
                dayOfWeek: s.dayOfWeek,
                isOpen: s.isOpen,
                openTime: s.openTime,
                closeTime: s.closeTime,
                slotDuration: s.slotDuration,
                breakTimes: s.breakTimes == null
                  ? Prisma.JsonNull
                  : (s.breakTimes as Prisma.InputJsonValue),
              },
            })
          )
        );
      }

      emitToVenue(facility.venueId, "schedule:updated", { venueId: facility.venueId });
      res.json({ success: true, copiedTo: targetFacilityIds });
    } catch (err) { next(err); }
  }
);

export default router;
