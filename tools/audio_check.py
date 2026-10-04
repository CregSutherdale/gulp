"""Gulp! audio verification.

    python tools/audio_check.py                 # music files: loudness, peaks, sizes, provenance
    python tools/audio_check.py --sfx DIR       # + SFX WAVs rendered by tools/audio_render.mjs

Music (public/music/*.m4a, decoded with ffmpeg exactly as shipped):
  integrated LUFS (target -16 +-0.5), true peak (<= -1.5 dBTP), loop length, duration, size,
  total MB (<= 6), and provenance: every file must map to a source inside the two licensed
  packs (HydroGene 16-bit RPG Music, Johnathan Mago Fantasy Exploration) and no path may
  mention Kenney or Sonniss.
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
from audio_build import KEYMAP, MUSIC_DB_RUNTIME, OUT_DIR, TRACKS, TARGET_LUFS, TP_MAX  # noqa: E402

SR = 48000


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
    print(f"Licensed packs only: {all(A.provenance_ok(t['src']) for t in TRACKS)}")
    return fails


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


def main():
    fails = music_check()
    if "--sfx" in sys.argv:
        d = sys.argv[sys.argv.index("--sfx") + 1]
        f2, _ = sfx_check(d)
        fails += f2
    print(f"\nRESULT: {'all checks passed' if not fails else str(fails) + ' problem(s)'}")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
