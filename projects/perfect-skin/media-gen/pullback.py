"""Отдалить кадр без перерисовки этикеток: уменьшить исходник, поставить на
холст и продолжить стену и стол к краям растяжением крайних пикселей с мягким
размытием. Товары остаются пиксель в пиксель (с учётом масштаба).

Запуск: python3 pullback.py <src> <out> <W> <H> <scale> <x> <y> [blur_r]
"""
import os
import subprocess
import sys
import tempfile

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lift import FFMPEG, read, write  # noqa: E402


def box(img, r):
    k = np.ones(2 * r + 1) / (2 * r + 1)
    f = lambda m: np.convolve(np.pad(m, r, mode="edge"), k, "valid")  # noqa: E731
    return np.apply_along_axis(f, 1, np.apply_along_axis(f, 0, img))


def main():
    src, out = sys.argv[1:3]
    W, H = int(sys.argv[3]), int(sys.argv[4])
    s = float(sys.argv[5])
    x, y = int(sys.argv[6]), int(sys.argv[7])
    r = int(sys.argv[8]) if len(sys.argv) > 8 else 6
    a = read(src)
    w = int(round(a.shape[1] * s / 2)) * 2
    h = int(round(a.shape[0] * s / 2)) * 2
    with tempfile.TemporaryDirectory() as d:
        tmp = os.path.join(d, "s.png")
        subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", src, "-vf",
                        f"scale={w}:{h}:flags=lanczos", tmp], check=True)
        sm = read(tmp).astype(float)
    big = np.pad(sm, ((y, H - h - y), (x, W - w - x), (0, 0)), mode="edge")
    bl = np.stack([box(big[..., c][::4, ::4], r) for c in range(3)], -1)
    bl = np.repeat(np.repeat(bl, 4, 0), 4, 1)[:H, :W]
    yy, xx = np.mgrid[0:H, 0:W]
    dd = np.minimum.reduce([xx - x, x + w - 1 - xx, yy - y, y + h - 1 - yy]).astype(float)
    al = np.clip(dd / (60 + 6 * r), 0, 1)[..., None]
    write(out, np.clip(big * al + bl * (1 - al), 0, 255).astype(np.uint8))


if __name__ == "__main__":
    main()
