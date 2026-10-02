"""Вернуть поднятому товару пиксели из монтажа (lift) после дорисовки руки:
модель, добавляя руку, иногда перерисовывает мелкий текст этикетки.
Копируем пиксели lift-кадра внутри силуэта товара всюду, где на результате
нет кожи (пальцы определяем по цвету), — этикетка снова точная, рука цела.

Запуск: python3 restore.py <k0.png> <gap.png> <lift.png> <hand.png> <out.png> <dy> <x0> <x1>
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lift import read, write  # noqa: E402


def silhouette(k0, gap, thr, x0, x1):
    h, w, _ = k0.shape
    diff = np.abs(k0.astype(int) - gap.astype(int)).sum(axis=2)
    mask = diff > thr
    mask[:, : int(w * x0)] = False
    mask[:, int(w * x1):] = False
    cols = mask.sum(axis=0) > h * 0.02
    rows = mask.sum(axis=1) > 3
    mask &= cols[None, :] & rows[:, None]
    for y in np.where(rows)[0]:
        xs = np.where(mask[y])[0]
        if len(xs) >= 2:
            mask[y, xs.min():xs.max() + 1] = True
    for x in np.where(mask.any(axis=0))[0]:
        ys = np.where(mask[:, x])[0]
        mask[ys.min():ys.max() + 1, x] = True
    return mask


def skin(img):
    r, g, b = img[..., 0].astype(int), img[..., 1].astype(int), img[..., 2].astype(int)
    # кожа заметно краснее стола: у бежевого стола R-G≈20, у пальцев ≥35
    return (r - g > 35) & (g > b) & (r - b > 45) & (r > 120)


def main():
    k0, gap, lift, hand, out = sys.argv[1:6]
    dy = int(sys.argv[6])
    x0, x1 = float(sys.argv[7]), float(sys.argv[8])
    thr = int(os.environ.get("THR", "60"))
    a, b, l, h = read(k0), read(gap), read(lift), read(hand)
    if h.shape != l.shape:
        raise SystemExit(f"size mismatch: hand {h.shape} vs lift {l.shape}")
    m = silhouette(a, b, thr, x0, x1)
    ys, xs = np.where(m)
    dst_y = ys - dy
    ok = dst_y >= 0
    ys, xs, dst_y = ys[ok], xs[ok], dst_y[ok]
    # зона товара на поднятом месте; пальцы (кожа) и их тень (пиксели,
    # заметно темнее lift) не трогаем
    sk = skin(h)
    region = np.zeros(m.shape, bool)
    region[dst_y, xs] = True
    region &= ~sk
    # не трогать 6-px ореол вокруг кожи, чтобы контур пальцев остался мягким
    from numpy.lib.stride_tricks import sliding_window_view as swv  # noqa

    pad = np.pad(sk, 6)
    halo = swv(pad, (13, 13)).any(axis=(2, 3))
    region &= ~halo
    res = h.copy()
    res[region] = l[region]
    write(out, res)
    print(f"restored px: {region.sum()} (silhouette {m.sum()}, skin {sk[region | sk].sum()})")


if __name__ == "__main__":
    main()
