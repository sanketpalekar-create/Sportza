import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { registry } from "../lib/openapi";
import { validate } from "../middleware/validate";
import { jwtCheck, attachUser, requireAuth } from "../middleware/auth";
import { NotFoundError, BadRequestError, ConflictError } from "../lib/errors";
import { idParamSchema, paginationSchema } from "../schemas/common";
import { emitOpenPlayEvent } from "../lib/socket";
import { checkConfirmationThreshold, handleCreatorCancel, lockAndSettle } from "../services/openPlayConfirmations";
import { recordOpenPlayConnection } from "../services/connections";
import { getVenueSlotQuote, roundMoney } from "../services/slotPricing";
import { createNotification, createBulkNotifications, NotifType } from "../services/notificationService";

const router: Router = Router();

// ─── Schemas ─────────────────────────────────────────────────────────────────

const listQuerySchema = paginationSchema.extend({
  sport: z.string().optional(),
  status: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  venueId: z.coerce.number().int().positive().optional(),
  upcoming: z.coerce.boolean().optional().default(true),
});

const createOpenPlaySchema = z.object({
  venueId: z.number().int().positive(),
  sport: z.string().min(1),
  formatName: z.string().min(1),
  playersPerTeam: z.number().int().positive(),
  maxPlayers: z.number().int().positive(),
  minimumPlayers: z.number().int().positive().optional(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  facilityId: z.number().int().positive(),
  facilityName: z.string().min(1),
  title: z.string().optional(),
  pricePerPlayer: z.number().min(0).optional().default(0),
  skillLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  notes: z.string().optional(),
  joinDeadlineAt: z.string().datetime().optional(),
});

const statusUpdateSchema = z.object({
  status: z.enum(["open", "full", "cancelled", "completed"]),
});

const patchOpenPlaySchema = z.object({
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  maxPlayers: z.number().int().positive().optional(),
  title: z.string().optional(),
  skillLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  notes: z.string().optional(),
  pricePerPlayer: z.number().min(0).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "No fields to update" });

const playerUserIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  userId: z.coerce.number().int().positive(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isPastSlot(bookingDate: string, endTime?: string): boolean {
  const now = new Date();
  // Use UTC date string from bookingDate to avoid timezone shifts
  const dateStr = bookingDate.slice(0, 10); // "YYYY-MM-DD"

  if (endTime) {
    const [h, m] = endTime.split(":").map(Number);
    // Compare as UTC (consistent with how bookingDate is stored as midnight UTC)
    const slotEndUTC = new Date(`${dateStr}T${String(h).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}:00Z`);
    // Give a 30-minute grace period after end time
    const gracePeriodMs = 30 * 60 * 1000;
    return now.getTime() > slotEndUTC.getTime() + gracePeriodMs;
  }
  return now > new Date(`${dateStr}T23:59:59Z`);
}

// ─── GET / — List open plays ─────────────────────────────────────────────────

router.get(
  "/",
  validate({ query: listQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sport, status, date, venueId, upcoming } = req.query as unknown as z.infer<typeof listQuerySchema>;
      const where: Record<string, unknown> = {};

      if (sport) where.sport = sport;
      if (status) where.status = status;
      if (venueId) where.venueId = venueId;
      if (date) {
        where.bookingDate = new Date(date + "T00:00:00.000Z");
      } else if (upcoming !== false) {
        // Default: only show sessions from today onwards (don't show old past sessions)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        where.bookingDate = { gte: today };
      }
      // Default to only open sessions when no explicit status filter given
      if (!status) where.status = { in: ["open", "full"] };

      const [items, total] = await Promise.all([
        prisma.openPlay.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { bookingDate: "asc" },
          include: {
            venue: { select: { id: true, name: true, location: { select: { city: true } } } },
            createdBy: { select: { id: true, name: true } },
            _count: { select: { players: true } },
          },
        }),
        prisma.openPlay.count({ where }),
      ]);

      res.json({ success: true, data: items, meta: { total, page, limit } });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /:id — Detail ──────────────────────────────────────────────────────

router.get(
  "/:id",
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;

      const openPlay = await prisma.openPlay.findUnique({
        where: { id },
        include: {
          booking: true,
          venue: true,
          createdBy: { select: { id: true, name: true } },
          players: { include: { user: { select: { id: true, name: true, avatar: true } } } },
        },
      });

      if (!openPlay) throw new NotFoundError("Open play");
      res.json({ success: true, data: openPlay });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST / — Create open play + booking + auto-add host as player ──────────

router.post(
  "/",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ body: createOpenPlaySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const body = req.body as z.infer<typeof createOpenPlaySchema>;

      // Prevent creating sessions in the past
      if (isPastSlot(body.bookingDate, body.endTime)) {
        throw new BadRequestError("Cannot create a session for a past time slot");
      }

      const slotQuote = await getVenueSlotQuote({
        venueId: body.venueId,
        facilityId: body.facilityId,
        date: body.bookingDate,
        startTime: body.startTime,
        endTime: body.endTime,
        sport: body.sport,
      });

      const minimumPlayers = body.minimumPlayers ?? Math.max(2, Math.ceil(body.maxPlayers * 0.5));
      const hostProtectionAmount = roundMoney(slotQuote.totalAmount * 0.5);
      // Price per player shown before lock = total / maxPlayers (best case)
      const computedPricePerPlayer = body.maxPlayers > 0
        ? roundMoney(slotQuote.totalAmount / body.maxPlayers)
        : 0;

      // Default join deadline: noon on the booking date itself (24h window typical)
      const defaultDeadline = (() => {
        const d = new Date(body.bookingDate + "T00:00:00.000Z");
        d.setUTCHours(12, 0, 0, 0); // noon UTC on booking date
        return d;
      })();
      const joinDeadlineAt = body.joinDeadlineAt ? new Date(body.joinDeadlineAt) : defaultDeadline;

      // Transaction: create booking + open play + auto-add host as first player
      const result = await prisma.$transaction(async (tx) => {
        const booking = await tx.booking.create({
          data: {
            userId,
            createdById: userId,
            bookingType: "open_play",
            status: "pending_open_play",
            venueId: slotQuote.venueId,
            sport: body.sport,
            facilityId: slotQuote.facilityId,
            facilityName: slotQuote.facilityName,
            bookingDate: new Date(body.bookingDate + "T00:00:00.000Z"),
            startTime: body.startTime,
            endTime: body.endTime,
            totalHours: slotQuote.totalHours,
            subtotal: slotQuote.subtotal,
            gstRate: slotQuote.gstRate,
            gstAmount: slotQuote.gstAmount,
            totalAmount: slotQuote.totalAmount,
            venueNetAmount: slotQuote.subtotal,
          },
        });

        const openPlay = await (tx as any).openPlay.create({
          data: {
            bookingId: booking.id,
            venueId: slotQuote.venueId,
            sport: body.sport,
            formatName: body.formatName,
            playersPerTeam: body.playersPerTeam,
            maxPlayers: body.maxPlayers,
            minimumPlayers,
            createdById: userId,
            facilityId: slotQuote.facilityId,
            facilityName: slotQuote.facilityName,
            title: body.title,
            bookingDate: new Date(body.bookingDate + "T00:00:00.000Z"),
            startTime: body.startTime,
            endTime: body.endTime,
            pricePerPlayer: computedPricePerPlayer,
            skillLevel: body.skillLevel,
            notes: body.notes,
            joinDeadlineAt,
            hostProtectionAmount,
            hostProtectionStatus: "pending",
          },
        });

        // Create host protection SplitPayment (50% of total slot cost)
        await tx.splitPayment.create({
          data: {
            bookingId: booking.id,
            userId,
            amount: hostProtectionAmount,
            status: "pending",
            splitType: "host_protection",
          } as any,
        });

        // Auto-add creator as the first player
        await tx.openPlayPlayer.create({
          data: { openPlayId: openPlay.id, userId },
        });

        // Create Activity record for this open play session
        const actDate = new Date(body.bookingDate + "T00:00:00.000Z");
        const activity = await tx.activity.create({
          data: {
            type: "open_play",
            sport: body.sport,
            venueId: slotQuote.venueId,
            facilityId: slotQuote.facilityId,
            bookingId: booking.id,
            createdById: userId,
            startTime: new Date(`${body.bookingDate}T${body.startTime}:00.000Z`),
            endTime: body.endTime ? new Date(`${body.bookingDate}T${body.endTime}:00.000Z`) : null,
            date: actDate,
            status: "scheduled",
          },
        });

        // Add host as participant in the activity
        await tx.participation.create({
          data: { activityId: activity.id, userId, role: "player" },
        });

        // If maxPlayers is 1, auto-mark as full
        if (body.maxPlayers <= 1) {
          await tx.openPlay.update({
            where: { id: openPlay.id },
            data: { status: "full" },
          });
        }

        return { booking, openPlay };
      });

      const fullOpenPlay = await (prisma as any).openPlay.findUnique({
        where: { id: result.openPlay.id },
        include: {
          booking: true,
          venue: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          players: { include: { user: { select: { id: true, name: true } } } },
        },
      });

      res.status(201).json({
        success: true,
        data: fullOpenPlay,
        meta: {
          hostProtectionAmount,
          minimumPlayers,
          joinDeadlineAt,
          priceRangeLow: roundMoney(slotQuote.totalAmount / body.maxPlayers),
          priceRangeHigh: roundMoney(slotQuote.totalAmount / minimumPlayers),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /:id/join — Join (with auto full + validations) ───────────────────

router.post(
  "/:id/join",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const userId = req.userId!;

      // Validate first, then use a transaction for the write — avoids MySQL Serializable deadlocks
      const openPlay = await prisma.openPlay.findUnique({
        where: { id },
        include: { _count: { select: { players: true } } },
      });

      if (!openPlay) throw new NotFoundError("Open play");
      if (openPlay.status !== "open") throw new BadRequestError("Session is not accepting players");
      if (openPlay._count.players >= openPlay.maxPlayers) throw new ConflictError("Session is full");

      const dateStr = openPlay.bookingDate.toISOString().slice(0, 10);
      if (isPastSlot(dateStr, openPlay.endTime ?? undefined)) {
        throw new BadRequestError("This session has already ended");
      }

      const existing = await prisma.openPlayPlayer.findUnique({
        where: { openPlayId_userId: { openPlayId: id, userId } },
      });
      if (existing) throw new ConflictError("You have already joined this session");

      // Skill rating gate — check if the open play has explicit rating bounds
      if (openPlay.skillRatingMin !== null && openPlay.skillRatingMax !== null && openPlay.sportId) {
        const myRating = await prisma.sportSkillRating.findUnique({
          where: { userId_sportId_formatName: { userId, sportId: openPlay.sportId, formatName: "overall" } },
        });
        const rating = myRating?.rating ?? 1000;
        if (rating < openPlay.skillRatingMin! || rating > openPlay.skillRatingMax!) {
          throw new BadRequestError(
            `Your Sportza Rating (${rating}) is outside the allowed range for this session (${openPlay.skillRatingMin}–${openPlay.skillRatingMax})`
          );
        }
      }

      // Write in a transaction with row-level locking via updateMany (atomic count check)
      const result = await prisma.$transaction(async (tx) => {
        // Lock the row and recheck player count atomically
        const current = await tx.openPlay.findUnique({
          where: { id },
          include: { _count: { select: { players: true } } },
        });
        if (!current || current._count.players >= current.maxPlayers) {
          throw new ConflictError("Session is full");
        }

        await tx.openPlayPlayer.create({ data: { openPlayId: id, userId } });

        // Link to Activity if one exists for this open play
        try {
          const activity = await tx.activity.findFirst({
            where: { bookingId: openPlay.bookingId, type: "open_play" },
          });
          if (activity) {
            await tx.participation.create({
              data: { activityId: activity.id, userId, role: "player" },
            });
          }
        } catch {
          // Non-critical — don't fail the join if Activity wiring fails
        }

        const newCount = current._count.players + 1;
        if (newCount >= current.maxPlayers) {
          await tx.openPlay.update({ where: { id }, data: { status: "full" } });
          // Notify host that the session is full (non-blocking, outside tx context)
          setImmediate(() => {
            void createNotification(
              current.createdById,
              NotifType.OPEN_PLAY_SESSION_FULL,
              "Your session is full!",
              `All ${current.maxPlayers} spots for your open play session are now taken.`,
              { openPlayId: id }
            );
          });
        }

        // For paid sessions, create a SplitPayment record for this player
        let splitPaymentId: number | undefined;
        if (openPlay.pricePerPlayer && openPlay.pricePerPlayer > 0 && openPlay.bookingId) {
          const sp = await tx.splitPayment.create({
            data: {
              bookingId: openPlay.bookingId,
              userId,
              amount: openPlay.pricePerPlayer,
              status: "pending",
            },
          });
          splitPaymentId = sp.id;
        }

        return {
          newCount,
          maxPlayers: current.maxPlayers,
          isFull: newCount >= current.maxPlayers,
          splitPaymentId,
        };
      });

      emitOpenPlayEvent("openplay:joined", {
        openPlayId: id,
        userId,
        playerCount: result.newCount,
      });

      // Non-blocking: record player network connections
      recordOpenPlayConnection(id, userId).catch(() => {});

      // Notify session host when a new player joins (non-blocking)
      if (openPlay.createdById !== userId) {
        const joiner = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        });
        void createNotification(
          openPlay.createdById,
          NotifType.OPEN_PLAY_PLAYER_JOINED,
          "New player joined your session",
          `${joiner?.name ?? "A player"} joined your open play (${result.newCount}/${openPlay.maxPlayers} players).`,
          { openPlayId: id, playerId: userId, playerCount: result.newCount }
        );
      }


      const requiresPayment = !!(
        openPlay.pricePerPlayer &&
        openPlay.pricePerPlayer > 0 &&
        openPlay.bookingId
      );

      res.json({
        success: true,
        message: "Joined open play",
        data: {
          ...result,
          requiresPayment,
          bookingId: requiresPayment ? openPlay.bookingId : undefined,
          amount: requiresPayment ? openPlay.pricePerPlayer : undefined,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /:id/leave — Leave (with auto reopen + creator block) ─────────────

router.post(
  "/:id/leave",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const userId = req.userId!;

      const openPlay = await prisma.openPlay.findUnique({
        where: { id },
        include: { _count: { select: { players: true } } },
      });

      if (!openPlay) throw new NotFoundError("Open play");

      // Prevent creator from leaving their own session
      if (openPlay.createdById === userId) {
        throw new BadRequestError("Host cannot leave — cancel the session instead");
      }

      const deleted = await prisma.openPlayPlayer.deleteMany({
        where: { openPlayId: id, userId },
      });
      if (deleted.count === 0) throw new NotFoundError("You are not in this session");

      // Also remove Participation for the associated Activity
      const activity = await prisma.activity.findFirst({
        where: { bookingId: openPlay.bookingId, type: "open_play" },
      });
      if (activity) {
        await prisma.participation.deleteMany({
          where: { activityId: activity.id, userId },
        });
      }

      if (openPlay.status === "full") {
        await prisma.openPlay.update({
          where: { id },
          data: { status: "open" },
        });
      }

      const newCount = openPlay._count.players - 1;

      emitOpenPlayEvent("openplay:left", {
        openPlayId: id,
        userId,
        playerCount: newCount,
      });

      res.json({
        success: true,
        message: "Left open play",
        data: { playerCount: newCount, maxPlayers: openPlay.maxPlayers },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PUT /:id/status — Creator-only status update ───────────────────────────

router.put(
  "/:id/status",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema, body: statusUpdateSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const { status } = req.body as z.infer<typeof statusUpdateSchema>;
      const userId = req.userId!;

      const openPlay = await prisma.openPlay.findUnique({ where: { id } });
      if (!openPlay) throw new NotFoundError("Open play");
      if (openPlay.createdById !== userId) throw new BadRequestError("Only the creator can update status");

      if (status === "cancelled") {
        const result = await handleCreatorCancel(id, userId);

        // Notify all joined players about the cancellation (non-blocking)
        const joined = await prisma.openPlayPlayer.findMany({
          where: { openPlayId: id },
          select: { userId: true },
        });
        const playerIds = joined.map((p) => p.userId).filter((pid) => pid !== userId);
        if (playerIds.length > 0) {
          void createBulkNotifications(
            playerIds,
            NotifType.OPEN_PLAY_CANCELLED,
            "Session cancelled",
            `The open play session you joined has been cancelled by the host. Any paid amount will be refunded.`,
            { openPlayId: id }
          );
        }

        return res.json({ success: true, message: "Session cancelled. Refunds initiated with 5% creator fee.", data: result });
      }

      const updated = await prisma.openPlay.update({
        where: { id },
        data: { status },
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /:id — Update open play details (creator only) ───────────────────

router.patch(
  "/:id",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema, body: patchOpenPlaySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const body = req.body as z.infer<typeof patchOpenPlaySchema>;
      const userId = req.userId!;

      const openPlay = await prisma.openPlay.findUnique({ where: { id } });
      if (!openPlay) throw new NotFoundError("Open play");
      if (openPlay.createdById !== userId) throw new BadRequestError("Only the creator can edit this session");
      if (openPlay.status === "cancelled") throw new BadRequestError("Cannot edit a cancelled session");

      const data: Record<string, unknown> = {};
      if (body.bookingDate)     data.bookingDate = new Date(body.bookingDate + "T00:00:00.000Z");
      if (body.startTime)       data.startTime = body.startTime;
      if (body.endTime)         data.endTime = body.endTime;
      if (body.maxPlayers)      data.maxPlayers = body.maxPlayers;
      if (body.title)           data.title = body.title;
      if (body.skillLevel)      data.skillLevel = body.skillLevel;
      if (body.notes !== undefined) data.notes = body.notes;
      if (body.pricePerPlayer !== undefined) data.pricePerPlayer = body.pricePerPlayer;

      const updated = await prisma.openPlay.update({ where: { id }, data });
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /:id/settle — Lock final player count and settle pricing ───────────

router.post(
  "/:id/settle",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const userId = req.userId!;

      const openPlay = await (prisma as any).openPlay.findUnique({ where: { id } });
      if (!openPlay) throw new NotFoundError("Open play");
      if (openPlay.createdById !== userId) throw new BadRequestError("Only the host can settle the session");

      const result = await lockAndSettle(id);

      // Notify all players that the final price is locked (non-blocking)
      const settledPlayers = await prisma.openPlayPlayer.findMany({
        where: { openPlayId: id },
        select: { userId: true },
      });
      const settledPlayerIds = settledPlayers.map((p) => p.userId);
      if (settledPlayerIds.length) {
        const priceLabel = result.finalPricePerPlayer != null
          ? `₹${result.finalPricePerPlayer.toFixed(2)}`
          : "settled";
        void createBulkNotifications(
          settledPlayerIds,
          NotifType.OPEN_PLAY_SETTLED,
          "Session price locked",
          `Final price locked: ${priceLabel} per player for your open play session.`,
          { openPlayId: id, pricePerPlayer: result.finalPricePerPlayer }
        );
      }

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// ─── DELETE /:id/players/:userId — Remove a player (creator only) ───────────

router.delete(
  "/:id/players/:userId",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: playerUserIdParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, userId: targetUserId } = req.params as unknown as z.infer<typeof playerUserIdParamSchema>;
      const requesterId = req.userId!;

      const openPlay = await prisma.openPlay.findUnique({ where: { id } });
      if (!openPlay) throw new NotFoundError("Open play");
      if (openPlay.createdById !== requesterId) throw new BadRequestError("Only the creator can remove players");
      if (openPlay.createdById === targetUserId) throw new BadRequestError("Cannot remove the host");

      const deleted = await prisma.openPlayPlayer.deleteMany({
        where: { openPlayId: id, userId: targetUserId },
      });
      if (deleted.count === 0) throw new NotFoundError("Player not in this session");

      // Re-open if was full
      if (openPlay.status === "full") {
        await prisma.openPlay.update({
          where: { id },
          data: { status: "open" },
        });
      }

      // Notify the removed player (non-blocking)
      void createNotification(
        targetUserId,
        NotifType.OPEN_PLAY_PLAYER_REMOVED,
        "Removed from session",
        "You were removed from an open play session by the host.",
        { openPlayId: id }
      );

      res.json({ success: true, message: "Player removed" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
