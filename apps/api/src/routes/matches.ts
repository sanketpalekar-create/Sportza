import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { registry } from "../lib/openapi";
import { validate } from "../middleware/validate";
import { jwtCheck, attachUser, requireAuth } from "../middleware/auth";
import { NotFoundError, BadRequestError, ForbiddenError } from "../lib/errors";
import { idParamSchema, paginationSchema } from "../schemas/common";
import { processMatchResult } from "../services/scoring";
import { emitToMatch } from "../lib/socket";
import { createBulkNotifications, NotifType } from "../services/notificationService";

/** Extract unique numeric player IDs from a teams JSON field. */
function extractPlayerIds(teams: unknown): number[] {
  if (!teams || typeof teams !== "object") return [];
  const t = teams as Record<string, unknown>;
  const ids: number[] = [];
  for (const side of Object.values(t)) {
    if (side && typeof side === "object") {
      const s = side as Record<string, unknown>;
      if (Array.isArray(s.players)) {
        for (const p of s.players) {
          const id = typeof p === "number" ? p : typeof p === "object" && p !== null ? (p as any).userId ?? (p as any).id : undefined;
          if (typeof id === "number" && !ids.includes(id)) ids.push(id);
        }
      }
    }
  }
  return ids;
}

const router: Router = Router();

const listMatchesQuerySchema = paginationSchema.extend({
  sportId: z.coerce.number().int().positive().optional(),
  status: z.string().optional(),
  userId: z.coerce.number().int().positive().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const createMatchSchema = z.object({
  sportId: z.coerce.number().int().positive(),
  formatId: z.coerce.number().int().positive().optional(),
  formatName: z.string().min(1).optional(),
  playersPerTeam: z.coerce.number().int().positive().optional(),
  venueId: z.coerce.number().int().positive().optional(),
  matchDate: z.string().regex(/^\d{4}-\d{2}-\d{2}T[\d:.-]+Z?$/).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  teams: z.record(z.unknown()).optional(),
  matchType: z.enum(["COMPETITIVE", "FRIENDLY", "PRACTICE", "OPEN_PLAY", "TOURNAMENT"]).default("COMPETITIVE"),
  // Engine state persisted as initial scores JSON
  scores: z.record(z.unknown()).optional(),
  // Identifies which scoring engine to use (e.g. "tennis", "basketball")
  scoreType: z.string().optional(),
});

const updateMatchSchema = createMatchSchema.partial();

const updateScoreSchema = z.object({
  // Accept any JSON — engine states are nested objects, not flat number maps
  scores: z.record(z.unknown()),
  winnerTeam: z.string().optional(),
});

const addEventSchema = z.object({
  team: z.string().min(1),
  playerId: z.coerce.number().int().positive().optional(),
  eventType: z.string().min(1),
  eventValue: z.coerce.number().int().default(1),
  metadata: z.record(z.unknown()).optional(),
});

const confirmSchema = z.object({
  status: z.enum(["CONFIRMED", "DECLINED", "PENDING"]).default("CONFIRMED"),
});

const updateStatusSchema = z.object({
  status: z.enum(["scheduled", "live", "completed", "cancelled"]),
});

// GET / - List matches with filters and pagination
router.get(
  "/",
  validate({ query: listMatchesQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sportId, status, userId, startDate, endDate } = req.query as unknown as z.infer<
        typeof listMatchesQuerySchema
      >;
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = {};
      if (sportId) where.sportId = sportId;
      if (status) where.status = status;
      if (userId) where.createdById = userId;
      if (startDate || endDate) {
        where.matchDate = {};
        if (startDate)
          (where.matchDate as Record<string, Date>).gte = new Date(startDate);
        if (endDate)
          (where.matchDate as Record<string, Date>).lte = new Date(
            endDate + "T23:59:59.999Z"
          );
      }

      const [matches, total] = await Promise.all([
        prisma.match.findMany({
          where,
          include: {
            sport: { select: { name: true, displayName: true } },
            venue: { select: { id: true, name: true, location: { select: { city: true } } } },
          },
          orderBy: { matchDate: "desc" },
          skip,
          take: limit,
        }),
        prisma.match.count({ where }),
      ]);

      res.json({
        success: true,
        data: matches,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /pending-confirmations - List matches awaiting player confirmation (auth required)
router.get(
  "/pending-confirmations",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ query: paginationSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query as unknown as z.infer<typeof paginationSchema>;
      const userId = req.userId!;
      const skip = (page - 1) * limit;

      const [confirmations, total] = await Promise.all([
        prisma.matchConfirmation.findMany({
          where: { playerId: userId, status: "PENDING" },
          include: { match: { include: { sport: { select: { name: true, displayName: true } }, venue: { select: { id: true, name: true } } } } },
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.matchConfirmation.count({ where: { playerId: userId, status: "PENDING" } }),
      ]);

      res.json({
        success: true,
        data: confirmations,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      next(err);
    }
  }
);

const historyQuerySchema = paginationSchema.extend({
  sportName: z.string().optional(),
});

// GET /history - Player's match history (auth required)
router.get(
  "/history",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ query: historyQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sportName } = req.query as unknown as z.infer<typeof historyQuerySchema>;
      const userId = req.userId!;
      const skip = (page - 1) * limit;

      const baseWhere = {
        status: "completed",
        OR: [
          { teams: { path: ["teamA", "players"] as unknown as string, array_contains: userId } },
          { teams: { path: ["teamB", "players"] as unknown as string, array_contains: userId } },
        ],
        ...(sportName ? { sportName } : {}),
      };

      const matches = await prisma.match.findMany({
        where: baseWhere,
        include: { sport: { select: { name: true, displayName: true } }, venue: { select: { id: true, name: true } } },
        orderBy: { matchDate: "desc" },
        skip,
        take: limit,
      });
      const total = await prisma.match.count({ where: baseWhere });

      res.json({
        success: true,
        data: matches,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /recent - Recent platform matches
router.get(
  "/recent",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const matches = await prisma.match.findMany({
        orderBy: { matchDate: "desc" },
        take: 10,
        include: { sport: { select: { name: true, displayName: true } } },
      });
      res.json({ success: true, data: matches });
    } catch (err) {
      next(err);
    }
  }
);

// GET /:id - Get match details with events and confirmations
router.get(
  "/:id",
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;

      const match = await prisma.match.findUnique({
        where: { id },
        include: {
          sport: { select: { name: true, displayName: true } },
            venue: { select: { id: true, name: true, location: { select: { address: true, city: true } } } },
          events: { orderBy: { eventTimestamp: "asc" }, include: { player: { select: { id: true, name: true } } } },
          confirmations: { include: { player: { select: { id: true, name: true, avatar: true } } } },
        },
      });

      if (!match) throw new NotFoundError("Match");

      res.json({ success: true, data: match });
    } catch (err) {
      next(err);
    }
  }
);

// POST / - Create match (requires auth)
router.post(
  "/",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ body: createMatchSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as z.infer<typeof createMatchSchema>;
      const userId = req.userId!;

      const sport = await prisma.sport.findUnique({
        where: { id: body.sportId },
        include: { formats: true },
      });
      if (!sport) throw new NotFoundError("Sport");

      let formatName = body.formatName ?? sport.formats[0]?.name ?? "Default";
      let playersPerTeam = body.playersPerTeam ?? sport.formats[0]?.playersPerTeam ?? null;

      if (body.formatId) {
        const format = await prisma.sportFormat.findUnique({
          where: { id: body.formatId },
        });
        if (format) {
          formatName = format.name;
          playersPerTeam = format.playersPerTeam;
        }
      }

      if (body.venueId) {
        const venue = await prisma.venue.findUnique({
          where: { id: body.venueId },
        });
        if (!venue) throw new NotFoundError("Venue");
      }

      const matchDate =
        typeof body.matchDate === "string" && body.matchDate.length <= 10
          ? new Date(body.matchDate + "T12:00:00.000Z")
          : new Date(body.matchDate);

      const formatRecord = body.formatId
        ? await prisma.sportFormat.findUnique({ where: { id: body.formatId } })
        : await prisma.sportFormat.findFirst({
            where: { sportId: sport.id, name: formatName },
          });

      let finalScoreType: string | undefined = body.scoreType ?? undefined;
      if (!finalScoreType && sport.name.toLowerCase() === "pickleball") {
        const cfg = formatRecord?.config as { scoringType?: string } | null | undefined;
        if (cfg?.scoringType === "pickleball_service") finalScoreType = "pickleball_service";
        else if (cfg?.scoringType === "pickleball_rally") finalScoreType = "pickleball_rally";
        else if (formatName.toLowerCase().includes("service")) finalScoreType = "pickleball_service";
        else finalScoreType = "pickleball_rally";
      }
      if (!finalScoreType && sport.name.toLowerCase() === "padel") {
        finalScoreType = "padel";
      }

      const match = await prisma.match.create({
        data: {
          sportId: body.sportId,
          sportName: sport.name,
          formatName,
          playersPerTeam,
          venueId: body.venueId,
          matchDate,
          teams: (body.teams ?? {}) as any,
          matchType: body.matchType ?? "COMPETITIVE",
          status: "scheduled",
          createdById: userId,
          ...(body.scores ? { scores: body.scores as any } : {}),
          ...(finalScoreType ? { scoreType: finalScoreType } : {}),
        },
      });

      await prisma.activity.create({
        data: {
          type: "match",
          sport: sport.name,
          venueId: body.venueId ?? null,
          referenceId: match.id,
          createdById: userId,
          date: matchDate,
          status: "scheduled",
        },
      });

      // Notify all players in both teams (non-blocking)
      const scheduledPlayerIds = extractPlayerIds(match.teams);
      if (scheduledPlayerIds.length) {
        void createBulkNotifications(
          scheduledPlayerIds,
          NotifType.MATCH_SCHEDULED,
          "Match scheduled",
          `A ${sport.name} match has been scheduled for ${new Date(matchDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}.`,
          { matchId: match.id }
        );
      }

      res.status(201).json({ success: true, data: match });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /:id - Update match (creator only)
router.put(
  "/:id",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema, body: updateMatchSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const body = req.body as z.infer<typeof updateMatchSchema>;
      const userId = req.userId!;

      const match = await prisma.match.findUnique({ where: { id } });
      if (!match) throw new NotFoundError("Match");
      if (match.createdById !== userId) {
        throw new ForbiddenError("Only the match creator can update this match");
      }

      const updateData: Record<string, unknown> = {};
      if (body.sportId !== undefined) {
        const sport = await prisma.sport.findUnique({ where: { id: body.sportId } });
        if (!sport) throw new NotFoundError("Sport");
        updateData.sportId = body.sportId;
        updateData.sportName = sport.name;
      }
      if (body.playersPerTeam !== undefined) updateData.playersPerTeam = body.playersPerTeam;
      if (body.formatName !== undefined) updateData.formatName = body.formatName;
      if (body.venueId !== undefined) updateData.venueId = body.venueId;
      if (body.matchDate !== undefined) {
        updateData.matchDate =
          typeof body.matchDate === "string" && body.matchDate.length <= 10
            ? new Date(body.matchDate + "T12:00:00.000Z")
            : new Date(body.matchDate);
      }
      if (body.teams !== undefined) updateData.teams = body.teams;
      if (body.matchType !== undefined) updateData.matchType = body.matchType;

      const updated = await prisma.match.update({
        where: { id },
        data: updateData,
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /:id/score - Update match score
router.put(
  "/:id/score",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema, body: updateScoreSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const { scores, winnerTeam } = req.body as z.infer<typeof updateScoreSchema>;

      const match = await prisma.match.findUnique({ where: { id } });
      if (!match) throw new NotFoundError("Match");

      // Allow the match creator OR any co-organizer of the linked tournament
      const isMatchCreator = match.createdById === req.userId;
      let isCoOrg = false;
      if (!isMatchCreator && match.tournamentId) {
        const coOrg = await prisma.tournamentCoOrganizer.findUnique({
          where: { tournamentId_userId: { tournamentId: match.tournamentId, userId: req.userId! } },
        });
        isCoOrg = coOrg !== null;
      }
      if (!isMatchCreator && !isCoOrg) {
        throw new ForbiddenError("Only the match creator or a tournament co-organizer can update the score");
      }

      const updated = await prisma.match.update({
        where: { id },
        data: {
          scores: scores as object,
          winnerTeam: winnerTeam ?? undefined,
        },
      });

      // Broadcast score update to scoreboard displays
      emitToMatch(id, "match:score", {
        matchId: id,
        scores: updated.scores,
        winnerTeam: updated.winnerTeam,
        status: updated.status,
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// POST /:id/events - Add match event (creator only)
router.post(
  "/:id/events",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema, body: addEventSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const body = req.body as z.infer<typeof addEventSchema>;

      const match = await prisma.match.findUnique({ where: { id } });
      if (!match) throw new NotFoundError("Match");
      if (match.createdById !== req.userId) {
        throw new ForbiddenError("Only the match creator can add events");
      }

      const event = await prisma.matchEvent.create({
        data: {
          matchId: id,
          team: body.team,
          playerId: body.playerId,
          eventType: body.eventType,
          eventValue: body.eventValue,
          metadata: (body.metadata ?? {}) as object,
        },
        include: { player: { select: { id: true, name: true } } },
      });

      // Broadcast new event to scoreboard displays
      emitToMatch(id, "match:event", {
        matchId: id,
        event: {
          id: event.id,
          team: event.team,
          eventType: event.eventType,
          eventValue: event.eventValue,
          playerName: event.player?.name ?? null,
          eventTimestamp: event.eventTimestamp,
        },
      });

      res.status(201).json({ success: true, data: event });
    } catch (err) {
      next(err);
    }
  }
);

// POST /:id/confirm - Player confirms match participation
router.post(
  "/:id/confirm",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema, body: confirmSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const { status } = req.body as z.infer<typeof confirmSchema>;
      const userId = req.userId!;

      const match = await prisma.match.findUnique({ where: { id } });
      if (!match) throw new NotFoundError("Match");

      const confirmation = await prisma.matchConfirmation.upsert({
        where: {
          matchId_playerId: { matchId: id, playerId: userId },
        },
        create: {
          matchId: id,
          playerId: userId,
          status,
          respondedAt: new Date(),
        },
        update: {
          status,
          respondedAt: new Date(),
        },
        include: { player: { select: { id: true, name: true } } },
      });

      res.json({ success: true, data: confirmation });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /:id/status - Update match status
router.put(
  "/:id/status",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema, body: updateStatusSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const { status } = req.body as z.infer<typeof updateStatusSchema>;

      const match = await prisma.match.findUnique({ where: { id } });
      if (!match) throw new NotFoundError("Match");
      if (match.createdById !== req.userId) {
        throw new ForbiddenError("Only the match creator can update the status");
      }

      const updated = await prisma.match.update({
        where: { id },
        data: { status },
      });

      emitToMatch(id, "match:status", { matchId: id, status: updated.status });

      // Keep the linked tournament fixture in sync
      if (status === "completed" || status === "live") {
        const fixtureStatus = status === "completed" ? "completed" : "in_progress";
        await prisma.tournamentFixture.updateMany({
          where: { matchId: id },
          data:  { status: fixtureStatus },
        });
      }

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

const updatePlayerStatsSchema = z.object({
  playerStats: z.record(z.unknown()),
});

const autoCreateMatchSchema = z.object({
  bookingId: z.coerce.number().int().positive(),
  teams: z.record(z.unknown()).optional(),
});

// PUT /:id/start - Start match (creator only)
router.put(
  "/:id/start",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;

      const match = await prisma.match.findUnique({ where: { id } });
      if (!match) throw new NotFoundError("Match");
      if (match.createdById !== req.userId) {
        throw new ForbiddenError("Only the match creator can start this match");
      }

      const updated = await prisma.match.update({
        where: { id },
        data: { status: "live" },
      });

      emitToMatch(id, "match:status", { matchId: id, status: "live" });

      // Notify all players (non-blocking)
      const livePlayerIds = extractPlayerIds(updated.teams);
      if (livePlayerIds.length) {
        void createBulkNotifications(
          livePlayerIds,
          NotifType.MATCH_LIVE,
          "Match is live!",
          `Your ${updated.sportName} match has started. Good luck!`,
          { matchId: id }
        );
      }

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /:id/complete - Complete match (creator only)
router.put(
  "/:id/complete",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;

      const match = await prisma.match.findUnique({ where: { id } });
      if (!match) throw new NotFoundError("Match");
      if (match.createdById !== req.userId) {
        throw new ForbiddenError("Only the match creator can complete this match");
      }

      await prisma.match.update({
        where: { id },
        data: { status: "completed" },
      });

      emitToMatch(id, "match:status", { matchId: id, status: "completed" });

      await processMatchResult(id);

      // Keep the linked tournament fixture in sync
      await prisma.tournamentFixture.updateMany({
        where: { matchId: id },
        data:  { status: "completed" },
      });

      const updated = await prisma.match.findUnique({ where: { id } });

      // Notify all players of result (non-blocking)
      const completedPlayerIds = extractPlayerIds(match.teams);
      if (completedPlayerIds.length) {
        const scoresRaw = (updated?.scores ?? match.scores) as Record<string, unknown> | null;
        const scoreStr = scoresRaw ? JSON.stringify(scoresRaw) : "Check the app for the result";
        void createBulkNotifications(
          completedPlayerIds,
          NotifType.MATCH_COMPLETED,
          "Match completed",
          `Your ${match.sportName} match has ended. Final scores: ${scoreStr}.`,
          { matchId: id }
        );
      }

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /:id/player-stats - Update player stats for match (creator only)
router.put(
  "/:id/player-stats",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema, body: updatePlayerStatsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const { playerStats } = req.body as z.infer<typeof updatePlayerStatsSchema>;

      const match = await prisma.match.findUnique({ where: { id } });
      if (!match) throw new NotFoundError("Match");
      if (match.createdById !== req.userId) {
        throw new ForbiddenError("Only the match creator can update player stats");
      }

      const updated = await prisma.match.update({
        where: { id },
        data: { playerStats: playerStats as object },
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// POST /auto-create - Auto-create match from booking
router.post(
  "/auto-create",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ body: autoCreateMatchSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { bookingId, teams } = req.body as z.infer<typeof autoCreateMatchSchema>;
      const userId = req.userId!;

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { venue: true },
      });
      if (!booking) throw new NotFoundError("Booking");
      if (booking.userId !== userId) {
        throw new ForbiddenError("You can only create matches for your own bookings");
      }

      const sport = await prisma.sport.findFirst({
        where: { name: booking.sport },
      });
      if (!sport) throw new NotFoundError("Sport");

      const match = await prisma.match.create({
        data: {
          bookingId,
          sportId: sport.id,
          sportName: sport.name,
          formatName: "Default",
          matchDate: booking.bookingDate,
          venueId: booking.venueId,
          teams: (teams ?? {}) as any,
          status: "scheduled",
          createdById: userId,
        },
      });

      res.status(201).json({ success: true, data: match });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
