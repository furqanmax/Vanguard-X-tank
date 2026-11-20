import * as THREE from 'three';
import { ENEMY_TYPES } from './types.js';
import { buildEnemyModel } from './models.js';
import { approach, clamp, wrapAngle } from '../game/math.js';
import { ballisticVelocity, flightTime } from '../weapons/Projectiles.js';
import { scaleWeapon } from '../game/difficulty.js';

const _f = new THREE.Vector3();
const _m = new THREE.Vector3();
const _t = new THREE.Vector3();
const _v = new THREE.Vector3();

export class Enemy {
  constructor(typeId, x, z, world, difficulty) {
    const def = ENEMY_TYPES[typeId];
    this.def = def;
    this.typeId = typeId;
    this.world = world;
    this.team = 'enemy';
    this.alive = true;
    this.removed = false;
    this.stationary = !!def.stationary;
    this.radius = def.radius;
    this.height = def.height;
    this.maxHealth = Math.round(def.hp * difficulty.enemyHealth);
    this.health = this.maxHealth;
    this.weapon = scaleWeapon(def.weapon, difficulty.enemyDamage);
    this.pos = new THREE.Vector3(x, world.groundAt(x, z), z);
    this.home = this.pos.clone();
    this.heading = Math.random() * Math.PI * 2;
    this.turretYaw = this.heading;
    this.speed = 0;
    this.state = 'idle';
    this.idleTimer = 1 + Math.random() * 2;
    this.patrolTarget = null;
    this.aggroed = false;
    this.seesPlayer = false;
    this.losTimer = 0;
    this.lostTimer = 0;
    this.retreated = false;
    this.retreatTimer = 0;
    this.fireTimer = Math.random() * def.cooldown;
    this.sink = 0;
    this.stunTimer = 0;
    this.puffTimer = 0;
    this.deathTimer = 0;

    const model = buildEnemyModel(def.model);
    this.group = model.group;
    this.turret = model.turret;
    world.scene.add(this.group);
    this.syncGroup();
  }

  syncGroup() {
    this.group.position.set(this.pos.x, this.pos.y - this.sink, this.pos.z);
    this.group.rotation.y = this.heading;
    this.turret.rotation.y = wrapAngle(this.turretYaw - this.heading);
  }

  setState(s) {
    this.state = s;
    if (s === 'pursue') this.lostTimer = 0;
    if (s === 'retreat') {
      this.retreated = true;
      this.retreatTimer = 4;
    }
  }

  update(dt, ctx) {
    if (!this.alive) {
      this.updateDeath(dt, ctx);
      return;
    }
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      this.coast(dt);
      this.syncGroup();
      return;
    }
    const d = this.def, player = ctx.player;
    const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const playerAlive = player.alive;
    this.losTimer -= dt;
    if (this.losTimer <= 0 && playerAlive) {
      this.losTimer = 0.25;
      this.seesPlayer = dist < d.sight && this.world.hasLineOfSight(
        this.pos.x, this.pos.y + 1.6, this.pos.z, player.pos.x, player.pos.y + 1.2, player.pos.z);
    }
    const detected = playerAlive && (this.aggroed ? dist < d.sight * 1.6 : this.seesPlayer);

    if (!playerAlive && (this.state === 'pursue' || this.state === 'attack' || this.state === 'retreat')) {
      this.setState('patrol');
    }

    switch (this.state) {
      case 'idle':
        if (detected) {
          this.setState('pursue');
          break;
        }
        this.coast(dt);
        if (this.stationary) {
          this.idleTimer = 1; // emplacements scan in place, never patrol
          break;
        }
        this.idleTimer -= dt;
        if (this.idleTimer <= 0) {
          this.pickPatrol();
          this.setState('patrol');
        }
        break;

      case 'patrol':
        if (detected) {
          this.setState('pursue');
          break;
        }
        if (!this.patrolTarget) this.pickPatrol();
        if (this.driveTo(this.patrolTarget.x, this.patrolTarget.z, d.patrolSpeed, dt)) {
          this.patrolTarget = null;
          this.idleTimer = 1.5 + Math.random() * 2.5;
          this.setState('idle');
        }
        break;

      case 'pursue':
        if (dist > d.sight * 1.6) {
          this.lostTimer += dt;
          if (this.lostTimer > 4) {
            this.aggroed = false;
            this.setState('patrol');
            break;
          }
        } else {
          this.lostTimer = 0;
        }
        if (this.shouldRetreat()) {
          this.setState('retreat');
          break;
        }
        if (dist <= d.range) {
          this.setState('attack');
          break;
        }
        this.driveTo(player.pos.x, player.pos.z, d.speed, dt);
        this.aimAt(player, dt);
        break;

      case 'attack': {
        if (this.shouldRetreat()) {
          this.setState('retreat');
          break;
        }
        if (dist > d.range * 1.15) {
          this.setState('pursue');
          break;
        }
        if (dist < d.standoff) this.driveTo(this.pos.x - dx, this.pos.z - dz, d.speed * 0.8, dt);
        else if (dist > d.standoff * 1.3) this.driveTo(player.pos.x, player.pos.z, d.speed * 0.6, dt);
        else this.driveTo(player.pos.x, player.pos.z, 0, dt);
        const aligned = this.aimAt(player, dt);
        this.fireTimer -= dt;
        if (this.fireTimer <= 0 && aligned && dist <= d.range && this.seesPlayer) {
          this.fire(player, ctx, dist);
          this.fireTimer = d.cooldown * (0.85 + Math.random() * 0.3);
        }
        break;
      }

      case 'retreat':
        this.driveTo(this.pos.x - dx, this.pos.z - dz, d.speed, dt);
        this.retreatTimer -= dt;
        if (this.retreatTimer <= 0) this.setState('pursue');
        break;
    }
    this.syncGroup();
  }

  coast(dt) {
    if (this.stationary) return;
    this.speed = approach(this.speed, 0, this.def.accel * dt);
    this.world.move(this.pos, Math.sin(this.heading) * this.speed * dt, Math.cos(this.heading) * this.speed * dt, this.radius);
    this.pos.y = this.world.groundAt(this.pos.x, this.pos.z);
  }

  pickPatrol() {
    const a = Math.random() * Math.PI * 2;
    const r = 8 + Math.random() * 16;
    this.patrolTarget = { x: this.home.x + Math.sin(a) * r, z: this.home.z + Math.cos(a) * r };
  }

  driveTo(tx, tz, speed, dt) {
    if (this.stationary) return true;
    const dx = tx - this.pos.x, dz = tz - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const desired = Math.atan2(dx, dz);
    const diff = wrapAngle(desired - this.heading);
    const maxTurn = this.def.turnRate * dt;
    this.heading = wrapAngle(this.heading + clamp(diff, -maxTurn, maxTurn));
    const target = speed * Math.max(0, Math.cos(diff));
    this.speed = approach(this.speed, target, this.def.accel * dt);
    const step = this.speed * dt;
    const ok = this.world.move(this.pos, Math.sin(this.heading) * step, Math.cos(this.heading) * step, this.radius);
    if (!ok && speed > 0) {
      this.stuckTimer = (this.stuckTimer || 0) + dt;
      this.heading = wrapAngle(this.heading + Math.sign(diff || 1) * 1.5 * dt);
    } else {
      this.stuckTimer = 0;
    }
    this.pos.y = this.world.groundAt(this.pos.x, this.pos.z);
    return dist < 3;
  }

  aimAt(player, dt) {
    const desired = Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
    const diff = wrapAngle(desired - this.turretYaw);
    const step = this.def.turretRate * dt;
    this.turretYaw = wrapAngle(this.turretYaw + clamp(diff, -step, step));
    return Math.abs(wrapAngle(desired - this.turretYaw)) < 0.12;
  }

  fire(player, ctx, dist) {
    const w = this.weapon, d = this.def;
    const fwd = _f.set(Math.sin(this.turretYaw), 0, Math.cos(this.turretYaw));
    const muzzle = _m.copy(this.pos).addScaledVector(fwd, d.muzzleZ);
    muzzle.y += d.muzzleY;
    if (w.kind === 'flame') {
      const at = _v.copy(this.pos).addScaledVector(fwd, Math.min(dist, 9));
      ctx.fireZones.add({ pos: at, radius: w.radius, duration: w.duration, dps: w.dps, team: 'enemy' });
      return;
    }
    ctx.effects.muzzle(muzzle, fwd, w.color);
    const owner = { team: 'enemy' };
    if (w.kind === 'bolt') {
      const target = _t.copy(player.pos);
      target.y += 1.2;
      const dir = target.sub(muzzle).normalize();
      const spread = w.spread || 0;
      dir.x += (Math.random() - 0.5) * spread;
      dir.z += (Math.random() - 0.5) * spread;
      dir.normalize().multiplyScalar(w.speed);
      ctx.projectiles.spawn(w, muzzle, dir, owner);
    } else if (w.kind === 'shell') {
      const flight = flightTime(dist, w.flightSpeed);
      const aim = _t.copy(player.pos).addScaledVector(player.vel, flight * 0.5);
      const vel = ballisticVelocity(muzzle, aim, w.gravity, flight);
      ctx.projectiles.spawn(w, muzzle, vel, owner);
    } else if (w.kind === 'missile') {
      const vel = fwd.clone().multiplyScalar(w.launch);
      ctx.projectiles.spawn(w, muzzle, vel, owner, player);
    }
  }

  shouldRetreat() {
    return !this.retreated && this.def.retreatAt > 0 && this.health / this.maxHealth < this.def.retreatAt;
  }

  takeDamage(amount) {
    if (!this.alive) return false;
    this.health -= amount;
    this.aggroed = true;
    if (this.state === 'idle' || this.state === 'patrol') this.setState('pursue');
    if (this.health <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  die() {
    this.alive = false;
    this.deathTimer = 2.6;
    this.setState('death');
    this.world.removeTarget(this);
    this.world.stats.enemiesDestroyed++;
    this.world.stats.score += this.def.score;
    this.world.effects.explosion(_v.copy(this.pos).setY(this.pos.y + 1), this.def.size);
    this.world.hooks.onEnemyKilled?.(this);
  }

  updateDeath(dt, ctx) {
    this.deathTimer -= dt;
    this.puffTimer -= dt;
    if (this.puffTimer <= 0) {
      this.puffTimer = 0.12;
      ctx.effects.puff(_v.copy(this.pos).setY(this.pos.y + 1.5), 1.2);
    }
    if (this.deathTimer < 1.6) this.sink += dt * 0.8;
    this.group.rotation.x = Math.min(0.35, (this.group.rotation.x || 0) + dt * 0.3);
    this.syncGroup();
    if (this.deathTimer <= 0 && !this.removed) {
      this.world.scene.remove(this.group);
      this.removed = true;
    }
  }
}
