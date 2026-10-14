// Tolmol service worker: keeps the app shell available offline. It never caches Arkiv RPC responses
// (other origins are not touched), so evidence is always read live from Arkiv when online.
const CACHE = "tolmol-shell-v1"
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./", "./manifest.webmanifest", "./icon.svg"])).then(() => self.skipWaiting()))
})
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener("fetch", (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== "GET" || url.origin !== self.location.origin) return
  if (req.mode === "navigate") {
    // Network first for the page, so new deploys show up; cached shell when offline.
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put("./", copy)); return r }).catch(() => caches.match("./")))
    return
  }
  // Hashed build assets never change: cache first.
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) } return r })))
})
