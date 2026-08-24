import prisma from "../lib/prisma";
import { handleDeadlineMiss } from "./openPlayConfirmations";

/**
 * Process open-play sessions past join deadline.
 * Used by BullMQ (local) and Vercel Cron (`/api/cron/open-play-deadline`).
 */
export async function runOpenPlayDeadlineCheck(): Promise<{
  checked: number;
  cancelled: number;
  confirmed: number;
}> {
  const now = new Date();

  const expired = await (prisma as any).openPlay.findMany({
    where: {
      joinDeadlineAt: { lt: now },
      status: { in: ["open", "full"] },
    },
    select: { id: true, minimumPlayers: true, bookingId: true },
  });

  let cancelled = 0;
  let confirmed = 0;

  if (expired.length === 0) {
    return { checked: 0, cancelled: 0, confirmed: 0 };
  }

  console.log(`[openplay-deadline] Checking ${expired.length} expired session(s)`);

  for (const op of expired) {
    try {
      const paidCount = await prisma.splitPayment.count({
        where: {
          bookingId: op.bookingId,
          status: "paid",
        },
      });

      const minimumPlayers = op.minimumPlayers ?? 2;

      if (paidCount < minimumPlayers) {
        console.log(
          `[openplay-deadline] Session ${op.id}: ${paidCount}/${minimumPlayers} paid — auto-cancelling`
        );
        await handleDeadlineMiss(op.id);
        cancelled += 1;
      } else {
        console.log(
          `[openplay-deadline] Session ${op.id}: minimum met (${paidCount}/${minimumPlayers}) — confirming`
        );
        await (prisma as any).openPlay.update({
          where: { id: op.id },
          data: { status: "confirmed" },
        });
        await prisma.booking.update({
          where: { id: op.bookingId },
          data: { status: "confirmed" },
        });
        confirmed += 1;
      }
    } catch (err) {
      console.error(`[openplay-deadline] Error processing session ${op.id}:`, err);
    }
  }

  return { checked: expired.length, cancelled, confirmed };
}
