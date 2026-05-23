import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { jwtCheck, attachUser, requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { idParamSchema, paginationSchema } from "../schemas/common";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../lib/errors";
import { createNotification, NotifType } from "../services/notificationService";

const router: Router = Router();

const inviteStatusSchema = z.enum(["pending", "accepted", "declined", "cancelled", "expired"]);
const inviteInboxQuerySchema = paginationSchema.extend({
  status: inviteStatusSchema.optional(),
});

const createPeerInviteSchema = z.object({
  receiverId: z.coerce.number().int().positive(),
  sportId: z.coerce.number().int().positive(),
  message: z.string().trim().max(1000).optional(),
  proposedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional(),
  proposedStartTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Start time must be HH:MM")
    .optional(),
  proposedEndTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "End time must be HH:MM")
    .optional(),
});

const respondPeerInviteSchema = z.object({
  status: z.enum(["accepted", "declined"]),
});

function inviteInclude() {
  return {
    sender: { select: { id: true, name: true, avatar: true, location: { select: { city: true } } } },
    receiver: { select: { id: true, name: true, avatar: true, location: { select: { city: true } } } },
    sportRef: { select: { id: true, name: true, displayName: true } },
  } as const;
}

router.post(
  "/",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ body: createPeerInviteSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const senderId = req.userId!;
      const body = req.body as z.infer<typeof createPeerInviteSchema>;

      if (body.receiverId === senderId) {
        throw new BadRequestError("You cannot invite yourself");
      }

      if (body.proposedStartTime && body.proposedEndTime && body.proposedEndTime <= body.proposedStartTime) {
        throw new BadRequestError("End time must be later than start time");
      }

      const [receiver, sport, existingPending] = await Promise.all([
        prisma.user.findUnique({
          where: { id: body.receiverId },
          select: { id: true },
        }),
        prisma.sport.findUnique({
          where: { id: body.sportId },
          select: { id: true, name: true, displayName: true },
        }),
        prisma.peerPlayInvite.findFirst({
          where: {
            senderId,
            receiverId: body.receiverId,
            sportId: body.sportId,
            status: "pending",
          },
          select: { id: true },
        }),
      ]);

      if (!receiver) throw new NotFoundError("Player");
      if (!sport) throw new NotFoundError("Sport");
      if (existingPending) {
        throw new ConflictError("A pending invite already exists for this player and sport");
      }

      const invite = await prisma.peerPlayInvite.create({
        data: {
          senderId,
          receiverId: body.receiverId,
          sportId: body.sportId,
          sport: sport.name,
          message: body.message || null,
          proposedDate: body.proposedDate ? new Date(`${body.proposedDate}T00:00:00.000Z`) : null,
          proposedStartTime: body.proposedStartTime || null,
          proposedEndTime: body.proposedEndTime || null,
          status: "pending",
        },
        include: inviteInclude(),
      });

      // Notify receiver (non-blocking)
      void createNotification(
        body.receiverId,
        NotifType.PEER_INVITE_RECEIVED,
        "New game invite",
        `${invite.sender.name ?? "A player"} invited you to play ${sport.displayName ?? sport.name}.`,
        { inviteId: invite.id, senderId, sport: sport.name }
      );

      res.status(201).json({
        success: true,
        message: "Invite sent",
        data: invite,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/received",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ query: inviteInboxQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { page, limit, status } = req.query as unknown as z.infer<typeof inviteInboxQuerySchema>;
      const skip = (page - 1) * limit;
      const where: Record<string, unknown> = { receiverId: userId };
      if (status) where.status = status;

      const [items, total] = await Promise.all([
        prisma.peerPlayInvite.findMany({
          where,
          include: inviteInclude(),
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.peerPlayInvite.count({ where }),
      ]);

      res.json({
        success: true,
        data: items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/sent",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ query: inviteInboxQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { page, limit, status } = req.query as unknown as z.infer<typeof inviteInboxQuerySchema>;
      const skip = (page - 1) * limit;
      const where: Record<string, unknown> = { senderId: userId };
      if (status) where.status = status;

      const [items, total] = await Promise.all([
        prisma.peerPlayInvite.findMany({
          where,
          include: inviteInclude(),
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.peerPlayInvite.count({ where }),
      ]);

      res.json({
        success: true,
        data: items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const userId = req.userId!;

      const invite = await prisma.peerPlayInvite.findUnique({
        where: { id },
        include: inviteInclude(),
      });

      if (!invite) throw new NotFoundError("Peer invite");
      if (invite.senderId !== userId && invite.receiverId !== userId) {
        throw new ForbiddenError("You do not have access to this invite");
      }

      res.json({ success: true, data: invite });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/:id/respond",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema, body: respondPeerInviteSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const { status } = req.body as z.infer<typeof respondPeerInviteSchema>;
      const userId = req.userId!;

      const invite = await prisma.peerPlayInvite.findUnique({ where: { id } });
      if (!invite) throw new NotFoundError("Peer invite");
      if (invite.receiverId !== userId) {
        throw new ForbiddenError("Only the invited player can respond");
      }
      if (invite.status !== "pending") {
        throw new ConflictError("Only pending invites can be responded to");
      }

      const updated = await prisma.peerPlayInvite.update({
        where: { id },
        data: { status, respondedAt: new Date() },
        include: inviteInclude(),
      });

      // Notify sender of the response (non-blocking)
      const notifType = status === "accepted" ? NotifType.PEER_INVITE_ACCEPTED : NotifType.PEER_INVITE_DECLINED;
      const receiverName = updated.receiver.name ?? "A player";
      void createNotification(
        invite.senderId,
        notifType,
        status === "accepted" ? "Invite accepted!" : "Invite declined",
        status === "accepted"
          ? `${receiverName} accepted your invite to play ${updated.sport}.`
          : `${receiverName} declined your invite to play ${updated.sport}.`,
        { inviteId: invite.id, receiverId: userId, sport: updated.sport }
      );

      res.json({
        success: true,
        message: status === "accepted" ? "Invite accepted" : "Invite declined",
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/:id/cancel",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const userId = req.userId!;

      const invite = await prisma.peerPlayInvite.findUnique({ where: { id } });
      if (!invite) throw new NotFoundError("Peer invite");
      if (invite.senderId !== userId) {
        throw new ForbiddenError("Only the sender can cancel an invite");
      }
      if (invite.status !== "pending") {
        throw new ConflictError("Only pending invites can be cancelled");
      }

      const updated = await prisma.peerPlayInvite.update({
        where: { id },
        data: { status: "cancelled", respondedAt: new Date() },
        include: inviteInclude(),
      });

      // Notify receiver that the invite was pulled (non-blocking)
      void createNotification(
        invite.receiverId,
        NotifType.PEER_INVITE_CANCELLED,
        "Invite cancelled",
        `${updated.sender.name ?? "A player"} cancelled their invite to play ${updated.sport}.`,
        { inviteId: invite.id, senderId: userId, sport: updated.sport }
      );

      res.json({
        success: true,
        message: "Invite cancelled",
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
