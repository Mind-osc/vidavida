/* Vida Vida service worker: keeps the app available offline.
   Online: the page always comes fresh from the server (so updates show up at once) and the copy is saved.
   Offline: the saved copy is used. The manifest is also fetched fresh; icons come from the saved copy first. */
const CACHE = "vidavida-v68";
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-192-v2.png", "./icon-512-v2.png", "./icon-maskable-192-v2.png", "./icon-maskable-512-v2.png"];

self.addEventListener("install", e => {
  // "reload" skips the browser's HTTP cache, so the newest files are stored
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, {cache: "reload"})))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;   // other sites: straight to the network
  if (req.mode === "navigate" || /\/(index\.html)?$/.test(new URL(req.url).pathname)){
    // the page: network first, saved copy when offline
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try{
        const res = await fetch(req, {cache: "no-cache"});
        if (res && res.ok) await cache.put("./index.html", res.clone());
        return res;
      }catch(_){
        return (await cache.match("./index.html")) || new Response("Offline", {status: 503, headers: {"Content-Type": "text/plain"}});
      }
    })());
    return;
  }
  if (/manifest\.webmanifest$/.test(new URL(req.url).pathname)){
    // the manifest: network first too, so the phone notices a new icon or colour at once
    e.respondWith(caches.open(CACHE).then(async cache => {
      try{ const res = await fetch(req, {cache: "no-cache"}); if (res && res.ok) await cache.put(req, res.clone()); return res; }
      catch(_){ return (await cache.match(req, {ignoreSearch: true})) || new Response("", {status: 504}); }
    }));
    return;
  }
  // icons, manifest: saved copy first, refreshed in the background
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(req, {ignoreSearch: true});
    const net = fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (cached){ e.waitUntil(net); return cached; }
    return (await net) || new Response("", {status: 504});
  }));
});
