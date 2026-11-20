import * as THREE from 'three';
import { Vanguard } from '../vehicles/Vanguard.js';
import { WEAPONS } from '../weapons/weapons.js';
import { damp, wrapAngle } from '../game/math.js';

const SEND_INTERVAL = 0.1;
export const KILL_LIMIT = 15;
export const TIME_LIMIT = 360;

const _v = new THREE.Vector3();

export class Multiplayer {
  constructor(session, net, roster, mode) {
    this.s = session;
    this.net = net;
    this.mode = mode;
    this.myId = net.id;
    this.remotes = new Map();
    this.stats = new Map();
    this.sendTimer = 0;
    this.ended = false;
    for (const p of roster) {
      this.stats.set(p.id, { id: p.id, name: p.name, kills: 0, deaths: 0 });
      if (p.id !== this.myId) this.addRemote(p);
    }
    this.unsub = [
      net.on('state', (m) => this.onState(m)),
      net.on('hit', (m) => this.onHit(m)),
      net.on('fire', (m) => this.onFire(m)),
      net.on('death', (m) => this.applyDeath(m.victim, m.killer)),
      net.on('roster', (m) => this.onRoster(m)),
    ];
  }

  addRemote(p) {
    const tank = new Vanguard(this.s.scene, this.s.world, { x: 0, z: 0, heading: 0 });
    tank.team = 'rival';
    tank.alive = false;
    tank.root.visible = false;
    tank.takeDamage = () => false;
    tank.name = p.name;
    const remote = { id: p.id, name: p.name, tank, state: null, fresh: true };
    tank.takeDamage = (amount, owner) => {
      if (owner.team !== tank.team && remote.tank.alive) {
        this.net.send({ t: 'hit', to: p.id, amount });
      }
      return false;
    };
    this.remotes.set(p.id, remote);
    this.s.world.addTarget(tank);
  }

  onRoster(m) {
    const ids = new Set(m.players.map((p) => p.id));
    for (const [id, r] of this.remotes) {
      if (!ids.has(id)) {
        this.s.world.removeTarget(r.tank);
        this.s.scene.remove(r.tank.root);
        this.remotes.delete(id);
        this.s.hud.message(`${r.name} left the match`, 'warn');
      }
    }
    for (const p of m.players) {
      if (!this.stats.has(p.id)) this.stats.set(p.id, { id: p.id, name: p.name, kills: 0, deaths: 0 });
    }
  }

  onState(m) {
    const r = this.remotes.get(m.from);
    if (!r) return;
    r.state = m.s;
    r.tank.health = m.s.hp;
    r.tank.alive = m.s.al;
    if (r.fresh) {
      r.fresh = false;
      r.tank.pos.set(m.s.x, this.s.world.groundAt(m.s.x, m.s.z), m.s.z);
      r.tank.heading = m.s.h;
      r.tank.turretYaw = m.s.ty;
      r.tank.barrelPitch = m.s.bp;
    }
  }

  onHit(m) {
    const p = this.s.player;
    p.lastHitBy = m.from;
    p.takeDamage(m.amount);
  }

  onFire(m) {
    const r = this.remotes.get(m.from);
    if (!r) return;
    const shot = WEAPONS[m.w].shot;
    const origin = _v.set(m.o[0], m.o[1], m.o[2]).clone();
    const vel = new THREE.Vector3(m.v[0], m.v[1], m.v[2]);
    this.s.world.projectiles.spawn(shot, origin, vel, { team: r.tank.team }, null, true);
    this.s.world.effects.muzzle(origin, vel.clone().normalize(), shot.color);
  }

  sendFire(weaponId, muzzle, vel) {
    if (!this.net.connected) return;
    this.net.send({
      t: 'fire', w: weaponId,
      o: [muzzle.x, muzzle.y, muzzle.z],
      v: [vel.x, vel.y, vel.z],
    });
  }

  onLocalDeath(killer) {
    this.net.send({ t: 'death', victim: this.myId, killer });
    this.applyDeath(this.myId, killer);
  }

  applyDeath(victim, killer) {
    if (this.ended) return;
    const v = this.stats.get(victim);
    if (v) v.deaths++;
    const r = this.remotes.get(victim);
    if (r) r.tank.alive = false;
    const k = this.stats.get(killer);
    if (k && killer !== victim) k.kills++;
    const vName = this.nameOf(victim), kName = this.nameOf(killer);
    this.s.hud.message(killer === victim ? `${vName} went down` : `${kName} eliminated ${vName}`, 'kill');
    if (k && k.kills >= KILL_LIMIT) this.finish();
  }

  nameOf(id) {
    if (id === this.myId) return 'You';
    return this.stats.get(id)?.name || 'Pilot';
  }

  rows() {
    return [...this.stats.values()].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  }

  finish() {
    if (this.ended) return;
    this.ended = true;
    this.s.endVersus(this.rows(), this.myId);
  }

  update(dt) {
    const p = this.s.player;
    this.sendTimer -= dt;
    if (this.sendTimer <= 0 && this.net.connected) {
      this.sendTimer = SEND_INTERVAL;
      this.net.send({
        t: 'state',
        s: {
          x: p.pos.x, z: p.pos.z, h: p.heading, ty: p.turretYaw, bp: p.barrelPitch,
          hp: p.health, al: p.alive,
        },
      });
    }

    for (const r of this.remotes.values()) {
      const t = r.tank, s = r.state;
      if (!s) continue;
      if (!r.fresh) {
        const k = damp(dt, 14);
        t.pos.x += (s.x - t.pos.x) * k;
        t.pos.z += (s.z - t.pos.z) * k;
        t.heading = wrapAngle(t.heading + wrapAngle(s.h - t.heading) * k);
        t.turretYaw = wrapAngle(t.turretYaw + wrapAngle(s.ty - t.turretYaw) * k);
        t.barrelPitch += (s.bp - t.barrelPitch) * k;
      }
      t.pos.y = this.s.world.groundAt(t.pos.x, t.pos.z);
      t.root.visible = t.alive;
      t.syncVisual();
    }

    if (this.mode === 'versus' && this.s.elapsed > TIME_LIMIT) this.finish();
  }

  dispose() {
    for (const u of this.unsub) u();
    for (const r of this.remotes.values()) this.s.world.removeTarget(r.tank);
    this.remotes.clear();
  }
}
