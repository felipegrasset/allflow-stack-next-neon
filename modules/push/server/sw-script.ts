/**
 * The service worker source, served by GET /api/push/sw (server/sw/route.ts)
 * because a module cannot put files in public/. Registered by
 * ui/push-toggle.tsx with scope SW_SCOPE. Plain ES2017, no imports.
 *
 * - push: shows the notification from the JSON payload (title, body, url, tag).
 * - notificationclick: focuses a same-origin tab already on that URL, or opens one.
 *   Only same-origin URLs are opened.
 * - pushsubscriptionchange: subscribes again with the same key and posts the
 *   new subscription to /api/push/subscribe (the old endpoint will answer 410
 *   on the next send and be deleted).
 */
export const SW_PATH = "/api/push/sw"
export const SW_SCOPE = "/api/push/"
export const SUBSCRIBE_PATH = "/api/push/subscribe"

export const SERVICE_WORKER_SOURCE = `// Fulvia push service worker (module push). Generated; do not edit.
"use strict";
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (event) { event.waitUntil(self.clients.claim()); });

self.addEventListener("push", function (event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  var title = typeof data.title === "string" && data.title ? data.title : self.location.hostname;
  var options = {
    body: typeof data.body === "string" ? data.body : "",
    tag: typeof data.tag === "string" ? data.tag : undefined,
    data: { url: typeof data.url === "string" ? data.url : "/" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var raw = (event.notification.data && event.notification.data.url) || "/";
  var target;
  try { target = new URL(raw, self.location.origin); } catch (e) { target = new URL("/", self.location.origin); }
  if (target.origin !== self.location.origin) target = new URL("/", self.location.origin);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url === target.href && "focus" in list[i]) return list[i].focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target.href);
    })
  );
});

self.addEventListener("pushsubscriptionchange", function (event) {
  var old = event.oldSubscription;
  var key = old && old.options ? old.options.applicationServerKey : null;
  if (!key) return;
  event.waitUntil(
    self.registration.pushManager
      .subscribe({ userVisibleOnly: true, applicationServerKey: key })
      .then(function (sub) {
        return fetch("${SUBSCRIBE_PATH}", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(sub.toJSON())
        });
      })
      .catch(function () {})
  );
});
`
