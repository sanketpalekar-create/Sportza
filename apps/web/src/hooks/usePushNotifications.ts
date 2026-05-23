import { useEffect, useRef } from "react";
import { apiClient } from "@sportza/api-client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

/** Convert a URL-safe base64 string to a Uint8Array for use as applicationServerKey. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registers the service worker, requests Notification permission, subscribes
 * to the Push API, and sends the subscription to the backend.
 *
 * Call this hook once inside a component that only renders when the user is
 * authenticated (e.g. the authenticated app shell).
 */
export function usePushNotifications() {
  const attempted = useRef(false);

  useEffect(() => {
    // Guard: run once, require browser support, and require a VAPID key
    if (attempted.current) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (!VAPID_PUBLIC_KEY) {
      console.warn("[push] VITE_VAPID_PUBLIC_KEY not set — Web Push disabled");
      return;
    }

    attempted.current = true;

    (async () => {
      try {
        // 1. Register the service worker
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        // 2. Wait for the SW to be ready (handles pending installs)
        await navigator.serviceWorker.ready;

        // 3. Check / request Notification permission
        let permission = Notification.permission;
        if (permission === "default") {
          permission = await Notification.requestPermission();
        }
        if (permission !== "granted") {
          console.info("[push] Notification permission not granted:", permission);
          return;
        }

        // 4. Check if already subscribed
        let subscription = await registration.pushManager.getSubscription();

        // 5. If not subscribed, subscribe now
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });
        }

        // 6. Send subscription to the backend (upsert — idempotent)
        const sub = subscription.toJSON();
        await apiClient.post("/push-subscriptions", {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys?.p256dh,
            auth:   sub.keys?.auth,
          },
        });

        console.info("[push] Subscription registered successfully");
      } catch (err) {
        // Swallow — push failure must never break the app
        console.warn("[push] Setup failed:", err);
      }
    })();
  }, []);
}
