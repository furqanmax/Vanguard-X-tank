import * as THREE from 'three';
import { approach } from '../game/math.js';

export function flightTime(distance, speed) {
  return Math.min(3.2, Math.max(0.6, distance / speed));
}

export function ballisticVelocity(from, to, gravity, flight, out = new THREE.Vector3()) {
  out.subVectors(to, from).divideScalar(flight);
  out.y += 0.5 * gravity * flight;
  return out;
}

const boltGeo = new THREE.BoxGeometry(1, 1, 1);
const sphereGeo = new THREE.SphereGeometry(1, 8, 6);
const missileGeo = new THREE.ConeGeometry(1, 2.4, 6).rotateX(Math.PI / 2);
const _a = new THREE.Vector3();

function makeMesh(shot) {
  const material = new THREE.MeshBasicMaterial({ color: shot.color });
  let mesh;
  if (shot.kind === 'bolt') {
    mesh = new THREE.Mesh(boltGeo, material);
    mesh.scale.set(shot.size, shot.size, shot.size * 7);
  } else if (shot.kind === 'missile') {
    mesh = new THREE.Mesh(missileGeo, material);
    mesh.scale.setScalar(shot.size);
  } else {
    mesh = new THREE.Mesh(sphereGeo, material);
    mesh.scale.setScalar(shot.size);
  }
  return mesh;
}

export class Projectiles {
  constructor(world) {
    this.world = world;
    this.list = [];
  }

  spawn(shot, origin, velocity, owner, target = null, visual = false) {
    const mesh = makeMesh(shot);
    mesh.position.copy(origin);
    this.world.scene.add(mesh);
    this.list.push({ shot, owner, target, pos: origin.clone(), vel: velocity.clone(), age: 0, trail: 0, mesh, visual });
  }

  update(dt) {
    const world = this.world;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      const s = p.shot;
      p.age += dt;
      if (s.kind === 'shell') p.vel.y -= s.gravity * dt;
      else if (s.kind === 'missile') this.steer(p, dt);
      p.pos.addScaledVector(p.vel, dt);

      const hit = p.visual ? null : this.findTarget(p);
      const ground = world.groundAt(p.pos.x, p.pos.z);
      const impact = !!hit || p.pos.y <= ground || p.age >= s.life || (!p.visual && this.hitsSolid(p));
      if (impact) {
        if (p.pos.y < ground) p.pos.y = ground;
        this.explode(p, hit);
        this.remove(i);
        continue;
      }
      if (s.kind === 'missile') {
        p.trail -= dt;
        if (p.trail <= 0) {
          p.trail = 0.05;
          world.effects.puff(p.pos, 0.6);
        }
      }
      p.mesh.position.copy(p.pos);
      if (p.vel.lengthSq() > 1e-6) {
        _a.copy(p.pos).add(p.vel);
        p.mesh.lookAt(_a);
      }
    }
  }

  steer(p, dt) {
    const s = p.shot, t = p.target;
    if (t && t.alive) {
      _a.copy(t.pos);
      _a.y += 1.2;
      _a.sub(p.pos).normalize().multiplyScalar(s.speed);
      p.vel.lerp(_a, 1 - Math.exp(-s.turn * dt));
    }
    const sp = p.vel.length();
    if (sp > 0.001) p.vel.multiplyScalar(approach(sp, s.speed, s.accel * dt) / sp);
  }

  findTarget(p) {
    const s = p.shot;
    for (const t of this.world.targets) {
      if (!t.alive || t.team === p.owner.team) continue;
      const dx = p.pos.x - t.pos.x, dz = p.pos.z - t.pos.z;
      const reach = s.hitRadius + t.radius;
      if (dx * dx + dz * dz > reach * reach) continue;
      if (p.pos.y < t.pos.y - 0.5 || p.pos.y > t.pos.y + t.height) continue;
      return t;
    }
    return null;
  }

  hitsSolid(p) {
    for (const o of this.world.solids) {
      if (!o.blocksShots || p.pos.y > o.height) continue;
      const dx = p.pos.x - o.pos.x, dz = p.pos.z - o.pos.z;
      const reach = o.radius + p.shot.hitRadius;
      if (dx * dx + dz * dz < reach * reach) return true;
    }
    return false;
  }

  explode(p, hit) {
    const world = this.world, s = p.shot, at = p.pos;
    let hits;
    if (p.visual) {
      if (s.kind === 'bolt') world.effects.impact(at, s.color, 0.6);
      else world.effects.explosion(at, Math.max(0.6, (s.splash ?? 1.5) / 4));
      return;
    }
    if (s.kind === 'bolt') {
      hits = [];
      if (hit) hits.push({ target: hit, amount: s.damage, killed: hit.takeDamage(s.damage, p.owner) });
      world.effects.impact(at, s.color, 0.6);
    } else {
      const radius = s.splash ?? 1.5;
      hits = world.applySplash(at, radius, s.damage, p.owner);
      world.effects.explosion(at, Math.max(0.6, radius / 4));
    }
    if (s.fire) {
      world.fireZones.add({ pos: at, radius: s.fire.radius, duration: s.fire.duration, dps: s.fire.dps, team: p.owner.team });
    }
    if (hits.length && p.owner.team === 'player') {
      world.stats.shotsHit++;
      world.hooks.onPlayerHit?.(hits);
    }
  }

  remove(i) {
    const p = this.list[i];
    this.world.scene.remove(p.mesh);
    p.mesh.material.dispose();
    this.list.splice(i, 1);
  }
}
