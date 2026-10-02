"""Поднять товар пиксель-в-пиксель: силуэт берётся из k0 там, где gap-кадр
отличается от k0, и переносится вверх на dy пикселей поверх gap-кадра.
Результат — кадр с «парящим» товаром того же размера; руку дорисовывает модель.

Запуск: python3 lift.py <k0.png> <gap.png> <out.png> <dy_px> [x0 x1]
x0..x1 — ограничить поиск силуэта этим диапазоном колонок (доля ширины 0..1).
"""
import subprocess
import sys

import numpy as np

FFMPEG = subprocess.check_output(
    ["python3", "-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"],
    text=True,
).strip()


def size(path):
    out = subprocess.run([FFMPEG, "-i", path], capture_output=True, text=True).stderr
    import re

    w, h = re.search(r"(\d{3,5})x(\d{3,5})", out).groups()
    return int(w), int(h)


def read(path):
    w, h = size(path)
    raw = subprocess.check_output(
        [FFMPEG, "-loglevel", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    )
    return np.frombuffer(raw, np.uint8).reshape(h, w, 3).copy()


def write(path, img):
    h, w, _ = img.shape
    subprocess.run(
        [FFMPEG, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
         "-s", f"{w}x{h}", "-i", "-", path],
        input=img.tobytes(), check=True,
    )


def main():
    k0, gap, out, dy = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
    x0 = float(sys.argv[5]) if len(sys.argv) > 5 else 0.0
    x1 = float(sys.argv[6]) if len(sys.argv) > 6 else 1.0
    a, b = read(k0), read(gap)
    h, w, _ = a.shape
    diff = np.abs(a.astype(int) - b.astype(int)).sum(axis=2)
    mask = diff > 40
    mask[:, : int(w * x0)] = False
    mask[:, int(w * x1):] = False
    # убрать мелкий шум: оставить столбцы/строки, где маска плотная
    cols = mask.sum(axis=0) > h * 0.02
    rows = mask.sum(axis=1) > 3
    mask &= cols[None, :] & rows[:, None]
    ys, xs = np.where(mask)
    print(f"silhouette: x {xs.min()}..{xs.max()}, y {ys.min()}..{ys.max()}, px {mask.sum()}")
    res = b.copy()
    src_y, src_x = ys, xs
    dst_y = src_y - dy
    ok = dst_y >= 0
    res[dst_y[ok], src_x[ok]] = a[src_y[ok], src_x[ok]]
    write(out, res)
    print("written", out)


if __name__ == "__main__":
    main()
