import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { registry } from "../lib/openapi";
import { validate } from "../middleware/validate";
import { jwtCheck, attachUser, requireAuth } from "../middleware/auth";
import { NotFoundError, BadRequestError, ConflictError, ForbiddenError } from "../lib/errors";
import { dateQuerySchema } from "../schemas/common";
import { applyPricingRules, getSlotsForFacilityDate, type FacilityPricingRule } from "../services/slotPricing";

const HOLD_TTL_MINUTES = 5;

const router: Router = Router();

const venueIdParamSchema = z.object({
  venueId: z.coerce.number().int().positive(),
});

const facilityIdParamSchema = z.object({
  facilityId: z.coerce.number().int().positive(),
});

const venueSlotsQuerySchema = dateQuerySchema.extend({
  sport: z.string().optional(),
});

const facilitySlotsQuerySchema = dateQuerySchema.extend({
  sport: z.string().optional(),
});

// GET /venue/:venueId - Get all facility slots for a venue on a date
router.get(
  "/venue/:venueId",
  validate({ params: venueIdParamSchema, query: venueSlotsQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { venueId } = req.params as unknown as z.infer<typeof venueIdParamSchema>;
      const { date, sport } = req.query as unknown as z.infer<typeof venueSlotsQuerySchema>;

      const venue = await prisma.venue.findUnique({
        where: { id: venueId },
        include: {
          dbFacilities: true,
          sportFacilities: {
            include: { pricingRules: { where: { isActive: true } } },
          },
          sportRates: true,
        },
      });

      if (!venue) throw new NotFoundError("Venue");

      const slotDate = new Date(date + "T00:00:00.000Z");
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const isToday = date === todayStr;

      // Derive base price from SportRate (time-of-day aware) or fallback to pricePerHour
      const sportRate = sport
        ? venue.sportRates.find((sr) => sr.sport?.toLowerCase() === sport.toLowerCase())
        : venue.sportRates[0];
      const rateMap = (sportRate?.rates as Record<string, number> | null) ?? {};
      const fallbackPrice = venue.pricePerHour ?? 500;

      function getSportBasePrice(hour: number): number {
        if (hour < 12) return rateMap.morning  ?? fallbackPrice;
        if (hour < 17) return rateMap.afternoon ?? fallbackPrice;
        return             rateMap.evening   ?? fallbackPrice;
      }

      // When sport is given, show only facilities that explicitly support it.
      // Facilities with an empty sports array are treated as sport-agnostic and shown only
      // when no sport filter is active.
      // Fallback to all facilities if no match is found (prevents empty state).
      const allFacilities = venue.dbFacilities;
      const matching = sport
        ? allFacilities.filter((f) => {
            const arr = (f.sports as string[] | null) ?? [];
            return arr.some((s) => s.toLowerCase() === sport.toLowerCase());
          })
        : allFacilities;
      const applicableFacilities = matching.length > 0 ? matching : allFacilities;

      const allBookings = await prisma.booking.findMany({
        where: {
          venueId,
          facilityId: { in: applicableFacilities.map((f) => f.id) },
          bookingDate: slotDate,
          status: { notIn: ["cancelled", "cancelled_user", "cancelled_conflict"] },
        },
        select: { facilityId: true, startTime: true, endTime: true, status: true },
      });

      // Load owner-blocked slots for today's date
      const blockedSlots = await prisma.slot.findMany({
        where: {
          venueId,
          facilityId: { in: applicableFacilities.map((f) => f.id) },
          status: "blocked",
          startTime: { gte: slotDate, lt: new Date(slotDate.getTime() + 86400000) },
        },
        select: { facilityId: true, startTime: true, endTime: true },
      });

      const bookingsByFacility = new Map<number, typeof allBookings>();
      for (const b of allBookings) {
        const arr = bookingsByFacility.get(b.facilityId) ?? [];
        arr.push(b);
        bookingsByFacility.set(b.facilityId, arr);
      }

      const blockedByFacility = new Map<number, Set<string>>();
      for (const s of blockedSlots) {
        const startH = s.startTime.getUTCHours();
        const endH   = s.endTime.getUTCHours();
        if (!blockedByFacility.has(s.facilityId)) blockedByFacility.set(s.facilityId, new Set());
        for (let h = startH; h < endH; h++) {
          blockedByFacility.get(s.facilityId)!.add(`${String(h).padStart(2, "0")}:00`);
        }
      }

      const facilitiesWithSlots = [];

      for (const facility of applicableFacilities) {
        const sportFacility = venue.sportFacilities.find(
          (sf) => sf.name === facility.name
        );
        const rules = (sportFacility?.pricingRules ?? []) as FacilityPricingRule[];

        // Respect schedule + exceptions
        const { slots: scheduleSlots, closed, closedReason } = await getSlotsForFacilityDate(facility.id, date);

        if (closed) {
          facilitiesWithSlots.push({
            facilityId: facility.id,
            facilityName: facility.name,
            surfaceType: facility.surfaceType,
            closed: true,
            closedReason,
            slots: [],
          });
          continue;
        }

        const facilityBookings = bookingsByFacility.get(facility.id) ?? [];
        const blockedKeys = blockedByFacility.get(facility.id) ?? new Set<string>();

        // Track confirmed/fully_paid vs pending bookings separately
        const confirmedRanges = new Set<string>();
        const pendingCounts = new Map<string, number>();
        for (const b of facilityBookings) {
          const startH = parseInt(b.startTime.split(":")[0], 10);
          const endH = parseInt(b.endTime.split(":")[0], 10);
          for (let h = startH; h < endH; h++) {
            const key = `${String(h).padStart(2, "0")}:00`;
            if (["confirmed", "fully_paid"].includes(b.status)) {
              confirmedRanges.add(key);
            } else if (["pending", "pending_open_play"].includes(b.status)) {
              pendingCounts.set(key, (pendingCounts.get(key) ?? 0) + 1);
            }
          }
        }

        const slots = scheduleSlots.map(({ startTime, endTime }) => {
          const slotDateTime = new Date(`${date}T${startTime}:00.000Z`);
          const past = isToday && slotDateTime <= now;
          const isBlocked = blockedKeys.has(startTime);
          const isConfirmed = confirmedRanges.has(startTime);
          const pendingCount = pendingCounts.get(startTime) ?? 0;
          const available = !past && !isConfirmed && !isBlocked;
          const hour = parseInt(startTime.split(":")[0], 10);
          const price = applyPricingRules(getSportBasePrice(hour), rules, slotDate, startTime);

          let status: string;
          if (past)              status = "past";
          else if (isBlocked)    status = "blocked";
          else if (isConfirmed)  status = "booked";
          else if (pendingCount > 0) status = "high_demand";
          else                   status = "available";

          return { startTime, endTime, price, available, status, pendingCount };
        });

        facilitiesWithSlots.push({
          facilityId: facility.id,
          facilityName: facility.name,
          surfaceType: facility.surfaceType,
          closed: false,
          slots,
        });
      }

      res.json({ success: true, date, facilities: facilitiesWithSlots });
    } catch (err) {
      next(err);
    }
  }
);

// GET /:facilityId - Get slots for a single facility on a date
router.get(
  "/:facilityId",
  validate({ params: facilityIdParamSchema, query: facilitySlotsQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { facilityId } = req.params as unknown as z.infer<typeof facilityIdParamSchema>;
      const { date, sport } = req.query as unknown as z.infer<typeof facilitySlotsQuerySchema>;

      const facility = await prisma.facility.findUnique({
        where: { id: facilityId },
        include: {
          venue: {
            include: {
              sportFacilities: {
                include: { pricingRules: { where: { isActive: true } } },
              },
            },
          },
        },
      });

      if (!facility) throw new NotFoundError("Facility");

      const sportsArr = (facility.sports as string[] | null) ?? [];
      if (sport && sportsArr.length > 0 && !sportsArr.includes(sport)) {
        throw new BadRequestError("Facility does not support this sport");
      }

      const sportFacility = facility.venue.sportFacilities.find(
        (sf) => sf.name === facility.name
      );
      const rules = (sportFacility?.pricingRules ?? []) as FacilityPricingRule[];
      const basePrice = facility.venue.pricePerHour ?? 0;
      const slotDate = new Date(date + "T00:00:00.000Z");
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const isToday = date === todayStr;

      const { slots: scheduleSlots, closed, closedReason } = await getSlotsForFacilityDate(facility.id, date);

      if (closed) {
        return res.json({
          success: true, date,
          facility: {
            facilityId: facility.id,
            facilityName: facility.name,
            surfaceType: facility.surfaceType,
            venueId: facility.venueId,
          },
          closed: true,
          closedReason,
          slots: [],
        });
      }

      const bookings = await prisma.booking.findMany({
        where: {
          venueId: facility.venueId,
          facilityId: facility.id,
          bookingDate: slotDate,
          status: { notIn: ["cancelled", "cancelled_user", "cancelled_conflict"] },
        },
        select: { startTime: true, endTime: true, status: true },
      });

      const confirmedRanges = new Set<string>();
      const pendingCounts = new Map<string, number>();
      for (const b of bookings) {
        const startH = parseInt(b.startTime.split(":")[0], 10);
        const endH = parseInt(b.endTime.split(":")[0], 10);
        for (let h = startH; h < endH; h++) {
          const key = `${String(h).padStart(2, "0")}:00`;
          if (["confirmed", "fully_paid"].includes(b.status)) {
            confirmedRanges.add(key);
          } else if (["pending", "pending_open_play"].includes(b.status)) {
            pendingCounts.set(key, (pendingCounts.get(key) ?? 0) + 1);
          }
        }
      }

      const slots = scheduleSlots.map(({ startTime, endTime }) => {
        const slotDateTime = new Date(`${date}T${startTime}:00.000Z`);
        const past = isToday && slotDateTime <= now;
        const isConfirmed = confirmedRanges.has(startTime);
        const pendingCount = pendingCounts.get(startTime) ?? 0;
        const available = !past && !isConfirmed;
        const price = applyPricingRules(basePrice, rules, slotDate, startTime);

        let status: string;
        if (past) status = "past";
        else if (isConfirmed) status = "booked";
        else if (pendingCount > 0) status = "high_demand";
        else status = "available";

        return { startTime, endTime, price, available, status, pendingCount };
      });

      res.json({
        success: true,
        date,
        facility: {
          facilityId: facility.id,
          facilityName: facility.name,
          surfaceType: facility.surfaceType,
          venueId: facility.venueId,
        },
        slots,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Hold schemas ────────────────────────────────────────────────────────────

const holdBodySchema = z.object({
  facilityId: z.coerce.number().int().positive(),
  venueId:    z.coerce.number().int().positive(),
  date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime:  z.string().regex(/^\d{2}:\d{2}$/),
  endTime:    z.string().regex(/^\d{2}:\d{2}$/),
});

const holdIdParamSchema = z.object({
  holdId: z.coerce.number().int().positive(),
});

// ─── Block schemas ───────────────────────────────────────────────────────────

const blockBodySchema = z.object({
  venueId:    z.coerce.number().int().positive(),
  facilityId: z.coerce.number().int().positive(),
  date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime:  z.string().regex(/^\d{2}:\d{2}$/),
  endTime:    z.string().regex(/^\d{2}:\d{2}$/),
  reason:     z.string().optional(),
});

const slotIdParamSchema = z.object({
  slotId: z.coerce.number().int().positive(),
});

// ─── POST /hold — temporarily reserve a slot ─────────────────────────────────
router.post(
  "/hold",
  jwtCheck, attachUser, requireAuth,
  validate({ body: holdBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { facilityId, venueId, date, startTime, endTime } =
        req.body as z.infer<typeof holdBodySchema>;
      const userId = req.userId!;

      const now = new Date();
      const expiresAt = new Date(now.getTime() + HOLD_TTL_MINUTES * 60 * 1000);
      const bookingDate = new Date(date + "T00:00:00.000Z");

      // Check for existing confirmed booking at this slot
      const confirmedConflict = await prisma.booking.findFirst({
        where: {
          venueId,
          facilityId,
          bookingDate,
          status: { in: ["confirmed", "fully_paid"] },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      });
      if (confirmedConflict) throw new ConflictError("Slot is already booked");

      // Check for an active hold by another user
      const rivalHold = await prisma.bookingHold.findFirst({
        where: {
          facilityId,
          date,
          startTime: { lt: endTime },
          endTime: { gt: startTime },
          userId: { not: userId },
          expiresAt: { gt: now },
        },
      });
      if (rivalHold) throw new ConflictError("Slot is temporarily held by another user");

      // Upsert own hold for this slot (replace if already exists)
      await prisma.bookingHold.deleteMany({
        where: { facilityId, date, startTime, endTime, userId },
      });

      const hold = await prisma.bookingHold.create({
        data: { facilityId, venueId, date, startTime, endTime, userId, expiresAt },
      });

      res.status(201).json({
        success: true,
        hold: { id: hold.id, expiresAt: hold.expiresAt },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── DELETE /hold/:holdId — release a slot hold ──────────────────────────────
router.delete(
  "/hold/:holdId",
  jwtCheck, attachUser, requireAuth,
  validate({ params: holdIdParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { holdId } = req.params as unknown as z.infer<typeof holdIdParamSchema>;
      const userId = req.userId!;

      const hold = await prisma.bookingHold.findFirst({
        where: { id: holdId, userId },
      });
      if (!hold) throw new NotFoundError("Hold");

      await prisma.bookingHold.delete({ where: { id: holdId } });

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /venue/:venueId/blocks — list owner-blocked slots ───────────────────
router.get(
  "/venue/:venueId/blocks",
  jwtCheck, attachUser, requireAuth,
  validate({ params: venueIdParamSchema, query: dateQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { venueId } = req.params as unknown as z.infer<typeof venueIdParamSchema>;
      const { date } = req.query as unknown as z.infer<typeof dateQuerySchema>;
      const userId = req.userId!;

      const venue = await prisma.venue.findFirst({
        where: { id: venueId, ownerId: userId },
        select: { id: true },
      });
      if (!venue) throw new ForbiddenError("You do not own this venue");

      const slotDate = new Date(date + "T00:00:00.000Z");
      const nextDay = new Date(slotDate.getTime() + 24 * 60 * 60 * 1000);

      const blocked = await prisma.slot.findMany({
        where: {
          venueId,
          status: "blocked",
          startTime: { gte: slotDate, lt: nextDay },
        },
        select: { id: true, facilityId: true, startTime: true, endTime: true, price: true },
      });

      res.json({ success: true, date, blocks: blocked });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /block — owner blocks a slot ───────────────────────────────────────
router.post(
  "/block",
  jwtCheck, attachUser, requireAuth,
  validate({ body: blockBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { venueId, facilityId, date, startTime, endTime } =
        req.body as z.infer<typeof blockBodySchema>;
      const userId = req.userId!;

      // Verify ownership
      const venue = await prisma.venue.findFirst({
        where: { id: venueId, ownerId: userId },
        select: { id: true },
      });
      if (!venue) throw new ForbiddenError("You do not own this venue");

      const bookingDate = new Date(date + "T00:00:00.000Z");

      // Reject if a non-cancelled booking already exists for this slot
      const conflict = await prisma.booking.findFirst({
        where: {
          venueId,
          facilityId,
          bookingDate,
          status: { notIn: ["cancelled", "cancelled_user", "cancelled_conflict"] },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
        select: { id: true, status: true },
      });
      if (conflict) {
        throw new ConflictError(
          `An active booking (#${conflict.id}) exists for this slot. Cancel it first.`
        );
      }

      // Create blocked Slot rows for each hour in the range
      const startH = parseInt(startTime.split(":")[0], 10);
      const endH = parseInt(endTime.split(":")[0], 10);
      const created: number[] = [];
      for (let h = startH; h < endH; h++) {
        const slotStart = new Date(`${date}T${String(h).padStart(2, "0")}:00:00.000Z`);
        const slotEnd   = new Date(`${date}T${String(h + 1).padStart(2, "0")}:00:00.000Z`);
        const slot = await prisma.slot.create({
          data: { facilityId, venueId, startTime: slotStart, endTime: slotEnd, price: 0, status: "blocked" },
        });
        created.push(slot.id);
      }

      res.status(201).json({ success: true, slotIds: created });
    } catch (err) {
      next(err);
    }
  }
);

// ─── DELETE /block/:slotId — owner unblocks a slot ───────────────────────────
router.delete(
  "/block/:slotId",
  jwtCheck, attachUser, requireAuth,
  validate({ params: slotIdParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slotId } = req.params as unknown as z.infer<typeof slotIdParamSchema>;
      const userId = req.userId!;

      const slot = await prisma.slot.findUnique({
        where: { id: slotId },
        include: { venue: { select: { ownerId: true } } },
      });
      if (!slot) throw new NotFoundError("Slot");
      if (slot.venue.ownerId !== userId) throw new ForbiddenError("You do not own this venue");
      if (slot.status !== "blocked") throw new BadRequestError("Slot is not blocked");

      await prisma.slot.delete({ where: { id: slotId } });

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
