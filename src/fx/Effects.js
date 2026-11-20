import * as THREE from 'three';
import { clamp } from '../game/math.js';

const VERT = `
attribute float aSize;
attribute vec4 aColor;
varying vec4 vColor;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(aSize * 360.0 / max(-mv.z, 0.1), 1.0, 160.0);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = `
uniform sampler2D map;
varying vec4 vColor;
void main() {
  vec4 t = texture2D(map, gl_PointCoord);
  float a = vColor.a * t.a;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor.rgb, a);
}`;

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const rnd = (a, b) => a + Math.random() * (b - a);

class ParticleSystem {
  constructor(scene, cap, additive, tex) {
    this.cap = cap;
    this.cursor = 0;
    this.pos = new Float32Array(cap * 3);
    this.vel = new Float32Array(cap * 3);
    this.color = new Float32Array(cap * 4);
    this.size = new Float32Array(cap);
    this.size0 = new Float32Array(cap);
    this.size1 = new Float32Array(cap);
    this.age = new Float32Array(cap);
    this.life = new Float32Array(cap);
    this.alpha0 = new Float32Array(cap);
    this.rgb = new Float32Array(cap * 3);
    this.grav = new Float32Array(cap);
    this.drag = new Float32Array(cap);
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.color, 4).setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('aColor', this.colAttr);
    geo.setAttribute('aSize', this.sizeAttr);
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  emit(p, v, rgb, alpha, s0, s1, life, gravity = 0, drag = 0) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.cap;
    this.pos.set(p, i * 3);
    this.vel.set(v, i * 3);
    this.rgb.set(rgb, i * 3);
    this.alpha0[i] = alpha;
    this.size0[i] = s0;
    this.size1[i] = s1;
    this.life[i] = life;
    this.age[i] = 0;
    this.grav[i] = gravity;
    this.drag[i] = drag;
  }

  update(dt) {
    const n = this.cap;
    for (let i = 0; i < n; i++) {
      if (this.life[i] <= 0) {
        this.size[i] = 0;
        this.color[i * 4 + 3] = 0;
        continue;
      }
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        this.life[i] = 0;
        this.size[i] = 0;
        this.color[i * 4 + 3] = 0;
        continue;
      }
      const k = this.age[i] / this.life[i];
      const f = Math.exp(-this.drag[i] * dt);
      const o = i * 3;
      this.vel[o] *= f;
      this.vel[o + 1] = this.vel[o + 1] * f - this.grav[i] * dt;
      this.vel[o + 2] *= f;
      this.pos[o] += this.vel[o] * dt;
      this.pos[o + 1] += this.vel[o + 1] * dt;
      this.pos[o + 2] += this.vel[o + 2] * dt;
      this.size[i] = this.size0[i] + (this.size1[i] - this.size0[i]) * k;
      this.color[i * 4] = this.rgb[o];
      this.color[i * 4 + 1] = this.rgb[o + 1];
      this.color[i * 4 + 2] = this.rgb[o + 2];
      this.color[i * 4 + 3] = this.alpha0[i] * (1 - k);
    }
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
  }
}

class Debris {
  constructor(scene, cap, world) {
    this.world = world;
    this.cap = cap;
    this.cursor = 0;
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.35, 0.35, 0.35),
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
      cap
    );
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pos = Array.from({ length: cap }, () => new THREE.Vector3());
    this.vel = Array.from({ length: cap }, () => new THREE.Vector3());
    this.life = new Float32Array(cap);
    this.spin = new Float32Array(cap);
    this.dummy = new THREE.Object3D();
    this.dummy.scale.setScalar(0);
    for (let i = 0; i < cap; i++) {
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, new THREE.Color(1, 1, 1));
    }
    scene.add(this.mesh);
    this.color = new THREE.Color();
  }

  burst(center, n, hex) {
    this.color.setHex(hex);
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.cap;
      this.pos[i].copy(center);
      this.vel[i].set(rnd(-6, 6), rnd(5, 12), rnd(-6, 6));
      this.life[i] = rnd(1.6, 2.4);
      this.spin[i] = rnd(-10, 10);
      this.mesh.setColorAt(i, this.color);
    }
    this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    const d = this.dummy;
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] > 0) {
        const p = this.pos[i], v = this.vel[i];
        v.y -= 22 * dt;
        p.addScaledVector(v, dt);
        const g = this.world.groundAt(p.x, p.z) + 0.2;
        if (p.y < g) {
          p.y = g;
          v.y *= -0.35;
          v.x *= 0.6;
          v.z *= 0.6;
        }
        this.life[i] -= dt;
        d.position.copy(p);
        d.rotation.x += this.spin[i] * dt;
        d.rotation.z += this.spin[i] * dt * 0.7;
        d.scale.setScalar(this.life[i] < 0.4 ? Math.max(0, this.life[i] / 0.4) : 1);
      } else {
        d.position.set(0, -1000, 0);
        d.scale.setScalar(0);
      }
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class Effects {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.listener = null;
    this.shake = 0;
    this.q = 1;
    this.shakeVec = new THREE.Vector3();
    const tex = glowTexture();
    this.smoke = new ParticleSystem(scene, 900, false, tex);
    this.sparks = new ParticleSystem(scene, 1400, true, tex);
    this.debris = new Debris(scene, 120, world);
    this.flashes = [];
    for (let i = 0; i < 10; i++) {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat);
      mesh.visible = false;
      scene.add(mesh);
      this.flashes.push({ mesh, mat, age: 0, life: 0.3, size: 1 });
    }
    this.flashCursor = 0;
  }

  flash(pos, size, hex, life = 0.25) {
    const f = this.flashes[this.flashCursor];
    this.flashCursor = (this.flashCursor + 1) % this.flashes.length;
    f.mat.color.setHex(hex);
    f.mesh.position.copy(pos);
    f.mesh.visible = true;
    f.age = 0;
    f.life = life;
    f.size = size;
  }

  explosion(pos, size = 1) {
    const d = this.listener ? this.listener.distanceTo(pos) : 0;
    this.addShake(0.9 * size / (1 + d / 25));
    this.flash(pos, 4.5 * size, 0xffd08a, 0.35);
    this.flash(pos, 2.5 * size, 0xffffff, 0.2);
    for (let i = 0; i < Math.round(10 * this.q); i++) {
      this.smoke.emit(
        [pos.x + rnd(-1, 1) * size, pos.y + rnd(0, 1) * size, pos.z + rnd(-1, 1) * size],
        [rnd(-2, 2), rnd(2, 5), rnd(-2, 2)],
        [0.3, 0.3, 0.32], 0.8, 1.5 * size, 4.5 * size, rnd(1.6, 2.8), -1.5, 1.2
      );
    }
    for (let i = 0; i < Math.round(24 * this.q); i++) {
      const dir = [rnd(-1, 1), rnd(-0.3, 1), rnd(-1, 1)];
      const sp = rnd(5, 16) * Math.sqrt(size);
      this.sparks.emit(
        [pos.x, pos.y, pos.z],
        [dir[0] * sp, dir[1] * sp, dir[2] * sp],
        [1, rnd(0.5, 0.9), 0.2], 1, 0.3 * size, 0.05, rnd(0.4, 0.9), 12, 1.5
      );
    }
    this.debris.burst(pos, Math.round(4 * size + 2), 0x3a3530);
  }

  muzzle(pos, dir, hex) {
    const c = [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
    this.flash(pos, 1.2, hex, 0.08);
    for (let i = 0; i < 4; i++) {
      this.sparks.emit(
        [pos.x, pos.y, pos.z],
        [dir.x * rnd(3, 6), dir.y * rnd(3, 6), dir.z * rnd(3, 6)],
        c, 1, 0.35, 0.1, 0, 4, 
      );
    }
  }

  impact(pos, hex, size = 1) {
    const c = [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
    this.flash(pos, 1.5 * size, hex, 0.15);
    for (let i = 0; i < 12; i++) {
      this.sparks.emit(
        [pos.x, pos.y, pos.z],
        [rnd(-5, 5), rnd(2, 7), rnd(-5, 5)],
        c, 1, 0.25 * size, 0.04, rnd(0.3, 0.6), 14, 1
      );
    }
  }

  flame(pos, radius) {
    for (let i = 0; i < 2; i++) {
      this.sparks.emit(
        [pos.x + rnd(-radius, radius) * 0.6, pos.y + 0.3, pos.z + rnd(-radius, radius) * 0.6],
        [rnd(-0.5, 0.5), rnd(2, 4), rnd(-0.5, 0.5)],
        [1, rnd(0.35, 0.6), 0.1], 1, 1.4, 0.4, rnd(0.5, 0.8), -2, 0.8
      );
    }
  }

  puff(pos, size = 1) {
    this.smoke.emit(
      [pos.x, pos.y, pos.z],
      [rnd(-0.4, 0.4), rnd(0.5, 1.5), rnd(-0.4, 0.4)],
      [0.55, 0.55, 0.58], 0.5, 0.6 * size, 2.2 * size, rnd(0.7, 1.1), -1, 1
    );
  }

  dust(pos) {
    this.smoke.emit(
      [pos.x, pos.y + 0.2, pos.z],
      [rnd(-0.6, 0.6), rnd(0.3, 0.9), rnd(-0.6, 0.6)],
      [0.62, 0.55, 0.42], 0.5, 0.8, 2.4, rnd(0.6, 1.0), -0.5, 1.2
    );
  }

  addShake(v) {
    this.shake = clamp(this.shake + v, 0, 1.5);
  }

  update(dt) {
    this.smoke.update(dt);
    this.sparks.update(dt);
    this.debris.update(dt);
    for (const f of this.flashes) {
      if (!f.mesh.visible) continue;
      f.age += dt;
      if (f.age >= f.life) {
        f.mesh.visible = false;
        continue;
      }
      const k = f.age / f.life;
      f.mesh.scale.setScalar(f.size * (0.5 + k * 0.8));
      f.mat.opacity = 1 - k;
    }
    this.shake *= Math.exp(-6 * dt);
    const s = this.shake * 0.35;
    this.shakeVec.set(rnd(-s, s), rnd(-s, s), rnd(-s, s));
  }
}
