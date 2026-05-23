import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import crypto from "crypto";
import prisma from "../lib/prisma";
import { validate } from "../middleware/validate";
import { jwtCheck, attachUser, requireAuth } from "../middleware/auth";
import { NotFoundError, BadRequestError, ForbiddenError } from "../lib/errors";
import { idParamSchema } from "../schemas/common";
import { emitToDisplay } from "../lib/socket";

const router: Router = Router();

const PAIRING_TTL_MINUTES = 60;

const tokenParamSchema = z.object({
  token: z.string().min(8).max(64),
});

const createDisplaySchema = z.object({
  venueId: z.coerce.number().int().positive(),
  courtName: z.string().min(1).max(100),
});

const claimSchema = z.object({
  matchId: z.coerce.number().int().positive(),
});

// GET /api/displays?venueId=X — list all courts for a venue (venue owner)
router.get(
  "/",
  jwtCheck,
  attachUser,
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const venueId = parseInt(req.query.venueId as string, 10);
      if (!venueId || isNaN(venueId)) throw new BadRequestError("venueId is required");

      const venue = await prisma.venue.findUnique({ where: { id: venueId } });
      if (!venue) throw new NotFoundError("Venue");
      if (venue.ownerId !== req.userId) throw new ForbiddenError("Not your venue");

      const displays = await prisma.venueDisplay.findMany({
        where: { venueId },
        include: {
          match: { select: { id: true, sportName: true, status: true, teams: true } },
          pairings: {
            where: { expiresAt: { gt: new Date() }, claimedAt: null },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { courtName: "asc" },
      });

      res.json({ success: true, data: displays });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/displays — create a permanent court display (venue owner)
router.post(
  "/",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ body: createDisplaySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { venueId, courtName } = req.body as z.infer<typeof createDisplaySchema>;

      const venue = await prisma.venue.findUnique({ where: { id: venueId } });
      if (!venue) throw new NotFoundError("Venue");
      if (venue.ownerId !== req.userId) throw new ForbiddenError("Not your venue");

      const display = await prisma.venueDisplay.create({
        data: { venueId, courtName, status: "idle" },
      });

      res.status(201).json({ success: true, data: display });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/displays/:id/pair — generate a fresh pairing token (venue owner)
router.post(
  "/:id/pair",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;

      const display = await prisma.venueDisplay.findUnique({
        where: { id },
        include: { venue: { select: { ownerId: true, name: true } } },
      });
      if (!display) throw new NotFoundError("Display");
      if (display.venue.ownerId !== req.userId) throw new ForbiddenError("Not your venue");

      // Expire any outstanding unclaimed pairings for this display
      await prisma.displayPairing.updateMany({
        where: { displayId: id, claimedAt: null },
        data: { expiresAt: new Date() },
      });

      const token = crypto.randomBytes(24).toString("hex"); // 48-char hex
      const expiresAt = new Date(Date.now() + PAIRING_TTL_MINUTES * 60 * 1000);

      const pairing = await prisma.displayPairing.create({
        data: { displayId: id, token, expiresAt },
      });

      // Mark display as awaiting
      await prisma.venueDisplay.update({
        where: { id },
        data: { status: "awaiting", currentMatchId: null },
      });

      res.status(201).json({
        success: true,
        data: {
          token: pairing.token,
          displayId: display.id,
          courtName: display.courtName,
          venueName: display.venue.name,
          expiresAt: pairing.expiresAt,
          // The URL the TV should open
          displayUrl: `${process.env.CLIENT_ORIGIN || "http://localhost:5173"}/display/pair/${pairing.token}`,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/displays/pairing/:token — public: get pairing state (TV polls this as fallback)
router.get(
  "/pairing/:token",
  validate({ params: tokenParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.params as unknown as z.infer<typeof tokenParamSchema>;

      const pairing = await prisma.displayPairing.findUnique({
        where: { token },
        include: {
          display: { select: { id: true, courtName: true, venueId: true } },
          match: { select: { id: true, sportName: true, status: true } },
        },
      });

      if (!pairing) throw new NotFoundError("Pairing session");
      if (pairing.expiresAt < new Date()) {
        return res.json({ success: true, data: { status: "expired" } });
      }

      res.json({
        success: true,
        data: {
          status: pairing.claimedAt ? "claimed" : "waiting",
          courtName: pairing.display.courtName,
          displayId: pairing.display.id,
          matchId: pairing.matchId ?? null,
          match: pairing.match ?? null,
          expiresAt: pairing.expiresAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/displays/claim/:token — authenticated user claims display for a match
router.post(
  "/claim/:token",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: tokenParamSchema, body: claimSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.params as unknown as z.infer<typeof tokenParamSchema>;
      const { matchId } = req.body as z.infer<typeof claimSchema>;

      const pairing = await prisma.displayPairing.findUnique({
        where: { token },
        include: {
          display: { select: { id: true, courtName: true, venueId: true } },
        },
      });

      if (!pairing) throw new NotFoundError("Pairing session");
      if (pairing.expiresAt < new Date()) throw new BadRequestError("Pairing session has expired");
      if (pairing.claimedAt) throw new BadRequestError("Pairing session already claimed");

      const match = await prisma.match.findUnique({ where: { id: matchId } });
      if (!match) throw new NotFoundError("Match");
      if (match.createdById !== req.userId) {
        throw new ForbiddenError("Only the match creator can link a display");
      }

      // Claim the pairing and update display
      const [updatedPairing] = await Promise.all([
        prisma.displayPairing.update({
          where: { token },
          data: { matchId, claimedAt: new Date() },
        }),
        prisma.venueDisplay.update({
          where: { id: pairing.displayId },
          data: { currentMatchId: matchId, status: "live" },
        }),
      ]);

      // Push socket event to the TV waiting in the pairing room
      emitToDisplay(token, "display:paired", {
        matchId,
        displayId: pairing.display.id,
        courtName: pairing.display.courtName,
        sportName: match.sportName,
      });

      res.json({
        success: true,
        data: {
          matchId,
          displayId: pairing.displayId,
          courtName: pairing.display.courtName,
          claimedAt: updatedPairing.claimedAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/displays/:id — remove a court (venue owner)
router.delete(
  "/:id",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;

      const display = await prisma.venueDisplay.findUnique({
        where: { id },
        include: { venue: { select: { ownerId: true } } },
      });
      if (!display) throw new NotFoundError("Display");
      if (display.venue.ownerId !== req.userId) throw new ForbiddenError("Not your venue");

      await prisma.venueDisplay.delete({ where: { id } });

      res.json({ success: true, message: "Display deleted" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
