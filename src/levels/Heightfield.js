import * as THREE from 'three';
import { createValueNoise } from '../game/noise.js';
import { clamp, lerp, smoothstep } from '../game/math.js';

export const WATER_LEVEL = 0;

export class Heightfield {
  constructor(size, segments, heights) {
    this.size = size;
    this.segments = segments;
    this.n = segments + 1;
    this.half = size / 2;
    this.cell = size / segments;
    this.heights = heights;
  }

  sample(x, z) {
    const fx = clamp((x + this.half) / this.cell, 0, this.segments - 1e-4);
    const fz = clamp((z + this.half) / this.cell, 0, this.segments - 1e-4);
    const ix = Math.floor(fx), iz = Math.floor(fz);
    const tx = fx - ix, tz = fz - iz;
    const i = iz * this.n + ix, n = this.n, h = this.heights;
    return lerp(lerp(h[i], h[i + 1], tx), lerp(h[i + n], h[i + n + 1], tx), tz);
  }
}

const MIX = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const SAND = [0.86, 0.78, 0.52];
const GRASS = [0.33, 0.58, 0.28];
const JUNGLE = [0.18, 0.36, 0.2];
const ROCK = [0.42, 0.38, 0.34];
const SEABED = [0.12, 0.24, 0.3];

export function terrainRGB(h, ny = 1) {
  if (h < -0.4) return SEABED;
  let c = h < 1.6 ? MIX(SAND, GRASS, smoothstep(0.4, 1.6, h)) : MIX(GRASS, JUNGLE, smoothstep(9, 18, h));
  if (ny < 0.8) c = MIX(c, ROCK, smoothstep(0.8, 0.6, ny));
  return c;
}

let detailTexture = null;

// A small, tileable speckle texture gives the ground fine variation without extra geometry.
function getDetailTexture() {
  if (detailTexture) return detailTexture;
  const N = 128;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  const img = g.createImageData(N, N);
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < N * N; i++) {
    const v = 200 + rnd() * 55;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.globalAlpha = 0.25;
  for (let i = 0; i < 60; i++) {
    g.fillStyle = rnd() > 0.5 ? '#ffffff' : '#5a5a4a';
    g.beginPath();
    g.arc(rnd() * N, rnd() * N, 2 + rnd() * 5, 0, Math.PI * 2);
    g.fill();
  }
  detailTexture = new THREE.CanvasTexture(c);
  detailTexture.wrapS = detailTexture.wrapT = THREE.RepeatWrapping;
  detailTexture.colorSpace = THREE.SRGBColorSpace;
  return detailTexture;
}

export function generateTerrain(def, scene) {
  const { size, segments, seed, islandRadius, sites } = def;
  const n = segments + 1, half = size / 2, cell = size / segments;
  const { fbm } = createValueNoise(seed);
  const ridgeNoise = createValueNoise(seed + 99);
  const heights = new Float32Array(n * n);

  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const x = -half + ix * cell, z = -half + iz * cell;
      const r = Math.hypot(x, z) / islandRadius;
      const coast = 1 - smoothstep(0.62, 1.0, r);
      const base = 4 + (fbm(x * 0.011, z * 0.011, 5) - 0.25) * 14;
      const ridge = 3 * smoothstep(0.6, 0.85, ridgeNoise.fbm(x * 0.02 + 100, z * 0.02, 3));
      let h = lerp(-8, base + ridge, coast);
      if (coast > 0.8) h = Math.max(h, 1.2);
      heights[iz * n + ix] = h;
    }
  }

  for (const s of sites) {
    for (let iz = 0; iz < n; iz++) {
      for (let ix = 0; ix < n; ix++) {
        const x = -half + ix * cell, z = -half + iz * cell;
        const d = Math.hypot(x - s.x, z - s.z);
        const w = 1 - smoothstep(s.r * 0.6, s.r, d);
        if (w > 0) heights[iz * n + ix] = lerp(heights[iz * n + ix], s.h, w);
      }
    }
  }

  const positions = new Float32Array(n * n * 3);
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const i = iz * n + ix;
      positions[i * 3] = -half + ix * cell;
      positions[i * 3 + 1] = heights[i];
      positions[i * 3 + 2] = -half + iz * cell;
    }
  }
  const indices = new Uint32Array(segments * segments * 6);
  let k = 0;
  for (let iz = 0; iz < segments; iz++) {
    for (let ix = 0; ix < segments; ix++) {
      const a = iz * n + ix, b = a + 1, c = a + n, d = c + 1;
      indices[k++] = a; indices[k++] = c; indices[k++] = b;
      indices[k++] = b; indices[k++] = c; indices[k++] = d;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeVertexNormals();
  const normals = geo.attributes.normal.array;
  const colors = new Float32Array(n * n * 3);
  for (let i = 0; i < n * n; i++) {
    const c = terrainRGB(heights[i], normals[i * 3 + 1]);
    colors[i * 3] = c[0];
    colors[i * 3 + 1] = c[1];
    colors[i * 3 + 2] = c[2];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const uvs = new Float32Array(n * n * 2);
  for (let i = 0; i < n * n; i++) {
    uvs[i * 2] = (-half + (i % n) * cell) / 12;
    uvs[i * 2 + 1] = (-half + Math.floor(i / n) * cell) / 12;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, map: getDetailTexture() }));
  mesh.receiveShadow = true;
  scene.add(mesh);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(size * 4, size * 4).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x2c7fb2, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.8 })
  );
  water.position.y = WATER_LEVEL - 0.05;
  scene.add(water);

  const field = new Heightfield(size, segments, heights);
  field.mesh = mesh;
  field.water = water;
  return field;
}
