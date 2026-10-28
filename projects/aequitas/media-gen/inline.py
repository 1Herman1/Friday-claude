#!/usr/bin/env python3
# Inline local images of a concepts page as data URIs so the published page
# shows them without relying on relative files. Usage: inline.py in.html out.html
import base64, mimetypes, os, re, sys

src, dst = sys.argv[1], sys.argv[2]
base = os.path.dirname(os.path.abspath(src))
html = open(src, encoding='utf-8').read()

def data_uri(m):
    path = os.path.join(base, m.group(2))
    mime = mimetypes.guess_type(path)[0] or 'image/webp'
    b64 = base64.b64encode(open(path, 'rb').read()).decode()
    return f'{m.group(1)}"data:{mime};base64,{b64}"'

html = re.sub(r'(<img[^>]*?\bsrc=)"((?:sketches|previews)/[^"]+)"', data_uri, html)
open(dst, 'w', encoding='utf-8').write(html)
print(f'{dst}: {os.path.getsize(dst) // 1024} KB')
