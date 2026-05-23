import webPush from "web-push";
import prisma from "../lib/prisma";

// Initialise VAPID once at module load. If keys are missing the module still
// loads but sendWebPushToUser will log a warning and bail out gracefully.
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webPush.setVapidDetails(
    "mailto:support@sportza.in",
    VAPID_PUBLIC,
    VAPID_PRIVATE
  );
} else {
  console.warn("[webPush] VAPID keys not set — Web Push will be skipped");
}

/**
 * Deliver a Web Push notification to every active subscription for `userId`.
 * Stale subscriptions (HTTP 410 / 404 from the push service) are deleted
 * automatically. All errors are swallowed so callers are never blocked.
 */
export async function sendWebPushToUser(
  userId: number,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;

  let subs: Array<{ id: number; endpoint: string; p256dh: string; auth: string }>;
  try {
    subs = await (prisma as any).pushSubscription.findMany({
      where: { userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
  } catch (err) {
    console.error("[webPush] Failed to fetch subscriptions:", err);
    return;
  }

  if (!subs.length) return;

  const payload = JSON.stringify({ title, body, data: data ?? {} });

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          { TTL: 86400 }   // 24 h — keep the push queued if device is offline
        );
      } catch (err: any) {
        // 410 Gone / 404 Not Found → subscription is expired; remove it
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          try {
            await (prisma as any).pushSubscription.delete({ where: { id: sub.id } });
          } catch {
            // ignore cleanup failure
          }
        } else {
          console.error(`[webPush] Send failed for sub ${sub.id}:`, err?.message ?? err);
        }
      }
    })
  );
}

/**
 * Bulk variant: call sendWebPushToUser for each unique user ID.
 * Runs concurrently but individually so per-user failures are isolated.
 */
export async function sendWebPushToUsers(
  userIds: number[],
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (!userIds.length) return;
  await Promise.all(
    [...new Set(userIds)].map((uid) => sendWebPushToUser(uid, title, body, data))
  );
}
