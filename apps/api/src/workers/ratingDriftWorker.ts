/**
 * Rating Drift Worker
 *
 * Applies a 0.5% per-month passive pull toward 1000 for every SportSkillRating row.
 * This prevents permanent inflation in small closed communities.
 *
 * It is NOT a penalty for inactivity — it applies to everyone equally.
 * The confidence tier label is never affected.
 *
 * Run on a monthly schedule via a cron job or BullMQ repeatable job.
 * History entries created here are distinguishable from match-driven entries
 * by activityId = null AND delta being a small negative or positive value
 * consistent with drift magnitude.
 */

import prisma from "../lib/prisma";

const DRIFT_RATE     = 0.005;  // 0.5% pull toward 1000 per run
const DRIFT_BATCH    = 500;    // process N rows at a time to avoid memory spikes
const TARGET_RATING  = 1000;

export async function runRatingDrift(): Promise<{ processed: number; skipped: number }> {
  let cursor: number | undefined = undefined;
  let processed = 0;
  let skipped   = 0;

  type DriftRow = { id: number; userId: number; sportId: number; formatName: string; rating: number };

  while (true) {
    const rows = await prisma.sportSkillRating.findMany({
      take: DRIFT_BATCH,
      ...(cursor !== undefined ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: { id: true, userId: true, sportId: true, formatName: true, rating: true },
    });
    const batch = rows as DriftRow[];

    if (batch.length === 0) break;
    cursor = batch[batch.length - 1].id;

    for (const row of batch) {
      const newRating = Math.round(row.rating + (TARGET_RATING - row.rating) * DRIFT_RATE);
      const delta     = newRating - row.rating;

      // Skip if drift rounds to zero (rating is already at or very close to 1000)
      if (delta === 0) { skipped++; continue; }

      await prisma.sportSkillRating.update({
        where: { id: row.id },
        data:  { rating: newRating },
      });

      await prisma.ratingHistory.create({
        data: {
          userId:     row.userId,
          sportId:    row.sportId,
          formatName: row.formatName,
          oldRating:  row.rating,
          newRating,
          delta,
          activityId: null,  // null marks drift entries — no associated match
        },
      });

      processed++;
    }
  }

  return { processed, skipped };
}
