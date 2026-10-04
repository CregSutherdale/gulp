"""Audition every candidate music track by the numbers (no ears needed, ears still welcome).

For each track: duration, integrated LUFS, true peak, loudness range, tempo, key + mode,
tuning offset (cents vs A440), brightness (spectral centroid / >4 kHz share), low-end share,
onset density (busyness), and raw-loop seam behaviour (fade-in/out, end->start jump).

Usage: python tools/audio_analyze.py [--all] [substring ...]
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import audio_lib as A  # noqa: E402

HG = A.ALLOWED_ROOTS[0] + r"\wav"
MAGO = A.ALLOWED_ROOTS[1]

# Battle / dark / tense titles are skipped unless --all: they are wrong for a cozy gift game.
SKIP = ("Battle", "Cavern", "Dangerous", "Volcanic", "Military", "Malicious", "Dark Factory",
        "Demon", "Evil", "(intro)", "Mystery", "Ancient Ruins", "Pyramid", "Dwarven")


def candidates(all_=False):
    out = []
    for d in (HG, MAGO):
        for f in sorted(os.listdir(d)):
            if not f.lower().endswith((".wav", ".ogg")):
                continue
            if not all_ and any(s in f for s in SKIP):
                continue
            out.append(os.path.join(d, f))
    return out


def analyze(path):
    x = A.decode(path, 44100, 2)
    sr = 44100
    mono = x.mean(axis=1).astype(np.float32)
    m22 = A.decode(path, 22050, 1)[:, 0]
    chroma, tuning = A.chroma_and_tuning(m22, 22050)
    keys = A.key_estimate(chroma)
    bpm, conf, onset_rate = A.tempo_estimate(m22, 22050)
    cent, hi, lo = A.brightness(m22, 22050)
    seam = A.seam_report(x, sr)
    return {
        "dur": len(x) / sr,
        "lufs": A.lufs(x, sr),
        "tp": A.true_peak_db(x, sr),
        "lra": A.loudness_range(x, sr),
        "bpm": bpm, "bpm_conf": conf, "onsets": onset_rate,
        "key_kk": keys["kk"], "key_tp": keys["tp"], "tuning": tuning,
        "cent": cent, "hi": hi, "lo": lo, "seam": seam,
        "chroma": chroma, "mono_rms": float(np.sqrt(np.mean(mono ** 2))),
    }


def kname(k):
    r, t, mode = k
    return f"{A.NOTE_NAMES[t]}{'' if mode == 'maj' else 'm'}({r:.2f})"


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    files = candidates("--all" in sys.argv)
    if args:
        files = [f for f in files if any(a.lower() in f.lower() for a in args)]
    print(f"{'track':<34}{'dur':>6}{'LUFS':>7}{'TP':>6}{'LRA':>5}{'BPM':>6}{'ons/s':>6}"
          f"  {'key KK':<12}{'key TP':<12}{'tune':>5}{'cent':>6}{'>4k%':>5}{'<200%':>6}"
          f"{'head':>6}{'tail':>6}{'jump':>6}")
    for f in files:
        r = analyze(f)
        s = r["seam"]
        name = os.path.basename(f)[:33]
        print(f"{name:<34}{r['dur']:6.1f}{r['lufs']:7.1f}{r['tp']:6.1f}{r['lra']:5.1f}{r['bpm']:6.1f}"
              f"{r['onsets']:6.1f}  {kname(r['key_kk']):<12}{kname(r['key_tp']):<12}{r['tuning']:5.0f}"
              f"{r['cent']:6.0f}{100 * r['hi']:5.1f}{100 * r['lo']:6.1f}{s['head_db']:6.1f}{s['tail_db']:6.1f}"
              f"{s['jump']:6.3f}", flush=True)


if __name__ == "__main__":
    main()
