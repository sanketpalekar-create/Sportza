import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { registry } from "../lib/openapi";
import { validate } from "../middleware/validate";
import { jwtCheck, attachUser, requireAuth } from "../middleware/auth";
import { NotFoundError, BadRequestError, ConflictError, ForbiddenError } from "../lib/errors";
import { computeStandings, computeTournamentStandings } from "../lib/tournament-standings";
import { buildTournamentWorkbook, tournamentExportFilename } from "../services/tournamentExport";
import { idParamSchema, paginationSchema } from "../schemas/common";
import {
  createEmptyStatsForSport,
  getPlayerStatValue,
  getSportPlayerStatSchema,
  normalizePlayerStats,
} from "../lib/tournament-player-stats";
import { resolveTournamentSport } from "../lib/tournament-sport";
import { createNotification, createBulkNotifications, NotifType } from "../services/notificationService";
import { syncKnockoutBracket, isPointerRef } from "../lib/tournament-bracket-resolve";

/** Extract all user IDs from a tournament's players JSON array. */
function rosterUserIds(players: unknown): number[] {
  if (!Array.isArray(players)) return [];
  return players
    .filter((p) => p && typeof p === "object" && typeof (p as any).userId === "number")
    .map((p) => (p as any).userId as number);
}

/** Keep teams[].playerNames aligned with Tournament.players roster. */
function syncTeamPlayerNames(teams: any[], players: any[]): any[] {
  return teams.map((t) => ({
    ...t,
    playerNames: players
      .filter((p: any) => p?.teamName === t.name)
      .map((p: any) => p.playerName as string)
      .filter(Boolean),
  }));
}

/** Resolve court player names: roster → teams.playerNames → name split. */
function resolveFixturePlayerNames(
  teamName: string,
  teams: any[],
  players: any[]
): string[] {
  const fromRoster = players
    .filter((p: any) => p?.teamName === teamName)
    .map((p: any) => p.playerName as string)
    .filter(Boolean);
  if (fromRoster.length > 0) return fromRoster;

  const tData = teams.find((t: any) => t.name === teamName);
  if ((tData?.playerNames?.length ?? 0) > 0) return tData!.playerNames as string[];

  const sep = teamName.includes("&") ? "&" : "/";
  const parts = teamName.split(sep).map((s) => s.trim()).filter(Boolean);
  return [parts[0] ?? teamName, parts[1] ?? parts[0] ?? teamName];
}

/** Patch a team name inside a fixture team ref JSON object (pending only). */
function renameTeamInRef(ref: Prisma.JsonValue, oldName: string, newName: string): Prisma.JsonValue {
  if (!ref || typeof ref !== "object" || Array.isArray(ref)) return ref;
  const r = ref as Record<string, unknown>;
  if (r.name === oldName) return { ...r, name: newName } as Prisma.JsonValue;
  return ref;
}

// ─── Co-organizer auth helpers ────────────────────────────────────────────────

type TournamentWithCoOrgs = { createdById: number; coOrganizers: { userId: number; role: string }[] };

function getCoOrgRole(t: TournamentWithCoOrgs, userId: number): string | null {
  return t.coOrganizers.find(c => c.userId === userId)?.role ?? null;
}

/** True if the user is creator OR any co-organizer. */
function isOrganizerOrCoOrg(t: TournamentWithCoOrgs, userId: number): boolean {
  return t.createdById === userId || getCoOrgRole(t, userId) !== null;
}

/** True if the user is creator OR a manager co-organizer. */
function isManagerOrAbove(t: TournamentWithCoOrgs, userId: number): boolean {
  const role = getCoOrgRole(t, userId);
  return t.createdById === userId || role === "manager";
}

/** True if the user is creator, manager, or scorer (any co-org role). */
function isScorerOrAbove(t: TournamentWithCoOrgs, userId: number): boolean {
  return isOrganizerOrCoOrg(t, userId);
}

const router: Router = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const listQuerySchema = paginationSchema.extend({
  sport:  z.string().optional(),
  status: z.string().optional(),
});

const stageSchema = z.object({
  stageOrder:      z.number().int().min(1),
  name:            z.string().min(1),
  format:          z.enum(["round_robin", "knockout", "league", "group_knockout"]),
  groupCount:      z.number().int().min(1).optional(),
  advancePerGroup: z.number().int().min(1).optional(),
  bestOf:          z.number().int().min(1).optional(),
  scoringSystem:   z.enum(["rally", "service"]).optional(),
  targetScore:     z.number().int().positive().optional(),
  singleFormat:    z.boolean().optional(),
  playersPerTeam:  z.number().int().min(1).max(4).optional(),
});

const sponsorItemSchema = z.object({
  name:    z.string().min(1),
  logoUrl: z.string().optional(),
  tier:    z.string().optional(),
});

const createBodySchema = z.object({
  name:        z.string().min(1),
  sport:       z.string().min(1),
  format:      z.enum(["league", "knockout", "round-robin"]).default("league"),
  description: z.string().optional(),
  maxTeams:    z.number().int().positive().optional(),
  venueId:     z.number().int().positive().optional(),
  startDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  stages:      z.array(stageSchema).optional(),
  teams:       z.array(z.object({ name: z.string().min(1) })).optional(),
  sponsors:    z.array(sponsorItemSchema).optional(),
});

const updateBodySchema = createBodySchema.partial();

const addTeamBodySchema = z.object({
  teamName: z.string().min(1),
  teamRef:  z.record(z.unknown()).optional(),
});

const statusBodySchema = z.object({
  status: z.enum(["draft", "registration", "in_progress", "completed", "cancelled"]),
});

// ─── Fixture-generation helpers ───────────────────────────────────────────────

/** Circle-method round-robin: guarantees each team plays once per round.
 *  Returns every pair with the round it should be played in. */
function roundRobinPairs(
  teams: unknown[]
): Array<{ round: number; team1: unknown; team2: unknown }> {
  const arr = [...teams];
  const n   = arr.length;
  if (n < 2) return [];

  // Pad to even number with a BYE sentinel
  if (n % 2 === 1) arr.push(null);
  const size   = arr.length;
  const rounds = size - 1;
  const half   = size / 2;

  const pairs: Array<{ round: number; team1: unknown; team2: unknown }> = [];
  const rotate = arr.slice(1); // fixed: arr[0]; rotating: the rest

  for (let r = 0; r < rounds; r++) {
    const row = [arr[0], ...rotate];
    for (let m = 0; m < half; m++) {
      const t1 = row[m];
      const t2 = row[size - 1 - m];
      if (t1 !== null && t2 !== null) {
        pairs.push({ round: r + 1, team1: t1, team2: t2 });
      }
    }
    // Rotate: last element moves to front
    rotate.unshift(rotate.pop()!);
  }
  return pairs;
}

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Cross-seed qualifiers from multiple groups into knockout bracket order.
 *
 * For 2 groups with N qualifiers each, produces:
 *   [A1, B_last, B1, A_last, A2, B_second_last, ...]
 * so every adjacent pair in knockoutBracket() is always cross-group and the
 * group leaders (A1, B1) end up in opposite halves of the bracket.
 *
 * For 3+ groups, rank-bucket interleaving is used: all rank-1 qualifiers
 * first (A1, B1, C1…), then rank-2, etc. — adjacent pairs stay cross-group
 * as long as there are ≥ 2 groups.
 */
function crossSeedQualifiers(perGroupQuals: unknown[][]): unknown[] {
  const numGroups = perGroupQuals.length;
  if (numGroups <= 1) return perGroupQuals[0] ?? [];

  if (numGroups === 2) {
    const [g0, g1] = perGroupQuals;
    const n = Math.max(g0.length, g1.length);
    const result: unknown[] = [];
    for (let r = 0; r < n; r++) {
      const mirror = n - 1 - r;
      if (r % 2 === 0) {
        if (g0[r]      !== undefined) result.push(g0[r]);
        if (g1[mirror] !== undefined) result.push(g1[mirror]);
      } else {
        if (g1[mirror] !== undefined) result.push(g1[mirror]);
        if (g0[r]      !== undefined) result.push(g0[r]);
      }
    }
    return result;
  }

  // 3+ groups: rank-bucket interleaving
  const maxLen = Math.max(...perGroupQuals.map(g => g.length));
  const result: unknown[] = [];
  for (let r = 0; r < maxLen; r++) {
    for (let g = 0; g < numGroups; g++) {
      if (perGroupQuals[g][r] !== undefined) result.push(perGroupQuals[g][r]);
    }
  }
  return result;
}

/**
 * Returns 0-indexed slot positions for standard bracket seeding.
 * For n=4 → [0,3,1,2], producing matches (1v4) and (2v3).
 * For n=8 → [0,7,3,4,1,6,2,5], producing matches (1v8),(4v5),(2v7),(3v6).
 */
function standardBracketPositions(n: number): number[] {
  if (n === 1) return [0];
  const half = standardBracketPositions(n / 2);
  const result: number[] = [];
  for (const s of half) {
    result.push(s);
    result.push(n - 1 - s);
  }
  return result;
}

/** Knockout bracket with proper byes. Round 1 has real teams; later rounds
 *  reference the winner of a previous fixture (team1Type/team2Type = "winner"). */
function knockoutBracket(
  teams: unknown[],
  stage: number
): Array<{
  round: number;
  team1Type: string; team1: unknown;
  team2Type: string; team2: unknown;
}> {
  const arr    = [...teams];
  const size   = nextPowerOf2(arr.length);
  const rounds = Math.log2(size);
  const result: Array<{ round: number; team1Type: string; team1: unknown; team2Type: string; team2: unknown }> = [];

  // Pad with byes
  while (arr.length < size) arr.push(null);

  // Reorder using standard bracket seeding so that seed 1 faces seed N,
  // seed 2 faces seed N-1, etc. (e.g. for 4 teams: 1v4, 2v3).
  const positions = standardBracketPositions(size);
  const seeded = positions.map(i => arr[i] ?? null);

  // Round 1 — real team pairs
  for (let m = 0; m < size / 2; m++) {
    const t1 = seeded[m * 2];
    const t2 = seeded[m * 2 + 1];
    result.push({
      round: 1,
      team1Type: "team", team1: t1 ?? { bye: true },
      team2Type: "team", team2: t2 ?? { bye: true },
    });
  }

  // Subsequent rounds — winner references
  for (let round = 2; round <= rounds; round++) {
    const count = size / Math.pow(2, round);
    for (let m = 0; m < count; m++) {
      result.push({
        round,
        team1Type: "winner", team1: { stage, round: round - 1, match: m * 2 + 1 },
        team2Type: "winner", team2: { stage, round: round - 1, match: m * 2 + 2 },
      });
    }
  }
  return result;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET / — List
router.get(
  "/",
  validate({ query: listQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sport, status } = req.query as unknown as z.infer<typeof listQuerySchema>;

      const where: Record<string, unknown> = {};
      if (sport)  where.sport  = sport;
      if (status) where.status = status;

      const [items, total] = await Promise.all([
        prisma.tournament.findMany({
          where,
          include: {
            venue:     { select: { id: true, name: true } },
            createdBy: { select: { id: true, name: true } },
            _count:    { select: { fixtures: true, matches: true } },
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { startDate: "desc" },
        }),
        prisma.tournament.count({ where }),
      ]);

      res.json({ success: true, data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } catch (err) { next(err); }
  }
);

// GET /:id/export — Excel workbook (organizers only)
router.get(
  "/:id/export",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const userId = req.userId!;

      const tournament = await prisma.tournament.findUnique({
        where: { id },
        include: { coOrganizers: true },
      });
      if (!tournament) throw new NotFoundError("Tournament");
      if (!isOrganizerOrCoOrg(tournament, userId)) {
        throw new ForbiddenError("Only tournament organizers can export data");
      }

      const workbook = await buildTournamentWorkbook(id);
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
      const filename = tournamentExportFilename(tournament);

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }
);

// GET /:id — Detail
router.get(
  "/:id",
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const tournament = await prisma.tournament.findUnique({
        where: { id },
        include: {
          venue:     true,
          createdBy: { select: { id: true, name: true } },
          fixtures:  { include: { match: true } },
          matches:   true,
          coOrganizers: {
            include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
          },
        },
      });
      if (!tournament) throw new NotFoundError("Tournament");
      res.json({ success: true, data: tournament });
    } catch (err) { next(err); }
  }
);

// POST / — Create
router.post(
  "/",
  jwtCheck, attachUser, requireAuth,
  validate({ body: createBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const body   = req.body as z.infer<typeof createBodySchema>;

      if (body.venueId) {
        const venue = await prisma.venue.findUnique({ where: { id: body.venueId } });
        if (!venue) throw new NotFoundError("Venue");
      }

      const sport = await resolveTournamentSport({ sport: body.sport });
      if (!sport) throw new BadRequestError(`Sport "${body.sport}" was not found. Run db:seed:reference on this database.`);

      const tournament = await prisma.tournament.create({
        data: {
          name:        body.name,
          sport:       sport.name,
          sportId:     sport.id,
          format:      body.format,
          description: body.description ?? null,
          maxTeams:    body.maxTeams ?? null,
          venueId:     body.venueId ?? null,
          createdById: userId,
          startDate:   body.startDate ? new Date(body.startDate) : null,
          endDate:     body.endDate   ? new Date(body.endDate)   : null,
          stages:      body.stages != null ? (body.stages as Prisma.InputJsonValue) : undefined,
          teams:       body.teams  ? (body.teams  as Prisma.InputJsonValue) : [],
          ...(body.sponsors != null && { sponsors: body.sponsors as Prisma.InputJsonValue }),
        },
      });
      res.status(201).json({ success: true, data: tournament });
    } catch (err) { next(err); }
  }
);

// PUT /:id — Update
router.put(
  "/:id",
  jwtCheck, attachUser, requireAuth,
  validate({ params: idParamSchema, body: updateBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const body   = req.body as z.infer<typeof updateBodySchema>;
      const userId = req.userId!;

      const tournament = await prisma.tournament.findUnique({ where: { id }, include: { coOrganizers: true } });
      if (!tournament) throw new NotFoundError("Tournament");
      if (!isManagerOrAbove(tournament, userId)) throw new BadRequestError("Only organizer or manager can update tournament");

      const updateData: Record<string, unknown> = {};
      if (body.name        !== undefined) updateData.name        = body.name;
      if (body.format      !== undefined) updateData.format      = body.format;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.maxTeams    !== undefined) updateData.maxTeams    = body.maxTeams;
      if (body.venueId     !== undefined) updateData.venueId     = body.venueId;
      if (body.startDate   !== undefined) updateData.startDate   = new Date(body.startDate);
      if (body.endDate     !== undefined) updateData.endDate     = new Date(body.endDate);
      if (body.stages      !== undefined) updateData.stages      = body.stages as object;

      if (body.sport !== undefined) {
        const sport = await resolveTournamentSport({ sport: body.sport });
        if (!sport) throw new BadRequestError(`Sport "${body.sport}" was not found. Run db:seed:reference on this database.`);
        updateData.sport = sport.name;
        updateData.sportId = sport.id;
      }

      const renames: Array<{ oldName: string; newName: string }> = [];

      if (body.teams !== undefined) {
        // Merge incoming teams with existing to preserve metadata (groupIndex, playerNames, players, aliases).
        // Edit form sends { name } in the same order as existing teams — detect renames by index.
        const existingTeams = (tournament.teams as any[]) ?? [];
        const incoming = body.teams as any[];
        const merged = incoming.map((row: any, i: number) => {
          const byName = existingTeams.find((t: any) => t.name === row.name);
          if (byName) return { ...byName, ...row };

          const byIndex = existingTeams[i];
          if (byIndex && byIndex.name !== row.name) {
            const aliases = Array.isArray(byIndex.aliases) ? [...byIndex.aliases] : [];
            if (!aliases.includes(byIndex.name)) aliases.push(byIndex.name);
            renames.push({ oldName: byIndex.name, newName: row.name });
            return { ...byIndex, ...row, name: row.name, aliases };
          }
          return row;
        });

        // Keep roster teamName in sync with renames
        let players = (tournament.players as any[]) ?? [];
        if (renames.length > 0) {
          for (const { oldName, newName } of renames) {
            players = players.map((p: any) =>
              p.teamName === oldName ? { ...p, teamName: newName } : p
            );
          }
          updateData.players = players as object;
        }

        updateData.teams = syncTeamPlayerNames(merged, players) as object;
      }

      const updated = await prisma.tournament.update({ where: { id }, data: updateData });

      // Update pending (unscored) fixture refs when a team is renamed
      if (renames.length > 0) {
        const pending = await prisma.tournamentFixture.findMany({
          where: {
            tournamentId: id,
            matchId: null,
            status: { not: "bye" },
          },
        });
        for (const fixture of pending) {
          let team1Ref = fixture.team1Ref;
          let team2Ref = fixture.team2Ref;
          let changed = false;
          for (const { oldName, newName } of renames) {
            const next1 = renameTeamInRef(team1Ref, oldName, newName);
            const next2 = renameTeamInRef(team2Ref, oldName, newName);
            if (next1 !== team1Ref || next2 !== team2Ref) {
              team1Ref = next1;
              team2Ref = next2;
              changed = true;
            }
          }
          if (changed) {
            await prisma.tournamentFixture.update({
              where: { id: fixture.id },
              data: {
                team1Ref: team1Ref as Prisma.InputJsonValue,
                team2Ref: team2Ref as Prisma.InputJsonValue,
              },
            });
          }
        }
      }

      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  }
);

// DELETE /:id/fixtures — Clear fixtures for a stage (only if no matches played)
router.delete(
  "/:id/fixtures",
  jwtCheck, attachUser, requireAuth,
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id }   = req.params as unknown as z.infer<typeof idParamSchema>;
      const stageNum = req.query.stage ? parseInt(req.query.stage as string, 10) : 1;
      const userId   = req.userId!;

      const tournament = await prisma.tournament.findUnique({ where: { id }, include: { coOrganizers: true } });
      if (!tournament) throw new NotFoundError("Tournament");
      if (!isManagerOrAbove(tournament, userId)) throw new BadRequestError("Only organizer or manager can clear fixtures");

      // Fetch fixtures that have a linked match so we can distinguish scored vs unscored.
      const fixturesWithMatches = await prisma.tournamentFixture.findMany({
        where: { tournamentId: id, stage: stageNum, matchId: { not: null } },
        include: { match: { select: { id: true, status: true, scores: true } } },
      });

      // Block only if at least one match has been fully completed (result recorded).
      // Matches in "scheduled" or "in_progress" state are safe to delete and regenerate.
      const hasPlayedMatches = fixturesWithMatches.some(
        f => f.match && f.match.status === "completed"
      );
      if (hasPlayedMatches) throw new BadRequestError("Cannot clear fixtures — matches have already been played");

      // Delete unscored match records first (avoids FK constraint on fixture delete).
      const unscoredMatchIds = fixturesWithMatches
        .filter(f => f.matchId != null)
        .map(f => f.matchId as number);
      if (unscoredMatchIds.length) {
        await prisma.match.deleteMany({ where: { id: { in: unscoredMatchIds } } });
      }

      await prisma.tournamentFixture.deleteMany({
        where: { tournamentId: id, stage: stageNum },
      });

      res.json({ success: true });
    } catch (err) { next(err); }
  }
);

// POST /:id/teams — Add a single team
router.post(
  "/:id/teams",
  jwtCheck, attachUser, requireAuth,
  validate({ params: idParamSchema, body: addTeamBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id }              = req.params as unknown as z.infer<typeof idParamSchema>;
      const { teamName, teamRef } = req.body as z.infer<typeof addTeamBodySchema>;

      const tournament = await prisma.tournament.findUnique({ where: { id }, include: { coOrganizers: true } });
      if (!tournament) throw new NotFoundError("Tournament");
      if (!isManagerOrAbove(tournament, req.userId!)) throw new BadRequestError("Only organizer or manager can add teams");
      if (tournament.status !== "draft" && tournament.status !== "registration") {
        throw new BadRequestError("Cannot add teams when tournament is not in draft or registration");
      }

      const teams = (tournament.teams as unknown[]) ?? [];
      if (tournament.maxTeams && teams.length >= tournament.maxTeams) throw new ConflictError("Tournament is full");

      const newTeam     = { name: teamName, ref: teamRef ?? {} };
      const updatedTeams = [...teams, newTeam];
      await prisma.tournament.update({ where: { id }, data: { teams: updatedTeams as object } });
      res.json({ success: true, message: "Team added", teams: updatedTeams });
    } catch (err) { next(err); }
  }
);

// PATCH /:id/group-assignments — Persist manual group assignments for teams
const groupAssignmentsBodySchema = z.object({
  assignments: z.array(z.object({
    name:       z.string().min(1),
    groupIndex: z.number().int().min(0),
  })),
});
router.patch(
  "/:id/group-assignments",
  jwtCheck, attachUser, requireAuth,
  validate({ params: idParamSchema, body: groupAssignmentsBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id }         = req.params as unknown as z.infer<typeof idParamSchema>;
      const { assignments } = req.body as z.infer<typeof groupAssignmentsBodySchema>;

      const tournament = await prisma.tournament.findUnique({ where: { id }, include: { coOrganizers: true } });
      if (!tournament) throw new NotFoundError("Tournament");
      if (!isManagerOrAbove(tournament, req.userId!)) throw new BadRequestError("Only organizer or manager can assign groups");
      if (tournament.status !== "draft" && tournament.status !== "registration") {
        throw new BadRequestError("Group assignments can only be changed before the tournament starts");
      }

      const teams = (tournament.teams as any[]) ?? [];
      const teamNames = new Set(teams.map((t: any) => t.name));

      // Validate all names exist
      for (const a of assignments) {
        if (!teamNames.has(a.name)) throw new BadRequestError(`Team "${a.name}" not found in this tournament`);
      }

      // Validate each group has at least 2 teams
      const groupBuckets: Record<number, number> = {};
      for (const a of assignments) {
        groupBuckets[a.groupIndex] = (groupBuckets[a.groupIndex] ?? 0) + 1;
      }
      for (const [gi, count] of Object.entries(groupBuckets)) {
        if (count < 2) throw new BadRequestError(`Group ${Number(gi) + 1} must have at least 2 teams`);
      }

      const assignMap = new Map(assignments.map(a => [a.name, a.groupIndex]));
      const updatedTeams = teams.map((t: any) => {
        const gi = assignMap.get(t.name);
        if (gi !== undefined) return { ...t, groupIndex: gi };
        // Remove groupIndex from teams not in the assignments list
        const { groupIndex: _drop, ...rest } = t;
        return rest;
      });

      await prisma.tournament.update({ where: { id }, data: { teams: updatedTeams as object } });
      res.json({ success: true, teams: updatedTeams });
    } catch (err) { next(err); }
  }
);

// DELETE /:id/group-assignments — Reset all group assignments (back to auto mode)
router.delete(
  "/:id/group-assignments",
  jwtCheck, attachUser, requireAuth,
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;

      const tournament = await prisma.tournament.findUnique({ where: { id }, include: { coOrganizers: true } });
      if (!tournament) throw new NotFoundError("Tournament");
      if (!isManagerOrAbove(tournament, req.userId!)) throw new BadRequestError("Only organizer or manager can reset group assignments");
      if (tournament.status !== "draft" && tournament.status !== "registration") {
        throw new BadRequestError("Group assignments can only be changed before the tournament starts");
      }

      const teams = (tournament.teams as any[]) ?? [];
      const updatedTeams = teams.map(({ groupIndex: _drop, ...rest }: any) => rest);
      await prisma.tournament.update({ where: { id }, data: { teams: updatedTeams as object } });
      res.json({ success: true, teams: updatedTeams });
    } catch (err) { next(err); }
  }
);

// POST /:id/generate-fixtures — Generate fixtures for a given stage
router.post(
  "/:id/generate-fixtures",
  jwtCheck, attachUser, requireAuth,
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id }   = req.params as unknown as z.infer<typeof idParamSchema>;
      const userId   = req.userId!;
      // Which stage to generate (default 1; 0 = legacy single-stage)
      const stageNum = req.query.stage !== undefined ? parseInt(req.query.stage as string) : 1;

      const tournament = await prisma.tournament.findUnique({ where: { id }, include: { coOrganizers: true } });
      if (!tournament) throw new NotFoundError("Tournament");
      if (!isManagerOrAbove(tournament, userId)) throw new BadRequestError("Only organizer or manager can generate fixtures");

      const teams = (tournament.teams as unknown[]) ?? [];
      if (teams.length < 2) throw new BadRequestError("Need at least 2 teams to generate fixtures");

      // Prevent duplicates for this stage
      const existing = await prisma.tournamentFixture.count({
        where: { tournamentId: id, stage: stageNum },
      });
      if (existing > 0) throw new ConflictError(`Fixtures already exist for stage ${stageNum}`);

      const stages = (tournament.stages as Array<Record<string, any>> | null) ?? [];
      let matchOrder = 1;

      if (stages.length > 0) {
        // ── Multi-stage tournament ──────────────────────────────────────────

        // Stage 1 is generated here with all registered teams.
        // Stages 2+ MUST be generated via advance-stage so the correct
        // set of advancing teams (not all registered teams) is used.
        if (stageNum > 1) {
          throw new BadRequestError(
            "Use the advance-stage endpoint to generate fixtures for stages 2 and beyond. " +
            "This ensures only the correctly advancing teams are seeded into the next stage."
          );
        }

        const stageIdx    = stageNum - 1; // stages are 1-based in stageOrder
        const stageCfg    = stages[stageIdx];
        if (!stageCfg) throw new BadRequestError(`Stage ${stageNum} not found in tournament config`);

        const format        = stageCfg.format as string;
        const groupCount    = (stageCfg.groupCount as number | undefined) ?? 0;
        const isLastStage   = stageIdx === stages.length - 1;

        if (groupCount > 1 && (format === "round_robin" || format === "league" || format === "group_knockout")) {
          // ── Group stage: round-robin within each group ──────────────────
          if (teams.length < groupCount * 2) {
            throw new BadRequestError(
              `Not enough teams for ${groupCount} groups — need at least ${groupCount * 2} teams (have ${teams.length}).`
            );
          }

          // Build per-group buckets. Use explicit groupIndex stored on team
          // objects when present (manual assignment); otherwise auto-slice.
          const hasExplicit = teams.some((t: any) => t.groupIndex != null);
          let groupBuckets: unknown[][];

          if (hasExplicit) {
            groupBuckets = Array.from({ length: groupCount }, () => [] as unknown[]);
            const unassigned: unknown[] = [];
            for (const t of teams) {
              const gi = (t as any).groupIndex;
              if (gi != null && gi >= 0 && gi < groupCount) {
                groupBuckets[gi].push(t);
              } else {
                unassigned.push(t);
              }
            }
            // Distribute any unassigned teams to the smallest bucket
            for (const t of unassigned) {
              const smallest = groupBuckets.reduce((a, b) => a.length <= b.length ? a : b);
              smallest.push(t);
            }
          } else {
            // Auto-slice: contiguous chunks of the team list
            const teamsPerGroup = Math.ceil(teams.length / groupCount);
            groupBuckets = Array.from({ length: groupCount }, (_, g) =>
              teams.slice(g * teamsPerGroup, (g + 1) * teamsPerGroup)
            );
          }

          for (let g = 0; g < groupCount; g++) {
            const groupTeams = groupBuckets[g];
            if (groupTeams.length < 2) continue;

            const pairs = roundRobinPairs(groupTeams);
            for (const pair of pairs) {
              await prisma.tournamentFixture.create({
                data: {
                  tournamentId: id,
                  stage:        stageNum,
                  groupIndex:   g,
                  round:        pair.round,
                  matchOrder:   matchOrder++,
                  team1Type:    "team",
                  team1Ref:     pair.team1 as object,
                  team2Type:    "team",
                  team2Ref:     pair.team2 as object,
                },
              });
            }
          }
        } else if (format === "knockout") {
          // ── Knockout bracket ────────────────────────────────────────────
          // For non-last knockout stages, only generate round 1 (the actual
          // matchups with real teams). Subsequent rounds will be created by
          // advance-stage so TBD "winner-reference" fixtures don't block
          // stage-completion detection.
          const bracket            = knockoutBracket(teams, stageNum);
          const fixturesToGenerate = isLastStage ? bracket : bracket.filter(f => f.round === 1);
          for (const f of fixturesToGenerate) {
            await prisma.tournamentFixture.create({
              data: {
                tournamentId: id,
                stage:        stageNum,
                round:        f.round,
                matchOrder:   matchOrder++,
                team1Type:    f.team1Type,
                team1Ref:     f.team1 as object,
                team2Type:    f.team2Type,
                team2Ref:     f.team2 as object,
              },
            });
          }
        } else {
          // ── Full round-robin (no groups) ────────────────────────────────
          const pairs = roundRobinPairs(teams);
          for (const pair of pairs) {
            await prisma.tournamentFixture.create({
              data: {
                tournamentId: id,
                stage:        stageNum,
                round:        pair.round,
                matchOrder:   matchOrder++,
                team1Type:    "team",
                team1Ref:     pair.team1 as object,
                team2Type:    "team",
                team2Ref:     pair.team2 as object,
              },
            });
          }
        }
      } else {
        // ── Single-format tournament (legacy) ───────────────────────────────
        const legacyStage = 0;
        if (tournament.format === "knockout") {
          const bracket = knockoutBracket(teams, legacyStage);
          for (const f of bracket) {
            await prisma.tournamentFixture.create({
              data: {
                tournamentId: id,
                stage:        legacyStage,
                round:        f.round,
                matchOrder:   matchOrder++,
                team1Type:    f.team1Type,
                team1Ref:     f.team1 as object,
                team2Type:    f.team2Type,
                team2Ref:     f.team2 as object,
              },
            });
          }
        } else {
          // league or round-robin
          const pairs = roundRobinPairs(teams);
          for (const pair of pairs) {
            await prisma.tournamentFixture.create({
              data: {
                tournamentId: id,
                stage:        legacyStage,
                round:        pair.round,
                matchOrder:   matchOrder++,
                team1Type:    "team",
                team1Ref:     pair.team1 as object,
                team2Type:    "team",
                team2Ref:     pair.team2 as object,
              },
            });
          }
        }
      }

      const created = await prisma.tournamentFixture.findMany({
        where:   { tournamentId: id, stage: stages.length > 0 ? stageNum : 0 },
        orderBy: [{ groupIndex: "asc" }, { round: "asc" }, { matchOrder: "asc" }],
      });
      res.status(201).json({ success: true, data: created, count: created.length });
    } catch (err) { next(err); }
  }
);

// GET /:id/standings — Compute standings from completed match results
router.get(
  "/:id/standings",
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const tournament = await prisma.tournament.findUnique({
        where: { id },
        include: {
          matches:  { where: { status: "completed" } },
          fixtures: true,
        },
      });
      if (!tournament) throw new NotFoundError("Tournament");

      const data = computeTournamentStandings({
        teams: (tournament.teams as Array<Record<string, any>>) ?? [],
        stages: (tournament.stages as Array<Record<string, any>>) ?? [],
        matches: tournament.matches as Array<Record<string, any>>,
        fixtures: tournament.fixtures as Array<Record<string, any>>,
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// POST /:id/advance-stage — Complete current stage, generate next stage fixtures
const advanceStageSchema = z.object({ completedStage: z.number().int().min(0) });

router.post(
  "/:id/advance-stage",
  jwtCheck, attachUser, requireAuth,
  validate({ params: idParamSchema, body: advanceStageSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id }             = req.params as unknown as z.infer<typeof idParamSchema>;
      const { completedStage } = req.body   as z.infer<typeof advanceStageSchema>;
      const userId             = req.userId!;

      const tournament = await prisma.tournament.findUnique({
        where: { id },
        include: {
          fixtures:     { where: { stage: completedStage } },
          matches:      { where: { tournamentId: id, status: "completed" } },
          coOrganizers: true,
        },
      });
      if (!tournament) throw new NotFoundError("Tournament");
      if (!isManagerOrAbove(tournament, userId)) throw new BadRequestError("Only organizer or manager can advance stages");

      const stages = (tournament.stages as Array<Record<string, any>>) ?? [];
      const currentStage = stages[completedStage - 1]; // stageOrder is 1-based
      if (!currentStage) throw new BadRequestError("Invalid stage number");

      const stageFixtures = tournament.fixtures;

      // Gate: every scorable fixture must be completed or bye (mirror frontend stageComplete)
      const scorableFixtures = stageFixtures.filter(
        (f) => !(f.team1Type === "winner" && f.team2Type === "winner")
      );
      const incomplete = scorableFixtures.filter(
        (f) => f.status !== "completed" && f.status !== "bye"
      );
      if (scorableFixtures.length === 0 || incomplete.length > 0) {
        throw new BadRequestError(
          "All matches in this stage must be completed before advancing"
        );
      }

      const format        = currentStage.format ?? tournament.format;
      let advancingTeams: unknown[] = [];

      if (format === "round_robin" || format === "league" || format === "group_knockout") {
        // Group stage: advance top N per group
        const groupCount    = (currentStage.groupCount as number | undefined) ?? 1;
        const advancePerGrp = (currentStage.advancePerGroup as number | undefined) ?? 2;

        // Check whether the fixtures actually carry a groupIndex.
        // If not (full round-robin without split groups), treat everything as one pool.
        const fixturesHaveGroups = stageFixtures.some(f => f.groupIndex != null);

        if (!fixturesHaveGroups || groupCount <= 1) {
          // ── Single-pool round-robin ──────────────────────────────────────────
          const matchIds    = stageFixtures.map(f => f.matchId).filter(Boolean) as number[];
          const poolMatches = tournament.matches.filter(m => matchIds.includes(m.id));
          const poolTeams   = Array.from(new Set(
            stageFixtures.flatMap(f => {
              const t1 = (f.team1Ref as any)?.name;
              const t2 = (f.team2Ref as any)?.name;
              return [t1, t2].filter(Boolean);
            })
          )).map(name => ({ name }));
          const poolStandings = computeStandings(poolMatches as any[], poolTeams);
          advancingTeams = poolStandings.slice(0, advancePerGrp).map(s => ({ name: s.team, ref: {} }));
        } else {
          // ── Multi-group round-robin ──────────────────────────────────────────
          // Collect qualifiers per group then cross-seed them so knockout
          // bracket pairs are always cross-group (A1 vs B2, B1 vs A2).
          const perGroupQualifiers: unknown[][] = [];
          for (let g = 0; g < groupCount; g++) {
            const groupFixtures = stageFixtures.filter(f => f.groupIndex === g);
            const groupMatchIds = groupFixtures.map(f => f.matchId).filter(Boolean) as number[];
            const groupMatches  = tournament.matches.filter(m => groupMatchIds.includes(m.id));

            const groupTeams = Array.from(new Set(
              groupFixtures.flatMap(f => {
                const t1 = (f.team1Ref as any)?.name;
                const t2 = (f.team2Ref as any)?.name;
                return [t1, t2].filter(Boolean);
              })
            )).map(name => ({ name }));

            const groupStandings = computeStandings(groupMatches as any[], groupTeams);
            const top            = groupStandings.slice(0, advancePerGrp).map(s => ({ name: s.team, ref: {} }));
            perGroupQualifiers.push(top);
          }
          // Apply cross-seeding: for knockout next stage this ensures A1 vs B2,
          // B1 vs A2 etc.  For another group stage the flat order is fine too.
          advancingTeams = crossSeedQualifiers(perGroupQualifiers);
        }
      } else if (format === "knockout") {
        for (const fixture of stageFixtures) {
          if (!fixture.matchId) continue;
          const match = tournament.matches.find(m => m.id === fixture.matchId);
          if (match?.winnerTeam) {
            advancingTeams.push(
              match.winnerTeam === "A" ? fixture.team1Ref : fixture.team2Ref
            );
          }
        }
      }

      if (advancingTeams.length < 2) throw new BadRequestError("Not enough teams to advance — at least 2 required");

      // Mark stages
      const updatedStages = [...stages];
      updatedStages[completedStage - 1]  = { ...currentStage, status: "completed" };
      const nextStage = stages[completedStage]; // next (0-indexed = completedStage because stages are 1-indexed)
      if (nextStage) updatedStages[completedStage] = { ...nextStage, status: "active" };

      await prisma.tournament.update({ where: { id }, data: { stages: updatedStages as any } });

      const nextStageNum    = completedStage + 1;
      const nextFormat      = nextStage?.format ?? "knockout";
      const nextGroupCount  = (nextStage?.groupCount as number | undefined) ?? 0;
      // Is the next stage the last stage in the tournament?
      const isNextLastStage = completedStage + 1 === stages.length;
      let   matchOrder      = 1;

      // If the next stage already has fixtures (e.g. from a prior erroneous generate),
      // delete any that have not yet had a match started so we can regenerate cleanly.
      // If any fixture has already been scored we refuse to overwrite.
      const existingNextFixtures = await prisma.tournamentFixture.findMany({
        where: { tournamentId: id, stage: nextStageNum },
      });
      if (existingNextFixtures.some(f => f.matchId != null)) {
        throw new ConflictError(
          `Stage ${nextStageNum} already has matches in progress or completed. ` +
          `Correct or finish those matches first before regenerating fixtures.`
        );
      }
      if (existingNextFixtures.length > 0) {
        await prisma.tournamentFixture.deleteMany({
          where: { tournamentId: id, stage: nextStageNum },
        });
      }

      if (nextGroupCount > 1 && (nextFormat === "round_robin" || nextFormat === "league")) {
        const perGroup = Math.ceil(advancingTeams.length / nextGroupCount);
        for (let g = 0; g < nextGroupCount; g++) {
          const groupTeams = advancingTeams.slice(g * perGroup, (g + 1) * perGroup);
          for (const pair of roundRobinPairs(groupTeams)) {
            await prisma.tournamentFixture.create({
              data: {
                tournamentId: id, stage: nextStageNum, groupIndex: g,
                round: pair.round, matchOrder: matchOrder++,
                team1Type: "team", team1Ref: pair.team1 as object,
                team2Type: "team", team2Ref: pair.team2 as object,
              },
            });
          }
        }
      } else if (nextFormat === "knockout") {
        // For non-last knockout stages, only create round 1 (real matchups).
        // TBD winner-reference slots are skipped; the next advance-stage call
        // will create those fixtures with the actual advancing teams.
        const bracket            = knockoutBracket(advancingTeams, nextStageNum);
        const fixturesToCreate   = isNextLastStage ? bracket : bracket.filter(f => f.round === 1);
        for (const f of fixturesToCreate) {
          await prisma.tournamentFixture.create({
            data: {
              tournamentId: id, stage: nextStageNum,
              round: f.round, matchOrder: matchOrder++,
              team1Type: f.team1Type, team1Ref: f.team1 as object,
              team2Type: f.team2Type, team2Ref: f.team2 as object,
            },
          });
        }
      } else {
        for (const pair of roundRobinPairs(advancingTeams)) {
          await prisma.tournamentFixture.create({
            data: {
              tournamentId: id, stage: nextStageNum,
              round: pair.round, matchOrder: matchOrder++,
              team1Type: "team", team1Ref: pair.team1 as object,
              team2Type: "team", team2Ref: pair.team2 as object,
            },
          });
        }
      }

      const created = await prisma.tournamentFixture.findMany({
        where:   { tournamentId: id, stage: nextStageNum },
        orderBy: [{ groupIndex: "asc" }, { round: "asc" }, { matchOrder: "asc" }],
      });

      // Notify players whose teams are advancing (non-blocking)
      const advancingTeamNames = (advancingTeams as any[])
        .map((t: any) => t.name ?? t.teamName)
        .filter(Boolean) as string[];
      const allPlayers = (tournament.players as any[]) ?? [];
      const advancingPlayerIds: number[] = allPlayers
        .filter((p: any) => typeof p.userId === "number" && advancingTeamNames.includes(p.teamName))
        .map((p: any) => p.userId as number);
      if (advancingPlayerIds.length) {
        void createBulkNotifications(
          advancingPlayerIds,
          NotifType.TOURNAMENT_STAGE_ADVANCED,
          "Your team advanced!",
          `Your team advanced to the next stage in "${tournament.name}". Check the new fixtures!`,
          { tournamentId: id, nextStage: nextStageNum }
        );
      }

      res.json({
        success: true,
        message: `Stage ${completedStage} completed. ${advancingTeams.length} teams advance to stage ${nextStageNum}`,
        data: { advancingTeams, nextStageFixtures: created },
      });
    } catch (err) { next(err); }
  }
);

// POST /:id/sync-bracket — Propagate completed KO results into QF/SF/Final/Bronze (no deletes)
router.post(
  "/:id/sync-bracket",
  jwtCheck, attachUser, requireAuth,
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const userId = req.userId!;

      const tournament = await prisma.tournament.findUnique({
        where: { id },
        include: { coOrganizers: true },
      });
      if (!tournament) throw new NotFoundError("Tournament");
      if (!isScorerOrAbove(tournament, userId)) {
        throw new BadRequestError("Only organizer or co-organizer can sync the bracket");
      }

      const result = await syncKnockoutBracket(id);
      const fixtures = await prisma.tournamentFixture.findMany({
        where: { tournamentId: id },
        include: { match: true },
        orderBy: [{ stage: "asc" }, { round: "asc" }, { matchOrder: "asc" }],
      });

      res.json({
        success: true,
        message: `Bracket synced (${result.propagated} slots updated)`,
        data: { propagated: result.propagated, fixtures },
      });
    } catch (err) { next(err); }
  }
);

// POST /:id/fixtures/:fixtureId/start-match — Create (or retrieve) the Match for a fixture
router.post(
  "/:id/fixtures/:fixtureId/start-match",
  jwtCheck, attachUser, requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idRaw = req.params.id;
      const fixtureRaw = req.params.fixtureId;
      const tournamentId = parseInt(Array.isArray(idRaw) ? idRaw[0]! : idRaw, 10);
      const fixtureId = parseInt(Array.isArray(fixtureRaw) ? fixtureRaw[0]! : fixtureRaw, 10);
      if (isNaN(tournamentId) || isNaN(fixtureId)) {
        return next(new BadRequestError("Invalid tournament or fixture ID"));
      }
      const userId       = req.userId!;

      const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId }, include: { coOrganizers: true } });
      if (!tournament) throw new NotFoundError("Tournament");
      if (!isScorerOrAbove(tournament, userId)) throw new BadRequestError("Only organizer or co-organizer can start matches");

      const fixture = await prisma.tournamentFixture.findUnique({
        where: { id: fixtureId },
        include: { match: true },
      });
      if (!fixture)                                    throw new NotFoundError("Fixture");
      if (fixture.tournamentId !== tournamentId)       throw new BadRequestError("Fixture does not belong to this tournament");
      if (fixture.status === "bye")                    throw new BadRequestError("Cannot score a BYE fixture");

      // If a match is already linked, return it — idempotent
      if (fixture.matchId && fixture.match) {
        return res.json({ success: true, matchId: fixture.matchId, existing: true });
      }

      if (
        fixture.team1Type === "winner" || fixture.team1Type === "loser" ||
        fixture.team2Type === "winner" || fixture.team2Type === "loser" ||
        isPointerRef(fixture.team1Ref) || isPointerRef(fixture.team2Ref)
      ) {
        throw new BadRequestError("Cannot start match until both teams are decided from prior rounds");
      }

      // Prefer sportId; fall back to name / displayName variants for legacy tournaments
      const sport = await resolveTournamentSport({
        sportId: tournament.sportId,
        sport: tournament.sport,
      });
      if (!sport) throw new BadRequestError(`Sport "${tournament.sport}" was not found. Run db:seed:reference on this database.`);

      // Backfill sportId on legacy tournaments so later lookups are stable
      if (tournament.sportId == null || tournament.sport !== sport.name) {
        await prisma.tournament.update({
          where: { id: tournamentId },
          data: { sportId: sport.id, sport: sport.name },
        });
      }

      // Extract team names from the fixture refs
      const t1Name = (fixture.team1Ref as any)?.name;
      const t2Name = (fixture.team2Ref as any)?.name;
      if (!t1Name || !t2Name) {
        throw new BadRequestError("Cannot start match until both teams are decided from prior rounds");
      }

      const allTeams = (tournament.teams as any[]) ?? [];
      const allPlayers = (tournament.players as any[]) ?? [];
      const t1PlayerNames = resolveFixturePlayerNames(t1Name, allTeams, allPlayers);
      const t2PlayerNames = resolveFixturePlayerNames(t2Name, allTeams, allPlayers);

      // Build a rich metadata label for the fixture round/stage
      const stageLabel = fixture.stage    ? `Stage ${fixture.stage}`    : "";
      const groupLabel  = fixture.groupIndex != null ? `Group ${String.fromCharCode(65 + fixture.groupIndex)}` : "";
      const roundLabel  = fixture.round   ? `Round ${fixture.round}`    : "";
      const formatLabel = [stageLabel, groupLabel, roundLabel].filter(Boolean).join(" · ");

      // Resolve sport-specific scoring config from the active stage
      const stages = (tournament.stages as Array<Record<string, any>> | null) ?? [];
      const stageCfg = fixture.stage != null
        ? (stages[fixture.stage - 1] ?? stages[0])
        : stages[0];

      let finalScoreType = sport.name.toLowerCase().replace(/\s+/g, "_");
      if (finalScoreType === "pickleball") {
        finalScoreType = stageCfg?.scoringSystem === "service"
          ? "pickleball_service"
          : "pickleball_rally";
      } else if (finalScoreType === "padel") {
        finalScoreType = "padel";
      }

      const playersPerTeam = (stageCfg?.playersPerTeam as number | undefined) ?? 1;
      const doubles = playersPerTeam >= 2;

      const scoreConfig: Record<string, unknown> = {
        sport: finalScoreType,
        doubles,
      };
      if (stageCfg?.targetScore != null) scoreConfig.targetScore = stageCfg.targetScore;
      if (stageCfg?.bestOf != null) scoreConfig.bestOf = stageCfg.bestOf;
      if (stageCfg?.scoringSystem != null) scoreConfig.scoringSystem = stageCfg.scoringSystem;

      // Create the Match record
      const match = await prisma.match.create({
        data: {
          sportId:       sport.id,
          sportName:     sport.name,
          formatName:    formatLabel || "Tournament Match",
          tournamentId,
          venueId:       tournament.venueId ?? undefined,
          playersPerTeam,
          teams:         {
            A: { name: t1Name, playerNames: t1PlayerNames },
            B: { name: t2Name, playerNames: t2PlayerNames },
          },
          scoreType:     finalScoreType,
          // Seed a minimal config block so normaliseState picks up doubles correctly
          scores:        {
            config:           scoreConfig,
            setupComplete:    doubles ? false : true,
            setupBaselineAck: doubles ? { A: false, B: false } : { A: true, B: true },
            trackPositions:   false,
          } as Prisma.InputJsonValue,
          matchDate:     new Date(),
          status:        "scheduled",
          createdById:   userId,
          matchType:     "COMPETITIVE",
          loggingMode:   "LIVE_SCORING",
        },
      });

      // Link the fixture to the newly created match
      await prisma.tournamentFixture.update({
        where: { id: fixtureId },
        data:  { matchId: match.id, status: "in_progress" },
      });

      res.status(201).json({ success: true, matchId: match.id, existing: false });
    } catch (err) { next(err); }
  }
);

// PUT /:id/status — Update tournament status
router.put(
  "/:id/status",
  jwtCheck, attachUser, requireAuth,
  validate({ params: idParamSchema, body: statusBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id }   = req.params as unknown as z.infer<typeof idParamSchema>;
      const { status } = req.body as z.infer<typeof statusBodySchema>;
      const userId   = req.userId!;

      const tournament = await prisma.tournament.findUnique({ where: { id }, include: { coOrganizers: true } });
      if (!tournament) throw new NotFoundError("Tournament");
      if (!isManagerOrAbove(tournament, userId)) throw new BadRequestError("Only organizer or manager can update status");

      const updated = await prisma.tournament.update({ where: { id }, data: { status } });

      // Notify all rostered players on key status transitions (non-blocking)
      const playerIds = rosterUserIds(tournament.players);
      if (playerIds.length) {
        if (status === "in_progress") {
          void createBulkNotifications(
            playerIds,
            NotifType.TOURNAMENT_STARTED,
            "Tournament started!",
            `The tournament "${tournament.name}" has officially started. Check the fixtures!`,
            { tournamentId: id }
          );
        } else if (status === "completed") {
          void createBulkNotifications(
            playerIds,
            NotifType.TOURNAMENT_COMPLETED,
            "Tournament completed",
            `"${tournament.name}" has concluded. View the final standings!`,
            { tournamentId: id }
          );
        }
      }

      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  }
);

// ─── Registration (public self-registration) ──────────────────────────────────

const registerBodySchema = z.object({
  teamName:     z.string().min(1).max(100),
  captainName:  z.string().min(1).max(100),
  captainPhone: z.string().optional(),
  notes:        z.string().max(500).optional(),
  playerUsernames: z.array(z.string().min(1).max(100)).max(40).optional(),
});

// POST /:id/register — Public team self-registration (no auth required)
router.post(
  "/:id/register",
  validate({ params: idParamSchema, body: registerBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id }  = req.params as unknown as z.infer<typeof idParamSchema>;
      const body    = req.body as z.infer<typeof registerBodySchema>;

      const tournament = await prisma.tournament.findUnique({ where: { id } });
      if (!tournament) throw new NotFoundError("Tournament");
      if (tournament.status !== "registration")
        throw new BadRequestError("Tournament is not accepting registrations");

      const registrations = (tournament.registrations as unknown[]) ?? [];
      const existing = (registrations as any[]).find(
        (r: any) => r.teamName?.toLowerCase() === body.teamName.toLowerCase()
      );
      if (existing) throw new ConflictError("A team with this name has already registered");

      const entry = {
        teamName:     body.teamName,
        captainName:  body.captainName,
        captainPhone: body.captainPhone ?? null,
        notes:        body.notes ?? null,
        playerUsernames: Array.from(
          new Set((body.playerUsernames ?? []).map((u) => u.trim()).filter(Boolean))
        ),
        submittedAt:  new Date().toISOString(),
        status:       "pending",
      };
      await prisma.tournament.update({
        where: { id },
        data:  { registrations: [...registrations, entry] as Prisma.InputJsonValue },
      });
      res.status(201).json({ success: true, message: "Registration submitted successfully", data: entry });
    } catch (err) { next(err); }
  }
);

// GET /:id/registrations — Organizer view of pending registrations
router.get(
  "/:id/registrations",
  jwtCheck, attachUser, requireAuth,
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const tournament = await prisma.tournament.findUnique({ where: { id }, include: { coOrganizers: true } });
      if (!tournament) throw new NotFoundError("Tournament");
      if (!isManagerOrAbove(tournament, req.userId!)) throw new BadRequestError("Only organizer or manager can view registrations");
      res.json({ success: true, data: (tournament.registrations as unknown[]) ?? [] });
    } catch (err) { next(err); }
  }
);

// POST /:id/registrations/accept — Accept a registration (add team + remove from pending)
const acceptRegSchema = z.object({ teamName: z.string().min(1) });
router.post(
  "/:id/registrations/accept",
  jwtCheck, attachUser, requireAuth,
  validate({ params: idParamSchema, body: acceptRegSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id }      = req.params as unknown as z.infer<typeof idParamSchema>;
      const { teamName } = req.body as z.infer<typeof acceptRegSchema>;

      const tournament = await prisma.tournament.findUnique({ where: { id }, include: { coOrganizers: true } });
      if (!tournament) throw new NotFoundError("Tournament");
      if (!isManagerOrAbove(tournament, req.userId!)) throw new BadRequestError("Only organizer or manager can accept registrations");

      const registrations = (tournament.registrations as any[]) ?? [];
      const reg = registrations.find((r: any) => r.teamName === teamName);
      if (!reg) throw new NotFoundError("Registration not found");

      const teams = (tournament.teams as unknown[]) ?? [];
      if (tournament.maxTeams && teams.length >= tournament.maxTeams) throw new ConflictError("Tournament is full");

      const newTeam      = { name: reg.teamName, captain: reg.captainName, phone: reg.captainPhone ?? null };
      const updatedTeams = [...teams, newTeam];
      const updatedRegs  = registrations.filter((r: any) => r.teamName !== teamName);
      const existingPlayers = (tournament.players as any[]) ?? [];
      const sport = tournament.sport;
      const incomingUsernames: string[] = Array.isArray(reg.playerUsernames)
        ? reg.playerUsernames.map((v: unknown) => String(v))
        : [];

      const normalizedIncoming: string[] = Array.from(
        new Set(
          incomingUsernames
            .map((raw: unknown) => String(raw ?? "").trim())
            .filter(Boolean)
        )
      );

      let linkedUsers: Array<{ id: number; name: string | null; email: string }> = [];
      if (normalizedIncoming.length > 0) {
        linkedUsers = await prisma.user.findMany({
          where: {
            OR: [
              { email: { in: normalizedIncoming } },
              { name: { in: normalizedIncoming } },
            ],
          },
          select: { id: true, name: true, email: true },
        });
      }

      const statsTemplate = createEmptyStatsForSport(sport);
      const nextPlayers = [...existingPlayers];
      const existingUserIds = new Set(
        existingPlayers
          .map((p: any) => (typeof p?.userId === "number" ? p.userId : null))
          .filter((v): v is number => v !== null)
      );
      const existingKeysByTeam = new Set(
        existingPlayers.map((p: any) => `${String(p.teamName ?? "").toLowerCase()}::${String(p.playerName ?? "").toLowerCase()}`)
      );

      for (const username of normalizedIncoming) {
        const matched = linkedUsers.find((u) =>
          u.email.toLowerCase() === username.toLowerCase() ||
          (u.name ?? "").toLowerCase() === username.toLowerCase()
        );
        const resolvedName = matched?.name?.trim() || username;
        const key = `${String(reg.teamName).toLowerCase()}::${resolvedName.toLowerCase()}`;
        if (existingKeysByTeam.has(key)) continue;
        if (matched && existingUserIds.has(matched.id)) continue;

        nextPlayers.push({
          teamName: reg.teamName,
          playerName: resolvedName,
          jerseyNo: null,
          userId: matched?.id ?? null,
          username,
          isPlaceholder: matched ? false : true,
          stats: { ...statsTemplate },
        });
        existingKeysByTeam.add(key);
        if (matched) existingUserIds.add(matched.id);
      }

      await prisma.tournament.update({
        where: { id },
        data:  {
          teams: syncTeamPlayerNames(updatedTeams, nextPlayers) as Prisma.InputJsonValue,
          registrations: updatedRegs as Prisma.InputJsonValue,
          players: nextPlayers as Prisma.InputJsonValue,
        },
      });
      res.json({ success: true, message: "Registration accepted", team: newTeam });
    } catch (err) { next(err); }
  }
);

// DELETE /:id/registrations/reject — Reject / remove a registration
const rejectRegSchema = z.object({ teamName: z.string().min(1) });
router.post(
  "/:id/registrations/reject",
  jwtCheck, attachUser, requireAuth,
  validate({ params: idParamSchema, body: rejectRegSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id }      = req.params as unknown as z.infer<typeof idParamSchema>;
      const { teamName } = req.body as z.infer<typeof rejectRegSchema>;

      const tournament = await prisma.tournament.findUnique({ where: { id }, include: { coOrganizers: true } });
      if (!tournament) throw new NotFoundError("Tournament");
      if (!isManagerOrAbove(tournament, req.userId!)) throw new BadRequestError("Only organizer or manager can reject registrations");

      const registrations = (tournament.registrations as any[]) ?? [];
      const updatedRegs   = registrations.filter((r: any) => r.teamName !== teamName);

      await prisma.tournament.update({
        where: { id },
        data:  { registrations: updatedRegs as Prisma.InputJsonValue },
      });
      res.json({ success: true, message: "Registration rejected" });
    } catch (err) { next(err); }
  }
);

// ─── Player Roster ────────────────────────────────────────────────────────────

const addPlayerSchema = z.object({
  teamName:   z.string().min(1),
  playerName: z.string().min(1).max(100),
  jerseyNo:   z.number().int().min(0).max(99).optional(),
  userId:     z.number().int().positive().optional(),
  username:   z.string().min(1).max(100).optional(),
});

const addPlayersBulkSchema = z.object({
  teamName: z.string().min(1),
  players: z.array(z.object({
    playerName: z.string().min(1).max(100),
    userId:     z.number().int().positive().optional(),
    username:   z.string().min(1).max(100).optional(),
    jerseyNo:   z.number().int().min(0).max(99).optional(),
  })).min(1).max(50),
});

// POST /:id/players — Add player to team roster
router.post(
  "/:id/players",
  jwtCheck, attachUser, requireAuth,
  validate({ params: idParamSchema, body: addPlayerSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id }  = req.params as unknown as z.infer<typeof idParamSchema>;
      const body    = req.body as z.infer<typeof addPlayerSchema>;

      const tournament = await prisma.tournament.findUnique({ where: { id }, include: { coOrganizers: true } });
      if (!tournament) throw new NotFoundError("Tournament");
      if (!isScorerOrAbove(tournament, req.userId!)) throw new BadRequestError("Only organizer or co-organizer can manage rosters");

      const teams = (tournament.teams as any[]) ?? [];
      const teamExists = teams.some((t: any) => t.name === body.teamName);
      if (!teamExists) throw new NotFoundError(`Team "${body.teamName}" not found`);

      const players = (tournament.players as any[]) ?? [];
      const duplicate = players.find(
        (p: any) => p.teamName === body.teamName && p.playerName.toLowerCase() === body.playerName.toLowerCase()
      );
      if (duplicate) throw new ConflictError("Player already exists in this team");
      if (body.userId != null) {
        const user = await prisma.user.findUnique({ where: { id: body.userId }, select: { id: true } });
        if (!user) throw new NotFoundError("User");
        const userInRoster = players.find((p: any) => p.userId === body.userId);
        if (userInRoster) throw new ConflictError("User is already added in this tournament");
      }

      const newPlayer = {
        teamName:   body.teamName,
        playerName: body.playerName,
        jerseyNo:   body.jerseyNo ?? null,
        userId:     body.userId ?? null,
        username:   body.username ?? null,
        isPlaceholder: body.userId ? false : true,
        stats:      createEmptyStatsForSport(tournament.sport),
        goals:      0,
        assists:    0,
        points:     0,
      };
      const nextPlayers = [...players, newPlayer];
      await prisma.tournament.update({
        where: { id },
        data:  {
          players: nextPlayers as Prisma.InputJsonValue,
          teams: syncTeamPlayerNames(teams, nextPlayers) as Prisma.InputJsonValue,
        },
      });

      // Notify the added user if they have an account (non-blocking)
      if (body.userId != null) {
        void createNotification(
          body.userId,
          NotifType.TOURNAMENT_PLAYER_ADDED,
          "You've been added to a tournament",
          `You have been added to team "${body.teamName}" in the tournament "${tournament.name}".`,
          { tournamentId: id, teamName: body.teamName }
        );
      }

      res.status(201).json({ success: true, data: newPlayer });
    } catch (err) { next(err); }
  }
);

// POST /:id/players/bulk — Add multiple roster players to one team
router.post(
  "/:id/players/bulk",
  jwtCheck, attachUser, requireAuth,
  validate({ params: idParamSchema, body: addPlayersBulkSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id }  = req.params as unknown as z.infer<typeof idParamSchema>;
      const body    = req.body as z.infer<typeof addPlayersBulkSchema>;

      const tournament = await prisma.tournament.findUnique({ where: { id }, include: { coOrganizers: true } });
      if (!tournament) throw new NotFoundError("Tournament");
      if (!isScorerOrAbove(tournament, req.userId!)) throw new BadRequestError("Only organizer or co-organizer can manage rosters");

      const teams = (tournament.teams as any[]) ?? [];
      const teamExists = teams.some((t: any) => t.name === body.teamName);
      if (!teamExists) throw new NotFoundError(`Team "${body.teamName}" not found`);

      const statsTemplate = createEmptyStatsForSport(tournament.sport);
      const players = (tournament.players as any[]) ?? [];
      const userIdsInTournament = new Set(
        players
          .map((p: any) => (typeof p?.userId === "number" ? p.userId : null))
          .filter((v): v is number => v !== null)
      );
      const playerKeys = new Set(
        players.map((p: any) => `${String(p.teamName ?? "").toLowerCase()}::${String(p.playerName ?? "").toLowerCase()}`)
      );

      const created: any[] = [];
      for (const incoming of body.players) {
        if (incoming.userId != null) {
          const user = await prisma.user.findUnique({ where: { id: incoming.userId }, select: { id: true } });
          if (!user) continue;
        }
        const key = `${body.teamName.toLowerCase()}::${incoming.playerName.toLowerCase()}`;
        if (playerKeys.has(key)) continue;
        if (incoming.userId != null && userIdsInTournament.has(incoming.userId)) continue;
        const row = {
          teamName: body.teamName,
          playerName: incoming.playerName,
          jerseyNo: incoming.jerseyNo ?? null,
          userId: incoming.userId ?? null,
          username: incoming.username ?? null,
          isPlaceholder: incoming.userId ? false : true,
          stats: { ...statsTemplate },
          goals: 0,
          assists: 0,
          points: 0,
        };
        players.push(row);
        created.push(row);
        playerKeys.add(key);
        if (incoming.userId != null) userIdsInTournament.add(incoming.userId);
      }

      await prisma.tournament.update({
        where: { id },
        data:  {
          players: players as Prisma.InputJsonValue,
          teams: syncTeamPlayerNames(teams, players) as Prisma.InputJsonValue,
        },
      });
      res.status(201).json({ success: true, data: created, count: created.length });
    } catch (err) { next(err); }
  }
);

// DELETE /:id/players — Remove a player from roster
const removePlayerSchema = z.object({ teamName: z.string().min(1), playerName: z.string().min(1) });
router.delete(
  "/:id/players",
  jwtCheck, attachUser, requireAuth,
  validate({ params: idParamSchema, body: removePlayerSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id }  = req.params as unknown as z.infer<typeof idParamSchema>;
      const { teamName, playerName } = req.body as z.infer<typeof removePlayerSchema>;

      const tournament = await prisma.tournament.findUnique({ where: { id }, include: { coOrganizers: true } });
      if (!tournament) throw new NotFoundError("Tournament");
      if (!isScorerOrAbove(tournament, req.userId!)) throw new BadRequestError("Only organizer or co-organizer can manage rosters");

      const teams      = (tournament.teams as any[]) ?? [];
      const players    = (tournament.players as any[]) ?? [];
      const updated    = players.filter(
        (p: any) => !(p.teamName === teamName && p.playerName === playerName)
      );
      await prisma.tournament.update({
        where: { id },
        data:  {
          players: updated as Prisma.InputJsonValue,
          teams: syncTeamPlayerNames(teams, updated) as Prisma.InputJsonValue,
        },
      });
      res.json({ success: true, message: "Player removed" });
    } catch (err) { next(err); }
  }
);

// PATCH /:id/players/stats — Update a player's goals/assists/points
const updateStatSchema = z.object({
  teamName:   z.string().min(1),
  playerName: z.string().min(1),
  goals:      z.number().int().min(0).optional(),
  assists:    z.number().int().min(0).optional(),
  points:     z.number().int().min(0).optional(),
  stats:      z.record(z.number().int().min(0)).optional(),
});
router.patch(
  "/:id/players/stats",
  jwtCheck, attachUser, requireAuth,
  validate({ params: idParamSchema, body: updateStatSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id }  = req.params as unknown as z.infer<typeof idParamSchema>;
      const body    = req.body as z.infer<typeof updateStatSchema>;

      const tournament = await prisma.tournament.findUnique({ where: { id }, include: { coOrganizers: true } });
      if (!tournament) throw new NotFoundError("Tournament");
      if (!isScorerOrAbove(tournament, req.userId!)) throw new BadRequestError("Only organizer or co-organizer can update stats");

      const players = (tournament.players as any[]) ?? [];
      const idx = players.findIndex(
        (p: any) => p.teamName === body.teamName && p.playerName === body.playerName
      );
      if (idx === -1) throw new NotFoundError("Player not found");
      const schema = getSportPlayerStatSchema(tournament.sport);
      const allowedKeys = new Set(schema.fields.map((f) => f.key));
      const currentStats = normalizePlayerStats(players[idx], tournament.sport);
      const patchStats = body.stats ?? {};

      for (const key of Object.keys(patchStats)) {
        if (!allowedKeys.has(key)) {
          throw new BadRequestError(`Invalid stat key "${key}" for sport ${tournament.sport}`);
        }
      }
      for (const [key, value] of Object.entries(patchStats)) {
        currentStats[key] = value;
      }
      // Backward compatibility for old clients that still send fixed keys.
      if (body.goals !== undefined && allowedKeys.has("goals")) currentStats.goals = body.goals;
      if (body.assists !== undefined && allowedKeys.has("assists")) currentStats.assists = body.assists;
      if (body.points !== undefined && allowedKeys.has("points")) currentStats.points = body.points;

      players[idx].stats = currentStats;
      players[idx].goals = getPlayerStatValue({ stats: currentStats }, "goals");
      players[idx].assists = getPlayerStatValue({ stats: currentStats }, "assists");
      players[idx].points = getPlayerStatValue({ stats: currentStats }, "points");

      await prisma.tournament.update({
        where: { id },
        data:  { players: players as Prisma.InputJsonValue },
      });
      res.json({ success: true, data: players[idx] });
    } catch (err) { next(err); }
  }
);

// GET /:id/top-scorers — Return players sorted by sport schema fields
router.get(
  "/:id/top-scorers",
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const tournament = await prisma.tournament.findUnique({ where: { id } });
      if (!tournament) throw new NotFoundError("Tournament");
      const players = (tournament.players as any[]) ?? [];
      const schema = getSportPlayerStatSchema(tournament.sport);
      const normalizedPlayers = players.map((p: any) => {
        const stats = normalizePlayerStats(p, tournament.sport);
        return {
          ...p,
          stats,
          goals: stats.goals ?? p.goals ?? 0,
          assists: stats.assists ?? p.assists ?? 0,
          points: stats.points ?? p.points ?? 0,
        };
      });
      const sorted  = [...normalizedPlayers].sort((a, b) => {
        for (const field of schema.fields) {
          const delta = (b.stats?.[field.key] ?? 0) - (a.stats?.[field.key] ?? 0);
          if (delta !== 0) return delta;
        }
        return String(a.playerName ?? "").localeCompare(String(b.playerName ?? ""));
      });
      res.json({ success: true, data: sorted, schema });
    } catch (err) { next(err); }
  }
);

// ─── Sponsors ─────────────────────────────────────────────────────────────────

const sponsorSchema = z.object({ name: z.string().min(1), logoUrl: z.string().optional(), tier: z.string().optional() });
const sponsorsBodySchema = z.object({ sponsors: z.array(sponsorSchema) });

// PATCH /:id/sponsors — Replace sponsors list
router.patch(
  "/:id/sponsors",
  jwtCheck, attachUser, requireAuth,
  validate({ params: idParamSchema, body: sponsorsBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id }      = req.params as unknown as z.infer<typeof idParamSchema>;
      const { sponsors } = req.body as z.infer<typeof sponsorsBodySchema>;

      const tournament = await prisma.tournament.findUnique({ where: { id }, include: { coOrganizers: true } });
      if (!tournament) throw new NotFoundError("Tournament");
      if (!isManagerOrAbove(tournament, req.userId!)) throw new BadRequestError("Only organizer or manager can update sponsors");

      const updated = await prisma.tournament.update({
        where: { id },
        data:  { sponsors: sponsors as Prisma.InputJsonValue },
      });
      res.json({ success: true, data: updated.sponsors });
    } catch (err) { next(err); }
  }
);

// ─── Announcements ────────────────────────────────────────────────────────────

const announcementBodySchema = z.object({
  title: z.string().min(1).max(255),
  body:  z.string().min(1),
});

// GET /:id/announcements — Public list
router.get(
  "/:id/announcements",
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const tournament = await prisma.tournament.findUnique({ where: { id } });
      if (!tournament) throw new NotFoundError("Tournament");
      const announcements = await prisma.tournamentAnnouncement.findMany({
        where:   { tournamentId: id },
        orderBy: { createdAt: "desc" },
      });
      res.json({ success: true, data: announcements });
    } catch (err) { next(err); }
  }
);

// POST /:id/announcements — Organizer post
router.post(
  "/:id/announcements",
  jwtCheck, attachUser, requireAuth,
  validate({ params: idParamSchema, body: announcementBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id }   = req.params as unknown as z.infer<typeof idParamSchema>;
      const body     = req.body as z.infer<typeof announcementBodySchema>;

      const tournament = await prisma.tournament.findUnique({ where: { id }, include: { coOrganizers: true } });
      if (!tournament) throw new NotFoundError("Tournament");
      if (!isManagerOrAbove(tournament, req.userId!)) throw new BadRequestError("Only organizer or manager can post announcements");

      const announcement = await prisma.tournamentAnnouncement.create({
        data: { tournamentId: id, title: body.title, body: body.body },
      });

      // Notify all rostered players about the new announcement (non-blocking)
      const announcedPlayerIds = rosterUserIds(tournament.players);
      if (announcedPlayerIds.length) {
        void createBulkNotifications(
          announcedPlayerIds,
          NotifType.TOURNAMENT_ANNOUNCEMENT,
          `📢 ${body.title}`,
          body.body.length > 120 ? `${body.body.slice(0, 117)}…` : body.body,
          { tournamentId: id, announcementId: announcement.id }
        );
      }

      res.status(201).json({ success: true, data: announcement });
    } catch (err) { next(err); }
  }
);

// DELETE /:id/announcements/:announcementId — Organizer delete
router.delete(
  "/:id/announcements/:announcementId",
  jwtCheck, attachUser, requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idParam = req.params.id;
      const annParam = req.params.announcementId;
      const tournamentId = parseInt(Array.isArray(idParam) ? idParam[0]! : idParam, 10);
      const announcementId = parseInt(Array.isArray(annParam) ? annParam[0]! : annParam, 10);
      if (isNaN(tournamentId) || isNaN(announcementId)) return next(new BadRequestError("Invalid ID"));

      const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId }, include: { coOrganizers: true } });
      if (!tournament) throw new NotFoundError("Tournament");
      if (!isManagerOrAbove(tournament, req.userId!)) throw new BadRequestError("Only organizer or manager can delete announcements");

      await prisma.tournamentAnnouncement.delete({ where: { id: announcementId } });
      res.json({ success: true, message: "Announcement deleted" });
    } catch (err) { next(err); }
  }
);

// ─── Co-organizer management ──────────────────────────────────────────────────

const coOrgBodySchema = z.object({
  userId: z.number().int().positive(),
  role:   z.enum(["manager", "scorer"]).default("manager"),
});
const coOrgRoleBodySchema = z.object({ role: z.enum(["manager", "scorer"]) });

// GET /:id/co-organizers — Public list
router.get(
  "/:id/co-organizers",
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const tournament = await prisma.tournament.findUnique({ where: { id } });
      if (!tournament) throw new NotFoundError("Tournament");
      const coOrgs = await prisma.tournamentCoOrganizer.findMany({
        where: { tournamentId: id },
        include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
        orderBy: { addedAt: "asc" },
      });
      res.json({ success: true, data: coOrgs });
    } catch (err) { next(err); }
  }
);

// POST /:id/co-organizers — Creator-only: add a co-organizer
router.post(
  "/:id/co-organizers",
  jwtCheck, attachUser, requireAuth,
  validate({ params: idParamSchema, body: coOrgBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id }      = req.params as unknown as z.infer<typeof idParamSchema>;
      const { userId: targetUserId, role } = req.body as z.infer<typeof coOrgBodySchema>;
      const requesterId = req.userId!;

      const tournament = await prisma.tournament.findUnique({ where: { id } });
      if (!tournament) throw new NotFoundError("Tournament");
      if (tournament.createdById !== requesterId) throw new BadRequestError("Only the creator can add co-organizers");
      if (targetUserId === requesterId) throw new BadRequestError("Creator cannot add themselves as co-organizer");

      const user = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
      if (!user) throw new NotFoundError("User");

      const coOrg = await prisma.tournamentCoOrganizer.upsert({
        where: { tournamentId_userId: { tournamentId: id, userId: targetUserId } },
        create: { tournamentId: id, userId: targetUserId, role },
        update: { role },
        include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
      });
      res.status(201).json({ success: true, data: coOrg });
    } catch (err) { next(err); }
  }
);

// PATCH /:id/co-organizers/:uid — Creator-only: change role
router.patch(
  "/:id/co-organizers/:uid",
  jwtCheck, attachUser, requireAuth,
  validate({ params: idParamSchema, body: coOrgRoleBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const targetUserId = parseInt(req.params.uid as string, 10);
      const { role }    = req.body as z.infer<typeof coOrgRoleBodySchema>;
      const requesterId = req.userId!;

      if (isNaN(targetUserId)) throw new BadRequestError("Invalid user ID");
      const tournament = await prisma.tournament.findUnique({ where: { id } });
      if (!tournament) throw new NotFoundError("Tournament");
      if (tournament.createdById !== requesterId) throw new BadRequestError("Only the creator can update co-organizer roles");

      const coOrg = await prisma.tournamentCoOrganizer.update({
        where: { tournamentId_userId: { tournamentId: id, userId: targetUserId } },
        data: { role },
        include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
      });
      res.json({ success: true, data: coOrg });
    } catch (err) { next(err); }
  }
);

// DELETE /:id/co-organizers/:uid — Creator-only: remove a co-organizer
router.delete(
  "/:id/co-organizers/:uid",
  jwtCheck, attachUser, requireAuth,
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id }      = req.params as unknown as z.infer<typeof idParamSchema>;
      const targetUserId = parseInt(req.params.uid as string, 10);
      const requesterId = req.userId!;

      if (isNaN(targetUserId)) throw new BadRequestError("Invalid user ID");
      const tournament = await prisma.tournament.findUnique({ where: { id } });
      if (!tournament) throw new NotFoundError("Tournament");
      if (tournament.createdById !== requesterId) throw new BadRequestError("Only the creator can remove co-organizers");

      await prisma.tournamentCoOrganizer.delete({
        where: { tournamentId_userId: { tournamentId: id, userId: targetUserId } },
      });
      res.json({ success: true, message: "Co-organizer removed" });
    } catch (err) { next(err); }
  }
);

export default router;
