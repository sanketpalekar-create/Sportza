/**
 * Admin API namespace — /api/admin/*
 *
 * Every route in this tree enforces:
 *   1. JWT auth (jwtCheck + requireAuth)
 *   2. DB-level role check (admin only)
 *   3. Activity written to AdminAuditLog on every mutation
 */
import { Router, Request, Response, NextFunction } from "express";
import { jwtCheck, requireAuth } from "../../middleware/auth";
import prisma from "../../lib/prisma";
import { ForbiddenError } from "../../lib/errors";

import userRoutes      from "./users";
import onboardRoutes   from "./onboarding";
import venueRoutes     from "./venues";
import ledgerRoutes    from "./ledger";
import auditRoutes     from "./audit";

const router: Router = Router();

// ── Admin auth guard (DB-verified) ─────────────────────────────────────────────
async function requireAdminFromDb(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.userId) return next(new ForbiddenError("Admin access required"));
    const user = await (prisma as any).user.findUnique({
      where: { id: req.userId },
      select: { role: true, isActive: true },
    });
    if (!user || user.role !== "admin" || !user.isActive) {
      return next(new ForbiddenError("Admin access required"));
    }
    next();
  } catch (err) {
    next(err);
  }
}

// Apply auth + admin check to every admin route
router.use(jwtCheck, requireAuth, requireAdminFromDb);

// ── Sub-routers ────────────────────────────────────────────────────────────────
router.use("/users",      userRoutes);
router.use("/onboarding", onboardRoutes);
router.use("/venues",     venueRoutes);
router.use("/ledger",     ledgerRoutes);
router.use("/audit",      auditRoutes);

// ── Dashboard stats ────────────────────────────────────────────────────────────
router.get("/stats", async (req, res, next) => {
  try {
    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      totalVenues,
      activeVenues,
      pendingApprovals,
      pendingOnboarding,
      totalTrainers,
      totalOwners,
    ] = await Promise.all([
      (prisma as any).user.count(),
      (prisma as any).user.count({ where: { isActive: true } }),
      (prisma as any).user.count({ where: { isActive: false } }),
      (prisma as any).venue.count(),
      (prisma as any).venue.count({ where: { isActive: true } }),
      (prisma as any).adminApprovalRequest.count({ where: { status: "pending" } }),
      (prisma as any).user.count({ where: { onboardingStatus: "pending" } }),
      (prisma as any).user.count({ where: { role: { in: ["trainer", "coach"] } } }),
      (prisma as any).user.count({ where: { role: "venue_owner" } }),
    ]);

    res.json({
      users: { total: totalUsers, active: activeUsers, suspended: suspendedUsers },
      venues: { total: totalVenues, active: activeVenues, inactive: totalVenues - activeVenues },
      pendingApprovals,
      pendingOnboarding,
      roles: { trainers: totalTrainers, owners: totalOwners },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
