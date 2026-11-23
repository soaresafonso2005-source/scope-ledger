// Scope Ledger service worker: only handles the Android share sheet. Nothing is cached for offline use,
// so every visit always loads the latest version of the site.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST" || url.pathname !== "/share-target") return;
  event.respondWith((async () => {
    try {
      const form = await event.request.formData();
      const cache = await caches.open("sl-share");
      const file = form.get("file");
      const text = ["title", "text", "url"].map((k) => form.get(k)).filter((v) => typeof v === "string" && v).join("\n");
      if (file && typeof file !== "string") {
        await cache.put("/shared-file", new Response(file, { headers: { "x-name": encodeURIComponent(file.name || "shared.txt") } }));
      } else {
        await cache.delete("/shared-file");
      }
      await cache.put("/shared-text", new Response(text));
      return Response.redirect("/app.html?shared=1", 303);
    } catch (e) {
      return Response.redirect("/app.html?shared=missing", 303);
    }
  })());
});
