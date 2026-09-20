#!/usr/bin/env python3
"""Обложка статьи блога: PNG от медиа-агента → client/public/blog/<slug>.webp (1600×900, ≤ 120 КБ).

Почему Python: в контейнере нет sharp/cwebp/ImageMagick, есть только Pillow.
Исходный PNG в git НЕ кладём (один такой на 7 МБ уже навсегда в истории) —
он живёт во временной папке, в репозиторий попадает только WebP.

Запуск:  python3 scripts/blog-cover-webp.py <папка>/<slug>.png [...]   # имя файла = slug
         python3 scripts/blog-cover-webp.py --check                    # проверить готовые webp
"""
import argparse
import sys
from pathlib import Path
from PIL import Image
from PIL import ImageOps

SIZE = (1600, 900)
OUT_DIR = Path(__file__).resolve().parent.parent / 'client' / 'public' / 'blog'


def convert(src, out_dir, max_kb, quality):
  im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
  im = ImageOps.fit(im, SIZE, Image.Resampling.LANCZOS, centering=(0.5, 0.5))
  dst = out_dir / f'{src.stem}.webp'
  for q in range(quality, 40, -4):
    im.save(dst, 'WEBP', quality=q, method=6)
    size = dst.stat().st_size
    if size <= max_kb * 1024:
      return dst, q, size
  sys.exit(f'{src.name}: не влезает в {max_kb} КБ даже при quality=44')


def check(out_dir, max_kb):
  bad = 0
  for f in sorted(out_dir.glob('*.webp')):
    im = Image.open(f)
    size = f.stat().st_size
    ok = im.size == SIZE and size <= max_kb * 1024
    bad += not ok
    print(f"{'ok ' if ok else 'BAD'} {f.name:40} {im.size[0]}x{im.size[1]} {size // 1024} КБ")
  return bad


def main():
  p = argparse.ArgumentParser()
  p.add_argument('src', nargs='*', type=Path)
  p.add_argument('--out', type=Path, default=OUT_DIR)
  p.add_argument('--max-kb', type=int, default=120)
  p.add_argument('--quality', type=int, default=82)
  p.add_argument('--check', action='store_true')
  a = p.parse_args()
  if a.check or not a.src:
    sys.exit(1 if check(a.out, a.max_kb) else 0)
  a.out.mkdir(parents=True, exist_ok=True)
  for src in a.src:
    dst, q, size = convert(src, a.out, a.max_kb, a.quality)
    try:
      rel = dst.relative_to(OUT_DIR.parent.parent.parent)
    except ValueError:
      rel = dst
    print(f'{src.name} → {rel}  q={q}  {size // 1024} КБ')


if __name__ == '__main__':
  main()
