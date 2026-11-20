const CACHE = 'vanguard-x-v12';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './icons/icon.svg',
  './vendor/three/three.module.js',
  './vendor/three/three.core.js',
  './vendor/peerjs/peerjs.min.js',
  './src/main.js',
  './src/game/Game.js',
  './src/game/Session.js',
  './src/game/World.js',
  './src/game/Input.js',
  './src/game/Touch.js',
  './src/game/Pickups.js',
  './src/game/Powerups.js',
  './src/game/Spawner.js',
  './src/game/quality.js',
  './src/ui/icons.js',
  './src/net/Net.js',
  './src/net/Multiplayer.js',
  './src/game/difficulty.js',
  './src/game/math.js',
  './src/game/noise.js',
  './src/vehicles/Vanguard.js',
  './src/weapons/weapons.js',
  './src/weapons/Projectiles.js',
  './src/enemies/Enemy.js',
  './src/enemies/models.js',
  './src/enemies/types.js',
  './src/levels/Heightfield.js',
  './src/levels/props.js',
  './src/levels/level1.js',
  './src/levels/Mission.js',
  './src/fx/Effects.js',
  './src/fx/FireZones.js',
  './src/ui/HUD.js',
  './src/ui/Minimap.js',
  './src/ui/Screens.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first: always fetch fresh files so code changes show on the next
// load. The cache is only a fallback when the device is offline, so the
// installed PWA still works without a connection.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) return caches.match(req).then((hit) => hit || res);
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});
