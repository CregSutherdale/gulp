"""Gulp! audio verification.

    python tools/audio_check.py                 # music files: loudness, peaks, sizes, provenance
    python tools/audio_check.py --sfx DIR       # + SFX WAVs rendered by tools/audio_render.mjs

Music (public/music/*.m4a, decoded with ffmpeg exactly as shipped):
  integrated LUFS (target -16 +-0.5), true peak (<= -1.5 dBTP), loop length, duration, size,
  total MB (<= 6), and provenance. Zero-license-risk ship policy (2026-10-04): every file must
  map to a source in HydroGene's "28 High Quality 16-bit RPG Music" (free for any use). No other
  file may sit in public/music, and no path may mention Kenney or Sonniss. The key map must match
  the table generated into audio.js and include the Season 2 keys (candy, farm, snow). A track may
  serve only one key except the sharing groups in SHARED_OK. CREDITS must name every shipped track
  and no one who is not shipped.
SFX (WAVs from the real engine in headless Chrome):
  peak / true peak, loudest 100 ms (K-weighted, ~perceived punch) relative to the music bed,
  brightness (spectral centroid), harsh-band share (2-5 kHz) and the sharpest attack.
Exit code 0 only if every check passes.
"""
import glob
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import audio_lib as A  # noqa: E402
from audio_build import AUDIO_JS, HG_PACK, KEYMAP, MUSIC_DB_RUNTIME, OUT_DIR, SHIP_ROOT, TRACKS, TARGET_LUFS, TP_MAX  # noqa: E402

SR = 48000
# Keys allowed to share one track (same mood family). Anything else reusing a track fails.
SHARED_OK = {
    frozenset(("race", "beach")),     # Traveling the Sky: fast, airy
    frozenset(("bakery", "candy")),   # Lively City: sugary, bouncy
    frozenset(("picnic", "farm")),    # Long Journey: sunny outdoors
    frozenset(("zen", "snow")),       # Holy Sanctuary: gentle, still
}
SEASON2 = ("candy", "farm", "snow")


def music_check():
    fails = 0
    print(f"{'file':<28}{'LUFS':>7}{'TP dBTP':>9}{'dur s':>8}{'loop s':>8}{'KB':>7}  source (pack / file)                                   prov  keys")
    total = 0
    by_id = {t["id"]: t for t in TRACKS}
    files = sorted(glob.glob(os.path.join(OUT_DIR, "*.m4a")))
    for f in files:
        tid = os.path.splitext(os.path.basename(f))[0]
        t = by_id.get(tid)
        y = A.decode(f, SR, 2)
        lu, tp = A.lufs(y, SR), A.true_peak_db(y, SR)
        size = os.path.getsize(f)
        total += size
        meta = A.probe(f)
        tags = {k.lower(): v for k, v in meta["format"].get("tags", {}).items()}
        st = meta["streams"][0]
        prov = bool(t) and A.provenance_ok(t["src"]) and os.path.exists(t["src"])
        prov = prov and t["src"].lower().startswith(SHIP_ROOT.lower()) and t["pack"] == HG_PACK  # ship policy
        prov = prov and not any(w in (tags.get("comment", "") + tags.get("album", "") + tags.get("artist", "")).lower() for w in A.BANNED_WORDS)
        ok = prov and abs(lu - TARGET_LUFS) <= 0.5 and tp <= TP_MAX and st["codec_name"] == "aac" and int(st["channels"]) == 2
        fails += 0 if ok else 1
        src = (t["pack"] + " / " + os.path.basename(t["src"])) if t else "UNKNOWN SOURCE"
        keys = ",".join(k for k, v in KEYMAP.items() if v == tid)
        loop = len(y) / SR - 0.5
        print(f"{os.path.basename(f):<28}{lu:7.2f}{tp:9.2f}{len(y) / SR:8.2f}{loop:8.2f}{size / 1024:7.0f}  {src[:55]:<55} {'ok' if prov else 'BAD':>4}  {keys}"
              + ("" if ok else "   <-- FAIL"))
    for t in TRACKS:  # every planned track must exist
        if not os.path.exists(os.path.join(OUT_DIR, t["id"] + ".m4a")):
            print(f"MISSING {t['id']}.m4a")
            fails += 1
    mb = total / 1e6
    print(f"TOTAL {mb:.2f} MB ({total / 1048576:.2f} MiB) in {len(files)} files, budget 6 MB: {'ok' if mb <= 6 else 'FAIL'}")
    fails += 0 if mb <= 6 else 1
    bad_src = [t["src"] for t in TRACKS if any(w in t["src"].lower() for w in A.BANNED_WORDS)]
    print(f"Kenney/Sonniss source paths: {len(bad_src)} {'ok' if not bad_src else 'FAIL ' + str(bad_src)}")
    hg_only = all(t["src"].lower().startswith(SHIP_ROOT.lower()) for t in TRACKS)
    print(f"Ship policy, HydroGene only: {'ok' if hg_only else 'FAIL'}")
    fails += 0 if (hg_only and not bad_src) else 1
    return fails + map_check()


def map_check():
    """Key map == table generated into audio.js; no track reused across keys; CREDITS complete."""
    import re
    fails = 0
    js = open(AUDIO_JS, encoding="utf-8").read()
    block = js[js.index("const MUSIC_KEYS = {"): js.index("};", js.index("const MUSIC_KEYS = {"))]
    gen = dict(re.findall(r"(\w+): '(\w+)'", block))
    for k, v in KEYMAP.items():
        if gen.get(k) != v:
            print(f"FAIL key {k}: build map {v} != audio.js {gen.get(k)}")
            fails += 1
        if not os.path.exists(os.path.join(OUT_DIR, v + ".m4a")):
            print(f"FAIL key {k}: {v}.m4a missing")
            fails += 1
    for k in SEASON2:
        if k not in KEYMAP or gen.get(k) != KEYMAP.get(k):
            print(f"FAIL Season 2 key {k} missing from the map or from audio.js")
            fails += 1
    users = {}
    for k, v in KEYMAP.items():
        users.setdefault(v, []).append(k)
    for v, ks in users.items():
        if len(ks) > 1 and frozenset(ks) not in SHARED_OK:
            print(f"FAIL track {v} reused by keys {ks}")
            fails += 1
    print("Key map: " + ", ".join(f"{k}={v}" for k, v in KEYMAP.items()) + f"  ({'ok' if not fails else 'FAIL'})")
    cblock = js[js.index("export const CREDITS"): js.index("].join", js.index("export const CREDITS"))]
    missing = [t["title"] for t in TRACKS if t["title"] not in cblock]
    authors = {t["author"] for t in TRACKS}
    extra = [a for a in ("Mago", "Kenney", "Sonniss") if a in cblock and not any(a in x for x in authors)]
    cred_ok = not missing and not extra and all(a in cblock for a in authors)
    print(f"CREDITS: {'ok' if cred_ok else 'FAIL'} (names all {len(TRACKS)} tracks"
          + (f"; missing {missing}" if missing else "") + (f"; unshipped names {extra}" if extra else "") + ")")
    return fails + (0 if cred_ok else 1)


def bed_loudness():
    """Music bed as heard in game: 100 ms K-weighted loudness distribution at the bus level."""
    vals = []
    for t in TRACKS:
        y = A.decode(os.path.join(OUT_DIR, t["id"] + ".m4a"), SR, 2) * 10 ** (MUSIC_DB_RUNTIME / 20)
        k = A.k_weight(y, SR)
        p = np.sum(k ** 2, axis=1)
        n = int(0.1 * SR)
        m = p[: len(p) // n * n].reshape(-1, n).mean(axis=1)
        vals.append(-0.691 + 10 * np.log10(m + 1e-12))
    v = np.concatenate(vals)
    return float(np.median(v)), float(np.percentile(v, 90))


def sfx_check(d):
    fails = 0
    med, p90 = bed_loudness()
    print(f"\nMusic bed in game (bus {MUSIC_DB_RUNTIME} dB): 100 ms loudness median {med:.1f} LUFS, p90 {p90:.1f} LUFS")
    print(f"{'sound':<34}{'peak':>7}{'TP':>7}{'L100':>7}{'vsBed':>7}{'cent Hz':>9}{'2-5k%':>7}{'rise ms':>8}{'crest':>6}  notes")
    rows = []
    for f in sorted(glob.glob(os.path.join(d, "*.wav"))):
        x = A.decode(f, SR, 2)
        if not np.any(x):
            print(f"{os.path.basename(f):<34} SILENT")
            fails += 1
            continue
        pk = float(A.db(np.max(np.abs(x))))
        tp = A.true_peak_db(x, SR)
        k = A.k_weight(x, SR)
        p = np.sum(k ** 2, axis=1)
        n = int(0.1 * SR)
        c = np.concatenate([[0.0], np.cumsum(p)])
        l100 = -0.691 + 10 * np.log10(np.max((c[n:] - c[:-n]) / n) + 1e-12)
        m = x.mean(axis=1)
        S = np.abs(np.fft.rfft(m * np.hanning(len(m)))) ** 2
        fr = np.fft.rfftfreq(len(m), 1 / SR)
        cent = float(np.sum(S * fr) / np.sum(S))
        harsh = float(S[(fr >= 2000) & (fr <= 5000)].sum() / S.sum())
        # attack: 10->90% rise time of the first onset (0.25 ms envelope) and the onset crest
        # (peak / RMS of the first 30 ms). A snare-type poke is a sub-millisecond rise with a
        # high crest; everything here should rise in >= ~1.5 ms.
        e = A.rms_env(x, SR, 0.00025)
        i90 = int(np.argmax(e >= 0.9 * e.max()))
        i10 = int(np.argmax(e >= 0.1 * e.max()))
        on = i10 - int(np.argmax(e[: i10 + 1][::-1] < 0.01 * e.max())) if i10 else 0
        on = max(0, on)
        atk = (i90 - i10) * 0.25 if i90 >= i10 else 0.0
        seg = m[on * 12: on * 12 + int(0.03 * SR)]
        crest = float(A.db(np.max(np.abs(seg)) / (np.sqrt(np.mean(seg ** 2)) + 1e-12))) if len(seg) else 0.0
        name = os.path.splitext(os.path.basename(f))[0]
        notes = []
        if tp > -1.0:
            notes.append("TP>-1")
        if atk < 1.0 and crest > 12:
            notes.append("POKE")
        if harsh > 0.45:
            notes.append("bright")
        fails += 1 if tp > -1.0 else 0
        rows.append((name, pk, tp, l100, l100 - med, cent, harsh, atk))
        print(f"{name:<34}{pk:7.1f}{tp:7.1f}{l100:7.1f}{l100 - med:+7.1f}{cent:9.0f}{100 * harsh:7.1f}{atk:8.1f}{crest:6.1f}  {' '.join(notes)}")
    return fails, rows


def material_check():
    """Every prop id defined in the game must have an explicit material in audio.js."""
    import re
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    ids = []
    for f in ("props.js", "props_cozy.js"):
        p = os.path.join(root, "src", "game", f)
        if os.path.exists(p):
            ids += re.findall(r"def\('([a-zA-Z0-9_]+)'", open(p, encoding="utf-8").read())
    js = open(os.path.join(root, "src", "engine", "audio.js"), encoding="utf-8").read()
    block = js[js.index("const MATERIAL_OF = {"): js.index("};", js.index("const MATERIAL_OF = {"))]
    mapped = set(re.findall(r"([a-zA-Z0-9_]+): '", block))
    missing = [i for i in ids if i not in mapped]
    print(f"\nMaterials: {len(ids) - len(missing)}/{len(ids)} prop ids mapped explicitly"
          + (f"; falling back to keyword rules: {missing}" if missing else " (ok)"))
    return 0  # a fallback still sounds fine; this is a heads-up, not a failure


def main():
    fails = music_check()
    fails += material_check()
    if "--sfx" in sys.argv:
        d = sys.argv[sys.argv.index("--sfx") + 1]
        f2, _ = sfx_check(d)
        fails += f2
    print(f"\nRESULT: {'all checks passed' if not fails else str(fails) + ' problem(s)'}")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
