import * as THREE from 'three';

const circleGeo = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);

export class FireZones {
  constructor(world) {
    this.world = world;
    this.zones = [];
  }

  add({ pos, radius, duration, dps, team }) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff6a1a, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(circleGeo, mat);
    mesh.position.set(pos.x, this.world.groundAt(pos.x, pos.z) + 0.2, pos.z);
    mesh.scale.setScalar(radius);
    this.world.scene.add(mesh);
    this.zones.push({ pos: pos.clone(), radius, life: duration, max: duration, dps, team, mesh, mat, flameTimer: 0 });
  }

  update(dt) {
    const world = this.world;
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.life -= dt;
      if (z.life <= 0) {
        world.scene.remove(z.mesh);
        z.mat.dispose();
        this.zones.splice(i, 1);
        continue;
      }
      z.mat.opacity = 0.35 + Math.random() * 0.25 * (z.life / z.max);
      z.flameTimer -= dt;
      if (z.flameTimer <= 0) {
        z.flameTimer = 0.12;
        world.effects.flame(z.pos, z.radius);
      }
      for (const t of world.targets) {
        if (!t.alive || t.team === z.team) continue;
        const d = Math.hypot(t.pos.x - z.pos.x, t.pos.z - z.pos.z);
        if (d < z.radius + t.radius) t.takeDamage(z.dps * dt, { team: z.team });
      }
    }
  }
}
