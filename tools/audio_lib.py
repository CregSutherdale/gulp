"""Shared DSP helpers for the Gulp! audio tools (analysis, loop building, checks).

Pure numpy/scipy + ffmpeg (subprocess). No ML anywhere: every number here is classic
signal processing (STFT, chroma, autocorrelation, BS.1770 loudness).
"""
import json
import subprocess

import numpy as np
import pyloudnorm as pyln
from scipy.signal import resample_poly

# The only two music packs this game may use. Anything else is refused by the build/check.
ALLOWED_ROOTS = [
    r"C:\Users\kyle_\OneDrive\Desktop\New Game Assets\audio\music\28 High Quality 16-bit RPG Music",
    r"C:\Users\kyle_\OneDrive\Desktop\New Game Assets\audio\music\fantasy_exploration",
]
BANNED_WORDS = ("kenney", "sonniss")

NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]


def provenance_ok(path):
    """True if `path` sits inside an allowed pack and mentions no banned source."""
    p = str(path).replace("/", "\\").lower()
    if any(w in p for w in BANNED_WORDS):
        return False
    return any(p.startswith(r.lower()) for r in ALLOWED_ROOTS)


def probe(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries",
         "format=duration,bit_rate,size:stream=codec_name,codec_type,sample_rate,channels:format_tags",
         "-of", "json", str(path)], capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def decode(path, sr=44100, ch=2):
    """Decode any audio file to float32 [n, ch] at `sr` via ffmpeg (audio stream only)."""
    cmd = ["ffmpeg", "-v", "error", "-i", str(path), "-map", "0:a:0", "-vn",
           "-f", "f32le", "-acodec", "pcm_f32le", "-ac", str(ch), "-ar", str(sr), "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).reshape(-1, ch)
    return x.copy()


def decode_array_mono(x, sr, target_sr):
    """Mono mixdown of a float [n, ch] array, resampled to `target_sr` (polyphase)."""
    from math import gcd
    m = x.mean(axis=1) if x.ndim == 2 else x
    g = gcd(int(sr), int(target_sr))
    return resample_poly(m.astype(np.float64), target_sr // g, sr // g).astype(np.float32)


def db(x):
    return 20 * np.log10(np.maximum(np.abs(x), 1e-12))


def lufs(x, sr):
    """BS.1770-4 integrated loudness (gated) of float [n, ch]."""
    return pyln.Meter(sr).integrated_loudness(x.astype(np.float64))


def true_peak_db(x, sr, os=4):
    """True peak (dBTP) by 4x polyphase oversampling, per BS.1770-4 annex 2."""
    pk = 0.0
    for c in range(x.shape[1]):
        y = resample_poly(x[:, c].astype(np.float64), os, 1)
        pk = max(pk, float(np.max(np.abs(y))))
    return float(db(pk))


def k_weight(x, sr):
    m = pyln.Meter(sr)
    y = x.astype(np.float64).copy()
    for f in m._filters.values():  # high_shelf then high_pass (K-weighting)
        y = f.apply_filter(y)
    return y


def short_term_lufs(x, sr, win=3.0, hop=1.0):
    """Ungated short-term loudness series (3 s windows) -> np.array of LUFS."""
    y = k_weight(x, sr)
    p = np.sum(y ** 2, axis=1)  # channel weights are 1.0 for L/R
    n, h = int(win * sr), int(hop * sr)
    c = np.concatenate([[0.0], np.cumsum(p)])
    vals = []
    for s in range(0, max(1, len(p) - n + 1), h):
        ms = (c[s + n] - c[s]) / n
        vals.append(-0.691 + 10 * np.log10(max(ms, 1e-12)))
    return np.array(vals)


def loudness_range(x, sr):
    st = short_term_lufs(x, sr)
    st = st[st > -70]
    if len(st) < 3:
        return 0.0
    rel = 10 * np.log10(np.mean(10 ** (st / 10))) - 20
    st = st[st > rel]
    return float(np.percentile(st, 95) - np.percentile(st, 10))


# ----------------------------------------------------------------------------- spectral analysis
def stft_mag(mono, n_fft, hop):
    win = np.hanning(n_fft).astype(np.float32)
    n = 1 + max(0, (len(mono) - n_fft) // hop)
    idx = np.arange(n_fft)[None, :] + hop * np.arange(n)[:, None]
    frames = mono[idx] * win
    return np.abs(np.fft.rfft(frames, axis=1)).astype(np.float32)


# Krumhansl-Kessler and Temperley (Kostka-Payne) key profiles.
KK_MAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
KK_MIN = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
TP_MAJ = np.array([0.748, 0.060, 0.488, 0.082, 0.670, 0.460, 0.096, 0.715, 0.104, 0.366, 0.057, 0.400])
TP_MIN = np.array([0.712, 0.084, 0.474, 0.618, 0.049, 0.460, 0.105, 0.747, 0.404, 0.067, 0.133, 0.330])


def chroma_and_tuning(mono, sr):
    """Long-window chroma (12) and global tuning offset in cents vs A440."""
    n_fft, hop = 8192, 4096
    S = stft_mag(mono, n_fft, hop)
    freqs = np.fft.rfftfreq(n_fft, 1 / sr)
    band = (freqs >= 65) & (freqs <= 4200)
    # --- tuning: interpolated spectral peaks, deviation from the nearest 12-TET pitch
    devs, wts = [], []
    for fr in S[:: max(1, len(S) // 400)]:
        m = fr
        pk = np.where((m[1:-1] > m[:-2]) & (m[1:-1] > m[2:]))[0] + 1
        pk = pk[(freqs[pk] >= 100) & (freqs[pk] <= 3000)]
        if not len(pk):
            continue
        thr = np.max(m[pk]) * 0.1
        pk = pk[m[pk] > thr]
        a, b, c = np.log(m[pk - 1] + 1e-9), np.log(m[pk] + 1e-9), np.log(m[pk + 1] + 1e-9)
        off = 0.5 * (a - c) / (a - 2 * b + c + 1e-12)
        f = (pk + off) * sr / n_fft
        midi = 69 + 12 * np.log2(f / 440.0)
        d = (midi - np.round(midi)) * 100
        devs.extend(d.tolist())
        wts.extend(m[pk].tolist())
    devs, wts = np.array(devs), np.array(wts)
    ang = devs / 100 * 2 * np.pi
    tuning = float(np.angle(np.sum(wts * np.exp(1j * ang))) / (2 * np.pi) * 100) if len(devs) else 0.0
    # --- chroma with the tuning applied
    f = freqs[band]
    midi = 69 + 12 * np.log2(f / 440.0) - tuning / 100
    pc = np.mod(np.round(midi), 12).astype(int)
    P = S[:, band] ** 2
    chroma = np.zeros(12)
    # log-compress per frame so loud drums don't dominate, then sum.
    for k in range(12):
        chroma[k] = np.sum(np.log1p(100 * P[:, pc == k] / (P.max() + 1e-12)))
    chroma /= chroma.max() + 1e-12
    return chroma, tuning


def key_estimate(chroma):
    res = []
    for prof_maj, prof_min, tag in ((KK_MAJ, KK_MIN, "kk"), (TP_MAJ, TP_MIN, "tp")):
        for t in range(12):
            for mode, prof in (("maj", prof_maj), ("min", prof_min)):
                r = np.corrcoef(chroma, np.roll(prof, t))[0, 1]
                res.append((r, t, mode, tag))
    best = {}
    for r, t, mode, tag in res:
        if tag not in best or r > best[tag][0]:
            best[tag] = (r, t, mode)
    return best


def onset_envelope(mono, sr):
    n_fft, hop = 1024, 256
    S = stft_mag(mono, n_fft, hop)
    L = np.log1p(1000 * S / (S.max() + 1e-12))
    flux = np.maximum(0, np.diff(L, axis=0)).sum(axis=1)
    flux = flux - np.convolve(flux, np.ones(16) / 16, mode="same")  # local mean removal
    return np.maximum(flux, 0), sr / hop


def tempo_estimate(mono, sr):
    env, fps = onset_envelope(mono, sr)
    env = env - env.mean()
    ac = np.correlate(env, env, mode="full")[len(env) - 1:]
    ac /= ac[0] + 1e-12
    bpms = np.arange(50, 221, 0.5)
    lags = fps * 60 / bpms
    vals = np.interp(lags, np.arange(len(ac)), ac)
    prior = np.exp(-0.5 * (np.log2(bpms / 120.0) / 1.0) ** 2)
    score = vals * prior
    i = int(np.argmax(score))
    onset_rate = float(np.sum(env > (env.std() * 1.5)) / (len(env) / fps))
    return float(bpms[i]), float(vals[i]), onset_rate


def brightness(mono, sr):
    S = stft_mag(mono, 2048, 1024) ** 2
    f = np.fft.rfftfreq(2048, 1 / sr)
    e = S.sum(axis=1) + 1e-12
    cent = (S * f).sum(axis=1) / e
    w = e / e.sum()
    hi = S[:, f >= 4000].sum() / S.sum()
    lo = S[:, f < 200].sum() / S.sum()
    return float(np.sum(cent * w)), float(hi), float(lo)


def rms_env(x, sr, win=0.05):
    m = x.mean(axis=1) if x.ndim == 2 else x
    n = int(win * sr)
    k = len(m) // n
    return np.sqrt(np.mean(m[: k * n].reshape(k, n) ** 2, axis=1) + 1e-12)


def seam_report(x, sr):
    """How cleanly does the file's END flow into its START (as a raw loop)?"""
    ms = int(0.002 * sr)
    tail, head = x[-ms:], x[:ms]
    jump = float(np.max(np.abs(head[0] - tail[-1])))
    env = rms_env(x, sr, 0.25)
    lead = float(np.argmax(env > 10 ** (-50 / 20)) * 0.25)  # leading near-silence (s)
    trail = float(np.argmax(env[::-1] > 10 ** (-50 / 20)) * 0.25)
    first, last = float(db(env[:8].mean())), float(db(env[-8:].mean()))
    body = float(db(np.median(env)))
    return {"jump": jump, "lead_sil": lead, "trail_sil": trail,
            "head_db": first - body, "tail_db": last - body}
