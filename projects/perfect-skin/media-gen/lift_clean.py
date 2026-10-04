"""Кадр с поднятым товаром, где всё остальное — пиксели исходного k0.

Модель, стирая один товар, меняет надписи на соседях. Берём из gap-кадра
только место, где стоял поднятый товар (силуэт + запас), а всё прочее — из k0.

Запуск: python3 lift_clean.py <k0> <gap> <out> <dy> <x0> <x1>
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lift import read, write  # noqa: E402
from restore import silhouette  # noqa: E402


def dilate(m, r):
    from numpy.lib.stride_tricks import sliding_window_view as swv
    p = np.pad(m, r)
    return swv(p, (2 * r + 1, 2 * r + 1)).any(axis=(2, 3))


def main():
    k0, gap, out = sys.argv[1:4]
    dy = int(sys.argv[4])
    x0, x1 = float(sys.argv[5]), float(sys.argv[6])
    thr = int(os.environ.get("THR", "50"))
    a, b = read(k0), read(gap)
    m = silhouette(a, b, thr, x0, x1)
    spot = dilate(m, 24)
    res = a.copy()
    res[spot] = b[spot]
    ys, xs = np.where(m)
    dst = ys - dy
    ok = dst >= 0
    res[dst[ok], xs[ok]] = a[ys[ok], xs[ok]]
    write(out, res)
    print(f"silhouette x {xs.min()}..{xs.max()} y {ys.min()}..{ys.max()}")


if __name__ == "__main__":
    main()
