import { LAND_MIN } from './World.js';

const WAVE_POOL = ['scout', 'scout', 'raider', 'raider', 'walker', 'bombard'];
const AMMO_POOL = ['ammo_erfpg', 'ammo_erfpg', 'ammo_mortar', 'ammo_napalm', 'health', 'canister'];
const POWER_POOL = ['overdrive', 'aegis'];

export class Spawner {
  constructor(session) {
    this.session = session;
    this.ammoTimer = 4;
    this.powerTimer = 25;
    this.waveTimer = 30;
    this.maxEnemies = 34;
  }

  findSpot(minR, maxR) {
    const { world, player } = this.session;
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = minR + Math.random() * (maxR - minR);
      const x = player.pos.x + Math.cos(a) * r;
      const z = player.pos.z + Math.sin(a) * r;
      if (world.groundAt(x, z) >= LAND_MIN + 0.8 && world.canOccupy(x, z, 2.5)) return { x, z };
    }
    return null;
  }

  update(dt, elapsed) {
    const s = this.session;
    const pace = Math.max(0.35, 1 - elapsed / 600);

    this.ammoTimer -= dt;
    if (this.ammoTimer <= 0) {
      this.ammoTimer = (8 + Math.random() * 6) * pace;
      const spot = this.findSpot(40, 130);
      if (spot && s.world.pickups.list.length < 16) {
        s.world.pickups.spawn(AMMO_POOL[Math.floor(Math.random() * AMMO_POOL.length)], spot.x, spot.z);
      }
    }

    this.powerTimer -= dt;
    if (this.powerTimer <= 0) {
      this.powerTimer = 28 * pace;
      const spot = this.findSpot(50, 150);
      if (spot) {
        const type = Math.random() < 0.5 ? POWER_POOL[Math.floor(Math.random() * POWER_POOL.length)] : 'special';
        s.world.pickups.spawn(type, spot.x, spot.z);
      }
    }

    this.waveTimer -= dt;
    const alive = s.enemies.filter((e) => e.alive).length;
    if (this.waveTimer <= 0) {
      this.waveTimer = (26 + Math.random() * 8) * pace;
      if (alive < this.maxEnemies) {
        const count = 2 + Math.floor(Math.random() * 2) + (elapsed > 180 ? 1 : 0);
        const spot = this.findSpot(170, 230);
        if (spot) {
          for (let i = 0; i < count; i++) {
            const type = WAVE_POOL[Math.floor(Math.random() * WAVE_POOL.length)];
            const e = s.spawnEnemy(type, spot.x + (Math.random() - 0.5) * 16, spot.z + (Math.random() - 0.5) * 16);
          }
          s.hud.message(`Incoming wave: ${count} hostiles`, 'warn');
        }
      }
    }
  }
}
