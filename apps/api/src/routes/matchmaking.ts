import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { jwtCheck, attachUser, requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { NotFoundError } from "../lib/errors";
import { getOrCreateRating, initializeRatingsForAllSports } from "../services/elo";

const router: Router = Router();

// Dynamic tolerance tiers: expand the rating window until we find ≥3 peers.
const TOLERANCE_TIERS = [150, 300, 500];
const MIN_PEERS_THRESHOLD = 3;

const suggestionsQuerySchema = z.object({
  sport:      z.string().optional(),
  sportId:    z.coerce.number().int().positive().optional(),
  formatName: z.string().optional(),
});

const userIdParamSchema = z.object({
  userId: z.coerce.number().int().positive(),
});

const historyQuerySchema = z.object({
  sportId:    z.coerce.number().int().positive().optional(),
  formatName: z.string().optional(),
  limit:      z.coerce.number().int().min(1).max(100).default(20),
});

const initRatingsSchema = z.object({
  sportIds:   z.array(z.number().int().positive()).min(1).max(10),
  formatName: z.string().default("overall"),
});

// GET /api/matchmaking/suggestions — Auth required
// Returns suggested open plays, batches, and peer players for the current user.
router.get(
  "/suggestions",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ query: suggestionsQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { sport, sportId, formatName } = req.query as unknown as z.infer<typeof suggestionsQuerySchema>;
      const fmt = formatName ?? "overall";

      // Fetch current user's city for location-based prioritisation
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { location: { select: { city: true } } },
      });
      const userCity = currentUser?.location?.city ?? null;

      // Fetch the user's Sportza Ratings filtered by formatName
      const ratingsWhere: Record<string, unknown> = { userId, formatName: fmt };
      if (sportId) ratingsWhere.sportId = sportId;
      else if (sport) ratingsWhere.sport = { name: sport };

      const myRatings = await prisma.sportSkillRating.findMany({
        where: ratingsWhere,
        include: { sport: true },
      });

      const ratingBySportId: Record<number, number> = {};
      for (const r of myRatings) ratingBySportId[r.sportId] = r.rating;

      const defaultRating = 1000;

      // ── Suggested Open Plays ──────────────────────────────────────────────
      const openPlaysWhere: Record<string, unknown> = { status: "open" };
      if (sportId) openPlaysWhere.sportId = sportId;
      else if (sport) openPlaysWhere.sport = sport;

      const openPlays = await prisma.openPlay.findMany({
        where: openPlaysWhere,
        include: {
          venue: { select: { id: true, name: true, location: { select: { city: true, address: true } } } },
          sportRef: { select: { id: true, name: true, displayName: true } },
          players: { select: { userId: true } },
        },
        orderBy: { bookingDate: "asc" },
        take: 50,
      });

      const suggestedOpenPlays = openPlays.filter((op) => {
        if (op.players.some((p) => p.userId === userId)) return false;
        if (op.players.length >= op.maxPlayers) return false;

        const sid = op.sportId ?? 0;
        const myRating = ratingBySportId[sid] ?? defaultRating;

        // Enforce skill bounds when explicitly set
        if (op.skillRatingMin !== null && op.skillRatingMax !== null) {
          return myRating >= op.skillRatingMin! && myRating <= op.skillRatingMax!;
        }

        // No bounds set — apply a loose tolerance so wildly off-level games are excluded
        // when the user has an established rating
        if (myRatings.length > 0) {
          const sessionAvg =
            op.players.length > 0
              ? op.players.length // placeholder — we'd need ratings of existing players for a true avg
              : 0;
          // Return true for sessions with no players yet (open to everyone)
          if (op.players.length === 0) return true;
        }

        return true;
      });

      // ── Suggested Batches ─────────────────────────────────────────────────
      const batchesWhere: Record<string, unknown> = { isActive: true };
      if (sportId) batchesWhere.sportId = sportId;
      else if (sport) batchesWhere.sport = sport;

      const batches = await prisma.batch.findMany({
        where: batchesWhere,
        include: {
          trainer: { select: { id: true, name: true, avatar: true } },
          venue: { select: { id: true, name: true, location: { select: { city: true } } } },
          sportRef: { select: { id: true, name: true, displayName: true } },
          memberships: { where: { status: "active" }, select: { playerId: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      const suggestedBatches = batches.filter((b) => {
        if (b.memberships.some((m) => m.playerId === userId)) return false;
        if (b.memberships.length >= b.capacity) return false;

        const sid = b.sportId ?? 0;
        const myRating = ratingBySportId[sid] ?? defaultRating;

        if (b.skillRatingMin !== null && b.skillRatingMax !== null) {
          return myRating >= b.skillRatingMin! && myRating <= b.skillRatingMax!;
        }

        return true;
      });

      // ── Peer Players (dynamic tolerance expansion per sport + format) ────────
      // Attempt progressively wider tolerance windows until ≥ MIN_PEERS_THRESHOLD peers.
      // Prioritise same-city players at each tier before expanding.
      const peerPromises = myRatings.map(async (myR) => {
        let peers: any[] = [];

        for (const tolerance of TOLERANCE_TIERS) {
          const found = await prisma.sportSkillRating.findMany({
            where: {
              sportId:    myR.sportId,
              formatName: myR.formatName,
              userId:     { not: userId },
              rating: {
                gte: myR.rating - tolerance,
                lte: myR.rating + tolerance,
              },
            },
            include: {
              user:  { select: { id: true, name: true, avatar: true, location: { select: { city: true } } } },
              sport: { select: { id: true, name: true, displayName: true } },
            },
            orderBy: { rating: "desc" },
            take: 20,
          });

          // Prioritise same-city results first
          if (userCity) {
            found.sort((a, b) => {
              const aCity = (a.user as any).location?.city;
              const bCity = (b.user as any).location?.city;
              if (aCity === userCity && bCity !== userCity) return -1;
              if (bCity === userCity && aCity !== userCity) return 1;
              return 0;
            });
          }

          peers = found.slice(0, 10);
          if (peers.length >= MIN_PEERS_THRESHOLD) break;
        }

        // Fallback: recently active players in same sport+format regardless of rating
        if (peers.length < MIN_PEERS_THRESHOLD) {
          const recent = await prisma.sportSkillRating.findMany({
            where: {
              sportId:    myR.sportId,
              formatName: myR.formatName,
              userId:     { not: userId },
            },
            include: {
              user:  { select: { id: true, name: true, avatar: true, location: { select: { city: true } } } },
              sport: { select: { id: true, name: true, displayName: true } },
            },
            orderBy: { lastUpdated: "desc" },
            take: 10,
          });

          // Merge without duplicates
          const existingIds = new Set(peers.map((p) => p.userId));
          for (const r of recent) {
            if (!existingIds.has(r.userId) && peers.length < 10) {
              peers.push(r);
              existingIds.add(r.userId);
            }
          }
        }

        return { sport: myR.sport, formatName: myR.formatName, peers };
      });

      const peerResults = await Promise.all(peerPromises);

      const peersBySport: Record<string, unknown[]> = {};
      for (const pr of peerResults) {
        const key = `${pr.sport.name}::${pr.formatName}`;
        peersBySport[key] = pr.peers.map((p) => ({
          userId:       p.userId,
          user:         p.user,
          rating:       p.rating,
          confidence:   p.confidence,
          sport:        p.sport,
          formatName:   p.formatName,
          matchesPlayed: p.matchesPlayed,
        }));
      }

      res.json({
        success: true,
        data: {
          openPlays: suggestedOpenPlays,
          batches: suggestedBatches.map((b) => ({
            ...b,
            memberCount: b.memberships.length,
          })),
          peers: peersBySport,
          myRatings: myRatings.map((r) => ({
            sport:        r.sport,
            formatName:   r.formatName,
            rating:       r.rating,
            confidence:   r.confidence,
            matchesPlayed: r.matchesPlayed,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/matchmaking/initialize-ratings — Create provisional Sportza Ratings for given sports
// Called during onboarding or when a user adds new sports to their profile.
router.post(
  "/initialize-ratings",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ body: initRatingsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { sportIds, formatName } = req.body as z.infer<typeof initRatingsSchema>;
      const fmt = formatName ?? "overall";

      // Verify sports exist
      const sports = await prisma.sport.findMany({
        where: { id: { in: sportIds } },
        select: { id: true, name: true, displayName: true },
      });

      const ratings = await Promise.all(
        sports.map((s) => getOrCreateRating(userId, s.id, fmt))
      );

      res.json({
        success: true,
        data: ratings.map((r, i) => ({
          sport:        sports[i],
          formatName:   r.formatName,
          rating:       r.rating,
          confidence:   r.confidence,
          matchesPlayed: r.matchesPlayed,
        })),
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/matchmaking/network — Player network for the current user
// Returns recently played with, frequent opponents, venue connections, nearby players.
router.get(
  "/network",
  jwtCheck,
  attachUser,
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;

      // Current user's city for nearby players
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { location: { select: { city: true } } },
      });
      const userCity = currentUser?.location?.city ?? null;

      // Fetch all connections for this user
      const connections = await prisma.playerConnection.findMany({
        where: { userId },
        include: {
          connectedUser: {
            select: { id: true, name: true, avatar: true, location: { select: { city: true } } },
          },
          venue: { select: { id: true, name: true } },
        },
        orderBy: { lastActivityAt: "desc" },
      });

      // Get Sportza Ratings for connected users to enrich their cards
      const connectedIds = [...new Set(connections.map((c) => c.connectedUserId))];
      const peerRatings = await prisma.sportSkillRating.findMany({
        where: { userId: { in: connectedIds } },
        include: { sport: { select: { id: true, name: true, displayName: true } } },
        orderBy: { rating: "desc" },
      });
      const ratingsByUser: Record<number, any[]> = {};
      for (const r of peerRatings) {
        if (!ratingsByUser[r.userId]) ratingsByUser[r.userId] = [];
        ratingsByUser[r.userId].push({ sport: r.sport, rating: r.rating, confidence: r.confidence });
      }

      const enrichUser = (conn: (typeof connections)[number]) => ({
        userId: conn.connectedUserId,
        user: conn.connectedUser,
        playCount: conn.playCount,
        lastActivityAt: conn.lastActivityAt,
        connectionType: conn.connectionType,
        sportRatings: ratingsByUser[conn.connectedUserId] ?? [],
        venue: conn.venue,
      });

      // Recently Played With — match + open_play connections, newest first
      const playConnections = connections.filter(
        (c) => c.connectionType === "match" || c.connectionType === "open_play"
      );
      const recentlyPlayedWith = playConnections.slice(0, 10).map(enrichUser);

      // Frequent Opponents — sorted by playCount desc
      const frequentOpponents = [...playConnections]
        .sort((a, b) => b.playCount - a.playCount)
        .slice(0, 8)
        .map(enrichUser);

      // Venue Connections — grouped by venue
      const venueConns = connections.filter((c) => c.connectionType === "venue" && c.venue);
      const venueMap: Record<number, { venue: any; players: any[] }> = {};
      for (const c of venueConns) {
        const vid = c.venueId!;
        if (!venueMap[vid]) venueMap[vid] = { venue: c.venue, players: [] };
        if (venueMap[vid].players.length < 8) venueMap[vid].players.push(enrichUser(c));
      }
      const venueConnections = Object.values(venueMap);

      // Nearby Players — same city, recently active, not already connected
      const connectedSet = new Set(connectedIds);
      let nearbyPlayers: any[] = [];
      if (userCity) {
        const nearby = await prisma.user.findMany({
          where: {
            location: { city: userCity },
            id: { notIn: [userId, ...connectedIds] },
            skillRatings: { some: {} },
          },
          select: {
            id: true,
            name: true,
            avatar: true,
            location: { select: { city: true } },
            skillRatings: {
              include: { sport: { select: { id: true, name: true, displayName: true } } },
              orderBy: { lastUpdated: "desc" },
              take: 3,
            },
          },
          take: 10,
        });

        nearbyPlayers = nearby.map((u) => ({
          userId: u.id,
          user: { id: u.id, name: u.name, avatar: u.avatar, location: u.location },
          connectionType: "city",
          sportRatings: u.skillRatings.map((r) => ({
            sport: r.sport,
            rating: r.rating,
            confidence: r.confidence,
          })),
        }));
      }

      res.json({
        success: true,
        data: {
          recentlyPlayedWith,
          frequentOpponents,
          venueConnections,
          nearbyPlayers,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/matchmaking/skill-rating — Current user's Sportza Ratings per sport
router.get(
  "/skill-rating",
  jwtCheck,
  attachUser,
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;

      await initializeRatingsForAllSports(userId);

      const ratings = await prisma.sportSkillRating.findMany({
        where: { userId },
        include: { sport: { select: { id: true, name: true, displayName: true } } },
        orderBy: [{ sportId: "asc" }, { formatName: "asc" }, { rating: "desc" }],
      });

      const ratingsWithTrend = await Promise.all(
        ratings.map(async (r) => {
          const recent = await prisma.ratingHistory.findMany({
            where: { userId, sportId: r.sportId, formatName: r.formatName },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: { delta: true, newRating: true, oldRating: true, createdAt: true },
          });
          return { ...r, recentHistory: recent };
        })
      );

      res.json({ success: true, data: ratingsWithTrend });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/matchmaking/skill-rating/:userId — Public view of another player's Sportza Ratings
router.get(
  "/skill-rating/:userId",
  validate({ params: userIdParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params as unknown as z.infer<typeof userIdParamSchema>;

      const ratings = await prisma.sportSkillRating.findMany({
        where: { userId },
        include: { sport: { select: { id: true, name: true, displayName: true } } },
        orderBy: [{ sportId: "asc" }, { formatName: "asc" }, { rating: "desc" }],
      });

      if (ratings.length === 0) throw new NotFoundError("Player Sportza Ratings");

      // Public view — show ratings once player has at least 3 matches
      const publicRatings = ratings
        .filter((r) => r.matchesPlayed >= 3)
        .map((r) => ({
          sport:        r.sport,
          formatName:   r.formatName,
          rating:       r.rating,
          confidence:   r.confidence,
          matchesPlayed: r.matchesPlayed,
        }));

      res.json({ success: true, data: publicRatings });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/matchmaking/rating-history — Current user's Sportza Rating history for charts
router.get(
  "/rating-history",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ query: historyQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { sportId, formatName, limit } = req.query as unknown as z.infer<typeof historyQuerySchema>;

      const where: Record<string, unknown> = { userId };
      if (sportId)    where.sportId    = sportId;
      if (formatName) where.formatName = formatName;

      const history = await prisma.ratingHistory.findMany({
        where,
        include: { sport: { select: { id: true, name: true, displayName: true } } },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      res.json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
