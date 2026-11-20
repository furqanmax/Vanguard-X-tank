const STICK_R = 60;
const FIRE_AT = 0.85;
const AIM_GAIN = 1.8;
const DEAD_ZONE = 0.12;

// Response curve: small pushes are precise, full pushes reach full speed.
export function curve(v) {
  const a = Math.abs(v);
  if (a < DEAD_ZONE) return 0;
  const t = (a - DEAD_ZONE) / (1 - DEAD_ZONE);
  return Math.sign(v) * Math.pow(t, 1.4);
}

export const PRESETS = {
  default: {
    label: 'Default (right-handed)',
    drive: { x: 2, y: 56 }, aim: { x: 62, y: 40 }, buttons: { x: 55, y: 84 }, compact: false,
  },
  left: {
    label: 'Left-handed',
    drive: { x: 62, y: 56 }, aim: { x: 2, y: 40 }, buttons: { x: 2, y: 84 }, compact: false,
  },
  compact: {
    label: 'Compact (thumb reach)',
    drive: { x: 4, y: 64 }, aim: { x: 72, y: 62 }, buttons: { x: 60, y: 88 }, compact: true,
  },
};
export const DEFAULT_LAYOUT = PRESETS.default;

const ELEMENTS = { drive: 'pos-drive', aim: 'pos-aim', buttons: 'pos-buttons' };

function capture(el, id) {
  try {
    el.setPointerCapture(id);
  } catch {
    /* pointer already released; movement still works without capture */
  }
}

export function isTouchDevice() {
  return window.matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('touch');
}

const LAYOUT_KEY = 'vanguard-x-touch-layout';

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}');
  } catch {
    return {};
  }
}

// Touch layout:
//   left stick       drive
//   aim control      joystick (push to turn, pull past the ring to fire)
//                    or drag pad (drag to aim, hold to fire)
//   buttons          alt fire, swap, EMP, nano, help
// Every control can be dragged to a new place in the layout editor.
export class TouchControls {
  constructor(input, game) {
    this.input = input;
    this.game = game;
    this.root = document.getElementById('touch');
    this.bar = document.getElementById('layout-bar');
    this.editing = false;
    this.saved = loadSaved();
    this.preset = game.settings.controlPreset || 'default';
    this.layout = this.currentLayout();
    input.touch = true;
    this.applyCompact();
    this.applyLayout();
    this.applyAimStyle();
    this.bindDrive();
    this.bindAimStick();
    this.bindAimPad();
    this.bindHold('btn-alt');
    this.bindWeaponSwap();
    this.bindTap('btn-special', 'KeyX');
    this.bindTap('btn-nano', 'KeyH');
    this.bindTap('btn-help', 'Slash');
    this.bindLayoutEditor();
  }

  show(on) {
    this.root.classList.toggle('hidden', !on);
    if (!on) this.releaseAll();
  }

  releaseAll() {
    this.input.mouse.left = false;
    this.input.mouse.right = false;
    this.input.stick = null;
    this.input.drive = null;
  }

  applyAimStyle() {
    const drag = this.game.settings.aimStyle === 'drag';
    this.root.classList.toggle('aim-drag', drag);
    this.root.classList.toggle('aim-stick', !drag);
  }

  applyLayout() {
    for (const [key, id] of Object.entries(ELEMENTS)) {
      const el = document.getElementById(id);
      el.style.left = `${this.layout[key].x}%`;
      el.style.top = `${this.layout[key].y}%`;
    }
  }

  currentLayout() {
    const base = PRESETS[this.preset] || PRESETS.default;
    const saved = this.saved[this.preset] || {};
    return {
      drive: saved.drive || { ...base.drive },
      aim: saved.aim || { ...base.aim },
      buttons: saved.buttons || { ...base.buttons },
    };
  }

  setPreset(name) {
    this.preset = PRESETS[name] ? name : 'default';
    this.layout = this.currentLayout();
    this.applyLayout();
    this.applyCompact();
  }

  applyCompact() {
    this.root.classList.toggle('compact', !!(PRESETS[this.preset] || PRESETS.default).compact);
  }

  saveLayout() {
    this.saved[this.preset] = { ...this.layout };
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(this.saved));
  }

  resetLayout() {
    const base = PRESETS[this.preset] || PRESETS.default;
    this.layout = { drive: { ...base.drive }, aim: { ...base.aim }, buttons: { ...base.buttons } };
    this.applyLayout();
  }

  setEditing(on) {
    this.editing = on;
    this.root.classList.toggle('editing', on);
    this.bar.classList.toggle('hidden', !on);
    if (on) {
      this.root.classList.remove('hidden');
      this.releaseAll();
    }
  }

  bindDrive() {
    const base = document.getElementById('stick');
    const knob = document.getElementById('stick-knob');
    let id = null;
    const set = (x, y) => {
      this.input.drive = x === 0 && y === 0 ? null : { throttle: curve(-y), steer: curve(-x) };
    };
    const move = (e) => {
      const r = base.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > STICK_R) {
        dx = (dx / len) * STICK_R;
        dy = (dy / len) * STICK_R;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      set(dx / STICK_R, dy / STICK_R);
    };
    base.addEventListener('pointerdown', (e) => {
      if (this.editing) return;
      id = e.pointerId;
      capture(base, id);
      move(e);
    });
    base.addEventListener('pointermove', (e) => {
      if (e.pointerId === id) move(e);
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      knob.style.transform = 'translate(0px, 0px)';
      set(0, 0);
    };
    base.addEventListener('pointerup', end);
    base.addEventListener('pointercancel', end);
  }

  bindAimStick() {
    const base = document.getElementById('aim-stick');
    const knob = document.getElementById('aim-knob');
    let id = null;
    const move = (e) => {
      const r = base.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > STICK_R) {
        dx = (dx / len) * STICK_R;
        dy = (dy / len) * STICK_R;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const x = dx / STICK_R, y = dy / STICK_R;
      const firing = Math.hypot(x, y) >= FIRE_AT;
      this.input.stick = { x: curve(x), y: curve(y) };
      this.input.mouse.left = firing;
      base.classList.toggle('firing', firing);
    };
    base.addEventListener('pointerdown', (e) => {
      if (this.editing) return;
      id = e.pointerId;
      capture(base, id);
      move(e);
    });
    base.addEventListener('pointermove', (e) => {
      if (e.pointerId === id) move(e);
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      knob.style.transform = 'translate(0px, 0px)';
      base.classList.remove('firing');
      this.input.stick = null;
      this.input.mouse.left = false;
    };
    base.addEventListener('pointerup', end);
    base.addEventListener('pointercancel', end);
  }

  bindAimPad() {
    const pad = document.getElementById('aim-pad');
    let id = null, lx = 0, ly = 0;
    pad.addEventListener('pointerdown', (e) => {
      if (this.editing) return;
      id = e.pointerId;
      capture(pad, id);
      lx = e.clientX;
      ly = e.clientY;
      this.input.mouse.left = true;
    });
    pad.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      this.input.addAim((e.clientX - lx) * AIM_GAIN, (e.clientY - ly) * AIM_GAIN);
      lx = e.clientX;
      ly = e.clientY;
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      this.input.mouse.left = false;
    };
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
  }

  bindHold(elId) {
    const el = document.getElementById(elId);
    el.addEventListener('pointerdown', (e) => {
      if (this.editing) return;
      e.stopPropagation();
      capture(el, e.pointerId);
      el.classList.add('on');
      this.input.mouse.right = true;
    });
    const release = () => {
      el.classList.remove('on');
      this.input.mouse.right = false;
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
  }

  // Tap SWAP to cycle weapons. Hold it to open the weapon strip, then slide to a weapon and release.
  bindWeaponSwap() {
    const el = document.getElementById('btn-weapon');
    const strip = document.getElementById('weapon-pick');
    let timer = null, id = null, opened = false;
    const close = () => {
      clearTimeout(timer);
      strip.classList.add('hidden');
      strip.querySelectorAll('.pick').forEach((p) => p.classList.remove('hover'));
      opened = false;
      el.classList.remove('on');
    };
    const pickAt = (x, y) => {
      const under = document.elementFromPoint(x, y);
      return under?.closest?.('.pick') || null;
    };
    el.addEventListener('pointerdown', (e) => {
      if (this.editing) return;
      e.stopPropagation();
      id = e.pointerId;
      capture(el, id);
      el.classList.add('on');
      timer = setTimeout(() => {
        opened = true;
        strip.classList.remove('hidden');
      }, 260);
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id || !opened) return;
      strip.querySelectorAll('.pick').forEach((p) => p.classList.remove('hover'));
      pickAt(e.clientX, e.clientY)?.classList.add('hover');
    });
    el.addEventListener('pointerup', (e) => {
      if (e.pointerId !== id) return;
      if (opened) {
        const pick = pickAt(e.clientX, e.clientY);
        if (pick) this.input.press(`Digit${pick.dataset.key}`);
      } else {
        this.input.press('KeyE');
      }
      close();
      id = null;
    });
    el.addEventListener('pointercancel', () => {
      close();
      id = null;
    });
  }

  bindTap(elId, code) {
    const el = document.getElementById(elId);
    el.addEventListener('pointerdown', (e) => {
      if (this.editing) return;
      e.stopPropagation();
      this.input.press(code);
    });
  }

  bindLayoutEditor() {
    let drag = null;
    for (const [key, id] of Object.entries(ELEMENTS)) {
      const el = document.getElementById(id);
      el.addEventListener('pointerdown', (e) => {
        if (!this.editing) return;
        e.preventDefault();
        const r = el.getBoundingClientRect();
        drag = { key, el, ox: e.clientX - r.left, oy: e.clientY - r.top, id: e.pointerId };
        capture(el, e.pointerId);
      });
    }
    window.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const x = clamp(((e.clientX - drag.ox) / window.innerWidth) * 100, 0, 92);
      const y = clamp(((e.clientY - drag.oy) / window.innerHeight) * 100, 0, 92);
      this.layout[drag.key] = { x, y };
      drag.el.style.left = `${x}%`;
      drag.el.style.top = `${y}%`;
    });
    const stop = () => (drag = null);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }
}

function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}
