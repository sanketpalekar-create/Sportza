import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { jwtCheck, attachUser, requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { NotFoundError } from "../lib/errors";
import { processMatchResult } from "../services/scoring";

const router: Router = Router();

const playerIdParamSchema = z.object({
  playerId: z.coerce.number().int().positive(),
});

const recalculateSchema = z.object({
  sport: z.string().min(1),
});

const leaderboardQuerySchema = z.object({
  sport: z.string().optional(),
  city:  z.string().optional(),
  state: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// GET /player/:playerId - Get a specific player's stats (public, no PII)
router.get(
  "/player/:playerId",
  validate({ params: playerIdParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { playerId } = req.params as unknown as z.infer<typeof playerIdParamSchema>;

      const stats = await prisma.playerStats.findMany({
        where: { playerId },
        orderBy: { lastUpdated: "desc" },
        include: { player: { select: { id: true, name: true, avatar: true } } },
      });

      if (stats.length === 0) throw new NotFoundError("Player stats");

      res.json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  }
);

// GET /me/sport-summary - Get current user's aggregated sport summary (auth required)
router.get(
  "/me/sport-summary",
  jwtCheck,
  attachUser,
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;

      const stats = await prisma.playerStats.findMany({
        where: { playerId: userId },
        orderBy: { lastUpdated: "desc" },
      });

      const bySport = stats.reduce<Record<string, { totalMatches: number; matchesWon: number; matchesLost: number; winPercentage: number }>>(
        (acc, s) => {
          acc[s.sport] = {
            totalMatches: s.totalMatches,
            matchesWon: s.matchesWon,
            matchesLost: s.matchesLost,
            winPercentage: s.winPercentage,
          };
          return acc;
        },
        {}
      );

      res.json({ success: true, data: bySport });
    } catch (err) {
      next(err);
    }
  }
);

// GET /me - Current user's stats (authenticated)
router.get(
  "/me",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ query: leaderboardQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { sport } = req.query as unknown as z.infer<typeof leaderboardQuerySchema>;

      const where: { playerId: number; sport?: string } = { playerId: userId };
      if (sport) where.sport = sport;

      const stats = await prisma.playerStats.findMany({
        where,
        orderBy: { lastUpdated: "desc" },
      });

      res.json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  }
);

// GET /leaderboard - Leaderboard by sport (public)
router.get(
  "/leaderboard",
  validate({ query: leaderboardQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sport, limit, city, state } = req.query as unknown as z.infer<typeof leaderboardQuerySchema>;

      const where: { sport?: string; player?: { location?: { city?: string; state?: string } } } = {};
      if (sport) where.sport = sport;
      if (city || state) {
        where.player = { location: {} };
        if (city)  where.player.location!.city  = city;
        if (state) where.player.location!.state = state;
      }

      const leaderboard = await prisma.playerStats.findMany({
        where,
        include: {
          player: { select: { id: true, name: true, avatar: true, location: { select: { city: true, state: true } } } },
        },
        orderBy: [{ winPercentage: "desc" }, { totalMatches: "desc" }],
        take: limit,
      });

      const items = leaderboard.map((s) => ({
        sport: s.sport,
        totalMatches: s.totalMatches,
        matchesWon: s.matchesWon,
        matchesLost: s.matchesLost,
        winPercentage: s.winPercentage,
        player: s.player,
      }));

      res.json({ success: true, data: items });
    } catch (err) {
      next(err);
    }
  }
);

// POST /recalculate - Recalculate stats for a sport from PlayerActivityStats (admin only)
router.post(
  "/recalculate",
  jwtCheck,
  attachUser,
  requireAuth,
  requireRole("admin"),
  validate({ body: recalculateSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sport } = req.body as z.infer<typeof recalculateSchema>;

      // Clear existing aggregated stats for this sport
      await prisma.playerStats.deleteMany({ where: { sport } });
      await prisma.playerActivityStats.deleteMany({ where: { sport } });

      // Re-process all completed matches to rebuild PlayerActivityStats + PlayerStats
      const matches = await prisma.match.findMany({
        where: { status: "completed", sportName: sport },
        orderBy: { matchDate: "asc" },
      });

      for (const match of matches) {
        await processMatchResult(match.id);
      }

      res.json({ success: true, message: `Recalculated stats for ${matches.length} matches` });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
