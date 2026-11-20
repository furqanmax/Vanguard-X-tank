import * as THREE from 'three';
import { mulberry32 } from '../game/noise.js';
import { LAND_MIN } from '../game/World.js';
import { Destructible, addStatic, buildPalm, buildRock, buildCrate, buildBarrel, buildHut,
  buildPylon, buildBunker, buildSilo, buildBarrier, buildPad, buildVtol } from './props.js';

// The layout was authored for a 300 m island. MAP_SCALE stretches it to the
// current 500 m island, so every site, prop, and spawn keeps its relative place.
export const MAP_SIZE = 500;
export const ISLAND_RADIUS = 230;
const MAP_SCALE = MAP_SIZE / 300;
const k = (v) => v * MAP_SCALE;
const kp = ([x, z]) => [k(x), k(z)];

const RAW_SITES = {
  spawn: { x: 0, z: -110, r: 16, h: 3 },
  pylon: { x: -62, z: -14, r: 12, h: 8 },
  base: { x: -28, z: 12, r: 34, h: 7 },
  silos: { x: 50, z: 36, r: 30, h: 12 },
  pad: { x: 98, z: -56, r: 14, h: 10 },
};
const SITES = Object.fromEntries(Object.entries(RAW_SITES).map(([n, s]) => [n, { x: k(s.x), z: k(s.z), r: k(s.r), h: s.h }]));

const SILO_POINTS = [[40, 30], [60, 30], [50, 48]].map(kp);
const BARRIER_RADIUS = k(24);
const GRID = { palm: 24, palmChance: 0.22, rock: 40, rockChance: 0.35, extent: ISLAND_RADIUS - 20 };

const ENEMY_GROUPS = [
  ['scout', -20, -92], ['scout', -26, -86],
  ['raider', -48, -40], ['scout', -40, -28],
  ['bombard', -72, -2], ['scout', -58, -26], ['scout', -60, -30],
  ['walker', -40, 6], ['gantry', -14, 28],
  ['gantry', 30, 46], ['bombard', 68, 58], ['walker', 72, 24],
  ['raider', 40, 66], ['raider', 78, 44], ['scout', 84, 62],
  ['raider', 116, -40], ['scout', 110, -64],
  ['scout', -120, 70], ['raider', 150, 10], ['bombard', -150, -90], ['scout', 170, -120],
  ['raider', -180, 120], ['walker', 120, 150], ['gantry', 185, 60],
].map(([t, x, z]) => [t, k(x), k(z)]);

const PICKUPS = [
  ['ammo_erfpg', -96, -54], ['health', 40, -86], ['canister', -18, 56],
  ['ammo_mortar', 14, -24], ['ammo_napalm', 84, 22], ['health', -92, 22],
  ['ammo_mortar', 62, 80], ['canister', 120, -12], ['ammo_erfpg', -40, 60],
  ['health', 150, -130], ['ammo_napalm', -150, 110], ['ammo_mortar', 180, 90],
].map(([t, x, z]) => [t, k(x), k(z)]);

const CRATES = [[-70, -22], [-56, -26], [-68, -4], [38, 44], [62, 44], [52, 22], [-34, -44], [-38, -48], [-30, -50]].map(kp);
const BARRELS = [[-30, -34], [-46, -18], [10, -66], [-84, 40], [72, -10], [30, -60]].map(kp);
const HUTS = [[-50, 26], [-8, -16], [-44, -30]].map(kp);

function findLand(world, x, z) {
  for (let r = 0; r <= 24; r += 3) {
    for (let a = 0; a < 8; a++) {
      const px = x + Math.cos((a / 8) * Math.PI * 2) * r;
      const pz = z + Math.sin((a / 8) * Math.PI * 2) * r;
      if (world.groundAt(px, pz) >= LAND_MIN + 0.8 && world.canOccupy(px, pz, 2.5)) return { x: px, z: pz };
    }
  }
  return { x, z };
}

function nearSite(x, z, margin) {
  return Object.values(SITES).some((s) => Math.hypot(x - s.x, z - s.z) < s.r + margin);
}

// Props are placed on a fixed grid, one optional prop per cell, with jitter kept
// inside the cell. Neighboring cells therefore can never overlap or cluster.
function scatterOnGrid(world, rng, cell, chance, jitter, build, radius, height, extent, onPlace) {
  const cells = Math.floor((extent * 2) / cell);
  for (let gi = 0; gi < cells; gi++) {
    for (let gj = 0; gj < cells; gj++) {
      if (rng() > chance) continue;
      const cx = -extent + (gi + 0.5) * cell;
      const cz = -extent + (gj + 0.5) * cell;
      const x = cx + (rng() * 2 - 1) * jitter;
      const z = cz + (rng() * 2 - 1) * jitter;
      if (Math.hypot(x, z) > extent) continue;
      if (nearSite(x, z, 4) || Math.hypot(x, z - SITES.spawn.z) < 14) continue;
      if (world.groundAt(x, z) < 2.2 || !world.canOccupy(x, z, radius)) continue;
      const scale = onPlace ? onPlace(rng) : 1;
      addStatic(world, build(scale), x, z, radius * scale, height * scale);
    }
  }
}

function populateObjectives(session, refs) {
  const { world, scene } = session;
  const base = SITES.base;
  const barrierPos = new THREE.Vector3(base.x, world.groundAt(base.x, base.z), base.z);
  const barrierSolid = { pos: barrierPos, radius: BARRIER_RADIUS, height: 0, blocksShots: false };
  world.addSolid(barrierSolid);
  const barrierGroup = buildBarrier(BARRIER_RADIUS, 14);
  barrierGroup.position.copy(barrierPos);
  scene.add(barrierGroup);
  refs.barrier = { solid: barrierSolid, group: barrierGroup };

  const pyl = SITES.pylon;
  refs.pylon = new Destructible(world, {
    id: 'pylon', label: 'Shield pylon', x: pyl.x, z: pyl.z, hp: 260, radius: 2.2, height: 15, score: 800, group: buildPylon(),
  });
  refs.core = new Destructible(world, {
    id: 'core', label: 'Command core', x: base.x, z: base.z, hp: 600, radius: 5, height: 6, score: 1000, group: buildBunker(),
  });

  refs.silos = SILO_POINTS.map(([x, z], i) => {
    const p = findLand(world, x, z);
    return new Destructible(world, {
      id: `silo${i}`, label: 'Launch silo', x: p.x, z: p.z, hp: 380, radius: 3, height: 10, score: 900, group: buildSilo(),
    });
  });
  refs.silosCenter = {
    x: SILO_POINTS.reduce((s, p) => s + p[0], 0) / SILO_POINTS.length,
    z: SILO_POINTS.reduce((s, p) => s + p[1], 0) / SILO_POINTS.length,
  };

  const padPos = SITES.pad;
  const pad = buildPad();
  pad.position.set(padPos.x, world.groundAt(padPos.x, padPos.z), padPos.z);
  scene.add(pad);
  const vtol = buildVtol();
  vtol.position.set(padPos.x, 14, padPos.z);
  scene.add(vtol);
  refs.vtol = vtol;
  refs.pad = { x: padPos.x, z: padPos.z };
}

function populateLevel1(session, opts = {}) {
  const { world } = session;
  const rng = mulberry32(4242);
  const refs = {};

  if (!opts.versus) populateObjectives(session, refs);

  scatterOnGrid(world, rng, GRID.palm, GRID.palmChance, 6, () => buildPalm(), 0.9, 7.5, GRID.extent);
  scatterOnGrid(world, rng, GRID.rock, GRID.rockChance, 8, (s) => buildRock(s), 2.2, 2.5, GRID.extent,
    (r) => 0.8 + r() * 1.0);

  for (const [x, z] of HUTS) {
    const p = findLand(world, x, z);
    addStatic(world, buildHut(), p.x, p.z, 3.2, 4.5);
  }

  for (const [x, z] of CRATES) {
    const p = findLand(world, x, z);
    new Destructible(world, { id: 'crate', label: 'Supply crate', x: p.x, z: p.z, hp: 12, radius: 1.4, height: 2, score: 25, group: buildCrate() });
  }
  for (const [x, z] of BARRELS) {
    const p = findLand(world, x, z);
    new Destructible(world, {
      id: 'barrel', label: 'Fuel barrel', x: p.x, z: p.z, hp: 8, radius: 0.9, height: 1.8, score: 30,
      explodes: { radius: 5, damage: 45 }, group: buildBarrel(),
    });
  }

  refs.silosZone = k(42);
  if (!opts.versus) {
    for (const [type, x, z] of ENEMY_GROUPS) {
      const p = findLand(world, x, z);
      session.spawnEnemy(type, p.x, p.z);
    }
  }
  for (const [type, x, z] of PICKUPS) {
    const p = findLand(world, x, z);
    world.pickups.spawn(type, p.x, p.z);
  }
  return refs;
}

export const LEVEL_1 = {
  id: 'level1',
  name: 'Saltreach Atoll',
  briefing:
    'Meridian Front scouts report a Hive Directorate shield pylon guarding a command bunker on Saltreach Atoll. ' +
    'Disable the pylon, breach the bunker, then destroy the three launch silos before the rockets fly. ' +
    'A VTOL will extract you from the pad on the eastern plateau once the silos are down.',
  seed: 4242,
  terrain: {
    size: MAP_SIZE,
    segments: 250,
    seed: 4242,
    islandRadius: ISLAND_RADIUS,
    sites: Object.values(SITES),
  },
  spawn: { x: SITES.spawn.x, z: SITES.spawn.z, heading: 0 },
  objectives: ['pylon', 'core', 'silos', 'extract'],
  populate: populateLevel1,
};
