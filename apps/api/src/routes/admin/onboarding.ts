/**
 * Admin: Onboarding and offboarding workflows for trainers and venue owners.
 *
 * GET  /api/admin/onboarding           — list users pending/approved/rejected
 * POST /api/admin/onboarding/:id/approve-trainer  — approve + provision TrainerProfile
 * POST /api/admin/onboarding/:id/approve-owner    — approve as venue_owner
 * POST /api/admin/onboarding/:id/reject           — reject application
 * POST /api/admin/onboarding/:id/offboard         — offboard (high-risk → approval queue)
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
  isActive: true,
  onboardingStatus: true,
  onboardingNote: true,
  createdAt: true,
  trainerProfile: { select: { id: true, bio: true, rating: true } },
  ownedVenues:    { select: { id: true, name: true } },
};

// ── List onboarding queue ─────────────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { status, role, page = "1", limit = "20" } = req.query as Record<string, string>;
    const take = Math.min(parseInt(limit, 10) || 20, 100);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

    const where: any = {};
    if (status) where.onboardingStatus = status;
    if (role)   where.role = role;

    // If no filters, show all users who are trainers/owners or have a pending onboarding status
    if (!status && !role) {
      where.OR = [
        { role: { in: ["trainer", "coach", "venue_owner"] } },
        { onboardingStatus: { not: null } },
      ];
    }

    const [users, total] = await Promise.all([
      (prisma as any).user.findMany({ where, select: USER_SELECT, orderBy: { createdAt: "desc" }, skip, take }),
      (prisma as any).user.count({ where }),
    ]);

    res.json({ users, total, page: parseInt(page, 10), limit: take });
  } catch (err) {
    next(err);
  }
});

// ── Approve as trainer ────────────────────────────────────────────────────────
router.post("/:id/approve-trainer", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { note } = req.body as { note?: string };

    const existing = await (prisma as any).user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!existing) throw new NotFoundError("User");

    const updated = await (prisma as any).$transaction(async (tx: any) => {
      // Never demote platform admins when approving trainer applications
      const nextRole = existing.role === "admin" ? "admin" : "trainer";
      const u = await tx.user.update({
        where: { id },
        data: { role: nextRole, isActive: true, onboardingStatus: "approved", onboardingNote: note ?? null },
        select: USER_SELECT,
      });
      // Provision TrainerProfile if not yet created
      const hasProfile = await tx.trainerProfile.findUnique({ where: { userId: id } });
      if (!hasProfile) {
        await tx.trainerProfile.create({ data: { userId: id } });
      }
      // Revoke tokens so new role takes effect immediately
      await tx.refreshToken.updateMany({ where: { userId: id, revoked: false }, data: { revoked: true } });
      await writeAudit(tx, {
        actorId:    req.userId!,
        targetId:   id,
        targetType: "user",
        action:     "onboarding.approve_trainer",
        payload:    { previousRole: existing.role, note },
      });
      return u;
    });

    res.json({ user: updated, message: "Approved as trainer and profile provisioned" });
  } catch (err) {
    next(err);
  }
});

// ── Approve as venue owner ────────────────────────────────────────────────────
router.post("/:id/approve-owner", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { note } = req.body as { note?: string };

    const existing = await (prisma as any).user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!existing) throw new NotFoundError("User");

    const updated = await (prisma as any).$transaction(async (tx: any) => {
      // Never demote platform admins when approving venue-owner applications
      const nextRole = existing.role === "admin" ? "admin" : "venue_owner";
      const u = await tx.user.update({
        where: { id },
        data: { role: nextRole, isActive: true, onboardingStatus: "approved", onboardingNote: note ?? null },
        select: USER_SELECT,
      });
      await tx.refreshToken.updateMany({ where: { userId: id, revoked: false }, data: { revoked: true } });
      await writeAudit(tx, {
        actorId:    req.userId!,
        targetId:   id,
        targetType: "user",
        action:     "onboarding.approve_owner",
        payload:    { previousRole: existing.role, note },
      });
      return u;
    });

    res.json({ user: updated, message: "Approved as venue owner" });
  } catch (err) {
    next(err);
  }
});

// ── Reject application ────────────────────────────────────────────────────────
router.post("/:id/reject", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { reason } = req.body as { reason: string };
    if (!reason?.trim()) throw new BadRequestError("Rejection reason is required");

    const existing = await (prisma as any).user.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundError("User");

    await (prisma as any).$transaction(async (tx: any) => {
      await tx.user.update({
        where: { id },
        data: { onboardingStatus: "rejected", onboardingNote: reason.trim() },
      });
      await writeAudit(tx, {
        actorId:    req.userId!,
        targetId:   id,
        targetType: "user",
        action:     "onboarding.reject",
        payload:    { reason },
      });
    });

    res.json({ message: "Application rejected" });
  } catch (err) {
    next(err);
  }
});

// ── Offboard (creates approval request — high risk) ───────────────────────────
router.post("/:id/offboard", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { reason } = req.body as { reason: string };
    if (!reason?.trim()) throw new BadRequestError("Offboarding reason is required");
    if (id === req.userId) throw new BadRequestError("Cannot offboard yourself");

    const existing = await (prisma as any).user.findUnique({ where: { id }, select: { id: true, name: true, role: true } });
    if (!existing) throw new NotFoundError("User");

    // High-risk action: queue for second-admin approval
    const approval = await (prisma as any).adminApprovalRequest.create({
      data: {
        initiatorId: req.userId!,
        type:        "user.offboard",
        riskLevel:   "high",
        status:      "pending",
        payload:     { userId: id, userName: existing.name, userRole: existing.role, reason: reason.trim() },
        reason:      reason.trim(),
      },
    });

    await writeAudit(prisma, {
      actorId:    req.userId!,
      targetId:   id,
      targetType: "user",
      action:     "onboarding.offboard_requested",
      payload:    { reason, approvalId: approval.id },
    });

    res.status(202).json({ approval, message: "Offboarding queued for second-admin approval" });
  } catch (err) {
    next(err);
  }
});

export default router;
