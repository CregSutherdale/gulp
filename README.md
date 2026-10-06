# Gulp!

A cozy 3D hole-swallowing game made for Amanda. Play: **https://cregsutherdale.github.io/gulp/** (iPhone: Safari → Share → Add to Home Screen).

## Modes
- **Levels**: 60 hand-built boards in three seasons across 12 worlds (Season 1: bakery, picnic, toy room, garden, beach, kitchen; Season 2: candy, farm, snow; Season 3, the challenge season: craft corner, fun fair, moon camp). Each has a target list and a generous timer. Stars are earned against par times. Free helpers: Magnet, Freeze, Grow.
- **Master** (crowns): every level gets a harder second life once it is cleared normally. Same board, a much shorter timer, no helpers, no +30 s, and CHALLENGE growth even in Easy mode. A win earns that level's crown; the best Master time is kept. Open it from the purple Master button on the home screen or the Levels | Master tabs on the map.
- **Zen**: endless calm boards for every world plus the town. Eaten things pop back; optional auto-steer.
- **Race**: 2 minutes in the town against 5 rival holes.
- **Gulp Book**: a collection of everything she has swallowed. **Holes**: rim skins unlocked by stars.

## Tech
Three.js 0.169 + Rapier (wasm) + vanilla ES modules. Each hole carries a physical "ring" collider (an annulus plus a shaft) that it teleports every frame. Objects near a hole that fit (`fit <= 0.9 * diameter`) switch from colliding with the ground to colliding with that ring, so they really teeter on the rim and fall in. See `src/engine/physics.js` and `src/game/round.js`.

| Path | What |
|---|---|
| `src/game/props.js`, `props_cozy.js`, `props_wave2.js`, `props_wave3.js` | Prop catalog: code-built geometry, collider, fit, value |
| `src/game/levels.js`, `levels_wave2.js`, `levels_wave3.js`, `allLevels.js` | 60 levels (placement ops), in play order |
| `src/game/difficulty.js`, `pars.js` | Challenge timers + star pars, Relaxed pars |
| `src/game/master.js` | Master Mode timers (`MASTER_TIMES`) + Master round setup |
| `src/game/zenbuild.js` | Zen board generator |
| `src/game/backdrops.js` | Scenery around each world's arena |
| `src/engine/audio.js` | Synthesized SFX + lazy per-world music (`public/music`) |
| `src/ui/*` | DOM screens, HUD, icons rendered from the real models |

## Commands
- Dev: `npx vite` (port 5191). `validate.html` auto-plays every level. Use `node tools/build_validate.mjs` and serve `.validate/` for a frozen run.
- Checks: `node tools/check_levels.mjs` covers geometry, overlaps and solvability math.
- Build: `node build.mjs` → `dist/` (index, hashed game file, music, service worker, manifest).
- Deploy: copy `dist/*` into `.deploy/` (a clone of the `gh-pages` branch), commit, push.

Validator rule: every level must be won by the careful bot within 75% of its timer **and** by the erratic "human" driver, with zero lost targets and clean spawns.

Master Mode:
- `node tools/validate_cli.mjs --master` (or `validate.html?master=1`) validates with Master settings. Gate: the careful bot must win inside the Master timer with zero lost targets and clean spawns (frac is reported, not gated). There is no erratic pass, because it relies on +30 s.
- Timers: `MASTER_TIMES[id] = ceil5(1.12 * B + 4)`, min 25, where B is the slower of two CHALLENGE bot clears. A level with no measured value falls back to `ceil5(0.8 * TIMES[id])`, min 25.
- To measure new levels (for example Seasons 4-7), run `node tools/measure_master.mjs --ids 61,62,... --write --verify`. It runs two CHALLENGE validator passes, writes the merged table into `master.js`, then runs `--master` and raises any failing level by 5 s until it passes. Raised levels are recorded in `MASTER_RAISED`.
- Save: `crowns` and `masterBest` live in the save. Settings "Start over" clears them, "Bring back my old stars" restores them, and progress codes carry them (`node tools/save_test.mjs`).

## Credits
Music: HydroGene and Johnathan Mago (licensed packs). All art is code-built geometry; all SFX are synthesized. Made with love for Amanda by Creg.
