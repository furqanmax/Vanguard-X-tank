import * as THREE from 'three';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.25, ...extra });
const glow = (color) => new THREE.MeshBasicMaterial({ color });

function part(parent, geo, m, x, y, z) {
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

const BUILDERS = {
  scout(g) {
    part(g, new THREE.BoxGeometry(1.8, 0.6, 3.0), mat(0xc0432b), 0, 0.6, 0);
    part(g, new THREE.BoxGeometry(0.5, 0.5, 2.6), mat(0x333333), -1.2, 0.5, 0);
    part(g, new THREE.BoxGeometry(0.5, 0.5, 2.6), mat(0x333333), 1.2, 0.5, 0);
    const turret = new THREE.Group();
    turret.position.set(0, 0.9, 0);
    part(turret, new THREE.CylinderGeometry(0.5, 0.5, 0.4, 10), mat(0x2a2a2a), 0, 0.2, 0);
    part(turret, new THREE.BoxGeometry(0.2, 0.2, 1.8), mat(0x222222), 0, 0.25, 1.2);
    g.add(turret);
    return turret;
  },
  raider(g) {
    part(g, new THREE.BoxGeometry(2.2, 0.7, 3.6), mat(0x7a2c9e), 0, 0.7, 0);
    part(g, new THREE.BoxGeometry(0.6, 0.9, 3.8), mat(0x262626), -1.4, 0.5, 0);
    part(g, new THREE.BoxGeometry(0.6, 0.9, 3.8), mat(0x262626), 1.4, 0.5, 0);
    const turret = new THREE.Group();
    turret.position.set(0, 1.1, 0);
    part(turret, new THREE.BoxGeometry(1.6, 0.5, 1.8), mat(0x5b1f78), 0, 0.25, 0);
    part(turret, new THREE.CylinderGeometry(0.12, 0.12, 2.2, 6), mat(0x222222), -0.35, 0.3, 1.2).rotation.x = Math.PI / 2;
    part(turret, new THREE.CylinderGeometry(0.12, 0.12, 2.2, 6), mat(0x222222), 0.35, 0.3, 1.2).rotation.x = Math.PI / 2;
    g.add(turret);
    return turret;
  },
  bombard(g) {
    part(g, new THREE.BoxGeometry(3.2, 1.1, 4.6), mat(0x4f5a2e), 0, 0.9, 0);
    part(g, new THREE.BoxGeometry(3.4, 0.3, 4.8), mat(0x3a4222), 0, 1.6, 0);
    const turret = new THREE.Group();
    turret.position.set(0, 1.5, 0);
    part(turret, new THREE.CylinderGeometry(1.4, 1.6, 0.8, 12), mat(0x5b6634), 0, 0.4, 0);
    const tube = part(turret, new THREE.CylinderGeometry(0.45, 0.45, 3.6, 8), mat(0x1e1e1e), 0, 1.4, 0.2);
    tube.rotation.x = -1.0;
    g.add(turret);
    return turret;
  },
  walker(g) {
    part(g, new THREE.BoxGeometry(2.6, 0.9, 3.6), mat(0x8a4a22), 0, 0.9, 0);
    part(g, new THREE.BoxGeometry(2.8, 0.4, 3.8), mat(0x5a3015), 0, 1.4, 0);
    part(g, new THREE.CylinderGeometry(0.7, 0.7, 2.2, 10), mat(0x6b6b6b), 0, 2.2, -0.8);
    const turret = new THREE.Group();
    turret.position.set(0, 1.5, 0);
    part(turret, new THREE.CylinderGeometry(0.3, 0.4, 2.4, 8), mat(0x333333), 0, 0.2, 1.2).rotation.x = Math.PI / 2;
    part(turret, new THREE.SphereGeometry(0.35, 8, 6), glow(0xffa040), 0, 0.2, 2.5);
    g.add(turret);
    return turret;
  },
  gantry(g) {
    part(g, new THREE.BoxGeometry(3.4, 0.5, 3.4), mat(0x6b6f63), 0, 0.25, 0);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      part(g, new THREE.BoxGeometry(0.3, 2.8, 0.3), mat(0x888d92), x * 1.0, 1.4, z * 1.0);
    }
    part(g, new THREE.BoxGeometry(2.6, 0.4, 2.6), mat(0x9aa0a6), 0, 2.8, 0);
    const turret = new THREE.Group();
    turret.position.set(0, 3.2, 0);
    for (const x of [-0.7, 0.7]) {
      part(turret, new THREE.CylinderGeometry(0.35, 0.35, 3, 8), mat(0xf2f2f2), x, 0.2, 0.5).rotation.x = Math.PI / 2;
      part(turret, new THREE.BoxGeometry(0.8, 0.2, 0.2), glow(0xe0463a), x, 0.2, 0.5);
    }
    g.add(turret);
    return turret;
  },
};

export function buildEnemyModel(kind) {
  const group = new THREE.Group();
  const turret = BUILDERS[kind](group);
  return { group, turret };
}
