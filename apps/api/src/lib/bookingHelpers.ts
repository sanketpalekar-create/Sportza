/**
 * Pure helper functions for booking calculations.
 * Kept separate from routes so they can be unit-tested without Express/Prisma setup.
 */

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function hoursBetween(start: string, end: string): number {
  return (parseTimeToMinutes(end) - parseTimeToMinutes(start)) / 60;
}

/**
 * Calculate a single participant's share for a split booking.
 * The last participant absorbs any rounding remainder so the total is exact.
 */
export function calculateSplitShare(total: number, splitCount: number, index: number): number {
  const base = Math.floor((total * 100) / splitCount) / 100;
  if (index === splitCount - 1) {
    const allocated = Math.round(base * (splitCount - 1) * 100) / 100;
    return Math.round((total - allocated) * 100) / 100;
  }
  return base;
}

/** 50% paid threshold for split / open_play confirmation. */
export function splitPaymentProgressMeta(totalAmount: number, paidAmount: number) {
  const ta = totalAmount > 0 ? totalAmount : 0;
  const pa = Math.max(0, paidAmount ?? 0);
  const pendingAmount = Math.round(Math.max(ta - pa, 0) * 100) / 100;
  const confirmThresholdAmount = Math.round(ta * 0.5 * 100) / 100;
  const amountNeededForConfirm = Math.round(Math.max(confirmThresholdAmount - pa, 0) * 100) / 100;
  const thresholdMet = ta <= 0 || pa + 1e-6 >= confirmThresholdAmount;
  const paidPercentOfTotal = ta > 0 ? Math.min(100, Math.round((pa / ta) * 1000) / 10) : 0;
  return {
    pendingAmount,
    confirmThresholdAmount,
    amountNeededForConfirm,
    thresholdMet,
    paidPercentOfTotal,
  };
}

export type SplitRow = {
  userId: number;
  amount: number;
  status: string;
  user?: { name: string | null; avatar: string | null } | null;
};

export function buildSplitDetailsPayload(
  booking: { totalAmount: number; paidAmount: number; splitCount?: number | null; bookingType: string },
  splits: SplitRow[]
) {
  const progress = splitPaymentProgressMeta(booking.totalAmount, booking.paidAmount);
  return {
    bookingType: booking.bookingType,
    splitCount: booking.splitCount,
    perPersonAmount: splits[0]?.amount ?? 0,
    joinedCount: splits.length,
    paidCount: splits.filter((s) => s.status === "paid").length,
    pendingCount: splits.filter((s) => s.status === "pending").length,
    ...progress,
    participants: splits.map((s) => ({
      userId: s.userId,
      name: s.user?.name ?? null,
      avatar: s.user?.avatar ?? null,
      amount: s.amount,
      status: s.status,
    })),
  };
}
