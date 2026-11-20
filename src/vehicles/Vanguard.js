import * as THREE from 'three';
import { approach, clamp, damp, wrapAngle } from '../game/math.js';

const MAX_SPEED = 22.2;
const MAX_REVERSE = 9;
const ACCEL = 15;
const BRAKE = 24;
const COAST = 6;
const THROTTLE_SMOOTH = 7;
const STEER_SMOOTH = 9;
const TURN_RATE = 1.7;
const CENTER_RATE = 3.2;
const ALIGN_RATE = 1.6;
const PITCH_MIN = -0.12;
const PITCH_MAX = 0.9;
const AIM_RATE = 0.0024;
const TREAD_LINKS = 12;
const TREAD_LEN = 5.6;

const _dir = new THREE.Vector3();
const _v = new THREE.Vector3();
const _t = new THREE.Vector3();

const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.25 });

export class Vanguard {
  constructor(scene, world, spawn) {
    this.world = world;
    this.team = 'player';
    this.radius = 2.2;
    this.height = 2.6;
    this.alive = true;
    this.pos = new THREE.Vector3(spawn.x, world.groundAt(spawn.x, spawn.z), spawn.z);
    this.vel = new THREE.Vector3();
    this.heading = spawn.heading ?? 0;
    this.turretYaw = this.heading;
    this.barrelPitch = 0.06;
    this.speed = 0;
    this.pitch = 0;
    this.roll = 0;
    this.treadPhase = 0;
    this.health = 180;
    this.maxHealth = 180;
    this.throttleIn = 0;
    this.steerIn = 0;
    this.nano = 0;
    this.maxNano = 3;
    this.powerups = { overdrive: 0, aegis: 0 };
    this.centeringTurret = false;
    this.aligningHull = false;
    this.onDamage = null;
    this.aim = { muzzle: new THREE.Vector3(), point: new THREE.Vector3(), dist: 0, hit: false };
    this.camPos = new THREE.Vector3();
    this.camHeading = this.heading;
    this.camReady = false;

    this.root = new THREE.Group();
    scene.add(this.root);
    this.hull = new THREE.Group();
    this.root.add(this.hull);
    this.treadLinks = [];
    this.buildModel();
  }

  buildModel() {
    const hullMat = mat(0x58663c), darkMat = mat(0x262a27), linkMat = mat(0x3b3f35), trimMat = mat(0xb9a35a);
    const camoDark = mat(0x3a4628), camoLight = mat(0x8a8456);
    const add = (parent, geo, m, x, y, z) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    };

    add(this.hull, new THREE.BoxGeometry(3.0, 0.9, 5.0), hullMat, 0, 1.0, 0);
    add(this.hull, new THREE.BoxGeometry(1.1, 0.03, 1.4), camoDark, -0.7, 1.47, 0.9);
    add(this.hull, new THREE.BoxGeometry(0.9, 0.03, 1.0), camoLight, 0.8, 1.47, -1.2);
    add(this.hull, new THREE.BoxGeometry(0.8, 0.03, 0.7), camoDark, 0.6, 1.47, 1.6);
    const nose = add(this.hull, new THREE.BoxGeometry(2.6, 0.5, 1.8), hullMat, 0, 0.92, 3.2);
    nose.rotation.x = 0.4;

    for (const side of [-1, 1]) {
      add(this.hull, new THREE.BoxGeometry(0.9, 1.1, TREAD_LEN), darkMat, side * 1.95, 0.55, 0);
      add(this.hull, new THREE.BoxGeometry(0.3, 0.4, TREAD_LEN + 0.4), trimMat, side * 1.6, 1.0, 0);
      for (let i = 0; i < TREAD_LINKS; i++) {
        const link = add(this.hull, new THREE.BoxGeometry(0.18, 0.16, 0.5), linkMat, side * 2.42, 0.55, 0);
        this.treadLinks.push({ mesh: link, base: i * (TREAD_LEN / TREAD_LINKS) });
      }
    }

    this.turretPivot = new THREE.Group();
    this.turretPivot.position.set(0, 1.5, 0);
    this.hull.add(this.turretPivot);
    add(this.turretPivot, new THREE.CylinderGeometry(1.35, 1.5, 0.5, 14), darkMat, 0, 0.25, 0);
    add(this.turretPivot, new THREE.BoxGeometry(2.1, 0.8, 2.6), hullMat, 0, 0.85, -0.2);
    add(this.turretPivot, new THREE.BoxGeometry(0.9, 0.03, 0.8), camoLight, -0.4, 1.26, -0.6);
    add(this.turretPivot, new THREE.CylinderGeometry(0.45, 0.45, 0.2, 10), darkMat, 0, 1.3, -0.4);
    add(this.turretPivot, new THREE.CylinderGeometry(0.34, 0.34, 1.6, 8), darkMat, 0.6, 1.2, -0.5);

    this.barrelPivot = new THREE.Group();
    this.barrelPivot.position.set(0, 0.95, 0.9);
    this.turretPivot.add(this.barrelPivot);
    const barrel = add(this.barrelPivot, new THREE.CylinderGeometry(0.16, 0.22, 3.6, 8), darkMat, 0, 0, 1.8);
    barrel.rotation.x = Math.PI / 2;
    this.muzzleRef = new THREE.Object3D();
    this.muzzleRef.position.set(0, 0, 3.7);
    this.barrelPivot.add(this.muzzleRef);
  }

  mouseAim(dx, dy, sensitivity, invertY) {
    if (dx || dy) this.centeringTurret = false;
    this.turretYaw = wrapAngle(this.turretYaw - dx * AIM_RATE * sensitivity);
    const sign = invertY ? -1 : 1;
    this.barrelPitch = clamp(this.barrelPitch - dy * AIM_RATE * sensitivity * sign, PITCH_MIN, PITCH_MAX);
  }

  update(dt, input, world) {
    if (!this.alive) return;
    const keyThrottle = (input.isDown('KeyW') || input.isDown('ArrowUp') ? 1 : 0) - (input.isDown('KeyS') || input.isDown('ArrowDown') ? 1 : 0);
    const keySteer = (input.isDown('KeyA') || input.isDown('ArrowLeft') ? 1 : 0) - (input.isDown('KeyD') || input.isDown('ArrowRight') ? 1 : 0);
    const throttleTarget = input.drive ? input.drive.throttle : keyThrottle;
    const steerTarget = input.drive ? input.drive.steer : keySteer;
    this.throttleIn = approach(this.throttleIn, throttleTarget, THROTTLE_SMOOTH * dt);
    this.steerIn = approach(this.steerIn, steerTarget, STEER_SMOOTH * dt);

    if (this.throttleIn > 0.02) this.speed = approach(this.speed, MAX_SPEED * this.throttleIn, ACCEL * dt);
    else if (this.throttleIn < -0.02) this.speed = approach(this.speed, -MAX_REVERSE * -this.throttleIn, (this.speed > 0 ? BRAKE : ACCEL * 0.6) * dt);
    else this.speed = approach(this.speed, 0, COAST * dt);

    const turn = this.steerIn;
    if (turn !== 0) {
      const f = clamp(Math.abs(this.speed) / MAX_SPEED, 0, 1);
      const rate = TURN_RATE * (0.7 + 0.3 * f);
      const dir = Math.abs(this.speed) > 0.5 ? Math.sign(this.speed) : 1;
      this.heading = wrapAngle(this.heading + turn * rate * dir * dt);
    }

    if (this.centeringTurret) {
      const d = wrapAngle(this.heading - this.turretYaw);
      const step = CENTER_RATE * dt;
      if (Math.abs(d) <= step) {
        this.turretYaw = this.heading;
        this.centeringTurret = false;
      } else {
        this.turretYaw = wrapAngle(this.turretYaw + Math.sign(d) * step);
      }
    }
    if (this.aligningHull) {
      const d = wrapAngle(this.turretYaw - this.heading);
      const step = ALIGN_RATE * dt;
      if (Math.abs(d) <= step) {
        this.heading = this.turretYaw;
        this.aligningHull = false;
      } else {
        this.heading = wrapAngle(this.heading + Math.sign(d) * step);
      }
    }

    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const grip = Math.abs(this.speed) < 0.5 ? 12 : 3.5;
    const k = damp(dt, grip);
    this.vel.x += (fx * this.speed - this.vel.x) * k;
    this.vel.z += (fz * this.speed - this.vel.z) * k;
    const moved = world.move(this.pos, this.vel.x * dt, this.vel.z * dt, this.radius);
    if (!moved) {
      this.vel.multiplyScalar(0.4);
      this.speed *= 0.6;
    }
    this.pos.y = world.groundAt(this.pos.x, this.pos.z);

    const hf = world.groundAt(this.pos.x + fx * 2.4, this.pos.z + fz * 2.4);
    const hb = world.groundAt(this.pos.x - fx * 2.4, this.pos.z - fz * 2.4);
    const hr = world.groundAt(this.pos.x - fz * 1.6, this.pos.z + fx * 1.6);
    const hl = world.groundAt(this.pos.x + fz * 1.6, this.pos.z - fx * 1.6);
    this.pitch += (Math.atan2(hf - hb, 4.8) - this.pitch) * damp(dt, 10);
    this.roll += (Math.atan2(hr - hl, 3.2) - this.roll) * damp(dt, 10);

    this.treadPhase += this.speed * dt;
    for (const link of this.treadLinks) {
      const L = TREAD_LEN;
      let z = ((link.base + this.treadPhase) % L + L) % L - L / 2;
      link.mesh.position.z = z;
    }

    this.syncVisual();
  }

  syncVisual() {
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.heading;
    this.hull.rotation.set(-this.pitch, 0, -this.roll);
    this.turretPivot.rotation.y = wrapAngle(this.turretYaw - this.heading);
    this.barrelPivot.rotation.x = -this.barrelPitch;
  }

  stickAim(x, y, dt) {
    this.centeringTurret = false;
    this.turretYaw = wrapAngle(this.turretYaw - x * 3.2 * dt);
    this.barrelPitch = clamp(this.barrelPitch - y * 1.4 * dt, PITCH_MIN, PITCH_MAX);
  }

  computeAim(world) {
    this.root.updateMatrixWorld(true);
    this.muzzleRef.getWorldPosition(this.aim.muzzle);
    const cp = Math.cos(this.barrelPitch);
    _dir.set(Math.sin(this.turretYaw) * cp, Math.sin(this.barrelPitch), Math.cos(this.turretYaw) * cp);
    const r = world.raycastGround(this.aim.muzzle, _dir, 320);
    let dist = r.dist;
    let hit = r.hit;
    this.aim.point.copy(r.point);
    for (const t of world.targets) {
      if (!t.alive || t.team === 'player') continue;
      const c = new THREE.Vector3(t.pos.x, t.pos.y + t.height * 0.5, t.pos.z);
      const along = c.clone().sub(this.aim.muzzle).dot(_dir);
      if (along <= 0 || along >= dist) continue;
      const closest = this.aim.muzzle.clone().addScaledVector(_dir, along);
      if (closest.distanceTo(c) < t.radius + 0.6) {
        dist = along;
        hit = true;
        this.aim.point.copy(closest);
      }
    }
    this.aim.dist = dist;
    this.aim.hit = hit;
  }

  takeDamage(amount) {
    if (!this.alive) return false;
    const scaled = amount * (this.powerups.aegis > 0 ? 0.5 : 1);
    this.health = Math.max(0, this.health - scaled);
    this.onDamage?.(amount);
    if (this.health <= 0) {
      this.alive = false;
      this.speed = 0;
      this.world.hooks.onPlayerDeath?.();
      return true;
    }
    return false;
  }

  updateCamera(camera, dt, fpView, shake) {
    if (fpView) {
      this.root.visible = false;
      this.turretPivot.getWorldPosition(_v);
      _v.y += 0.6;
      camera.position.copy(_v).add(shake);
      _t.copy(this.aim.point).add(shake);
      camera.lookAt(_t);
    } else {
      this.root.visible = true;
      this.camHeading = wrapAngle(this.camHeading + wrapAngle(this.turretYaw - this.camHeading) * damp(dt, 12));
      const fx = Math.sin(this.camHeading), fz = Math.cos(this.camHeading);
      const tx = this.pos.x - fx * 11, ty = this.pos.y + 5.5, tz = this.pos.z - fz * 11;
      if (!this.camReady) {
        this.camPos.set(tx, ty, tz);
        this.camReady = true;
      }
      const k = damp(dt, 8);
      this.camPos.x += (tx - this.camPos.x) * k;
      this.camPos.y += (ty - this.camPos.y) * k;
      this.camPos.z += (tz - this.camPos.z) * k;
      camera.position.copy(this.camPos).add(shake);
      camera.lookAt(this.pos.x + fx * 8, this.pos.y + 1.8, this.pos.z + fz * 8);
    }
    camera.updateMatrixWorld();
  }
}
