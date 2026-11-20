import { terrainRGB } from '../levels/Heightfield.js';

const $ = (id) => document.getElementById(id);

export class Minimap {
  constructor() {
    this.small = $('minimap').getContext('2d');
    this.bigCanvas = $('tactical-canvas');
    this.big = this.bigCanvas.getContext('2d');
    this.tacticalEl = $('tactical');
    this.tacticalOn = false;
    this.base = null;
    this.contours = [];
    this.half = 150;
  }

  setTerrain(field) {
    this.half = field.half;
    const N = 160;
    const base = document.createElement('canvas');
    base.width = base.height = N;
    const g = base.getContext('2d');
    const img = g.createImageData(N, N);
    for (let iy = 0; iy < N; iy++) {
      for (let ix = 0; ix < N; ix++) {
        const x = -field.half + ((ix + 0.5) / N) * field.size;
        const z = -field.half + ((iy + 0.5) / N) * field.size;
        const c = terrainRGB(field.sample(x, z));
        const o = (iy * N + ix) * 4;
        img.data[o] = c[0] * 255;
        img.data[o + 1] = c[1] * 255;
        img.data[o + 2] = c[2] * 255;
        img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    this.base = base;

    const M = 60, step = field.size / M;
    const band = (x, z) => Math.floor(field.sample(x, z) / 8);
    this.contours = [];
    for (let j = 0; j < M; j++) {
      for (let i = 0; i < M; i++) {
        const x = -field.half + i * step, z = -field.half + j * step;
        const b = band(x, z);
        if (i + 1 < M && band(x + step, z) !== b) {
          const xm = x + step;
          this.contours.push([xm, z, xm, z + step]);
        }
        if (j + 1 < M && band(x, z + step) !== b) {
          const zm = z + step;
          this.contours.push([x, zm, x + step, zm]);
        }
      }
    }
  }

  toggleTactical() {
    this.tacticalOn = !this.tacticalOn;
    this.tacticalEl.classList.toggle('hidden', !this.tacticalOn);
  }

  clear() {
    this.tacticalOn = false;
    this.tacticalEl.classList.add('hidden');
  }

  update(state) {
    this.draw(this.small, 200, state, false);
    if (this.tacticalOn) this.draw(this.big, this.bigCanvas.width, state, true);
  }

  draw(ctx, size, s, detail) {
    const half = this.half;
    const P = (x, z) => [((x + half) / (2 * half)) * size, ((z + half) / (2 * half)) * size];
    ctx.clearRect(0, 0, size, size);
    if (this.base) ctx.drawImage(this.base, 0, 0, size, size);

    if (detail) {
      ctx.strokeStyle = 'rgba(120,255,220,0.22)';
      ctx.lineWidth = 1;
      for (const [x1, z1, x2, z2] of this.contours) {
        const a = P(x1, z1), b = P(x2, z2);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(120,255,220,0.12)';
      for (let g = -150; g <= 150; g += 50) {
        const a = P(g, -half), b = P(g, half), c = P(-half, g), d = P(half, g);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.stroke();
      }
    }

    const k = size / 200;
    for (const p of s.pickups) {
      const [x, y] = P(p.x, p.z);
      ctx.fillStyle = '#7ef4ff';
      ctx.fillRect(x - 2 * k, y - 2 * k, 4 * k, 4 * k);
    }
    for (const m of s.markers) {
      const [x, y] = P(m.x, m.z);
      ctx.strokeStyle = m.active ? '#ffd23a' : 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 2 * k;
      ctx.beginPath();
      ctx.moveTo(x, y - 6 * k); ctx.lineTo(x + 6 * k, y); ctx.lineTo(x, y + 6 * k); ctx.lineTo(x - 6 * k, y);
      ctx.closePath();
      ctx.stroke();
    }
    for (const e of s.enemies) {
      const [x, y] = P(e.x, e.z);
      ctx.fillStyle = '#ff4d4d';
      ctx.beginPath();
      ctx.arc(x, y, 2.5 * k, 0, Math.PI * 2);
      ctx.fill();
    }
    const [px, py] = P(s.x, s.z);
    const ang = Math.atan2(Math.cos(s.heading), Math.sin(s.heading));
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.fillStyle = '#e8fff6';
    ctx.beginPath();
    ctx.moveTo(8 * k, 0); ctx.lineTo(-5 * k, 4 * k); ctx.lineTo(-5 * k, -4 * k);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
