import * as THREE from 'three';

const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const glow = (color) => new THREE.MeshBasicMaterial({ color });

function part(group, geo, m, x, y, z) {
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

export class Destructible {
  constructor(world, { id, label, x, z, hp, radius, height, score, explodes = null, group }) {
    this.world = world;
    this.id = id;
    this.label = label;
    this.team = 'neutral';
    this.alive = true;
    this.pos = new THREE.Vector3(x, world.footprintGround(x, z, radius), z);
    this.radius = radius;
    this.height = height;
    this.hp = hp;
    this.score = score;
    this.explodes = explodes;
    this.blocksShots = false;
    this.group = group;
    this.group.position.copy(this.pos);
    group.rotation.y = Math.random() * Math.PI * 2;
    world.scene.add(group);
    world.addSolid(this);
    world.addTarget(this);
  }

  takeDamage(amount, source) {
    if (!this.alive) return false;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.die(source);
      return true;
    }
    return false;
  }

  die(source) {
    this.alive = false;
    this.hp = 0;
    const world = this.world;
    world.removeSolid(this);
    world.removeTarget(this);
    world.scene.remove(this.group);
    const center = this.pos.clone();
    center.y += this.height * 0.5;
    world.effects.explosion(center, Math.max(0.8, this.radius * 0.7));
    world.stats.objectsDestroyed++;
    world.stats.score += this.score;
    if (this.explodes) world.applySplash(center, this.explodes.radius, this.explodes.damage, { team: 'neutral' });
    world.hooks.onDestructibleDestroyed?.(this, source);
  }
}

export function addStatic(world, group, x, z, radius, height) {
  const pos = new THREE.Vector3(x, world.footprintGround(x, z, radius), z);
  group.position.copy(pos);
  group.rotation.y = Math.random() * Math.PI * 2;
  world.scene.add(group);
  const solid = { pos, radius, height, blocksShots: true };
  world.addSolid(solid);
  return solid;
}

export function buildPalm() {
  const g = new THREE.Group();
  const trunk = part(g, new THREE.CylinderGeometry(0.25, 0.4, 7, 6), mat(0x7a5a3a), 0, 3.5, 0);
  trunk.rotation.z = (Math.random() - 0.5) * 0.25;
  for (let i = 0; i < 6; i++) {
    const leaf = part(g, new THREE.ConeGeometry(0.5, 3.2, 4), mat(0x2f7a3a), 0, 7.2, 0);
    leaf.rotation.set(Math.PI / 2 - 0.5, (i / 6) * Math.PI * 2, 0);
    leaf.position.set(Math.sin((i / 6) * Math.PI * 2) * 1.5, 7.0, Math.cos((i / 6) * Math.PI * 2) * 1.5);
  }
  return g;
}

export function buildRock(scale) {
  const g = new THREE.Group();
  const rock = part(g, new THREE.IcosahedronGeometry(1, 0), mat(0x7b746a, { flatShading: true }), 0, 1.0 * scale, 0);
  rock.scale.set(2.2 * scale, 1.4 * scale, 2 * scale);
  return g;
}

export function buildCrate() {
  const g = new THREE.Group();
  part(g, new THREE.BoxGeometry(1.8, 1.8, 1.8), mat(0x9a7048), 0, 0.9, 0);
  part(g, new THREE.BoxGeometry(1.9, 0.2, 1.9), mat(0x4a3a2a), 0, 0.5, 0);
  part(g, new THREE.BoxGeometry(1.9, 0.2, 1.9), mat(0x4a3a2a), 0, 1.4, 0);
  return g;
}

export function buildBarrel() {
  const g = new THREE.Group();
  part(g, new THREE.CylinderGeometry(0.7, 0.7, 1.8, 10), mat(0xc4402d), 0, 0.9, 0);
  part(g, new THREE.CylinderGeometry(0.72, 0.72, 0.2, 10), mat(0x2a2a2a), 0, 0.5, 0);
  part(g, new THREE.CylinderGeometry(0.72, 0.72, 0.2, 10), mat(0x2a2a2a), 0, 1.3, 0);
  return g;
}

export function buildHut() {
  const g = new THREE.Group();
  part(g, new THREE.BoxGeometry(4, 2.4, 3.4), mat(0xb9a27d), 0, 1.2, 0);
  const roof = part(g, new THREE.ConeGeometry(3.2, 1.8, 4), mat(0x6d4a2b), 0, 3.3, 0);
  roof.rotation.y = Math.PI / 4;
  return g;
}

export function buildPylon() {
  const g = new THREE.Group();
  part(g, new THREE.CylinderGeometry(1.6, 2.0, 1.4, 12), mat(0x3d4753), 0, 0.7, 0);
  part(g, new THREE.CylinderGeometry(0.5, 0.7, 13, 8), mat(0xbec8d3), 0, 7.5, 0);
  const ring = part(g, new THREE.TorusGeometry(2.1, 0.18, 6, 16), glow(0x6ef7ff), 0, 14, 0);
  ring.rotation.x = Math.PI / 2;
  return g;
}

export function buildBunker() {
  const g = new THREE.Group();
  part(g, new THREE.BoxGeometry(8, 4, 8), mat(0x55606a), 0, 2, 0);
  const dome = new THREE.SphereGeometry(4.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  part(g, dome, mat(0x6b7a86), 0, 4, 0);
  part(g, new THREE.CylinderGeometry(0.1, 0.1, 3, 4), mat(0xdddddd), 2.5, 7, 2.5);
  part(g, new THREE.IcosahedronGeometry(1.1, 0), glow(0xff5f7a), 0, 2.2, 0);
  return g;
}

export function buildSilo() {
  const g = new THREE.Group();
  part(g, new THREE.CylinderGeometry(2.4, 2.6, 9, 14), mat(0xd8d8cc), 0, 4.5, 0);
  part(g, new THREE.CylinderGeometry(2.0, 2.0, 0.6, 14), mat(0x333333), 0, 9.2, 0);
  const band = part(g, new THREE.TorusGeometry(2.5, 0.2, 6, 16), glow(0xe0463a), 0, 1.2, 0);
  band.rotation.x = Math.PI / 2;
  return g;
}

export function buildBarrier(radius, height) {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 40, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x6ef7ff, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })
  );
  wall.position.y = height / 2;
  g.add(wall);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.25, 6, 40), glow(0x6ef7ff));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = height;
  g.add(rim);
  return g;
}

export function buildPad() {
  const g = new THREE.Group();
  part(g, new THREE.CylinderGeometry(7, 7, 0.3, 24), mat(0x44484d), 0, 0.15, 0);
  const h = part(g, new THREE.BoxGeometry(0.4, 0.1, 4), glow(0xffffff), 0, 0.35, 0);
  h.rotation.y = 0;
  part(g, new THREE.BoxGeometry(2.2, 0.1, 0.4), glow(0xffffff), 0, 0.36, 0);
  const ring = part(g, new THREE.TorusGeometry(6.2, 0.12, 6, 24), glow(0x6ef7ff), 0, 0.4, 0);
  ring.rotation.x = Math.PI / 2;
  return g;
}

export function buildVtol() {
  const g = new THREE.Group();
  part(g, new THREE.BoxGeometry(3, 1.2, 6), mat(0x6f7f8f), 0, 0, 0);
  part(g, new THREE.BoxGeometry(9, 0.2, 1.6), mat(0x596878), 0, 0.1, 0.5);
  part(g, new THREE.BoxGeometry(0.2, 1.4, 1.4), mat(0x596878), 0, 0.9, -2.4);
  part(g, new THREE.CylinderGeometry(0.5, 0.6, 1.4, 8), glow(0x6ef7ff), 0, -0.2, 2.4);
  return g;
}
