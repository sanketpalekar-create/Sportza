/**
 * Open Play Lifecycle Service
 *
 * Single authoritative module for all state transitions on an open play:
 *   1. joinOpenPlay        — add player, mark full when maxPlayers reached
 *   2. checkViabilityThreshold — confirm session if minimumPlayers >= paid
 *   3. lockAndSettle       — lock final player count and compute equal split
 *   4. handleOpenPlayConflict  — conflict cancel → 100% refund to all paid players
 *   5. handleCreatorCancel     — creator cancel → 5% fee + wallet credit / gateway refund
 *   6. handleDeadlineMiss      — auto-cancel when deadline passes with < minimumPlayers
 *
 * Confirmation rules:
 *  - Old count-based threshold is replaced by minimumPlayers viability.
 *  - Session is marked "confirmed" once paid player count >= minimumPlayers.
 *  - Host protection payment counts as the first paid share.
 */

import prisma from "../lib/prisma";
import { addRefundJob } from "../lib/queue";
import { creditWallet } from "./wallet";
import { roundMoney } from "./slotPricing";
import { createNotification, createBulkNotifications, NotifType } from "./notificationService";

const CREATOR_CANCEL_FEE = 0.05;

// ─── Join ─────────────────────────────────────────────────────────────────────

export async function joinOpenPlay(openPlayId: number, userId: number) {
  const openPlay = await prisma.openPlay.findUnique({
    where: { id: openPlayId },
    include: { players: true },
  });

  if (!openPlay) throw new Error("Open play not found");
  if (openPlay.status !== "open") throw new Error("Open play is not accepting players");
  if (openPlay.players.length >= openPlay.maxPlayers) throw new Error("Open play is full");

  const alreadyJoined = openPlay.players.some((p) => p.userId === userId);
  if (alreadyJoined) throw new Error("Already joined this open play");

  const player = await prisma.openPlayPlayer.create({
    data: { openPlayId, userId },
  });

  if (openPlay.players.length + 1 >= openPlay.maxPlayers) {
    await prisma.openPlay.update({
      where: { id: openPlayId },
      data: { status: "full" },
    });
  }

  return player;
}

// ─── Viability check (replaces count-based threshold) ────────────────────────

/**
 * Called after any payment is captured for an open play.
 * Session becomes "confirmed" once >= minimumPlayers paid shares exist
 * (host protection payment + player shares together count).
 */
export async function checkViabilityThreshold(openPlayId: number) {
  const openPlay = await (prisma as any).openPlay.findUnique({
    where: { id: openPlayId },
    include: { players: true },
  });
  if (!openPlay || !openPlay.bookingId) return null;

  const paidCount = await prisma.splitPayment.count({
    where: { bookingId: openPlay.bookingId, status: "paid" },
  });

  const minimumPlayers: number = openPlay.minimumPlayers ?? 2;
  const isViable = paidCount >= minimumPlayers;

  if (isViable && openPlay.status !== "confirmed" && openPlay.status !== "completed") {
    await prisma.booking.update({
      where: { id: openPlay.bookingId },
      data: { status: "confirmed" },
    });
    await (prisma as any).openPlay.update({
      where: { id: openPlayId },
      data: { status: openPlay.status === "full" ? "full" : "confirmed" },
    });

    // Notify all players that the session is now confirmed (non-blocking)
    const joined = await prisma.openPlayPlayer.findMany({
      where: { openPlayId },
      select: { userId: true },
    });
    const playerIds = joined.map((p) => p.userId);
    if (playerIds.length > 0) {
      void createBulkNotifications(
        playerIds,
        NotifType.OPEN_PLAY_CONFIRMED,
        "Session confirmed!",
        `Your open play session has reached minimum players and is confirmed. See you on the court!`,
        { openPlayId }
      );
    }
  }

  return { paidCount, minimumPlayers, isViable };
}

// Backward-compatible alias used by payments.ts
export { checkViabilityThreshold as checkConfirmationThreshold };

// ─── Lock and settle ──────────────────────────────────────────────────────────

/**
 * Lock the final player count and re-compute equal splits.
 * Creates wallet credit or additional charge records as needed.
 * Should be called at joinDeadlineAt or when host manually closes the session.
 */
export async function lockAndSettle(openPlayId: number) {
  const openPlay = await (prisma as any).openPlay.findUnique({
    where: { id: openPlayId },
    include: { players: true },
  });
  if (!openPlay || !openPlay.bookingId) throw new Error("Open play not found");

  const totalPlayers = openPlay.players.length;
  if (totalPlayers < (openPlay.minimumPlayers ?? 2)) {
    throw new Error("Not enough players to settle");
  }

  const booking = await prisma.booking.findUnique({ where: { id: openPlay.bookingId } });
  if (!booking) throw new Error("Booking not found");

  const finalSharePerPlayer = roundMoney(booking.totalAmount / totalPlayers);

  await (prisma as any).openPlay.update({
    where: { id: openPlayId },
    data: {
      finalPlayerCount: totalPlayers,
      finalPricePerPlayer: finalSharePerPlayer,
      pricingLockedAt: new Date(),
      status: "confirmed",
    },
  });

  // Reconcile host: host paid hostProtectionAmount (50% of total).
  // If hostProtectionAmount > finalSharePerPlayer, credit the difference.
  const hostProtectionAmount: number = openPlay.hostProtectionAmount ?? 0;
  if (hostProtectionAmount > finalSharePerPlayer) {
    const overpayment = roundMoney(hostProtectionAmount - finalSharePerPlayer);
    await creditWallet(
      openPlay.createdById,
      overpayment,
      `Open play host credit — ${overpayment > 0 ? "overpayment adjustment" : "share"}`,
      "open_play",
      openPlayId
    );

    // Notify host of wallet credit (non-blocking)
    void createNotification(
      openPlay.createdById,
      NotifType.WALLET_CREDITED,
      "Wallet credited",
      `₹${overpayment.toFixed(2)} has been credited to your Sportza Wallet — open play session settlement.`,
      { openPlayId, amount: overpayment }
    );
  }

  return { finalPlayerCount: totalPlayers, finalPricePerPlayer: finalSharePerPlayer };
}

// ─── Conflict cancel ──────────────────────────────────────────────────────────

export async function handleOpenPlayConflict(openPlayId: number) {
  const openPlay = await prisma.openPlay.findUnique({
    where: { id: openPlayId },
    include: { players: true },
  });
  if (!openPlay || !openPlay.bookingId) return;

  const paidSplits = await prisma.splitPayment.findMany({
    where: { bookingId: openPlay.bookingId, status: "paid" },
  });
  const booking = await prisma.booking.findUnique({
    where: { id: openPlay.bookingId },
    select: { userId: true },
  });
  const fallbackUserId = booking?.userId ?? openPlay.createdById;

  for (const sp of paidSplits) {
    const refundUserId = sp.userId ?? fallbackUserId;
    if (sp.razorpayPaymentId && sp.amount > 0) {
      await prisma.refund.create({
        data: {
          bookingId: openPlay.bookingId,
          userId: refundUserId,
          amountPaid: sp.amount,
          amountRefunded: sp.amount,
          platformFee: 0,
          reason: "system",
          razorpayPaymentId: sp.razorpayPaymentId,
          status: "pending",
        },
      });

      await addRefundJob({
        bookingId: openPlay.bookingId,
        userId: refundUserId,
        amount: sp.amount,
        razorpayPaymentId: sp.razorpayPaymentId,
        reason: "system",
      });
    }
  }

  await prisma.openPlay.update({
    where: { id: openPlayId },
    data: { status: "cancelled" },
  });

  await prisma.booking.update({
    where: { id: openPlay.bookingId },
    data: { status: "cancelled_conflict" },
  });
}

// ─── Creator cancel ───────────────────────────────────────────────────────────

/**
 * Creator cancellation:
 *  - Host protection payment: credited back to wallet with no deduction (no-refund policy).
 *  - Other paid players: 100% gateway refund (no deduction, conflict-style).
 */
export async function handleCreatorCancel(openPlayId: number, creatorId: number) {
  const openPlay = await (prisma as any).openPlay.findUnique({
    where: { id: openPlayId },
    include: { players: true },
  });
  if (!openPlay || !openPlay.bookingId) throw new Error("Open play not found");
  if (openPlay.createdById !== creatorId) throw new Error("Only the creator can cancel");

  const paidSplits = await prisma.splitPayment.findMany({
    where: { bookingId: openPlay.bookingId, status: "paid" },
  });

  for (const sp of paidSplits) {
    const isHostProtection = (sp as any).splitType === "host_protection";

    if (isHostProtection) {
      // Host protection → wallet credit (no gateway refund)
      if (sp.amount > 0) {
        await creditWallet(
          creatorId,
          sp.amount,
          "Host protection credit — session cancelled",
          "open_play",
          openPlayId
        );
        await prisma.splitPayment.update({
          where: { id: sp.id },
          data: { status: "wallet_credited" },
        });

        // Notify host their protection amount is back in wallet (non-blocking)
        void createNotification(
          creatorId,
          NotifType.WALLET_CREDITED,
          "Host protection refunded to wallet",
          `₹${sp.amount.toFixed(2)} (host protection) has been credited back to your Sportza Wallet since you cancelled the session.`,
          { openPlayId, amount: sp.amount }
        );
      }
    } else {
      // Player shares → 100% gateway refund
      if (!sp.razorpayPaymentId || sp.amount <= 0) continue;

      const refundUserId = sp.userId ?? creatorId;
      await prisma.refund.create({
        data: {
          bookingId: openPlay.bookingId,
          userId: refundUserId,
          amountPaid: sp.amount,
          amountRefunded: sp.amount,
          platformFee: 0,
          reason: "user_cancelled",
          razorpayPaymentId: sp.razorpayPaymentId,
          status: "pending",
        },
      });

      await addRefundJob({
        bookingId: openPlay.bookingId,
        userId: refundUserId,
        amount: sp.amount,
        razorpayPaymentId: sp.razorpayPaymentId,
        reason: "user_cancelled",
      });
    }
  }

  await (prisma as any).openPlay.update({
    where: { id: openPlayId },
    data: { status: "cancelled" },
  });

  await prisma.booking.update({
    where: { id: openPlay.bookingId },
    data: { status: "cancelled_user" },
  });

  return { success: true };
}

// ─── Deadline miss (auto-cancel) ──────────────────────────────────────────────

/**
 * Called by the deadline worker when joinDeadlineAt has passed
 * and paid player count is still < minimumPlayers.
 *
 * Policy:
 *  - Host protection amount → wallet credit (full, no deduction).
 *  - All other paid players → wallet credit (no gateway refund policy).
 */
export async function handleDeadlineMiss(openPlayId: number) {
  const openPlay = await (prisma as any).openPlay.findUnique({
    where: { id: openPlayId },
    include: { players: true },
  });
  if (!openPlay || !openPlay.bookingId) return;
  if (openPlay.status === "cancelled" || openPlay.status === "completed") return;

  const paidSplits = await prisma.splitPayment.findMany({
    where: { bookingId: openPlay.bookingId, status: "paid" },
  });

  for (const sp of paidSplits) {
    if (sp.amount <= 0 || !sp.userId) continue;

    const label = (sp as any).splitType === "host_protection"
      ? "Host protection refund — session did not reach minimum players"
      : "Wallet credit — session cancelled due to insufficient players";

    await creditWallet(sp.userId, sp.amount, label, "open_play", openPlayId);

    await prisma.splitPayment.update({
      where: { id: sp.id },
      data: { status: "wallet_credited" },
    });
  }

  await (prisma as any).openPlay.update({
    where: { id: openPlayId },
    data: {
      status: "cancelled",
      hostProtectionStatus: "credited",
    },
  });

  await prisma.booking.update({
    where: { id: openPlay.bookingId },
    data: { status: "cancelled" },
  });

  // Notify all players about the deadline miss and wallet credits (non-blocking)
  const playerIds = openPlay.players.map((p: { userId: number }) => p.userId);
  if (playerIds.length > 0) {
    void createBulkNotifications(
      playerIds,
      NotifType.OPEN_PLAY_DEADLINE_MISSED,
      "Session cancelled — not enough players",
      `The open play session did not reach the minimum player count. Your payment has been credited to your Sportza wallet.`,
      { openPlayId }
    );
  }
}

// ─── Status helpers ───────────────────────────────────────────────────────────

export async function leaveOpenPlay(openPlayId: number, userId: number) {
  const openPlay = await prisma.openPlay.findUnique({
    where: { id: openPlayId },
    include: { players: true },
  });

  if (!openPlay) throw new Error("Open play not found");

  const playerRecord = openPlay.players.find((p) => p.userId === userId);
  if (!playerRecord) throw new Error("Not a member of this open play");

  if (openPlay.createdById === userId) {
    throw new Error("Creator cannot leave the open play");
  }

  await prisma.openPlayPlayer.delete({ where: { id: playerRecord.id } });

  if (openPlay.status === "full") {
    await prisma.openPlay.update({
      where: { id: openPlayId },
      data: { status: "open" },
    });
  }

  return { success: true };
}

export async function getOpenPlayStatus(openPlayId: number) {
  const openPlay = await (prisma as any).openPlay.findUnique({
    where: { id: openPlayId },
    include: {
      players: {
        include: {
          user: { select: { id: true, name: true, avatar: true } },
        },
      },
      booking: { select: { bookingDate: true, startTime: true, endTime: true } },
      venue: { select: { id: true, name: true } },
    },
  });

  if (!openPlay) return null;

  return {
    ...openPlay,
    spotsRemaining: openPlay.maxPlayers - openPlay.players.length,
    isFull: openPlay.players.length >= openPlay.maxPlayers,
    isViable: openPlay.players.length >= (openPlay.minimumPlayers ?? 2),
  };
}
