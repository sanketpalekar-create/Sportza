import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { jwtCheck, attachUser, requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { paginationSchema } from "../schemas/common";
import { getOrCreateWallet, getWalletBalance, getWalletTransactions } from "../services/wallet";

const router: Router = Router();

// GET /wallet — Balance + account summary
router.get(
  "/",
  jwtCheck,
  attachUser,
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const wallet = await getOrCreateWallet(userId);
      res.json({ success: true, data: { balance: wallet.balance, walletId: wallet.id } });
    } catch (err) {
      next(err);
    }
  }
);

// GET /wallet/transactions — Paginated ledger
router.get(
  "/transactions",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ query: paginationSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { page, limit } = req.query as unknown as z.infer<typeof paginationSchema>;
      const result = await getWalletTransactions(userId, page, limit);
      res.json({
        success: true,
        data: result.items,
        meta: {
          total: result.total,
          page,
          limit,
          balance: result.balance,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
