/**
 * Sportza Wallet Service
 *
 * Provides atomic credit/debit operations on a per-user stored-value wallet.
 * Every operation writes an immutable WalletTransaction ledger entry and
 * updates the cached `balance` on WalletAccount in the same DB transaction.
 *
 * Usage:
 *   const account = await getOrCreateWallet(userId);
 *   await creditWallet(userId, 500, "Host protection refund", "open_play", openPlayId);
 *   await debitWallet(userId, 200, "Wallet payment for session", "booking", bookingId);
 */

import prisma from "../lib/prisma";

export interface WalletTxResult {
  walletId: number;
  transactionId: number;
  balance: number;
  amount: number;
  type: "credit" | "debit";
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function ensureWallet(userId: number, tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) {
  const db = tx ?? prisma;
  const existing = await (db as any).walletAccount.findUnique({ where: { userId } });
  if (existing) return existing;
  return (db as any).walletAccount.create({ data: { userId, balance: 0 } });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch (or lazily create) the wallet for a user.
 */
export async function getOrCreateWallet(userId: number) {
  return ensureWallet(userId);
}

/**
 * Add funds to the user's wallet and record a ledger entry.
 */
export async function creditWallet(
  userId: number,
  amount: number,
  description: string,
  referenceType?: string,
  referenceId?: number
): Promise<WalletTxResult> {
  if (amount <= 0) throw new Error("Credit amount must be positive");

  return prisma.$transaction(async (tx) => {
    const wallet = await ensureWallet(userId, tx);
    const newBalance = parseFloat((wallet.balance + amount).toFixed(2));

    const [updatedWallet, txRecord] = await Promise.all([
      (tx as any).walletAccount.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      }),
      (tx as any).walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId,
          type: "credit",
          amount,
          description,
          referenceType: referenceType ?? null,
          referenceId: referenceId ?? null,
          balanceAfter: newBalance,
        },
      }),
    ]);

    return {
      walletId: wallet.id,
      transactionId: txRecord.id,
      balance: updatedWallet.balance,
      amount,
      type: "credit" as const,
    };
  });
}

/**
 * Deduct funds from the user's wallet and record a ledger entry.
 * Throws if insufficient balance.
 */
export async function debitWallet(
  userId: number,
  amount: number,
  description: string,
  referenceType?: string,
  referenceId?: number
): Promise<WalletTxResult> {
  if (amount <= 0) throw new Error("Debit amount must be positive");

  return prisma.$transaction(async (tx) => {
    const wallet = await ensureWallet(userId, tx);
    if (wallet.balance < amount) {
      throw new Error(`Insufficient wallet balance. Available: ₹${wallet.balance.toFixed(2)}, required: ₹${amount.toFixed(2)}`);
    }

    const newBalance = parseFloat((wallet.balance - amount).toFixed(2));

    const [updatedWallet, txRecord] = await Promise.all([
      (tx as any).walletAccount.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      }),
      (tx as any).walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId,
          type: "debit",
          amount,
          description,
          referenceType: referenceType ?? null,
          referenceId: referenceId ?? null,
          balanceAfter: newBalance,
        },
      }),
    ]);

    return {
      walletId: wallet.id,
      transactionId: txRecord.id,
      balance: updatedWallet.balance,
      amount,
      type: "debit" as const,
    };
  });
}

/**
 * Get wallet balance. Returns 0 if wallet does not exist yet.
 */
export async function getWalletBalance(userId: number): Promise<number> {
  const wallet = await (prisma as any).walletAccount.findUnique({ where: { userId } });
  return wallet?.balance ?? 0;
}

/**
 * Get paginated wallet transaction history for a user.
 */
export async function getWalletTransactions(
  userId: number,
  page = 1,
  limit = 20
): Promise<{ items: any[]; total: number; balance: number }> {
  const wallet = await (prisma as any).walletAccount.findUnique({ where: { userId } });
  if (!wallet) return { items: [], total: 0, balance: 0 };

  const [items, total] = await Promise.all([
    (prisma as any).walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    (prisma as any).walletTransaction.count({ where: { walletId: wallet.id } }),
  ]);

  return { items, total, balance: wallet.balance };
}
