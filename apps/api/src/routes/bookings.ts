import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { registry } from "../lib/openapi";
import { validate } from "../middleware/validate";
import { jwtCheck, attachUser, requireAuth } from "../middleware/auth";
import { NotFoundError, BadRequestError, ConflictError, ForbiddenError, ConflictWithSuggestionsError } from "../lib/errors";
import { idParamSchema, paginationSchema, dateQuerySchema } from "../schemas/common";
import { initiateRefund, initiateSplitBookingRefund, calculateRefundPolicy } from "../services/refundService";
import { getAvailableSlots, validateBookingTime } from "../services/bookingConflict";
import { addRefundJob } from "../lib/queue";
import { emitBookingEvent } from "../lib/socket";
import {
  hoursBetween,
  calculateSplitShare,
  splitPaymentProgressMeta,
  buildSplitDetailsPayload,
  type SplitRow,
} from "../lib/bookingHelpers";
import { createNotification, createBulkNotifications, NotifType } from "../services/notificationService";

const router: Router = Router();

const bookingListQuerySchema = paginationSchema.extend({
  status: z.string().optional(),
});

const bookingCreateSchema = z
  .object({
    venueId: z.number().int().positive(),
    facilityId: z.number().int().positive(),
    sport: z.string(),
    bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    bookingType: z.enum(["solo", "split"]).default("solo"),
    splitCount: z.number().int().min(2).max(22).optional(),
    addOns: z
      .array(
        z.object({
          addOnId: z.number().int().positive(),
          quantity: z.number().int().min(1).default(1),
        })
      )
      .optional(),
  })
  .refine(
    (d) => d.bookingType !== "split" || (d.splitCount !== undefined && d.splitCount >= 2),
    { message: "splitCount (>= 2) is required for split bookings", path: ["splitCount"] }
  );

const instantBookingSchema = z.object({
  facilityId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

const checkAvailabilityQuerySchema = z.object({
  facilityId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const estimateQuerySchema = z.object({
  facilityId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

registry.registerPath({
  method: "get",
  path: "/bookings",
  summary: "List user's bookings",
  security: [{ bearerAuth: [] }],
  request: { query: bookingListQuerySchema },
  responses: { 200: { description: "List of bookings" } },
});

registry.registerPath({
  method: "get",
  path: "/bookings/check-availability",
  summary: "Check slot availability",
  request: { query: checkAvailabilityQuerySchema },
  responses: { 200: { description: "Available slots" } },
});

registry.registerPath({
  method: "get",
  path: "/bookings/estimate",
  summary: "Get price estimate",
  request: { query: estimateQuerySchema },
  responses: { 200: { description: "Price estimate" } },
});

registry.registerPath({
  method: "get",
  path: "/bookings/{id}",
  summary: "Get booking details",
  security: [{ bearerAuth: [] }],
  request: { params: idParamSchema },
  responses: { 200: { description: "Booking details" } },
});

registry.registerPath({
  method: "post",
  path: "/bookings",
  summary: "Create booking",
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: bookingCreateSchema } } } },
  responses: { 201: { description: "Booking created" } },
});

registry.registerPath({
  method: "post",
  path: "/bookings/instant",
  summary: "Instant booking",
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: instantBookingSchema } } } },
  responses: { 201: { description: "Instant booking created" } },
});

registry.registerPath({
  method: "get",
  path: "/bookings/{id}/split-status",
  summary: "Get split booking payment status",
  security: [{ bearerAuth: [] }],
  request: { params: idParamSchema },
  responses: { 200: { description: "Split payment status" } },
});

registry.registerPath({
  method: "post",
  path: "/bookings/{id}/split/join",
  summary: "Join a split booking",
  security: [{ bearerAuth: [] }],
  request: { params: idParamSchema },
  responses: { 200: { description: "Joined split booking" } },
});

registry.registerPath({
  method: "post",
  path: "/bookings/{id}/split/leave",
  summary: "Leave a split booking (cancel your share)",
  security: [{ bearerAuth: [] }],
  request: { params: idParamSchema },
  responses: { 200: { description: "Left split booking" } },
});

registry.registerPath({
  method: "post",
  path: "/bookings/{id}/cancel",
  summary: "Cancel booking",
  security: [{ bearerAuth: [] }],
  request: { params: idParamSchema },
  responses: { 200: { description: "Booking cancelled" } },
});

async function calculatePriceFromRules(
  venueId: number,
  facilityId: number,
  dateStr: string,
  startTime: string,
  endTime: string
): Promise<{ subtotal: number; gstRate: number; gstAmount: number; totalAmount: number }> {
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    include: { pricingRules: { where: { isActive: true } }, sportFacilities: true },
  });
  if (!venue) throw new NotFoundError("Venue");
  const basePrice = venue.pricePerHour ?? 0;
  const hours = hoursBetween(startTime, endTime);
  let pricePerHour = basePrice;
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const rules = venue.pricingRules.filter((r) => {
    const meta = (r.metadata as Record<string, unknown>) || {};
    const ruleFacility = meta.facilityId as number | undefined;
    if (ruleFacility && ruleFacility !== facilityId) return false;
    if (r.ruleType === "weekend" && isWeekend) return true;
    if (r.ruleType === "base" || r.ruleType === "default") return true;
    return false;
  });
  const baseRule = rules.find((r) => r.ruleType === "base" || r.ruleType === "default");
  const weekendRule = rules.find((r) => r.ruleType === "weekend");
  if (weekendRule && isWeekend) {
    pricePerHour = weekendRule.ruleValue;
  } else if (baseRule) {
    pricePerHour = baseRule.ruleValue;
  }
  const subtotal = Math.round(pricePerHour * hours * 100) / 100;
  const gstRate = venue.gstRate ?? 18;
  const gstAmount = Math.round((subtotal * gstRate) / 100 * 100) / 100;
  const totalAmount = Math.round((subtotal + gstAmount) * 100) / 100;
  return { subtotal, gstRate, gstAmount, totalAmount };
}

router.get(
  "/",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ query: bookingListQuerySchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { page, limit, status } = req.query as unknown as z.infer<typeof bookingListQuerySchema>;
      const where: Record<string, unknown> = { userId: req.userId! };
      if (status) (where as { status: string }).status = status;
      const [bookings, total] = await Promise.all([
        prisma.booking.findMany({
          where,
          include: {
            venue: { select: { id: true, name: true, location: { select: { city: true, address: true } } } },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.booking.count({ where }),
      ]);
      res.json({ success: true, data: bookings, total, page, limit });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/check-availability",
  validate({ query: checkAvailabilityQuerySchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { facilityId, date } = req.query as unknown as z.infer<typeof checkAvailabilityQuerySchema>;
      const facility = await prisma.facility.findUnique({
        where: { id: facilityId },
        include: { venue: true },
      });
      if (!facility) throw new NotFoundError("Facility");
      // Use Booking table — single source of truth for availability (Slot table is legacy)
      const bookingDate = new Date(`${date}T00:00:00`);
      const bookedBookings = await prisma.booking.findMany({
        where: {
          facilityId,
          bookingDate,
          status: { in: ["confirmed", "fully_paid"] },
        },
        select: { startTime: true, endTime: true },
      });
      res.json({
        success: true,
        data: {
          facilityId,
          date,
          bookedSlots: bookedBookings.map((b) => ({
            startTime: b.startTime,
            endTime: b.endTime,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/estimate",
  validate({ query: estimateQuerySchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { facilityId, date, startTime, endTime } = req.query as unknown as z.infer<
        typeof estimateQuerySchema
      >;
      const facility = await prisma.facility.findUnique({
        where: { id: facilityId },
        include: { venue: true },
      });
      if (!facility) throw new NotFoundError("Facility");
      const price = await calculatePriceFromRules(
        facility.venueId,
        facilityId,
        date,
        startTime,
        endTime
      );
      res.json({
        success: true,
        data: {
          facilityId,
          date,
          startTime,
          endTime,
          hours: hoursBetween(startTime, endTime),
          ...price,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

const multiBookingSchema = z.object({
  venueId: z.number().int().positive(),
  sport: z.string(),
  facilityIds: z.array(z.number().int().positive()).min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  addOns: z
    .array(z.object({ addOnId: z.number().int().positive(), quantity: z.number().int().min(1).default(1) }))
    .optional(),
});

// Flexible batch: any combination of (facilityId, startTime, endTime) items
const batchBookingSchema = z.object({
  venueId: z.number().int().positive(),
  sport: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z
    .array(
      z.object({
        facilityId: z.number().int().positive(),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
      })
    )
    .min(1)
    .max(20),
});

const addAddOnSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
  quantity: z.number().int().min(1).default(1),
});

router.post(
  "/multi",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ body: multiBookingSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const body = req.body as z.infer<typeof multiBookingSchema>;

      // Shared time validation for all courts in the multi-booking
      const multiTimeCheck = await validateBookingTime(body.date, body.startTime, body.endTime);
      if (!multiTimeCheck.valid) throw new BadRequestError(multiTimeCheck.error!);

      const venue = await prisma.venue.findUnique({ where: { id: body.venueId } });
      if (!venue) throw new NotFoundError("Venue");
      const facilities = await prisma.facility.findMany({
        where: { id: { in: body.facilityIds }, venueId: body.venueId },
      });
      if (facilities.length !== body.facilityIds.length) throw new BadRequestError("Invalid facility IDs");

      const groupId = `multi-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const bookingDate = new Date(body.date);
      const hours = hoursBetween(body.startTime, body.endTime);

      // Compute pricing for all facilities before the transaction (avoids DB calls inside Serializable tx)
      const pricingByFacility = await Promise.all(
        facilities.map((f) =>
          calculatePriceFromRules(body.venueId, f.id, body.date, body.startTime, body.endTime).then(
            (p) => ({ facilityId: f.id, ...p })
          )
        )
      );
      const pricingMap = new Map(pricingByFacility.map((p) => [p.facilityId, p]));

      // Atomic transaction: conflict-check then create — prevents double-booking under concurrency
      const bookings = await prisma.$transaction(
        async (tx) => {
          const created: Awaited<ReturnType<typeof tx.booking.create>>[] = [];
          for (const facility of facilities) {
            const conflicting = await tx.booking.findFirst({
              where: {
                venueId: body.venueId,
                facilityId: facility.id,
                bookingDate,
                status: { notIn: ["cancelled", "cancelled_user", "cancelled_conflict", "cancelled_owner"] },
                AND: [
                  { startTime: { lt: body.endTime } },
                  { endTime: { gt: body.startTime } },
                ],
              },
            });
            if (conflicting) {
              throw new ConflictError(
                `Slot ${body.startTime}–${body.endTime} on ${facility.name} is already booked`
              );
            }

            const pricing = pricingMap.get(facility.id)!;
            const booking = await tx.booking.create({
              data: {
                userId: req.userId!,
                createdById: req.userId!,
                bookingType: "solo",
                venueId: body.venueId,
                sport: body.sport,
                facilityId: facility.id,
                facilityName: facility.name,
                facilitySurfaceType: facility.surfaceType,
                bookingDate,
                startTime: body.startTime,
                endTime: body.endTime,
                totalHours: hours,
                subtotal: pricing.subtotal,
                gstRate: pricing.gstRate,
                gstAmount: pricing.gstAmount,
                totalAmount: pricing.totalAmount,
                paymentStatus: "pending",
                status: "pending",
                groupId,
              },
            });
            created.push(booking);
          }
          return created;
        },
        { isolationLevel: "Serializable" }
      );

      if (body.addOns?.length) {
        const addOns = await prisma.venueAddOn.findMany({
          where: { id: { in: body.addOns.map((a) => a.addOnId) }, venueId: body.venueId },
        });
        for (const item of body.addOns) {
          const addOn = addOns.find((a) => a.id === item.addOnId);
          if (addOn) {
            await prisma.bookingAddOn.createMany({
              data: bookings.map((b) => ({
                bookingId: b.id,
                name: addOn.name,
                category: addOn.category,
                price: addOn.price,
                unit: addOn.unit,
                quantity: item.quantity,
                amount: addOn.price * item.quantity,
                purchasedBy: req.userId!,
              })),
            });
          }
        }
      }
      res.status(201).json({ success: true, data: bookings });
    } catch (err) {
      next(err);
    }
  }
);

// POST /batch — flexible multi-court + multi-slot booking
// Each item is an independent (facilityId, startTime, endTime) combination.
// All items share a groupId for easy retrieval.
router.post(
  "/batch",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ body: batchBookingSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const body = req.body as z.infer<typeof batchBookingSchema>;

      // Validate all item time windows before opening the transaction
      for (const item of body.items) {
        const itemTimeCheck = await validateBookingTime(body.date, item.startTime, item.endTime);
        if (!itemTimeCheck.valid) throw new BadRequestError(itemTimeCheck.error!);
      }

      const venue = await prisma.venue.findUnique({ where: { id: body.venueId } });
      if (!venue) throw new NotFoundError("Venue");

      const facilityIds = [...new Set(body.items.map((i) => i.facilityId))];
      const facilities = await prisma.facility.findMany({
        where: { id: { in: facilityIds }, venueId: body.venueId },
      });
      if (facilities.length !== facilityIds.length) {
        throw new BadRequestError("One or more facility IDs are invalid for this venue");
      }
      const facilityMap = new Map(facilities.map((f) => [f.id, f]));

      const groupId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const bookingDate = new Date(body.date);

      const bookings = await prisma.$transaction(
        async (tx) => {
          const created: Awaited<ReturnType<typeof tx.booking.create>>[] = [];

          for (const item of body.items) {
            const facility = facilityMap.get(item.facilityId)!;

            // Conflict check for this specific facility + time range
            const conflicting = await tx.booking.findFirst({
              where: {
                venueId: body.venueId,
                facilityId: item.facilityId,
                bookingDate,
                status: { notIn: ["cancelled", "cancelled_user", "cancelled_conflict"] },
                AND: [
                  { startTime: { lt: item.endTime } },
                  { endTime: { gt: item.startTime } },
                ],
              },
            });
            if (conflicting) {
              throw new ConflictError(
                `Slot ${item.startTime}–${item.endTime} on ${facility.name} is already booked`
              );
            }

            const { subtotal, gstRate, gstAmount, totalAmount } =
              await calculatePriceFromRules(
                body.venueId,
                item.facilityId,
                body.date,
                item.startTime,
                item.endTime
              );
            const hours = hoursBetween(item.startTime, item.endTime);

            const booking = await tx.booking.create({
              data: {
                userId: req.userId!,
                createdById: req.userId!,
                bookingType: "solo",
                venueId: body.venueId,
                sport: body.sport,
                facilityId: item.facilityId,
                facilityName: facility.name,
                facilitySurfaceType: facility.surfaceType,
                bookingDate,
                startTime: item.startTime,
                endTime: item.endTime,
                totalHours: hours,
                subtotal,
                gstRate,
                gstAmount,
                totalAmount,
                paymentStatus: "pending",
                status: "pending",
                groupId,
              },
            });
            created.push(booking);
          }

          return created;
        },
        { isolationLevel: "Serializable" }
      );

      const grandTotal = bookings.reduce((sum, b) => sum + b.totalAmount, 0);
      res.status(201).json({
        success: true,
        data: { bookings, groupId, totalAmount: Math.round(grandTotal * 100) / 100 },
      });
    } catch (err) {
      // Enrich conflict errors for batch bookings with next-available slot suggestions
      if (err instanceof ConflictError && !(err instanceof ConflictWithSuggestionsError)) {
        try {
          const b = req.body as any;
          const firstItem = Array.isArray(b?.items) ? b.items[0] : null;
          if (b?.venueId && firstItem?.facilityId && b?.date) {
            const suggestions = await getAvailableSlots(b.venueId, firstItem.facilityId, b.date);
            const available = suggestions.filter((s: { available: boolean }) => s.available).slice(0, 3);
            if (available.length > 0) {
              return next(new ConflictWithSuggestionsError(err.message, available));
            }
          }
        } catch { /* ignore */ }
      }
      next(err);
    }
  }
);

router.get(
  "/:id",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const booking = await prisma.booking.findUnique({
        where: { id },
        include: {
          venue: true,
          user: { select: { id: true, name: true, email: true, phone: true } },
          addOnPurchases: true,
          payments: true,
        },
      });
      if (!booking) throw new NotFoundError("Booking");

      const isOwner = booking.userId === req.userId;
      let isSplitParticipant = false;

      if (!isOwner && ["split", "open_play"].includes(booking.bookingType)) {
        const sp = await prisma.splitPayment.findFirst({
          where: { bookingId: id, userId: req.userId! },
          select: { id: true },
        });
        isSplitParticipant = !!sp;
      }

      const isVenueOwner = !!(await prisma.venue.findFirst({
        where: { id: booking.venueId, ownerId: req.userId! },
        select: { id: true },
      }));

      if (!isOwner && !isSplitParticipant && !isVenueOwner) throw new NotFoundError("Booking");

      const data: Record<string, unknown> = { ...booking };

      if (booking.bookingType === "split" || booking.bookingType === "open_play") {
        const splits = await prisma.splitPayment.findMany({
          where: { bookingId: id },
          include: { user: { select: { id: true, name: true, avatar: true } } },
          orderBy: { id: "asc" },
        });
        data.splitDetails = buildSplitDetailsPayload(
          {
            totalAmount: booking.totalAmount,
            paidAmount: booking.paidAmount,
            splitCount: (booking as { splitCount?: number | null }).splitCount ?? null,
            bookingType: booking.bookingType,
          },
          splits as SplitRow[]
        );
      }

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ body: bookingCreateSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const body = req.body as z.infer<typeof bookingCreateSchema>;
      const timeCheck = await validateBookingTime(body.bookingDate, body.startTime, body.endTime);
      if (!timeCheck.valid) throw new BadRequestError(timeCheck.error!);

      const facility = await prisma.facility.findUnique({
        where: { id: body.facilityId },
        include: { venue: true },
      });
      if (!facility) throw new NotFoundError("Facility");
      if (facility.venueId !== body.venueId) {
        throw new BadRequestError("Facility does not belong to this venue");
      }
      const bookingDate = new Date(body.bookingDate);
      const hours = hoursBetween(body.startTime, body.endTime);

      const { subtotal, gstRate, gstAmount, totalAmount } = await calculatePriceFromRules(
        body.venueId,
        body.facilityId,
        body.bookingDate,
        body.startTime,
        body.endTime
      );

      let addOnTotal = 0;
      const addOnPurchases: Array<{
        name: string;
        category: string | null;
        price: number;
        unit: string | null;
        quantity: number;
        amount: number;
        purchasedBy: number;
      }> = [];
      if (body.addOns && body.addOns.length > 0) {
        const addOns = await prisma.venueAddOn.findMany({
          where: {
            id: { in: body.addOns.map((a) => a.addOnId) },
            venueId: body.venueId,
          },
        });
        for (const item of body.addOns) {
          const addOn = addOns.find((a) => a.id === item.addOnId);
          if (addOn) {
            const amount = addOn.price * item.quantity;
            addOnTotal += amount;
            addOnPurchases.push({
              name: addOn.name,
              category: addOn.category,
              price: addOn.price,
              unit: addOn.unit,
              quantity: item.quantity,
              amount,
              purchasedBy: req.userId!,
            });
          }
        }
      }

      const finalSubtotal = subtotal + addOnTotal;
      const finalGst = (finalSubtotal * gstRate) / 100;
      const finalTotal = finalSubtotal + finalGst;

      const isSplit = body.bookingType === "split";
      const splitCount = isSplit ? body.splitCount! : null;

      const result = await prisma.$transaction(async (tx) => {
        const confirmedConflict = await tx.booking.findFirst({
          where: {
            venueId: body.venueId,
            facilityId: body.facilityId,
            bookingDate,
            status: { in: ["confirmed", "fully_paid"] },
            AND: [
              { startTime: { lt: body.endTime } },
              { endTime: { gt: body.startTime } },
            ],
          },
        });
        if (confirmedConflict) {
          throw new ConflictError("Time slot is already booked");
        }

        const created = await tx.booking.create({
          data: {
            userId: req.userId!,
            createdById: req.userId!,
            bookingType: body.bookingType,
            venueId: body.venueId,
            sport: body.sport,
            facilityId: body.facilityId,
            facilityName: facility.name,
            facilitySurfaceType: facility.surfaceType,
            bookingDate,
            startTime: body.startTime,
            endTime: body.endTime,
            totalHours: hours,
            subtotal: finalSubtotal,
            gstRate,
            gstAmount: finalGst,
            totalAmount: finalTotal,
            ...(splitCount != null ? { splitCount } : {}),
            paymentStatus: "pending",
            status: "pending",
          },
        });

        if (addOnPurchases.length > 0) {
          await tx.bookingAddOn.createMany({
            data: addOnPurchases.map((a) => ({
              ...a,
              bookingId: created.id,
            })),
          });
        }

        // For split bookings, create the creator's SplitPayment share
        let creatorSplitPayment = null;
        if (isSplit && splitCount) {
          const perPersonAmount = calculateSplitShare(finalTotal, splitCount, 0);
          creatorSplitPayment = await tx.splitPayment.create({
            data: {
              bookingId: created.id,
              userId: req.userId!,
              amount: perPersonAmount,
              status: "pending",
            },
          });
        }

        return { booking: created, creatorSplitPayment };
      }, { isolationLevel: "Serializable" });

      emitBookingEvent("booking:created", {
        bookingId: result.booking.id,
        venueId: result.booking.venueId,
        facilityId: result.booking.facilityId,
        status: result.booking.status,
      });

      const responseData: Record<string, unknown> = { ...result.booking };
      if (isSplit) {
        responseData.splitDetails = {
          splitCount,
          perPersonAmount: result.creatorSplitPayment?.amount ?? 0,
          paidCount: 0,
          joinedCount: 1,
        };
      }

      res.status(201).json({ success: true, data: responseData });
    } catch (err) {
      // Enrich conflict errors for solo bookings with next-available slot suggestions
      if (err instanceof ConflictError && !(err instanceof ConflictWithSuggestionsError)) {
        try {
          const b = req.body as any;
          if (b?.venueId && b?.facilityId && b?.bookingDate) {
            const dateStr = typeof b.bookingDate === "string" && b.bookingDate.includes("T")
              ? b.bookingDate.slice(0, 10)
              : String(b.bookingDate ?? "");
            const suggestions = await getAvailableSlots(b.venueId, b.facilityId, dateStr);
            const available = suggestions.filter((s) => s.available).slice(0, 3);
            if (available.length > 0) {
              return next(new ConflictWithSuggestionsError(err.message, available));
            }
          }
        } catch { /* ignore suggestion fetch errors */ }
      }
      next(err);
    }
  }
);

router.post(
  "/instant",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ body: instantBookingSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { facilityId, date, startTime, endTime } = req.body as z.infer<
        typeof instantBookingSchema
      >;
      const instantTimeCheck = await validateBookingTime(date, startTime, endTime);
      if (!instantTimeCheck.valid) throw new BadRequestError(instantTimeCheck.error!);

      const facility = await prisma.facility.findUnique({
        where: { id: facilityId },
        include: { venue: true },
      });
      if (!facility) throw new NotFoundError("Facility");
      const bookingDate = new Date(date);

      // Use Booking table as the single source of truth for conflict detection
      const conflicting = await prisma.booking.findFirst({
        where: {
          facilityId,
          venueId: facility.venueId,
          bookingDate,
          status: { in: ["confirmed", "fully_paid"] },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      });
      if (conflicting) {
        throw new ConflictError("Time slot is not available");
      }
      const { subtotal, gstRate, gstAmount, totalAmount } = await calculatePriceFromRules(
        facility.venueId,
        facilityId,
        date,
        startTime,
        endTime
      );
      const hours = hoursBetween(startTime, endTime);
      const booking = await prisma.booking.create({
        data: {
          userId: req.userId!,
          createdById: req.userId!,
          bookingType: "solo",
          venueId: facility.venueId,
          sport: (facility.sports as string[])?.[0] ?? "general",
          facilityId,
          facilityName: facility.name,
          facilitySurfaceType: facility.surfaceType,
          bookingDate,
          startTime,
          endTime,
          totalHours: hours,
          subtotal,
          gstRate,
          gstAmount,
          totalAmount,
          paymentStatus: "pending",
          status: "pending",
        },
      });

      emitBookingEvent("booking:created", {
        bookingId: booking.id,
        venueId: booking.venueId,
        facilityId: booking.facilityId,
        status: booking.status,
      });

      res.status(201).json({ success: true, data: booking });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Split Booking Endpoints ────────────────────────────────────────────────

// GET /:id/split-status — Accessible to any authenticated user (for share links)
router.get(
  "/:id/split-status",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const booking = await prisma.booking.findUnique({
        where: { id },
        include: {
          venue: { select: { id: true, name: true, location: { select: { city: true, address: true } } } },
        },
      });
      if (!booking) throw new NotFoundError("Booking");
      if (booking.bookingType !== "split") {
        throw new BadRequestError("This booking is not a split booking");
      }

      const splits = await prisma.splitPayment.findMany({
        where: { bookingId: id },
        include: { user: { select: { id: true, name: true, avatar: true } } },
        orderBy: { id: "asc" },
      });

      const currentUserSplit = splits.find((s) => s.userId === req.userId);
      const progress = splitPaymentProgressMeta(booking.totalAmount, booking.paidAmount);

      res.json({
        success: true,
        data: {
          bookingId: booking.id,
          venue: booking.venue,
          sport: booking.sport,
          facilityName: booking.facilityName,
          bookingDate: booking.bookingDate,
          startTime: booking.startTime,
          endTime: booking.endTime,
          totalAmount: booking.totalAmount,
          paidAmount: booking.paidAmount,
          status: booking.status,
          splitCount: (booking as { splitCount?: number | null }).splitCount ?? null,
          perPersonAmount: splits[0]?.amount ?? 0,
          joinedCount: splits.length,
          paidCount: splits.filter((s) => s.status === "paid").length,
          pendingCount: splits.filter((s) => s.status === "pending").length,
          currentUserStatus: currentUserSplit?.status ?? "not_joined",
          ...progress,
          participants: splits.map((s) => ({
            userId: s.userId,
            name: s.user?.name ?? null,
            avatar: s.user?.avatar ?? null,
            amount: s.amount,
            status: s.status,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /:id/split/join — Add current user as a split participant
router.post(
  "/:id/split/join",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const userId = req.userId!;

      const booking = await prisma.booking.findUnique({ where: { id } });
      if (!booking) throw new NotFoundError("Booking");
      if (booking.bookingType !== "split") {
        throw new BadRequestError("This booking is not a split booking");
      }
      if (["cancelled", "cancelled_user", "cancelled_conflict"].includes(booking.status)) {
        throw new BadRequestError("This booking has been cancelled");
      }

      const existingSplit = await prisma.splitPayment.findFirst({
        where: { bookingId: id, userId },
      });
      if (existingSplit) {
        if (existingSplit.status === "cancelled") {
          // Re-activate a previously cancelled split
          await prisma.splitPayment.update({
            where: { id: existingSplit.id },
            data: { status: "pending", razorpayOrderId: null, razorpayPaymentId: null },
          });
          return res.json({
            success: true,
            message: "Rejoined split booking",
            data: {
              splitPaymentId: existingSplit.id,
              amount: existingSplit.amount,
              bookingId: id,
            },
          });
        }
        throw new ConflictError("You have already joined this booking");
      }

      // Check capacity
      const joinedCount = await prisma.splitPayment.count({
        where: { bookingId: id, status: { not: "cancelled" } },
      });
      const cap = (booking as { splitCount?: number | null }).splitCount;
      if (cap && joinedCount >= cap) {
        throw new ConflictError("All split slots are taken");
      }

      // Determine per-person amount from existing splits
      const firstSplit = await prisma.splitPayment.findFirst({
        where: { bookingId: id },
        orderBy: { id: "asc" },
      });
      const perPersonAmount = firstSplit?.amount ??
        calculateSplitShare(booking.totalAmount, cap ?? 2, joinedCount);

      const splitPayment = await prisma.splitPayment.create({
        data: {
          bookingId: id,
          userId,
          amount: perPersonAmount,
          status: "pending",
        },
      });

      // Notify the booking creator that someone joined (non-blocking)
      if (booking.userId !== userId) {
        const paidCount = await prisma.splitPayment.count({
          where: { bookingId: id, status: { not: "cancelled" } },
        });
        void createNotification(
          booking.userId,
          NotifType.SPLIT_PARTICIPANT_JOINED,
          "Someone joined your split",
          `A new participant joined your split booking (${paidCount}/${cap ?? "?"} slots filled).`,
          { bookingId: id }
        );
      }

      res.json({
        success: true,
        message: "Joined split booking",
        data: {
          splitPaymentId: splitPayment.id,
          amount: perPersonAmount,
          bookingId: id,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /:id/split/leave — Current user cancels their split share
router.post(
  "/:id/split/leave",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const userId = req.userId!;

      const booking = await prisma.booking.findUnique({ where: { id } });
      if (!booking) throw new NotFoundError("Booking");
      if (booking.bookingType !== "split") {
        throw new BadRequestError("This booking is not a split booking");
      }

      // The booking creator cannot leave — they must cancel the entire booking
      if (booking.userId === userId) {
        throw new BadRequestError("Booking creator cannot leave — cancel the booking instead");
      }

      const splitPayment = await prisma.splitPayment.findFirst({
        where: { bookingId: id, userId },
      });
      if (!splitPayment) throw new NotFoundError("You are not part of this booking");
      if (splitPayment.status === "cancelled") {
        throw new BadRequestError("You have already left this booking");
      }

      if (splitPayment.status === "paid" && splitPayment.razorpayPaymentId) {
        // Refund the paid share, then mark as cancelled
        const policy = calculateRefundPolicy(booking.bookingDate, new Date());
        const refundAmount = (splitPayment.amount * policy.refundPercentage) / 100;
        const platformFee = (splitPayment.amount * policy.platformFeePercentage) / 100;
        const netRefund = refundAmount - platformFee;

        if (netRefund > 0) {
          await prisma.refund.create({
            data: {
              bookingId: id,
              userId,
              amountPaid: splitPayment.amount,
              amountRefunded: netRefund,
              platformFee,
              reason: "user_cancelled",
              razorpayPaymentId: splitPayment.razorpayPaymentId,
              status: "pending",
            },
          });
          await addRefundJob({
            bookingId: id,
            userId,
            amount: netRefund,
            razorpayPaymentId: splitPayment.razorpayPaymentId,
            reason: "user_cancelled",
          });
        }

        // Decrement the booking's paidAmount
        await prisma.booking.update({
          where: { id },
          data: { paidAmount: { decrement: splitPayment.amount } },
        });

        await prisma.splitPayment.update({
          where: { id: splitPayment.id },
          data: { status: "cancelled" },
        });

        // Notify the booking creator that a participant left (non-blocking)
        void createNotification(
          booking.userId,
          NotifType.SPLIT_PARTICIPANT_LEFT,
          "A participant left your split",
          "A participant has left your split booking. You may want to find a replacement.",
          { bookingId: id }
        );

        res.json({
          success: true,
          message: "Left split booking. Refund initiated.",
          data: { refundAmount: netRefund, platformFee },
        });
      } else {
        // Pending — just cancel the split payment
        await prisma.splitPayment.update({
          where: { id: splitPayment.id },
          data: { status: "cancelled" },
        });

        // Notify the booking creator (non-blocking)
        void createNotification(
          booking.userId,
          NotifType.SPLIT_PARTICIPANT_LEFT,
          "A participant left your split",
          "A participant has left your split booking. You may want to find a replacement.",
          { bookingId: id }
        );

        res.json({
          success: true,
          message: "Left split booking",
          data: { refundAmount: 0, platformFee: 0 },
        });
      }
    } catch (err) {
      next(err);
    }
  }
);

// ─── Cancel Booking ─────────────────────────────────────────────────────────

router.post(
  "/:id/cancel",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const booking = await prisma.booking.findFirst({
        where: { id, userId: req.userId! },
      });
      if (!booking) throw new NotFoundError("Booking");
      if (["cancelled", "cancelled_user", "cancelled_conflict"].includes(booking.status)) {
        throw new BadRequestError("Booking is already cancelled");
      }

      if (booking.bookingType === "split") {
        // For split bookings, refund each payer individually
        const refundResult = await initiateSplitBookingRefund(booking);

        emitBookingEvent("booking:cancelled", {
          bookingId: booking.id,
          venueId: booking.venueId,
          facilityId: booking.facilityId,
          status: "cancelled_user",
        });

        return res.json({
          success: true,
          message: "Split booking cancelled. Refunds initiated for all payers.",
          data: refundResult,
        });
      }

      const refundResult = await initiateRefund({
        bookingId: booking.id,
        userId: req.userId!,
        reason: "user_cancelled",
      });

      emitBookingEvent("booking:cancelled", {
        bookingId: booking.id,
        venueId: booking.venueId,
        facilityId: booking.facilityId,
        status: "cancelled_user",
      });

      res.json({
        success: true,
        message: "Booking cancelled",
        data: {
          refundAmount: refundResult.refundAmount,
          platformFee: refundResult.platformFee,
          refundMessage: refundResult.message,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/:id/add-ons",
  jwtCheck, attachUser, requireAuth,
  validate({ params: idParamSchema, body: addAddOnSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const { name, price, quantity } = req.body as z.infer<typeof addAddOnSchema>;
      const booking = await prisma.booking.findUnique({ where: { id } });
      if (!booking) throw new NotFoundError("Booking");
      if (booking.userId !== req.userId) throw new BadRequestError("Not your booking");
      const amount = price * quantity;
      const addOn = await prisma.bookingAddOn.create({
        data: { bookingId: id, name, price, quantity, amount, purchasedBy: req.userId! },
      });
      await prisma.booking.update({
        where: { id },
        data: { totalAmount: { increment: amount }, subtotal: { increment: amount } },
      });
      res.json({ success: true, data: addOn });
    } catch (err) { next(err); }
  }
);

// ─── Owner: cancel a booking on behalf of venue ───────────────────────────────
router.post(
  "/:id/owner-cancel",
  jwtCheck, attachUser, requireAuth,
  validate({ params: idParamSchema, body: z.object({ reason: z.string().optional() }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const userId = req.userId!;
      const { reason } = req.body as { reason?: string };

      const booking = await prisma.booking.findUnique({
        where: { id },
        include: { venue: { select: { ownerId: true } } },
      });
      if (!booking) throw new NotFoundError("Booking");
      if (booking.venue.ownerId !== userId) throw new ForbiddenError("You do not own this venue");
      if (["cancelled", "cancelled_user", "cancelled_conflict", "cancelled_owner"].includes(booking.status)) {
        throw new BadRequestError("Booking is already cancelled");
      }

      await prisma.booking.update({
        where: { id },
        data: { status: "cancelled_owner" },
      });

      // Log activity with reason (non-critical; ignore schema mismatches)
      await prisma.activity.create({
        data: {
          type: "owner_cancel",
          sport: booking.sport ?? "unknown",
          venueId: booking.venueId,
          bookingId: id,
          createdById: userId,
          status: reason ? `cancelled: ${reason.slice(0, 17)}` : "cancelled_owner",
        },
      }).catch(() => { /* non-critical */ });

      // Refund if payment was made
      if (booking.paidAmount > 0 && booking.razorpayPaymentId) {
        const refundResult = await initiateRefund({
          bookingId: id,
          userId: booking.userId,
          reason: "venue_cancelled",
        });
        emitBookingEvent("booking:cancelled", {
          bookingId: id,
          venueId: booking.venueId,
          facilityId: booking.facilityId,
          status: "cancelled_owner",
        });

        // Notify booking owner that the venue cancelled (non-blocking)
        void createNotification(
          booking.userId,
          NotifType.BOOKING_CANCELLED_OWNER,
          "Booking cancelled by venue",
          `Your booking on ${new Date(booking.bookingDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} was cancelled by the venue. A refund has been initiated.`,
          { bookingId: id, venueId: booking.venueId }
        );

        return res.json({ success: true, message: "Booking cancelled by owner. Refund initiated.", data: refundResult });
      }

      emitBookingEvent("booking:cancelled", {
        bookingId: id,
        venueId: booking.venueId,
        facilityId: booking.facilityId,
        status: "cancelled_owner",
      });

      // Notify booking owner (no refund case) (non-blocking)
      void createNotification(
        booking.userId,
        NotifType.BOOKING_CANCELLED_OWNER,
        "Booking cancelled by venue",
        `Your booking on ${new Date(booking.bookingDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} was cancelled by the venue.`,
        { bookingId: id, venueId: booking.venueId }
      );

      res.json({ success: true, message: "Booking cancelled by owner." });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Owner: force-confirm a pending booking ───────────────────────────────────
router.post(
  "/:id/owner-confirm",
  jwtCheck, attachUser, requireAuth,
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const userId = req.userId!;

      const booking = await prisma.booking.findUnique({
        where: { id },
        include: { venue: { select: { ownerId: true } } },
      });
      if (!booking) throw new NotFoundError("Booking");
      if (booking.venue.ownerId !== userId) throw new ForbiddenError("You do not own this venue");
      if (!["pending", "pending_open_play"].includes(booking.status)) {
        throw new BadRequestError("Only pending bookings can be force-confirmed");
      }

      await prisma.booking.update({
        where: { id },
        data: { status: "confirmed" },
      });

      emitBookingEvent("booking:confirmed", {
        bookingId: id,
        venueId: booking.venueId,
        facilityId: booking.facilityId,
        status: "confirmed",
      });

      // Notify booking owner (non-blocking)
      void createNotification(
        booking.userId,
        NotifType.BOOKING_CONFIRMED,
        "Booking confirmed",
        `Your booking at the venue on ${new Date(booking.bookingDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} (${booking.startTime}–${booking.endTime}) is confirmed.`,
        { bookingId: id, venueId: booking.venueId }
      );

      res.json({ success: true, message: "Booking confirmed by owner." });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Owner: manual walk-in booking ───────────────────────────────────────────
const manualBookingSchema = z.object({
  venueId:       z.number().int().positive(),
  facilityId:    z.number().int().positive(),
  date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime:     z.string().regex(/^\d{2}:\d{2}$/),
  endTime:       z.string().regex(/^\d{2}:\d{2}$/),
  sport:         z.string().min(1),
  customerName:  z.string().min(1),
  customerPhone: z.string().optional(),
  paymentMethod: z.enum(["cash", "upi", "card"]).default("cash"),
  amount:        z.number().positive().optional(),
});

router.post(
  "/manual",
  jwtCheck, attachUser, requireAuth,
  validate({ body: manualBookingSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as z.infer<typeof manualBookingSchema>;
      const userId = req.userId!;

      const manualTimeCheck = await validateBookingTime(body.date, body.startTime, body.endTime);
      if (!manualTimeCheck.valid) throw new BadRequestError(manualTimeCheck.error!);

      // Verify venue ownership
      const venue = await prisma.venue.findFirst({
        where: { id: body.venueId, ownerId: userId },
        select: { id: true, commissionPercent: true, gstRate: true },
      });
      if (!venue) throw new ForbiddenError("You do not own this venue");

      const facility = await prisma.facility.findFirst({
        where: { id: body.facilityId, venueId: body.venueId },
        select: { id: true, name: true, surfaceType: true },
      });
      if (!facility) throw new NotFoundError("Facility");

      const bookingDate = new Date(body.date + "T00:00:00.000Z");

      // Conflict check
      const conflict = await prisma.booking.findFirst({
        where: {
          venueId: body.venueId,
          facilityId: body.facilityId,
          bookingDate,
          status: { notIn: ["cancelled", "cancelled_user", "cancelled_conflict", "cancelled_owner"] },
          startTime: { lt: body.endTime },
          endTime:   { gt: body.startTime },
        },
      });
      if (conflict) throw new ConflictError("This slot is already booked");

      // Compute hours
      const [sh, sm] = body.startTime.split(":").map(Number);
      const [eh, em] = body.endTime.split(":").map(Number);
      const totalHours = (eh * 60 + em - (sh * 60 + sm)) / 60;

      const totalAmount = body.amount ?? 0;
      const commissionPct = venue.commissionPercent ?? 0;
      const commissionAmount = totalAmount * (commissionPct / 100);
      const venueNetAmount = totalAmount - commissionAmount;
      const gstAmount = totalAmount * ((venue.gstRate ?? 0) / 100);

      // Create a "system" user record note in customerName field using notes workaround
      // The booking is created for the owner's userId (createdById) with customerName in facilityName note
      const booking = await prisma.booking.create({
        data: {
          userId,
          createdById: userId,
          bookingType: "solo",
          venueId: body.venueId,
          sport: body.sport,
          facilityId: body.facilityId,
          facilityName: `${facility.name} (Walk-in: ${body.customerName})`,
          facilitySurfaceType: facility.surfaceType ?? undefined,
          bookingDate,
          startTime: body.startTime,
          endTime: body.endTime,
          totalHours,
          subtotal: totalAmount,
          gstRate: venue.gstRate ?? 0,
          gstAmount,
          totalAmount,
          platformCommissionPercent: commissionPct,
          platformCommissionAmount: commissionAmount,
          venueNetAmount,
          paymentType: "full",
          paidAmount: totalAmount,
          paymentStatus: "completed",
          status: "confirmed",
        },
      });

      // Create a BookingPayment record for offline tracking
      await prisma.bookingPayment.create({
        data: {
          bookingId: booking.id,
          userId,
          amount: totalAmount,
          paymentMethod: body.paymentMethod,
          status: "paid",
        },
      });

      emitBookingEvent("booking:confirmed", {
        bookingId: booking.id,
        venueId: body.venueId,
        facilityId: body.facilityId,
        status: "confirmed",
      });

      res.status(201).json({
        success: true,
        message: "Walk-in booking recorded",
        data: { bookingId: booking.id },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
