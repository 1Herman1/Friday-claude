"""Frozen-source private pilot. No build, network, dependencies or production writes."""
from collections import Counter
from hashlib import sha256
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
import json
import re

ROOT = Path(__file__).resolve().parents[5]
HEAD = '77d9e09390835250b39a684d245a32f2338fff32'
SOURCE = 'projects/stroymat/obnovlenie-assortimenta.html'
LOCK_SHA = '27d0d7f60c3b1f8b0df9943f669ceac20ab11025ad787f54109d731a13360584'
BASE_SHA = '528aaed361aadd44585b53a9db1e517a3231105989f3c8bf3fd6568d8ff34dca'


class Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        if data.strip():
            self.parts.append(' '.join(data.split()))


def inventory(html):
    cards = re.findall(r'<article\b.*?</article>', html, re.S)
    def text(fragment):
        parser = Text()
        parser.feed(fragment)
        return parser.parts
    prose = re.sub(r'<(?:style|script)\b.*?</(?:style|script)>', '', html, flags=re.S)
    prose = re.sub(r'<nav data-pilot-links\b.*?</nav>', '', prose, flags=re.S)
    return {
        'prose': text(prose),
        'cards': [text(card) for card in cards],
        'contacts': re.findall(r'href="((?:tel:|mailto:)[^"]+)"', html),
        'images': [(sha256(src.encode()).hexdigest(), alt) for src, alt in re.findall(r'<img[^>]+src="([^"]+)"[^>]+alt="([^"]+)"', html)],
        'fonts': [sha256(face.encode()).hexdigest() for face in re.findall(r'@font-face\{[^}]+\}', html)],
    }


def validate_css(css):
    forbidden = r'url\s*\(|@import|@font-face|font-family\s*:|#[0-9a-fA-F]{3,8}\b|body\[data-pilot\]\s*\{\s*display\s*:\s*none'
    if re.search(forbidden, css, re.I) or 'body[data-pilot]' not in css:
        raise ValueError('CSS must stay scoped, token-only and contain no added media/fonts')


def checked_sources(root=None):
    root = Path(root or ROOT).resolve()
    lockpath = Path(__file__).with_name('source-lock.json')
    if lockpath.is_symlink() or sha256(lockpath.read_bytes()).hexdigest() != LOCK_SHA:
        raise ValueError('Source lock hash mismatch')
    lock = json.loads(lockpath.read_bytes())
    if lock['original_commit'] != HEAD or lock['source'] != SOURCE:
        raise ValueError('Unexpected source lock identity')
    files = lock['files']
    source_root = root / 'projects/stroymat'
    for name in files:
        path = PurePosixPath(name)
        if path.is_absolute() or '..' in path.parts or path.as_posix() != name or not name.startswith('projects/stroymat/'):
            raise ValueError('Unsafe source path: ' + name)
    for entry in [source_root, *source_root.rglob('*')]:
        if entry.is_symlink() or not entry.resolve().is_relative_to(source_root.resolve()):
            raise ValueError('Symlink source rejected')
    actual = {p.relative_to(root).as_posix() for p in source_root.rglob('*') if p.is_file()}
    if actual != set(files):
        raise ValueError('Source file inventory mismatch')
    data = {}
    for name, expected in files.items():
        path = root / name
        if any(p.is_symlink() for p in [path, *path.parents] if p.is_relative_to(root)):
            raise ValueError('Symlink source rejected')
        content = path.read_bytes()
        mode = '100755' if path.stat().st_mode & 0o111 else '100644'
        if len(content) != expected['size'] or sha256(content).hexdigest() != expected['sha256'] or mode != expected['mode']:
            raise ValueError('Original source mismatch: ' + name)
        data[name] = content
    return data


def source_bytes(name):
    sources = checked_sources()
    if name not in sources:
        raise ValueError('Unlisted source path')
    return sources[name]


def render(baseline, variant):
    checked_sources()
    if variant not in ('A', 'B') or sha256(baseline.encode()).hexdigest() != BASE_SHA:
        raise ValueError('Only frozen original source and variants A/B are allowed')
    cards = re.findall(r'<article\b.*?</article>', baseline, re.S)
    if len(cards) != 8:
        raise ValueError('Unexpected source inventory')
    normalized = []
    for card in cards:
        if 'class="item-body"' not in card:
            card = re.sub(r'(</div>)(\s*<span class="num">)', r'\1<div class="item-body">\2', card, count=1)
            card = card.replace('</article>', '</div></article>')
        normalized.append(card)
    start = baseline.index(cards[0])
    end = baseline.index(cards[-1]) + len(cards[-1])
    result = baseline[:start] + '<div class="pilot-catalog">' + '\n'.join(normalized) + '</div>' + baseline[end:]
    result = result.replace('<body>', '<body data-pilot="' + variant + '">')
    result = result.replace('<section class="section">', '<section class="section" id="materials" tabindex="-1">', 1)
    result = result.replace('<section class="cta dark" id="price">', '<section class="cta dark" id="price" tabindex="-1">')
    nav = '<nav data-pilot-links class="pilot-links" aria-label="Разделы страницы"><a href="#materials">Форматы и толщины</a><a href="#price">Запросить прайс</a></nav>'
    result = result.replace('<ul class="hero-facts reveal">', nav + '<ul class="hero-facts reveal">')
    css = Path(__file__).with_name('layouts.css').read_text()
    validate_css(css)
    result = result.replace('</head>', '<style id="pilot-layout">' + css + '</style></head>')
    if inventory(result) != inventory(baseline):
        raise ValueError('Content or media identity changed')
    return result


def generate(output):
    requested = Path(output).absolute()
    if any(p.is_symlink() for p in [requested, *requested.parents]):
        raise ValueError('Symlink output rejected')
    output = requested.resolve()
    scratch = (Path.home() / '.hermes/cache/scratch').resolve()
    if not output.is_relative_to(scratch) or output.is_relative_to(ROOT) or output.exists():
        raise ValueError('New output directory must be private Hermes scratch, outside repository')
    sources = checked_sources()
    baseline = sources[SOURCE]
    if sha256(baseline).hexdigest() != BASE_SHA:
        raise ValueError('Frozen source hash mismatch')
    hashes = {p: sha256(data).hexdigest() for p, data in sources.items()}
    afters = {v: render(baseline.decode(), v) for v in ('A', 'B')}
    output.mkdir(parents=True)
    (output / 'baseline.html').write_bytes(baseline)
    for variant, html in afters.items():
        (output / (variant + '.html')).write_text(html)
    receipt = {'head': HEAD, 'source_lock_sha256': LOCK_SHA, 'source': SOURCE, 'baseline_sha256': BASE_SHA, 'source_hashes': hashes,
               'artifacts': {p.name: sha256(p.read_bytes()).hexdigest() for p in output.glob('*.html')},
               'cards': len(inventory(baseline.decode())['cards']), 'owner_acceptance': 'PENDING',
               'rights': 'Existing repository bytes reused only for private owner preview; redistribution/AI-input rights not certified.'}
    (output / 'source-receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2))
    return receipt


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    print(json.dumps(generate(args.output), ensure_ascii=False, indent=2))
