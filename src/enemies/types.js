export const ENEMY_TYPES = {
  scout: {
    name: 'Skiff Scout', model: 'scout', hp: 30, radius: 1.8, height: 2.0, size: 1,
    speed: 15, patrolSpeed: 6, accel: 10, turnRate: 2.6, turretRate: 3.5,
    sight: 40, aggro: 40, range: 36, standoff: 18, cooldown: 0.9, retreatAt: 0.25,
    score: 150, drop: 0.2, muzzleZ: 1.8, muzzleY: 1.2,
    weapon: { kind: 'bolt', speed: 95, damage: 4, hitRadius: 0.5, life: 1.4, color: 0xff8a3d, size: 0.3, spread: 0.02 },
  },
  raider: {
    name: 'Hornet Raider', model: 'raider', hp: 70, radius: 2.0, height: 2.2, size: 1.2,
    speed: 12, patrolSpeed: 5, accel: 8, turnRate: 2.0, turretRate: 3.0,
    sight: 55, aggro: 55, range: 50, standoff: 30, cooldown: 0.3, retreatAt: 0.3,
    score: 300, drop: 0.3, muzzleZ: 2.2, muzzleY: 1.4,
    weapon: { kind: 'bolt', speed: 120, damage: 4, hitRadius: 0.5, life: 1.2, color: 0xd96bff, size: 0.3, spread: 0.035 },
  },
  bombard: {
    name: 'Siege Bombard', model: 'bombard', hp: 180, radius: 2.6, height: 3.0, size: 2,
    speed: 5, patrolSpeed: 3, accel: 4, turnRate: 0.9, turretRate: 1.6,
    sight: 90, aggro: 90, range: 92, standoff: 55, cooldown: 3.2, retreatAt: 0,
    score: 500, drop: 0.4, muzzleZ: 0.5, muzzleY: 3.5,
    weapon: { kind: 'shell', flightSpeed: 45, gravity: 18, damage: 34, splash: 6, hitRadius: 0.8, life: 7, color: 0xffb84d, size: 0.8 },
  },
  walker: {
    name: 'Pyre Walker', model: 'walker', hp: 110, radius: 2.2, height: 2.6, size: 1.6,
    speed: 8, patrolSpeed: 4, accel: 6, turnRate: 1.5, turretRate: 2.5,
    sight: 30, aggro: 30, range: 14, standoff: 8, cooldown: 1.8, retreatAt: 0,
    score: 350, drop: 0.35, muzzleZ: 0, muzzleY: 1.5,
    weapon: { kind: 'flame', radius: 3.6, duration: 1.8, dps: 11, color: 0xff7a2a },
  },
  gantry: {
    name: 'Gantry Launcher', model: 'gantry', hp: 120, radius: 2.2, height: 4.0, size: 1.8,
    speed: 0, patrolSpeed: 0, accel: 0, turnRate: 0, turretRate: 1.4,
    sight: 100, aggro: 100, range: 90, standoff: 60, cooldown: 4.2, retreatAt: 0,
    stationary: true, mounted: true,
    score: 450, drop: 0.35, muzzleZ: 1.5, muzzleY: 3.2,
    // turn is a hard limit in radians/second, giving the missile a wide, slow arc.
    weapon: { kind: 'missile', launch: 16, speed: 42, accel: 26, turn: 0.9, damage: 26, splash: 3.5, hitRadius: 1.0, life: 8, color: 0xf2f2f2, size: 0.5 },
  },
};
