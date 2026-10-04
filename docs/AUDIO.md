# Gulp! audio

Everything audio lives in `src/engine/audio.js`. There are two halves:

- **Music:** 8 licensed loops in `public/music/`. They load lazily, loop seamlessly and crossfade on every change.
- **SFX:** every sound is synthesized live in WebAudio (oscillators, filtered noise, FM). No samples, no generated media.

Every tonal effect is tuned to the key of the track that is playing, so pops, chimes and fanfares are always in key
with the music. All 1,736 pitches across the 8 keys are verified in-key.

## Signal flow

```
voice ─┬─► sfx bus ─► glue comp (-12 dB, 2.5:1) ─► makeup trim ───┐
       └─► reverb send ─► convolver (0.85 s room) ─► HP 280 / LP 6.5k ┤
track ─► equal-power fade ─► music bus (-5 dB) ─► duck ───────────┼─► master ─► limiter (-2 dB, 20:1) ─► trim ─► out
```

- **Compressor makeup gain is cancelled.** The WebAudio DynamicsCompressor adds automatic makeup gain. `makeupGain()`
  ports the Blink/WebKit kernel math and cancels it, so both comps only ever turn things down. This is verified exactly:
  -30 dBFS in comes out at -30.00 dBFS.
- **The limiter is a safety net.** No single sound reaches it. Only a deliberately absurd "storm" touches it: win +
  sizeUp + reward + swallowedHole + 12 big objects in 0.24 s peaks at -1.9 dBFS.
- **Music sits under the effects.** The files are at -16 LUFS and the bus at -5 dB, so the in-game bed is about
  -21 LUFS (100 ms loudness median -21.3).

## API

All methods are safe to call before `unlock()` and with sound off; they just do nothing.

| Call | When | What it plays |
|---|---|---|
| `unlock()` | Every `pointerdown`/`keydown` (already wired). The first call must be inside a user gesture (iOS). | Creates and resumes the context and starts the wanted music. |
| `setSfx(on)` / `setMusic(on)` | Settings toggles. | Smooth fades. Music off stops the source (no CPU) and remembers the key. |
| `setSfxVolume(v)` / `setMusicVolume(v)` | Optional 0..1 sliders. | |
| `playMusic(key)` | On every screen or world change. | Lazy fetch, decode, cache, 1.4 s equal-power crossfade. Re-entering a track within 45 s resumes where it left off. |
| `preload(key)` | Optional, for example on the level map. | Fetches (does not decode) the next world's file. |
| `stopMusic()` | | Fades out. |
| `pop(prop, combo)` | Every swallow by the player. `prop` = `{ id, value }`; a bare number still works. | Material voice on the combo note (see below). |
| `gulp(value)` | Optional; `pop` already adds it for value 15 and up. | Deep "GLOMP" with phone-audible harmonics. |
| `sizeUp()` | Player grows a size, and the countdown's "Go!". | Bright run plus bloom. |
| `target(progress)` | A target item eaten (`got / need`). | In-key bell climbing mi, sol, la, do (the last one resolves). |
| `lastOne()` | One target left (`round` emits `lastOne`). | Expectant twinkle. |
| `rimWobble()` (alias `bonk()`) | Object too big. | Soft rubbery "uh-uh". Self rate-limited: 0.9 s, backing off to 2.5 s if repeated. |
| `tick(urgent)` | Countdown seconds; `urgent` for the last 5. | Soft wood-block tock. |
| `tap()` | Any button. | Soft blip. |
| `uiOpen()` / `uiClose()` | A panel opens or closes (pause, settings, book). | Soft rising / falling "bwip". |
| `star(i)` | Results stars, i = 0..2. | Celesta notes on the tonic triad (3rd, 5th, octave). |
| `win()` | Level, race or zen win. | Run, warm chord, sparkles. Ducks music -8 dB. |
| `timeUp()` | Out of time or race lost. | Gentle "aww", not a buzzer. |
| `swallowedHole()` | A hole eats a hole. | Big cartoon swallow plus slide. |
| `levelStart()` | Start of a level or race. | Short cheerful sting. |
| `boosterMagnet()` / `boosterFreeze()` / `boosterGrow()` | Helper used. | Whooshy hum / icy chime / rising swell. |
| `reward()` | Something unlocked, or a new item for the Gulp Book. | "Ta-da!" Self-paced: the full fanfare at most once per 3.5 s of quiet, light "ding-ding" in between. |
| `duck(db, hold, release)` | Optional, for your own moments. | Sidechain-style music dip. |
| `materialOf(prop)` | Export. | The material a prop will sound like. |
| `CREDITS` | Export (string), for Settings. | |
| `MUSIC_KEYS` | Export. | Key to track table. |
| `setMusicBase(url)` / `setTrackUrl(id, url)` | For hosts that need another path, or data: URLs in a single-file build. | |

Legacy names still work: `bonk`, `load(name, url)`, `playMusic(name, true)`, `pop(value, combo)`, the `want`
property, and the keys `calm`, `play` and `city`.

### Wiring status in main.js (checked 2026-10-04)

Already wired: `pop(o.prop, combo)`, `playMusic('menu' | 'zen' | 'race' | level.world | place.world)`,
`levelStart()` in `begin()`, all three boosters, `lastOne()`, `reward()` on first Gulp Book finds, and `bonk()`.

Shipping is handled: `build.mjs` copies `public/` into `dist/` (so the files land at `dist/music/*.m4a`), and the
service worker serves music stale-while-revalidate, so after the first load tracks come from the phone's cache. If
a file is missing, music fails quietly and the game still runs.

Still open:

1. Show `CREDITS` in Settings.
2. Optional: call `uiOpen()` / `uiClose()` instead of `tap()` on the pause, settings and book open/close buttons.
3. Optional: `levelStart()` is built as a "go!" sting. It works where it is now (the start of the countdown, under
   the "3" tick), or it can replace `sizeUp()` at "Go!" in `ui.countdown`.

## Music

| Key | Track (author) | Why |
|---|---|---|
| menu | Peaceful Village (HydroGene) | E major, gentle, light percussion: the welcoming home tune (it was the old "calm" track). |
| zen | Holy Sanctuary (HydroGene) | A major / F# minor pads, beatless (4% percussive), slowest harmony: pure calm. Trim -1.5 dB. |
| race | Traveling the Sky (HydroGene) | C major, about 136 BPM, brightest and airiest, smooth transients. |
| bakery | Lively City (HydroGene) | C major, 78% major chords, bouncy staccato: sweet. |
| picnic | Long Journey (HydroGene) | F major sunny stroll, about 130 BPM, almost no transient pokes. |
| playroom | Spirits Forest (HydroGene, loop cut) | B major, sparkly high melody, bouncy beat with the kick above the snare. |
| garden | East Town (HydroGene) | A minor / C major pentatonic folk tune in a high, airy register (about 920 Hz), about 98 BPM. Light percussion for the first 40 s, then a livelier plucked section: pastoral and breezy. |
| beach | Traveling the Sky (HydroGene) | Breezy; shared with race. |
| kitchen | Wood Forest Town (HydroGene) | The warmest track in the pack (the least upper-mid energy), a cozy bouncing town theme at about 105 BPM with soft pokes. At 119 s it is the longest loop, so the final world repeats least. |
| candy (Season 2) | Lively City (HydroGene) | Sugary, playful, bouncy: the most major track (78% major chords), bouncy staccato. Shared with bakery. |
| farm (Season 2) | Long Journey (HydroGene) | Rustic, cheerful, morning: F major sunny stroll with the smoothest transients. Shared with picnic. Peaceful Village is gentler, but it is the menu theme. |
| snow (Season 2) | Holy Sanctuary (HydroGene) | Cozy winter, gentle: the gentlest track (3.8% percussive, no pokes), warm shimmering pads, 69% major chords. Shared with zen. |
| aliases | calm → menu, play / city → Lively City | |

**Season 2 (2026-10-04): no new files.** The unused HydroGene tracks scored worse on fit than reuse:
- The Old Magician: minor and dull.
- Ancient Library: modal and not twinkly.
- Magic Temple: its snare sits over its kick.
- Royal Castle: does not loop cleanly.

**How the tracks were picked.** `tools/audio_analyze.py` measures every candidate: tempo, key and mode, tuning, chord
major share, percussiveness, brightness, and the snare-band "poke" rate against the kick. Battle, dark and minor
tracks were rejected. Goofy Monster and Magic Temple were rejected as too pokey; Magic Temple's snare band also sits
louder than its kick.

For garden and kitchen (picked 2026-10-04, from Wood Forest Town, East Town, Unknown Island and Goofy Monster) the
analysis also looked at 10 s sections and transient level:
- **Unknown Island** is mostly minor, with very sharp transients.
- **Goofy Monster** is mostly minor, pokey and only 32 s long.
- **East Town** has only one exact repeat (4 bars, 9.8 s), too short to loop on its own, so it ships as its full
  composed loop.
- **East Town and Wood Forest Town** both put less energy in the 2–5 kHz band than every shipped track. Their
  plucks are spikier (crest 11.5 dB), but neither is an outlier against the other.

**Loops.**

- **All eight files** are HydroGene tracks composed as loops; a 4 ms seam polish removes any residual end-to-start
  step.
- **Internal loops:** `audio_build.py` can still cut one from any track (`loop="auto"`: self-similarity search,
  onset-pattern rhythm alignment and a correlation-aware crossfade).
- **Pads:** every file carries 0.25 s of its own continuation at each end, and the runtime loops
  `[0.25, 0.25 + len)`. The loop stays seamless whether or not a browser trims AAC priming (Chrome trims exactly).

**Seam check in Chrome's real decoder.** The click metric is 0.00 to 0.89 against a 2.5 limit (East Town 0.18,
Wood Forest Town 0.14). The 100 ms level steps at the seams are each inside that track's own range of downbeats:
East Town +8.7 dB (95.5th percentile of its own steps) and Wood Forest Town +10.7 dB (97.5th).

**SFX keys.** East Town plays the pops in C. Wood Forest Town is in Eb minor, so its pops use the relative-major
F# pentatonic (Eb minor pentatonic).

### Loudness (decoded from the shipped files)

| File | LUFS | True peak | Loop (s) | Size |
|---|---|---|---|---|
| peaceful_village.m4a | -16.05 | -2.53 dBTP | 85.54 | 695 KB |
| holy_sanctuary.m4a | -16.04 | -5.63 dBTP | 74.67 | 605 KB |
| traveling_the_sky.m4a | -16.00 | -2.98 dBTP | 70.07 | 570 KB |
| lively_city.m4a | -15.96 | -4.21 dBTP | 64.62 | 529 KB |
| long_journey.m4a | -15.99 | -3.96 dBTP | 45.70 | 374 KB |
| spirits_forest.m4a | -15.98 | -2.18 dBTP | 54.64 | 448 KB |
| east_town.m4a | -15.99 | -2.32 dBTP | 58.78 | 479 KB |
| wood_forest_town.m4a | -16.00 | -1.67 dBTP | 118.85 | 969 KB |
| **Total** | | | | **4.78 MB** (budget 6 MB) |

Format: AAC-LC 64 kbps stereo, 48 kHz, `+faststart`, from the lossless HydroGene WAVs.

**License: zero-risk ship policy.** Every shipped track is HydroGene's "28 High Quality 16-bit RPG Music": free for
any use, credit optional (credited anyway).
- **The build refuses anything else.** `audio_build.py` rejects any other source and prunes stale files from
  `public/music/`.
- **The check enforces it.** `audio_check.py` fails on any non-HydroGene file, on a key map that doesn't match
  audio.js, on a missing Season 2 key, and on CREDITS that miss a track or name someone who isn't shipped. It also
  fails on a track reused across keys outside the allowed sharing groups (`SHARED_OK`: race+beach, bakery+candy,
  picnic+farm, zen+snow).
- **Banned sources:** no Kenney, Sonniss or AI audio.

**Cleanup outside public/music (owned by the build/deploy lane).** The two Johnathan Mago files from the first pass
(`overworld_exploration.m4a`, `village_theme.m4a`) may still be in:
- `dist/music/`: `build.mjs` copies with `cpSync` and never prunes, so delete `dist/music` before the next build.
- the gh-pages clone `.deploy/music/` (live on Pages).
- the pushed git history.

Deleting them from `dist/` and `.deploy/` and redeploying takes them off the site. Purging history needs a
force-push, which is Kyle's call.

## Swallow sounds (pop)

**Pitch.** The pentatonic note comes from `combo`: about 11 notes from B4 to C7 in the current key, then it keeps
sparkling over the top five. Bigger objects drop an octave (value 4 and up) or two (value 40 and up), and get:

- value 4 to 14: a low thump layer
- value 15 and up: the gulp layer, which also ducks the music 2.5 dB
- every 10th combo: a soft sparkle

| Material | Sound | Prop ids |
|---|---|---|
| soft | Cushioned "pomf" with a breath of fluff | bush, flowerbed, blanketroll, teddy, tulip, daisy, hedge, starfish, parasol |
| squishy | Upward "blup", wet squelch, jelly wobble | gumdrop, macaron, donut, cupcake, cakeslice, icecream, pie, cake, layercake, sandwich, mushroom |
| crunchy | Plucked note under soft band-limited crumbs | sprinkle, candy, cookie, croissant, lollipop, gingerhouse, crayon, sandcastle |
| plastic | Hollow "plok" (the duck squeaks) | cone, juicebox, toyball, duck, stackrings, rocket, toycar, playcastle, bucket, spade, beachball, lifering, surfboard |
| wood | Marimba "tonk" | bench, cart, tree, pine, kiosk, house, shop, basket, fruitcart, block, locomotive, traincar, rockinghorse, dollhouse, birdhouse, gardenbench, gazebo, deckchair, lifeguard |
| metal | FM "ting" (small) or "bong" (big) | hydrant, bin, mailbox, sign, lamp, vending, tower, robot, wateringcan, toaster, pan, mixer, fridge, stove |
| ceramic / glass | Clean two-partial "clink" | pot, booth, shelter, fountain, apartment, office, gnome, potplant, gardenfountain, shell, cup, bottle, jar, mug, platestack, teapot, fruitbowl |
| fruit | Juicy water-drop "plip" | grape, cherry, strawberry, lemon, apple, orange, banana, grapes, melonslice, watermelon, pumpkin |
| person | Tiny falling "boop" (the crab double-blips) | person, crab |
| vehicle | "Vroom-down" plus a polite in-key "meep" (horn at most every 0.8 s; the bike rings a bell) | car, taxi, van, bus, truck, bike |

A prop may set its own `material` field. Unknown ids fall back to keyword rules, then to plastic;
`tools/audio_check.py` lists any id without an explicit entry.

**Anti-fatigue.**

- Simultaneous swallows are strummed 36 ms apart into a rising run, with at most 0.3 s of backlog: a pile plays
  about 7 notes, not a wall.
- 8 pop voices, with the oldest stolen by a 12 ms fade.
- ±6 cents detune and ±1 dB per pop, alternating ±0.05 to 0.16 pan.
- Density attenuation after 3 pops in 0.35 s, plus a light -1.5 dB music duck in dense bursts.

## Mix numbers (rendered by the real engine in headless Chrome)

"L100" is the loudest 100 ms (K-weighted), compared with the in-game music bed (median -21.3 LUFS).

| Sound | Peak dBFS | vs bed | Sound | Peak dBFS | vs bed |
|---|---|---|---|---|---|
| small pops (10 materials, combo 3) | -8.4 … -13.3 | +2.0 … +3.5 | win | -9.0 | +5.2 |
| medium pops (value 4 to 13) | -6.4 … -7.9 | +4.9 … +6.8 | reward | -8.7 | +4.5 |
| big pops (value 18 to 95) | -4.3 … -5.3 | +8.9 … +10.3 | levelStart | -8.7 | +4.1 |
| gulp 30 / 160 | -7.6 / -6.5 | +9.2 / +10.3 | sizeUp | -10.7 | +2.9 |
| swallowedHole | -6.6 | +10.4 | timeUp | -12.2 | +2.2 |
| target 0.2 / 1.0 | -16.8 / -14.0 | -0.1 / +3.7 | lastOne | -13.7 | +2.9 |
| star 0 / 1 / 2 | -13.8 / -14.8 / -13.5 | +2.1 / +3.0 / +4.8 | boosters | -11.2 … -13.8 | +2.9 … +3.0 |
| tick / urgent | -11.1 / -7.4 | -2.1 / +0.8 | rimWobble | -14.1 | -3.0 |
| tap / uiOpen / uiClose | -14.4 / -18.5 / -18.3 | -5.0 / -5.5 / -5.7 | combo run x20 | -8.8 | +6.3 |
| pile x30 same frame | -6.9 | +7.8 | worst-case storm | -1.9 | +11.4 |

No sound is pokey: every attack rises in 1.0 ms or more, with an onset crest of 10.8 dB or less. Each sound has a
fader in `FADER_DB` and each material a trim in `MAT_TRIM_DB`, both in dB; re-run the tools after changing them.

## Tools

| Command | Does |
|---|---|
| `python tools/audio_analyze.py` | Audition the candidate tracks by the numbers. |
| `python tools/audio_build.py` | Rebuild `public/music/*` and regenerate the MUSIC table in audio.js (deterministic). `--dry` = report only. `--keys-only` = rewrite just the key map from `KEYMAP` (no re-encode; the files stay byte-identical). |
| `python tools/audio_check.py [--sfx DIR]` | Music LUFS, true peak, sizes, provenance and material coverage, plus the SFX table. Exits non-zero on failure. |
| `node tools/audio_render.mjs [DIR]` | Renders every SFX through the real audio.js in headless Chrome to WAVs. Checks makeup compensation, the music seams and the crossfade. |
| `node tools/audio_render.mjs --live http://localhost:5191/` | Smoke-tests the running game: no context before the first tap, unlock, lazy music, live SFX. |

## iOS notes

- No AudioContext exists until the first tap. `unlock()` resumes and starts a silent buffer inside the gesture, and is
  safe on every tap.
- The context suspends when the page is hidden and resumes on return (or on the next tap if iOS insists).
- WebAudio follows the ring/silent switch and mixes with other apps' audio, like a native casual game.
- Decoded tracks are cached LRU, 3 at a time (about 30 MB each at 48 kHz). The compressed bytes (4.5 MB) stay cached.
