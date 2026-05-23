/**
 * Admin: Venue and facility management
 *
 * GET   /api/admin/venues              — list all venues
 * GET   /api/admin/venues/:id          — venue details
 * PATCH /api/admin/venues/:id/activate   — activate venue
 * PATCH /api/admin/venues/:id/deactivate — deactivate venue
 * PATCH /api/admin/venues/:id/owner      — reassign owner
 * GET   /api/admin/venues/:id/facilities — list facilities for a venue
 */
import { Router } from "express";
import prisma from "../../lib/prisma";
import { NotFoundError, BadRequestError } from "../../lib/errors";
import { writeAudit } from "./audit";

const router: Router = Router();

const VENUE_SELECT = {
  id:               true,
  name:             true,
  ownerId:          true,
  location:         { select: { city: true, state: true, address: true } },
  isActive:         true,
  createdAt:        true,
  capacity:         true,
  pricePerHour:     true,
  commissionPercent: true,
  owner:            { select: { id: true, name: true, email: true } },
  sportFacilities:  { select: { id: true, name: true, surfaceType: true, count: true } },
  dbFacilities:     { select: { id: true, name: true, surfaceType: true } },
};

// ── List / search venues ──────────────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { q, status, city, page = "1", limit = "20" } = req.query as Record<string, string>;
    const take = Math.min(parseInt(limit, 10) || 20, 100);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

    const where: any = {};
    if (q) {
      where.OR = [
        { name:     { contains: q } },
        { location: { address: { contains: q } } },
        { location: { city: { contains: q } } },
      ];
    }
    if (city) where.location = { city: { contains: city } };
    if (status === "active")   where.isActive = true;
    if (status === "inactive") where.isActive = false;

    const [venues, total] = await Promise.all([
      (prisma as any).venue.findMany({ where, select: VENUE_SELECT, orderBy: { createdAt: "desc" }, skip, take }),
      (prisma as any).venue.count({ where }),
    ]);

    res.json({ venues, total, page: parseInt(page, 10), limit: take });
  } catch (err) {
    next(err);
  }
});

// ── Single venue ──────────────────────────────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const venue = await (prisma as any).venue.findUnique({ where: { id }, select: VENUE_SELECT });
    if (!venue) throw new NotFoundError("Venue");
    res.json({ venue });
  } catch (err) {
    next(err);
  }
});

// ── Activate venue ────────────────────────────────────────────────────────────
router.patch("/:id/activate", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await (prisma as any).venue.findUnique({ where: { id }, select: { id: true, isActive: true, name: true } });
    if (!existing) throw new NotFoundError("Venue");
    if (existing.isActive) throw new BadRequestError("Venue is already active");

    const updated = await (prisma as any).$transaction(async (tx: any) => {
      const v = await tx.venue.update({ where: { id }, data: { isActive: true }, select: VENUE_SELECT });
      await writeAudit(tx, {
        actorId:    req.userId!,
        targetType: "venue",
        action:     "venue.activate",
        payload:    { venueId: id, venueName: existing.name },
      });
      return v;
    });

    res.json({ venue: updated, message: "Venue activated" });
  } catch (err) {
    next(err);
  }
});

// ── Deactivate venue ──────────────────────────────────────────────────────────
router.patch("/:id/deactivate", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { reason } = req.body as { reason?: string };
    const existing = await (prisma as any).venue.findUnique({ where: { id }, select: { id: true, isActive: true, name: true } });
    if (!existing) throw new NotFoundError("Venue");
    if (!existing.isActive) throw new BadRequestError("Venue is already inactive");

    const updated = await (prisma as any).$transaction(async (tx: any) => {
      const v = await tx.venue.update({ where: { id }, data: { isActive: false }, select: VENUE_SELECT });
      await writeAudit(tx, {
        actorId:    req.userId!,
        targetType: "venue",
        action:     "venue.deactivate",
        payload:    { venueId: id, venueName: existing.name, reason },
      });
      return v;
    });

    res.json({ venue: updated, message: "Venue deactivated" });
  } catch (err) {
    next(err);
  }
});

// ── Reassign venue owner ──────────────────────────────────────────────────────
router.patch("/:id/owner", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { ownerId, reason } = req.body as { ownerId: number; reason?: string };
    if (!ownerId) throw new BadRequestError("New ownerId is required");

    const [venue, newOwner] = await Promise.all([
      (prisma as any).venue.findUnique({ where: { id }, select: { id: true, ownerId: true, name: true } }),
      (prisma as any).user.findUnique({ where: { id: ownerId }, select: { id: true, role: true } }),
    ]);
    if (!venue)    throw new NotFoundError("Venue");
    if (!newOwner) throw new NotFoundError("New owner user");

    const updated = await (prisma as any).$transaction(async (tx: any) => {
      const v = await tx.venue.update({ where: { id }, data: { ownerId }, select: VENUE_SELECT });
      await writeAudit(tx, {
        actorId:    req.userId!,
        targetType: "venue",
        action:     "venue.reassign_owner",
        payload:    { venueId: id, fromOwner: venue.ownerId, toOwner: ownerId, reason },
      });
      return v;
    });

    res.json({ venue: updated, message: "Venue owner reassigned" });
  } catch (err) {
    next(err);
  }
});

// ── Facilities for a venue ────────────────────────────────────────────────────
router.get("/:id/facilities", async (req, res, next) => {
  try {
    const venueId = parseInt(req.params.id, 10);
    const venue = await (prisma as any).venue.findUnique({ where: { id: venueId }, select: { id: true } });
    if (!venue) throw new NotFoundError("Venue");

    const facilities = await (prisma as any).facility.findMany({
      where: { venueId },
      orderBy: { createdAt: "asc" },
    });

    res.json({ facilities });
  } catch (err) {
    next(err);
  }
});

export default router;
