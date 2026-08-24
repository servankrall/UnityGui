/* UnityGUI mobile — service worker.
   Caches the app shell so the mobile game-maker is installable and its recent
   games (stored in localStorage) can be replayed offline. Generation itself
   needs the network. Cache-first for the shell; network passthrough for the
   free-AI API calls (never cached). */
const CACHE = "unitygui-mobile-v2";
const SHELL = [
  "play.html",
  "manifest.webmanifest",
  "js/mobile-templates.js",
  "assets/favicon.svg",
  "assets/logo.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => {}));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return; // never touch the AI POST calls
  const url = new URL(req.url);
  // Only handle same-origin app-shell requests; let everything else (the AI API) hit the network.
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        // cache successful shell responses opportunistically
        if (res && res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match("play.html"));
    })
  );
});
