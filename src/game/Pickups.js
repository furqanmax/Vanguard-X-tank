import * as THREE from 'three';

export const PICKUP_TYPES = {
  ammo_erfpg: { label: 'ERFPG cells', color: 0x7ef4ff },
  ammo_mortar: { label: 'Mortar shells', color: 0xffa64d },
  ammo_napalm: { label: 'Napalm canister', color: 0xff5a20 },
  health: { label: 'Armor repair', color: 0x6dff8a },
  canister: { label: 'Nano-canister', color: 0xf3e26b },
  overdrive: { label: 'Overdrive', color: 0xff8a3d },
  aegis: { label: 'Aegis shield', color: 0x6ef7ff },
  special: { label: 'Special charge', color: 0xc77dff },
};

const geo = new THREE.OctahedronGeometry(0.9, 0);

export class Pickups {
  constructor(world) {
    this.world = world;
    this.list = [];
  }

  spawn(type, x, z) {
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: PICKUP_TYPES[type].color }));
    const y = this.world.groundAt(x, z);
    mesh.position.set(x, y + 1.2, z);
    this.world.scene.add(mesh);
    this.list.push({ type, pos: new THREE.Vector3(x, y, z), mesh, t: Math.random() * 6, discovered: false });
  }

  update(dt, player, onCollect) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.t += dt * 2;
      p.mesh.rotation.y += dt * 1.5;
      p.mesh.position.y = p.pos.y + 1.2 + Math.sin(p.t) * 0.25;
      const d = Math.hypot(p.pos.x - player.pos.x, p.pos.z - player.pos.z);
      if (d < 60) p.discovered = true;
      if (d < 3.2 && player.alive) {
        this.world.scene.remove(p.mesh);
        p.mesh.material.dispose();
        this.list.splice(i, 1);
        onCollect(p.type);
      }
    }
  }
}
