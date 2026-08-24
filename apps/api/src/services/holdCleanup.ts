import prisma from "../lib/prisma";

/**
 * Expire booking holds past their TTL.
 * Used by BullMQ (local) and Vercel Cron (`/api/cron/hold-cleanup`).
 */
export async function expireBookingHolds(): Promise<number> {
  const now = new Date();
  const result = await prisma.bookingHold.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  if (result.count > 0) {
    console.log(`[hold-cleanup] Expired ${result.count} hold(s)`);
  }
  return result.count;
}
