/* Vida Vida service worker: keeps the app available offline.
   The app is one page (index.html, with the PDF engine inside) plus its icons.
   Strategy: answer from the cache at once, refresh the cache in the background,
   and tell the open page when a newer version has been stored. */
const CACHE = "vidavida-v1";
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-192.png", "./icon-maskable-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;   // links to other sites go straight to the network
  const isPage = req.mode === "navigate";
  e.respondWith(caches.open(CACHE).then(async cache => {
    const key = isPage ? "./index.html" : req;
    const cached = await cache.match(key, {ignoreSearch: true});
    const network = fetch(req).then(async res => {
      if (res && res.ok){
        if (isPage && cached){
          const [a, b] = await Promise.all([cached.clone().text(), res.clone().text()]);
          if (a !== b) notifyUpdate();
        }
        await cache.put(key, res.clone());
      }
      return res;
    }).catch(() => null);
    if (cached){ e.waitUntil(network); return cached; }
    return (await network) || new Response("Offline", {status: 503, headers: {"Content-Type": "text/plain"}});
  }));
});

async function notifyUpdate(){
  for (const c of await self.clients.matchAll({type: "window"})) c.postMessage({type: "updated"});
}
