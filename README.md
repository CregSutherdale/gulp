# Gulp!

A cozy 3D hole-swallowing game made for Amanda. Play: **https://cregsutherdale.github.io/gulp/** (iPhone: Safari → Share → Add to Home Screen).

## Modes
- **Levels**: 30 hand-built boards across 6 worlds (bakery, picnic, toy room, garden, beach, kitchen). Each has a target list and a generous timer. Stars are earned against par times. Free helpers: Magnet, Freeze, Grow.
- **Zen**: endless calm boards for every world plus the town. Eaten things pop back; optional auto-steer.
- **Race**: 2 minutes in the town against 5 rival holes.
- **Gulp Book**: a collection of everything she has swallowed. **Holes**: rim skins unlocked by stars.

## Tech
Three.js 0.169 + Rapier (wasm) + vanilla ES modules. Each hole carries a physical "ring" collider (an annulus plus a shaft) that it teleports every frame. Objects near a hole that fit (`fit <= 0.9 * diameter`) switch from colliding with the ground to colliding with that ring, so they really teeter on the rim and fall in. See `src/engine/physics.js` and `src/game/round.js`.

| Path | What |
|---|---|
| `src/game/props.js`, `props_cozy.js` | Prop catalog: code-built geometry, collider, fit, value |
| `src/game/levels.js`, `pars.js` | 30 levels (placement ops), star par times |
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

## Credits
Music: HydroGene and Johnathan Mago (licensed packs). All art is code-built geometry; all SFX are synthesized. Made with love for Amanda by Creg.
