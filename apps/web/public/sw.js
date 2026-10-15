// Tolmol service worker: keeps the app shell available offline. It never caches Arkiv RPC responses
// (other origins are not touched), so evidence is always read live from Arkiv when online.
const CACHE = "tolmol-shell-v3"
const SCOPE = new URL(self.registration.scope).pathname
// Only the app's own start page is the offline shell; other pages (e.g. mirror.html) are cached under their own URL.
const isShell = (url) => url.pathname === SCOPE || url.pathname === `${SCOPE}index.html`
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./", "./manifest.webmanifest", "./icon.svg"])).then(() => self.skipWaiting()))
})
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
const networkFirst = (req, key) =>
  fetch(req)
    .then((r) => {
      if (r.ok) {
        const copy = r.clone()
        caches.open(CACHE).then((c) => c.put(key, copy))
      }
      return r
    })
    .catch(() => caches.match(key))
self.addEventListener("fetch", (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== "GET" || url.origin !== self.location.origin) return
  if (req.mode === "navigate") {
    // Network first for pages, so new deploys show up; the cached copy when offline.
    e.respondWith(networkFirst(req, isShell(url) ? "./" : req))
    return
  }
  if (url.pathname.startsWith(`${SCOPE}assets/`)) {
    // Hashed build assets never change: cache first.
    e.respondWith(caches.match(req).then((hit) => hit || networkFirst(req, req)))
    return
  }
  // Everything else (test-cards.json, images, icons) can change between deploys: network first.
  e.respondWith(networkFirst(req, req))
})
