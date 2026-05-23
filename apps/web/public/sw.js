/* Sportza Service Worker — Web Push handler */

const CACHE_NAME = "sportza-sw-v1";

// ─── Push event ───────────────────────────────────────────────────────────────
// Fired by the browser when the API sends a Web Push message, even when the
// app tab is closed.

self.addEventListener("push", (event) => {
  let payload = { title: "Sportza", body: "You have a new notification.", data: {} };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  const options = {
    body:    payload.body,
    icon:    "/logo.svg",
    badge:   "/logo.svg",
    data:    payload.data,
    tag:     payload.data?.type ?? "sportza-notif",   // collapse duplicate types
    renotify: false,
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// ─── Notification click ───────────────────────────────────────────────────────
// Opens / focuses the app and navigates to /notifications.

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = self.registration.scope + "notifications";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // If the app is already open in a tab, focus it and navigate
        for (const client of windowClients) {
          if (client.url.startsWith(self.registration.scope) && "focus" in client) {
            client.focus();
            return client.navigate(targetUrl);
          }
        }
        // Otherwise open a new tab
        return clients.openWindow(targetUrl);
      })
  );
});

// ─── Install & activate ───────────────────────────────────────────────────────
// Keep the SW lean — no caching logic here (Vite handles assets).

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});
