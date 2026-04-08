/* Service worker for caching Unity WebGL build files. */

const CACHE_VERSION = "rpsdemo-v1";
const PRECACHE = `${CACHE_VERSION}-precache`;
const RUNTIME = `${CACHE_VERSION}-runtime`;

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/TemplateData/style.css",
  "/TemplateData/favicon.ico",
  "/TemplateData/rotate-device-anim.svg",
  "/Build/RPSDemo.loader.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      await cache.addAll(PRECACHE_URLS);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== PRECACHE && k !== RUNTIME)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

const isCacheableGet = (request) =>
  request.method === "GET" &&
  (request.url.startsWith(self.location.origin));

const isUnityAsset = (url) => {
  const p = url.pathname;
  return (
    p.startsWith("/Build/") ||
    p.startsWith("/TemplateData/") ||
    p.startsWith("/StreamingAssets/") ||
    p.endsWith(".unityweb") ||
    p.endsWith(".wasm") ||
    p.endsWith(".data") ||
    p.endsWith(".js") ||
    p.endsWith(".css") ||
    p.endsWith(".png") ||
    p.endsWith(".svg") ||
    p.endsWith(".ico") ||
    p.endsWith(".json")
  );
};

const cacheFirst = async (request) => {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh && fresh.ok) cache.put(request, fresh.clone());
  return fresh;
};

const networkFirst = async (request) => {
  const cache = await caches.open(RUNTIME);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("Network failed and no cache entry.");
  }
};

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!isCacheableGet(request)) return;

  const url = new URL(request.url);

  // Navigation: prefer fresh index, fall back to cached.
  if (request.mode === "navigate") {
    event.respondWith(networkFirst("/index.html"));
    return;
  }

  if (isUnityAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }
});

