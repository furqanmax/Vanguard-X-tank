import * as THREE from 'three';

export const LAND_MIN = 0.6;

export class World {
  constructor(scene) {
    this.scene = scene;
    this.terrain = null;
    this.player = null;
    this.solids = new Set();
    this.targets = new Set();
    this.hooks = {};
    this.stats = { shotsFired: 0, shotsHit: 0, enemiesDestroyed: 0, objectsDestroyed: 0, pickups: 0, score: 0 };
    this.effects = null;
    this.projectiles = null;
    this.fireZones = null;
    this.pickups = null;
  }

  groundAt(x, z) {
    return this.terrain.sample(x, z);
  }

  footprintGround(x, z, r) {
    let h = this.groundAt(x, z);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      h = Math.max(h, this.groundAt(x + Math.cos(a) * r * 0.8, z + Math.sin(a) * r * 0.8));
    }
    return h;
  }

  addSolid(s) {
    this.solids.add(s);
  }

  removeSolid(s) {
    this.solids.delete(s);
  }

  addTarget(t) {
    this.targets.add(t);
  }

  removeTarget(t) {
    this.targets.delete(t);
  }

  canOccupy(x, z, r) {
    const limit = this.terrain.half - r - 2;
    if (Math.abs(x) > limit || Math.abs(z) > limit) return false;
    if (this.groundAt(x, z) < LAND_MIN) return false;
    for (const s of this.solids) {
      const dx = x - s.pos.x, dz = z - s.pos.z;
      const reach = s.radius + r;
      if (dx * dx + dz * dz < reach * reach) return false;
    }
    return true;
  }

  move(pos, dx, dz, r) {
    const tx = pos.x + dx, tz = pos.z + dz;
    if (this.canOccupy(tx, tz, r)) {
      pos.x = tx;
      pos.z = tz;
      return true;
    }
    if (this.canOccupy(tx, pos.z, r)) pos.x = tx;
    if (this.canOccupy(pos.x, tz, r)) pos.z = tz;
    return false;
  }

  raycastGround(origin, dir, maxDist) {
    const p = new THREE.Vector3();
    let prev = 0;
    for (let d = 2; d <= maxDist + 0.001; d += 2) {
      p.copy(origin).addScaledVector(dir, d);
      if (p.y <= this.groundAt(p.x, p.z)) {
        let lo = prev, hi = d;
        for (let i = 0; i < 6; i++) {
          const mid = (lo + hi) / 2;
          p.copy(origin).addScaledVector(dir, mid);
          if (p.y <= this.groundAt(p.x, p.z)) hi = mid;
          else lo = mid;
        }
        p.copy(origin).addScaledVector(dir, hi);
        return { point: p.clone(), dist: hi, hit: true };
      }
      prev = d;
    }
    return { point: origin.clone().addScaledVector(dir, maxDist), dist: maxDist, hit: false };
  }

  hasLineOfSight(ax, ay, az, bx, by, bz) {
    const steps = 24;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = ax + (bx - ax) * t, y = ay + (by - ay) * t, z = az + (bz - az) * t;
      if (y < this.groundAt(x, z)) return false;
      for (const s of this.solids) {
        if (!s.blocksShots || s.height <= y - s.pos.y) continue;
        const dx = x - s.pos.x, dz = z - s.pos.z;
        if (dx * dx + dz * dz < s.radius * s.radius) return false;
      }
    }
    return true;
  }

  applySplash(center, radius, damage, owner) {
    const hits = [];
    for (const t of this.targets) {
      if (!t.alive || t.team === owner.team) continue;
      const dx = t.pos.x - center.x, dz = t.pos.z - center.z;
      const dy = t.pos.y + t.height * 0.5 - center.y;
      const dist = Math.sqrt(dx * dx + dz * dz + dy * dy);
      const reach = radius + t.radius;
      if (dist > reach) continue;
      const amount = damage * (1 - 0.6 * dist / reach);
      const killed = t.takeDamage(amount, owner);
      hits.push({ target: t, amount, killed });
    }
    return hits;
  }

  clear() {
    for (const child of [...this.scene.children]) {
      child.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose?.();
      });
      this.scene.remove(child);
    }
    this.solids.clear();
    this.targets.clear();
    this.player = null;
  }
}
