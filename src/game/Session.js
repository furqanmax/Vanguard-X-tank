import * as THREE from 'three';
import { World } from './World.js';
import { Vanguard } from '../vehicles/Vanguard.js';
import { Arsenal } from '../weapons/weapons.js';
import { Projectiles } from '../weapons/Projectiles.js';
import { Effects } from '../fx/Effects.js';
import { FireZones } from '../fx/FireZones.js';
import { Pickups, PICKUP_TYPES } from './Pickups.js';
import { generateTerrain } from '../levels/Heightfield.js';
import { Mission } from '../levels/Mission.js';
import { Enemy } from '../enemies/Enemy.js';
import { clamp, wrapAngle } from './math.js';
import { DIFFICULTIES } from './difficulty.js';
import { POWERUPS, SPECIAL } from './Powerups.js';
import { Spawner } from './Spawner.js';
import { QUALITY } from './quality.js';

const DROP_TABLE = [
  ['health', 0.35],
  ['ammo_erfpg', 0.25],
  ['ammo_mortar', 0.2],
  ['canister', 0.1],
  ['ammo_napalm', 0.1],
];

const _ndc = new THREE.Vector3();

export class Session {
  constructor(game, level, opts = {}) {
    this.game = game;
    this.level = level;
    this.versus = opts.mode === 'versus';
    this.multiplayer = null;
    this.respawnTimer = 0;
    this.renderer = game.renderer;
    this.scene = game.scene;
    this.camera = game.camera;
    this.input = game.input;
    this.hud = game.hud;
    this.minimap = game.minimap;
    this.settings = game.settings;
    this.difficulty = DIFFICULTIES[game.settings.difficulty] || DIFFICULTIES.normal;
    this.elapsed = 0;
    this.enemies = [];
    this.fpView = false;
    this.ended = false;
    this.deathTimer = 0;
    this.currentTarget = null;
    this.targetCam = new THREE.PerspectiveCamera(32, 1.4, 0.5, 900);

    const scene = this.scene;
    scene.background = new THREE.Color(0x9dcbe0);
    scene.fog = new THREE.Fog(0x9dcbe0, 170, 600);
    scene.add(new THREE.HemisphereLight(0xe8f4ff, 0x5b5034, 1.25));
    const sun = (this.sun = new THREE.DirectionalLight(0xfff0d2, 1.6));
    sun.position.set(-90, 160, 70);
    sun.castShadow = false;
    sun.shadow.camera.left = -120;
    sun.shadow.camera.right = 120;
    sun.shadow.camera.top = 120;
    sun.shadow.camera.bottom = -120;
    sun.shadow.camera.near = 20;
    sun.shadow.camera.far = 400;
    scene.add(sun, sun.target);

    const w = (this.world = new World(scene));
    w.effects = new Effects(scene, w);
    w.projectiles = new Projectiles(w);
    w.fireZones = new FireZones(w);
    w.pickups = new Pickups(w);
    w.hooks = {
      onEnemyKilled: (e) => {
        this.special = Math.min(SPECIAL.max, this.special + SPECIAL.perKill);
        this.handleEnemyKilled(e);
      },
      onDestructibleDestroyed: (d) => this.handleDestroyed(d),
      onPlayerHit: () => this.hud.hitConfirm(),
      onPlayerDeath: () => this.handlePlayerDeath(),
    };
    w.terrain = generateTerrain(level.terrain, scene);

    this.player = new Vanguard(scene, w, level.spawn);
    w.player = this.player;
    w.addTarget(this.player);
    this.player.onDamage = (amount) => this.hud.damageFlash(amount);
    w.effects.listener = this.player.pos;
    this.arsenal = new Arsenal(this);
    this.ctx = { player: this.player, effects: w.effects, projectiles: w.projectiles, fireZones: w.fireZones };

    this.refs = level.populate(this, { versus: this.versus });
    this.markShadows(this.scene);
    this.applyQuality(QUALITY[game.settings.quality] || QUALITY.high);
    this.mission = new Mission(this, this.refs, this.versus ? [] : level.objectives);
    this.spawner = this.versus ? null : new Spawner(this);
    this.special = 0;
    this.minimap.setTerrain(w.terrain);
  }

  start() {
    this.mission.start();
    this.hud.setLegend(this.game.touch ? [
      ['LEFT STICK', 'drive'],
      this.game.settings.aimStyle === 'drag'
        ? ['RIGHT PAD', 'drag to aim, hold to fire']
        : ['RIGHT STICK', 'push to aim, pull to fire'],
      ['ALT', 'alt weapon (mortar / napalm)'],
      ['SWAP', 'switch weapon'],
      ['EMP', 'special, when charged'],
      ['NANO', 'full armor repair'],
      ['?', 'show or hide this help'],
    ] : [
      ['WASD', 'drive'],
      ['MOUSE', 'aim (click the view)'],
      ['LMB', 'fire'],
      ['RMB', 'alt weapon'],
      ['Q / E / 1-3', 'switch weapon'],
      ['X', 'EMP special, when charged'],
      ['H', 'nano repair'],
      ['/', 'show or hide this help'],
    ]);
    if (this.versus) {
      this.respawnPlayer();
      this.hud.setMission(`VERSUS · ${this.level.name}`);
      this.hud.banner('FIGHT');
    } else {
      this.hud.setMission(`${this.level.name} · ${this.difficulty.label}`);
      this.hud.banner(this.level.name.toUpperCase());
    }
  }

  randomLandSpot() {
    const w = this.world;
    const reach = w.terrain.half * 0.75;
    for (let i = 0; i < 60; i++) {
      const x = (Math.random() * 2 - 1) * reach, z = (Math.random() * 2 - 1) * reach;
      if (w.groundAt(x, z) >= 2.2 && w.canOccupy(x, z, 2.5)) return { x, z };
    }
    return { x: 0, z: -w.terrain.half * 0.6 };
  }

  respawnPlayer() {
    const p = this.player, spot = this.randomLandSpot();
    p.pos.set(spot.x, this.world.groundAt(spot.x, spot.z), spot.z);
    p.heading = Math.random() * Math.PI * 2;
    p.turretYaw = p.heading;
    p.speed = 0;
    p.vel.set(0, 0, 0);
    p.health = p.maxHealth;
    p.alive = true;
    p.lastHitBy = null;
    p.powerups.overdrive = 0;
    p.powerups.aegis = 0;
    this.hud.message('Vanguard X redeployed', 'good');
  }

  endVersus(rows, myId) {
    if (this.ended) return;
    this.ended = true;
    this.game.onVersusEnd(rows, myId);
  }

  markShadows(root) {
    root.traverse((o) => {
      if (o.isMesh && !o.isPoints && !o.isInstancedMesh && !o.userData.noShadow) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }

  applyQuality(q) {
    this.effectsQuality = q.effects;
    this.world.effects.q = q.effects;
    this.sun.castShadow = q.shadows;
    this.sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
    if (this.scene.fog) {
      this.scene.fog.near = q.fog[0];
      this.scene.fog.far = q.fog[1];
    }
  }

  spawnEnemy(typeId, x, z) {
    const e = new Enemy(typeId, x, z, this.world, this.difficulty);
    this.markShadows(e.group);
    this.enemies.push(e);
    this.world.addTarget(e);
    return e;
  }

  update(dt) {
    if (this.ended) return;
    this.elapsed += dt;
    const p = this.player, inp = this.input, w = this.world;

    this.handleKeys();
    if (inp.aimActive && (inp.dx || inp.dy)) {
      p.mouseAim(inp.dx, inp.dy, this.settings.sensitivity, this.settings.invertY);
    }
    for (const k of Object.keys(p.powerups)) p.powerups[k] = Math.max(0, p.powerups[k] - dt);
    if (inp.stick) p.stickAim(inp.stick.x, inp.stick.y, dt);
    p.update(dt, inp, w);
    p.computeAim(w);
    const onTarget = this.settings.autoFire && p.alive && p.aim.dist <= 260 && !!this.findAimTarget();
    if (inp.mouse.left || onTarget) this.arsenal.fire('primary');
    if (inp.mouse.right) this.arsenal.fire('advanced');
    this.arsenal.update(dt);

    for (const e of this.enemies) e.update(dt, this.ctx);
    this.enemies = this.enemies.filter((e) => !e.removed);

    w.projectiles.update(dt);
    w.fireZones.update(dt);
    w.pickups.update(dt, p, (type) => this.collectPickup(type));
    w.effects.update(dt);
    this.mission.update(dt);
    this.spawner?.update(dt, this.elapsed);
    this.multiplayer?.update(dt);

    if (!p.alive && this.versus) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.respawnPlayer();
    }

    this.sun.position.set(p.pos.x - 90, p.pos.y + 160, p.pos.z + 70);
    this.sun.target.position.set(p.pos.x, p.pos.y, p.pos.z);
    this.sun.target.updateMatrixWorld();
    if (Math.abs(p.speed) > 4) {
      this.dustTimer = (this.dustTimer || 0) - dt;
      if (this.dustTimer <= 0) {
        this.dustTimer = 0.16;
        w.effects.dust(p.pos.clone().addScaledVector(new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading)), -3));
      }
    }

    p.updateCamera(this.camera, dt, this.fpView, w.effects.shakeVec, this.settings.cameraMode);
    this.updateHud(dt);

    if (!p.alive && !this.versus) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) this.fail('Your Vanguard X was destroyed.');
    }
  }

  handleKeys() {
    const inp = this.input, p = this.player, hud = this.hud;
    if (inp.wasPressed('Digit1')) this.arsenal.select(1);
    if (inp.wasPressed('Digit2')) this.arsenal.select(2);
    if (inp.wasPressed('Digit3')) this.arsenal.select(3);
    if (inp.wasPressed('KeyV')) this.fpView = !this.fpView;
    if (inp.wasPressed('KeyC')) p.centeringTurret = true;
    if (inp.wasPressed('Backslash')) p.aligningHull = true;
    if (inp.wasPressed('KeyH')) this.useNano();
    if (inp.wasPressed('F5')) hud.toggleHud();
    if (inp.wasPressed('F6')) hud.toggleCockpit();
    if (inp.wasPressed('KeyM')) this.minimap.toggleTactical();
    if (inp.wasPressed('KeyO')) hud.toggleObjectives();
    if (inp.wasPressed('KeyR')) hud.toggleBriefing(this.level.briefing);
    if (inp.wasPressed('KeyE') || inp.wheel > 0) this.arsenal.cycle(1);
    if (inp.wasPressed('KeyQ') || inp.wheel < 0) this.arsenal.cycle(-1);
    if (inp.wasPressed('KeyX')) this.useSpecial();
    if (inp.wasPressed('Slash')) hud.toggleLegend();
  }

  useSpecial() {
    if (this.special < SPECIAL.max) {
      this.hud.message(`Special ${Math.floor(this.special)}% charged`, 'warn');
      return;
    }
    this.special = 0;
    const c = this.player.pos;
    for (const e of this.enemies) {
      if (e.alive && Math.hypot(e.pos.x - c.x, e.pos.z - c.z) < SPECIAL.emp.radius) e.stunTimer = SPECIAL.emp.stun;
    }
    this.world.effects.flash(c, 40, 0x6ef7ff, 0.6);
    this.world.effects.addShake(1.2);
    this.hud.banner('EMP PULSE');
  }

  findAimTarget() {
    const ap = this.player.aim.point;
    let best = null, bestD = 7;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.pos.x - ap.x, e.pos.z - ap.z);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  screenPoint(point) {
    this.camera.updateMatrixWorld();
    _ndc.copy(point).project(this.camera);
    const W = window.innerWidth, H = window.innerHeight;
    if (_ndc.z > 1) return { x: W / 2, y: H / 2 };
    return {
      x: clamp((_ndc.x * 0.5 + 0.5) * W, 40, W - 40),
      y: clamp((-_ndc.y * 0.5 + 0.5) * H, 40, H - 40),
    };
  }

  updateHud(dt) {
    const p = this.player, hud = this.hud, stats = this.world.stats;
    hud.update(dt);
    hud.setVitals(p.health, p.maxHealth, p.nano, p.maxNano, Math.abs(p.speed) * 3.6);
    hud.setWeapons(this.arsenal.slotStates());
    hud.setScore(stats.score, this.elapsed);
    hud.setPowers(p.powerups, this.special, SPECIAL.max);

    const target = this.findAimTarget();
    this.currentTarget = target;
    hud.setTarget(target);
    const state = target ? 'target' : p.aim.dist <= 260 ? 'ready' : 'idle';
    const sp = this.screenPoint(p.aim.point);
    hud.setReticle(sp.x, sp.y, state);

    const m = this.mission.activeTarget();
    if (m) {
      const dx = m.x - p.pos.x, dz = m.z - p.pos.z;
      const bearing = Math.atan2(dx, dz);
      hud.setCompass(wrapAngle(bearing - p.heading), Math.hypot(dx, dz));
    } else {
      hud.setCompass(null);
    }

    const markers = this.versus ? [] : [
      { x: this.refs.pylon.pos.x, z: this.refs.pylon.pos.z, active: this.mission.current === 'pylon' },
      { x: this.refs.core.pos.x, z: this.refs.core.pos.z, active: this.mission.current === 'core' },
      { x: this.refs.silosCenter.x, z: this.refs.silosCenter.z, active: this.mission.current === 'silos' },
      { x: this.refs.pad.x, z: this.refs.pad.z, active: this.mission.current === 'extract' },
    ];
    if (this.multiplayer) hud.setScoreboard(this.input.isDown('Tab') ? this.multiplayer.rows() : null, this.multiplayer.myId);
    this.minimap.update({
      x: p.pos.x,
      z: p.pos.z,
      heading: p.heading,
      enemies: this.enemies.filter((e) => e.alive),
      pickups: this.world.pickups.list.filter((q) => q.discovered),
      markers,
    });
  }

  positionTargetCam(aspect) {
    const t = this.currentTarget, p = this.player, tc = this.targetCam;
    let dx = p.pos.x - t.pos.x, dz = p.pos.z - t.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    tc.aspect = aspect;
    tc.updateProjectionMatrix();
    tc.position.set(t.pos.x + dx * 12, t.pos.y + 5, t.pos.z + dz * 12);
    tc.lookAt(t.pos.x, t.pos.y + 1.2, t.pos.z);
  }

  render() {
    const r = this.renderer;
    const W = window.innerWidth, H = window.innerHeight;
    r.setScissorTest(false);
    r.setViewport(0, 0, W, H);
    r.render(this.scene, this.camera);

    const vp = this.currentTarget ? this.hud.targetViewport(H) : null;
    if (vp && vp.w > 0 && vp.h > 0) {
      this.positionTargetCam(vp.w / vp.h);
      r.setViewport(vp.x, vp.y, vp.w, vp.h);
      r.setScissor(vp.x, vp.y, vp.w, vp.h);
      r.setScissorTest(true);
      r.render(this.scene, this.targetCam);
      r.setScissorTest(false);
      r.setViewport(0, 0, W, H);
    }
  }

  handleEnemyKilled(e) {
    this.hud.message(`${e.def.name} destroyed`, 'kill');
    if (Math.random() >= e.def.drop) return;
    let roll = Math.random(), acc = 0;
    let type = DROP_TABLE[0][0];
    for (const [t, weight] of DROP_TABLE) {
      acc += weight;
      if (roll < acc) {
        type = t;
        break;
      }
    }
    this.world.pickups.spawn(type, e.pos.x, e.pos.z);
  }

  handleDestroyed(d) {
    this.hud.message(`${d.label} destroyed`, 'kill');
    if (d.id === 'pylon') this.dropBarrier();
    this.mission.onDestroyed(d);
  }

  dropBarrier() {
    const b = this.refs.barrier;
    if (!b || b.down) return;
    b.down = true;
    this.world.removeSolid(b.solid);
    this.scene.remove(b.group);
    this.world.effects.flash(b.solid.pos, 20, 0x6ef7ff, 0.6);
    this.hud.message('Shield field collapsed', 'good');
  }

  handlePlayerDeath() {
    this.deathTimer = 2.2;
    const at = this.player.pos.clone();
    at.y += 1.5;
    this.world.effects.explosion(at, 2.2);
    if (this.versus) {
      this.respawnTimer = 3;
      this.multiplayer?.onLocalDeath(this.player.lastHitBy ?? this.multiplayer.myId);
      this.hud.message('Vanguard X lost — redeploying', 'warn');
      return;
    }
    this.hud.message('Vanguard X lost', 'warn');
  }

  collectPickup(type) {
    const info = PICKUP_TYPES[type], p = this.player, ar = this.arsenal;
    switch (type) {
      case 'ammo_erfpg': ar.addAmmo('erfpg', 100); break;
      case 'ammo_mortar': ar.addAmmo('mortar', 8); break;
      case 'ammo_napalm': ar.addAmmo('napalm', 4); break;
      case 'health': p.health = Math.min(p.maxHealth, p.health + 35); break;
      case 'canister': p.nano = Math.min(p.maxNano, p.nano + 1); break;
    }
    switch (type) {
      case 'overdrive': p.powerups.overdrive = POWERUPS.overdrive.duration; break;
      case 'aegis': p.powerups.aegis = POWERUPS.aegis.duration; break;
      case 'special': this.special = Math.min(SPECIAL.max, this.special + SPECIAL.pickup); break;
    }
    this.world.stats.pickups++;
    this.hud.message(`+ ${info.label}`, 'pickup');
  }

  useNano() {
    const p = this.player;
    if (p.nano <= 0) {
      this.hud.message('No nano-canisters', 'warn');
      return;
    }
    if (p.health >= p.maxHealth) return;
    p.nano--;
    p.health = p.maxHealth;
    this.hud.message('Nano-canister used: armor fully restored', 'good');
  }

  fail(reason) {
    if (this.ended) return;
    this.ended = true;
    this.game.onMissionFailed(reason);
  }

  complete() {
    if (this.ended) return;
    const s = this.world.stats;
    const timeBonus = Math.max(0, Math.round((900 - this.elapsed) * 2));
    this.ended = true;
    this.game.onMissionComplete({
      time: this.elapsed,
      enemies: s.enemiesDestroyed,
      objects: s.objectsDestroyed,
      accuracy: Math.min(100, Math.round((s.shotsHit / Math.max(1, s.shotsFired)) * 100)),
      pickups: s.pickups,
      score: s.score + timeBonus,
    });
  }

  dispose() {
    this.ended = true;
    this.multiplayer?.dispose();
    this.multiplayer = null;
    this.world.clear();
    this.minimap.clear();
  }
}
