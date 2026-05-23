import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { jwtCheck, attachUser, requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { idParamSchema } from "../schemas/common";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../lib/errors";
import { createNotification, NotifType } from "../services/notificationService";

const userIdParamSchema = z.object({ userId: z.coerce.number().int().positive() });

const router: Router = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const sendRequestSchema = z.object({
  addresseeId: z.coerce.number().int().positive(),
});

const respondSchema = z.object({
  action: z.enum(["accept", "decline", "remove"]),
});

// ─── Middleware ───────────────────────────────────────────────────────────────

router.use(jwtCheck, attachUser, requireAuth);

// ─── POST /api/peers/request — Send a peer request ───────────────────────────

router.post(
  "/request",
  validate({ body: sendRequestSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requesterId = req.userId!;
      const { addresseeId } = req.body as { addresseeId: number };

      if (requesterId === addresseeId) {
        throw new BadRequestError("You cannot send a peer request to yourself.");
      }

      // Check if either direction already exists
      const existing = await prisma.peerRelationship.findFirst({
        where: {
          OR: [
            { requesterId, addresseeId },
            { requesterId: addresseeId, addresseeId: requesterId },
          ],
        },
      });

      if (existing) {
        if (existing.status === "accepted") {
          throw new ConflictError("You are already peers.");
        }
        if (existing.status === "pending") {
          throw new ConflictError("A peer request already exists between you.");
        }
        // declined or removed — allow re-request: reset to pending
        const updated = await prisma.peerRelationship.update({
          where: { id: existing.id },
          data: { requesterId, addresseeId, status: "pending", updatedAt: new Date() },
        });
        return res.status(200).json({ relationship: updated });
      }

      const relationship = await prisma.peerRelationship.create({
        data: { requesterId, addresseeId, status: "pending" },
      });

      // Notify addressee (non-blocking)
      const requester = await prisma.user.findUnique({
        where: { id: requesterId },
        select: { name: true },
      });
      void createNotification(
        addresseeId,
        NotifType.PEER_REQUEST_RECEIVED,
        "New peer request",
        `${requester?.name ?? "A player"} sent you a peer request.`,
        { relationshipId: relationship.id, requesterId }
      );

      return res.status(201).json({ relationship });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/peers/suggestions — Players in same city (not yet peers) ────────

router.get(
  "/suggestions",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const city  = typeof req.query.city  === "string" ? req.query.city.trim()  : undefined;
      const state = typeof req.query.state === "string" ? req.query.state.trim() : undefined;
      const limit = Math.min(parseInt(req.query.limit as string ?? "10", 10) || 10, 30);

      // Collect IDs already in a peer relationship with the current user
      const existingRelationships = await prisma.peerRelationship.findMany({
        where: {
          OR: [{ requesterId: userId }, { addresseeId: userId }],
        },
        select: { requesterId: true, addresseeId: true },
      });
      const knownIds = new Set<number>([userId]);
      for (const r of existingRelationships) {
        knownIds.add(r.requesterId);
        knownIds.add(r.addresseeId);
      }

      if (!city && !state) {
        return res.json({ data: [] });
      }

      const suggestions = await prisma.user.findMany({
        where: {
          id: { notIn: Array.from(knownIds) },
          location: {
            is: {
              ...(city ? { city: { contains: city } } : {}),
              ...(state ? { state: { contains: state } } : {}),
            },
          },
        },
        select: {
          id: true,
          name: true,
          avatar: true,
          location: { select: { city: true, state: true } },
        },
        take: limit,
        orderBy: { createdAt: "desc" },
      });

      return res.json({ data: suggestions });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/peers — List incoming + outgoing peer requests ─────────────────

router.get(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;

      const [incoming, outgoing, accepted] = await Promise.all([
        prisma.peerRelationship.findMany({
          where: { addresseeId: userId, status: "pending" },
          include: { requester: { select: { id: true, name: true, avatar: true, location: { select: { city: true } } } } },
          orderBy: { createdAt: "desc" },
        }),
        prisma.peerRelationship.findMany({
          where: { requesterId: userId, status: "pending" },
          include: { addressee: { select: { id: true, name: true, avatar: true, location: { select: { city: true } } } } },
          orderBy: { createdAt: "desc" },
        }),
        prisma.peerRelationship.findMany({
          where: {
            OR: [
              { requesterId: userId, status: "accepted" },
              { addresseeId: userId, status: "accepted" },
            ],
          },
          include: {
            requester: { select: { id: true, name: true, avatar: true, location: { select: { city: true } } } },
            addressee: { select: { id: true, name: true, avatar: true, location: { select: { city: true } } } },
          },
          orderBy: { updatedAt: "desc" },
        }),
      ]);

      return res.json({ incoming, outgoing, accepted });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/peers/status/:userId — Get relationship status with a specific user ──

router.get(
  "/status/:userId",
  validate({ params: userIdParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const myId = req.userId!;
      const userIdParam = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
      const otherId = parseInt(userIdParam, 10);

      if (myId === otherId) {
        return res.json({ status: "self" });
      }

      const relationship = await prisma.peerRelationship.findFirst({
        where: {
          OR: [
            { requesterId: myId, addresseeId: otherId },
            { requesterId: otherId, addresseeId: myId },
          ],
        },
      });

      if (!relationship) {
        return res.json({ status: "none" });
      }

      return res.json({
        id: relationship.id,
        status: relationship.status,
        iAmRequester: relationship.requesterId === myId,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /api/peers/:id — Accept, decline, or remove a peer relationship ───

router.patch(
  "/:id",
  validate({ params: idParamSchema, body: respondSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const id = parseInt(idParam, 10);
      const { action } = req.body as { action: "accept" | "decline" | "remove" };

      const relationship = await prisma.peerRelationship.findUnique({ where: { id } });

      if (!relationship) {
        throw new NotFoundError("Peer relationship not found.");
      }

      const isAddressee = relationship.addresseeId === userId;
      const isRequester = relationship.requesterId === userId;

      if (!isAddressee && !isRequester) {
        throw new ForbiddenError("This is not your peer relationship.");
      }

      if (action === "accept") {
        if (!isAddressee) throw new ForbiddenError("Only the addressee can accept a request.");
        if (relationship.status !== "pending") throw new BadRequestError("Request is not pending.");
      }

      if (action === "decline") {
        if (!isAddressee) throw new ForbiddenError("Only the addressee can decline a request.");
        if (relationship.status !== "pending") throw new BadRequestError("Request is not pending.");
      }

      if (action === "remove") {
        if (!isAddressee && !isRequester) throw new ForbiddenError("Not your relationship.");
        if (relationship.status !== "accepted") throw new BadRequestError("Relationship is not accepted.");
      }

      const statusMap = { accept: "accepted", decline: "declined", remove: "removed" } as const;

      const updated = await prisma.peerRelationship.update({
        where: { id },
        data: { status: statusMap[action], updatedAt: new Date() },
      });

      // Notify the other party (non-blocking)
      if (action === "accept" || action === "decline") {
        const actor = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        });
        const notifType = action === "accept" ? NotifType.PEER_REQUEST_ACCEPTED : NotifType.PEER_REQUEST_DECLINED;
        void createNotification(
          relationship.requesterId,
          notifType,
          action === "accept" ? "Peer request accepted!" : "Peer request declined",
          action === "accept"
            ? `${actor?.name ?? "A player"} accepted your peer request.`
            : `${actor?.name ?? "A player"} declined your peer request.`,
          { relationshipId: id, addresseeId: userId }
        );
      } else if (action === "remove") {
        // Notify the other party they were removed (non-blocking)
        const otherUserId = isRequester ? relationship.addresseeId : relationship.requesterId;
        void createNotification(
          otherUserId,
          NotifType.PEER_REMOVED,
          "Removed from peer network",
          "A peer has removed you from their network.",
          { relationshipId: id }
        );
      }

      return res.json({ relationship: updated });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/peers/compare/:userId — Peer-gated side-by-side rating comparison ──

router.get(
  "/compare/:userId",
  validate({ params: userIdParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const myId = req.userId!;
      const userIdParam = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
      const otherId = parseInt(userIdParam, 10);

      if (myId === otherId) {
        throw new BadRequestError("Cannot compare with yourself.");
      }

      // Enforce accepted peer gate
      const relationship = await prisma.peerRelationship.findFirst({
        where: {
          status: "accepted",
          OR: [
            { requesterId: myId, addresseeId: otherId },
            { requesterId: otherId, addresseeId: myId },
          ],
        },
      });

      if (!relationship) {
        throw new ForbiddenError("Comparison is only available for accepted peers.");
      }

      // Fetch both players' full sport ratings
      const [myRatings, theirRatings, myUser, theirUser] = await Promise.all([
        prisma.sportSkillRating.findMany({
          where: { userId: myId, formatName: "overall" },
          include: { sport: true },
          orderBy: { rating: "desc" },
        }),
        prisma.sportSkillRating.findMany({
          where: { userId: otherId, formatName: "overall" },
          include: { sport: true },
          orderBy: { rating: "desc" },
        }),
        prisma.user.findUnique({
          where: { id: myId },
          select: { id: true, name: true, avatar: true, location: { select: { city: true } } },
        }),
        prisma.user.findUnique({
          where: { id: otherId },
          select: { id: true, name: true, avatar: true, location: { select: { city: true } } },
        }),
      ]);

      // Build a sport-by-sport comparison keyed on sportId
      const sportMap = new Map<number, { sport: any; mine?: any; theirs?: any }>();

      for (const r of myRatings) {
        sportMap.set(r.sportId, { sport: r.sport, mine: r });
      }
      for (const r of theirRatings) {
        const entry = sportMap.get(r.sportId) ?? { sport: r.sport };
        entry.theirs = r;
        sportMap.set(r.sportId, entry);
      }

      const comparison = Array.from(sportMap.values()).sort((a, b) => {
        const aRating = Math.max(a.mine?.rating ?? 0, a.theirs?.rating ?? 0);
        const bRating = Math.max(b.mine?.rating ?? 0, b.theirs?.rating ?? 0);
        return bRating - aRating;
      });

      return res.json({
        me: myUser,
        peer: theirUser,
        comparison,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
