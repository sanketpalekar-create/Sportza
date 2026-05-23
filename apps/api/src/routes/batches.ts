import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { registry } from "../lib/openapi";
import { validate } from "../middleware/validate";
import { jwtCheck, attachUser, requireAuth, requireRole } from "../middleware/auth";
import { NotFoundError, BadRequestError, ConflictError, ForbiddenError } from "../lib/errors";
import { idParamSchema, paginationSchema } from "../schemas/common";
import { upsertLocation } from "../lib/location";
import { signProgressShareToken } from "../lib/progressShareToken";
import { paymentReminderMessage, whatsappUrlForPhone } from "../services/whatsappBridge";
import { createNotification, createBulkNotifications, NotifType } from "../services/notificationService";

const router: Router = Router();

// ─── Schemas ─────────────────────────────────────────────────

const listBatchesQuerySchema = paginationSchema.extend({
  trainerId: z.coerce.number().int().positive().optional(),
  sport: z.string().optional(),
  venueId: z.coerce.number().int().positive().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

const createBatchSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(5000).nullable().optional(),
  sport: z.string().min(1).max(50),
  venueId: z.number().int().positive().nullable().optional(),
  location: z.object({
    country: z.string().default("India"),
    state:   z.string().min(1),
    city:    z.string().min(1),
    pincode: z.string().max(10).optional(),
    address: z.string().max(500).optional(),
  }).nullable().optional(),
  capacity: z.number().int().min(1).default(20),
  schedule: z.record(z.unknown()).nullable().optional(),
  fees: z.object({
    sportFees: z.record(z.unknown()).optional(),
    feeSchedules: z.record(z.unknown()).optional(),
  }).nullable().optional(),
});

const updateBatchSchema = createBatchSchema.partial();

const createSessionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  startTime: z.string().regex(/^\d{1,2}:\d{2}$/, "startTime must be HH:MM"),
  endTime: z.string().regex(/^\d{1,2}:\d{2}$/, "endTime must be HH:MM"),
});

const sessionIdParamSchema = z.object({
  sessionId: z.coerce.number().int().positive(),
});

const attendanceItemSchema = z.object({
  playerId: z.number().int().positive(),
  status: z.enum(["present", "absent", "late", "excused"]).default("present"),
});

const markAttendanceSchema = z.object({
  attendance: z.array(attendanceItemSchema).min(1),
});

const recordPaymentSchema = z.object({
  playerId: z.number().int().positive().nullable().optional(),
  payerId: z.number().int().positive(),
  amount: z.number().positive(),
  paymentMode: z.enum(["online", "cash", "upi", "card"]).default("online"),
  cycleMonth: z.number().int().min(1).max(12).nullable().optional(),
  cycleYear: z.number().int().min(2020).max(2100).nullable().optional(),
});

const announcementSchema = z.object({
  message: z.string().min(1).max(2000),
});

const submitReviewSchema = z.object({
  playerId: z.coerce.number().int().positive(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  ratings: z.record(z.unknown()).optional(),
  comment: z.string().max(2000).optional(),
});

const updateSessionStatusSchema = z.object({
  status: z.string().min(1),
});

const generateSessionsSchema = z.object({
  weeks: z.coerce.number().int().min(1).max(52).default(4),
});

const USER_SAFE_SELECT = { id: true, name: true, avatar: true } as const;

// ─── Routes ──────────────────────────────────────────────────

// GET /my - Batches the current user is enrolled in
router.get(
  "/my",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ query: paginationSchema }),
  async (req, res, next) => {
    try {
      const userId = req.userId!;
      const { page, limit } = req.query as unknown as z.infer<typeof paginationSchema>;
      const skip = (page - 1) * limit;

      const [memberships, total] = await Promise.all([
        prisma.batchMembership.findMany({
          where: { playerId: userId },
          include: {
            batch: {
              include: {
                trainer: { select: USER_SAFE_SELECT },
                venue: { select: { id: true, name: true } },
              },
            },
          },
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.batchMembership.count({ where: { playerId: userId } }),
      ]);

      res.json({
        success: true,
        data: memberships,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET / - List batches with filters and pagination
router.get(
  "/",
  validate({ query: listBatchesQuerySchema }),
  async (req, res, next) => {
    try {
      const { page, limit, trainerId, sport, venueId, city, state } = req.query as unknown as z.infer<typeof listBatchesQuerySchema>;
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = { isActive: true };
      if (trainerId) where.trainerId = trainerId;
      if (sport) where.sport = sport;
      if (venueId) where.venueId = venueId;
      if (city || state) {
        where.location = {
          ...(city  ? { city:  { contains: city,  mode: "insensitive" } } : {}),
          ...(state ? { state: { contains: state, mode: "insensitive" } } : {}),
        };
      }

      const [batches, total] = await Promise.all([
        prisma.batch.findMany({
          where,
          include: {
            trainer: { select: USER_SAFE_SELECT },
            venue: { select: { id: true, name: true } },
            _count: { select: { memberships: true } },
          },
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.batch.count({ where }),
      ]);

      res.json({
        success: true,
        data: batches,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /sessions/:sessionId/attendance - Mark attendance (trainer only)
router.post(
  "/sessions/:sessionId/attendance",
  jwtCheck,
  attachUser,
  requireAuth,
  requireRole("trainer", "admin"),
  validate({ params: sessionIdParamSchema, body: markAttendanceSchema }),
  async (req, res, next) => {
    try {
      const { sessionId } = req.params as unknown as z.infer<typeof sessionIdParamSchema>;
      const { attendance } = req.body as z.infer<typeof markAttendanceSchema>;
      const userId = req.userId!;

      const session = await prisma.batchSession.findUnique({
        where: { id: sessionId },
        include: { batch: true },
      });
      if (!session) throw new NotFoundError("Session");
      if (session.batch.trainerId !== userId) {
        throw new ForbiddenError("Only the batch trainer can mark attendance");
      }

      // Validate all playerIds are active members of this batch
      const playerIds = attendance.map((a) => a.playerId);
      const memberCount = await prisma.batchMembership.count({
        where: { batchId: session.batchId, playerId: { in: playerIds }, status: "active" },
      });
      if (memberCount !== playerIds.length) {
        throw new BadRequestError("One or more players are not active members of this batch");
      }

      await prisma.$transaction(
        attendance.map((a) =>
          prisma.sessionAttendance.upsert({
            where: { sessionId_playerId: { sessionId, playerId: a.playerId } },
            create: { sessionId, playerId: a.playerId, status: a.status },
            update: { status: a.status },
          })
        )
      );

      const updated = await prisma.sessionAttendance.findMany({
        where: { sessionId },
        include: { player: { select: USER_SAFE_SELECT } },
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// GET /sessions/:sessionId/attendance - Get attendance (auth required)
router.get(
  "/sessions/:sessionId/attendance",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: sessionIdParamSchema }),
  async (req, res, next) => {
    try {
      const { sessionId } = req.params as unknown as z.infer<typeof sessionIdParamSchema>;
      const session = await prisma.batchSession.findUnique({
        where: { id: sessionId },
        include: {
          batch: { select: { id: true, name: true, trainerId: true } },
          attendance: { include: { player: { select: USER_SAFE_SELECT } } },
        },
      });
      if (!session) throw new NotFoundError("Session");

      const userId = req.userId!;
      const isTrainer = session.batch.trainerId === userId;
      const isMember = await prisma.batchMembership.findUnique({
        where: { batchId_playerId: { batchId: session.batch.id, playerId: userId } },
      });
      if (!isTrainer && !isMember) {
        throw new ForbiddenError("Only the trainer or batch members can view attendance");
      }

      res.json({ success: true, data: session });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /sessions/:sessionId - Update session status (trainer only)
router.patch(
  "/sessions/:sessionId",
  jwtCheck,
  attachUser,
  requireAuth,
  requireRole("trainer", "admin"),
  validate({ params: sessionIdParamSchema, body: updateSessionStatusSchema }),
  async (req, res, next) => {
    try {
      const { sessionId } = req.params as unknown as z.infer<typeof sessionIdParamSchema>;
      const { status } = req.body as z.infer<typeof updateSessionStatusSchema>;
      const userId = req.userId!;

      const session = await prisma.batchSession.findUnique({
        where: { id: sessionId },
        include: { batch: true },
      });
      if (!session) throw new NotFoundError("Session");
      if (session.batch.trainerId !== userId) {
        throw new ForbiddenError("Only the batch trainer can update session status");
      }

      const updated = await prisma.batchSession.update({
        where: { id: sessionId },
        data: { status },
      });
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// GET /:id - Get batch details
router.get(
  "/:id",
  validate({ params: idParamSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;

      const batch = await prisma.batch.findUnique({
        where: { id },
        include: {
          trainer: { select: { ...USER_SAFE_SELECT, email: true } },
          venue: { select: { id: true, name: true, location: { select: { address: true, city: true } } } },
          memberships: {
            include: { player: { select: USER_SAFE_SELECT } },
          },
          sessions: { orderBy: { date: "asc" } },
        },
      });

      if (!batch) throw new NotFoundError("Batch");
      res.json({ success: true, data: batch });
    } catch (err) {
      next(err);
    }
  }
);

// POST / - Create batch (trainer only)
router.post(
  "/",
  jwtCheck,
  attachUser,
  requireAuth,
  requireRole("trainer", "admin"),
  validate({ body: createBatchSchema }),
  async (req, res, next) => {
    try {
      const data = req.body as z.infer<typeof createBatchSchema>;
      const userId = req.userId!;

      let locationId: number | undefined;
      if (data.location) locationId = await upsertLocation(data.location);

      const batch = await prisma.batch.create({
        data: {
          trainerId: userId,
          name: data.name,
          description: data.description ?? undefined,
          sport: data.sport,
          venueId: data.venueId ?? undefined,
          ...(locationId !== undefined && { locationId }),
          capacity: data.capacity,
          schedule: (data.schedule ?? undefined) as any,
          sportFees: (data.fees?.sportFees ?? undefined) as any,
          feeSchedules: (data.fees?.feeSchedules ?? undefined) as any,
        },
        include: {
          trainer: { select: USER_SAFE_SELECT },
          venue: { select: { id: true, name: true } },
        },
      });

      res.status(201).json({ success: true, data: batch });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /:id - Update batch (trainer only)
router.put(
  "/:id",
  jwtCheck,
  attachUser,
  requireAuth,
  requireRole("trainer", "admin"),
  validate({ params: idParamSchema, body: updateBatchSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const data = req.body as z.infer<typeof updateBatchSchema>;
      const userId = req.userId!;

      const batch = await prisma.batch.findUnique({ where: { id } });
      if (!batch) throw new NotFoundError("Batch");
      if (batch.trainerId !== userId) {
        throw new ForbiddenError("Only the batch trainer can update it");
      }

      let locationId: number | undefined;
      if (data.location) locationId = await upsertLocation(data.location);

      const updated = await prisma.batch.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.sport && { sport: data.sport }),
          ...(data.venueId !== undefined && { venueId: data.venueId }),
          ...(locationId !== undefined && { locationId }),
          ...(data.capacity && { capacity: data.capacity }),
          ...(data.schedule !== undefined && { schedule: data.schedule as any }),
          ...(data.fees?.sportFees !== undefined && { sportFees: data.fees.sportFees as any }),
          ...(data.fees?.feeSchedules !== undefined && { feeSchedules: data.fees.feeSchedules as any }),
        } as any,
        include: {
          trainer: { select: USER_SAFE_SELECT },
          venue: { select: { id: true, name: true } },
        },
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// POST /:id/join - Join batch (player)
router.post(
  "/:id/join",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const userId = req.userId!;

      const batch = await prisma.batch.findUnique({ where: { id } });
      if (!batch) throw new NotFoundError("Batch");

      const memberCount = await prisma.batchMembership.count({
        where: { batchId: id, status: "active" },
      });
      if (memberCount >= batch.capacity) {
        throw new BadRequestError("Batch is full");
      }

      const existing = await prisma.batchMembership.findUnique({
        where: { batchId_playerId: { batchId: id, playerId: userId } },
      });
      if (existing) throw new ConflictError("Already a member of this batch");

      // Skill rating gate — check if the batch has explicit rating bounds
      if (batch.skillRatingMin !== null && batch.skillRatingMax !== null && batch.sportId) {
        const myRating = await prisma.sportSkillRating.findFirst({
          where: { userId, sportId: batch.sportId, formatName: "overall" },
        });
        const rating = myRating?.rating ?? 1000;
        if (rating < batch.skillRatingMin! || rating > batch.skillRatingMax!) {
          throw new BadRequestError(
            `Your Sportza Rating (${rating}) is outside the allowed range for this batch (${batch.skillRatingMin}–${batch.skillRatingMax})`
          );
        }
      }

      // Respect joinType: "approval" batches require trainer approval
      const initialStatus = batch.joinType === "approval" ? "pending" : "active";

      const membership = await prisma.batchMembership.create({
        data: { batchId: id, playerId: userId, status: initialStatus },
        include: { player: { select: USER_SAFE_SELECT } },
      });

      // Notify the trainer about the new member/join request (non-blocking)
      void createNotification(
        batch.trainerId,
        NotifType.BATCH_NEW_MEMBER,
        initialStatus === "pending"
          ? `New join request for ${batch.name}`
          : `New member joined ${batch.name}`,
        `${membership.player.name ?? "A player"} ${initialStatus === "pending" ? "requested to join" : "joined"} your batch.`,
        { batchId: id, batchName: batch.name, memberId: userId }
      );

      res.status(201).json({
        success: true,
        data: membership,
        message: initialStatus === "pending"
          ? "Join request submitted — awaiting trainer approval"
          : "Successfully joined batch",
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /:id/leave - Leave batch (player)
router.post(
  "/:id/leave",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const userId = req.userId!;

      const membership = await prisma.batchMembership.findUnique({
        where: { batchId_playerId: { batchId: id, playerId: userId } },
      });
      if (!membership) throw new NotFoundError("Membership");

      await prisma.batchMembership.update({
        where: { id: membership.id },
        data: { status: "left" },
      });

      // Notify the trainer a member has left (non-blocking)
      const leftBatch = await prisma.batch.findUnique({ where: { id }, select: { trainerId: true, name: true } });
      if (leftBatch) {
        void createNotification(
          leftBatch.trainerId,
          NotifType.BATCH_MEMBER_LEFT,
          "A member left your batch",
          `A student has left your batch "${leftBatch.name}".`,
          { batchId: id }
        );
      }

      res.json({ success: true, message: "Left batch successfully" });
    } catch (err) {
      next(err);
    }
  }
);

// POST /:id/members - Trainer manually adds a student by phone or email
router.post(
  "/:id/members",
  jwtCheck,
  attachUser,
  requireAuth,
  requireRole("trainer", "admin"),
  validate({
    params: idParamSchema,
    body: z.object({
      identifier: z.string().min(3, "Enter a phone number or email"),
    }),
  }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const { identifier } = req.body as { identifier: string };
      const userId = req.userId!;

      const batch = await prisma.batch.findUnique({ where: { id } });
      if (!batch) throw new NotFoundError("Batch");
      if (batch.trainerId !== userId) throw new ForbiddenError("Only the batch trainer can add members");

      // Look up the player by email or phone
      const isEmail = identifier.includes("@");
      const player = isEmail
        ? await prisma.user.findUnique({ where: { email: identifier } })
        : await prisma.user.findFirst({ where: { phone: identifier } });

      if (!player) throw new NotFoundError(`No user found with that ${isEmail ? "email" : "phone number"}`);
      if (player.id === userId) throw new BadRequestError("You cannot add yourself to the batch");

      const memberCount = await prisma.batchMembership.count({ where: { batchId: id, status: "active" } });
      if (memberCount >= batch.capacity) throw new BadRequestError("Batch is at full capacity");

      const existing = await prisma.batchMembership.findUnique({
        where: { batchId_playerId: { batchId: id, playerId: player.id } },
      });
      if (existing && existing.status === "active") throw new ConflictError("Student is already an active member");

      // Upsert: if they previously left or were rejected, reinstate as active
      const membership = existing
        ? await prisma.batchMembership.update({
            where: { id: existing.id },
            data: { status: "active" },
            include: { player: { select: { ...USER_SAFE_SELECT, email: true, phone: true } } },
          })
        : await prisma.batchMembership.create({
            data: { batchId: id, playerId: player.id, status: "active" },
            include: { player: { select: { ...USER_SAFE_SELECT, email: true, phone: true } } },
          });

      // Notify the added player (non-blocking)
      if (player.id !== userId) {
        void createNotification(
          player.id,
          NotifType.BATCH_MEMBER_ADDED,
          `You've been added to "${batch.name}"`,
          `A trainer has added you to the batch "${batch.name}". Check it out!`,
          { batchId: id, batchName: batch.name }
        );
      }

      res.status(201).json({ success: true, data: membership, message: "Student added to batch" });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /:id/members/:memberId - Approve or reject a pending member (trainer only)
router.patch(
  "/:id/members/:memberId",
  jwtCheck,
  attachUser,
  requireAuth,
  requireRole("trainer", "admin"),
  validate({
    params: z.object({
      id:       z.coerce.number().int().positive(),
      memberId: z.coerce.number().int().positive(),
    }),
    body: z.object({
      status: z.enum(["active", "rejected"]),
    }),
  }),
  async (req, res, next) => {
    try {
      const { id, memberId } = req.params as unknown as { id: number; memberId: number };
      const { status } = req.body as { status: "active" | "rejected" };
      const userId = req.userId!;

      const batch = await prisma.batch.findUnique({ where: { id } });
      if (!batch) throw new NotFoundError("Batch");
      if (batch.trainerId !== userId) throw new ForbiddenError("Only the batch trainer can update memberships");

      const membership = await prisma.batchMembership.findFirst({
        where: { id: memberId, batchId: id },
      });
      if (!membership) throw new NotFoundError("Membership");

      const updated = await prisma.batchMembership.update({
        where: { id: memberId },
        data: { status },
        include: { player: { select: USER_SAFE_SELECT } },
      });

      // Notify the player of the decision (non-blocking)
      void createNotification(
        membership.playerId,
        status === "active" ? NotifType.BATCH_MEMBER_APPROVED : NotifType.BATCH_MEMBER_REJECTED,
        status === "active" ? `Join request approved — ${batch.name}` : `Join request declined — ${batch.name}`,
        status === "active"
          ? `Your request to join "${batch.name}" has been approved. Welcome!`
          : `Your request to join "${batch.name}" was not accepted.`,
        { batchId: id, batchName: batch.name }
      );

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// GET /:id/sessions - List sessions for batch (trainer or active member only)
router.get(
  "/:id/sessions",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema, query: paginationSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const { page, limit } = req.query as unknown as z.infer<typeof paginationSchema>;
      const skip = (page - 1) * limit;
      const userId = req.userId!;

      const batch = await prisma.batch.findUnique({ where: { id } });
      if (!batch) throw new NotFoundError("Batch");

      const isTrainer = batch.trainerId === userId;
      if (!isTrainer) {
        const membership = await prisma.batchMembership.findUnique({
          where: { batchId_playerId: { batchId: id, playerId: userId } },
        });
        if (!membership) throw new ForbiddenError("Only the trainer or batch members can view sessions");
      }

      const [sessions, total] = await Promise.all([
        prisma.batchSession.findMany({
          where: { batchId: id },
          include: {
            attendance: {
              include: { player: { select: USER_SAFE_SELECT } },
            },
          },
          skip,
          take: limit,
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
        }),
        prisma.batchSession.count({ where: { batchId: id } }),
      ]);

      res.json({
        success: true,
        data: sessions,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /:id/sessions - Create session (trainer only)
router.post(
  "/:id/sessions",
  jwtCheck,
  attachUser,
  requireAuth,
  requireRole("trainer", "admin"),
  validate({ params: idParamSchema, body: createSessionSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const data = req.body as z.infer<typeof createSessionSchema>;
      const userId = req.userId!;

      const batch = await prisma.batch.findUnique({ where: { id } });
      if (!batch) throw new NotFoundError("Batch");
      if (batch.trainerId !== userId) {
        throw new ForbiddenError("Only the batch trainer can create sessions");
      }

      const session = await prisma.batchSession.create({
        data: {
          batchId: id,
          date: new Date(data.date),
          startTime: data.startTime,
          endTime: data.endTime,
        },
      });

      // Notify all active members about the new session (non-blocking)
      const activeMembers = await prisma.batchMembership.findMany({
        where: { batchId: id, status: "active" },
        select: { playerId: true },
      });
      const memberIds = activeMembers.map((m) => m.playerId);
      if (memberIds.length) {
        void createBulkNotifications(
          memberIds,
          NotifType.BATCH_SESSION_SCHEDULED,
          "New session scheduled",
          `A new session has been scheduled for ${new Date(data.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} (${data.startTime}–${data.endTime}) in "${batch.name}".`,
          { batchId: id, sessionId: session.id }
        );
      }

      res.status(201).json({ success: true, data: session });
    } catch (err) {
      next(err);
    }
  }
);

// GET /:id/payments - List payments for batch (trainer or member only)
router.get(
  "/:id/payments",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema, query: paginationSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const { page, limit } = req.query as unknown as z.infer<typeof paginationSchema>;
      const skip = (page - 1) * limit;
      const userId = req.userId!;

      const batch = await prisma.batch.findUnique({ where: { id } });
      if (!batch) throw new NotFoundError("Batch");

      const isTrainer = batch.trainerId === userId;
      if (!isTrainer) {
        const membership = await prisma.batchMembership.findUnique({
          where: { batchId_playerId: { batchId: id, playerId: userId } },
        });
        if (!membership) {
          throw new ForbiddenError("Only the trainer or batch members can view payments");
        }
      }

      const paymentWhere: Record<string, unknown> = { batchId: id };
      if (!isTrainer) {
        paymentWhere.OR = [{ payerId: userId }, { playerId: userId }];
      }

      const [payments, total] = await Promise.all([
        prisma.batchPayment.findMany({
          where: paymentWhere,
          include: {
            payer: { select: USER_SAFE_SELECT },
            player: { select: USER_SAFE_SELECT },
          },
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.batchPayment.count({ where: paymentWhere }),
      ]);

      res.json({
        success: true,
        data: payments,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /:id/payments - Record payment for batch (trainer only)
router.post(
  "/:id/payments",
  jwtCheck,
  attachUser,
  requireAuth,
  requireRole("trainer", "admin"),
  validate({ params: idParamSchema, body: recordPaymentSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const data = req.body as z.infer<typeof recordPaymentSchema>;
      const userId = req.userId!;

      const batch = await prisma.batch.findUnique({ where: { id } });
      if (!batch) throw new NotFoundError("Batch");
      if (batch.trainerId !== userId) {
        throw new ForbiddenError("Only the batch trainer can record payments");
      }

      const payment = await prisma.batchPayment.create({
        data: {
          batchId: id,
          playerId: data.playerId ?? undefined,
          payerId: data.payerId,
          amount: data.amount,
          paymentMode: data.paymentMode,
          cycleMonth: data.cycleMonth ?? undefined,
          cycleYear: data.cycleYear ?? undefined,
        },
        include: {
          player: { select: USER_SAFE_SELECT },
        },
      });

      // Notify the player whose payment was recorded (non-blocking)
      const notifyPlayerId = data.playerId ?? data.payerId;
      if (notifyPlayerId && notifyPlayerId !== userId) {
        void createNotification(
          notifyPlayerId,
          NotifType.PAYMENT_RECORDED,
          `Payment recorded — ${batch.name}`,
          `₹${data.amount} has been recorded for ${batch.name}.`,
          { batchId: id, batchName: batch.name, amount: data.amount }
        );
      }

      res.status(201).json({ success: true, data: payment });
    } catch (err) {
      next(err);
    }
  }
);

// POST /:id/announcements - Post announcement (trainer only)
router.post(
  "/:id/announcements",
  jwtCheck,
  attachUser,
  requireAuth,
  requireRole("trainer", "admin"),
  validate({ params: idParamSchema, body: announcementSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const { message } = req.body as z.infer<typeof announcementSchema>;
      const userId = req.userId!;

      const batch = await prisma.batch.findUnique({ where: { id } });
      if (!batch) throw new NotFoundError("Batch");
      if (batch.trainerId !== userId) {
        throw new ForbiddenError("Only the batch trainer can post announcements");
      }

      const announcement = await prisma.batchAnnouncement.create({
        data: { batchId: id, trainerId: userId, message },
      });

      // Notify all active members about the new announcement (non-blocking)
      void prisma.batchMembership.findMany({
        where: { batchId: id, status: "active" },
        select: { playerId: true },
      }).then((members) => {
        const memberIds = members.map((m) => m.playerId).filter((pid) => pid !== userId);
        return createBulkNotifications(
          memberIds,
          NotifType.BATCH_ANNOUNCEMENT,
          `📢 New announcement in ${batch.name}`,
          message.length > 120 ? message.slice(0, 120) + "…" : message,
          { batchId: id, batchName: batch.name, announcementId: announcement.id }
        );
      });

      res.status(201).json({ success: true, data: announcement });
    } catch (err) {
      next(err);
    }
  }
);

// GET /:id/announcements - List announcements (trainer or batch members only)
router.get(
  "/:id/announcements",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema, query: paginationSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const { page, limit } = req.query as unknown as z.infer<typeof paginationSchema>;
      const skip = (page - 1) * limit;
      const userId = req.userId!;

      const batch = await prisma.batch.findUnique({ where: { id } });
      if (!batch) throw new NotFoundError("Batch");

      const isTrainer = batch.trainerId === userId;
      if (!isTrainer) {
        const membership = await prisma.batchMembership.findUnique({
          where: { batchId_playerId: { batchId: id, playerId: userId } },
        });
        if (!membership) throw new ForbiddenError("Only the trainer or batch members can view announcements");
      }

      const [announcements, total] = await Promise.all([
        prisma.batchAnnouncement.findMany({
          where: { batchId: id },
          include: { trainer: { select: USER_SAFE_SELECT } },
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.batchAnnouncement.count({ where: { batchId: id } }),
      ]);

      res.json({
        success: true,
        data: announcements,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /:id - Soft delete batch (trainer only)
router.delete(
  "/:id",
  jwtCheck,
  attachUser,
  requireAuth,
  requireRole("trainer", "admin"),
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const batch = await prisma.batch.findUnique({ where: { id } });
      if (!batch) throw new NotFoundError("Batch");
      if (batch.trainerId !== req.userId) {
        throw new ForbiddenError("Only the batch trainer can deactivate this batch");
      }

      // Fetch active members before deactivation to notify them (non-blocking)
      const deactivatedMembers = await prisma.batchMembership.findMany({
        where: { batchId: id, status: "active" },
        select: { playerId: true },
      });
      const deactivatedMemberIds = deactivatedMembers.map((m) => m.playerId);

      await prisma.batch.update({ where: { id }, data: { isActive: false } });

      if (deactivatedMemberIds.length) {
        void createBulkNotifications(
          deactivatedMemberIds,
          NotifType.BATCH_DEACTIVATED,
          "Batch deactivated",
          `The batch "${batch.name}" has been deactivated by your trainer.`,
          { batchId: id }
        );
      }

      res.json({ success: true, message: "Batch deactivated" });
    } catch (err) {
      next(err);
    }
  }
);

// GET /:id/reviews - Batch monthly reviews (trainer or batch member only)
router.get(
  "/:id/reviews",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const userId = req.userId!;

      const batch = await prisma.batch.findUnique({ where: { id } });
      if (!batch) throw new NotFoundError("Batch");

      const isTrainer = batch.trainerId === userId;
      if (!isTrainer) {
        const membership = await prisma.batchMembership.findUnique({
          where: { batchId_playerId: { batchId: id, playerId: userId } },
        });
        if (!membership) throw new ForbiddenError("Only the trainer or batch members can view reviews");
      }

      // Trainer sees all reviews; members see only their own
      const where: Record<string, unknown> = { batchId: id };
      if (!isTrainer) where.playerId = userId;

      const reviews = await prisma.playerBatchReview.findMany({
        where,
        include: {
          player: { select: USER_SAFE_SELECT },
          trainer: { select: USER_SAFE_SELECT },
        },
        orderBy: [{ year: "desc" }, { month: "desc" }],
      });
      res.json({ success: true, data: reviews });
    } catch (err) {
      next(err);
    }
  }
);

// POST /:id/reviews - Submit monthly review (trainer only)
router.post(
  "/:id/reviews",
  jwtCheck,
  attachUser,
  requireAuth,
  requireRole("trainer", "admin"),
  validate({ params: idParamSchema, body: submitReviewSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const { playerId, year, month, ratings, comment } = req.body as z.infer<typeof submitReviewSchema>;
      const batch = await prisma.batch.findUnique({ where: { id } });
      if (!batch) throw new NotFoundError("Batch");
      if (batch.trainerId !== req.userId) {
        throw new ForbiddenError("Only the batch trainer can submit reviews");
      }

      // Validate the reviewed player is a member of this batch
      const membership = await prisma.batchMembership.findUnique({
        where: { batchId_playerId: { batchId: id, playerId } },
      });
      if (!membership) throw new BadRequestError("Player is not a member of this batch");

      const review = await prisma.playerBatchReview.upsert({
        where: { batchId_playerId_year_month: { batchId: id, playerId, year, month } },
        update: { ratings: ratings as any, comment },
        create: { batchId: id, playerId, trainerId: req.userId!, year, month, ratings: ratings as any, comment },
      });

      // Notify the player that their review is ready (non-blocking)
      const monthName = new Date(year, month - 1).toLocaleString("en-IN", { month: "long" });
      void createNotification(
        playerId,
        NotifType.BATCH_REVIEW_POSTED,
        "Your trainer posted your review",
        `Your trainer posted your ${monthName} ${year} review in "${batch.name}". See how you've progressed!`,
        { batchId: id, year, month }
      );

      res.json({ success: true, data: review });
    } catch (err) {
      next(err);
    }
  }
);

// GET /:id/progress/share-token — JWT link for parent-facing progress card (trainer only)
router.get(
  "/:id/progress/share-token",
  jwtCheck,
  attachUser,
  requireAuth,
  requireRole("trainer", "admin"),
  validate({
    params: idParamSchema,
    query: z.object({ playerId: z.coerce.number().int().positive() }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const playerId = Number((req.query as { playerId: string }).playerId);
      const batch = await prisma.batch.findUnique({ where: { id } });
      if (!batch) throw new NotFoundError("Batch");
      if (batch.trainerId !== req.userId) {
        throw new ForbiddenError("Only the batch trainer can create share links");
      }
      const membership = await prisma.batchMembership.findUnique({
        where: { batchId_playerId: { batchId: id, playerId } },
      });
      if (!membership || membership.status !== "active") {
        throw new BadRequestError("Player is not an active member of this batch");
      }
      const token = signProgressShareToken(id, playerId);
      const base =
        (process.env.CLIENT_ORIGIN ?? "http://localhost:5173").split(",")[0]?.trim() || "http://localhost:5173";
      const shareUrl = `${base.replace(/\/$/, "")}/share/player-progress?token=${encodeURIComponent(token)}`;
      res.json({ success: true, data: { token, shareUrl } });
    } catch (err) {
      next(err);
    }
  }
);

// POST /:id/remind-payment — WhatsApp deep link for fee reminder (trainer only)
router.post(
  "/:id/remind-payment",
  jwtCheck,
  attachUser,
  requireAuth,
  requireRole("trainer", "admin"),
  validate({
    params: idParamSchema,
    body: z.object({ playerId: z.coerce.number().int().positive() }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const { playerId } = req.body as { playerId: number };
      const batch = await prisma.batch.findUnique({ where: { id } });
      if (!batch) throw new NotFoundError("Batch");
      if (batch.trainerId !== req.userId) {
        throw new ForbiddenError("Only the batch trainer can send reminders");
      }
      const membership = await prisma.batchMembership.findUnique({
        where: { batchId_playerId: { batchId: id, playerId } },
      });
      if (!membership || membership.status !== "active") {
        throw new BadRequestError("Player is not an active member of this batch");
      }
      const player = await prisma.user.findUnique({
        where: { id: playerId },
        select: { phone: true, name: true },
      });
      if (!player) throw new NotFoundError("Player");
      const now = new Date();
      const monthLabel = now.toLocaleString("en-IN", { month: "long", year: "numeric" });
      const msg = paymentReminderMessage({
        batchName: batch.name,
        monthLabel,
      });
      // Always create an in-app payment reminder notification (non-blocking)
      void createNotification(
        playerId,
        NotifType.PAYMENT_REMINDER,
        `Payment reminder — ${batch.name}`,
        `Your fee for ${monthLabel} is due. Please pay at the earliest.`,
        { batchId: id, batchName: batch.name }
      );

      if (!player.phone) {
        res.json({
          success: true,
          data: { whatsappUrl: null as string | null, message: "Player has no phone number on file" },
        });
        return;
      }
      const whatsappUrl = whatsappUrlForPhone(player.phone, msg);
      res.json({ success: true, data: { whatsappUrl, message: msg } });
    } catch (err) {
      next(err);
    }
  }
);

// POST /:id/rate - Student rates the batch trainer (active members only)
router.post(
  "/:id/rate",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({
    params: idParamSchema,
    body: z.object({
      rating:  z.number().int().min(1).max(5),
      comment: z.string().max(2000).optional(),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const { rating, comment } = req.body as { rating: number; comment?: string };
      const userId = req.userId!;

      const batch = await prisma.batch.findUnique({ where: { id } });
      if (!batch) throw new NotFoundError("Batch");

      // Only active members of this batch may post a review
      const membership = await prisma.batchMembership.findUnique({
        where: { batchId_playerId: { batchId: id, playerId: userId } },
      });
      if (!membership || membership.status !== "active") {
        throw new ForbiddenError("Only active members of this batch can post a review");
      }

      // Upsert against TrainerReview (one review per student per trainer)
      const review = await prisma.trainerReview.upsert({
        where: { trainerId_userId: { trainerId: batch.trainerId, userId } },
        update: { rating, review: comment ?? null },
        create: { trainerId: batch.trainerId, userId, rating, review: comment ?? null },
        include: { user: { select: USER_SAFE_SELECT } },
      });

      // Notify the trainer that a student rated them (non-blocking)
      void createNotification(
        batch.trainerId,
        NotifType.BATCH_REVIEW_RECEIVED,
        "A student rated your coaching",
        `A student gave your coaching a ${rating}-star rating in "${batch.name}".`,
        { batchId: id, rating }
      );

      res.status(201).json({ success: true, data: review, message: "Review submitted" });
    } catch (err) {
      next(err);
    }
  }
);

// POST /:id/sessions/generate - Generate sessions from schedule (trainer only)
router.post(
  "/:id/sessions/generate",
  jwtCheck,
  attachUser,
  requireAuth,
  requireRole("trainer", "admin"),
  validate({ params: idParamSchema, body: generateSessionsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const { weeks } = req.body as z.infer<typeof generateSessionsSchema>;
      const batch = await prisma.batch.findUnique({ where: { id } });
      if (!batch) throw new NotFoundError("Batch");
      if (batch.trainerId !== req.userId) {
        throw new ForbiddenError("Only the batch trainer can generate sessions");
      }
      const schedule = batch.schedule as any;
      if (!schedule?.weekdays || !schedule?.startTime || !schedule?.endTime) {
        throw new BadRequestError("Batch has no valid schedule");
      }
      const sessions: Array<{ batchId: number; date: Date; startTime: string; endTime: string }> = [];
      const today = new Date();
      for (let w = 0; w < weeks; w++) {
        for (const day of schedule.weekdays) {
          const date = new Date(today);
          if (w === 0) date.setDate(today.getDate() + ((day - today.getDay() + 7) % 7 || 7));
          else date.setDate(today.getDate() + ((day - today.getDay() + 7) % 7) + 7 * w);
          sessions.push({ batchId: id, date, startTime: schedule.startTime, endTime: schedule.endTime });
        }
      }
      await prisma.batchSession.createMany({ data: sessions, skipDuplicates: true });
      res.json({ success: true, message: `Generated ${sessions.length} sessions`, count: sessions.length });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
