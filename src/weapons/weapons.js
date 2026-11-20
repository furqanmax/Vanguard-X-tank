import * as THREE from 'three';
import { ballisticVelocity, flightTime } from './Projectiles.js';

export const WEAPONS = {
  rfpg: {
    name: 'Rapid Pulse Gun', short: 'RFPG', cooldown: 0.11, ammo: null,
    shot: { kind: 'bolt', speed: 170, damage: 9, hitRadius: 0.5, life: 1.4, color: 0x7ef4ff, size: 0.22 },
  },
  erfpg: {
    name: 'Enhanced Pulse Gun', short: 'ERFPG', cooldown: 0.075, ammo: 'erfpg', maxAmmo: 400,
    shot: { kind: 'bolt', speed: 200, damage: 15, hitRadius: 0.55, life: 1.2, color: 0xe0fdff, size: 0.26 },
  },
  mortar: {
    name: 'High-Explosive Mortar', short: 'MORTAR', cooldown: 1.3, ammo: 'mortar', maxAmmo: 40,
    shot: { kind: 'shell', flightSpeed: 60, gravity: 18, damage: 55, splash: 6.5, hitRadius: 0.8, life: 6, color: 0xffa64d, size: 0.7 },
  },
  napalm: {
    name: 'Napalm Projector', short: 'NAPALM', cooldown: 2.0, ammo: 'napalm', maxAmmo: 16,
    shot: {
      kind: 'shell', flightSpeed: 50, gravity: 16, damage: 12, splash: 4.5, hitRadius: 0.8, life: 6,
      color: 0xff5a20, size: 0.8, fire: { radius: 6.5, duration: 6, dps: 10 },
    },
  },
};

const ADVANCED_BY_KEY = { 2: 'mortar', 3: 'napalm' };
const _vel = new THREE.Vector3();
const _dir = new THREE.Vector3();

export class Arsenal {
  constructor(session) {
    this.session = session;
    this.slot = 1;
    this.primaryPref = 'rfpg';
    this.advancedId = 'mortar';
    this.ammo = { erfpg: 0, mortar: 16, napalm: 0 };
    this.cooldown = { rfpg: 0, erfpg: 0, mortar: 0, napalm: 0 };
    this.notice = 0;
  }

  get primaryId() {
    return this.primaryPref === 'erfpg' && this.ammo.erfpg > 0 ? 'erfpg' : 'rfpg';
  }

  select(key) {
    const hud = this.session.hud;
    if (key === 1) {
      if (this.primaryPref === 'erfpg') this.primaryPref = 'rfpg';
      else if (this.ammo.erfpg > 0) this.primaryPref = 'erfpg';
      else hud.message('ERFPG ammo empty', 'warn');
      this.slot = 1;
      hud.message(`Primary: ${WEAPONS[this.primaryId].name}`);
      return;
    }
    this.slot = key;
    this.advancedId = ADVANCED_BY_KEY[key];
    hud.message(`Selected: ${WEAPONS[this.advancedId].name}`);
  }

  cycle(dir) {
    const order = [1, 2, 3];
    const i = order.indexOf(this.slot);
    const next = order[(i + dir + order.length) % order.length];
    this.slot = next;
    if (next !== 1) this.advancedId = ADVANCED_BY_KEY[next];
    this.session.hud.message(`Weapon: ${WEAPONS[next === 1 ? this.primaryId : this.advancedId].name}`);
  }

  addAmmo(key, amount) {
    this.ammo[key] = Math.min(WEAPONS[key].maxAmmo, this.ammo[key] + amount);
  }

  update(dt) {
    for (const k in this.cooldown) this.cooldown[k] = Math.max(0, this.cooldown[k] - dt);
    this.notice = Math.max(0, this.notice - dt);
  }

  fire(kind) {
    const id = kind === 'primary' ? this.primaryId : this.advancedId;
    const w = WEAPONS[id];
    const s = this.session, p = s.player, world = s.world;
    if (this.cooldown[id] > 0) return false;
    if (w.ammo && this.ammo[w.ammo] <= 0) {
      if (this.notice <= 0) {
        s.hud.message(`${w.short} empty`, 'warn');
        this.notice = 1.2;
      }
      return false;
    }
    if (w.ammo) this.ammo[w.ammo]--;
    this.cooldown[id] = w.cooldown * (s.player.powerups.overdrive > 0 ? 0.5 : 1);
    world.stats.shotsFired++;

    const shot = w.shot, muzzle = p.aim.muzzle, point = p.aim.point;
    _dir.subVectors(point, muzzle).normalize();
    if (shot.kind === 'bolt') {
      _vel.copy(_dir).multiplyScalar(shot.speed);
    } else {
      ballisticVelocity(muzzle, point, shot.gravity, flightTime(p.aim.dist, shot.flightSpeed), _vel);
    }
    world.effects.muzzle(muzzle, _dir, shot.color);
    world.projectiles.spawn(shot, muzzle, _vel, { team: 'player' });
    s.multiplayer?.sendFire(id, muzzle, _vel);
    for (const e of s.enemies) {
      if (e.alive && Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < 35) e.aggroed = true;
    }
    return true;
  }

  slotStates() {
    const prim = WEAPONS[this.primaryId];
    return [
      { key: 1, id: this.primaryId, name: prim.short, ammo: prim.ammo ? this.ammo[prim.ammo] : '∞', selected: this.slot === 1, bound: false },
      { key: 2, id: 'mortar', name: WEAPONS.mortar.short, ammo: this.ammo.mortar, selected: this.slot === 2, bound: this.advancedId === 'mortar' },
      { key: 3, id: 'napalm', name: WEAPONS.napalm.short, ammo: this.ammo.napalm, selected: this.slot === 3, bound: this.advancedId === 'napalm' },
    ];
  }
}
