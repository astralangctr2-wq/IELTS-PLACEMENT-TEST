// Service worker of the installed app: shows the admin's push
// notifications ("Ms Lan đã nộp 3 phiếu") and opens the right page when
// one is clicked. It does not cache anything: the app always loads live.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(d.title || "Astra", {
    body: d.body || "",
    icon: "/icons/astra-192.png",
    badge: "/icons/astra-192.png",
    data: { url: d.url || "/teacher" },
    tag: "astra-handin",
    renotify: true,
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/teacher", self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.location.origin) && "focus" in w) { await w.focus(); if ("navigate" in w) await w.navigate(url); return; }
    }
    await self.clients.openWindow(url);
  })());
});
