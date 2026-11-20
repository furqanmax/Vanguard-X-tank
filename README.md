# Saltreach — Vanguard X

An original browser arcade vehicle-combat game built with Three.js. No build step: serve the folder and open it.

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## Status

Milestones M0–M3 are in place:

- **M0** Scaffold: importmap, fixed-step game loop, state flow (title, briefing, playing, paused, complete, game over), input.
- **M1** Vanguard X in Track Mode: independent hull and turret, C / `\` re-centering, mouse aim, third- and first-person views.
- **M2** Level 1 "Saltreach Atoll": procedural island, shield pylon → command bunker → three launch silos (10 s launch countdown) → VTOL extraction. Enemies: Skiff Scout, Hornet Raider, Siege Bombard, Pyre Walker, Gantry Launcher. Weapons: RFPG/ERFPG, HE Mortar, Napalm Projector.
- **M3** HUD: reticle states, target window (zoomed live render), target health, armor and nano-canisters, weapon bar, compass to objective, minimap, tactical map (M), objectives (O), briefing (R), messages, banners, damage vignette, low-health pulse, title/options/controls/pause/complete/game-over screens.

Not yet implemented (later milestones): save/load and Continue, audio, Amphib/Hover/Sub modes, Levels 2–6, remaining weapons and enemies.

## Controls

| Input | Action |
| --- | --- |
| W / S, Up / Down | Throttle and reverse |
| A / D, Left / Right | Turn hull |
| Mouse (click view to capture) | Aim turret and barrel |
| Left button | Fire primary (RFPG / ERFPG) |
| Right button | Fire the bound advanced weapon |
| 1 | Primary; press again to toggle RFPG / ERFPG |
| 2 / 3 | Select Mortar / Napalm (binds right button) |
| C | Center turret on hull |
| `\` | Center hull on turret |
| H | Use nano-canister (full armor repair) |
| V | Third / first person |
| M / O / R | Tactical map / objectives / briefing |
| F5 / F6 | Toggle HUD / cockpit frame |
| Esc | Pause |

Keys 4–9 are reserved for future weapons.

## Architecture

```
index.html, styles.css     Page shell, HUD and screen markup
vendor/three/              Vendored Three.js r187 (MIT, see LICENSE)
src/main.js                Entry point
src/game/
  Game.js                  State machine, loop, screen actions
  Session.js               One running mission: world, player, enemies, HUD updates
  World.js                 Solids, targets, collision, splash damage, scene reset
  Input.js                 Keyboard, mouse, pointer lock
  Pickups.js               Ammo, armor, nano-canister pickups
  math.js, noise.js        Helpers and seeded value noise
src/vehicles/Vanguard.js   Player vehicle: model, driving, turret aim, camera
src/weapons/
  weapons.js               Weapon definitions and Arsenal (ammo, cooldowns, firing)
  Projectiles.js           Bolts, ballistic shells, homing missiles, impacts
src/enemies/
  types.js                 Enemy stats, weapons, scores, drop chances
  models.js                Enemy meshes
  Enemy.js                 AI states: idle, patrol, pursue, attack, retreat, death
src/levels/
  Heightfield.js           Terrain generation, height sampling, vertex colors
  props.js                 Destructibles and static props
  level1.js                Level 1 layout, enemies, pickups, LEVEL_1 definition
  Mission.js               Objective chain, countdown, extraction
src/fx/
  Effects.js               Particles, debris, flashes, screen shake
  FireZones.js             Lingering fire areas
src/ui/
  HUD.js                   DOM HUD
  Minimap.js               Minimap and tactical map
  Screens.js               Menu and overlay screens
```

Coordinates: Y is up, +Z is the hull's forward at heading 0, and heading increases to the left.

## Adding a weapon

1. Add an entry to `WEAPONS` in `src/weapons/weapons.js` with `cooldown`, optional `ammo` and `maxAmmo`, and a `shot` object.
2. `shot.kind` is `bolt` (straight), `shell` (ballistic, uses `gravity` and `flightSpeed`), or `missile` (homing, uses `launch`, `speed`, `accel`, `turn`). Add `splash` and `fire: { radius, duration, dps }` as needed.
3. To bind it to a key, extend `ADVANCED_BY_KEY` and the slot list in `Arsenal.slotStates()`, and add a pickup type in `src/game/Pickups.js` if it uses ammo.

## Adding an enemy

1. Add a model builder to `BUILDERS` in `src/enemies/models.js`. It must return the rotating turret group.
2. Add stats to `ENEMY_TYPES` in `src/enemies/types.js`. `weapon.kind` can be `bolt`, `shell`, `missile`, or `flame`.
3. Place it in a level's enemy list.

## Adding a level

1. Create `src/levels/levelN.js`, following `level1.js`.
2. Define `terrain` (size, segments, seed, islandRadius, and flatten `sites`), `spawn`, `briefing`, `objectives`, and a `populate(session)` function that builds destructibles, enemies, and pickups and returns `refs`.
3. Extend `Mission.js` with any new objective ids, and point `Game.level` at the new definition.
