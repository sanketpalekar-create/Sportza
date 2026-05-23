/**
 * Admin: Ledger / wallet management
 *
 * GET  /api/admin/ledger               — list all wallet transactions (cross-user)
 * GET  /api/admin/ledger/:userId       — single user wallet + transactions
 * POST /api/admin/ledger/adjust        — request a wallet adjustment (queued for approval)
 * POST /api/admin/ledger/adjust/direct — direct low-risk credit (e.g. refund correction ≤ ₹500)
 */
import { Router } from "express";
import prisma from "../../lib/prisma";
import { BadRequestError, NotFoundError } from "../../lib/errors";
import { creditWallet, debitWallet } from "../../services/wallet";
import { writeAudit } from "./audit";

const router: Router = Router();

const HIGH_RISK_THRESHOLD = 500; // amounts above this go to approval queue

// ── Cross-user transaction list ───────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { userId, type, refType, page = "1", limit = "30" } = req.query as Record<string, string>;
    const take = Math.min(parseInt(limit, 10) || 30, 100);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

    const where: any = {};
    if (userId) where.userId = parseInt(userId, 10);
    if (type)   where.type   = type;
    if (refType) where.referenceType = refType;

    const [transactions, total] = await Promise.all([
      (prisma as any).walletTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      (prisma as any).walletTransaction.count({ where }),
    ]);

    res.json({ transactions, total, page: parseInt(page, 10), limit: take });
  } catch (err) {
    next(err);
  }
});

// ── Single user wallet ─────────────────────────────────────────────────────────
router.get("/:userId", async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const { page = "1", limit = "20" } = req.query as Record<string, string>;
    const take = Math.min(parseInt(limit, 10) || 20, 100);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

    const user = await (prisma as any).user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
    if (!user) throw new NotFoundError("User");

    const wallet = await (prisma as any).walletAccount.findUnique({ where: { userId } });
    const [transactions, total] = wallet
      ? await Promise.all([
          (prisma as any).walletTransaction.findMany({
            where: { walletId: wallet.id },
            orderBy: { createdAt: "desc" },
            skip,
            take,
          }),
          (prisma as any).walletTransaction.count({ where: { walletId: wallet.id } }),
        ])
      : [[], 0];

    res.json({ user, wallet: wallet ?? { balance: 0 }, transactions, total, page: parseInt(page, 10), limit: take });
  } catch (err) {
    next(err);
  }
});

// ── Request adjustment (high-risk → approval queue) ───────────────────────────
router.post("/adjust", async (req, res, next) => {
  try {
    const { userId, type, amount, description, reason } = req.body as {
      userId: number; type: "credit" | "debit"; amount: number; description: string; reason: string;
    };

    if (!userId || !type || !amount || !description || !reason)
      throw new BadRequestError("userId, type, amount, description, reason are required");
    if (!["credit", "debit"].includes(type)) throw new BadRequestError("type must be credit or debit");
    if (amount <= 0) throw new BadRequestError("amount must be positive");

    const user = await (prisma as any).user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
    if (!user) throw new NotFoundError("User");

    // Direct execution for small amounts
    if (amount <= HIGH_RISK_THRESHOLD) {
      const result = type === "credit"
        ? await creditWallet(userId, amount, `[Admin] ${description}`, "manual")
        : await debitWallet(userId,  amount, `[Admin] ${description}`, "manual");

      await writeAudit(prisma, {
        actorId:    req.userId!,
        targetId:   userId,
        targetType: "wallet",
        action:     `wallet.${type}_direct`,
        payload:    { amount, description, reason, transactionId: result.transactionId },
      });

      return res.json({ executed: true, result, message: `Direct ${type} of ₹${amount} applied` });
    }

    // Large amounts go to approval queue
    const approval = await (prisma as any).adminApprovalRequest.create({
      data: {
        initiatorId: req.userId!,
        type:        `wallet.${type}`,
        riskLevel:   "high",
        status:      "pending",
        payload:     { userId, userName: user.name, amount, description },
        reason:      reason.trim(),
      },
    });

    await writeAudit(prisma, {
      actorId:    req.userId!,
      targetId:   userId,
      targetType: "wallet",
      action:     `wallet.${type}_requested`,
      payload:    { amount, description, reason, approvalId: approval.id },
    });

    res.status(202).json({ executed: false, approval, message: "Large adjustment queued for second-admin approval" });
  } catch (err) {
    next(err);
  }
});

export default router;
