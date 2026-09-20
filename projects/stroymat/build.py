#!/usr/bin/env python3
"""Собирает из index.html один самодостаточный файл: шрифты и фото — внутрь."""
import base64, json, pathlib, re

here = pathlib.Path(__file__).parent
src = (here / "index.html").read_text(encoding="utf-8")

faces = json.loads((here / "fonts" / "faces.json").read_text(encoding="utf-8"))
css = []
for f in faces:
    b64 = base64.b64encode((here / "fonts" / f["file"]).read_bytes()).decode()
    css.append(
        f"@font-face{{font-family:'{f['family']}';font-style:normal;"
        f"font-weight:{f['weight']};font-display:swap;"
        f"src:url(data:font/woff2;base64,{b64}) format('woff2');"
        f"unicode-range:{f['range']};}}"
    )

src = re.sub(
    r'<link rel="preconnect".*?rel="stylesheet">',
    "<style>" + "".join(css) + "</style>",
    src,
    flags=re.S,
)

def inline(m):
    data = base64.b64encode((here / "assets" / m.group(1)).read_bytes()).decode()
    return f'src="data:image/jpeg;base64,{data}"'

src = re.sub(r'src="assets/([^"]+)"', inline, src)

out = here / "obnovlenie-assortimenta.html"
out.write_text(src, encoding="utf-8")
print(f"{out.name}: {len(src.encode()) / 1024 / 1024:.2f} MB")

# Вариант для публикации ссылкой: хостинг оборачивает контент в свой каркас,
# поэтому собственные doctype/html/head/body из файла убираются.
frag = src
for tag in ("<!doctype html>", '<html lang="ru">', "<head>", "</head>",
            "<body>", "</body>", "</html>",
            '<meta charset="utf-8">',
            '<meta name="viewport" content="width=device-width, initial-scale=1">'):
    frag = frag.replace(tag, "")
frag = "\n".join(line for line in frag.splitlines() if line.strip())
(here / "artifact.html").write_text(frag, encoding="utf-8")
print(f"artifact.html: {len(frag.encode()) / 1024 / 1024:.2f} MB")
