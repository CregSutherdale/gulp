"""Build Gulp!'s per-world music loops: pick -> loop -> normalize -> encode -> verify.

    python tools/audio_build.py            # build every track into public/music/
    python tools/audio_build.py --dry      # analyze + report only, write nothing

Pipeline per track (all classic DSP, no ML):
  1. Decode the licensed source at 48 kHz stereo (soxr resampler).
  2. Loop region:
       'file'  -> the whole file is the loop (HydroGene tracks are composed as loops);
                  a 4 ms seam polish removes any residual end->start sample step.
       'auto'  -> self-similarity search for the strongest repeat (the composer's own
                  repeat), then sample-accurate alignment by cross-correlation and an
                  80 ms raised-cosine crossfade into the pre-roll of the loop start.
  3. Loudness: gain to -16.0 LUFS (BS.1770-4, measured cyclically on the loop body),
     then a 4x-oversampled look-ahead limiter only if true peak would exceed -2.6 dBTP
     (AAC adds up to ~1 dB of overshoot; the final ceiling is -1.5 dBTP).
  4. File = [last 0.25 s of loop] + [loop] + [first 0.25 s of loop]. The runtime loops
     [PAD, PAD + LEN). Because both pads are the loop's own continuation, the loop stays
     seamless even if a browser does not trim the AAC encoder priming (<= 2112 samples).
  5. Encode AAC-LC 64 kbps stereo 48 kHz .m4a (+faststart), decode it back with ffmpeg
     and re-measure LUFS / true peak; nudge and re-encode if outside spec.
  6. Rewrite the generated MUSIC table inside src/engine/audio.js (between markers).
"""
import os
import re
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import audio_lib as A  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_DIR = os.path.join(ROOT, "public", "music")
AUDIO_JS = os.path.join(ROOT, "src", "engine", "audio.js")
HG = A.ALLOWED_ROOTS[0]
MAGO = A.ALLOWED_ROOTS[1]
SR = 48000
PAD = 0.25            # seconds of pre/post roll around the loop
TARGET_LUFS = -16.0
TP_PRE = -2.6         # pre-codec true-peak ceiling (dBTP)
TP_MAX = -1.5         # final, post-codec true-peak ceiling (dBTP)
BITRATE = "64k"


def _runtime_music_db():
    """The music bus level audio.js applies at runtime (parsed so the two never drift)."""
    try:
        m = re.search(r"const MUSIC_DB = (-?[0-9.]+)", open(AUDIO_JS, encoding="utf-8").read())
        return float(m.group(1)) if m else 0.0
    except OSError:
        return 0.0


MUSIC_DB_RUNTIME = _runtime_music_db()

HG_PACK = "28 High Quality 16-bit RPG Music"
HG_LICENSE = "HydroGene, free for any use, credit optional (hydrogene.itch.io/high-quality-16-bit-music)"
MAGO_PACK = "Fantasy Exploration"
MAGO_LICENSE = "Johnathan Mago game music license: use in games OK, no standalone redistribution, credit appreciated"

# Every track the game ships. `why` is the listening note that justified the pick.
TRACKS = [
    dict(id="peaceful_village", title="Peaceful Village", author="HydroGene", pack=HG_PACK, lic=HG_LICENSE,
         src=HG + r"\wav\04. Peaceful Village.wav", loop="file",
         why="E major, gentle village theme, light percussion (12%), the welcoming home tune"),
    dict(id="holy_sanctuary", title="Holy Sanctuary", author="HydroGene", pack=HG_PACK, lic=HG_LICENSE,
         src=HG + r"\wav\28. Holy Sanctuary.wav", loop="file",
         why="A major / F#m pads, beatless (perc 4%), slowest harmony: pure calm for Zen"),
    dict(id="traveling_the_sky", title="Traveling the Sky", author="HydroGene", pack=HG_PACK, lic=HG_LICENSE,
         src=HG + r"\wav\14. Traveling the Sky.wav", loop="file",
         why="C major, ~136 BPM, brightest + airiest of the set, smooth transients: breezy and fast"),
    dict(id="lively_city", title="Lively City", author="HydroGene", pack=HG_PACK, lic=HG_LICENSE,
         src=HG + r"\wav\02. Lively City.wav", loop="file",
         why="C major, 78% major chords (I-IV-V-vi), bouncy staccato: sweet and sugary"),
    dict(id="long_journey", title="Long Journey", author="HydroGene", pack=HG_PACK, lic=HG_LICENSE,
         src=HG + r"\wav\05. Long Journey.wav", loop="file",
         why="F major sunny stroll, ~130 BPM, almost no pokes (0.02 hits/s): open-air picnic"),
    dict(id="spirits_forest", title="Spirits Forest", author="HydroGene", pack=HG_PACK, lic=HG_LICENSE,
         src=HG + r"\wav\07. Spirits Forest (loop).wav", loop="file",
         why="B major, sparkly high melody (~900 Hz register), bouncy beat with kick over snare: toy-box play"),
    dict(id="overworld_exploration", title="Overworld Exploration", author="Johnathan Mago", pack=MAGO_PACK,
         lic=MAGO_LICENSE, src=MAGO + r"\06 Overworld Exploration.ogg", loop="auto", search=(40, 110),
         why="D major pastoral orchestral, legato, smoothest transients: flowers and sunshine"),
    dict(id="village_theme", title="Village Theme", author="Johnathan Mago", pack=MAGO_PACK, lic=MAGO_LICENSE,
         src=MAGO + r"\10 Village Theme.ogg", loop="auto", search=(40, 110),
         why="C major I-V-iii-vi-IV-ii, ~84 BPM legato strings: warm, homey kitchen"),
]

# Game key -> track id. Tracks repeat where a pair of keys wants the same mood.
KEYMAP = {
    "menu": "peaceful_village", "zen": "holy_sanctuary", "race": "traveling_the_sky",
    "bakery": "lively_city", "picnic": "long_journey", "playroom": "spirits_forest",
    "garden": "overworld_exploration", "beach": "traveling_the_sky", "kitchen": "village_theme",
}
# Extra names the runtime accepts (old main.js keys + the town world).
ALIASES = {"calm": "menu", "play": "bakery", "city": "bakery", "title": "menu", "map": "menu"}


# ----------------------------------------------------------------------------- loop search
def _feats(m, sr, hop):
    n_fft = 4096
    S = A.stft_mag(m, n_fft, hop) ** 2
    fr = np.fft.rfftfreq(n_fft, 1 / sr)
    edges = 60 * 2 ** (np.arange(0, 7.01, 1 / 6))
    B = np.stack([S[:, (fr >= edges[i]) & (fr < edges[i + 1])].sum(axis=1) for i in range(len(edges) - 1)], axis=1)
    B = np.log(B + 1e-9)
    band = (fr >= 80) & (fr <= 2500)
    midi = 69 + 12 * np.log2(fr[band] / 440.0)
    pc = np.mod(np.round(midi), 12).astype(int)
    C = np.stack([S[:, band][:, pc == k].sum(axis=1) for k in range(12)], axis=1)
    C = np.sqrt(C / (C.sum(axis=1, keepdims=True) + 1e-12))
    B = (B - B.mean(axis=0)) / (B.std(axis=0) + 1e-9)
    F = np.concatenate([B * 0.5, C * 4], axis=1)
    return F / (np.linalg.norm(F, axis=1, keepdims=True) + 1e-9)


def find_loop(x, sr, lmin, lmax):
    """Strongest repeat (start, length) in seconds, away from intro/outro fades."""
    fsr, hop = 22050, 1024
    m = A.decode_array_mono(x, sr, fsr)
    F = _feats(m, fsr, hop)
    fps = fsr / hop
    N = len(F)
    envdb = 20 * np.log10(A.rms_env(m[:, None], fsr, hop / fsr)[:N] + 1e-9)
    body = np.median(envdb)
    W = int(3 * fps)
    best = (-1, 0, 0)
    for L in range(int(lmin * fps), int(lmax * fps)):
        d = np.sum(F[: N - L] * F[L:], axis=1)
        c = np.concatenate([[0], np.cumsum(d)])
        sm = (c[2 * W + 1:] - c[: -(2 * W + 1)]) / (2 * W + 1)
        for i in np.argsort(sm)[-4:]:
            a = i + W
            if a < W + int(0.5 * fps) or a + L + W >= N:
                continue
            if envdb[a - W: a + W].mean() < body - 4 or envdb[a + L - W: a + L + W].mean() < body - 4:
                continue
            if sm[i] > best[0]:
                best = (float(sm[i]), a / fps, L / fps)
    return best


def _onset_env(s, hop=128):
    S = np.log1p(200 * A.stft_mag(s.astype(np.float32), 1024, hop))
    e = np.maximum(0, np.diff(S, axis=0)).sum(axis=1)
    return e - e.mean()


def refine(x, sr, a, b, rhythm_search=0.08, wave_search=0.004, win=4.0):
    """Sample-align loop start `a` to end `b` (seconds).

    Stage 1 (rhythm): align the onset patterns in +-4 s around both points, so the beat
    never stumbles at the seam. Stage 2 (phase): +-4 ms waveform cross-correlation on the
    low band so the crossfade sums without comb filtering. Returns (ia, ib, rhythm_corr).
    """
    from scipy.signal import butter, sosfiltfilt
    m = x.mean(axis=1)
    ia, ib, hop = int(a * sr), int(b * sr), 128
    w = int(win * sr)
    eb = _onset_env(m[ib - w: ib + w], hop)
    best, best_l = -1e9, 0
    for lag in range(-int(rhythm_search * sr / hop), int(rhythm_search * sr / hop) + 1):
        o = lag * hop
        ea = _onset_env(m[ia + o - w: ia + o + w], hop)
        n = min(len(ea), len(eb))
        c = float(np.dot(ea[:n], eb[:n]) / (np.linalg.norm(ea[:n]) * np.linalg.norm(eb[:n]) + 1e-12))
        if c > best:
            best, best_l = c, o
    ia += best_l
    lo = sosfiltfilt(butter(4, 1500, fs=sr, output="sos"), m)
    ww, s = int(0.15 * sr), int(wave_search * sr)
    ref = lo[ib - ww: ib + ww]
    seg = lo[ia - ww - s: ia + ww + s]
    cc = np.correlate(seg, ref, mode="valid")
    norm = np.sqrt(np.convolve(seg ** 2, np.ones(len(ref)), mode="valid") * np.sum(ref ** 2)) + 1e-12
    k = int(np.argmax(cc / norm))
    return ia - s + k, ib, best, float((cc / norm)[k])


def build_loop(x, sr, spec):
    """Returns (body, info) where body is the cyclic loop [n, 2]."""
    if spec["loop"] == "file":
        body = x.copy()
        info = {"start": 0.0, "src_end": len(x) / sr, "sim": None, "xcorr": None}
        # Seam polish: bend the last 4 ms so the end flows exactly into sample 0.
        n = int(0.004 * sr)
        for c in range(body.shape[1]):
            pred = body[-1, c] + (body[-1, c] - body[-2, c])
            d = body[0, c] - pred
            r = (1 - np.cos(np.linspace(0, np.pi, n))) / 2
            body[-n:, c] += d * r
        return body, info
    sim, a, L = find_loop(x, sr, *spec["search"])
    ia, ib, rc, xc = refine(x, sr, a, a + L)
    F = int(0.12 * sr)
    body = x[ia:ib].copy()
    out_seg, in_seg = x[ib - F: ib], x[ia - F: ia]
    # Correlation-aware crossfade: g_out^2 + g_in^2 + 2*rho*g_out*g_in = 1 at every point,
    # so the seam neither dips (uncorrelated) nor bumps (correlated).
    rho = float(np.sum(out_seg * in_seg) / (np.sqrt(np.sum(out_seg ** 2) * np.sum(in_seg ** 2)) + 1e-12))
    rho = min(1.0, max(0.0, rho))
    th = np.linspace(0, np.pi / 2, F)
    ga, gb = np.cos(th), np.sin(th)
    nrm = np.sqrt(ga ** 2 + gb ** 2 + 2 * rho * ga * gb)
    body[-F:] = out_seg * (ga / nrm)[:, None] + in_seg * (gb / nrm)[:, None]
    return body, {"start": ia / sr, "src_end": ib / sr, "sim": sim, "xcorr": xc, "rhythm": rc, "rho": rho}


# ----------------------------------------------------------------------------- level
def cyc(body, n):
    return np.concatenate([body, body[:n]])  # wrap so measurements see the seam


def limiter(body, sr, ceiling_db, os_=4, look=0.0015, rel=0.06):
    """Oversampled look-ahead peak limiter on a cyclic loop (smooth, transparent)."""
    from scipy.signal import resample_poly
    thr = 10 ** (ceiling_db / 20)
    n = len(body)
    ext = np.concatenate([body[-int(0.05 * sr):], body, body[: int(0.05 * sr)]])
    pk = np.max(np.abs(np.stack([resample_poly(ext[:, c], os_, 1) for c in range(ext.shape[1])], axis=1)), axis=1)
    pk = pk.reshape(-1, os_).max(axis=1)[: len(ext)]
    g = np.minimum(1.0, thr / np.maximum(pk, 1e-9))
    la = max(1, int(look * sr))
    from scipy.ndimage import minimum_filter1d
    g = minimum_filter1d(g, size=2 * la + 1)
    a_rel = np.exp(-1 / (rel * sr))
    out = np.empty_like(g)
    cur = 1.0
    for i in range(len(g)):  # instant attack (look-ahead already applied), smooth release
        cur = g[i] if g[i] < cur else g[i] + (cur - g[i]) * a_rel
        out[i] = cur
    off = int(0.05 * sr)
    return body * out[off: off + n, None]


# ----------------------------------------------------------------------------- encode
def encode(pcm, path, meta):
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "pipe:0",
           "-c:a", "aac", "-b:a", BITRATE, "-ar", str(SR), "-movflags", "+faststart", "-map_metadata", "-1"]
    for k, v in meta.items():
        cmd += ["-metadata", f"{k}={v}"]
    cmd.append(path)
    subprocess.run(cmd, input=pcm.astype(np.float32).tobytes(), check=True)


def measure_file(path):
    y = A.decode(path, SR, 2)
    return y, A.lufs(y, SR), A.true_peak_db(y, SR)


def key_of(body, sr):
    m = A.decode_array_mono(body, sr, 22050)
    chroma, tuning = A.chroma_and_tuning(m, 22050)
    k = A.key_estimate(chroma)
    r, t, mode = k["tp"]
    root = t if mode == "maj" else (t + 3) % 12  # relative major tonic pitch class
    return root, mode, t, tuning, k


def seam_novelty(body, sr):
    """Spectral flux at the loop seam vs the loop's own 99.9th percentile.

    <= ~1.5 means the seam is no bigger a change than the music's own strongest note or
    chord onsets; a cut or click would read 3+.
    """
    w = int(0.75 * sr)
    seg = np.concatenate([body[-w:], body[:w]]).mean(axis=1)
    whole = cyc(body, int(0.1 * sr)).mean(axis=1)

    def flux(s):
        S = np.log1p(200 * A.stft_mag(s.astype(np.float32), 1024, 256))
        return np.maximum(0, np.diff(S, axis=0)).sum(axis=1)
    f_all = flux(whole)
    f_seam = flux(seg)
    mid = len(f_seam) // 2
    return float(f_seam[mid - 3: mid + 4].max() / np.percentile(f_all, 99.9))


def main():
    dry = "--dry" in sys.argv
    os.makedirs(OUT_DIR, exist_ok=True)
    rows = []
    for t in TRACKS:
        if not A.provenance_ok(t["src"]):
            sys.exit(f"REFUSED: {t['src']} is outside the licensed packs")
        x = A.decode(t["src"], SR, 2)
        body, info = build_loop(x, SR, t)
        L = len(body)
        cyc_n = int(0.4 * SR)
        g_db = TARGET_LUFS - A.lufs(cyc(body, cyc_n), SR)
        body = body * 10 ** (g_db / 20)
        tp0 = A.true_peak_db(cyc(body, cyc_n), SR)
        ceiling = TP_PRE
        if tp0 > ceiling:
            body = limiter(body, SR, ceiling - 0.1)
        root, mode, tonic, tuning, keys = key_of(body, SR)
        nov = seam_novelty(body, SR)
        p = int(PAD * SR)
        out = os.path.join(OUT_DIR, t["id"] + ".m4a")
        meta = {"title": t["title"], "artist": t["author"], "album": t["pack"],
                "comment": f"Gulp! seamless loop ({L / SR:.3f}s at {PAD}s pad). License: {t['lic']}"}
        res = dict(t, L=L / SR, gain=g_db, tp_pre=tp0, root=root, mode=mode, tonic=tonic, tuning=tuning,
                   nov=nov, info=info, out=out)
        if not dry:
            for attempt in range(4):
                filebuf = np.concatenate([body[-p:], body, body[:p]])
                encode(filebuf, out, meta)
                y, lf, tp = measure_file(out)
                if tp <= TP_MAX - 0.05 and abs(lf - TARGET_LUFS) <= 0.15:
                    break
                if tp > TP_MAX - 0.05:  # codec overshoot: tighten the limiter and retry
                    ceiling -= (tp - TP_MAX) + 0.3
                    body = limiter(body, SR, ceiling)
                else:
                    body = body * 10 ** ((TARGET_LUFS - lf) / 20)
            res.update(lufs=lf, tp=tp, n_dec=len(y), n_exp=L + 2 * p, size=os.path.getsize(out))
        rows.append(res)
        print(f"{t['id']:<22} loop {L / SR:7.3f}s  src {info['start']:7.3f}->{info['src_end']:7.3f}s"
              f"  gain {g_db:+5.1f} dB  key {A.NOTE_NAMES[tonic]}{'' if mode == 'maj' else 'm'}"
              f" (SFX root {A.NOTE_NAMES[root]}, tune {tuning:+.0f}c)  seam-novelty {nov:.2f}"
              + (f"  sim {info['sim']:.3f} rhythm {info['rhythm']:.2f} phase {info['xcorr']:.2f} rho {info['rho']:.2f}" if info["sim"] else "")
              + (f"\n{'':<22} -> {os.path.basename(out)}  {res['size'] / 1024:6.0f} KB  {res['lufs']:6.2f} LUFS"
                 f"  {res['tp']:5.2f} dBTP  decoded {res['n_dec']} / expected {res['n_exp']} samples"
                 if not dry else ""), flush=True)
    if not dry:
        write_js_table(rows)
        total = sum(r["size"] for r in rows)
        print(f"TOTAL {total / 1e6:.2f} MB ({total / 1048576:.2f} MiB) in {len(rows)} files")


def write_js_table(rows):
    """Regenerate the MUSIC / MUSIC_KEYS block in audio.js between the markers."""
    lines = ["// <generated by tools/audio_build.py: do not hand-edit>",
             "// file: public/music/<id>.m4a. loop = [PAD, PAD + len) seconds. root = SFX key",
             "// (pitch class of the track's relative-major tonic, C = 0); cents = tuning vs A440.",
             f"const MUSIC_PAD = {PAD};",
             "const MUSIC = {"]
    for r in rows:
        lines.append(f"  {r['id']}: {{ len: {r['L']:.6f}, root: {r['root']}, cents: {r['tuning']:.1f}, "
                     f"title: '{r['title']}', author: '{r['author']}' }},")
    lines.append("};")
    lines.append("const MUSIC_KEYS = {")
    lines.append("  " + ", ".join(f"{k}: '{v}'" for k, v in KEYMAP.items()) + ",")
    lines.append("  // aliases: old main.js keys and the town world")
    lines.append("  " + ", ".join(f"{k}: '{KEYMAP[v]}'" for k, v in ALIASES.items()) + ",")
    lines.append("};")
    lines.append("// </generated>")
    block = "\n".join(lines)
    src = open(AUDIO_JS, encoding="utf-8").read()
    pat = re.compile(r"// <generated by tools/audio_build\.py.*?// </generated>", re.S)
    if not pat.search(src):
        print("NOTE: audio.js has no generated-table markers yet; table printed below:\n" + block)
        return
    open(AUDIO_JS, "w", encoding="utf-8", newline="\n").write(pat.sub(lambda _m: block, src))
    print("audio.js MUSIC table regenerated")


if __name__ == "__main__":
    main()
