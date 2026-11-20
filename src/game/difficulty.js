export const DIFFICULTIES = {
  easy: { label: 'Easy', enemyHealth: 0.75, enemyDamage: 0.55, launchTime: 14 },
  normal: { label: 'Normal', enemyHealth: 1, enemyDamage: 1, launchTime: 10 },
  hard: { label: 'Hard', enemyHealth: 1.3, enemyDamage: 1.35, launchTime: 8 },
};

export function scaleWeapon(weapon, factor) {
  const w = { ...weapon };
  if (w.damage !== undefined) w.damage = w.damage * factor;
  if (w.dps !== undefined) w.dps = w.dps * factor;
  return w;
}
