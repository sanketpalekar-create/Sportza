/**
 * Admin: User account management
 *
 * GET  /api/admin/users          — search/list users (paginated)
 * GET  /api/admin/users/:id      — get single user profile
 * PATCH /api/admin/users/:id/role     — change role
 * PATCH /api/admin/users/:id/suspend  — suspend account
 * PATCH /api/admin/users/:id/activate — re-activate account
 */
import { Router } from "express";
import prisma from "../../lib/prisma";
import { NotFoundError, BadRequestError } from "../../lib/errors";
import { writeAudit } from "./audit";

const router: Router = Router();

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  avatar: true,
  location: { select: { city: true, state: true } },
  isActive: true,
  suspendedAt: true,
  suspensionReason: true,
  onboardingStatus: true,
  onboardingNote: true,
  createdAt: true,
  trainerProfile: { select: { id: true, bio: true, rating: true } },
  ownedVenues: { select: { id: true, name: true, isActive: true } },
};

// ── List / search ──────────────────────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { q, role, status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const take = Math.min(parseInt(limit, 10) || 20, 100);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

    const where: any = {};
    if (q) {
      where.OR = [
        { name:  { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
      ];
    }
    if (role) where.role = role;
    if (status === "active")    where.isActive = true;
    if (status === "suspended") where.isActive = false;

    const [users, total] = await Promise.all([
      (prisma as any).user.findMany({ where, select: USER_SELECT, orderBy: { createdAt: "desc" }, skip, take }),
      (prisma as any).user.count({ where }),
    ]);

    res.json({ users, total, page: parseInt(page, 10), limit: take });
  } catch (err) {
    next(err);
  }
});

// ── Single user ───────────────────────────────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const user = await (prisma as any).user.findUnique({ where: { id }, select: USER_SELECT });
    if (!user) throw new NotFoundError("User");
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

// ── Change role ───────────────────────────────────────────────────────────────
router.patch("/:id/role", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { role, reason } = req.body as { role: string; reason?: string };
    const ALLOWED = ["player", "coach", "trainer", "venue_owner", "admin"];
    if (!role || !ALLOWED.includes(role)) throw new BadRequestError("Invalid role");

    const existing = await (prisma as any).user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!existing) throw new NotFoundError("User");

    const updated = await (prisma as any).$transaction(async (tx: any) => {
      const u = await tx.user.update({ where: { id }, data: { role }, select: USER_SELECT });
      // Revoke old refresh tokens so role change is immediate
      await tx.refreshToken.updateMany({ where: { userId: id, revoked: false }, data: { revoked: true } });
      await writeAudit(tx, {
        actorId: req.userId!,
        targetId: id,
        targetType: "user",
        action: "user.role_change",
        payload: { fromRole: existing.role, toRole: role, reason },
        ipAddress: req.ip,
      });
      return u;
    });

    res.json({ user: updated, message: "Role updated and sessions revoked" });
  } catch (err) {
    next(err);
  }
});

// ── Suspend account ───────────────────────────────────────────────────────────
router.patch("/:id/suspend", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { reason } = req.body as { reason: string };
    if (!reason?.trim()) throw new BadRequestError("Suspension reason is required");
    if (id === req.userId) throw new BadRequestError("Cannot suspend your own account");

    const existing = await (prisma as any).user.findUnique({ where: { id }, select: { id: true, isActive: true } });
    if (!existing) throw new NotFoundError("User");
    if (!existing.isActive) throw new BadRequestError("User is already suspended");

    const updated = await (prisma as any).$transaction(async (tx: any) => {
      const u = await tx.user.update({
        where: { id },
        data: { isActive: false, suspendedAt: new Date(), suspensionReason: reason.trim() },
        select: USER_SELECT,
      });
      await tx.refreshToken.updateMany({ where: { userId: id, revoked: false }, data: { revoked: true } });
      await writeAudit(tx, {
        actorId: req.userId!,
        targetId: id,
        targetType: "user",
        action: "user.suspend",
        payload: { reason },
        ipAddress: req.ip,
      });
      return u;
    });

    res.json({ user: updated, message: "User suspended and sessions revoked" });
  } catch (err) {
    next(err);
  }
});

// ── Activate account ──────────────────────────────────────────────────────────
router.patch("/:id/activate", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

    const existing = await (prisma as any).user.findUnique({ where: { id }, select: { id: true, isActive: true } });
    if (!existing) throw new NotFoundError("User");
    if (existing.isActive) throw new BadRequestError("User is already active");

    const updated = await (prisma as any).$transaction(async (tx: any) => {
      const u = await tx.user.update({
        where: { id },
        data: { isActive: true, suspendedAt: null, suspensionReason: null },
        select: USER_SELECT,
      });
      await writeAudit(tx, {
        actorId: req.userId!,
        targetId: id,
        targetType: "user",
        action: "user.activate",
        payload: {},
        ipAddress: req.ip,
      });
      return u;
    });

    res.json({ user: updated, message: "User activated" });
  } catch (err) {
    next(err);
  }
});

export default router;
