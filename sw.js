const CACHE = 'vanguard-x-v9';
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
  './vendor/peerjs/peerjs.min.js',
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

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok && new URL(e.request.url).origin === self.location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
