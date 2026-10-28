#!/usr/bin/env python3
# Previews for the Aequitas deck: full-page shots of each style mockup and
# hero try-ons (an AI sketch placed into the first screen of a style page).
# Usage: python3 previews.py  (needs node + playwright, Pillow)
import json, os, re, subprocess, sys, tempfile
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
CON = os.path.join(ROOT, 'docs/projects/aequitas/concepts')
OUT = os.path.join(CON, 'previews')
SK = os.path.join(CON, 'sketches')

PAGES = ['a', 'b', 'c', 'd', 'e', 'a-char', 'e-char', 'a-ai']
ART = {'a': 'scales', 'b': 'sheet', 'c': 'column', 'd': 'mark', 'e': 'balance'}
TRYON = {
    'hero-scales': 'a', 'hero-poverenny': 'a', 'logo-ae': 'a', 'hero-seal-pen': 'b',
    'hero-hourglass': 'a', 'logo-section': 'd', 'hero-column': 'c', 'hero-masses': 'e',
    'hero-keystone': 'c', 'hero-lion': 'a', 'hero-gauntlet': 'a', 'hero-compass': 'e',
    'hero-atlas': 'c',
}

SHOT_JS = r"""
const {chromium} = require('playwright');
(async () => {
  const jobs = JSON.parse(process.argv[2]);
  const b = await chromium.launch();
  for (const j of jobs) {
    const p = await b.newPage({viewport: {width: j.w, height: j.h}, deviceScaleFactor: 1});
    await p.goto('file://' + j.src, {waitUntil: 'load'});
    await p.addStyleTag({content: '*,*::before,*::after{animation:none!important;transition:none!important}'});
    await p.waitForTimeout(600);
    await p.screenshot({path: j.out, fullPage: j.full});
    await p.close();
  }
  await b.close();
})();
"""


def replace_div(html, cls, inner):
    m = re.search(r'<div class="%s"[^>]*>' % re.escape(cls), html)
    if not m:
        sys.exit('art block %s not found' % cls)
    i, depth = m.end(), 1
    for t in re.finditer(r'<(/?)div\b', html[i:]):
        depth += -1 if t.group(1) else 1
        if depth == 0:
            end = i + t.end() + html[i + t.end():].find('>') + 1
            return html[:m.start()] + inner + html[end:]
    sys.exit('unbalanced div in %s' % cls)


def to_webp(png, out, width, q):
    im = Image.open(png).convert('RGB')
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    if im.height > 16000:
        im = im.crop((0, 0, im.width, 16000))
    im.save(out, quality=q, method=6)


def main():
    os.makedirs(OUT, exist_ok=True)
    tmp = tempfile.mkdtemp()
    jobs, conv = [], []
    for p in PAGES:
        src = os.path.join(CON, p + '.html')
        if p in ART:
            jobs.append(dict(src=src, w=1280, h=800, full=False, out=f'{tmp}/{p}-top.png'))
            conv.append((f'{tmp}/{p}-top.png', f'{OUT}/style-{p}-top.webp', 960, 80))
            jobs.append(dict(src=src, w=390, h=844, full=True, out=f'{tmp}/{p}-m.png'))
            conv.append((f'{tmp}/{p}-m.png', f'{OUT}/style-{p}-mobile.webp', 390, 72))
        jobs.append(dict(src=src, w=1440, h=900, full=True, out=f'{tmp}/{p}-full.png'))
        conv.append((f'{tmp}/{p}-full.png', f'{OUT}/page-{p}.webp', 1200, 70))
    for hero, page in TRYON.items():
        img = os.path.join(SK, hero + '.webp')
        if not os.path.exists(img):
            continue
        html = open(os.path.join(CON, page + '.html'), encoding='utf-8').read()
        inner = ('<div class="tryon" aria-hidden="true" style="align-self:center">'
                 f'<img src="file://{img}" alt="" style="display:block;width:100%;max-height:640px;'
                 'object-fit:cover;aspect-ratio:4/5;border:1px solid rgba(201,166,107,.35)"></div>')
        page_src = os.path.join(CON, f'.tryon-{hero}.html')
        open(page_src, 'w', encoding='utf-8').write(replace_div(html, ART[page], inner))
        jobs.append(dict(src=page_src, w=1440, h=900, full=False, out=f'{tmp}/t-{hero}.png'))
        conv.append((f'{tmp}/t-{hero}.png', f'{OUT}/tryon-{hero}.webp', 1200, 76))
    js = os.path.join(tmp, 'shot.cjs')
    open(js, 'w').write(SHOT_JS)
    env = dict(os.environ)
    env['NODE_PATH'] = subprocess.check_output(['npm', 'root', '-g'], text=True).strip()
    try:
        subprocess.run(['node', js, json.dumps(jobs)], check=True, env=env)
    finally:
        for hero in TRYON:
            f = os.path.join(CON, f'.tryon-{hero}.html')
            if os.path.exists(f):
                os.remove(f)
    for png, out, w, q in conv:
        to_webp(png, out, w, q)
    print(len(conv), 'previews in', OUT)


if __name__ == '__main__':
    main()
