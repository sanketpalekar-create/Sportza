import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { sendWebPushToUser, sendWebPushToUsers } from "./webPushService";

// ─── Notification type constants ─────────────────────────────────────────────

export const NotifType = {
  // ── Training / Batch ──────────────────────────────────────────
  BATCH_ANNOUNCEMENT:    "BATCH_ANNOUNCEMENT",
  BATCH_NEW_MEMBER:      "BATCH_NEW_MEMBER",
  BATCH_MEMBER_APPROVED: "BATCH_MEMBER_APPROVED",
  BATCH_MEMBER_REJECTED: "BATCH_MEMBER_REJECTED",
  BATCH_MEMBER_ADDED:    "BATCH_MEMBER_ADDED",
  PAYMENT_RECORDED:      "PAYMENT_RECORDED",
  PAYMENT_REMINDER:      "PAYMENT_REMINDER",

  // ── Peer invites ──────────────────────────────────────────────
  PEER_INVITE_RECEIVED: "PEER_INVITE_RECEIVED",
  PEER_INVITE_ACCEPTED: "PEER_INVITE_ACCEPTED",
  PEER_INVITE_DECLINED: "PEER_INVITE_DECLINED",
  PEER_INVITE_CANCELLED:"PEER_INVITE_CANCELLED",

  // ── Peer relationships ────────────────────────────────────────
  PEER_REQUEST_RECEIVED: "PEER_REQUEST_RECEIVED",
  PEER_REQUEST_ACCEPTED: "PEER_REQUEST_ACCEPTED",
  PEER_REQUEST_DECLINED: "PEER_REQUEST_DECLINED",

  // ── Bookings ──────────────────────────────────────────────────
  BOOKING_CONFIRMED:       "BOOKING_CONFIRMED",
  BOOKING_CANCELLED:       "BOOKING_CANCELLED",
  BOOKING_CANCELLED_OWNER: "BOOKING_CANCELLED_OWNER",

  // ── Refunds ───────────────────────────────────────────────────
  REFUND_INITIATED: "REFUND_INITIATED",
  REFUND_COMPLETED: "REFUND_COMPLETED",
  REFUND_FAILED:    "REFUND_FAILED",

  // ── Open play ─────────────────────────────────────────────────
  OPEN_PLAY_PLAYER_JOINED:   "OPEN_PLAY_PLAYER_JOINED",
  OPEN_PLAY_CONFIRMED:       "OPEN_PLAY_CONFIRMED",
  OPEN_PLAY_CANCELLED:       "OPEN_PLAY_CANCELLED",
  OPEN_PLAY_DEADLINE_MISSED: "OPEN_PLAY_DEADLINE_MISSED",

  // ── Wallet ────────────────────────────────────────────────────
  WALLET_CREDITED: "WALLET_CREDITED",
  WALLET_DEBITED:  "WALLET_DEBITED",

  // ── Payments ──────────────────────────────────────────────────
  PAYMENT_CAPTURED: "PAYMENT_CAPTURED",
  PAYMENT_FAILED:   "PAYMENT_FAILED",

  // ── Split bookings ────────────────────────────────────────────
  SPLIT_PARTICIPANT_JOINED: "SPLIT_PARTICIPANT_JOINED",
  SPLIT_PARTICIPANT_LEFT:   "SPLIT_PARTICIPANT_LEFT",
  SPLIT_FULLY_FUNDED:       "SPLIT_FULLY_FUNDED",
  SPLIT_REMINDER:           "SPLIT_REMINDER",

  // ── Matches ───────────────────────────────────────────────────
  MATCH_SCHEDULED: "MATCH_SCHEDULED",
  MATCH_LIVE:      "MATCH_LIVE",
  MATCH_COMPLETED: "MATCH_COMPLETED",
  RATING_CHANGED:  "RATING_CHANGED",

  // ── Tournaments ───────────────────────────────────────────────
  TOURNAMENT_ANNOUNCEMENT:  "TOURNAMENT_ANNOUNCEMENT",
  TOURNAMENT_STARTED:       "TOURNAMENT_STARTED",
  TOURNAMENT_COMPLETED:     "TOURNAMENT_COMPLETED",
  TOURNAMENT_PLAYER_ADDED:  "TOURNAMENT_PLAYER_ADDED",
  TOURNAMENT_STAGE_ADVANCED:"TOURNAMENT_STAGE_ADVANCED",

  // ── Batch / Training (remaining) ──────────────────────────────
  BATCH_SESSION_SCHEDULED: "BATCH_SESSION_SCHEDULED",
  BATCH_REVIEW_POSTED:     "BATCH_REVIEW_POSTED",
  BATCH_REVIEW_RECEIVED:   "BATCH_REVIEW_RECEIVED",
  BATCH_DEACTIVATED:       "BATCH_DEACTIVATED",
  BATCH_MEMBER_LEFT:       "BATCH_MEMBER_LEFT",

  // ── Open play (remaining) ─────────────────────────────────────
  OPEN_PLAY_SESSION_FULL:   "OPEN_PLAY_SESSION_FULL",
  OPEN_PLAY_SETTLED:        "OPEN_PLAY_SETTLED",
  OPEN_PLAY_PLAYER_REMOVED: "OPEN_PLAY_PLAYER_REMOVED",

  // ── Peer relationships (remaining) ────────────────────────────
  PEER_REMOVED: "PEER_REMOVED",

  // ── Account / Security ────────────────────────────────────────
  PASSWORD_CHANGED:           "PASSWORD_CHANGED",
  ROLE_SWITCHED:              "ROLE_SWITCHED",
  ROLE_APPLICATION_QUEUED:    "ROLE_APPLICATION_QUEUED",
  ROLE_APPLICATION_RECEIVED:  "ROLE_APPLICATION_RECEIVED",
} as const;

export type NotifTypeValue = (typeof NotifType)[keyof typeof NotifType];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Create a single in-app notification for one user.
 * Errors are swallowed so notification failures never break the primary action.
 */
export async function createNotification(
  userId: number,
  type: NotifTypeValue,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    const jsonData =
      data === undefined
        ? undefined
        : (data as unknown as Prisma.InputJsonValue);
    await prisma.notification.create({
      data: { userId, type, title, body, data: jsonData },
    });
  } catch (err) {
    console.error("[notifService] createNotification failed:", err);
  }
  // Fire Web Push in parallel — errors are swallowed inside the helper
  void sendWebPushToUser(userId, title, body, data);
}

/**
 * Create in-app notifications for many users at once (createMany).
 * Skips if userIds is empty. Errors are swallowed.
 */
export async function createBulkNotifications(
  userIds: number[],
  type: NotifTypeValue,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (!userIds.length) return;
  try {
    const jsonData =
      data === undefined
        ? undefined
        : (data as unknown as Prisma.InputJsonValue);
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type,
        title,
        body,
        data: jsonData,
      })),
      skipDuplicates: true,
    });
  } catch (err) {
    console.error("[notifService] createBulkNotifications failed:", err);
  }
  // Fire Web Push for each recipient in parallel — errors swallowed inside
  void sendWebPushToUsers(userIds, title, body, data);
}
