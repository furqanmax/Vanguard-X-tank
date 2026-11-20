import * as THREE from 'three';
import { Input } from './Input.js';
import { Session } from './Session.js';
import { HUD } from '../ui/HUD.js';
import { Minimap } from '../ui/Minimap.js';
import { Screens } from '../ui/Screens.js';
import { LEVEL_1 } from '../levels/level1.js';
import { TouchControls, isTouchDevice } from './Touch.js';
import { Net } from '../net/Net.js';
import { QUALITY } from './quality.js';

const SETTINGS_KEY = 'vanguard-x-settings';
import { Multiplayer } from '../net/Multiplayer.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x0b1118);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 1200);
    this.input = new Input(canvas);
    this.hud = new HUD();
    this.minimap = new Minimap();
    this.settings = {
      sensitivity: 1, invertY: false, difficulty: 'normal', fullscreen: false, aimStyle: 'stick', autoFire: true,
      quality: isTouchDevice() ? 'medium' : 'high', iconSet: 'flat', controlPreset: 'default',
      ...this.loadSettings(),
    };
    this.hud.setIconSet(this.settings.iconSet);
    this.applyQuality();
    this.screens = new Screens((a) => this.handleAction(a), (k, v) => this.setSetting(k, v));
    this.screens.syncSettings(this.settings);
    this.state = 'title';
    this.session = null;
    this.level = LEVEL_1;
    this.returnTo = 'title';
    this.clock = new THREE.Clock();
    this.net = new Net();
    this.room = null;
    this.net.on('roster', (m) => this.onRoster(m));
    this.net.on('start', (m) => this.startVersus(m));
    this.net.on('error', (m) => this.mpError(m.text));
    this.net.on('joined', (m) => this.onJoined(m));
    this.net.on('disconnected', () => {
      if (this.room && this.state === 'playing') this.hud.message('Connection lost', 'warn');
      this.room = null;
    });

    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
    canvas.addEventListener('mousedown', () => {
      if (this.state === 'playing' && !this.input.locked) this.requestLock();
    });
    this.touch = isTouchDevice() ? new TouchControls(this.input, this) : null;
    document.querySelectorAll('[data-touch-only]').forEach((el) => el.classList.toggle('hidden', !this.touch));
    this.input.onLockChange = (locked) => {
      if (this.state === 'playing' && !this.input.touch && !locked) this.pause();
      this.hud.setLockHint(this.state === 'playing' && !this.input.touch && !locked);
    };
    document.addEventListener('fullscreenchange', () => {
      this.settings.fullscreen = !!document.fullscreenElement;
      this.screens.syncSettings(this.settings);
    });
    this.input.onLockError = () => this.hud.message('Click the view to capture the mouse', 'warn');
    this.input.onEscape = () => {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    };

    document.getElementById('pause-btn').addEventListener('click', () => this.pause());
    document.getElementById('weapons').addEventListener('pointerdown', (e) => {
      const slot = e.target.closest('.slot');
      if (slot && this.state === 'playing') this.input.press(`Digit${slot.dataset.key}`);
    });
    document.getElementById('layout-bar').addEventListener('click', (e) => {
      const b = e.target.closest('[data-action]');
      if (b) this.handleAction(b.dataset.action);
    });
    this.screens.show('title');
    requestAnimationFrame(this.loop);
  }

  loop = () => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.session) {
      if (this.state === 'playing') this.session.update(dt);
      this.session.render();
    } else {
      this.renderer.clear();
    }
    this.input.endFrame();
  };

  requestLock() {
    this.canvas.requestPointerLock?.();
  }

  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  loadSettings() {
    try {
      const { fullscreen, ...rest } = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      return rest;
    } catch {
      return {};
    }
  }

  saveSettings() {
    const { fullscreen, ...rest } = this.settings;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(rest));
  }

  applyQuality() {
    const q = QUALITY[this.settings.quality] || QUALITY.high;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.pixel));
    this.renderer.shadowMap.enabled = q.shadows;
    this.session?.applyQuality(q);
  }

  setSetting(key, value) {
    if (key === 'quality') {
      this.settings.quality = value;
      this.applyQuality();
      this.saveSettings();
      this.screens.syncSettings(this.settings);
      return;
    }
    if (key === 'iconSet') {
      this.settings.iconSet = value;
      this.hud.setIconSet(value);
      this.saveSettings();
      this.screens.syncSettings(this.settings);
      return;
    }
    if (key === 'controlPreset') {
      this.settings.controlPreset = value;
      this.touch?.setPreset(value);
      this.saveSettings();
      this.screens.syncSettings(this.settings);
      return;
    }
    if (key !== 'fullscreen') this.saveSettings();
    if (key === 'fullscreen') {
      this.setFullscreen(value);
      return;
    }
    this.settings[key] = value;
    if (key === 'aimStyle') this.touch?.applyAimStyle();
    this.screens.syncSettings(this.settings);
  }

  setFullscreen(on) {
    const el = document.documentElement;
    if (on && !document.fullscreenElement) {
      el.requestFullscreen?.()
        .then(() => screen.orientation?.lock?.('landscape').catch(() => {}))
        .catch(() => this.hud.message('Fullscreen not available', 'warn'));
    } else if (!on && document.fullscreenElement) {
      document.exitFullscreen?.();
    }
  }

  toggleFullscreen() {
    this.setFullscreen(!document.fullscreenElement);
  }

  handleAction(action) {
    switch (action) {
      case 'new-game': this.startLevel(); break;
      case 'deploy': this.deploy(); break;
      case 'resume': this.resume(); break;
      case 'retry': this.retry(); break;
      case 'replay': this.retry(); break;
      case 'menu': case 'quit': this.quitToMenu(); break;
      case 'options': case 'controls': case 'credits':
        this.open(action);
        break;
      case 'back': this.screens.show(this.returnTo || 'title'); break;
      case 'fullscreen': this.toggleFullscreen(); break;
      case 'mp-menu': this.open('mp'); break;
      case 'edit-touch': this.startLayoutEdit(); break;
      case 'layout-done': this.finishLayoutEdit(); break;
      case 'layout-reset': this.touch?.resetLayout(); break;
      case 'mp-create': this.mpCreate(); break;
      case 'mp-join': this.mpJoin(); break;
      case 'mp-start': this.net.startMatch(); break;
      case 'mp-leave': this.leaveRoom(); this.screens.show('title'); break;
    }
  }

  startLayoutEdit() {
    if (!this.touch) return;
    this.layoutReturn = this.state;
    this.state = 'layout';
    this.exitLock();
    this.screens.hide();
    this.hud.hide();
    this.touch.setEditing(true);
  }

  finishLayoutEdit() {
    this.touch.setEditing(false);
    this.touch.saveLayout();
    this.touch.show(false);
    this.state = this.session && this.layoutReturn === 'paused' ? 'paused' : 'title';
    this.screens.show('options');
  }

  open(name) {
    this.returnTo = this.screens.current;
    this.screens.show(name);
  }

  disposeSession() {
    if (this.session) {
      this.session.dispose();
      this.session = null;
    }
  }

  startLevel() {
    this.disposeSession();
    this.hud.hide();
    this.session = new Session(this, this.level);
    this.state = 'briefing';
    this.screens.show('briefing', this.level);
  }

  deploy() {
    if (!this.session) return;
    this.state = 'playing';
    this.screens.hide();
    this.hud.show();
    this.touch?.show(true);
    this.session.start();
    this.requestLock();
  }

  retry() {
    this.disposeSession();
    this.startLevel();
    this.deploy();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.exitLock();
    this.hud.setLockHint(false);
    this.touch?.show(false);
    this.screens.show('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.screens.hide();
    this.touch?.show(true);
    this.requestLock();
  }

  async mpCreate() {
    this.mpError('');
    try {
      await this.net.createRoom(this.mpName());
    } catch (err) {
      this.mpError(err.message);
    }
  }

  mpJoin() {
    const code = document.getElementById('mp-code').value.trim().toUpperCase();
    if (code.length !== 4) return this.mpError('Enter the 4-letter room code');
    this.mpError('');
    this.net.joinRoom(code, this.mpName());
  }

  mpName() {
    return document.getElementById('mp-name').value.trim() || 'Pilot';
  }

  mpError(text) {
    for (const id of ['mp-error', 'lobby-error']) {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    }
  }

  onJoined(m) {
    this.room = { code: m.code, mode: m.mode, host: m.host, players: m.players };
    this.renderLobby();
    this.screens.show('lobby');
  }

  onRoster(m) {
    if (!this.room) return;
    this.room.players = m.players;
    this.room.host = m.host;
    this.renderLobby();
  }

  renderLobby() {
    const r = this.room;
    document.getElementById('lobby-code').textContent = r.code;
    document.getElementById('lobby-roster').innerHTML = r.players
      .map((p) => `<li class="${p.id === r.host ? 'host' : ''}">${p.name.replace(/</g, '&lt;')}</li>`).join('');
    document.getElementById('lobby-start').classList.toggle('hidden', r.host !== this.net.id);
    document.getElementById('lobby-error').textContent = '';
  }

  leaveRoom() {
    this.room = null;
    this.net.disconnect();
  }

  startVersus(m) {
    this.disposeSession();
    this.hud.hide();
    this.session = new Session(this, this.level, { mode: 'versus' });
    this.session.multiplayer = new Multiplayer(this.session, this.net, m.players, m.mode);
    this.room = null;
    this.deploy();
  }

  onVersusEnd(rows, myId) {
    this.state = 'vsend';
    this.exitLock();
    this.hud.hide();
    this.touch?.show(false);
    this.screens.show('vsresult', { rows, myId });
    this.leaveRoom();
  }

  quitToMenu() {
    this.exitLock();
    if (this.room) this.leaveRoom();
    this.disposeSession();
    this.hud.hide();
    this.touch?.show(false);
    this.minimap.clear();
    this.state = 'title';
    this.screens.show('title');
  }

  onMissionComplete(results) {
    this.state = 'complete';
    this.exitLock();
    this.hud.hide();
    this.touch?.show(false);
    this.screens.show('complete', results);
  }

  onMissionFailed(reason) {
    this.state = 'gameover';
    this.exitLock();
    this.hud.hide();
    this.touch?.show(false);
    this.screens.show('gameover', { reason });
  }
}
