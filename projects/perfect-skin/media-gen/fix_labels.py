"""Вернуть неподвижным товарам точные пиксели из k0 — в кадре или в каждом
кадре ролика. Модель (и картинки, и видео) перерисовывает мелкий текст
этикеток; товары, которых рука в этот момент не касается, стоят на месте,
поэтому их пиксели можно взять из k0 как есть. Кожу (руку) не трогаем.

Запуск:
  python3 fix_labels.py image <k0.png> <in.png> <out.png> <fmt> <active,...>
  python3 fix_labels.py video <k0.png> <in.mp4> <out.mp4> <fmt> <active,...>
active — номера товаров 1..4, которых касается рука (их не трогаем).
"""
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lift import FFMPEG, read, write  # noqa: E402
from restore import silhouette, skin  # noqa: E402

# Границы товаров в k0 v3 (доли ширины/высоты), запас 1 %.
BOXES = {
    "desktop": [(0.455, 0.515, 0.442, 0.852), (0.527, 0.588, 0.440, 0.847),
                (0.600, 0.693, 0.702, 0.845), (0.707, 0.756, 0.539, 0.837)],
    "mobile": [(0.264, 0.364, 0.379, 0.62), (0.384, 0.481, 0.379, 0.62), (0.503, 0.6, 0.544, 0.621), (0.661, 0.784, 0.467, 0.62)],
}


def mask_for(shape, fmt, active, k0p=None):
    h, w = shape[:2]
    m = np.zeros((h, w), bool)
    k0 = read(k0p) if k0p else None
    for j, (x0, x1, y0, y1) in enumerate(BOXES[fmt], 1):
        if j in active:
            continue
        pad = 0.008
        box = np.zeros((h, w), bool)
        box[int((y0 - pad) * h):int((y1 + pad) * h), int((x0 - pad) * w):int((x1 + pad) * w)] = True
        gap = os.path.join(os.path.dirname(k0p), f"{fmt}-gap{j}.png") if k0p else None
        if k0 is not None and os.path.exists(gap):
            sil = silhouette(k0, read(gap), 50, x0 - pad, x1 + pad) & box
            if sil.shape != (h, w):
                sil = np.array(sil[np.linspace(0, sil.shape[0] - 1, h).astype(int)][:, np.linspace(0, sil.shape[1] - 1, w).astype(int)])
            m |= dilate(sil, 4)
        else:
            m |= box
    return m


def dilate(m, r):
    from numpy.lib.stride_tricks import sliding_window_view as swv
    return swv(np.pad(m, r), (2 * r + 1, 2 * r + 1)).any(axis=(2, 3))


def feather(m, r):
    k = np.ones(2 * r + 1) / (2 * r + 1)
    f = m.astype(float)
    g = lambda v: np.convolve(np.pad(v, r, mode="edge"), k, "valid")  # noqa: E731
    return np.apply_along_axis(g, 1, np.apply_along_axis(g, 0, f))


def hand_mask(frame):
    sk = skin(frame)
    small = sk[::4, ::4]
    seed = np.zeros_like(small)
    seed[0, :] = small[0, :]
    seed[:, -1] |= small[:, -1]
    for _ in range(400):
        grown = dilate(seed, 1) & small
        if (grown == seed).all():
            break
        seed = grown
    big = np.repeat(np.repeat(seed, 4, 0), 4, 1)[: sk.shape[0], : sk.shape[1]]
    return big & sk | dilate(big, 2)[: sk.shape[0], : sk.shape[1]] & sk


def apply(frame, k0, base):
    sk = dilate(hand_mask(frame), 10)
    a = feather(base & ~sk, 3)[..., None]
    return (frame * (1 - a) + k0 * a).astype(np.uint8)


def size(path):
    import re
    out = subprocess.run([FFMPEG, "-i", path], capture_output=True, text=True).stderr
    w, h = re.search(r"(\d{3,5})x(\d{3,5})", out).groups()
    fps = re.search(r"(\d+(?:\.\d+)?) fps", out)
    return int(w), int(h), (fps.group(1) if fps else "24")


def main():
    mode, k0p, src, dst, fmt = sys.argv[1:6]
    active = {int(x) for x in sys.argv[6].split(",") if x} if len(sys.argv) > 6 else set()
    if mode == "image":
        f = read(src)
        k0 = read(k0p)
        if k0.shape != f.shape:
            raise SystemExit(f"size mismatch {k0.shape} vs {f.shape}")
        write(dst, apply(f.astype(float), k0.astype(float), mask_for(f.shape, fmt, active, k0p)))
        return
    w, h, fps = size(src)
    k0 = np.frombuffer(subprocess.check_output(
        [FFMPEG, "-loglevel", "error", "-i", k0p, "-vf", f"scale={w}:{h}:flags=lanczos",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]), np.uint8).reshape(h, w, 3).astype(float)
    base = mask_for((h, w), fmt, active, k0p)
    dec = subprocess.Popen([FFMPEG, "-loglevel", "error", "-i", src, "-f", "rawvideo",
                            "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    enc = subprocess.Popen([FFMPEG, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                            "-s", f"{w}x{h}", "-r", fps, "-i", "-", "-c:v", "libx264", "-crf", "14",
                            "-preset", "slow", "-pix_fmt", "yuv420p", dst], stdin=subprocess.PIPE)
    n = w * h * 3
    while True:
        buf = dec.stdout.read(n)
        if len(buf) < n:
            break
        fr = np.frombuffer(buf, np.uint8).reshape(h, w, 3).astype(float)
        enc.stdin.write(apply(fr, k0, base).tobytes())
    enc.stdin.close()
    enc.wait()
    dec.wait()


if __name__ == "__main__":
    main()
