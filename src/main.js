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

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service worker failed', err));
}
