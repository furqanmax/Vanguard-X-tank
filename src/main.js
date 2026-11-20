import { Game } from './game/Game.js';

// Keep the game surface from selecting text or zooming on double tap.
for (const type of ['selectstart', 'dblclick', 'gesturestart', 'contextmenu']) {
  document.addEventListener(type, (e) => {
    if (!e.target.closest?.('input, textarea, select')) e.preventDefault();
  });
}
document.addEventListener('touchmove', (e) => {
  if (e.target.closest?.('#touch, #game')) e.preventDefault();
}, { passive: false });

const canvas = document.getElementById('game');
window.game = new Game(canvas);

// "Hard refresh" from the settings menu: drop every cached file and service
// worker registration, then reload with a cache-busting parameter so the page
// is rebuilt entirely from the network.
let hardRefreshing = false;
window.addEventListener('saltreach-hard-refresh', async () => {
  if (hardRefreshing) return;
  hardRefreshing = true;
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister()));
    }
  } catch (err) {
    console.warn('Hard refresh cleanup failed', err);
  }
  const url = new URL(location.href);
  url.searchParams.set('_hr', String(Date.now()));
  location.replace(url.href);
});

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  // When a new service worker takes over, reload once so the updated files
  // are used right away instead of waiting for a manual refresh.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hardRefreshing || reloading || !hadController) return;
    reloading = true;
    location.reload();
  });
  // Always re-check sw.js itself so updates are never hidden by HTTP caching.
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch((err) => console.warn('Service worker failed', err));
}
