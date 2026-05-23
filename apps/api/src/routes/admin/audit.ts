/**
 * Admin: Audit log and approval request management
 *
 * GET  /api/admin/audit                     — paginated audit log
 * GET  /api/admin/audit/approvals           — pending/all approval requests
 * POST /api/admin/audit/approvals/:id/approve
 * POST /api/admin/audit/approvals/:id/reject
 *
 * Also exports the `writeAudit` helper used by all other admin routes.
 */
import { Router } from "express";
import prisma from "../../lib/prisma";
import { NotFoundError, BadRequestError, ForbiddenError } from "../../lib/errors";
import { creditWallet, debitWallet } from "../../services/wallet";

const router: Router = Router();

// ── Internal helper used by other admin sub-routers ────────────────────────────
export async function writeAudit(
  tx: any,
  data: {
    actorId: number;
    targetId?: number | null;
    targetType: string;
    action: string;
    payload?: object;
    ipAddress?: string;
  }
) {
  return tx.adminAuditLog.create({
    data: {
      actorId:    data.actorId,
      targetId:   data.targetId ?? null,
      targetType: data.targetType,
      action:     data.action,
      payload:    data.payload ?? {},
      ipAddress:  data.ipAddress ?? null,
    },
  });
}

// ── Audit log ─────────────────────────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { action, actorId, targetId, page = "1", limit = "30" } = req.query as Record<string, string>;
    const take = Math.min(parseInt(limit, 10) || 30, 100);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

    const where: any = {};
    if (action)   where.action   = { contains: action };
    if (actorId)  where.actorId  = parseInt(actorId, 10);
    if (targetId) where.targetId = parseInt(targetId, 10);

    const [logs, total] = await Promise.all([
      (prisma as any).adminAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          actor:  { select: { id: true, name: true, email: true } },
          target: { select: { id: true, name: true, email: true } },
        },
      }),
      (prisma as any).adminAuditLog.count({ where }),
    ]);

    res.json({ logs, total, page: parseInt(page, 10), limit: take });
  } catch (err) {
    next(err);
  }
});

// ── Approval requests ──────────────────────────────────────────────────────────
router.get("/approvals", async (req, res, next) => {
  try {
    const { status = "pending", page = "1", limit = "20" } = req.query as Record<string, string>;
    const take = Math.min(parseInt(limit, 10) || 20, 100);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

    const where: any = {};
    if (status !== "all") where.status = status;

    const [requests, total] = await Promise.all([
      (prisma as any).adminApprovalRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          initiator: { select: { id: true, name: true, email: true } },
          reviewer:  { select: { id: true, name: true, email: true } },
        },
      }),
      (prisma as any).adminApprovalRequest.count({ where }),
    ]);

    res.json({ requests, total, page: parseInt(page, 10), limit: take });
  } catch (err) {
    next(err);
  }
});

// ── Approve a request ─────────────────────────────────────────────────────────
router.post("/approvals/:id/approve", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { reviewNote } = req.body as { reviewNote?: string };

    const approval = await (prisma as any).adminApprovalRequest.findUnique({ where: { id } });
    if (!approval) throw new NotFoundError("Approval request");
    if (approval.status !== "pending") throw new BadRequestError("Request is no longer pending");
    if (approval.initiatorId === req.userId) throw new ForbiddenError("Cannot approve your own request");

    await (prisma as any).$transaction(async (tx: any) => {
      await tx.adminApprovalRequest.update({
        where: { id },
        data: { status: "approved", reviewerId: req.userId!, reviewNote, reviewedAt: new Date() },
      });

      // Execute the underlying action
      await executeApprovedAction(approval, tx);

      await writeAudit(tx, {
        actorId:    req.userId!,
        targetId:   approval.initiatorId,
        targetType: "approval",
        action:     `approval.approve:${approval.type}`,
        payload:    { approvalId: id, reviewNote },
      });
    });

    res.json({ message: "Approved and executed" });
  } catch (err) {
    next(err);
  }
});

// ── Reject a request ──────────────────────────────────────────────────────────
router.post("/approvals/:id/reject", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { reviewNote } = req.body as { reviewNote: string };
    if (!reviewNote?.trim()) throw new BadRequestError("Rejection reason is required");

    const approval = await (prisma as any).adminApprovalRequest.findUnique({ where: { id } });
    if (!approval) throw new NotFoundError("Approval request");
    if (approval.status !== "pending") throw new BadRequestError("Request is no longer pending");

    await (prisma as any).$transaction(async (tx: any) => {
      await tx.adminApprovalRequest.update({
        where: { id },
        data: { status: "rejected", reviewerId: req.userId!, reviewNote, reviewedAt: new Date() },
      });
      await writeAudit(tx, {
        actorId:    req.userId!,
        targetId:   approval.initiatorId,
        targetType: "approval",
        action:     `approval.reject:${approval.type}`,
        payload:    { approvalId: id, reviewNote },
      });
    });

    res.json({ message: "Request rejected" });
  } catch (err) {
    next(err);
  }
});

// ── Action executor (called on approval) ──────────────────────────────────────
async function executeApprovedAction(approval: any, tx: any) {
  const { type, payload } = approval;

  if (type === "wallet.credit") {
    const { userId, amount, description } = payload;
    await creditWallet(userId, amount, `[Admin Approved] ${description}`, "manual", approval.id);
  } else if (type === "wallet.debit") {
    const { userId, amount, description } = payload;
    await debitWallet(userId, amount, `[Admin Approved] ${description}`, "manual", approval.id);
  } else if (type === "user.offboard") {
    const { userId, reason } = payload;
    await tx.user.update({
      where: { id: userId },
      data: { isActive: false, suspendedAt: new Date(), suspensionReason: reason },
    });
    await tx.refreshToken.updateMany({ where: { userId, revoked: false }, data: { revoked: true } });
  }
}

export default router;
